"use client"

import * as React from "react"
import Link from "next/link"
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table"
import {
  ArrowUpDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MinusIcon,
  TrendingDownIcon,
  TrendingUpIcon,
} from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ScoreBadge } from "@/components/shared/rating"
import { EM_DASH, formatDelta } from "@/lib/format"
import type { LeaderboardRow } from "@/lib/data/query"
import { cn } from "@/lib/utils"

/**
 * Designer ranking (brief §6.5). Sortable on every score column so a manager
 * can ask "who is weakest on Execution?" without leaving the page.
 */
export function LeaderboardTable({
  rows,
  pageSize = 10,
  className,
}: {
  rows: LeaderboardRow[]
  pageSize?: number
  className?: string
}) {
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "final", desc: true }])
  const [filter, setFilter] = React.useState("")

  const columns = React.useMemo<ColumnDef<LeaderboardRow>[]>(
    () => [
      {
        accessorKey: "rank",
        header: "#",
        cell: ({ row }) => (
          <span className="text-muted-foreground tabular-nums">{row.original.rank}</span>
        ),
        size: 40,
        enableSorting: false,
      },
      {
        accessorKey: "name",
        header: "Designer",
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <Avatar className="size-7 rounded-lg">
              <AvatarFallback className="rounded-lg text-[11px]">
                {row.original.initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="truncate font-medium">{row.original.name}</div>
              <div className="text-muted-foreground truncate text-xs">
                {row.original.ec} · {row.original.manager}
              </div>
            </div>
          </div>
        ),
      },
      ...["sales", "execution", "referrals", "circle"].map((id, i) => ({
        id,
        accessorFn: (r: LeaderboardRow) => r.categories.find((c) => c.id === id)?.score ?? -1,
        header: () => (
          <span className="flex items-center gap-2">
            <span
              className={cn("size-2 rounded-full", `bg-chart-${i + 1}`)}
              aria-hidden
            />
            {["Sales", "Execution", "Referrals", "Circle"][i]}
          </span>
        ),
        cell: ({ row }: { row: { original: LeaderboardRow } }) => (
          <ScoreBadge score={row.original.categories.find((c) => c.id === id)?.score ?? null} />
        ),
        sortDescFirst: true,
      })),
      {
        accessorKey: "final",
        header: "Final Score",
        cell: ({ row }) => <ScoreBadge score={row.original.final} showOutOf />,
        sortDescFirst: true,
      },
      {
        accessorKey: "delta",
        header: "vs prev.",
        cell: ({ row }) => <DeltaCell delta={row.original.delta} />,
        sortDescFirst: true,
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/scorecard?designer=${row.original.designerId}`}>Scorecard</Link>
          </Button>
        ),
        enableSorting: false,
      },
    ],
    [],
  )

  // TanStack Table intentionally exposes callback-heavy state that React Compiler skips.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, globalFilter: filter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: (row, columnId, value) => {
      void columnId
      return row.original.name.toLowerCase().includes(String(value).toLowerCase())
    },
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  })

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between gap-4">
        <Input
          type="search"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Filter designers…"
          aria-label="Filter designers"
          className="max-w-sm"
        />
        <span className="text-muted-foreground hidden text-sm tabular-nums sm:inline">
          {table.getFilteredRowModel().rows.length} designer
          {table.getFilteredRowModel().rows.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table className="min-w-[56rem]" aria-label="Designer KPI leaderboard">
          <TableHeader className="bg-muted/50">
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id} className="hover:bg-transparent">
                {group.headers.map((header) => {
                  const sortable = header.column.getCanSort()
                  return (
                    <TableHead
                      key={header.id}
                      aria-sort={
                        header.column.getIsSorted() === "asc"
                          ? "ascending"
                          : header.column.getIsSorted() === "desc"
                            ? "descending"
                            : undefined
                      }
                    >
                      {header.isPlaceholder ? null : sortable ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          aria-label={`Sort by ${header.id}`}
                          className="hover:text-foreground -ml-2 flex items-center gap-2 rounded-md px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <ArrowUpDownIcon
                            aria-hidden
                            className={cn(
                              "size-3",
                              header.column.getIsSorted() ? "opacity-100" : "opacity-30",
                            )}
                          />
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="text-muted-foreground h-24 text-center"
                >
                  No designers match the current filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between px-1">
          <span className="text-muted-foreground text-sm tabular-nums">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()} ·{" "}
            {table.getFilteredRowModel().rows.length} designers
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeftIcon /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next <ChevronRightIcon />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function DeltaCell({ delta }: { delta: number | null }) {
  if (delta == null) return <span className="text-muted-foreground">{EM_DASH}</span>
  const flat = Math.abs(delta) < 0.005
  const Icon = flat ? MinusIcon : delta > 0 ? TrendingUpIcon : TrendingDownIcon
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium tabular-nums",
        flat ? "text-muted-foreground" : delta > 0 ? "text-rating-4" : "text-rating-1",
      )}
    >
      <Icon className="size-3.5" />
      {formatDelta(delta)}
    </span>
  )
}
