/**
 * The running app while Keycloak is unreachable: `npm run test:e2e` restarts it with HUB_ISSUER on a
 * closed port for this file (the shared local Keycloak is never stopped). Sessions are minted here
 * with the app's AUTH_SECRET, since nobody can sign in through a Keycloak that is down.
 */
import assert from "node:assert/strict"
import { before, test } from "node:test"

import { SESSION, signSession } from "../../lib/session.ts"
import { writeSso } from "../../lib/sso.ts"
import { go, Jar, submitForm } from "../helpers/browser.ts"

const APP = new URL(process.env.HUB_REDIRECT_URI!).origin

async function ssoJar(checkedAt: number) {
  const jar = new Jar()
  jar.set("kpi_session", await signSession({ email: "outage@test.local", role: "admin", sub: "u-outage" }, SESSION.hubMaxAge))
  jar.set("kpi_sso", writeSso({ sub: "u-outage", idToken: "id", refreshToken: "rt", checkedAt }))
  return jar
}
const stale = () => ssoJar(Date.now() - 301_000)

before(async () => {
  const res = await fetch(`${APP}/auth/hub`, { redirect: "manual" }).catch(() => null)
  const location = res?.headers.get("location") ?? ""
  if (!location.includes("/unavailable")) throw new Error(`The app at ${APP} is not in outage mode; use npm run test:e2e`)
})

test("Google sign-in cannot start: the 503 page, not an error", async () => {
  const res = await go(`${APP}/auth/hub?next=%2Fscorecard`, new Jar())
  assert.equal(new URL(res.headers.get("location")!, APP).href, `${APP}/unavailable?next=%2Fscorecard`)
})

test("a stale SSO session goes to the sign-in-unavailable page; access is not extended and the session is kept", async () => {
  const jar = await stale()
  const res = await go(`${APP}/scorecard`, jar)
  assert.equal(res.status, 303)
  assert.equal(new URL(res.headers.get("location")!, APP).href, `${APP}/unavailable?next=%2Fscorecard`)
  assert.ok(jar.get("kpi_session") && jar.get("kpi_sso"), "kept, so it works again once Keycloak is back")
  const page = await go(`${APP}/unavailable?next=%2Fscorecard`, jar)
  assert.equal(page.status, 200)
  const html = await page.text()
  assert.match(html, /Sign-in service unavailable/)
  assert.match(html, /href="\/scorecard"/)
})

test("APIs get 503 JSON; fetches from the page get a plain 503", async () => {
  const api = await go(`${APP}/api/anything`, await stale())
  assert.equal(api.status, 503)
  assert.deepEqual(await api.json(), { error: "auth_unavailable" })
  const rsc = await go(`${APP}/scorecard`, await stale(), { headers: { "sec-fetch-dest": "empty" } })
  assert.equal(rsc.status, 503)
  assert.equal(rsc.headers.get("location"), null)
})

test("inside the 5-minute window an SSO session still works; a password session is not affected at all", async () => {
  assert.equal((await go(`${APP}/scorecard`, await ssoJar(Date.now()))).status, 200)
  const local = new Jar()
  local.set("kpi_session", await signSession({ email: process.env.AUTH_EMAIL!, role: "admin" }))
  assert.equal((await go(`${APP}/scorecard`, local)).status, 200)
})

test("signing out still works and lands on /login", async () => {
  const jar = await stale()
  const res = await submitForm(`${APP}/unavailable`, jar)
  assert.equal(res.status, 303)
  assert.equal(new URL(res.headers.get("location")!, APP).href, `${APP}/login`)
  assert.equal(jar.get("kpi_session"), undefined)
  assert.equal(jar.get("kpi_sso"), undefined)
})
