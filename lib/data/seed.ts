/** Reporting periods and the EC list. Managers, tickets and Circle members live in admin-data.json. */
import type { ExperienceCenter, Period } from "./types"
import locations from "@/data/ec-locations.json"

/** Imported from EC's_city.xlsx, matched to Odoo company names. */
export const ECS: ExperienceCenter[] = locations.map(({ name, city }) => ({
  id: name.toLowerCase(), name, city, code: "", managerId: "",
}))
export const DEFAULT_PAYOUT = {
  ratePerConvertedReferral: 0,
  percentOfReferredOrderValue: 0,
  minimumConversions: 0,
}

// --- The reporting "today" --------------------------------------------------

/**
 * The reporting window ends with the current month, so the live Odoo modules
 * can always be read for the month in progress. Two years of months gives the
 * quarterly, yearly, and all-time views something to average over.
 */
const TODAY = new Date()
const LAST_YEAR = TODAY.getFullYear()
const LAST_MONTH = TODAY.getMonth() + 1
const MONTH_COUNT = 24
export const AS_OF = TODAY.toISOString().slice(0, 10)

// --- Periods ----------------------------------------------------------------

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

const monthId = (year: number, month: number) =>
  `${year}-M${String(month).padStart(2, "0")}`

/** The months ending with the reporting month, oldest first. */
export const MONTHS: Period[] = Array.from({ length: MONTH_COUNT }, (_, i) => {
  const offset = MONTH_COUNT - 1 - i
  const total = LAST_YEAR * 12 + (LAST_MONTH - 1) - offset
  const year = Math.floor(total / 12)
  const month = (total % 12) + 1
  const id = monthId(year, month)
  return {
    id,
    granularity: "month" as const,
    label: `${MONTH_NAMES[month - 1]} ${year}`,
    order: total,
    months: [id],
    scale: 1,
    wobble: 1,
  }
})

/**
 * The 12 most recent weeks, each a 7-day slice of its parent month (the fourth
 * runs to month end). The newest week is the one today falls in, so the weekly
 * view never opens on a week that has not happened yet.
 */
const CURRENT_WEEK = Math.min(4, Math.ceil(TODAY.getDate() / 7))

export const WEEKS: Period[] = Array.from({ length: 12 }, (_, i) => {
  const fromEnd = 11 - i + (4 - CURRENT_WEEK)
  const parent = MONTHS[MONTHS.length - 1 - Math.floor(fromEnd / 4)]
  const weekInMonth = 4 - (fromEnd % 4)
  const [yearStr, monthPart] = parent.id.split("-M")
  const isoWeek = (Number(monthPart) - 1) * 4 + weekInMonth
  const id = `${yearStr}-W${String(isoWeek).padStart(2, "0")}`
  return {
    id,
    granularity: "week" as const,
    label: `W${isoWeek} · ${parent.label}`,
    order: parent.order * 10 + weekInMonth,
    months: [parent.id],
    scale: 7 / 30.44,
    wobble: 1,
  }
})

export const QUARTERS: Period[] = (() => {
  const groups = new Map<string, Period[]>()
  for (const m of MONTHS) {
    const [year, monthPart] = m.id.split("-M")
    const q = Math.ceil(Number(monthPart) / 3)
    const key = `${year}-Q${q}`
    groups.set(key, [...(groups.get(key) ?? []), m])
  }
  return [...groups.entries()].map(([id, months]) => ({
    id,
    granularity: "quarter" as const,
    label: id.replace("-", " "),
    order: Math.max(...months.map((m) => m.order)),
    months: months.map((m) => m.id),
    scale: 1,
    wobble: 1,
  }))
})()

export const YEARS: Period[] = (() => {
  const groups = new Map<string, Period[]>()
  for (const m of MONTHS) {
    const year = m.id.split("-M")[0]
    groups.set(year, [...(groups.get(year) ?? []), m])
  }
  return [...groups.entries()].map(([id, months]) => ({
    id,
    granularity: "year" as const,
    label: id,
    order: Math.max(...months.map((m) => m.order)),
    months: months.map((m) => m.id),
    scale: 1,
    wobble: 1,
  }))
})()

/** One period covering everything on record — the all-time view. */
export const ALL_TIME: Period = {
  id: "all",
  granularity: "all",
  label: "All time",
  order: Number.MAX_SAFE_INTEGER,
  months: MONTHS.map((m) => m.id),
  scale: 1,
  wobble: 1,
}

export const PERIODS: Period[] = [...WEEKS, ...MONTHS, ...QUARTERS, ...YEARS, ALL_TIME]

export const periodsByGranularity = {
  week: [...WEEKS].reverse(),
  month: [...MONTHS].reverse(),
  quarter: [...QUARTERS].reverse(),
  year: [...YEARS].reverse(),
  all: [ALL_TIME],
}

export const DEFAULT_PERIOD_ID = MONTHS[MONTHS.length - 1].id

export const periodById = (id: string) => PERIODS.find((p) => p.id === id)

