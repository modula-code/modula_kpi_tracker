"use client"

import * as React from "react"
import { CheckIcon, ChevronsUpDownIcon, RotateCcwIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useDashboard } from "@/components/dashboard/dashboard-provider"
import { periodsByGranularity } from "@/lib/data/seed"

import type { Granularity } from "@/lib/data/types"
import { cn } from "@/lib/utils"

const GRANULARITIES: { value: Granularity; label: string; short: string }[] = [
  { value: "week", label: "Weekly", short: "W" },
  { value: "month", label: "Monthly", short: "M" },
  { value: "quarter", label: "Quarterly", short: "Q" },
  { value: "year", label: "Yearly", short: "Y" },
  { value: "all", label: "All time", short: "All" },
]

/**
 * The one filter bar, shared by every module (brief §6.2).
 * Options are already scoped to the viewer's role, so a designer never sees a
 * name they aren't allowed to open.
 */
export function KpiFilterBar({ className }: { className?: string }) {
  const { queries: { designersVisibleTo, ecsVisibleTo, managersVisibleTo } } = useDashboard()
  const { filters, granularity, viewer, setPeriod, setGranularity, setFilter, resetFilters } =
    useDashboard()

  const periods = periodsByGranularity[granularity]
  const ecs = ecsVisibleTo(viewer)
  const managers = managersVisibleTo(viewer)
  const designers = React.useMemo(() => {
    let list = designersVisibleTo(viewer)
    if (filters.managerId !== "all") {
      const ecIds = new Set(ecs.filter((e) => e.managerId === filters.managerId).map((e) => e.id))
      list = list.filter((d) => d.ecIds?.some((id) => ecIds.has(id)))
    }
    if (filters.ecId !== "all") list = list.filter((d) => d.ecIds?.includes(filters.ecId))
    return list
  }, [viewer, filters.managerId, filters.ecId, ecs, designersVisibleTo])

  const scopedEcs = React.useMemo(
    () => (filters.managerId === "all" ? ecs : ecs.filter((e) => e.managerId === filters.managerId)),
    [ecs, filters.managerId],
  )

  const dirty =
    filters.ecId !== "all" || filters.designerId !== "all" || filters.managerId !== "all"

  return (
    <div
      className={cn(
        "bg-background/95 sticky top-12 z-30 flex flex-wrap items-center gap-2 border-b px-4 py-2 backdrop-blur lg:px-6",
        className,
      )}
    >
      <ToggleGroup
        type="single"
        size="sm"
        variant="outline"
        value={granularity}
        onValueChange={(v) => v && setGranularity(v as Granularity)}
        className="shrink-0"
        aria-label="Reporting granularity"
      >
        {GRANULARITIES.map((g) => (
          <ToggleGroupItem key={g.value} value={g.value} aria-label={g.label} className="px-3">
            <span className="hidden sm:inline">{g.label}</span>
            <span className="sm:hidden">{g.short}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <Select value={filters.periodId} onValueChange={setPeriod}>
        <SelectTrigger size="sm" className="w-40" aria-label="Period">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {periods.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        {managers.length > 1 && (
          <FilterCombobox
            label="Manager / ASM"
            allLabel="All managers"
            value={filters.managerId}
            options={managers.map((m) => ({ value: m.id, label: m.name, hint: m.title }))}
            onChange={(v) => setFilter("managerId", v)}
          />
        )}
        {ecs.length > 1 && (
          <FilterCombobox
            label="EC location"
            allLabel="All ECs"
            value={filters.ecId}
            options={scopedEcs.map((e) => ({
              value: e.id,
              label: e.name,
              hint: e.city,
            }))}
            onChange={(v) => setFilter("ecId", v)}
          />
        )}
        {designers.length > 1 && (
          <FilterCombobox
            label="Designer"
            allLabel="All designers"
            value={filters.designerId}
            options={designers.map((d) => ({ value: d.id, label: d.name }))}
            onChange={(v) => setFilter("designerId", v)}
          />
        )}
        {dirty && (
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            <RotateCcwIcon />
            <span className="hidden md:inline">Reset</span>
          </Button>
        )}
      </div>
    </div>
  )
}

interface Option {
  value: string
  label: string
  hint?: string
}

function FilterCombobox({
  label,
  allLabel,
  value,
  options,
  onChange,
}: {
  label: string
  allLabel: string
  value: string
  options: Option[]
  onChange: (value: string) => void
}) {
  const [open, setOpen] = React.useState(false)
  const selected = options.find((o) => o.value === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={open}
          aria-label={label}
          className="justify-between gap-2 font-normal"
        >
          <span className="text-muted-foreground hidden lg:inline">{label}</span>
          <span className="max-w-32 truncate font-medium">{selected?.label ?? allLabel}</span>
          <ChevronsUpDownIcon className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 p-0">
        <Command>
          <CommandInput placeholder={`Search ${label.toLowerCase()}…`} />
          <CommandList>
            <CommandEmpty>No match.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value={allLabel}
                onSelect={() => {
                  onChange("all")
                  setOpen(false)
                }}
              >
                <CheckIcon className={cn(value === "all" ? "opacity-100" : "opacity-0")} />
                {allLabel}
              </CommandItem>
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={o.label}
                  onSelect={() => {
                    onChange(o.value)
                    setOpen(false)
                  }}
                >
                  <CheckIcon className={cn(value === o.value ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{o.label}</span>
                  {o.hint && (
                    <span className="text-muted-foreground ml-auto text-xs">{o.hint}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
