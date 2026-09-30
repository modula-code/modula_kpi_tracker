/** Run: npx tsx lib/data/query.test.ts */
import assert from "node:assert/strict"
import { createQueries, type Filters, type Viewer } from "./query"
import { ECS } from "./seed"
import { EMPTY_TARGET_CONFIG } from "./sales-metrics"
import type { SalesLead, SalesSnapshot } from "./sales-types"

const ec = ECS[0].id
const otherEc = ECS[1].id
const lead = (overrides: Partial<SalesLead>): SalesLead => ({
  id: 1, name: "Test lead", designer: "stored-name", designerLabel: "Display Name",
  company: ECS[0].name, ecId: ec, referral: true, source: null, walkin: false,
  created: "2026-09-01", stage: "Confirmed", booked: true, bookedOn: "2026-09-02",
  order: "SO1", amount: 1000, lost: false, ...overrides,
})
const snapshot: SalesSnapshot = {
  designers: ["stored-name"], companies: [], syncedAt: "2026-09-08",
  leads: [
    lead({}),
    lead({ id: 2, created: "2026-08-01", amount: 2000 }),
    lead({ id: 3, ecId: otherEc, amount: 9000 }),
    lead({ id: 4, booked: false, bookedOn: null, order: null, amount: 0 }),
    lead({ id: 5, referral: false, amount: 8000 }),
    lead({ id: 6, designer: "", designerLabel: "", booked: false, bookedOn: null }),
    lead({ id: 7, created: "2026-10-01", bookedOn: "2026-10-01" }),
  ],
}
const viewer: Viewer = { role: "head", designerId: "stored-name", managerId: "" }
const filters: Filters = { periodId: "2026-M09", designerId: "all", ecId: ec, managerId: "all" }
const slab = { ratePerConvertedReferral: 100, percentOfReferredOrderValue: 10, minimumConversions: 2 }
const queries = createQueries(snapshot, EMPTY_TARGET_CONFIG, ec)
assert.equal(queries.designers[0].name, "Display Name")
assert.equal(queries.designers[0].ecIds?.length, 2)
assert.equal(queries.ecsVisibleTo({ ...viewer, role: "designer" }).length, 2)
assert.deepEqual(queries.designersVisibleTo({ ...viewer, role: "manager" }), [])
assert.deepEqual(queries.ecsVisibleTo({ ...viewer, role: "manager" }), [])
assert.equal(ECS.length, 13)
const mapped = createQueries(snapshot, EMPTY_TARGET_CONFIG, "all", {
  managers: [{ id: "m1", name: "Asha", title: "ASM", initials: "A" }],
  ecManagers: { [ec]: "m1" }, auditTickets: [], circleMembers: [],
})
assert.deepEqual(mapped.ecsForManager("m1").map((e) => e.id), [ec])
assert.equal(mapped.designersVisibleTo({ ...viewer, role: "manager", managerId: "m1" }).length, 1)
const rows = queries.payoutRows(viewer, filters, slab)
const assigned = rows.find((row) => row.designerId === "stored-name")!
assert.equal(assigned.leads, 2)
assert.equal(assigned.converted, 2) // Includes August's referral booked in September.
assert.equal(assigned.referredOrderValue, 3000) // Excludes other EC and non-referral.
assert.equal(assigned.total, 500)
assert.equal(rows.find((row) => row.designerId === "")?.leads, 1)
assert.equal(queries.referralLeads({ ...viewer, role: "designer" }, filters).some((row) => !row.designer), false)
assert.equal(queries.payoutRows(viewer, filters, { ...slab, minimumConversions: 3 })[0].total, 0)
const empty = createQueries({ ...snapshot, leads: [], designers: [], error: "Offline" }, EMPTY_TARGET_CONFIG)
assert.deepEqual(empty.payoutRows(viewer, filters, slab), [])
assert.equal(empty.rollupScorecard([], { id: "2026-M09", label: "September", granularity: "month", months: ["2026-M09"], order: 0, scale: 1, wobble: 1 }).final, null)
console.log("Live directory, referral payouts, period/EC scoping, and empty-data checks passed.")
