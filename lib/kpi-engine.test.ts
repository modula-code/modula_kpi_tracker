import assert from "node:assert/strict"
import test from "node:test"

import {
  KPI_TREE,
  achievementPct,
  buildScorecard,
  categoryScore,
  finalScore,
  ratingFor,
  type MetricInputs,
} from "./kpi-engine.ts"

test("rating bands match the brief, including the boundaries", () => {
  assert.equal(ratingFor(120), 4)
  assert.equal(ratingFor(100), 4)
  assert.equal(ratingFor(99.9), 3)
  assert.equal(ratingFor(90), 3)
  assert.equal(ratingFor(89.9), 2)
  assert.equal(ratingFor(75), 2)
  assert.equal(ratingFor(74.9), 1)
  assert.equal(ratingFor(0), 1)
  assert.equal(ratingFor(null), null)
})

test("achievement is actual/target, inverted for lower-is-better metrics", () => {
  assert.equal(achievementPct(90, 100, "higher"), 90)
  // 6 days against a 9-day target beats the target: 150%, not 66%.
  assert.equal(achievementPct(6, 9, "lower"), (9 / 6) * 100)
  assert.equal(ratingFor(achievementPct(6, 9, "lower")), 4)
  assert.equal(ratingFor(achievementPct(12, 9, "lower")), 2) // 9/12 = exactly 75%
  assert.equal(ratingFor(achievementPct(13, 9, "lower")), 1) // 69.2%
})

test("uncomputable inputs return null rather than a misleading zero", () => {
  assert.equal(achievementPct(50, 0), null)
  assert.equal(achievementPct(50, -10), null)
  assert.equal(achievementPct(null, 100), null)
  assert.equal(achievementPct(100, null), null)
  assert.equal(achievementPct(0, 100, "lower"), null)
})

test("category score is the weighted mean of its sub-KPI ratings", () => {
  // 4×0.6 + 3×0.2 + 2×0.2 = 2.4 + 0.6 + 0.4 = 3.4
  const score = categoryScore([
    { rating: 4, weight: 0.6 },
    { rating: 3, weight: 0.2 },
    { rating: 2, weight: 0.2 },
  ])
  assert.equal(score, 3.4)
})

test("unmeasured sub-KPIs renormalise instead of dragging the score down", () => {
  // Only the 0.6-weight row scores; the result is that row's rating, not 4×0.6.
  assert.equal(categoryScore([{ rating: 4, weight: 0.6 }, { rating: null, weight: 0.4 }]), 4)
  assert.equal(categoryScore([{ rating: null, weight: 1 }]), null)
})

test("the scorecard weights sum to 1 at both levels", () => {
  const catTotal = KPI_TREE.reduce((sum, c) => sum + c.weight, 0)
  assert.ok(Math.abs(catTotal - 1) < 1e-9, `category weights sum to ${catTotal}`)
  for (const cat of KPI_TREE) {
    const subTotal = cat.subKpis.reduce((sum, s) => sum + s.weight, 0)
    assert.ok(Math.abs(subTotal - 1) < 1e-9, `${cat.id} sub-weights sum to ${subTotal}`)
  }
})

test("full rollup: every sub-KPI on target scores a clean 4.0", () => {
  const onTarget: MetricInputs = Object.fromEntries(
    KPI_TREE.flatMap((c) => c.subKpis).map((s) => [s.id, { target: 100, actual: 100 }]),
  )
  const card = buildScorecard(onTarget)
  assert.equal(card.final, 4)
  assert.equal(card.band?.label, "Outstanding")
})

test("full rollup: a known mixed scorecard produces the hand-computed score", () => {
  const inputs: MetricInputs = {
    // Sales (0.40): 4×0.6 + 3×0.2 + 2×0.2 = 3.4
    booking: { target: 100, actual: 105 }, // 105% -> 4
    walkin: { target: 100, actual: 92 }, //  92% -> 3
    aov: { target: 100, actual: 80 }, //  80% -> 2
    // Execution (0.35): 3×0.6 + 4×0.4 = 3.4   (freeze is lower-is-better)
    ftr: { target: 100, actual: 95 }, //  95% -> 3
    freeze: { target: 9, actual: 6 }, // 150% -> 4
    // Referrals (0.15): 1×0.5 + 4×0.5 = 2.5
    referral: { target: 10, actual: 5 }, //  50% -> 1
    csat: { target: 4.5, actual: 4.7 }, // 104% -> 4
    // Circle (0.10): 2×0.4 + 3×0.3 + 1×0.3 = 0.8 + 0.9 + 0.3 = 2.0
    onboardings: { target: 10, actual: 8 }, //  80% -> 2
    partnerRevenue: { target: 100, actual: 95 }, //  95% -> 3
    engagement: { target: 10, actual: 7 }, //  70% -> 1
  }

  const card = buildScorecard(inputs)
  const [sales, execution, referrals, circle] = card.categories
  assert.equal(sales.score, 3.4)
  assert.equal(execution.score, 3.4)
  assert.equal(referrals.score, 2.5)
  assert.equal(circle.score, 2)

  // 3.4×0.40 + 3.4×0.35 + 2.5×0.15 + 2.0×0.10 = 1.36 + 1.19 + 0.375 + 0.20
  const expected = 3.125
  assert.ok(Math.abs(card.final! - expected) < 1e-9, `final was ${card.final}, expected ${expected}`)
  assert.equal(card.band?.label, "Exceeds")

  // finalScore over the same categories agrees with buildScorecard.
  const viaFinal = finalScore(card.categories.map((c) => ({ score: c.score, weight: c.weight })))
  assert.ok(Math.abs(viaFinal! - expected) < 1e-9)
})
