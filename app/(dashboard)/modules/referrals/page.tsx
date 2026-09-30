"use client"

import { useDashboard } from "@/components/dashboard/dashboard-provider"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card"
import { PayoutSlabForm } from "@/components/forms/payout-slab-form"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PageHeader } from "@/components/layout/page-header"
import { EmptyState, StatCard, StatCardGrid, SubKpiCard } from "@/components/dashboard/stat-card"
import { ScoreBadge } from "@/components/shared/rating"
import { SectionCardTitle } from "@/components/shared/section-card-title"
import { CategoryTrendChart, RankedBarChart } from "@/components/charts/charts"
import { useKpiData, useScoreTrend } from "@/hooks/use-kpi-data"
import { formatCount, formatCurrency, formatScore, formatWeight } from "@/lib/format"
import { KPI_TREE } from "@/lib/kpi-engine"
import { periodRange } from "@/lib/data/sales-metrics"


const CATEGORY = KPI_TREE[2]

export default function ReferralsModulePage() {
  const { snapshot, queries: { payoutRows, referralLeads, ecById } } = useDashboard()
  const { period, scorecard, viewer, filters, slab } = useKpiData()
  const trend = useScoreTrend(6)
  const cat = scorecard.categories[2]

  const payouts = payoutRows(viewer, filters, slab)
  const range = periodRange(period)
  const leads = referralLeads(viewer, filters).filter((lead) =>
    (lead.created >= range.start && lead.created < range.end) ||
    (lead.booked && lead.bookedOn && lead.bookedOn >= range.start && lead.bookedOn < range.end),
  )
  const totalLeads = payouts.reduce((sum, row) => sum + row.leads, 0)
  const totalPayout = payouts.reduce((sum, r) => sum + r.total, 0)
  const totalConverted = payouts.reduce((sum, r) => sum + r.converted, 0)
  const qualifying = payouts.filter((r) => r.qualifies).length
  if (snapshot.error) return <PageHeader title={CATEGORY.label} description="Referral data could not be loaded. Refresh to retry." />

  return (
    <>
      <PageHeader
        title={CATEGORY.label}
        weight={formatWeight(CATEGORY.weight)}
        description="Live referral leads and referrer details from Odoo. Leads count by creation date; conversions and order values count by booking date. CSAT is unmeasured until a source is configured."
        actions={<ScoreBadge score={cat.score} showOutOf />}
      />

      <StatCardGrid>
        {cat.subKpis.map((sub) => (
          <SubKpiCard key={sub.id} sub={sub.id === "referral" ? { ...sub, actual: totalLeads } : sub} weightOf={`${formatWeight(sub.weight)} of module`} />
        ))}
        <StatCard
          label="Converted referrals"
          value={formatCount(totalConverted)}
          hint="Referral leads that reached the confirmed booking stage in this period."
          footer={
            <span>
              {qualifying} of {payouts.length} designers clear the {slab.minimumConversions}
              -conversion floor
            </span>
          }
        />
        <StatCard
          label="Calculated payout"
          value={formatCurrency(totalPayout)}
          hint="Rate per converted referral plus a percentage of referred order value. Both inputs are editable below."
          footer={<span>For review — not posted to a disbursement system</span>}
        />
      </StatCardGrid>

      <div className="grid gap-4 px-4 lg:grid-cols-3 lg:px-6">
        <PayoutSlabForm />

        <Card className="lg:col-span-2">
          <CardHeader>
            <SectionCardTitle>Top referral earners</SectionCardTitle>
            <CardDescription>
              Calculated payout for {period.label} under the current slab.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {payouts.some((p) => p.total > 0) ? (
              <RankedBarChart
                data={payouts
                  .filter((p) => p.total > 0)
                  .slice(0, 6)
                  .map((p) => ({
                    label: p.name,
                    value: p.total,
                  }))}
                valueLabel="Payout (₹)"
                slot={3}
              />
            ) : (
              <EmptyState message="No payouts calculated. Set a payout rate or percentage to calculate amounts for converted referrals." />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="px-4 lg:px-6">
        <Card>
          <CardHeader>
            <SectionCardTitle>Referral leads · {period.label}</SectionCardTitle>
            <CardDescription>
              Leads with referrer details or a referral source. Unassigned leads remain visible.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table aria-label="Referral lead details" className="min-w-[70rem]">
              <TableHeader><TableRow>
                <TableHead>Lead</TableHead><TableHead>Referrer name</TableHead><TableHead>Referred by</TableHead>
                <TableHead>Referrer contact</TableHead><TableHead>Designer</TableHead><TableHead>EC location</TableHead>
                <TableHead>Stage / Source</TableHead><TableHead>Created / Booked</TableHead><TableHead className="text-right">Order value</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {leads.map((lead) => <TableRow key={lead.id}>
                  <TableCell className="max-w-64 whitespace-normal font-medium">{lead.name}<span className="text-muted-foreground block text-xs">#{lead.id}</span></TableCell>
                  <TableCell>{lead.referrerName || "—"}</TableCell>
                  <TableCell>{lead.referredBy || "—"}</TableCell>
                  <TableCell><span className="block">{lead.referrerEmail || "—"}</span><span className="text-muted-foreground text-xs">{lead.referrerPhone || "—"}</span></TableCell>
                  <TableCell>{lead.designer ? lead.designerLabel || lead.designer : "Unassigned"}</TableCell>
                  <TableCell>{ecById(lead.ecId ?? "")?.city || "Unmapped"}<span className="text-muted-foreground block max-w-56 whitespace-normal text-xs">{lead.company}</span></TableCell>
                  <TableCell>{lead.stage}<span className="text-muted-foreground block text-xs">{lead.source || "—"}</span></TableCell>
                  <TableCell>{lead.created}<span className="text-muted-foreground block text-xs">{lead.bookedOn || "—"}</span></TableCell>
                  <TableCell className="text-right tabular-nums">{lead.booked ? formatCurrency(lead.amount) : "—"}<span className="text-muted-foreground block text-xs">{lead.order || "—"}</span></TableCell>
                </TableRow>)}
                {!leads.length && <TableRow><TableCell colSpan={9} className="text-muted-foreground h-24 text-center">No referral leads or conversions in this period.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="px-4 lg:px-6">
        <Card>
          <CardHeader>
            <SectionCardTitle>Referral payout register · {period.label}</SectionCardTitle>
            <CardDescription>
              Every designer in scope, with the payout each would receive for review.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table
              className="min-w-[52rem]"
              aria-label={`Referral payout register for ${period.label}`}
            >
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Designer</TableHead>
                  <TableHead>EC</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Converted</TableHead>
                  <TableHead className="text-right">Referred order value</TableHead>
                  <TableHead className="text-right">Flat</TableHead>
                  <TableHead className="text-right">% of value</TableHead>
                  <TableHead className="text-right">Total payout</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payouts.map((r) => (
                  <TableRow key={r.designerId}>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-2">
                        {r.name}
                        {!r.qualifies && (
                          <Badge variant="outline" className="text-muted-foreground">
                            below floor
                          </Badge>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.ec}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.leads}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.converted}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(r.referredOrderValue)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right tabular-nums">
                      {formatCurrency(r.flatPayout)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right tabular-nums">
                      {formatCurrency(r.valuePayout)}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatCurrency(r.total)}
                    </TableCell>
                  </TableRow>
                ))}
                {!payouts.length && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-muted-foreground h-24 text-center">
                      No designers match the current filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              {payouts.length > 0 && (
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={7} className="font-medium">
                      Total for {period.label}
                    </TableCell>
                    <TableCell className="text-right font-bold tabular-nums">
                      {formatCurrency(totalPayout, false)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="px-4 lg:px-6">
        <Card>
          <CardHeader>
            <SectionCardTitle>Module score trend</SectionCardTitle>
            <CardDescription>
              Referral generation and CSAT combined · current {formatScore(cat.score)} / 4.00
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryTrendChart
              data={trend}
              series={[{ key: "referrals", label: CATEGORY.short, slot: CATEGORY.slot }]}
              yLabel="Score"
            />
          </CardContent>
        </Card>
      </div>
    </>
  )
}
