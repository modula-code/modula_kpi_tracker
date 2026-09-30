/**
 * Self-check for the sales aggregation: `npx tsx lib/data/sales-metrics.test.ts`.
 * Covers the two things that silently go wrong — period boundaries and the
 * "no sale order counts as zero" rule inside AOV.
 */

import assert from "node:assert/strict"

import {
  DEFAULT_TARGETS,
  aggregateSales,
  annualBookingTarget,
  monthRangesIn,
  periodRange,
  salesMetricInputs,
  scoreSales,
  targetsFor,
  teamTargets,
} from "./sales-metrics"
import type { SalesLead } from "./sales-types"

const lead = (over: Partial<SalesLead>): SalesLead => ({
  id: 1,
  name: "Lead",
  designer: "A",
  company: "Ayena Innovation Private Limited",
  source: null,
  walkin: false,
  stage: "Booking Fee ( 10% Design Fee )",
  created: "2026-07-10",
  booked: false,
  bookedOn: null,
  order: null,
  amount: 0,
  lost: false,
  ...over,
})

const month = {
  id: "2026-M07",
  granularity: "month" as const,
  label: "Jul 2026",
  order: 0,
  months: ["2026-M07"],
  scale: 1,
  wobble: 1,
}

const july = periodRange(month)
assert.deepEqual([july.start, july.end, july.days], ["2026-07-01", "2026-08-01", 31])

// December must roll into the next year, not month 13.
const december = periodRange({ ...month, id: "2025-M12", months: ["2025-M12"] })
assert.equal(december.end, "2026-01-01")

// Quarter spans its months; the third week of a month is 15th–22nd.
const q3 = periodRange({
  ...month,
  id: "2026-Q3",
  granularity: "quarter",
  months: ["2026-M07", "2026-M08", "2026-M09"],
})
assert.deepEqual([q3.start, q3.end], ["2026-07-01", "2026-10-01"])
const week = periodRange({
  ...month,
  id: "2026-W27",
  granularity: "week",
  months: ["2026-M07"],
})
assert.deepEqual([week.start, week.end, week.days], ["2026-07-15", "2026-07-22", 7])

const leads = [
  lead({ id: 1, created: "2026-07-02", source: "Walkin", walkin: true }),
  lead({ id: 2, created: "2026-07-05", lost: true }),
  lead({
    id: 3,
    created: "2026-06-28",
    source: "Walkin",
    walkin: true,
    booked: true,
    bookedOn: "2026-07-09",
    order: "S001",
    amount: 800_000,
  }),
  // Booked with no sale order — counts in the mean as zero, per the brief.
  lead({ id: 4, created: "2026-07-20", booked: true, bookedOn: "2026-07-30" }),
  // Outside the window on both sides.
  lead({ id: 5, created: "2026-08-01", booked: true, bookedOn: "2026-08-01", amount: 999 }),
]

const agg = aggregateSales(leads, july)
assert.equal(agg.leads, 3, "leads count by creation date")
assert.equal(agg.lost, 1)
assert.equal(agg.booked, 2, "bookings count by booking date, whenever the lead was created")
assert.equal(agg.bookingValue, 800_000)
assert.equal(agg.withOrder, 1)
assert.equal(agg.aov, 400_000, "the order-less booking pulls the mean down")

// Conversion is walk-ins only: 1 walk-in lead created, 1 walk-in booking confirmed.
assert.equal(agg.walkinLeads, 1)
assert.equal(agg.walkinBooked, 1)
assert.equal(agg.conversionPct, 100)

// Leads with no walk-in source leave conversion unmeasured rather than 0%.
const noWalkins = aggregateSales([lead({ id: 9, created: "2026-07-03" })], july)
assert.equal(noWalkins.leads, 1)
assert.equal(noWalkins.conversionPct, null)

const empty = aggregateSales([], july)
assert.equal(empty.conversionPct, null, "no walk-in leads is unmeasured, not 0%")
assert.equal(empty.aov, null)

// An idle designer scores nothing at all rather than a rating of 1.
const idle = salesMetricInputs(empty, july, DEFAULT_TARGETS)
assert.equal(idle.booking.actual, null)
assert.equal(idle.walkin.actual, null)
assert.equal(idle.aov.actual, null)

// Targets: a designer's own where set, the defaults where not.
const config = {
  defaults: DEFAULT_TARGETS,
  byDesigner: { A: { booking: 2_000_000 }, B: { walkin: 40, aov: 900_000 } },
}
assert.deepEqual(targetsFor("A", config), { booking: 2_000_000, walkin: 25, aov: 600_000 })
assert.deepEqual(targetsFor("nobody", config), DEFAULT_TARGETS)

// Booking value adds across a team; conversion and AOV are rates, so they average.
const team = teamTargets(["A", "B"], config)
assert.equal(team.booking, 3_000_000)
assert.equal(team.walkin, 32.5)
assert.equal(team.aov, 750_000)

// Volume targets scale with period length; rate targets do not.
const inputs = salesMetricInputs(agg, july, team)
assert.equal(inputs.walkin.target, 32.5)
assert.equal(inputs.aov.target, 750_000)
assert.equal(inputs.booking.target, Math.round(3_000_000 * (31 / 30.44)))
// A calendar month is worth exactly one monthly target, however long it runs.
assert.equal(salesMetricInputs(agg, july, team, 1).booking.target, 3_000_000)
assert.equal(inputs.booking.actual, 800_000)

// --- Targets: monthly, annual, and the link between them --------------------

const annualOnly = {
  defaults: DEFAULT_TARGETS,
  byDesigner: { C: { annualBooking: 24_000_000 } },
}
assert.equal(targetsFor("C", annualOnly).booking, 2_000_000, "annual target spreads over 12 months")
assert.equal(annualBookingTarget("C", annualOnly), 24_000_000)
// A monthly target with no annual one implies twelve of them.
assert.equal(annualBookingTarget("A", config), 24_000_000)
assert.equal(annualBookingTarget("nobody", config), DEFAULT_TARGETS.booking * 12)

// --- Scoring by granularity -------------------------------------------------

const quarter = {
  ...month,
  id: "2026-Q3",
  granularity: "quarter" as const,
  label: "2026 Q3",
  months: ["2026-M07", "2026-M08", "2026-M09"],
}
assert.equal(monthRangesIn(quarter).length, 3)
assert.deepEqual(
  monthRangesIn(quarter).map((r) => r.start),
  ["2026-07-01", "2026-08-01", "2026-09-01"],
)

const targetOneMillion = { booking: 1_000_000, walkin: 25, aov: 600_000 }
// One month on target, one month at half, one month idle.
const quarterLeads = [
  lead({ id: 20, created: "2026-07-01", booked: true, bookedOn: "2026-07-15", order: "S1", amount: 1_000_000 }),
  lead({ id: 21, created: "2026-08-01", booked: true, bookedOn: "2026-08-15", order: "S2", amount: 500_000 }),
]

const julyScore = scoreSales(quarterLeads, month, targetOneMillion)
assert.equal(julyScore.basis, "direct", "a month scores against its own target")
assert.equal(julyScore.card.categories[0].subKpis[0].rating, 4)

const q3Score = scoreSales(quarterLeads, quarter, targetOneMillion)
assert.equal(q3Score.basis, "average", "a quarter averages its months")
assert.equal(q3Score.monthsScored, 2, "September has nothing to score")
// Booking achievement: 100% in July, ~50% in August, September unmeasured.
const q3Booking = q3Score.card.categories[0].subKpis[0]
assert.equal(q3Booking.achievement, 75, "100% in July and 50% in August average to 75%")
assert.equal(q3Booking.rating, 2, "the average rates 2, not the 4 that July alone earned")
assert.equal(q3Score.agg.bookingValue, 1_500_000, "totals still cover the whole quarter")

// All-time spans every month on record, and takes in leads outside the seed window.
const allTime = { ...month, id: "all", granularity: "all" as const, label: "All time", months: [] }
const allScore = scoreSales(
  [...quarterLeads, lead({ id: 22, created: "2024-01-05" })],
  allTime,
  targetOneMillion,
)
assert.equal(allScore.basis, "average")
assert.equal(allScore.agg.leads, 3, "all-time counts every lead")
assert.ok(monthRangesIn(allTime, [lead({ id: 23, created: "2026-06-01" })]).length === 1)

console.log("sales-metrics: all checks passed")
