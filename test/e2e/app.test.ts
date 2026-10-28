/**
 * The running app (proxy.ts, /auth/hub, the logout and password-login actions) against the local
 * Keycloak. Start it with `npm run test:e2e`, which runs `next dev` on :3003 with test/local.env.
 */
import assert from "node:assert/strict"
import { after, before, test } from "node:test"

import { verifySession } from "../../lib/session.ts"
import { readFlow, readSso, refresh, writeSso } from "../../lib/sso.ts"
import { go, Jar, signIn, submitForm } from "../helpers/browser.ts"
import * as kc from "../helpers/kc.ts"

const APP = new URL(process.env.HUB_REDIRECT_URI!).origin
const NO_ACCESS = `${process.env.HUB_URL}/no-access?app=kpi-tracker`

before(async () => {
  await kc.ensureUpstream()
  const res = await fetch(`${APP}/login`).catch(() => null)
  if (!res?.ok) throw new Error(`The app is not running at ${APP}; use npm run test:e2e`)
})
after(kc.cleanup)

/** Signs in through the app's own /auth/hub and lands on `next`. */
async function appLogin(roles: string[], next = "/scorecard") {
  const email = kc.freshEmail("e2e")
  const id = await kc.userWith(email, "kpi-tracker", roles)
  const { jar, url, response } = await signIn(`${APP}/auth/hub?next=${encodeURIComponent(next)}`, email)
  assert.equal(url.href, `${APP}${next}`)
  assert.equal(response?.status, 200)
  return { id, email, jar }
}

/** Pretends the last check was more than 5 minutes ago (the test knows AUTH_SECRET). */
function makeStale(jar: Jar) {
  const sso = readSso(jar.get("kpi_sso"))
  assert.ok(sso, "kpi_sso is set")
  jar.set("kpi_sso", writeSso({ ...sso, checkedAt: Date.now() - 301_000 }))
}

test("Google login with a grant lands on the requested page; the session carries role and sub", async () => {
  const { id, email, jar } = await appLogin(["viewer"])
  assert.deepEqual(await verifySession(jar.get("kpi_session")), { email, role: "viewer", sub: id })
  assert.equal(readSso(jar.get("kpi_sso"))?.sub, id)
  assert.equal(jar.get("kpi_hub_flow"), undefined, "the login flow cookie is gone")
})

test("an off-site next after login is replaced by /", async () => {
  const email = kc.freshEmail("e2e-next")
  await kc.userWith(email, "kpi-tracker", ["viewer"])
  const { url } = await signIn(`${APP}/auth/hub?next=${encodeURIComponent("//evil.example/x")}`, email, {
    stopAt: "http://evil.example",
  })
  assert.equal(url.href, `${APP}/`)
})

test("Google login cancelled (error=access_denied) or with a lost flow cookie returns to /login with an error", async () => {
  const jar = new Jar()
  await go(`${APP}/auth/hub?next=%2Fscorecard`, jar)
  const flow = readFlow(jar.get("kpi_hub_flow"))
  assert.ok(flow, "the sealed flow cookie is set")
  const iss = encodeURIComponent(process.env.HUB_ISSUER!)
  const cancelled = await go(`${APP}/auth/hub?error=access_denied&state=${flow.state}&iss=${iss}`, jar)
  assert.equal(new URL(cancelled.headers.get("location")!, APP).href, `${APP}/login?error=cancelled`)
  assert.equal(jar.get("kpi_session"), undefined)
  const lost = await go(`${APP}/auth/hub?code=x&state=${flow.state}&iss=${iss}`, new Jar())
  assert.equal(new URL(lost.headers.get("location")!, APP).href, `${APP}/login?error=expired`)
  const html = await (await go(`${APP}/login?error=cancelled`, new Jar())).text()
  assert.match(html, /Google sign-in was cancelled/)
})

test("Google login without this app's role goes to the hub's no-access page and sets no session", async () => {
  const email = kc.freshEmail("e2e-none")
  const id = await kc.modulaUser(email)
  await kc.grant(id, "logistic-dashboard", "admin") // another app's role grants nothing here
  await kc.googleAccount(email)
  const { jar, url } = await signIn(`${APP}/auth/hub`, email, { stopAt: process.env.HUB_URL })
  assert.equal(url.href, NO_ACCESS)
  assert.equal(jar.get("kpi_session"), undefined)
  assert.equal(jar.get("kpi_sso"), undefined)
})

test("revoked mid-session: kept until the check is due, then sent to no-access with the session ended", async () => {
  const { id, jar } = await appLogin(["viewer"])
  await kc.ungrant(id, "kpi-tracker", "viewer")
  assert.equal((await go(`${APP}/`, jar)).status, 200, "within 5 minutes of the last check")
  makeStale(jar)
  const res = await go(`${APP}/scorecard`, jar)
  assert.equal(res.status, 303)
  assert.equal(res.headers.get("location"), NO_ACCESS)
  assert.equal(jar.get("kpi_session"), undefined)
  assert.equal(jar.get("kpi_sso"), undefined)
})

test("revoked, seen first by a client-side navigation or action: plain 403 and no redirect; the page load that follows goes to no-access", async () => {
  const { id, jar } = await appLogin(["admin"])
  await kc.ungrant(id, "kpi-tracker", "admin")
  makeStale(jar)
  // A redirect here would be followed by fetch(): an action re-sent to a public page, or a CORS failure on the hub.
  const navigation = await go(`${APP}/scorecard`, jar, { headers: { rsc: "1", "sec-fetch-dest": "empty" } })
  assert.equal(navigation.status, 403)
  assert.equal(navigation.headers.get("location"), null)
  const action = await go(`${APP}/admin/targets`, jar, {
    method: "POST",
    headers: { "next-action": "0".repeat(42), "sec-fetch-dest": "empty" },
  })
  assert.equal(action.status, 403)
  assert.equal(action.headers.get("location"), null)
  assert.ok(jar.get("kpi_session"), "kept, so the full page load can tell revoked from signed out")
  // The full page load (here a form post without JS) gets the redirect, as a GET (303).
  const page = await go(`${APP}/admin/targets`, jar, { method: "POST", body: new FormData() })
  assert.equal(page.status, 303)
  assert.equal(page.headers.get("location"), NO_ACCESS)
  assert.equal(jar.get("kpi_session"), undefined)
})

test("suspended centrally: the next check signs the user out (401 → login)", async () => {
  const { id, jar } = await appLogin(["admin"])
  await kc.disable(id)
  makeStale(jar)
  const res = await go(`${APP}/scorecard`, jar)
  assert.equal(res.status, 303)
  assert.equal(new URL(res.headers.get("location")!, APP).href, `${APP}/login?next=%2Fscorecard`)
  assert.equal(jar.get("kpi_session"), undefined)
  assert.equal(jar.get("kpi_sso"), undefined)
})

test("APIs get JSON errors: 401 without a session, 401 after a central suspend", async () => {
  const anonymous = await go(`${APP}/api/anything`, new Jar())
  assert.equal(anonymous.status, 401)
  assert.deepEqual(await anonymous.json(), { error: "unauthenticated" })

  const { id, jar } = await appLogin(["viewer"])
  await kc.logoutUser(id)
  makeStale(jar)
  const res = await go(`${APP}/api/anything`, jar)
  assert.equal(res.status, 401)
  assert.deepEqual(await res.json(), { error: "unauthenticated" })
})

test("a renewed session reaches the page in the same request", async () => {
  const { id, email, jar } = await appLogin(["viewer"], "/")
  const renamed = kc.freshEmail("e2e-renamed")
  const user = await kc.adminJson<Record<string, unknown>>(`/${kc.REALM}/users/${id}`)
  await kc.adminJson(`/${kc.REALM}/users/${id}`, { method: "PUT", body: JSON.stringify({ ...user, email: renamed }) })
  makeStale(jar)
  const res = await go(`${APP}/`, jar)
  assert.equal(res.status, 200)
  const html = await res.text()
  assert.ok(html.includes(renamed) && !html.includes(email), "the layout read the renewed cookie, not the old one")
  assert.equal((await verifySession(jar.get("kpi_session")))?.email, renamed)
  assert.ok(Date.now() - readSso(jar.get("kpi_sso"))!.checkedAt < 10_000)
})

test("logout clears the app session and ends the Keycloak session (RP-initiated)", async () => {
  const { id, jar } = await appLogin(["viewer"])
  const refreshToken = readSso(jar.get("kpi_sso"))!.refreshToken
  // The sign-out form on /unavailable posts the same logout action as the sidebar menu.
  const res = await submitForm(`${APP}/unavailable`, jar)
  assert.equal(res.status, 303)
  const endSession = new URL(res.headers.get("location")!)
  assert.equal(endSession.origin + endSession.pathname, `${process.env.HUB_ISSUER}/protocol/openid-connect/logout`)
  assert.equal(endSession.searchParams.get("post_logout_redirect_uri"), process.env.HUB_POST_LOGOUT_URI)
  assert.ok(endSession.searchParams.get("id_token_hint"))
  assert.equal(jar.get("kpi_session"), undefined)
  assert.equal(jar.get("kpi_sso"), undefined)
  const back = await go(endSession, jar)
  assert.equal(back.headers.get("location"), process.env.HUB_POST_LOGOUT_URI)
  assert.equal(await kc.sessionCount(id), 0)
  assert.deepEqual(await refresh(refreshToken), { status: "ended" })
})

test("the local password login still works and never asks Keycloak (spec D4)", async () => {
  const jar = new Jar()
  const res = await submitForm(`${APP}/login`, jar, {
    email: process.env.AUTH_EMAIL!,
    password: process.env.AUTH_PASSWORD!,
    next: "/scorecard",
  })
  assert.equal(res.status, 303)
  assert.equal(res.headers.get("location"), "/scorecard")
  const session = await verifySession(jar.get("kpi_session"))
  assert.deepEqual(session, { email: process.env.AUTH_EMAIL, role: "admin" })
  assert.equal((await go(`${APP}/scorecard`, jar)).status, 200)
})

test("the password login refuses an off-site next", async () => {
  const res = await submitForm(`${APP}/login`, new Jar(), {
    email: process.env.AUTH_EMAIL!,
    password: process.env.AUTH_PASSWORD!,
    next: "//evil.example",
  })
  assert.equal(res.headers.get("location"), "/")
})
