import { DataEntry } from "@/components/admin/data-entry"
import { readAdminData } from "@/lib/data/admin-store"

export const metadata = { title: "Data Entry · Design Team KPI Dashboard" }

export default async function DataEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const [{ tab }, data] = await Promise.all([searchParams, readAdminData()])
  return <DataEntry data={data} tab={tab} />
}
