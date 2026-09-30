"use client"

import * as React from "react"
import { InfoIcon } from "lucide-react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { AchievementBar, RatingBadge, ScoreBadge } from "@/components/shared/rating"
import { EM_DASH, formatScore, formatValue, formatWeight } from "@/lib/format"
import type { Scorecard } from "@/lib/kpi-engine"
import { cn } from "@/lib/utils"

const SLOT_DOT = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
]

/**
 * The full target -> achievement -> rating -> weighted-score table.
 * Used unchanged for the designer scorecard and for the EC and manager rollups
 * (brief §6.5), because the engine produces the same shape at every level.
 */
export function ScorecardTable({
  scorecard,
  caption,
  className,
}: {
  scorecard: Scorecard
  caption?: string
  className?: string
}) {
  return (
    <div className={cn("w-full overflow-x-auto", className)}>
      <Table
        className="min-w-[52rem]"
        aria-label={caption ? `KPI scorecard: ${caption}` : "Weighted KPI scorecard"}
      >
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-64">Category / Sub-KPI</TableHead>
            <TableHead className="w-16 text-right">Weight</TableHead>
            <TableHead className="w-28 text-right">Target</TableHead>
            <TableHead className="w-28 text-right">Actual</TableHead>
            <TableHead className="w-52">
              <HeadWithHelp help="Actual ÷ Target. For Design Freeze Cycle Time, where lower is better, it is Target ÷ Actual.">
                Achievement %
              </HeadWithHelp>
            </TableHead>
            <TableHead className="w-20 text-center">
              <HeadWithHelp help="Standard rating guide: 100%+ → 4, 90–99% → 3, 75–89% → 2, below 75% → 1.">
                Rating
              </HeadWithHelp>
            </TableHead>
            <TableHead className="w-28 text-right">
              <HeadWithHelp help="Rating × sub-KPI weight. The category score is the sum of these.">
                Weighted
              </HeadWithHelp>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {scorecard.categories.map((cat) => (
            <React.Fragment key={cat.id}>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableCell className="font-medium">
                  <span className="flex items-center gap-2">
                    <span
                      className={cn("size-2 shrink-0 rounded-full", SLOT_DOT[cat.slot - 1])}
                      aria-hidden
                    />
                    {cat.label}
                  </span>
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatWeight(cat.weight)}
                </TableCell>
                <TableCell colSpan={3} className="text-muted-foreground text-xs">
                  Category weighted score
                </TableCell>
                <TableCell className="text-center">
                  <ScoreBadge score={cat.score} />
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {formatScore(cat.weighted)}
                </TableCell>
              </TableRow>

              {cat.subKpis.map((sub) => (
                <TableRow key={sub.id}>
                  <TableCell className="text-muted-foreground pl-8">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="decoration-muted-foreground/40 cursor-help underline decoration-dotted underline-offset-4">
                          {sub.label}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-72">{sub.definition}</TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-right tabular-nums">
                    {formatWeight(sub.weight)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatValue(sub.target, sub.unit)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatValue(sub.actual, sub.unit)}
                  </TableCell>
                  <TableCell>
                    <AchievementBar achievement={sub.achievement} rating={sub.rating} />
                  </TableCell>
                  <TableCell className="text-center">
                    <RatingBadge rating={sub.rating} achievement={sub.achievement} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {sub.weighted == null ? EM_DASH : formatScore(sub.weighted)}
                  </TableCell>
                </TableRow>
              ))}
            </React.Fragment>
          ))}

          <TableRow className="border-t-2 hover:bg-transparent">
            <TableCell className="text-base font-semibold">Final KPI Score</TableCell>
            <TableCell className="text-right font-semibold tabular-nums">100%</TableCell>
            <TableCell colSpan={3} className="text-muted-foreground text-xs">
              {caption ?? "Σ (category score × category weight)"}
            </TableCell>
            <TableCell className="text-center">
              <ScoreBadge score={scorecard.final} showOutOf />
            </TableCell>
            <TableCell className="text-right text-base font-bold tabular-nums">
              {formatScore(scorecard.final)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  )
}

function HeadWithHelp({ children, help }: { children: React.ReactNode; help: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="link"
          className="h-auto gap-2 p-0 text-inherit underline decoration-dotted decoration-muted-foreground/40 underline-offset-4"
        >
          {children}
          <InfoIcon className="size-3 opacity-50" />
        </Button>
      </TooltipTrigger>
      <TooltipContent className="max-w-72">{help}</TooltipContent>
    </Tooltip>
  )
}
