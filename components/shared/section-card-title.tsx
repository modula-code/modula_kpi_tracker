import * as React from "react"

import { CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export function SectionCardTitle({
  className,
  ...props
}: React.ComponentProps<typeof CardTitle>) {
  return (
    <CardTitle
      role="heading"
      aria-level={2}
      className={cn("text-xl font-semibold", className)}
      {...props}
    />
  )
}
