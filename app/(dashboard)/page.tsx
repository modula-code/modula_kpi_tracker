"use client"

import { useDashboard } from "@/components/dashboard/dashboard-provider"

import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageHeader } from "@/components/layout/page-header"
import { StatCard, StatCardGrid } from "@/components/dashboard/stat-card"
import { ScoreBadge } from "@/components/shared/rating"
import { SectionCardTitle } from "@/components/shared/section-card-title"
import { CategoryTrendChart, EntityBarChart } from "@/components/charts/charts"
import { LeaderboardTable } from "@/components/tables/leaderboard-table"
import { CATEGORY_SERIES, useKpiData, useScoreTrend } from "@/hooks/use-kpi-data"
import { formatScore, formatWeight } from "@/lib/format"


const MODULE_LINKS: Record<string, string> = {
  sales: "/modules/sales",
  execution: "/modules/execution",
  referrals: "/modules/referrals",
  circle: "/modules/circle",
}

export default function OverviewPage() {
  const { queries: { ecScorecard, ecsVisibleTo, managerScorecard, managersVisibleTo } } = useDashboard()
  const { period, scorecard, priorScorecard, finalDelta, designers, rows, viewer, overrides } =
    useKpiData()
  const trend = useScoreTrend(6)

  const ecs = ecsVisibleTo(viewer)
  const managers = managersVisibleTo(viewer)

  const ecBars = ecs.map((ec, i) => ({
    label: ec.name,
    value: Number(formatScore(ecScorecard(ec.id, period, overrides).final ?? 0)),
    slot: i + 1,
  }))

  const managerBars = managers.map((m, i) => ({
    label: m.name.split(" ")[0],
    value: Number(formatScore(managerScorecard(m.id, period, overrides).final ?? 0)),
    slot: i + 1,
  }))

  const showManagerChart = managers.length > 1

  return (
    <>
      <PageHeader
        title="Design Team KPI Scorecard"
        description={`Weighted performance across all four categories for ${period.label}. Scores roll up automatically from Designer to Experience Centre to Manager/ASM.`}
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/scorecard">
              Full scorecard <ArrowRightIcon />
            </Link>
          </Button>
        }
      />

      <StatCardGrid>
        <StatCard
          label="Final KPI Score"
          className="bg-primary/5 ring-primary/25"
          value={
            <span className="flex items-baseline gap-2">
              {formatScore(scorecard.final)}
              <span className="text-muted-foreground text-base font-normal">/ 4.00</span>
            </span>
          }
          delta={finalDelta}
          hint="Σ (category score × category weight), averaged across every designer in scope."
          footer={
            <span className="text-foreground font-medium">
              {scorecard.band?.label ?? "No data"} · {designers.length} designer
              {designers.length === 1 ? "" : "s"} in scope
            </span>
          }
        />
        {scorecard.categories.map((cat, i) => (
          <StatCard
            key={cat.id}
            label={cat.label}
            value={formatScore(cat.score)}
            delta={
              cat.score != null && priorScorecard?.categories[i]?.score != null
                ? cat.score - priorScorecard.categories[i].score!
                : null
            }
            hint={`Weighted ${formatWeight(cat.weight)} of the final score. Sub-KPIs: ${cat.subKpis
              .map((s) => s.label)
              .join(", ")}.`}
            action={<ScoreBadge score={cat.score} />}
            footer={
              <Link
                href={MODULE_LINKS[cat.id]}
                className="hover:text-foreground inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline"
              >
                {formatWeight(cat.weight)} weight · open module
                <ArrowRightIcon className="size-3.5" />
              </Link>
            }
          />
        ))}
      </StatCardGrid>

      <div className="grid gap-4 px-4 lg:grid-cols-3 lg:px-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <SectionCardTitle>Category score trend</SectionCardTitle>
            <CardDescription>
              Last 6 {period.granularity === "week" ? "weeks" : `${period.granularity}s`}, all four
              categories on the shared 1–4 rating scale.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryTrendChart data={trend} series={CATEGORY_SERIES} yLabel="Score" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionCardTitle>
              {showManagerChart ? "Manager / ASM" : "Experience Centre"} standing
            </SectionCardTitle>
            <CardDescription>
              Final KPI score for {period.label}. Colour is fixed per{" "}
              {showManagerChart ? "manager" : "centre"}, not by rank.
            </CardDescription>
            {!showManagerChart && (
              <CardAction>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/rollup/ec">
                    Details <ArrowRightIcon />
                  </Link>
                </Button>
              </CardAction>
            )}
          </CardHeader>
          <CardContent>
            <EntityBarChart
              data={showManagerChart ? managerBars : ecBars}
              valueLabel="Final score"
              domain={[0, 4]}
            />
          </CardContent>
        </Card>
      </div>

      <div className="px-4 lg:px-6">
        <Tabs defaultValue="leaderboard">
          <TabsList className="max-w-full justify-start overflow-x-auto">
            <TabsTrigger value="leaderboard">Designer leaderboard</TabsTrigger>
            <TabsTrigger value="attention">Needs attention</TabsTrigger>
            <TabsTrigger value="top">Top performers</TabsTrigger>
          </TabsList>

          <TabsContent value="leaderboard" className="mt-4">
            <LeaderboardTable rows={rows} />
          </TabsContent>
          <TabsContent value="attention" className="mt-4">
            <LeaderboardTable rows={rows.filter((r) => (r.final ?? 4) < 3)} pageSize={10} />
          </TabsContent>
          <TabsContent value="top" className="mt-4">
            <LeaderboardTable rows={rows.slice(0, 5)} pageSize={5} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}
