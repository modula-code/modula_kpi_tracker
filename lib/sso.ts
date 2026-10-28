/**
 * Google sign-in through Keycloak (realm `modula`, this app's own client `HUB_CLIENT_ID`) with
 * openid-client: discovery, PKCE S256, state and nonce, and a validated ID token. The role comes
 * only from `resource_access[HUB_CLIENT_ID].roles` in that ID token. The refresh token lives in the
 * encrypted kpi_sso cookie and is used by proxy.ts (lib/gate.ts) to re-check every 5 minutes.
 * Patterns follow centralauth/lib/oidc.ts.
 */
import * as client from "openid-client"

import { seal, unseal } from "./seal.ts"
import { SESSION, signSession, type Role } from "./session.ts"

/** Seconds between re-checks with Keycloak: the longest a revoked or suspended user keeps access. */
export const RECHECK_SECONDS = 300
/** With several of this app's roles, the first one listed here wins. */
export const ROLE_PRIORITY: readonly Role[] = ["admin", "viewer"]
export const SSO_COOKIE = "kpi_sso"
export const FLOW_COOKIE = "kpi_hub_flow"

const ENV = ["HUB_ISSUER", "HUB_CLIENT_ID", "HUB_CLIENT_SECRET", "HUB_REDIRECT_URI", "HUB_POST_LOGOUT_URI", "HUB_URL"] as const

function env(name: (typeof ENV)[number]): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set`)
  return value
}

export const ssoConfigured = () => ENV.every((name) => process.env[name])

export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
}

export type Claims = {
  sub: string
  email?: string
  resource_access?: Record<string, { roles?: string[] }>
}
export type Tokens = { idToken: string; refreshToken: string; claims: Claims }
/** Login state kept in a sealed cookie between the two legs of /auth/hub. */
export type Flow = { state: string; nonce: string; verifier: string; next: string }
/** The kpi_sso cookie. `idToken` is the logout hint; `checkedAt` is the last answer from Keycloak. */
export type SsoState = { sub: string; idToken: string; refreshToken: string; checkedAt: number }
export type RefreshResult = { status: "ok"; tokens: Tokens } | { status: "ended" } | { status: "unavailable" }

let config: Promise<client.Configuration> | undefined

/** Discovered once per process; a failed discovery (Keycloak down) is retried on the next call. */
export function oidcConfig(): Promise<client.Configuration> {
  config ??= (async () => {
    const issuer = new URL(env("HUB_ISSUER"))
    // Also verify ID token signatures against Keycloak's JWKS, not only TLS.
    const execute = [client.enableNonRepudiationChecks]
    if (issuer.protocol === "http:" && issuer.hostname === "localhost") execute.push(client.allowInsecureRequests)
    // 5s, not the default 30s: proxy.ts waits on the re-check, so an unresponsive Keycloak should become a 503 quickly.
    return client.discovery(issuer, env("HUB_CLIENT_ID"), env("HUB_CLIENT_SECRET"), undefined, { execute, timeout: 5 })
  })().catch((error) => {
    config = undefined
    throw error
  })
  return config
}

/** Same-site paths only: "/x" yes; "//evil.com", "/\\evil.com", "/\t/evil.com" and absolute URLs no. Decided by parsing, like a browser. */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/")) return "/"
  try {
    const url = new URL(next, "http://kpi.invalid")
    return url.origin === "http://kpi.invalid" ? url.pathname + url.search + url.hash : "/"
  } catch {
    return "/"
  }
}

/** This app's role from validated claims; another client's roles and realm roles never count. */
export function pickRole(claims: Claims): Role | null {
  const roles = claims.resource_access?.[env("HUB_CLIENT_ID")]?.roles
  if (!Array.isArray(roles)) return null
  return ROLE_PRIORITY.find((role) => roles.includes(role)) ?? null
}

/** The hub's 403 page, where the user can ask for access to this app. */
export const noAccessUrl = () => new URL(`/no-access?app=${encodeURIComponent(env("HUB_CLIENT_ID"))}`, env("HUB_URL")).href

export async function startLogin(next: string | null) {
  const cfg = await oidcConfig()
  const flow: Flow = {
    state: client.randomState(),
    nonce: client.randomNonce(),
    verifier: client.randomPKCECodeVerifier(),
    next: safeNext(next),
  }
  const url = client.buildAuthorizationUrl(cfg, {
    redirect_uri: env("HUB_REDIRECT_URI"),
    scope: "openid email profile",
    state: flow.state,
    nonce: flow.nonce,
    code_challenge: await client.calculatePKCECodeChallenge(flow.verifier),
    code_challenge_method: "S256",
    // Straight to Google: the Keycloak login page is never shown.
    kc_idp_hint: "google",
  })
  return { url, flow }
}

function toTokens(response: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers): Tokens {
  const claims = response.claims() as Claims | undefined
  if (!response.id_token || !response.refresh_token || !claims?.sub) throw new Error("Keycloak returned no ID or refresh token")
  return { idToken: response.id_token, refreshToken: response.refresh_token, claims }
}

/** `query` is the callback's query string; the redirect URI is HUB_REDIRECT_URI, never the (possibly internal) request URL. */
export async function finishLogin(query: string, flow: Flow): Promise<Tokens> {
  const callback = new URL(env("HUB_REDIRECT_URI"))
  callback.search = query
  const response = await client.authorizationCodeGrant(await oidcConfig(), callback, {
    pkceCodeVerifier: flow.verifier,
    expectedState: flow.state,
    expectedNonce: flow.nonce,
    idTokenExpected: true,
  })
  return toTokens(response)
}

/** The user backed out at Google or Keycloak (`error=access_denied`); other callback errors are failures. */
export const isCancelled = (error: unknown) =>
  error instanceof client.AuthorizationResponseError && error.error === "access_denied"

/** The spec §1 re-check. `ended` = invalid_grant (disabled, logged out, past the SSO maximum); anything else that fails is an outage, never access. */
export async function refresh(refreshToken: string): Promise<RefreshResult> {
  try {
    return { status: "ok", tokens: toTokens(await client.refreshTokenGrant(await oidcConfig(), refreshToken)) }
  } catch (error) {
    if (error instanceof client.ResponseBodyError && error.error === "invalid_grant") return { status: "ended" }
    return { status: "unavailable" }
  }
}

/** RP-initiated logout: Keycloak ends the central session and returns the browser to HUB_POST_LOGOUT_URI. */
export async function logoutUrl(idToken: string): Promise<URL> {
  return client.buildEndSessionUrl(await oidcConfig(), {
    id_token_hint: idToken,
    post_logout_redirect_uri: env("HUB_POST_LOGOUT_URI"),
  })
}

export const readSso = (value: string | undefined) => unseal<SsoState>("sso-cookie", value)
export const writeSso = (state: SsoState) => seal("sso-cookie", state)
export const readFlow = (value: string | undefined) => unseal<Flow>("sso-flow", value)
export const writeFlow = (flow: Flow) => seal("sso-flow", flow)

/** True when kpi_sso belongs to `sub` and Keycloak confirmed it less than RECHECK_SECONDS ago. */
export function checkedRecently(value: string | undefined, sub: string, now = Date.now()): boolean {
  const sso = readSso(value)
  return !!sso && sso.sub === sub && now - sso.checkedAt < RECHECK_SECONDS * 1000
}

/** The two cookies of a signed-in SSO user: the signed session (email, role, sub) and the encrypted kpi_sso. */
export async function sessionCookies(tokens: Tokens, role: Role, now = Date.now()) {
  const { sub, email } = tokens.claims
  return {
    session: await signSession({ email: email?.toLowerCase() || sub, role, sub }, SESSION.hubMaxAge),
    sso: writeSso({ sub, idToken: tokens.idToken, refreshToken: tokens.refreshToken, checkedAt: now }),
  }
}
