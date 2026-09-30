"use client"

import * as React from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  XAxis,
  YAxis,
} from "recharts"

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { cn } from "@/lib/utils"

/**
 * Chart colours come from the categorical slots in globals.css, assigned by
 * entity and never by rank — filtering the series list must not repaint the
 * survivors. Every chart carries a legend when it has two or more series.
 */

const AXIS = {
  tickLine: false,
  axisLine: false,
  tickMargin: 8,
  className: "text-xs",
} as const

/** Target vs Actual, indexed to 100 so unlike units share one axis. */
export function TargetVsActualChart({
  data,
  className,
}: {
  data: { label: string; target: number; actual: number; unit?: string }[]
  className?: string
}) {
  const config = {
    target: { label: "Target", color: "var(--chart-1)" },
    actual: { label: "Actual", color: "var(--chart-2)" },
  } satisfies ChartConfig

  return (
    <ChartContainer
      config={config}
      className={cn("aspect-auto h-64 w-full", className)}
      role="img"
      aria-label="Target and actual achievement by KPI"
    >
      <BarChart data={data} margin={{ left: 4, right: 4, top: 8 }} barCategoryGap="22%">
        <CartesianGrid vertical={false} strokeOpacity={0.35} />
        <XAxis dataKey="label" {...AXIS} interval={0} />
        <YAxis {...AXIS} width={44} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
        <ChartLegend content={<ChartLegendContent />} />
        {/* 2px surface gap between adjacent bars, rounded data-ends on the baseline. */}
        <Bar
          dataKey="target"
          fill="var(--color-target)"
          radius={[4, 4, 0, 0]}
          stroke="var(--card)"
          strokeWidth={2}
        />
        <Bar
          dataKey="actual"
          fill="var(--color-actual)"
          radius={[4, 4, 0, 0]}
          stroke="var(--card)"
          strokeWidth={2}
        />
      </BarChart>
    </ChartContainer>
  )
}

/** One line per category — the month-on-month / week-on-week trend view. */
export function CategoryTrendChart({
  data,
  series,
  yLabel,
  domain = [0, 4],
  className,
}: {
  data: Record<string, string | number | null>[]
  series: { key: string; label: string; slot: number }[]
  yLabel?: string
  domain?: [number, number]
  className?: string
}) {
  const config = Object.fromEntries(
    series.map((s) => [s.key, { label: s.label, color: `var(--chart-${s.slot})` }]),
  ) satisfies ChartConfig

  return (
    <ChartContainer
      config={config}
      className={cn("aspect-auto h-72 w-full", className)}
      role="img"
      aria-label={`${series.map((item) => item.label).join(", ")} trend chart`}
    >
      <LineChart data={data} margin={{ left: 4, right: 12, top: 8 }}>
        <CartesianGrid vertical={false} strokeOpacity={0.35} />
        <XAxis dataKey="period" {...AXIS} minTickGap={16} />
        <YAxis
          {...AXIS}
          width={44}
          domain={domain}
          label={
            yLabel
              ? {
                  value: yLabel,
                  angle: -90,
                  position: "insideLeft",
                  className: "fill-muted-foreground text-xs",
                }
              : undefined
          }
        />
        <ChartTooltip cursor content={<ChartTooltipContent indicator="line" />} />
        {series.length > 1 && <ChartLegend content={<ChartLegendContent />} />}
        {series.map((s) => (
          <Line
            key={s.key}
            dataKey={s.key}
            type="monotone"
            stroke={`var(--color-${s.key})`}
            strokeWidth={2}
            dot={{ r: 3, strokeWidth: 0, fill: `var(--color-${s.key})` }}
            activeDot={{ r: 5, stroke: "var(--card)", strokeWidth: 2 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ChartContainer>
  )
}

/** The four category scores as one shape — a designer's balance at a glance. */
export function CategoryRadarChart({
  data,
  className,
}: {
  data: { category: string; score: number }[]
  className?: string
}) {
  const config = { score: { label: "Score", color: "var(--chart-1)" } } satisfies ChartConfig
  return (
    <ChartContainer
      config={config}
      className={cn("mx-auto aspect-square max-h-72", className)}
      role="img"
      aria-label="Category score balance radar chart"
    >
      <RadarChart data={data} outerRadius="70%">
        <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
        <PolarGrid strokeOpacity={0.4} />
        <PolarAngleAxis dataKey="category" className="text-xs" />
        <Radar
          dataKey="score"
          fill="var(--color-score)"
          fillOpacity={0.25}
          stroke="var(--color-score)"
          strokeWidth={2}
          dot={{ r: 3.5, fillOpacity: 1, strokeWidth: 0 }}
        />
      </RadarChart>
    </ChartContainer>
  )
}

/** Horizontal ranked bars — recurring errors, top performers. */
export function RankedBarChart({
  data,
  valueLabel,
  slot = 2,
  className,
  height = "h-64",
}: {
  data: { label: string; value: number }[]
  valueLabel: string
  slot?: number
  className?: string
  height?: string
}) {
  const config = {
    value: { label: valueLabel, color: `var(--chart-${slot})` },
  } satisfies ChartConfig

  return (
    <ChartContainer
      config={config}
      className={cn("aspect-auto w-full", height, className)}
      role="img"
      aria-label={`${valueLabel} ranked bar chart`}
    >
      <BarChart data={data} layout="vertical" margin={{ left: 4, right: 32 }}>
        <CartesianGrid horizontal={false} strokeOpacity={0.35} />
        <XAxis type="number" {...AXIS} hide />
        <YAxis
          type="category"
          dataKey="label"
          {...AXIS}
          width={132}
          tick={{ className: "fill-muted-foreground text-xs" }}
        />
        <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
        <Bar dataKey="value" fill="var(--color-value)" radius={[0, 4, 4, 0]} barSize={18}>
          {data.map((d) => (
            <Cell key={d.label} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}

/**
 * Grouped bars where each bar is its own entity (an EC, a designer) — colour
 * follows the entity, so a filter that drops one doesn't recolour the rest.
 */
export function EntityBarChart({
  data,
  valueLabel,
  domain,
  className,
}: {
  data: { label: string; value: number; slot: number }[]
  valueLabel: string
  domain?: [number, number]
  className?: string
}) {
  const config = {
    value: { label: valueLabel, color: "var(--chart-1)" },
  } satisfies ChartConfig

  return (
    <ChartContainer
      config={config}
      className={cn("aspect-auto h-64 w-full", className)}
      role="img"
      aria-label={`${valueLabel} by entity bar chart`}
    >
      <BarChart data={data} margin={{ left: 4, right: 4, top: 8 }} barCategoryGap="28%">
        <CartesianGrid vertical={false} strokeOpacity={0.35} />
        <XAxis dataKey="label" {...AXIS} interval={0} />
        <YAxis {...AXIS} width={40} domain={domain} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]} stroke="var(--card)" strokeWidth={2}>
          {data.map((d) => (
            <Cell key={d.label} fill={`var(--chart-${((d.slot - 1) % 5) + 1})`} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}
