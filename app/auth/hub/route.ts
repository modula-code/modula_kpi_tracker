import { NextResponse, type NextRequest } from "next/server"

import { SESSION } from "@/lib/session"
import {
  cookieOptions,
  finishLogin,
  FLOW_COOKIE,
  isCancelled,
  noAccessUrl,
  pickRole,
  readFlow,
  safeNext,
  sessionCookies,
  ssoConfigured,
  SSO_COOKIE,
  startLogin,
  writeFlow,
} from "@/lib/sso"

/**
 * "Continue with Google" through Keycloak (lib/sso.ts). One route, both legs, at HUB_REDIRECT_URI:
 * without `code`/`error` it sends the browser to Keycloak (which goes straight on to Google); Keycloak
 * sends it back here, the ID token is validated, and this app's role becomes the normal session plus
 * the encrypted kpi_sso cookie (refresh token for the 5-minute re-check in proxy.ts).
 */
function toLogin(request: NextRequest, error: string) {
  const response = NextResponse.redirect(new URL(`/login?error=${error}`, request.url))
  response.cookies.delete(FLOW_COOKIE)
  return response
}

export async function GET(request: NextRequest) {
  if (!ssoConfigured()) return toLogin(request, "not-configured")
  const params = request.nextUrl.searchParams

  if (!params.has("code") && !params.has("error")) {
    const next = params.get("next")
    let started: Awaited<ReturnType<typeof startLogin>>
    try {
      started = await startLogin(next)
    } catch {
      return NextResponse.redirect(new URL(`/unavailable?next=${encodeURIComponent(safeNext(next))}`, request.url))
    }
    const response = NextResponse.redirect(started.url)
    response.cookies.set(FLOW_COOKIE, writeFlow(started.flow), { ...cookieOptions, maxAge: 600 })
    return response
  }

  const flow = readFlow(request.cookies.get(FLOW_COOKIE)?.value)
  if (!flow) return toLogin(request, "expired")
  let tokens
  try {
    tokens = await finishLogin(request.nextUrl.search, flow)
  } catch (error) {
    return toLogin(request, isCancelled(error) ? "cancelled" : "failed")
  }

  const role = pickRole(tokens.claims)
  if (!role) {
    // Signed in at Keycloak, but no grant for this app: the hub explains and offers to ask for access.
    const response = NextResponse.redirect(noAccessUrl())
    response.cookies.delete(FLOW_COOKIE)
    return response
  }

  const cookies = await sessionCookies(tokens, role)
  const response = NextResponse.redirect(new URL(safeNext(flow.next), request.url))
  response.cookies.delete(FLOW_COOKIE)
  response.cookies.set(SESSION.cookie, cookies.session, { ...cookieOptions, maxAge: SESSION.hubMaxAge })
  response.cookies.set(SSO_COOKIE, cookies.sso, { ...cookieOptions, maxAge: SESSION.hubMaxAge })
  return response
}
