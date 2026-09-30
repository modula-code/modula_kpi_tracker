import { SalesModule } from "@/components/modules/sales-module"
import { fetchSalesSnapshot } from "@/lib/data/sales-source"
import { readTargets } from "@/lib/data/targets-store"
import type { SalesSnapshot } from "@/lib/data/sales-types"

/** Odoo is polled at most every 15 minutes; the page is otherwise static. */
export const revalidate = 900

export default async function SalesModulePage() {
  const targets = await readTargets()

  let snapshot: SalesSnapshot
  try {
    snapshot = await fetchSalesSnapshot()
  } catch (error) {
    snapshot = {
      designers: [],
      leads: [],
      companies: [],
      syncedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Could not reach Odoo.",
    }
  }

  return <SalesModule snapshot={snapshot} targets={targets} />
}
