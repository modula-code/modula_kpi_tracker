"use server"

import { revalidatePath } from "next/cache"

import { requireAdmin } from "@/lib/auth"
import { readTargets, writeTargets } from "@/lib/data/targets-store"
import type { DesignerTargets, TargetConfig } from "@/lib/data/sales-metrics"

export interface TargetsState {
  ok?: boolean
  error?: string
  savedAt?: string
}

const FIELDS = ["booking", "annualBooking", "walkin", "aov"] as const

function parse(formData: FormData, prefix: string): DesignerTargets {
  const out: DesignerTargets = {}
  for (const field of FIELDS) {
    const raw = String(formData.get(`${prefix}.${field}`) ?? "").trim()
    if (!raw) continue
    const value = Number(raw)
    if (!Number.isFinite(value) || value <= 0) throw new Error(`${prefix} ${field} must be a positive number`)
    out[field] = value
  }
  return out
}

/** Saves the target grid. Blank cells fall back to the defaults row. */
export async function saveTargets(
  _prev: TargetsState,
  formData: FormData,
): Promise<TargetsState> {
  try {
    await requireAdmin()
    const designers = String(formData.get("designers") ?? "")
      .split("\n")
      .map((n) => n.trim())
      .filter(Boolean)

    const defaults = parse(formData, "defaults")
    const current = await readTargets()

    const config: TargetConfig = {
      defaults: { ...current.defaults, ...defaults },
      byDesigner: {},
    }
    for (const name of designers) {
      const entry = parse(formData, `designer.${name}`)
      if (Object.keys(entry).length) config.byDesigner[name] = entry
    }

    await writeTargets(config)
    revalidatePath("/admin/targets")
    revalidatePath("/modules/sales")
    return { ok: true, savedAt: new Date().toISOString() }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save targets." }
  }
}
