import { NextResponse, type NextRequest } from "next/server"

import { SESSION, verifySession } from "@/lib/auth"

/** Everything is behind the login except the login page and static assets. */
export async function proxy(request: NextRequest) {
  const email = await verifySession(request.cookies.get(SESSION.cookie)?.value)
  const onLogin = request.nextUrl.pathname === "/login"

  if (!email && !onLogin) {
    const url = new URL("/login", request.url)
    if (request.nextUrl.pathname !== "/") url.searchParams.set("next", request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }
  if (email && onLogin) return NextResponse.redirect(new URL("/", request.url))
  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
}
