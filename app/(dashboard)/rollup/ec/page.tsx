"use client"

import { useDashboard } from "@/components/dashboard/dashboard-provider"

import { PageHeader } from "@/components/layout/page-header"
import { RollupView, type RollupEntity } from "@/components/dashboard/rollup-view"
import { StatCard, StatCardGrid } from "@/components/dashboard/stat-card"
import { useKpiData } from "@/hooks/use-kpi-data"
import { formatScore } from "@/lib/format"


export default function EcRollupPage() {
  const { queries: { designersInEc, ecScorecard, ecsVisibleTo, managerById, scorecardFor } } = useDashboard()
  const { period, overrides, viewer, scorecard } = useKpiData()
  const ecs = ecsVisibleTo(viewer)

  const entities: RollupEntity[] = ecs.map((ec) => {
    const designers = designersInEc(ec.id)
    return {
      id: ec.id,
      name: ec.name,
      subtitle: [ec.city, managerById(ec.managerId)?.name].filter(Boolean).join(" · "),
      scorecard: ecScorecard(ec.id, period, overrides),
      children: designers.map((d) => ({
        id: d.id,
        name: d.name,
        subtitle: "",
        scorecard: scorecardFor(d.id, period, overrides, ec.id),
      })),
    }
  })

  const best = [...entities].sort((a, b) => (b.scorecard.final ?? -1) - (a.scorecard.final ?? -1))[0]
  const worst = [...entities].sort((a, b) => (a.scorecard.final ?? 9) - (b.scorecard.final ?? 9))[0]

  return (
    <>
      <PageHeader
        title="Experience Centre Rollup"
        description="Every designer's score aggregated to their mapped EC. The hierarchy is fixed in Hierarchy Mapping, so no re-tagging is needed each period."
      />

      <StatCardGrid columns={3}>
        <StatCard
          label="Centres in scope"
          value={entities.length}
          footer={
            <span>
              {entities.reduce((s, e) => s + e.children.length, 0)} designers mapped beneath them
            </span>
          }
        />
        <StatCard
          label="Strongest centre"
          value={<span className="text-xl @[250px]/card:text-2xl">{best?.name ?? "—"}</span>}
          footer={<span>Final score {formatScore(best?.scorecard.final ?? null)} / 4.00</span>}
        />
        <StatCard
          label="Needs attention"
          value={<span className="text-xl @[250px]/card:text-2xl">{worst?.name ?? "—"}</span>}
          footer={<span>Final score {formatScore(worst?.scorecard.final ?? null)} / 4.00</span>}
        />
      </StatCardGrid>

      <RollupView
        entities={entities}
        entityLabel="Experience Centre"
        childLabel="designer"
        periodLabel={period.label}
      />

      <div className="text-muted-foreground px-4 text-xs lg:px-6">
        Team-wide final score for {period.label}: {formatScore(scorecard.final)} / 4.00
      </div>
    </>
  )
}
