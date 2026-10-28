import { cookies } from "next/headers"

import { DashboardProvider } from "@/components/dashboard/dashboard-provider"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { SiteHeader } from "@/components/layout/site-header"
import { KpiFilterBar } from "@/components/dashboard/kpi-filter-bar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { SESSION, verifySession } from "@/lib/auth"
import { fetchSalesSnapshot } from "@/lib/data/sales-source"
import { readTargets } from "@/lib/data/targets-store"
import { readAdminData } from "@/lib/data/admin-store"
import type { SalesSnapshot } from "@/lib/data/sales-types"

/** Every page in here is behind the login — middleware guarantees the session. */
export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const store = await cookies()
  const email = (await verifySession(store.get(SESSION.cookie)?.value))?.email ?? ""
  const [targets, admin] = await Promise.all([readTargets(), readAdminData()])
  let snapshot: SalesSnapshot
  try {
    snapshot = await fetchSalesSnapshot()
  } catch (error) {
    snapshot = { designers: [], leads: [], companies: [], syncedAt: new Date().toISOString(), error: error instanceof Error ? error.message : "Could not reach Odoo." }
  }

  return (
    <>
      <a
        href="#main-content"
        className="bg-primary text-primary-foreground fixed left-4 top-4 z-50 -translate-y-20 rounded-md px-4 py-2 text-sm font-medium focus:translate-y-0"
      >
        Skip to content
      </a>
      <DashboardProvider snapshot={snapshot} targets={targets} admin={admin}>
        <SidebarProvider>
          <AppSidebar variant="inset" account={email} />
          <SidebarInset>
            <SiteHeader />
            <KpiFilterBar />
            <main
              id="main-content"
              tabIndex={-1}
              className="@container/main mx-auto flex w-full max-w-screen-2xl flex-1 flex-col gap-4 py-4 outline-none md:gap-6 md:py-6"
            >
              {snapshot.error && <p role="alert" className="text-destructive px-4 lg:px-6">Odoo data unavailable: {snapshot.error}</p>}
              {children}
            </main>
          </SidebarInset>
        </SidebarProvider>
      </DashboardProvider>
    </>
  )
}
