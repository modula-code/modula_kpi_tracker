"use client"

import * as React from "react"

import { useDashboard } from "@/components/dashboard/dashboard-provider"
import { previousPeriod, resolvePeriod, trailingPeriods } from "@/lib/data/query"
import { KPI_TREE } from "@/lib/kpi-engine"

/**
 * The slice of state every page starts from: the resolved period, the
 * designers in scope, and the rolled-up scorecard for exactly that set.
 *
 * Recomputed on every filter, role, or target change — which is the point.
 */
export function useKpiData() {
  const { queries, filters, granularity, viewer, overrides, tickets, slab } = useDashboard()

  const { filteredDesigners, leaderboard, rollupScorecard } = queries

  return React.useMemo(() => {
    const period = resolvePeriod(filters.periodId)
    const prior = previousPeriod(period)
    const designers = filteredDesigners(viewer, filters)
    const ids = designers.map((d) => d.id)

    const scorecard = rollupScorecard(ids, period, overrides)
    const priorScorecard = prior ? rollupScorecard(ids, prior, overrides) : null

    return {
      period,
      prior,
      granularity,
      viewer,
      overrides,
      tickets,
      slab,
      filters,
      designers,
      designerIds: ids,
      scorecard,
      priorScorecard,
      finalDelta:
        scorecard.final != null && priorScorecard?.final != null
          ? scorecard.final - priorScorecard.final
          : null,
      rows: leaderboard(viewer, filters, overrides),
    }
  }, [filters, granularity, viewer, overrides, tickets, slab, filteredDesigners, rollupScorecard, leaderboard])
}

/**
 * Score history for the trailing N periods — the x-axis of every trend chart.
 * Returns one row per period with a column per category plus the final score.
 */
export function useScoreTrend(count = 6) {
  const { queries, filters, viewer, overrides } = useDashboard()

  const { filteredDesigners, rollupScorecard } = queries

  return React.useMemo(() => {
    const period = resolvePeriod(filters.periodId)
    const ids = filteredDesigners(viewer, filters).map((d) => d.id)
    if (!ids.length) return []

    return trailingPeriods(period, count).map((p) => {
      const card = rollupScorecard(ids, p, overrides)
      const row: Record<string, string | number | null> = {
        period: p.label,
        final: card.final == null ? null : round2(card.final),
      }
      for (const cat of card.categories) row[cat.id] = cat.score == null ? null : round2(cat.score)
      return row
    })
  }, [filters, viewer, overrides, count, filteredDesigners, rollupScorecard])
}

/** Series definitions for the four-category trend line chart. */
export const CATEGORY_SERIES = KPI_TREE.map((c) => ({
  key: c.id,
  label: c.short,
  slot: c.slot,
}))

function round2(n: number) {
  return Math.round(n * 100) / 100
}
