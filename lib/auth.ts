/**
 * Server-side auth helpers. The session cookie itself is in lib/session.ts (no Next imports, so
 * proxy.ts and `node --test` can use it); it is re-exported here for existing imports.
 */

import { cookies } from "next/headers"

import { SESSION, verifySession } from "./session"
import { checkedRecently, SSO_COOKIE } from "./sso"

export { SESSION, signSession, verifySession, type Role, type Session } from "./session"

/**
 * Every write goes through this; viewers can read everything but change nothing. An SSO session
 * must also have been confirmed by Keycloak in the last 5 minutes: proxy.ts renews it before every
 * request it lets through, so a stale one here means the re-check did not run for this request
 * (e.g. an action posted to a public page) and the role may have been revoked since.
 */
export async function requireAdmin() {
  const store = await cookies()
  const session = await verifySession(store.get(SESSION.cookie)?.value)
  if (session?.sub && !checkedRecently(store.get(SSO_COOKIE)?.value, session.sub)) {
    throw new Error("Your sign-in needs a fresh check. Reload the page and try again.")
  }
  if (session?.role !== "admin") throw new Error("Only an admin can change data.")
}
