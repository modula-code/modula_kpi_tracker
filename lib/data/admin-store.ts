import "server-only"

import { promises as fs } from "node:fs"
import path from "node:path"

import { EMPTY_ADMIN_DATA, type AdminData } from "@/lib/data/types"

/**
 * Hand-entered data for the modules Odoo doesn't cover: managers, EC → manager
 * mapping, audit tickets and Circle members. Same JSON-file approach as targets.
 * ponytail: whole-file rewrite per save, single writer. Move to a DB table if
 * several people start entering data at once.
 */
const FILE = path.join(process.cwd(), "data", "admin-data.json")

export async function readAdminData(): Promise<AdminData> {
  try {
    return { ...EMPTY_ADMIN_DATA, ...JSON.parse(await fs.readFile(FILE, "utf8")) }
  } catch {
    return EMPTY_ADMIN_DATA
  }
}

export async function updateAdminData(change: (data: AdminData) => AdminData): Promise<void> {
  const next = change(await readAdminData())
  await fs.mkdir(path.dirname(FILE), { recursive: true })
  await fs.writeFile(FILE, `${JSON.stringify(next, null, 2)}\n`, "utf8")
}
