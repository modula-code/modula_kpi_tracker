import { NextResponse, type NextRequest } from "next/server"

import { gate, type Denied } from "@/lib/gate"
import { SESSION, verifySession } from "@/lib/session"
import { cookieOptions, SSO_COOKIE } from "@/lib/sso"

/** Open without a session: the login page, Google sign-in (both legs), and the sign-in outage page. */
const PUBLIC = new Set(["/login", "/auth/hub", "/unavailable"])

const MESSAGES: Record<Denied["status"], string> = {
  401: "Your session has ended. Reload the page to sign in again.",
  403: "You no longer have access to this dashboard. Reload the page.",
  503: "The sign-in service is unavailable. Try again in a minute.",
}

/** Everything else is behind the login, and SSO sessions are re-checked with Keycloak every 5 minutes (lib/gate.ts). */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const session = request.cookies.get(SESSION.cookie)?.value

  if (PUBLIC.has(pathname)) {
    if (pathname === "/login" && (await verifySession(session))) return NextResponse.redirect(new URL("/", request.url))
    return NextResponse.next()
  }

  const decision = await gate({ pathname, search, session, sso: request.cookies.get(SSO_COOKIE)?.value })

  if (decision.kind === "pass") {
    if (!decision.cookies) return NextResponse.next()
    // Renewed by the re-check: store it, and hand it to this request's pages and actions as well.
    request.cookies.set(SESSION.cookie, decision.cookies.session)
    request.cookies.set(SSO_COOKIE, decision.cookies.sso)
    const response = NextResponse.next({ request: { headers: request.headers } })
    const options = { ...cookieOptions, maxAge: SESSION.hubMaxAge }
    response.cookies.set(SESSION.cookie, decision.cookies.session, options)
    response.cookies.set(SSO_COOKIE, decision.cookies.sso, options)
    return response
  }

  if (pathname.startsWith("/api/")) {
    return end(NextResponse.json({ error: decision.error }, { status: decision.status }), decision.clear)
  }
  // Client-side navigation, prefetch or server action (fetch() from the page; Next hides its RSC
  // headers from the proxy, so go by Sec-Fetch-Dest): fetch() would follow a redirect, re-sending an
  // action to a public page or failing CORS on the hub. A plain error status makes Next fall back to
  // a full page load of the same URL, which then gets the redirect below. Cookies stay until then.
  if (request.headers.has("next-action") || request.headers.get("sec-fetch-dest") === "empty") {
    return new NextResponse(MESSAGES[decision.status], {
      status: decision.status,
      headers: { "content-type": "text/plain" },
    })
  }
  // 303, so a form post (an action without JS) arrives at the target as a GET, never re-posted.
  return end(NextResponse.redirect(new URL(decision.location, request.url), 303), decision.clear)
}

function end(response: NextResponse, clear: boolean) {
  if (clear) {
    response.cookies.delete(SESSION.cookie)
    response.cookies.delete(SSO_COOKIE)
  }
  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
}
