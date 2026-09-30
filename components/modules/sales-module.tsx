"use client"

import * as React from "react"
import Link from "next/link"
import { TriangleAlertIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Card,
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
import { CategoryTrendChart, TargetVsActualChart } from "@/components/charts/charts"
import { useDashboard } from "@/components/dashboard/dashboard-provider"
import { StatCard, StatCardGrid, SubKpiCard } from "@/components/dashboard/stat-card"
import { PageHeader } from "@/components/layout/page-header"
import { AchievementBar, RatingBadge, ScoreBadge } from "@/components/shared/rating"
import { SectionCardTitle } from "@/components/shared/section-card-title"
import {
  aggregateByDesigner,
  annualBookingTarget,
  periodRange,
  scoreSales,
  targetsFor,
  teamTargets,
  type TargetConfig,
} from "@/lib/data/sales-metrics"
import type { SalesSnapshot } from "@/lib/data/sales-types"
import { previousPeriod, resolvePeriod, trailingPeriods } from "@/lib/data/query"
import {
  EM_DASH,
  formatCount,
  formatCurrency,
  formatDate,
  formatPct,
  formatScore,
  formatWeight,
} from "@/lib/format"
import { KPI_TREE } from "@/lib/kpi-engine"

const CATEGORY = KPI_TREE[0]

/**
 * Sales & Conversion, live from Odoo.
 *
 * Designer comes from crm.lead.x_studio_design_poc_1; order value is the latest
 * sale.order on the lead (0 when it has none). Everything is sliced by the
 * period on the filter bar.
 */
export function SalesModule({
  snapshot,
  targets,
}: {
  snapshot: SalesSnapshot
  targets: TargetConfig
}) {
  const { filters, viewer, queries } = useDashboard()

  const period = resolvePeriod(filters.periodId)
  const prior = previousPeriod(period)

  const scope = React.useMemo(() => queries.filteredDesigners(viewer, filters).map((designer) => designer.id), [queries, viewer, filters])
  const scoped = React.useMemo(() => snapshot.leads.filter((lead) => scope.includes(lead.designer) && (filters.ecId === "all" || lead.ecId === filters.ecId)), [snapshot.leads, scope, filters.ecId])
  const scopeTargets = React.useMemo(() => teamTargets(scope, targets), [scope, targets])
  const annualTarget = React.useMemo(
    () => scope.reduce((sum, name) => sum + annualBookingTarget(name, targets), 0),
    [scope, targets],
  )

  const range = React.useMemo(() => periodRange(period), [period])
  const scored = React.useMemo(
    () => scoreSales(scoped, period, scopeTargets),
    [scoped, period, scopeTargets],
  )
  const agg = scored.agg
  const cat = scored.card.categories[0]

  const priorCard = React.useMemo(
    () => (prior ? scoreSales(scoped, prior, scopeTargets).card : null),
    [prior, scoped, scopeTargets],
  )

  const rows = React.useMemo(
    () => aggregateByDesigner(scoped, scope, range),
    [scoped, scope, range],
  )

  const trend = React.useMemo(
    () =>
      trailingPeriods(period, 6).map((p) => {
        const score = scoreSales(scoped, p, scopeTargets).card.categories[0].score
        return { period: p.label, sales: score == null ? null : Math.round(score * 100) / 100 }
      }),
    [period, scoped, scopeTargets],
  )

  const bookings = React.useMemo(
    () =>
      scoped
        .filter((l) => l.booked && l.bookedOn && l.bookedOn >= range.start && l.bookedOn < range.end)
        .sort((a, b) => (b.bookedOn ?? "").localeCompare(a.bookedOn ?? "") || b.amount - a.amount)
        .slice(0, 12),
    [scoped, range],
  )

  // Indexed to 100 so bookings, conversion, and AOV share one axis.
  const indexed = cat.subKpis.map((s) => ({
    label: s.label.replace(" Conversion", ""),
    target: 100,
    actual: s.achievement == null ? 0 : Math.round(s.achievement),
  }))

  return (
    <>
      <PageHeader
        title={CATEGORY.label}
        weight={formatWeight(CATEGORY.weight)}
        description="Live from Odoo — leads and bookings from crm.lead, order value from the latest sale order on each lead. Targets are the monthly per-designer numbers held in the KPI config."
        actions={
          <div className="flex items-center gap-2">
            <ScoreBadge score={cat.score} showOutOf />
          </div>
        }
      />

      {snapshot.error && (
        <div className="px-4 lg:px-6">
          <Alert variant="destructive">
            <TriangleAlertIcon />
            <AlertTitle>Odoo sync failed</AlertTitle>
            <AlertDescription>{snapshot.error}</AlertDescription>
          </Alert>
        </div>
      )}

      <StatCardGrid columns={4}>
        <StatCard
          label="Leads / bookings"
          value={
            <span>
              {formatCount(agg.leads)}
              <span className="text-muted-foreground"> / </span>
              {formatCount(agg.booked)}
            </span>
          }
          hint={`Leads created between ${formatDate(range.start)} and ${formatDate(range.end)}, and bookings confirmed in the same window. ${formatCount(agg.lost)} of the leads are marked lost. Of the leads, ${formatCount(agg.walkinLeads)} came in as walk-ins (source_id), and ${formatCount(agg.walkinBooked)} of those booked — that pair drives Walk-in Conversion.`}
          footer={
            <span>
              {formatCount(agg.withOrder)} of {formatCount(agg.booked)} bookings have a sale
              order · {formatCount(agg.lost)} lost · {formatCount(agg.walkinLeads)} walk-ins
            </span>
          }
        />
        {cat.subKpis.map((sub) => (
          <SubKpiCard key={sub.id} sub={sub} weightOf={`${formatWeight(sub.weight)} of module`} />
        ))}
      </StatCardGrid>

      <div className="grid gap-4 px-4 lg:grid-cols-2 lg:px-6">
        <Card>
          <CardHeader>
            <SectionCardTitle>Target vs achievement</SectionCardTitle>
            <CardDescription>
              Indexed to 100 = target, so all three sub-KPIs share one axis despite different
              units. Targets in scope: {formatCurrency(scopeTargets.booking)} booking value per
              month ({formatCurrency(annualTarget)} a year), {formatPct(scopeTargets.walkin, 0)}{" "}
              conversion, {formatCurrency(scopeTargets.aov)} AOV —{" "}
              <Link href="/admin/targets" className="underline underline-offset-4">
                edit in Target Setting
              </Link>
              . Weeks and months score against their own target; quarters, years, and all-time are
              the average of their monthly scores.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TargetVsActualChart data={indexed} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionCardTitle>Module score trend</SectionCardTitle>
            <CardDescription>Last 6 periods on the 1–4 rating scale.</CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryTrendChart
              data={trend}
              series={[{ key: "sales", label: CATEGORY.short, slot: CATEGORY.slot }]}
              yLabel="Score"
            />
          </CardContent>
        </Card>
      </div>

      <div className="px-4 lg:px-6">
        <Card>
          <CardHeader>
            <SectionCardTitle>Designer detail · {period.label}</SectionCardTitle>
            <CardDescription>
              Leads created in the period against bookings confirmed in it. Walk-in conversion
              counts only leads whose Odoo source is a walk-in. Order value is the latest sale
              order on the lead; a booking without one counts as zero.{" "}
              {scored.basis === "average"
                ? `Scores here are the average of ${formatCount(scored.monthsScored)} monthly scores.`
                : "Scored directly against this period's target."}
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table className="min-w-[62rem]" aria-label={`Designer sales detail for ${period.label}`}>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-48">Designer</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Bookings</TableHead>
                  <TableHead className="border-l text-right">Walk-ins</TableHead>
                  <TableHead>Walk-in conversion</TableHead>
                  <TableHead className="border-l text-right">Booking value</TableHead>
                  <TableHead className="border-l text-right">AOV</TableHead>
                  <TableHead className="border-l text-center">Module score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ designer: name, agg: row, leads: rowLeads }) => {
                  const rowCard = scoreSales(rowLeads, period, targetsFor(name, targets)).card
                  const [booking, walkin, aov] = rowCard.categories[0].subKpis
                  return (
                    <TableRow key={name}>
                      <TableCell className="font-medium">{queries.designerById(name)?.name ?? name}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCount(row.leads)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCount(row.booked)}
                      </TableCell>
                      <TableCell className="border-l text-right text-xs tabular-nums">
                        {formatCount(row.walkinBooked)}
                        <span className="text-muted-foreground"> / {formatCount(row.walkinLeads)}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <AchievementBar
                            achievement={walkin.achievement}
                            rating={walkin.rating}
                          />
                          <span className="text-xs tabular-nums">
                            {formatPct(row.conversionPct)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="border-l text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-xs tabular-nums">
                            {formatCurrency(booking.actual)}
                          </span>
                          <RatingBadge rating={booking.rating} achievement={booking.achievement} />
                        </div>
                      </TableCell>
                      <TableCell className="border-l text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-xs tabular-nums">{formatCurrency(row.aov)}</span>
                          <RatingBadge rating={aov.rating} achievement={aov.achievement} />
                        </div>
                      </TableCell>
                      <TableCell className="border-l text-center">
                        <ScoreBadge score={rowCard.categories[0].score} />
                      </TableCell>
                    </TableRow>
                  )
                })}
                {!rows.length && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-muted-foreground h-24 text-center">
                      No designer data returned from Odoo for this period.
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
            <SectionCardTitle>Bookings in period</SectionCardTitle>
            <CardDescription>
              The most recent bookings behind the numbers above, with the sale order each order
              value came from.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table className="min-w-[48rem]" aria-label={`Bookings in ${period.label}`}>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Lead</TableHead>
                  <TableHead>Designer</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Booked</TableHead>
                  <TableHead>Sale order</TableHead>
                  <TableHead className="text-right">Order value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell className="max-w-56 truncate font-medium">{lead.name}</TableCell>
                    <TableCell>{lead.designerLabel || lead.designer}</TableCell>
                    <TableCell className="text-muted-foreground max-w-40 truncate text-xs">
                      {lead.company}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {lead.source ?? EM_DASH}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{lead.stage}</TableCell>
                    <TableCell className="text-xs tabular-nums">
                      {formatDate(lead.bookedOn)}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">
                      {lead.order ?? (
                        <Badge variant="outline" className="text-muted-foreground">
                          none
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(lead.amount)}
                    </TableCell>
                  </TableRow>
                ))}
                {!bookings.length && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-muted-foreground h-24 text-center">
                      No bookings in this period.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <p className="text-muted-foreground px-4 text-xs lg:px-6">
        {formatCount(snapshot.leads.filter((lead) => lead.designer).length)} designer-assigned leads across{" "}
        {formatCount(snapshot.designers.length)} designers and{" "}
        {formatCount(snapshot.companies.length)} companies · synced from Odoo{" "}
        {formatDate(snapshot.syncedAt)}
        {priorCard?.categories[0].score != null && cat.score != null && (
          <> · module score {formatScore(priorCard.categories[0].score)} → {formatScore(cat.score)} vs {prior?.label}</>
        )}
      </p>
    </>
  )
}

