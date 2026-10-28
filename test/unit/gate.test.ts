import assert from "node:assert/strict"
import { test } from "node:test"

import { gate } from "../../lib/gate.ts"
import { signSession } from "../../lib/session.ts"
import { checkedRecently, writeSso } from "../../lib/sso.ts"

// Keycloak "down": nothing listens on port 9.
process.env.HUB_ISSUER = "http://localhost:9/realms/modula"
process.env.HUB_CLIENT_ID = "kpi-tracker"
process.env.HUB_CLIENT_SECRET = "x"
process.env.HUB_URL = "http://localhost:3100"
process.env.AUTH_SECRET = "unit-test-secret-unit-test-secret-1234"

const ssoSession = () => signSession({ email: "u@test.local", role: "viewer", sub: "u1" })
const sso = (checkedAt: number, sub = "u1") => writeSso({ sub, idToken: "i", refreshToken: "r", checkedAt })
const signedOut = (location: string, clear: boolean) => ({
  kind: "deny",
  status: 401,
  error: "unauthenticated",
  location,
  clear,
})

test("no session: 401, back to /login with next", async () => {
  assert.deepEqual(await gate({ pathname: "/scorecard", search: "?ec=1" }), signedOut("/login?next=%2Fscorecard%3Fec%3D1", false))
  assert.deepEqual(await gate({ pathname: "/", search: "" }), signedOut("/login", false))
})

test("a forged or garbled session cookie is a 401 and is cleared", async () => {
  const [payload, signature] = (await ssoSession()).split(".")
  const forged = `${Buffer.from(JSON.stringify({ email: "x@test.local", role: "admin", exp: Date.now() + 1e6 })).toString("base64url")}.${signature}`
  for (const session of [forged, `${payload}.AAAA`, "garbage"]) {
    assert.deepEqual(await gate({ pathname: "/", search: "", session }), signedOut("/login", true))
  }
})

test("an expired session is a 401 and is cleared", async () => {
  const session = await signSession({ email: "u@test.local", role: "viewer", sub: "u1" }, -1)
  assert.deepEqual(await gate({ pathname: "/", search: "", session, sso: sso(Date.now()) }), signedOut("/login", true))
})

test("a local password session (no sub) passes without asking Keycloak (spec D4)", async () => {
  const session = await signSession({ email: "local@test.local", role: "admin" })
  assert.deepEqual(await gate({ pathname: "/admin/data", search: "", session }), { kind: "pass" })
})

test("a fresh SSO session passes without asking Keycloak", async () => {
  assert.deepEqual(await gate({ pathname: "/", search: "", session: await ssoSession(), sso: sso(Date.now() - 299_000) }), {
    kind: "pass",
  })
})

test("an SSO session whose kpi_sso cookie is missing, tampered or another user's is a 401 and is cleared", async () => {
  const session = await ssoSession()
  const sealed = Buffer.from(sso(Date.now()), "base64url")
  sealed[sealed.length - 1] ^= 1
  for (const value of [undefined, sealed.toString("base64url"), "garbage", sso(Date.now(), "someone-else")]) {
    assert.deepEqual(await gate({ pathname: "/", search: "", session, sso: value }), signedOut("/login", true))
  }
})

test("a stale SSO session while Keycloak is unreachable is never a pass: 503, session kept", async () => {
  const session = await ssoSession()
  const expected = { kind: "deny", status: 503, error: "auth_unavailable", location: "/unavailable?next=%2Fscorecard", clear: false }
  assert.deepEqual(await gate({ pathname: "/scorecard", search: "", session, sso: sso(Date.now() - 300_000) }), expected)
  assert.deepEqual(await gate({ pathname: "/scorecard", search: "", session, sso: sso(0) }), expected)
})

test("server actions accept an SSO session only if it was checked in the last 5 minutes", () => {
  const now = Date.now()
  assert.equal(checkedRecently(sso(now - 299_000), "u1", now), true)
  assert.equal(checkedRecently(sso(now - 300_000), "u1", now), false, "stale: the proxy did not renew it for this request")
  assert.equal(checkedRecently(sso(now, "someone-else"), "u1", now), false)
  assert.equal(checkedRecently("garbage", "u1", now), false)
  assert.equal(checkedRecently(undefined, "u1", now), false)
})
