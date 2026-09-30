import "server-only"

import { odooCall, odooUid } from "@/lib/odoo"
import type { SalesLead, SalesSnapshot } from "@/lib/data/sales-types"
import { ECS } from "@/lib/data/seed"

/**
 * Live Sales & Conversion data from Odoo.
 *
 * Designer   — crm.lead.x_studio_design_poc_1 (a selection of designer names).
 * Booking    — the lead is at "Booking Fee ( 10% Design Fee )" (the won
 *              stage) or any stage after it. Derived from the won stage rather
 *              than hardcoded, so renumbering stages in Odoo does not silently
 *              change the metric.
 * Booked on  — first entry into any of those stages, from the stage timeline
 *              (x_lead_stage_history).
 * Order value — amount_total of the *latest* sale.order on the lead, linked
 *              through sale.order.x_studio_project_name. No order found = 0,
 *              per the brief.
 */

/** One legacy stage sits after the confirmation stage by sequence but before it
 *  in the funnel, so it is excluded by name rather than by position. */
const PRE_BOOKING_LEGACY_STAGES = new Set(["Design Draft & Pricing"])

/**
 * Every company in Odoo feeds this module except these four — they are
 * manufacturing and tooling arms, not design businesses. Matched on the exact
 * res.company names, case-insensitively.
 */
const EXCLUDED_COMPANIES = [
  "Dongkwang Precision India Pvt. Ltd",
  "Sai Ganesh Tooling",
  "BHAGYALAXMI KITCHEN AND INTERIOR DESIGNERS",
  "HOLM KK EXTRUSIONS PVT LTD",
].map((name) => name.toLowerCase())

/**
 * Walk-in conversion counts only leads that came through the door, identified
 * by crm.lead.source_id. The source names are inconsistent in Odoo ("Walkin",
 * "walkin", "Direct"), so they are matched case-insensitively.
 */
const WALKIN_SOURCES = new Set(["direct", "walkin", "walk in", "walk-in", "direct/walkin"])

type Ref = [number, string] | false

interface LeadRecord {
  id: number
  name: string | false
  x_studio_design_poc_1: string | false
  referred: string | false
  x_studio_referrer_name: string | false
  x_studio_referrer_email: string | false
  x_studio_referrer_phone: string | false
  company_id: Ref
  source_id: Ref
  stage_id: Ref
  create_date: string
  date_closed: string | false
  active: boolean
  lost_reason_id: Ref
}

interface OrderRecord {
  id: number
  name: string
  x_studio_project_name: Ref
  amount_total: number
  date_order: string | false
  state: string
}

interface StageHistoryRecord {
  x_lead_id: Ref
  x_in_date: string | false
}

interface CompanyRecord {
  id: number
  name: string
}

/**
 * Companies to compile from: everything the RPC user may read, minus the
 * excluded four. Both the id list (for the domain) and the allowed-company
 * context matter — Odoo hides records outside the active companies otherwise.
 */
async function includedCompanies(): Promise<{ ids: number[]; names: string[]; allowed: number[] }> {
  const uid = await odooUid()
  const [user] = await odooCall<{ company_ids: number[] }[]>("res.users", "read", [
    [uid],
    ["company_ids"],
  ])
  const allowed = user?.company_ids ?? []

  const companies = await odooCall<CompanyRecord[]>(
    "res.company",
    "search_read",
    [[["id", "in", allowed]], ["id", "name"]],
    { order: "name asc" },
  )
  const included = companies.filter((c) => !EXCLUDED_COMPANIES.includes(c.name.toLowerCase()))
  return {
    ids: included.map((c) => c.id),
    names: included.map((c) => c.name),
    allowed,
  }
}

interface StageRecord {
  id: number
  name: string
  sequence: number
  is_won: boolean
}

/** Stage ids at or past the 10% booking stage — i.e. the lead booked. */
async function bookedStages(): Promise<Set<number>> {
  const stages = await odooCall<StageRecord[]>(
    "crm.stage",
    "search_read",
    [[], ["id", "name", "sequence", "is_won"]],
    { order: "sequence asc" },
  )
  const won = stages.find((s) => s.is_won)
  if (!won) return new Set()

  return new Set(
    stages
      .filter((s) => s.sequence >= won.sequence && !PRE_BOOKING_LEGACY_STAGES.has(s.name))
      .map((s) => s.id),
  )
}

const day = (value: string | false | null): string | null =>
  value ? value.slice(0, 10) : null

/** ponytail: process-local TTL cache. One dashboard, one process — swap for a
 *  shared cache only if this is ever deployed to more than one instance. */
const TTL_MS = 15 * 60 * 1000
let cache: { at: number; data: SalesSnapshot } | null = null

export async function fetchSalesSnapshot(): Promise<SalesSnapshot> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data
  const data = await loadSalesSnapshot()
  cache = { at: Date.now(), data }
  return data
}

async function loadSalesSnapshot(): Promise<SalesSnapshot> {
  const companies = await includedCompanies()
  // Archived leads are the lost ones — they belong in the conversion denominator.
  // allowed_company_ids widens the read to every company the user may see.
  const context = { active_test: false, allowed_company_ids: companies.allowed }

  const [bookedStageIds, fields] = await Promise.all([
    bookedStages(),
    odooCall<Record<string, { selection: [string, string][] }>>(
      "crm.lead", "fields_get", [["x_studio_design_poc_1"]], { attributes: ["selection"] },
    ),
  ])
  const designerLabels = new Map(fields.x_studio_design_poc_1.selection)

  const leads = await odooCall<LeadRecord[]>(
    "crm.lead",
    "search_read",
    [
      [
        ["company_id", "in", companies.ids],
        // Keep the sales scope and include referrals awaiting a designer.
        ...Array(5).fill("|"),
        ["x_studio_design_poc_1", "not in", [false, "Not Assigned"]],
        ["referred", "!=", false],
        ["x_studio_referrer_name", "!=", false],
        ["x_studio_referrer_email", "!=", false],
        ["x_studio_referrer_phone", "!=", false],
        ["source_id.name", "ilike", "referr"],
      ],
      [
        "id",
        "name",
        "x_studio_design_poc_1",
        "company_id",
        "source_id",
        "stage_id",
        "create_date",
        "date_closed",
        "active",
        "lost_reason_id",
        "referred",
        "x_studio_referrer_name",
        "x_studio_referrer_email",
        "x_studio_referrer_phone",
      ],
    ],
    { context, order: "id asc" },
  )

  const leadIds = leads.map((l) => l.id)
  if (!leadIds.length) {
    return {
      designers: [],
      leads: [],
      companies: companies.names,
      syncedAt: new Date().toISOString(),
    }
  }

  const [orders, history] = await Promise.all([
    odooCall<OrderRecord[]>(
      "sale.order",
      "search_read",
      [
        [
          ["x_studio_project_name", "in", leadIds],
          ["state", "!=", "cancel"],
        ],
        ["id", "name", "x_studio_project_name", "amount_total", "date_order", "state"],
      ],
      // Ascending, so the last row per lead is the latest order.
      { context, order: "date_order asc, id asc" },
    ),
    odooCall<StageHistoryRecord[]>(
      "x_lead_stage_history",
      "search_read",
      [
        [
          ["x_lead_id", "in", leadIds],
          ["x_stage_id", "in", [...bookedStageIds]],
        ],
        ["x_lead_id", "x_in_date"],
      ],
      { context, order: "x_in_date asc" },
    ),
  ])

  const latestOrder = new Map<number, OrderRecord>()
  const firstOrderDate = new Map<number, string>()
  for (const order of orders) {
    if (!order.x_studio_project_name) continue
    const leadId = order.x_studio_project_name[0]
    latestOrder.set(leadId, order)
    const ordered = day(order.date_order)
    if (ordered && !firstOrderDate.has(leadId)) firstOrderDate.set(leadId, ordered)
  }

  const bookedOnFromHistory = new Map<number, string>()
  for (const row of history) {
    if (!row.x_lead_id) continue
    const ordered = day(row.x_in_date)
    if (ordered && !bookedOnFromHistory.has(row.x_lead_id[0])) {
      bookedOnFromHistory.set(row.x_lead_id[0], ordered)
    }
  }

  const rows: SalesLead[] = leads.map((lead) => {
    const booked = lead.stage_id ? bookedStageIds.has(lead.stage_id[0]) : false
    const order = latestOrder.get(lead.id)
    const created = day(lead.create_date)!
    // The stage timeline only goes back to March 2026, so fall back to the first
    // order date, then the closed date, then the lead's own creation date.
    const bookedOn = booked
      ? (bookedOnFromHistory.get(lead.id) ??
        firstOrderDate.get(lead.id) ??
        day(lead.date_closed) ??
        created)
      : null

    return {
      id: lead.id,
      name: lead.name || `Lead ${lead.id}`,
      designer: lead.x_studio_design_poc_1 && lead.x_studio_design_poc_1 !== "Not Assigned" ? lead.x_studio_design_poc_1 : "",
      designerLabel: lead.x_studio_design_poc_1 ? designerLabels.get(lead.x_studio_design_poc_1) ?? lead.x_studio_design_poc_1 : "",
      ecId: ECS.find((ec) => ec.id === (lead.company_id ? lead.company_id[1].trim().toLowerCase() : ""))?.id ?? null,
      referrerName: lead.x_studio_referrer_name || null,
      referredBy: lead.referred || null,
      referrerEmail: lead.x_studio_referrer_email || null,
      referrerPhone: lead.x_studio_referrer_phone || null,
      referral: Boolean(
        [lead.x_studio_referrer_name, lead.referred,
          lead.x_studio_referrer_email, lead.x_studio_referrer_phone].some((v) => v && v.trim()) ||
        (lead.source_id && /referr/i.test(lead.source_id[1])),
      ),
      company: lead.company_id ? lead.company_id[1] : "—",
      source: lead.source_id ? lead.source_id[1] : null,
      walkin: lead.source_id ? WALKIN_SOURCES.has(lead.source_id[1].trim().toLowerCase()) : false,
      stage: lead.stage_id ? lead.stage_id[1] : "—",
      created,
      booked,
      bookedOn,
      order: order?.name ?? null,
      amount: order?.amount_total ?? 0,
      lost: !lead.active,
    }
  })

  const designers = [...new Set(rows.map((r) => r.designer).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  return {
    designers,
    leads: rows,
    companies: companies.names,
    syncedAt: new Date().toISOString(),
  }
}
