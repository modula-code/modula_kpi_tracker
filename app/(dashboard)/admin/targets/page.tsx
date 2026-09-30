import { TargetsForm } from "@/components/admin/targets-form"
import { fetchSalesSnapshot } from "@/lib/data/sales-source"
import { readTargets } from "@/lib/data/targets-store"

export const metadata = { title: "Target Setting · Design Team KPI Dashboard" }

export default async function TargetSettingPage() {
  const targets = await readTargets()

  let designers: string[] = []
  let error: string | undefined
  try {
    designers = (await fetchSalesSnapshot()).designers
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not reach Odoo."
  }

  return <TargetsForm designers={designers} targets={targets} error={error} />
}
