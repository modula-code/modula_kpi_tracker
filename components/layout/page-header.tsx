import { Badge } from "@/components/ui/badge"

export function PageHeader({
  title,
  description,
  weight,
  actions,
}: {
  title: string
  description?: string
  weight?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-start justify-between gap-4 px-4 sm:flex-row lg:px-6">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-4xl font-bold leading-tight tracking-tight">{title}</h1>
          {weight && (
            <Badge variant="secondary" className="tabular-nums">
              {weight} of final score
            </Badge>
          )}
        </div>
        {description && (
          <p className="text-muted-foreground max-w-3xl text-base leading-6">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
