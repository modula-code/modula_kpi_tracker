/**
 * Aggregation for the live Sales & Conversion module.
 *
 * The server hands the page every designer-assigned lead once; the client slices
 * it by whatever period the filter bar is on. ~1k rows, so this is cheap.
 *
 * Basis: leads count in the month they were *created*, bookings and order value
 * count in the month the lead *booked*. Conversion is bookings ÷ leads on that
 * pairing — the standard walk-in conversion read.
 */

import type { SalesLead } from "@/lib/data/sales-types"
import type { Period } from "@/lib/data/types"
import {
  buildScorecard,
  categoryScore,
  finalScore,
  ratingFor,
  scoreBand,
  type MetricInputs,
  type Scorecard,
} from "@/lib/kpi-engine"

/** Monthly targets for one designer. */
export interface TargetSet {
  /** Booking value per month (INR). */
  booking: number
  /** Walk-in conversion, percent. */
  walkin: number
  /** Average order value (INR). */
  aov: number
}

/**
 * What can be stored per designer: a monthly booking target, an annual one, or
 * both. An annual target with no monthly figure spreads evenly over the year.
 */
export interface DesignerTargets extends Partial<TargetSet> {
  annualBooking?: number
}

/**
 * Targets are not in Odoo, so they are edited in /admin/targets and stored
 * alongside the app. A designer with no entry falls back to the defaults.
 */
export interface TargetConfig {
  defaults: TargetSet & { annualBooking?: number }
  byDesigner: Record<string, DesignerTargets>
}

export const DEFAULT_TARGETS: TargetSet = {
  booking: 1_000_000,
  walkin: 25,
  aov: 600_000,
}

export const EMPTY_TARGET_CONFIG: TargetConfig = { defaults: DEFAULT_TARGETS, byDesigner: {} }

const positive = (value: number | undefined, fallback: number) =>
  value != null && Number.isFinite(value) && value > 0 ? value : fallback

/**
 * One designer's monthly targets: their own where set, an annual figure spread
 * over twelve months where only that is set, and the defaults otherwise.
 */
export function targetsFor(designer: string, config: TargetConfig): TargetSet {
  const defaults = config.defaults ?? DEFAULT_TARGETS
  const own = config.byDesigner?.[designer] ?? {}
  const monthlyDefault = positive(
    defaults.annualBooking ? defaults.annualBooking / 12 : undefined,
    defaults.booking,
  )
  return {
    booking: positive(
      own.booking ?? (own.annualBooking ? own.annualBooking / 12 : undefined),
      monthlyDefault,
    ),
    walkin: positive(own.walkin, defaults.walkin),
    aov: positive(own.aov, defaults.aov),
  }
}

/** The annual booking target — set explicitly, or twelve monthly ones. */
export function annualBookingTarget(designer: string, config: TargetConfig): number {
  const own = config.byDesigner?.[designer] ?? {}
  return positive(
    own.annualBooking,
    positive(own.booking ? own.booking * 12 : undefined, targetsFor(designer, config).booking * 12),
  )
}

/**
 * Targets for a group: booking value adds up across the designers in scope,
 * while conversion and AOV are rates and average instead.
 */
export function teamTargets(designers: string[], config: TargetConfig): TargetSet {
  if (!designers.length) return config.defaults ?? DEFAULT_TARGETS
  const each = designers.map((d) => targetsFor(d, config))
  const mean = (pick: (t: TargetSet) => number) =>
    each.reduce((sum, t) => sum + pick(t), 0) / each.length
  return {
    booking: each.reduce((sum, t) => sum + t.booking, 0),
    walkin: mean((t) => t.walkin),
    aov: mean((t) => t.aov),
  }
}

const AVG_MONTH_DAYS = 30.44

export interface DateRange {
  start: string
  end: string
  /** Length in days — scales the monthly volume targets. */
  days: number
}

const pad = (n: number) => String(n).padStart(2, "0")
const isoDate = (year: number, month: number, day: number) =>
  `${year}-${pad(month)}-${pad(day)}`

function monthStart(monthId: string) {
  const [year, month] = monthId.split("-M").map(Number)
  return { year, month }
}

function nextMonth(year: number, month: number) {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 }
}

function daysBetween(start: string, end: string) {
  return Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000)
}

/** Every calendar day on record — the all-time view has no natural bounds. */
const ALL_TIME_RANGE: DateRange = {
  start: "1970-01-01",
  end: "2999-12-31",
  days: daysBetween("1970-01-01", "2999-12-31"),
}

/** Half-open [start, end) calendar range for any period the filter bar can pick. */
export function periodRange(period: Period): DateRange {
  if (period.granularity === "all") return ALL_TIME_RANGE
  const months = [...period.months].sort()
  const first = monthStart(months[0])
  const last = monthStart(months[months.length - 1])

  if (period.granularity === "week") {
    // Seed week ids are `YYYY-Wnn` with nn = (month - 1) * 4 + weekInMonth.
    const isoWeek = Number(period.id.split("-W")[1])
    const weekInMonth = ((isoWeek - 1) % 4) + 1
    const startDay = (weekInMonth - 1) * 7 + 1
    const start = isoDate(first.year, first.month, startDay)
    const after = nextMonth(first.year, first.month)
    const end =
      weekInMonth === 4
        ? isoDate(after.year, after.month, 1)
        : isoDate(first.year, first.month, startDay + 7)
    return { start, end, days: daysBetween(start, end) }
  }

  const start = isoDate(first.year, first.month, 1)
  const after = nextMonth(last.year, last.month)
  const end = isoDate(after.year, after.month, 1)
  return { start, end, days: daysBetween(start, end) }
}

const inRange = (date: string | null, range: DateRange) =>
  date != null && date >= range.start && date < range.end

export interface SalesAggregate {
  leads: number
  booked: number
  lost: number
  /** Leads whose source_id is a walk-in / direct one. */
  walkinLeads: number
  /** Bookings confirmed in the period that came from a walk-in lead. */
  walkinBooked: number
  /**
   * Walk-in conversion: walk-in bookings ÷ walk-in leads, percent. Null when no
   * walk-in lead landed in the period — unmeasured rather than 0%.
   */
  conversionPct: number | null
  bookingValue: number
  /** Mean order value across bookings — a booking with no sale order counts 0. */
  aov: number | null
  /** How many of those bookings actually had a sale order behind them. */
  withOrder: number
}

export function aggregateSales(leads: SalesLead[], range: DateRange): SalesAggregate {
  let created = 0
  let lost = 0
  let booked = 0
  let bookingValue = 0
  let withOrder = 0
  let walkinLeads = 0
  let walkinBooked = 0

  for (const lead of leads) {
    if (inRange(lead.created, range)) {
      created += 1
      if (lead.lost) lost += 1
      if (lead.walkin) walkinLeads += 1
    }
    if (lead.booked && inRange(lead.bookedOn, range)) {
      booked += 1
      bookingValue += lead.amount
      if (lead.order) withOrder += 1
      if (lead.walkin) walkinBooked += 1
    }
  }

  return {
    leads: created,
    booked,
    lost,
    walkinLeads,
    walkinBooked,
    conversionPct: walkinLeads ? (walkinBooked / walkinLeads) * 100 : null,
    bookingValue,
    aov: booked ? bookingValue / booked : null,
    withOrder,
  }
}

/** Rows for the per-designer table, sorted by booking value. */
export function aggregateByDesigner(
  leads: SalesLead[],
  designers: string[],
  range: DateRange,
): { designer: string; agg: SalesAggregate; leads: SalesLead[] }[] {
  return designers
    .map((designer) => {
      const own = leads.filter((l) => l.designer === designer)
      return { designer, agg: aggregateSales(own, range), leads: own }
    })
    .sort((a, b) => b.agg.bookingValue - a.agg.bookingValue)
}

/**
 * Target/actual pairs for the three Sales sub-KPIs, ready for buildScorecard.
 * `targets` is monthly; `months` says how many monthly targets the period is
 * worth. Callers pass it explicitly — a calendar month is always worth exactly
 * one target, whether it runs 28 days or 31 — and only weeks pro-rate by days.
 */
export function salesMetricInputs(
  agg: SalesAggregate,
  range: DateRange,
  targets: TargetSet,
  monthsWorth?: number,
): MetricInputs {
  const months = monthsWorth ?? range.days / AVG_MONTH_DAYS
  // A designer with no leads and no bookings in the period is unmeasured, not a
  // zero — scoring them 1/4 would punish someone who was simply not staffed.
  const idle = agg.leads === 0 && agg.booked === 0
  return {
    booking: {
      target: Math.round(targets.booking * months),
      actual: idle ? null : Math.round(agg.bookingValue),
    },
    walkin: { target: targets.walkin, actual: agg.conversionPct },
    aov: { target: targets.aov, actual: agg.aov == null ? null : Math.round(agg.aov) },
  }
}

// --- Scoring by granularity -------------------------------------------------

/** Every month from the first to the last date on record, oldest first. */
function monthsSpanning(leads: SalesLead[]): string[] {
  const stamps = leads.flatMap((l) => (l.bookedOn ? [l.created, l.bookedOn] : [l.created]))
  if (!stamps.length) return []

  const first = monthStart(stamps.reduce((a, b) => (a < b ? a : b)).slice(0, 7).replace("-", "-M"))
  const last = monthStart(stamps.reduce((a, b) => (a > b ? a : b)).slice(0, 7).replace("-", "-M"))

  const ids: string[] = []
  let cursor = first
  const limit = last.year * 12 + last.month
  while (cursor.year * 12 + cursor.month <= limit) {
    ids.push(`${cursor.year}-M${pad(cursor.month)}`)
    cursor = nextMonth(cursor.year, cursor.month)
  }
  return ids
}

/** The month ranges a period is scored over, oldest first. */
export function monthRangesIn(period: Period, leads: SalesLead[] = []): DateRange[] {
  const ids =
    period.granularity === "all" ? monthsSpanning(leads) : [...period.months].sort()

  return ids.map((monthId) => {
    const { year, month } = monthStart(monthId)
    const after = nextMonth(year, month)
    const start = isoDate(year, month, 1)
    const end = isoDate(after.year, after.month, 1)
    return { start, end, days: daysBetween(start, end) }
  })
}

export interface PeriodScore {
  /** Totals across the whole period — the numbers on the cards. */
  agg: SalesAggregate
  /** The scorecard the ratings and module score are read from. */
  card: Scorecard
  /** "direct" scores the period as one block; "average" means monthly scores. */
  basis: "direct" | "average"
  /** Months that carried a score, when the basis is an average. */
  monthsScored: number
}

/**
 * Weeks and months are scored directly against their target. Quarters, years,
 * and all-time are the average of the monthly scores inside them, so a quarter
 * reads as its three months rather than one lumped total.
 */
export function scoreSales(
  leads: SalesLead[],
  period: Period,
  targets: TargetSet,
): PeriodScore {
  const range = periodRange(period)
  const agg = aggregateSales(leads, range)

  if (period.granularity === "week" || period.granularity === "month") {
    // A week is worth its share of the month; a month is worth exactly one.
    const worth = period.granularity === "month" ? 1 : range.days / AVG_MONTH_DAYS
    const inputs = salesMetricInputs(agg, range, targets, worth)
    return { agg, card: buildScorecard(inputs), basis: "direct", monthsScored: 1 }
  }

  const monthRanges = monthRangesIn(period, leads)
  const displayInputs = salesMetricInputs(agg, range, targets, monthRanges.length)
  const monthly = monthRanges.map((monthRange) =>
    buildScorecard(salesMetricInputs(aggregateSales(leads, monthRange), monthRange, targets, 1)),
  )
  const card = averageMonthlyScores(monthly, displayInputs)
  const monthsScored = monthly.filter((c) => c.categories[0].score != null).length
  return { agg, card, basis: "average", monthsScored }
}

/**
 * Averages monthly scorecards: every sub-KPI's achievement is the mean of the
 * months that could be measured, and the category score follows from those.
 * Targets and actuals still show the period totals, so the card reads sensibly.
 */
function averageMonthlyScores(monthly: Scorecard[], displayInputs: MetricInputs): Scorecard {
  const base = buildScorecard(displayInputs)

  const categories = base.categories.map((cat, ci) => {
    const subKpis = cat.subKpis.map((sub, si) => {
      const achievements = monthly
        .map((c) => c.categories[ci].subKpis[si].achievement)
        .filter((a): a is number => a != null)
      const achievement = achievements.length
        ? achievements.reduce((a, b) => a + b, 0) / achievements.length
        : null
      const rating = ratingFor(achievement)
      return {
        ...sub,
        achievement,
        rating,
        weighted: rating == null ? null : rating * sub.weight,
      }
    })
    const score = categoryScore(subKpis)
    return { ...cat, subKpis, score, weighted: score == null ? null : score * cat.weight }
  })

  const final = finalScore(categories)
  return { categories, final, band: scoreBand(final) }
}
