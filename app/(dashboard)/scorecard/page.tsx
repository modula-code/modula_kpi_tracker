"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { InfoIcon } from "lucide-react"

import { PageHeader } from "@/components/layout/page-header"
import { ScorecardTable } from "@/components/tables/scorecard-table"
import { CategoryRadarChart, CategoryTrendChart } from "@/components/charts/charts"
import { ScoreBadge } from "@/components/shared/rating"
import { SectionCardTitle } from "@/components/shared/section-card-title"
import { StatCard, StatCardGrid } from "@/components/dashboard/stat-card"
import { useDashboard } from "@/components/dashboard/dashboard-provider"
import { useKpiData, useScoreTrend } from "@/hooks/use-kpi-data"
import { formatScore, formatWeight } from "@/lib/format"
import { RATING_BANDS } from "@/lib/kpi-engine"


function ScorecardContent() {
  const { queries: { ecById, managerForDesigner } } = useDashboard()
  const search = useSearchParams()
  const { filters, setFilter } = useDashboard()
  const { period, scorecard, finalDelta, designers } = useKpiData()
  const trend = useScoreTrend(6)

  // Deep link from the leaderboard: ?designer=d7 focuses that person.
  const requested = search.get("designer")
  React.useEffect(() => {
    if (requested && requested !== filters.designerId) setFilter("designerId", requested)
  }, [requested, filters.designerId, setFilter])

  const single = designers.length === 1 ? designers[0] : null
  const ec = single ? ecById(single.ecId) : null
  const manager = single ? managerForDesigner(single.id) : null

  const subject = single
    ? single.name
    : designers.length === 0
      ? "No designers in scope"
      : `${designers.length} designers, aggregated`

  const radar = scorecard.categories.map((c) => ({
    category: c.short,
    score: c.score == null ? 0 : Math.round(c.score * 100) / 100,
  }))

  return (
    <>
      <PageHeader
        title="Designer Scorecard"
        description="Every sub-KPI with its target, actual, achievement %, rating, and weighted contribution — the same table the engine produces for EC and Manager rollups."
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline">{period.label}</Badge>
            <ScoreBadge score={scorecard.final} showOutOf />
          </div>
        }
      />

      {!single && designers.length > 1 && (
        <div className="px-4 lg:px-6">
          <Alert>
            <InfoIcon />
            <AlertTitle>Showing an aggregated scorecard</AlertTitle>
            <AlertDescription>
              {designers.length} designers are in scope. Volume targets (bookings, AOV, referrals)
              are summed; rate targets (FTR, CSAT, cycle time) are averaged. Pick a single designer
              in the filter bar for an individual scorecard.
            </AlertDescription>
          </Alert>
        </div>
      )}

      <StatCardGrid columns={3}>
        <StatCard
          label="Subject"
          value={<span className="truncate text-xl @[250px]/card:text-2xl">{subject}</span>}
          footer={
            single ? (
              <span>
                {[ec?.city, ec?.name, manager?.name, manager?.title].filter(Boolean).join(" · ") || "EC not mapped"}
              </span>
            ) : (
              <span>Aggregated across the current filter selection</span>
            )
          }
        />
        <StatCard
          label="Final KPI Score"
          value={
            <span className="flex items-baseline gap-2">
              {formatScore(scorecard.final)}
              <span className="text-muted-foreground text-base font-normal">/ 4.00</span>
            </span>
          }
          delta={finalDelta}
          hint="Σ (category weighted score × category weight)."
          footer={<span className="text-foreground font-medium">{scorecard.band?.label ?? "—"}</span>}
        />
        <StatCard
          label="Strongest / weakest category"
          value={
            <span className="text-xl @[250px]/card:text-2xl">
              {strongest(scorecard.categories)?.short ?? "—"}
            </span>
          }
          footer={
            <span>
              Weakest: {weakest(scorecard.categories)?.short ?? "—"} (
              {formatScore(weakest(scorecard.categories)?.score ?? null)})
            </span>
          }
        />
      </StatCardGrid>

      <div className="px-4 lg:px-6">
        <Card>
          <CardHeader>
            <SectionCardTitle>Weighted scorecard · {period.label}</SectionCardTitle>
            <CardDescription>
              Hover any sub-KPI for its definition, or the column headers for the formula.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScorecardTable scorecard={scorecard} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 px-4 lg:grid-cols-3 lg:px-6">
        <Card>
          <CardHeader>
            <SectionCardTitle>Category balance</SectionCardTitle>
            <CardDescription>All four categories on the 1–4 rating scale.</CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryRadarChart data={radar} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <SectionCardTitle>Final score over time</SectionCardTitle>
            <CardDescription>
              Last 6 periods at the current granularity, for the same selection.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryTrendChart
              data={trend}
              series={[{ key: "final", label: "Final KPI Score", slot: 1 }]}
              yLabel="Score"
            />
          </CardContent>
        </Card>
      </div>

      <div className="px-4 lg:px-6">
        <Card>
          <CardHeader>
            <SectionCardTitle>Standard rating guide</SectionCardTitle>
            <CardDescription>
              Applied identically to every sub-KPI across all four modules.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <Table aria-label="Standard KPI rating guide">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Achievement %</TableHead>
                    <TableHead className="text-right">Rating</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {RATING_BANDS.map((band) => (
                    <TableRow key={band.rating}>
                      <TableCell>{band.label}</TableCell>
                      <TableCell className="flex justify-end">
                        <ScoreBadge score={band.rating} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Table aria-label="Category weights and score contribution">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Weight</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead className="text-right">Contribution</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scorecard.categories.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.short}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatWeight(c.weight)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatScore(c.score)}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatScore(c.weighted)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2 hover:bg-transparent">
                    <TableCell className="font-semibold">Final</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">100%</TableCell>
                    <TableCell />
                    <TableCell className="text-right font-bold tabular-nums">
                      {formatScore(scorecard.final)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

export default function ScorecardPage() {
  return (
    <React.Suspense fallback={<ScorecardLoading />}>
      <ScorecardContent />
    </React.Suspense>
  )
}

function ScorecardLoading() {
  return (
    <div className="space-y-6 px-4 lg:px-6" aria-label="Loading scorecard" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <Skeleton key={item} className="h-32 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-xl" />
    </div>
  )
}

function strongest<T extends { score: number | null }>(cats: T[]) {
  return cats.filter((c) => c.score != null).sort((a, b) => b.score! - a.score!)[0]
}

function weakest<T extends { score: number | null }>(cats: T[]) {
  return cats.filter((c) => c.score != null).sort((a, b) => a.score! - b.score!)[0]
}
