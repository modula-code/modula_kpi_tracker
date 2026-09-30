"use client"

import * as React from "react"

import { DEFAULT_PAYOUT, DEFAULT_PERIOD_ID, periodsByGranularity } from "@/lib/data/seed"
import type { Filters, PayoutSlab, TargetOverrides, Viewer } from "@/lib/data/query"
import { createQueries } from "@/lib/data/query"
import type { SalesSnapshot } from "@/lib/data/sales-types"
import type { TargetConfig } from "@/lib/data/sales-metrics"
import type { AdminData, AuditTicket, Granularity, Role } from "@/lib/data/types"

/** Live snapshot plus session-local filters, target overrides and audit edits. */

interface DashboardState {
  snapshot: SalesSnapshot
  queries: ReturnType<typeof createQueries>
  filters: Filters
  granularity: Granularity
  viewer: Viewer
  overrides: TargetOverrides
  slab: PayoutSlab
  tickets: AuditTicket[]
  setPeriod: (periodId: string) => void
  setGranularity: (granularity: Granularity) => void
  setFilter: (key: "ecId" | "designerId" | "managerId", value: string) => void
  resetFilters: () => void
  setRole: (role: Role) => void
  setSeat: (key: "designerId" | "managerId", id: string) => void
  setOverride: (designerId: string, subKpiId: string, target: number | null) => void
  clearOverrides: () => void
  setSlab: (slab: Partial<PayoutSlab>) => void
}

const DashboardContext = React.createContext<DashboardState | null>(null)

const INITIAL_FILTERS: Filters = {
  periodId: DEFAULT_PERIOD_ID,
  ecId: "all",
  designerId: "all",
  managerId: "all",
}

export function DashboardProvider({ children, snapshot, targets, admin }: { children: React.ReactNode; snapshot: SalesSnapshot; targets: TargetConfig; admin: AdminData }) {
  const [filters, setFilters] = React.useState<Filters>(INITIAL_FILTERS)
  const [granularity, setGranularityState] = React.useState<Granularity>("month")
  const [viewer, setViewer] = React.useState<Viewer>({
    role: "head",
    designerId: snapshot.designers[0] ?? "",
    managerId: admin.managers[0]?.id ?? "",
  })
  const [overrides, setOverrides] = React.useState<TargetOverrides>({})
  const [slab, setSlabState] = React.useState<PayoutSlab>({ ...DEFAULT_PAYOUT })
  const tickets: AuditTicket[] = admin.auditTickets
  const queries = React.useMemo(() => createQueries(snapshot, targets, filters.ecId, admin), [snapshot, targets, filters.ecId, admin])

  const setPeriod = React.useCallback((periodId: string) => {
    setFilters((f) => ({ ...f, periodId }))
  }, [])

  const setGranularity = React.useCallback((next: Granularity) => {
    setGranularityState(next)
    // Jump to the most recent period at the new granularity.
    const latest = periodsByGranularity[next][0]
    if (latest) setFilters((f) => ({ ...f, periodId: latest.id }))
  }, [])

  const setFilter = React.useCallback(
    (key: "ecId" | "designerId" | "managerId", value: string) => {
      setFilters((f) => {
        const next = { ...f, [key]: value }
        // Narrowing to an EC or a designer clears the now-contradictory picks above it.
        if (key === "managerId" && value !== f.managerId) {
          next.ecId = "all"
          next.designerId = "all"
        }
        if (key === "ecId" && value !== f.ecId) next.designerId = "all"
        return next
      })
    },
    [],
  )

  const resetFilters = React.useCallback(() => {
    setFilters((f) => ({ ...INITIAL_FILTERS, periodId: f.periodId }))
  }, [])

  const setRole = React.useCallback((role: Role) => {
    setViewer((v) => ({ ...v, role }))
    // A narrower role can't keep a filter pointing outside its own scope.
    setFilters((f) => ({ ...INITIAL_FILTERS, periodId: f.periodId }))
  }, [])

  const setSeat = React.useCallback((key: "designerId" | "managerId", id: string) => {
    setViewer((v) => ({ ...v, [key]: id }))
    setFilters((f) => ({ ...INITIAL_FILTERS, periodId: f.periodId }))
  }, [])

  const setOverride = React.useCallback(
    (designerId: string, subKpiId: string, target: number | null) => {
      setOverrides((o) => {
        const next = { ...o }
        const key = `${designerId}:${subKpiId}`
        if (target == null || !Number.isFinite(target) || target <= 0) delete next[key]
        else next[key] = target
        return next
      })
    },
    [],
  )

  const clearOverrides = React.useCallback(() => setOverrides({}), [])

  const setSlab = React.useCallback((patch: Partial<PayoutSlab>) => {
    setSlabState((s) => ({ ...s, ...patch }))
  }, [])

  const value = React.useMemo<DashboardState>(
    () => ({
      snapshot,
      queries,
      filters,
      granularity,
      viewer,
      overrides,
      slab,
      tickets,
      setPeriod,
      setGranularity,
      setFilter,
      resetFilters,
      setRole,
      setSeat,
      setOverride,
      clearOverrides,
      setSlab,
    }),
    [
      snapshot, queries, filters, granularity, viewer, overrides, slab, tickets,
      setPeriod, setGranularity, setFilter, resetFilters, setRole, setSeat,
      setOverride, clearOverrides, setSlab,
    ],
  )

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>
}

export function useDashboard() {
  const ctx = React.useContext(DashboardContext)
  if (!ctx) throw new Error("useDashboard must be used inside <DashboardProvider>")
  return ctx
}
