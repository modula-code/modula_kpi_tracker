/**
 * The revocation table (spec §1) and login/logout against the local Keycloak, through this app's
 * own `kpi-tracker` client and the real code flow (fake Google = the local `upstream` realm).
 */
import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import * as client from "openid-client"

import { gate } from "../../lib/gate.ts"
import { verifySession } from "../../lib/session.ts"
import {
  finishLogin,
  isCancelled,
  logoutUrl,
  oidcConfig,
  pickRole,
  readSso,
  refresh,
  sessionCookies,
  SSO_COOKIE,
  startLogin,
  writeSso,
} from "../../lib/sso.ts"
import { go, signIn, ssoLogin } from "../helpers/browser.ts"
import * as kc from "../helpers/kc.ts"

before(kc.ensureUpstream)
after(kc.cleanup)

const APP = "kpi-tracker"
const NO_ACCESS = `${process.env.HUB_URL}/no-access?app=${APP}`

/** A fresh user holding `roles`, signed in; `cookies` are what the callback sets. */
async function signedIn(name: string, roles: string[]) {
  const email = kc.freshEmail(name)
  const id = await kc.userWith(email, APP, roles)
  const { jar, tokens } = await ssoLogin(email)
  const role = pickRole(tokens.claims)
  assert.ok(role, "signed in with a grant")
  return { id, email, jar, tokens, cookies: await sessionCookies(tokens, role) }
}

/** The same cookies with the last check older than 5 minutes. */
function stale(cookies: { session: string; sso: string }) {
  return { session: cookies.session, sso: writeSso({ ...readSso(cookies.sso)!, checkedAt: Date.now() - 301_000 }) }
}

const check = (c: { session: string; sso: string }) => gate({ pathname: "/scorecard", search: "", ...c })
const SIGNED_OUT = { kind: "deny", status: 401, error: "unauthenticated", location: "/login?next=%2Fscorecard", clear: true }

test("login goes straight to Google with PKCE S256, state, nonce and this app's exact redirect URI", async () => {
  const { url, flow } = await startLogin("/scorecard")
  const p = url.searchParams
  assert.equal(url.origin + url.pathname, `${process.env.HUB_ISSUER}/protocol/openid-connect/auth`)
  assert.equal(p.get("client_id"), APP)
  assert.equal(p.get("response_type"), "code")
  assert.equal(p.get("scope"), "openid email profile")
  assert.equal(p.get("redirect_uri"), process.env.HUB_REDIRECT_URI)
  assert.equal(p.get("kc_idp_hint"), "google")
  assert.equal(p.get("code_challenge_method"), "S256")
  assert.equal(p.get("code_challenge"), await client.calculatePKCECodeChallenge(flow.verifier))
  assert.equal(p.get("state"), flow.state)
  assert.equal(p.get("nonce"), flow.nonce)
  assert.equal(flow.next, "/scorecard")
  assert.equal((await startLogin("//evil.example")).flow.next, "/")
})

test("a viewer signs in: the session carries email, role and sub, and both cookies fit", async () => {
  const { id, email, cookies } = await signedIn("viewer", ["viewer"])
  assert.deepEqual(await verifySession(cookies.session), { email, role: "viewer", sub: id })
  const sso = readSso(cookies.sso)!
  assert.equal(sso.sub, id)
  assert.ok(Date.now() - sso.checkedAt < 10_000)
  assert.ok(`${SSO_COOKIE}=${cookies.sso}`.length < 4000, `kpi_sso is ${cookies.sso.length} bytes`)
  assert.deepEqual(await check(cookies), { kind: "pass" }, "a fresh session is not re-checked")
})

test("with both roles the session gets admin; another app's role alone gives no role", async () => {
  const both = await signedIn("both", ["viewer", "admin"])
  assert.equal((await verifySession(both.cookies.session))?.role, "admin")

  const email = kc.freshEmail("other-app")
  const id = await kc.modulaUser(email)
  await kc.grant(id, "logistic-dashboard", "admin")
  await kc.googleAccount(email)
  const { tokens } = await ssoLogin(email)
  assert.deepEqual(Object.keys(tokens.claims.resource_access ?? {}), [], "the ID token carries no other client's roles")
  assert.equal(pickRole(tokens.claims), null)
})

test("ok: a stale session with its role intact is re-checked and renewed", async () => {
  const { id, email, cookies } = await signedIn("active", ["viewer"])
  const decision = await check(stale(cookies))
  assert.equal(decision.kind, "pass")
  const renewed = decision.kind === "pass" ? decision.cookies : undefined
  assert.ok(renewed, "new cookies to store")
  assert.deepEqual(await verifySession(renewed.session), { email, role: "viewer", sub: id })
  assert.ok(Date.now() - readSso(renewed.sso)!.checkedAt < 10_000, "checkedAt = now")
})

test("ok: a role changed in the hub (admin → viewer) is picked up at the next check", async () => {
  const { id, cookies } = await signedIn("demoted", ["admin"])
  await kc.ungrant(id, APP, "admin")
  await kc.grant(id, APP, "viewer")
  const decision = await check(stale(cookies))
  assert.equal(decision.kind === "pass" && (await verifySession(decision.cookies?.session))?.role, "viewer")
})

test("no role: a revoked user gets 403 → the hub's no-access page, and the session ends", async () => {
  const { id, cookies } = await signedIn("revoked", ["viewer"])
  await kc.ungrant(id, APP, "viewer")
  assert.deepEqual(await check(cookies), { kind: "pass" }, "inside the 5-minute window nothing is asked")
  assert.deepEqual(await check(stale(cookies)), { kind: "deny", status: 403, error: "forbidden", location: NO_ACCESS, clear: true })
})

test("invalid_grant: a user disabled centrally is signed out (401)", async () => {
  const { id, cookies } = await signedIn("suspended", ["admin"])
  await kc.disable(id)
  assert.deepEqual(await check(stale(cookies)), SIGNED_OUT)
})

test("invalid_grant: a user logged out by the hub (suspend/revoke) is signed out (401)", async () => {
  const { id, cookies } = await signedIn("kicked", ["viewer"])
  await kc.logoutUser(id)
  assert.deepEqual(await check(stale(cookies)), SIGNED_OUT)
})

test("network error or 5xx at the check: 503, access is not extended and the session is kept", async () => {
  const { cookies } = await signedIn("outage", ["viewer"])
  const cfg = await oidcConfig() // discovered while Keycloak was up; now it "goes down"
  const saved = cfg[client.customFetch]
  const outages: client.CustomFetch[] = [
    async () => {
      throw new TypeError("fetch failed")
    },
    async () => new Response("<html>Bad Gateway</html>", { status: 502, headers: { "content-type": "text/html" } }),
    async () => Response.json({ error: "server_error" }, { status: 500 }),
  ]
  for (const outage of outages) {
    cfg[client.customFetch] = outage
    try {
      assert.deepEqual(await check(stale(cookies)), {
        kind: "deny",
        status: 503,
        error: "auth_unavailable",
        location: "/unavailable?next=%2Fscorecard",
        clear: false,
      })
    } finally {
      cfg[client.customFetch] = saved as client.CustomFetch // undefined = global fetch again
    }
  }
  assert.equal((await check(stale(cookies))).kind, "pass", "back once Keycloak answers")
})

test("logout: the end-session URL carries id_token_hint and the exact post-logout URI, and ends the central session", async () => {
  const { id, jar, tokens } = await signedIn("leaver", ["viewer"])
  const url = await logoutUrl(tokens.idToken)
  assert.equal(url.searchParams.get("id_token_hint"), tokens.idToken)
  assert.equal(url.searchParams.get("post_logout_redirect_uri"), process.env.HUB_POST_LOGOUT_URI)
  const out = await go(url, jar)
  assert.equal(out.headers.get("location"), process.env.HUB_POST_LOGOUT_URI)
  assert.equal(await kc.sessionCount(id), 0)
  assert.deepEqual(await refresh(tokens.refreshToken), { status: "ended" })
})

test("a callback carrying error=access_denied is a cancellation, other errors are failures", async () => {
  const { flow } = await startLogin("/")
  const iss = encodeURIComponent(process.env.HUB_ISSUER!)
  await assert.rejects(finishLogin(`?error=access_denied&state=${flow.state}&iss=${iss}`, flow), (e) => isCancelled(e))
  await assert.rejects(finishLogin(`?error=server_error&state=${flow.state}&iss=${iss}`, flow), (e) => !isCancelled(e))
})

test("a callback whose state or nonce does not match the login is refused", async () => {
  const email = kc.freshEmail("mixup")
  await kc.userWith(email, APP, ["viewer"])
  const redirect = process.env.HUB_REDIRECT_URI!

  const a = await startLogin("/")
  const { url: callbackA } = await signIn(a.url, email, { stopAt: redirect })
  await assert.rejects(finishLogin(callbackA.search, { ...a.flow, state: "another-state" }))

  const b = await startLogin("/")
  const { url: callbackB, jar } = await signIn(b.url, email, { stopAt: redirect })
  await assert.rejects(finishLogin(callbackB.search, { ...b.flow, nonce: "another-nonce" }))

  const c = await startLogin("/")
  const { url: callbackC } = await signIn(c.url, email, { jar, stopAt: redirect })
  await assert.rejects(finishLogin(callbackC.search, { ...c.flow, verifier: client.randomPKCECodeVerifier() }))
})
