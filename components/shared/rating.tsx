import { Progress } from "@/components/ui/progress"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { EM_DASH, formatPct, formatScore } from "@/lib/format"
import { RATING_BANDS, type Rating } from "@/lib/kpi-engine"
import { cn } from "@/lib/utils"

/**
 * Rating colours are the reserved status ladder, and the numeral is always
 * rendered next to the colour — hue never carries the meaning on its own.
 */
const RATING_STYLE: Record<Rating, { chip: string; dot: string; label: string }> = {
  4: {
    chip: "bg-rating-4/12 text-rating-4 border-rating-4/30",
    dot: "bg-rating-4",
    label: "Exceeds target",
  },
  3: {
    chip: "bg-rating-3/15 text-rating-3 border-rating-3/35",
    dot: "bg-rating-3",
    label: "Near target",
  },
  2: {
    chip: "bg-rating-2/15 text-rating-2 border-rating-2/35",
    dot: "bg-rating-2",
    label: "Below target",
  },
  1: {
    chip: "bg-rating-1/12 text-rating-1 border-rating-1/30",
    dot: "bg-rating-1",
    label: "Critical",
  },
}

export function ratingStyle(rating: Rating) {
  return RATING_STYLE[rating]
}

export function RatingBadge({
  rating,
  achievement,
  className,
}: {
  rating: Rating | null
  achievement?: number | null
  className?: string
}) {
  if (rating == null) {
    return <span className={cn("text-muted-foreground tabular-nums", className)}>{EM_DASH}</span>
  }
  const style = RATING_STYLE[rating]
  const band = RATING_BANDS.find((b) => b.rating === rating)

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role="img"
          aria-label={`Rating ${rating}: ${style.label}`}
          className={cn(
            "inline-flex h-6 min-w-9 items-center justify-center gap-2 rounded-md border px-2 text-xs font-semibold tabular-nums",
            style.chip,
            className,
          )}
        >
          <span className={cn("size-1.5 shrink-0 rounded-full", style.dot)} aria-hidden />
          {rating}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-medium">
          Rating {rating} · {style.label}
        </p>
        <p className="text-background/75">
          {band?.label}
          {achievement != null ? ` · achieved ${formatPct(achievement)}` : ""}
        </p>
      </TooltipContent>
    </Tooltip>
  )
}

/** The 1–4 rolled-up score. Same ladder, but a score is continuous. */
export function ScoreBadge({
  score,
  className,
  showOutOf = false,
}: {
  score: number | null
  className?: string
  showOutOf?: boolean
}) {
  if (score == null) {
    return <span className={cn("text-muted-foreground tabular-nums", className)}>{EM_DASH}</span>
  }
  const bucket = (score >= 3.5 ? 4 : score >= 3 ? 3 : score >= 2 ? 2 : 1) as Rating
  const style = RATING_STYLE[bucket]
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-2 rounded-md border px-2 text-xs font-semibold tabular-nums",
        style.chip,
        className,
      )}
      role="img"
      aria-label={`KPI score ${formatScore(score)} out of 4`}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", style.dot)} aria-hidden />
      {formatScore(score)}
      {showOutOf && <span className="text-[0.9em] font-normal opacity-70">/ 4</span>}
    </span>
  )
}

/**
 * Achievement % as a bar. Capped at 100% of the track so a 140% result doesn't
 * overflow, with the true figure always printed beside it.
 */
export function AchievementBar({
  achievement,
  rating,
  className,
}: {
  achievement: number | null
  rating: Rating | null
  className?: string
}) {
  const pct = achievement == null ? 0 : Math.max(0, Math.min(achievement, 100))
  const barColor =
    rating == null
      ? "bg-muted-foreground/40"
      : rating === 4
        ? "bg-rating-4"
        : rating === 3
          ? "bg-rating-3"
          : rating === 2
            ? "bg-rating-2"
            : "bg-rating-1"

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Progress
        value={pct}
        aria-label={`Achievement ${formatPct(achievement)}`}
        className="h-1.5 w-full min-w-16 max-w-28"
        indicatorClassName={barColor}
      />
      <span className="w-14 shrink-0 text-right text-xs font-medium tabular-nums">
        {formatPct(achievement)}
      </span>
    </div>
  )
}
