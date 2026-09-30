import "server-only"

import { promises as fs } from "node:fs"
import path from "node:path"

import {
  DEFAULT_TARGETS,
  EMPTY_TARGET_CONFIG,
  type DesignerTargets,
  type TargetConfig,
} from "@/lib/data/sales-metrics"

/**
 * Targets live in a JSON file next to the app rather than a database — there is
 * one set of numbers, edited a few times a year by Ops.
 * ponytail: swap for a table if targets ever need history or per-user audit.
 */
const FILE = path.join(process.cwd(), "data", "sales-targets.json")

const num = (value: unknown): number | undefined => {
  const n = typeof value === "string" ? Number(value) : (value as number)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

function coerce(raw: unknown): TargetConfig {
  const input = (raw ?? {}) as Partial<TargetConfig>
  const defaults: TargetConfig["defaults"] = {
    booking: num(input.defaults?.booking) ?? DEFAULT_TARGETS.booking,
    walkin: num(input.defaults?.walkin) ?? DEFAULT_TARGETS.walkin,
    aov: num(input.defaults?.aov) ?? DEFAULT_TARGETS.aov,
  }
  const defaultAnnual = num(input.defaults?.annualBooking)
  if (defaultAnnual) defaults.annualBooking = defaultAnnual

  const byDesigner: TargetConfig["byDesigner"] = {}
  for (const [name, values] of Object.entries(input.byDesigner ?? {})) {
    const entry: DesignerTargets = {}
    if (num(values?.booking)) entry.booking = num(values?.booking)
    if (num(values?.annualBooking)) entry.annualBooking = num(values?.annualBooking)
    if (num(values?.walkin)) entry.walkin = num(values?.walkin)
    if (num(values?.aov)) entry.aov = num(values?.aov)
    if (Object.keys(entry).length) byDesigner[name] = entry
  }

  return { defaults, byDesigner }
}

export async function readTargets(): Promise<TargetConfig> {
  try {
    return coerce(JSON.parse(await fs.readFile(FILE, "utf8")))
  } catch {
    // No file yet, or someone hand-edited it into invalid JSON.
    return EMPTY_TARGET_CONFIG
  }
}

export async function writeTargets(config: TargetConfig): Promise<TargetConfig> {
  const clean = coerce(config)
  await fs.mkdir(path.dirname(FILE), { recursive: true })
  await fs.writeFile(FILE, `${JSON.stringify(clean, null, 2)}\n`, "utf8")
  return clean
}
