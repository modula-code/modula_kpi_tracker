import assert from "node:assert/strict"
import { test } from "node:test"

import { pickRole, refresh, safeNext, ssoConfigured } from "../../lib/sso.ts"

// Nothing listens on port 9: discovery fails like a Keycloak outage.
process.env.HUB_ISSUER = "http://localhost:9/realms/modula"
process.env.HUB_CLIENT_ID = "kpi-tracker"
process.env.HUB_CLIENT_SECRET = "x"

const claims = (resource_access?: Record<string, { roles?: string[] }>, extra: Record<string, unknown> = {}) => ({
  sub: "u1",
  resource_access,
  ...extra,
})

test("roles come only from this app's own client", () => {
  assert.equal(pickRole(claims({ "kpi-tracker": { roles: ["viewer"] } })), "viewer")
  assert.equal(pickRole(claims({ "logistic-dashboard": { roles: ["admin"] }, "kpi-tracker": { roles: ["viewer"] } })), "viewer")
  assert.equal(pickRole(claims({ "logistic-dashboard": { roles: ["admin"] } })), null, "another app's admin grants nothing")
  assert.equal(pickRole(claims({ "design-dashboard": { roles: ["admin", "viewer"] } })), null)
  assert.equal(pickRole(claims(undefined, { realm_access: { roles: ["admin", "hub-admin"] } })), null, "realm roles grant nothing")
  assert.equal(pickRole(claims(undefined, { roles: ["admin"] })), null, "a top-level roles claim grants nothing")
  assert.equal(pickRole(claims()), null)
  assert.equal(pickRole(claims({ "kpi-tracker": {} })), null)
})

test("with several roles the first in the priority list wins; unknown roles are ignored", () => {
  assert.equal(pickRole(claims({ "kpi-tracker": { roles: ["viewer", "admin"] } })), "admin")
  assert.equal(pickRole(claims({ "kpi-tracker": { roles: ["admin", "viewer"] } })), "admin")
  assert.equal(pickRole(claims({ "kpi-tracker": { roles: ["superadmin", "viewer"] } })), "viewer")
  assert.equal(pickRole(claims({ "kpi-tracker": { roles: ["superadmin", "Admin"] } })), null)
})

test("the role is read under HUB_CLIENT_ID, not a hard-coded id", () => {
  const saved = process.env.HUB_CLIENT_ID
  process.env.HUB_CLIENT_ID = "kpi-tracker-staging"
  try {
    assert.equal(pickRole(claims({ "kpi-tracker": { roles: ["admin"] } })), null)
    assert.equal(pickRole(claims({ "kpi-tracker-staging": { roles: ["admin"] } })), "admin")
  } finally {
    process.env.HUB_CLIENT_ID = saved
  }
})

test("next must be a same-site path: starts with / and not //", () => {
  assert.equal(safeNext("/scorecard?ec=1#top"), "/scorecard?ec=1#top")
  assert.equal(safeNext("/"), "/")
  assert.equal(safeNext("//evil.example"), "/")
  assert.equal(safeNext("//evil.example/scorecard"), "/")
  assert.equal(safeNext("/\\evil.example"), "/")
  assert.equal(safeNext("/\t/evil.example"), "/")
  assert.equal(safeNext("/\n/evil.example"), "/")
  assert.equal(safeNext("https://evil.example"), "/")
  assert.equal(safeNext("javascript:alert(1)"), "/")
  assert.equal(safeNext("scorecard"), "/")
  assert.equal(safeNext("//["), "/")
  assert.equal(safeNext(""), "/")
  assert.equal(safeNext(null), "/")
  assert.equal(safeNext(undefined), "/")
})

test("Keycloak unreachable is 'unavailable', never a session", async () => {
  assert.deepEqual(await refresh("any-refresh-token"), { status: "unavailable" })
})

test("SSO counts as configured only with every HUB_* variable", () => {
  const names = ["HUB_ISSUER", "HUB_CLIENT_ID", "HUB_CLIENT_SECRET", "HUB_REDIRECT_URI", "HUB_POST_LOGOUT_URI", "HUB_URL"]
  const saved = Object.fromEntries(names.map((n) => [n, process.env[n]]))
  try {
    for (const n of names) process.env[n] ||= "http://localhost:9/x"
    assert.equal(ssoConfigured(), true)
    for (const n of names) {
      const value = process.env[n]
      delete process.env[n]
      assert.equal(ssoConfigured(), false, `${n} missing`)
      process.env[n] = value
    }
  } finally {
    for (const n of names) {
      if (saved[n] === undefined) delete process.env[n]
      else process.env[n] = saved[n]
    }
  }
})
