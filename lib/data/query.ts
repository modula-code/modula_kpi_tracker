import {
  averageScorecards,
  buildScorecard,
  finalScore,
  scoreBand,
  type MetricInputs,
  type Scorecard,
} from "@/lib/kpi-engine"
import {
  ALL_TIME,
  ECS as BASE_ECS,
  MONTHS,
  QUARTERS,
  WEEKS,
  YEARS,
  periodById,
} from "./seed"
import { EMPTY_ADMIN_DATA, ERROR_TYPES, type AdminData, type AuditTicket, type Designer, type ErrorType, type Period, type Role } from "./types"

import type { SalesSnapshot } from "./sales-types"
import { periodRange, scoreSales, targetsFor, type TargetConfig } from "./sales-metrics"

function allPeriodsOfGranularity(granularity: Period["granularity"]): Period[] {
  switch (granularity) {
    case "week":
      return WEEKS
    case "month":
      return MONTHS
    case "quarter":
      return QUARTERS
    case "year":
      return YEARS
    case "all":
      return [ALL_TIME]
  }
}

export function resolvePeriod(periodId: string): Period {
  return periodById(periodId) ?? MONTHS[MONTHS.length - 1]
}

export function previousPeriod(period: Period): Period | null {
  const siblings = allPeriodsOfGranularity(period.granularity)
  const idx = siblings.findIndex((p) => p.id === period.id)
  return idx > 0 ? siblings[idx - 1] : null
}

export function trailingPeriods(period: Period, count: number): Period[] {
  const siblings = allPeriodsOfGranularity(period.granularity)
  const idx = siblings.findIndex((p) => p.id === period.id)
  const end = idx < 0 ? siblings.length : idx + 1
  return siblings.slice(Math.max(0, end - count), end)
}

export function ftrStats(tickets: AuditTicket[]): FtrStats {
  const audited = tickets.filter((t) => t.outcome != null)
  const passed = audited.filter((t) => t.outcome === "Pass").length
  const cycles = tickets.map((t) => t.cycleDays)
  return {
    audited: audited.length,
    passed,
    failed: audited.length - passed,
    inFlight: tickets.length - audited.length,
    ftrPct: audited.length ? (passed / audited.length) * 100 : null,
    avgCycleDays: cycles.length ? cycles.reduce((a, b) => a + b, 0) / cycles.length : null,
  }
}

export function errorFrequency(tickets: AuditTicket[]) {
  const counts = new Map<ErrorType, number>(ERROR_TYPES.map((e) => [e, 0]))
  for (const t of tickets) {
    for (const e of t.errors) counts.set(e, (counts.get(e) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
}

export interface Viewer {
  role: Role
  /** Whose seat we're sitting in — a designer id or a manager id. */
  designerId: string
  managerId: string
}

export interface Filters {
  periodId: string
  ecId: string | "all"
  designerId: string | "all"
  managerId: string | "all"
}

export interface LeaderboardRow {
  rank: number
  designerId: string
  name: string
  initials: string
  ec: string
  ecId: string
  manager: string
  final: number | null
  categories: { id: string; label: string; score: number | null }[]
  /** Change in final score against the previous comparable period. */
  delta: number | null
}

export interface FtrStats {
  audited: number
  passed: number
  failed: number
  inFlight: number
  ftrPct: number | null
  avgCycleDays: number | null
}

export interface PayoutSlab {
  ratePerConvertedReferral: number
  percentOfReferredOrderValue: number
  minimumConversions: number
}

export interface PayoutRow {
  designerId: string
  name: string
  ec: string
  leads: number
  converted: number
  referredOrderValue: number
  flatPayout: number
  valuePayout: number
  total: number
  qualifies: boolean
}

export type TargetOverrides = Record<string, number>

/** Bind selectors to this dashboard snapshot, never mutable module globals. */
export function createQueries(snapshot: SalesSnapshot, targets: TargetConfig, ecId = "all", admin: AdminData = EMPTY_ADMIN_DATA) {
  const MANAGERS = admin.managers
  const CIRCLE_MEMBERS = admin.circleMembers
  const ECS = BASE_ECS.map((ec) => ({ ...ec, managerId: admin.ecManagers[ec.id] ?? "" }))
  const scopedLeads = snapshot.leads.filter((lead) => ecId === "all" || lead.ecId === ecId)
  const DESIGNERS: Designer[] = snapshot.designers.map((id) => {
    const own = snapshot.leads.filter((lead) => lead.designer === id)
    const name = own[0]?.designerLabel ?? id
    const ecIds = [...new Set(own.flatMap((lead) => lead.ecId ? [lead.ecId] : []))]
    return { id, name, initials: name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(), ecId: ecIds.length === 1 ? ecIds[0] : "", ecIds, tenure: null }
  })
  const designerById = (id: string) => DESIGNERS.find((d) => d.id === id)
  const ecById = (id: string) => ECS.find((e) => e.id === id)
  const managerById = (id: string) => MANAGERS.find((m) => m.id === id)

  const designersInEc = (ecId: string) => DESIGNERS.filter((d) => d.ecIds?.includes(ecId))
  const ecsForManager = (managerId: string) => ECS.filter((e) => managerId && e.managerId === managerId)
  const designersForManager = (managerId: string) => {
    const ecIds = new Set(ecsForManager(managerId).map((e) => e.id))
    return DESIGNERS.filter((d) => d.ecIds?.some((id) => ecIds.has(id)))
  }

  const managerForDesigner = (designerId: string) => {
    const ec = ecById(designerById(designerId)?.ecId ?? "")
    return ec ? managerById(ec.managerId) : undefined
  }

  // --- Role scoping (brief §6.1) ---------------------------------------------

  function designersVisibleTo(viewer: Viewer) {
    switch (viewer.role) {
      case "designer":
        return DESIGNERS.filter((d) => d.id === viewer.designerId)
      case "manager":
        return designersForManager(viewer.managerId)
      case "head":
        return DESIGNERS
    }
  }

  function ecsVisibleTo(viewer: Viewer) {
    switch (viewer.role) {
      case "designer": {
        const ecIds = designerById(viewer.designerId)?.ecIds ?? []
        return ECS.filter((e) => ecIds.includes(e.id))
      }
      case "manager":
        return ecsForManager(viewer.managerId)
      case "head":
        return ECS
    }
  }

  function managersVisibleTo(viewer: Viewer) {
    switch (viewer.role) {
      case "designer": {
        const m = managerForDesigner(viewer.designerId)
        return m ? [m] : []
      }
      case "manager":
        return MANAGERS.filter((m) => m.id === viewer.managerId)
      case "head":
        return MANAGERS
    }
  }

  // --- Filters ----------------------------------------------------------------

  function filteredDesigners(viewer: Viewer, filters: Filters) {
    let list = designersVisibleTo(viewer)
    if (filters.managerId !== "all") {
      const ecIds = new Set(ecsForManager(filters.managerId).map((e) => e.id))
      list = list.filter((d) => d.ecIds?.some((id) => ecIds.has(id)))
    }
    if (filters.ecId !== "all") list = list.filter((d) => d.ecIds?.includes(filters.ecId))
    if (filters.designerId !== "all") list = list.filter((d) => d.id === filters.designerId)
    return list
  }

  // --- Metric aggregation -----------------------------------------------------

  function metricsFor(
    designerId: string,
    period: Period,
    overrides: TargetOverrides = {},
  ): MetricInputs {
    const leads = scopedLeads.filter((lead) => lead.designer === designerId)
    const sales = scoreSales(leads, period, targetsFor(designerId, targets)).card.categories[0]
    const out: MetricInputs = Object.fromEntries(sales.subKpis.map((sub) => [sub.id, { target: sub.target, actual: sub.actual }]))
    const range = periodRange(period)
    out.referral = {
      target: overrides[`${designerId}:referral`] ?? null,
      actual: snapshot.error ? null : leads.filter((lead) => lead.referral && lead.created >= range.start && lead.created < range.end).length,
    }
    out.csat = { target: null, actual: null }
    return out
  }

  function scorecardFor(
    designerId: string,
    period: Period,
    overrides: TargetOverrides = {},
    locationId = ecId,
  ): Scorecard {
    if (locationId !== ecId) return createQueries(snapshot, targets, locationId, admin).scorecardFor(designerId, period, overrides)
    const card = buildScorecard(metricsFor(designerId, period, overrides))
    card.categories[0] = scoreSales(scopedLeads.filter((lead) => lead.designer === designerId), period, targetsFor(designerId, targets)).card.categories[0]
    card.final = finalScore(card.categories)
    card.band = scoreBand(card.final)
    return card
  }

  function rollupScorecard(
    designerIds: string[],
    period: Period,
    overrides: TargetOverrides = {},
  ): Scorecard {
    const cards = designerIds.map((id) => scorecardFor(id, period, overrides))
    return cards.length === 1 ? cards[0] : averageScorecards(cards)
  }

  function ecScorecard(ecId: string, period: Period, overrides: TargetOverrides = {}) {
    return createQueries(snapshot, targets, ecId, admin).rollupScorecard(designersInEc(ecId).map((d) => d.id), period, overrides)
  }

  function managerScorecard(
    managerId: string,
    period: Period,
    overrides: TargetOverrides = {},
  ) {
    return rollupScorecard(designersForManager(managerId).map((d) => d.id), period, overrides)
  }

  // --- Leaderboard ------------------------------------------------------------

  function leaderboard(
    viewer: Viewer,
    filters: Filters,
    overrides: TargetOverrides = {},
  ): LeaderboardRow[] {
    const period = resolvePeriod(filters.periodId)
    const previous = previousPeriod(period)

    const rows = filteredDesigners(viewer, filters).map((d) => {
      const card = scorecardFor(d.id, period, overrides)
      const prior = previous ? scorecardFor(d.id, previous, overrides) : null
      const ec = ecById(d.ecId)
      return {
        rank: 0,
        designerId: d.id,
        name: d.name,
        initials: d.initials,
        ec: ec ? `${ec.name}` : "—",
        ecId: d.ecId,
        manager: managerForDesigner(d.id)?.name ?? "—",
        final: card.final,
        categories: card.categories.map((c) => ({ id: c.id, label: c.short, score: c.score })),
        delta: card.final != null && prior?.final != null ? card.final - prior.final : null,
      }
    })

    rows.sort((a, b) => (b.final ?? -1) - (a.final ?? -1))
    rows.forEach((r, i) => (r.rank = i + 1))
    return rows
  }

  // --- Module 2: audit tickets ------------------------------------------------

  function ticketsFor(tickets: AuditTicket[], viewer: Viewer, filters: Filters) {
    const period = resolvePeriod(filters.periodId)
    const months = new Set(period.months)
    const ids = new Set(filteredDesigners(viewer, filters).map((d) => d.id))
    return tickets.filter((t) => months.has(t.monthId) && ids.has(t.designerId))
  }

  function errorsByDesigner(tickets: AuditTicket[]) {
    const map = new Map<string, { designerId: string; name: string; total: number; byType: Record<string, number> }>()
    for (const t of tickets) {
      if (!t.errors.length) continue
      const entry = map.get(t.designerId) ?? {
        designerId: t.designerId,
        name: designerById(t.designerId)?.name ?? t.designerId,
        total: 0,
        byType: {},
      }
      for (const e of t.errors) {
        entry.total += 1
        entry.byType[e] = (entry.byType[e] ?? 0) + 1
      }
      map.set(t.designerId, entry)
    }
    return [...map.values()].sort((a, b) => b.total - a.total)
  }

  // --- Module 4: Modula Circle ------------------------------------------------

  function circleMembersFor(viewer: Viewer, filters: Filters) {
    const period = resolvePeriod(filters.periodId)
    const months = new Set(period.months)
    const ids = new Set(filteredDesigners(viewer, filters).map((d) => d.id))
    return CIRCLE_MEMBERS.filter((m) => months.has(m.monthId) && ids.has(m.onboardedBy))
  }

  function circleBookFor(viewer: Viewer, filters: Filters) {
    const period = resolvePeriod(filters.periodId)
    const cutoff = Math.max(...period.months.map((m) => MONTHS.find((x) => x.id === m)?.order ?? 0))
    const ids = new Set(filteredDesigners(viewer, filters).map((d) => d.id))
    return CIRCLE_MEMBERS.filter((m) => {
      const order = MONTHS.find((x) => x.id === m.monthId)?.order ?? 0
      return order <= cutoff && ids.has(m.onboardedBy)
    })
  }

  // --- Module 3: referral payouts --------------------------------------------

  function referralLeads(viewer: Viewer, filters: Filters) {
    const ids = new Set(filteredDesigners(viewer, filters).map((designer) => designer.id))
    return scopedLeads.filter((lead) => lead.referral &&
      (filters.ecId === "all" || lead.ecId === filters.ecId) &&
      (ids.has(lead.designer) || (!lead.designer && viewer.role === "head" && filters.designerId === "all" && filters.managerId === "all")))
  }

  function payoutRows(
    viewer: Viewer,
    filters: Filters,
    slab: PayoutSlab,
  ): PayoutRow[] {
    const period = resolvePeriod(filters.periodId)
    const referrals = referralLeads(viewer, filters)
    const designers = [...filteredDesigners(viewer, filters)]
    if (referrals.some((lead) => !lead.designer)) designers.push({ id: "", name: "Unassigned", initials: "", ecId: "", ecIds: [], tenure: null })
    return designers
      .map((d) => {
        const own = referrals.filter((lead) => lead.designer === d.id)
        const range = periodRange(period)
        const leads = own.filter((lead) => lead.created >= range.start && lead.created < range.end).length
        const bookings = own.filter((lead) => lead.booked && lead.bookedOn && lead.bookedOn >= range.start && lead.bookedOn < range.end)
        const converted = bookings.length
        const referredOrderValue = bookings.reduce((total, lead) => total + lead.amount, 0)
        const qualifies = Boolean(d.id) && converted > 0 && converted >= slab.minimumConversions
        const flatPayout = qualifies ? converted * slab.ratePerConvertedReferral : 0
        const valuePayout = qualifies
          ? Math.round((referredOrderValue * slab.percentOfReferredOrderValue) / 100)
          : 0
        return {
          designerId: d.id,
          name: d.name,
          ec: (ecId !== "all" ? ecById(ecId)?.city : d.ecIds?.map((id) => ecById(id)?.city).filter(Boolean).join(", ")) || "—",
          leads,
          converted,
          referredOrderValue,
          flatPayout,
          valuePayout,
          total: flatPayout + valuePayout,
          qualifies,
        }
      })
      .sort((a, b) => b.total - a.total)
  }

  return { designers: DESIGNERS, managers: MANAGERS, ecs: ECS, designerById, ecById, managerById, designersInEc, ecsForManager, designersForManager, managerForDesigner, designersVisibleTo, ecsVisibleTo, managersVisibleTo, filteredDesigners, metricsFor, scorecardFor, rollupScorecard, ecScorecard, managerScorecard, leaderboard, ticketsFor, errorsByDesigner, circleMembersFor, circleBookFor, payoutRows, referralLeads }
}
