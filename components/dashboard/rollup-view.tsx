"use client"

import * as React from "react"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
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
import { ScoreBadge } from "@/components/shared/rating"
import { SectionCardTitle } from "@/components/shared/section-card-title"
import { ScorecardTable } from "@/components/tables/scorecard-table"
import { EntityBarChart } from "@/components/charts/charts"
import { formatScore, formatWeight } from "@/lib/format"
import type { Scorecard } from "@/lib/kpi-engine"

export interface RollupEntity {
  id: string
  name: string
  subtitle: string
  scorecard: Scorecard
  /** Children one level down — designers under an EC, ECs under a manager. */
  children: { id: string; name: string; subtitle: string; scorecard: Scorecard }[]
}

/**
 * Shared body for the EC and Manager/ASM rollups. Both levels produce the same
 * scorecard shape, so one view serves both (brief §6.5).
 */
export function RollupView({
  entities,
  entityLabel,
  childLabel,
  periodLabel,
}: {
  entities: RollupEntity[]
  entityLabel: string
  childLabel: string
  periodLabel: string
}) {
  const bars = entities.map((e, i) => ({
    label: e.name,
    value: Math.round((e.scorecard.final ?? 0) * 100) / 100,
    slot: i + 1,
  }))

  return (
    <>
      <div className="grid gap-4 px-4 lg:grid-cols-3 lg:px-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <SectionCardTitle>{entityLabel} standing · {periodLabel}</SectionCardTitle>
            <CardDescription>
              Final KPI score per {entityLabel.toLowerCase()}. Each bar keeps its own colour, so
              filtering never repaints the others.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EntityBarChart data={bars} valueLabel="Final score" domain={[0, 4]} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionCardTitle>Ranking</SectionCardTitle>
            <CardDescription>Sorted by final KPI score.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table aria-label={`${entityLabel} ranking for ${periodLabel}`}>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>{entityLabel}</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...entities]
                  .sort((a, b) => (b.scorecard.final ?? -1) - (a.scorecard.final ?? -1))
                  .map((e, i) => (
                    <TableRow key={e.id}>
                      <TableCell>
                        <span className="flex items-center gap-2">
                          <span className="text-muted-foreground tabular-nums">{i + 1}</span>
                          <span className="font-medium">{e.name}</span>
                        </span>
                      </TableCell>
                      <TableCell className="flex justify-end">
                        <ScoreBadge score={e.scorecard.final} />
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="px-4 lg:px-6">
        <Card>
          <CardHeader>
            <SectionCardTitle>Category breakdown</SectionCardTitle>
            <CardDescription>
              Every {entityLabel.toLowerCase()} against the four weighted categories.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table className="min-w-[48rem]" aria-label={`${entityLabel} category breakdown`}>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-56">{entityLabel}</TableHead>
                  {entities[0]?.scorecard.categories.map((c, i) => (
                    <TableHead key={c.id} className="text-center">
                      <span className="flex items-center justify-center gap-2">
                        <span className={`size-2 rounded-full bg-chart-${i + 1}`} aria-hidden />
                        {c.short}
                        <span className="text-muted-foreground font-normal">
                          {formatWeight(c.weight)}
                        </span>
                      </span>
                    </TableHead>
                  ))}
                  <TableHead className="text-right">Final</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entities.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <div className="font-medium">{e.name}</div>
                      <div className="text-muted-foreground text-xs">{e.subtitle}</div>
                    </TableCell>
                    {e.scorecard.categories.map((c) => (
                      <TableCell key={c.id} className="text-center">
                        <ScoreBadge score={c.score} />
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatScore(e.scorecard.final)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="px-4 lg:px-6">
        <Card>
          <CardHeader>
            <SectionCardTitle>Drill down</SectionCardTitle>
            <CardDescription>
              Open any {entityLabel.toLowerCase()} for its full scorecard and the {childLabel}s
              beneath it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {entities.map((e) => (
                <AccordionItem key={e.id} value={e.id}>
                  <AccordionTrigger>
                    <span className="flex flex-1 flex-col items-start justify-between gap-2 pr-2 sm:flex-row sm:items-center">
                      <span className="text-left">
                        <span className="font-medium">{e.name}</span>
                        <span className="text-muted-foreground block text-xs font-normal sm:ml-2 sm:inline">
                          {e.subtitle}
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        <Badge variant="outline">
                          {e.children.length} {childLabel}
                          {e.children.length === 1 ? "" : "s"}
                        </Badge>
                        <ScoreBadge score={e.scorecard.final} showOutOf />
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    <ScorecardTable
                      scorecard={e.scorecard}
                      caption={`Aggregated across ${e.children.length} ${childLabel}s`}
                    />
                    <div>
                      <h4 className="mb-2 text-sm font-medium">
                        {childLabel.charAt(0).toUpperCase() + childLabel.slice(1)}s in {e.name}
                      </h4>
                      <Table aria-label={`${childLabel}s in ${e.name}`}>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead>{childLabel}</TableHead>
                            {e.scorecard.categories.map((c) => (
                              <TableHead key={c.id} className="text-center">
                                {c.short}
                              </TableHead>
                            ))}
                            <TableHead className="text-right">Final</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {e.children.map((child) => (
                            <TableRow key={child.id}>
                              <TableCell>
                                <div className="font-medium">{child.name}</div>
                                <div className="text-muted-foreground text-xs">
                                  {child.subtitle}
                                </div>
                              </TableCell>
                              {child.scorecard.categories.map((c) => (
                                <TableCell key={c.id} className="text-center">
                                  <ScoreBadge score={c.score} />
                                </TableCell>
                              ))}
                              <TableCell className="text-right font-semibold tabular-nums">
                                {formatScore(child.scorecard.final)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
