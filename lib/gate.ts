import { verifySession } from "./session.ts"
import { noAccessUrl, pickRole, readSso, RECHECK_SECONDS, refresh, sessionCookies } from "./sso.ts"

export type Denied = {
  kind: "deny"
  status: 401 | 403 | 503
  error: "unauthenticated" | "forbidden" | "auth_unavailable"
  /** Where a page request goes: /login, the hub's no-access page, or /unavailable. */
  location: string
  /** End the app session (delete kpi_session and kpi_sso). */
  clear: boolean
}
/** `cookies`: renewed values to store after a successful re-check. */
export type Decision = { kind: "pass"; cookies?: { session: string; sso: string } } | Denied

/**
 * Runs before every protected request (proxy.ts). Local password sessions pass as before (spec D4).
 * An SSO session whose last check is RECHECK_SECONDS old is re-checked with a refresh-token grant
 * (spec §1, "Revocation"):
 *
 * | refresh result                 | decision                                   |
 * |--------------------------------|--------------------------------------------|
 * | invalid_grant                  | 401 → /login, session ended                |
 * | new ID token without our role  | 403 → hub /no-access?app=…, session ended  |
 * | network error / 5xx            | 503 → /unavailable, never a pass           |
 * | ok                             | pass with the new role, checkedAt = now    |
 */
export async function gate(
  request: { pathname: string; search: string; session?: string; sso?: string },
  now = Date.now(),
): Promise<Decision> {
  const next = request.pathname + request.search
  const back = next === "/" ? "" : `?next=${encodeURIComponent(next)}`
  const signedOut = (clear: boolean): Denied => ({
    kind: "deny",
    status: 401,
    error: "unauthenticated",
    location: `/login${back}`,
    clear,
  })

  const session = await verifySession(request.session)
  if (!session) return signedOut(request.session !== undefined || request.sso !== undefined)
  if (!session.sub) return { kind: "pass" }

  const sso = readSso(request.sso)
  if (!sso || sso.sub !== session.sub) return signedOut(true)
  if (now - sso.checkedAt < RECHECK_SECONDS * 1000) return { kind: "pass" }

  const result = await refresh(sso.refreshToken)
  if (result.status === "unavailable") {
    return { kind: "deny", status: 503, error: "auth_unavailable", location: `/unavailable${back}`, clear: false }
  }
  if (result.status === "ended" || result.tokens.claims.sub !== session.sub) return signedOut(true)
  const role = pickRole(result.tokens.claims)
  if (!role) return { kind: "deny", status: 403, error: "forbidden", location: noAccessUrl(), clear: true }
  return { kind: "pass", cookies: await sessionCookies(result.tokens, role, now) }
}
