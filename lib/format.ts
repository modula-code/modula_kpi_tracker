import type { Unit } from "@/lib/kpi-engine"

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
})

const compactInr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  notation: "compact",
  maximumFractionDigits: 1,
})

const plain = new Intl.NumberFormat("en-IN")

export const EM_DASH = "—"

/** Formats a value in its own unit. Nulls render as an em dash, never as 0. */
export function formatValue(value: number | null | undefined, unit: Unit, compact = true): string {
  if (value == null || !Number.isFinite(value)) return EM_DASH
  switch (unit) {
    case "currency":
      return compact ? compactInr.format(value) : inr.format(value)
    case "percent":
      return `${value.toFixed(1)}%`
    case "days":
      return `${value.toFixed(1)} d`
    case "score":
      return value.toFixed(2)
    case "count":
      return plain.format(Math.round(value))
  }
}

export function formatCurrency(value: number | null | undefined, compact = true) {
  return formatValue(value, "currency", compact)
}

export function formatPct(value: number | null | undefined, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return EM_DASH
  return `${value.toFixed(digits)}%`
}

export function formatScore(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return EM_DASH
  return value.toFixed(digits)
}

export function formatDelta(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return EM_DASH
  const sign = value > 0 ? "+" : ""
  return `${sign}${value.toFixed(digits)}`
}

export function formatCount(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return EM_DASH
  return plain.format(Math.round(value))
}

/** "12 Mar 2026" */
export function formatDate(iso: string | null): string {
  if (!iso) return EM_DASH
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

/** "12 Mar, 2:30 pm" */
export function formatDateTime(iso: string | null): string {
  if (!iso) return EM_DASH
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  })
}

/** Weight fractions render as whole percentages: 0.4 -> "40%". */
export function formatWeight(weight: number): string {
  return `${Math.round(weight * 100)}%`
}
