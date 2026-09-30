"use client"

import { useDashboard } from "@/components/dashboard/dashboard-provider"

import Link from "next/link"
import { ArrowRightIcon, TriangleAlertIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PageHeader } from "@/components/layout/page-header"
import { EmptyState, StatCard, StatCardGrid, SubKpiCard } from "@/components/dashboard/stat-card"
import { RatingBadge, ScoreBadge } from "@/components/shared/rating"
import { SectionCardTitle } from "@/components/shared/section-card-title"
import { CategoryTrendChart, RankedBarChart } from "@/components/charts/charts"
import { useKpiData, useScoreTrend } from "@/hooks/use-kpi-data"
import { formatPct, formatScore, formatWeight } from "@/lib/format"
import { KPI_TREE, buildScorecard } from "@/lib/kpi-engine"
import { errorFrequency, ftrStats } from "@/lib/data/query"

const CATEGORY = KPI_TREE[1]

export default function ExecutionModulePage() {
  const { queries: { errorsByDesigner, metricsFor, ticketsFor } } = useDashboard()
  const { period, scorecard, designers, overrides, viewer, filters, tickets } = useKpiData()
  const trend = useScoreTrend(6)
  const cat = scorecard.categories[1]

  const scoped = ticketsFor(tickets, viewer, filters)
  const stats = ftrStats(scoped)
  const errors = errorFrequency(scoped).filter((e) => e.count > 0)
  const topErrors = errors.slice(0, 5)
  const byDesigner = errorsByDesigner(scoped).slice(0, 8)

  return (
    <>
      <PageHeader
        title={CATEGORY.label}
        weight={formatWeight(CATEGORY.weight)}
        description="Not Odoo-driven. FTR comes from the audit ticketing workflow; cycle time is measured from QL to Design Presentation."
        actions={
          <div className="flex items-center gap-2">
            <ScoreBadge score={cat.score} showOutOf />
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/data?tab=tickets">
                Add tickets <ArrowRightIcon />
              </Link>
            </Button>
          </div>
        }
      />

      <StatCardGrid>
        {cat.subKpis.map((sub) => (
          <SubKpiCard key={sub.id} sub={sub} weightOf={`${formatWeight(sub.weight)} of module`} />
        ))}
        <StatCard
          label="Audits this period"
          value={stats.audited}
          hint="Tickets with a logged outcome. In-flight tickets are excluded from FTR until audited."
          footer={
            <span>
              {stats.passed} passed · {stats.failed} failed · {stats.inFlight} in flight
            </span>
          }
        />
        <StatCard
          label="Measured FTR"
          value={formatPct(stats.ftrPct)}
          hint="Designs passing audit on the first attempt with no errors logged, out of total designs audited."
          footer={
            <span>
              Computed live from {stats.audited} audited ticket
              {stats.audited === 1 ? "" : "s"}
            </span>
          }
        />
      </StatCardGrid>

      <div className="grid gap-4 px-4 lg:grid-cols-2 lg:px-6">
        <Card>
          <CardHeader>
            <SectionCardTitle>Top recurring errors</SectionCardTitle>
            <CardDescription>
              Failure tags aggregated by frequency for {period.label}.
            </CardDescription>
            <CardAction>
              <Badge variant="outline">{errors.reduce((a, e) => a + e.count, 0)} tagged</Badge>
            </CardAction>
          </CardHeader>
          <CardContent>
            {topErrors.length ? (
              <RankedBarChart
                data={topErrors.map((e) => ({ label: e.type, value: e.count }))}
                valueLabel="Occurrences"
                slot={2}
              />
            ) : (
              <EmptyState message="No audit failures logged for this selection." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionCardTitle>Module score trend</SectionCardTitle>
            <CardDescription>FTR and cycle time combined, last 6 periods.</CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryTrendChart
              data={trend}
              series={[{ key: "execution", label: CATEGORY.short, slot: CATEGORY.slot }]}
              yLabel="Score"
            />
          </CardContent>
        </Card>
      </div>

      <div className="px-4 lg:px-6">
        <Alert>
          <TriangleAlertIcon />
          <AlertTitle>Design Freeze Cycle Time is scored as lower-is-better</AlertTitle>
          <AlertDescription>
            The brief specifies Achievement % = Actual ÷ Target throughout, but cycle time improves
            as it falls — a 6-day freeze against a 9-day target would rate a 1 under the literal
            formula. The engine inverts it to Target ÷ Actual for this sub-KPI. Worth confirming
            before build.
          </AlertDescription>
        </Alert>
      </div>

      <div className="grid gap-4 px-4 lg:grid-cols-2 lg:px-6">
        <Card>
          <CardHeader>
            <SectionCardTitle>Designer accuracy detail</SectionCardTitle>
            <CardDescription>
              FTR and freeze cycle time per designer for {period.label}.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table
              className="min-w-[34rem]"
              aria-label={`Designer accuracy detail for ${period.label}`}
            >
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Designer</TableHead>
                  <TableHead className="text-right">FTR %</TableHead>
                  <TableHead className="text-center">Rating</TableHead>
                  <TableHead className="text-right">Cycle time</TableHead>
                  <TableHead className="text-center">Rating</TableHead>
                  <TableHead className="text-center">Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {designers.map((d) => {
                  const c = buildScorecard(metricsFor(d.id, period, overrides)).categories[1]
                  const [ftr, freeze] = c.subKpis
                  return (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.name}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatPct(ftr.actual)}
                      </TableCell>
                      <TableCell className="text-center">
                        <RatingBadge rating={ftr.rating} achievement={ftr.achievement} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {freeze.actual?.toFixed(1) ?? "—"} d
                      </TableCell>
                      <TableCell className="text-center">
                        <RatingBadge rating={freeze.rating} achievement={freeze.achievement} />
                      </TableCell>
                      <TableCell className="text-center">
                        <ScoreBadge score={c.score} />
                      </TableCell>
                    </TableRow>
                  )
                })}
                {!designers.length && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground h-24 text-center">
                      No designers match the current filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionCardTitle>Errors by designer</SectionCardTitle>
            <CardDescription>
              Who is repeating which mistake — the input to targeted coaching.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table className="min-w-[30rem]" aria-label="Audit errors by designer">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Designer</TableHead>
                  <TableHead className="text-right">Errors</TableHead>
                  <TableHead>Most frequent type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byDesigner.map((row) => {
                  const top = Object.entries(row.byType).sort((a, b) => b[1] - a[1])[0]
                  return (
                    <TableRow key={row.designerId}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.total}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {top?.[0]} ×{top?.[1]}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {!byDesigner.length && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground h-24 text-center">
                      No errors logged for this selection.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="px-4 lg:px-6">
        <Card>
          <CardHeader>
            <SectionCardTitle>Module summary</SectionCardTitle>
            <CardDescription>
              Average cycle time {stats.avgCycleDays?.toFixed(1) ?? "—"} days across{" "}
              {scoped.length} tickets · module score {formatScore(cat.score)} / 4.00
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </>
  )
}
