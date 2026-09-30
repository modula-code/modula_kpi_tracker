"use client"

import { CircleAlertIcon, MinusIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { AchievementBar, RatingBadge } from "@/components/shared/rating"
import { EM_DASH, formatDelta, formatValue } from "@/lib/format"
import type { ScoredSubKpi } from "@/lib/kpi-engine"
import { cn } from "@/lib/utils"

export function StatCardGrid({
  children,
  className,
  columns = 4,
}: {
  children: React.ReactNode
  className?: string
  columns?: 2 | 3 | 4
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 px-4 lg:px-6",
        "*:data-[slot=card]:h-full",
        columns === 2 && "@xl/main:grid-cols-2",
        columns === 3 && "@xl/main:grid-cols-2 @5xl/main:grid-cols-3",
        columns === 4 && "@xl/main:grid-cols-2 @5xl/main:grid-cols-4",
        className,
      )}
    >
      {children}
    </div>
  )
}

/** A headline figure with an optional period-on-period delta. */
export function StatCard({
  label,
  value,
  delta,
  deltaSuffix = "",
  footer,
  hint,
  action,
  invertDelta = false,
  className,
}: {
  label: string
  value: React.ReactNode
  delta?: number | null
  deltaSuffix?: string
  footer?: React.ReactNode
  hint?: string
  action?: React.ReactNode
  invertDelta?: boolean
  className?: string
}) {
  const good = delta == null ? null : invertDelta ? delta < 0 : delta > 0
  const flat = delta != null && Math.abs(delta) < 0.005
  const Icon = flat ? MinusIcon : good ? TrendingUpIcon : TrendingDownIcon

  return (
    <Card className={cn("@container/card", className)}>
      <CardHeader>
        <CardDescription>
          {hint ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="link"
                  className="h-auto justify-start p-0 text-left text-muted-foreground underline decoration-dotted decoration-muted-foreground/40 underline-offset-4"
                >
                  {label}
                </Button>
              </TooltipTrigger>
              <TooltipContent className="max-w-72">{hint}</TooltipContent>
            </Tooltip>
          ) : (
            label
          )}
        </CardDescription>
        <CardTitle className="text-3xl font-bold tabular-nums @[250px]/card:text-4xl">
          {value}
        </CardTitle>
        <CardAction>
          {action ??
            (delta != null && (
              <Badge
                variant="outline"
                className={cn(
                  "tabular-nums",
                  !flat && good && "border-rating-4/30 text-rating-4",
                  !flat && good === false && "border-rating-1/30 text-rating-1",
                )}
              >
                <Icon />
                {formatDelta(delta)}
                {deltaSuffix}
              </Badge>
            ))}
        </CardAction>
      </CardHeader>
      {footer && (
        <CardFooter className="text-muted-foreground flex-col items-start gap-2 text-sm">
          {footer}
        </CardFooter>
      )}
    </Card>
  )
}

export function SubKpiCard({
  sub,
  weightOf,
}: {
  sub: ScoredSubKpi
  /** e.g. "60% of Sales Performance" */
  weightOf?: string
}) {
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardDescription className="flex items-center justify-between gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="link"
                className="h-auto min-w-0 justify-start truncate p-0 text-left text-muted-foreground underline decoration-dotted decoration-muted-foreground/40 underline-offset-4"
              >
                {sub.label}
              </Button>
            </TooltipTrigger>
            <TooltipContent className="max-w-72">{sub.definition}</TooltipContent>
          </Tooltip>
          {weightOf && (
            <span className="text-muted-foreground shrink-0 text-xs font-normal">{weightOf}</span>
          )}
        </CardDescription>
        <CardTitle className="text-3xl font-bold tabular-nums @[250px]/card:text-4xl">
          {formatValue(sub.actual, sub.unit)}
        </CardTitle>
        <CardAction>
          <RatingBadge rating={sub.rating} achievement={sub.achievement} />
        </CardAction>
      </CardHeader>
      <CardFooter className="flex-col items-stretch gap-2 text-sm">
        <AchievementBar achievement={sub.achievement} rating={sub.rating} className="w-full" />
        <div className="text-muted-foreground flex items-center justify-between text-xs">
          <span>
            Target{" "}
            <span className="text-foreground font-medium tabular-nums">
              {formatValue(sub.target, sub.unit)}
            </span>
          </span>
          <span>
            {sub.direction === "lower" ? "Lower is better" : "Higher is better"}
          </span>
        </div>
      </CardFooter>
    </Card>
  )
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-muted-foreground flex min-h-40 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-6 text-center text-sm">
      <CircleAlertIcon className="size-5" aria-hidden />
      <p>{message || EM_DASH}</p>
    </div>
  )
}
