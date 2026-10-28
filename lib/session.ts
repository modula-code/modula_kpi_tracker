/**
 * The dashboard session cookie (kpi_session).
 *
 * Two ways in, one cookie: the .env account (AUTH_EMAIL / AUTH_PASSWORD, always "admin", no
 * `sub`), or Google through Keycloak (role from this app's Keycloak client, plus the Keycloak
 * `sub`; see app/auth/hub/route.ts and lib/sso.ts). Signed with an HMAC so it cannot be forged.
 * Web Crypto and no Next imports, so proxy.ts, the server and `node --test` share it.
 */

const SESSION_COOKIE = "kpi_session"
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7
/**
 * Keycloak's SSO maximum (10h). The 5-minute re-check in proxy.ts ends an SSO session sooner when
 * Keycloak says so (lib/gate.ts).
 */
const HUB_MAX_AGE_SECONDS = 60 * 60 * 10

export type Role = "admin" | "viewer"
export interface Session {
  email: string
  role: Role
  /** Keycloak user id; only on SSO sessions, whose refresh token is in the kpi_sso cookie. */
  sub?: string
}

const encoder = new TextEncoder()

function b64url(bytes: Uint8Array): string {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function unb64url(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"))
  const bytes = new Uint8Array(new ArrayBuffer(binary.length))
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function hmacKey(): Promise<CryptoKey> {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error("AUTH_SECRET is not set")
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  )
}

/** `payload.signature`, where payload is the JSON `{ email, role, sub?, exp }` (exp in epoch ms). */
export async function signSession(session: Session, maxAgeSeconds = MAX_AGE_SECONDS): Promise<string> {
  const { email, role, sub } = session
  const payload = JSON.stringify({ email, role, ...(sub ? { sub } : {}), exp: Date.now() + maxAgeSeconds * 1000 })
  const bytes = encoder.encode(payload)
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(), bytes)
  return `${b64url(bytes)}.${b64url(new Uint8Array(signature))}`
}

/** The signed-in user, or null when the token is missing, forged, or expired. */
export async function verifySession(token: string | undefined): Promise<Session | null> {
  if (!token) return null
  const [payloadPart, signaturePart] = token.split(".")
  if (!payloadPart || !signaturePart) return null

  try {
    const payloadBytes = unb64url(payloadPart)
    const ok = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(),
      unb64url(signaturePart),
      payloadBytes,
    )
    if (!ok) return null

    // Cookies from before roles and `sub` (email|expiry[|role]) fail to parse here: one re-login.
    const { email, role, sub, exp } = JSON.parse(new TextDecoder().decode(payloadBytes))
    if (typeof email !== "string" || !email || typeof exp !== "number" || exp < Date.now()) return null
    if (role !== "admin" && role !== "viewer") return null
    if (sub !== undefined && (typeof sub !== "string" || !sub)) return null
    return sub ? { email, role, sub } : { email, role }
  } catch {
    return null
  }
}

export const SESSION = {
  cookie: SESSION_COOKIE,
  maxAge: MAX_AGE_SECONDS,
  hubMaxAge: HUB_MAX_AGE_SECONDS,
}
