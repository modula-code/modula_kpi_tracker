/** A fetch-based "browser" for driving the real code flow. Copied from centralauth/test/helpers/browser.ts. */
import { finishLogin, startLogin, type Tokens } from "../../lib/sso.ts"
import { UPSTREAM_PASSWORD } from "./kc.ts"

/** A minimal cookie jar keyed by path and name only (no host separation): one Jar per browser. */
export class Jar {
  private cookies = new Map<string, { path: string; value: string }>()

  take(response: Response): void {
    for (const header of response.headers.getSetCookie()) {
      const [pair, ...attributes] = header.split(";")
      const eq = pair.indexOf("=")
      const name = pair.slice(0, eq).trim()
      const value = pair.slice(eq + 1).trim()
      const path = attributes.map((a) => a.trim()).find((a) => /^path=/i.test(a))?.slice(5) || "/"
      const gone =
        value === "" ||
        attributes.some((a) => /^\s*max-age=0\s*$/i.test(a) || /expires=thu, 01 jan 1970/i.test(a))
      if (gone) this.cookies.delete(`${path}|${name}`)
      else this.cookies.set(`${path}|${name}`, { path, value })
    }
  }

  header(url: URL): string {
    return [...this.cookies]
      .filter(([, c]) => url.pathname.startsWith(c.path))
      .map(([key, c]) => `${key.split("|")[1]}=${c.value}`)
      .join("; ")
  }

  get(name: string): string | undefined {
    for (const [key, c] of this.cookies) if (key.endsWith(`|${name}`)) return decodeURIComponent(c.value)
    return undefined
  }

  set(name: string, value: string, path = "/"): void {
    this.cookies.set(`${path}|${name}`, { path, value: encodeURIComponent(value) })
  }
}

export async function go(url: URL | string, jar: Jar, init: RequestInit = {}): Promise<Response> {
  const target = new URL(url)
  const headers = new Headers(init.headers)
  const cookie = jar.header(target)
  if (cookie) headers.set("cookie", cookie)
  const response = await fetch(target, { ...init, headers, redirect: "manual" })
  jar.take(response)
  return response
}

/** A plain HTML post of the page's first form, as a browser without JS sends it (how server actions degrade). */
export async function submitForm(url: string, jar: Jar, fields: Record<string, string> = {}) {
  const html = await (await go(url, jar)).text()
  const form = html.match(/<form[\s\S]*?<\/form>/)?.[0]
  if (!form) throw new Error(`no form on ${url}`)
  const unescape = (s: string) =>
    s.replaceAll("&quot;", '"').replaceAll("&#x27;", "'").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&")
  const body = new FormData()
  for (const input of form.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
    const name = input[0].match(/name="([^"]*)"/)?.[1]
    if (name) body.append(unescape(name), unescape(input[0].match(/value="([^"]*)"/)?.[1] ?? ""))
  }
  for (const [name, value] of Object.entries(fields)) body.set(name, value)
  return go(url, jar, { method: "POST", body, headers: { origin: new URL(url).origin } })
}

/**
 * Follows redirects like a browser, signing in at the fake Google with `email` when its login
 * form appears. Stops before fetching any URL starting with `stopAt` (returned as `url`), or at
 * the first page that is neither a redirect nor a login form (`response` + `html`).
 */
export async function signIn(start: URL | string, email: string, options: { jar?: Jar; stopAt?: string } = {}) {
  const jar = options.jar ?? new Jar()
  let url = new URL(start)
  let init: RequestInit = {}
  for (let hop = 0; hop < 25; hop++) {
    if (options.stopAt && url.href.startsWith(options.stopAt)) return { jar, url }
    const response = await go(url, jar, init)
    const location = response.headers.get("location")
    if (response.status >= 300 && response.status < 400 && location) {
      url = new URL(location, url)
      init = {}
      continue
    }
    const html = await response.text()
    const action = html.match(/<form[^>]*id="kc-form-login"[^>]*action="([^"]+)"/)?.[1]
    if (!action) return { jar, url, response, html }
    url = new URL(action.replaceAll("&amp;", "&"), url)
    init = {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ username: email, password: UPSTREAM_PASSWORD }),
    }
  }
  throw new Error("Too many redirects")
}

/** Signs in through this app's Keycloak client using lib/sso.ts directly, without running the app. */
export async function ssoLogin(email: string, jar = new Jar()): Promise<{ jar: Jar; tokens: Tokens }> {
  const { url, flow } = await startLogin("/")
  const redirect = process.env.HUB_REDIRECT_URI!
  const result = await signIn(url, email, { jar, stopAt: redirect })
  if (!result.url.href.startsWith(redirect)) throw new Error(`Keycloak refused the login: ${result.html?.slice(0, 300)}`)
  return { jar, tokens: await finishLogin(result.url.search, flow) }
}
