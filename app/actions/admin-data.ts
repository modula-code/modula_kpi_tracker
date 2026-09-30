"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { SESSION, verifySession } from "@/lib/auth"
import { updateAdminData } from "@/lib/data/admin-store"
import { ECS } from "@/lib/data/seed"
import { ERROR_TYPES, TICKET_STAGES, type AdminData } from "@/lib/data/types"

export interface AdminFormState {
  ok?: boolean
  error?: string
}

/** The account in AUTH_EMAIL is the superadmin; nobody else can write. */
async function requireSuperadmin() {
  const email = await verifySession((await cookies()).get(SESSION.cookie)?.value)
  const admin = (process.env.AUTH_EMAIL ?? "").trim().toLowerCase()
  if (!email || !admin || email !== admin) throw new Error("Only the superadmin can change data.")
}

const monthIdOf = (isoDate: string) => `${isoDate.slice(0, 4)}-M${isoDate.slice(5, 7)}`
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date")
const text = (label: string) => z.string().trim().min(1, `${label} is required`).max(200)
const ecId = z.string().refine((id) => ECS.some((ec) => ec.id === id), "Pick an Experience Centre")
const count = z.coerce.number().int().min(0)

const managerSchema = z.object({
  name: text("Name"),
  title: z.enum(["ASM", "EC Manager"]),
})

const ticketSchema = z.object({
  designerId: text("Designer"),
  ecId,
  projectName: text("Project"),
  createdOn: isoDate,
  scheduledFor: z.string().min(1, "Pick an audit slot"),
  auditedOn: z.union([isoDate, z.literal("")]),
  stage: z.enum(TICKET_STAGES),
  outcome: z.enum(["Pass", "Fail", ""]),
  errors: z.array(z.enum(ERROR_TYPES)),
  auditor: text("Auditor"),
  cycleDays: count,
  notes: z.string().max(2000),
})

const circleSchema = z.object({
  name: text("Name"),
  segment: z.enum(["Architect", "Contractor", "Interior Studio", "Channel Partner"]),
  onboardedBy: text("Designer"),
  ecId,
  onboardedOn: isoDate,
  revenue: z.coerce.number().min(0),
  uniqueBookings: count,
  activeReferrals: count,
  status: z.enum(["Active", "Dormant"]),
})

async function save(change: (data: AdminData) => AdminData): Promise<AdminFormState> {
  try {
    await requireSuperadmin()
    await updateAdminData(change)
    revalidatePath("/", "layout")
    return { ok: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save." }
  }
}

function parse<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> | string {
  const result = schema.safeParse(input)
  return result.success ? result.data : result.error.issues[0].message
}

export async function addManager(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const data = parse(managerSchema, Object.fromEntries(formData))
  if (typeof data === "string") return { error: data }
  const initials = data.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()
  return save((d) => ({ ...d, managers: [...d.managers, { id: crypto.randomUUID(), initials, ...data }] }))
}

export async function assignEcManager(ec: string, managerId: string): Promise<AdminFormState> {
  if (!ECS.some((e) => e.id === ec)) return { error: "Unknown Experience Centre." }
  return save((d) => {
    const ecManagers = { ...d.ecManagers }
    if (managerId && d.managers.some((m) => m.id === managerId)) ecManagers[ec] = managerId
    else delete ecManagers[ec]
    return { ...d, ecManagers }
  })
}

export async function addAuditTicket(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const data = parse(ticketSchema, { ...Object.fromEntries(formData), errors: formData.getAll("errors") })
  if (typeof data === "string") return { error: data }
  const outcome = data.outcome || null
  return save((d) => ({
    ...d,
    auditTickets: [
      ...d.auditTickets,
      {
        ...data,
        id: crypto.randomUUID(),
        monthId: monthIdOf(data.createdOn),
        auditedOn: data.auditedOn || null,
        outcome,
        errors: outcome === "Fail" ? data.errors : [],
      },
    ],
  }))
}

export async function addCircleMember(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const data = parse(circleSchema, Object.fromEntries(formData))
  if (typeof data === "string") return { error: data }
  return save((d) => ({
    ...d,
    circleMembers: [...d.circleMembers, { ...data, id: crypto.randomUUID(), monthId: monthIdOf(data.onboardedOn) }],
  }))
}

export async function deleteAdminRecord(
  kind: "managers" | "auditTickets" | "circleMembers",
  id: string,
): Promise<AdminFormState> {
  return save((d) => {
    const next = { ...d, [kind]: (d[kind] as { id: string }[]).filter((row) => row.id !== id) }
    // A deleted manager can't keep owning ECs.
    if (kind === "managers") {
      next.ecManagers = Object.fromEntries(Object.entries(d.ecManagers).filter(([, m]) => m !== id))
    }
    return next as AdminData
  })
}
