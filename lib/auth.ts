/**
 * Session auth for the dashboard.
 *
 * One account, held in .env (AUTH_EMAIL / AUTH_PASSWORD), signed into an
 * HttpOnly cookie with an HMAC so it cannot be forged. Web Crypto rather than
 * node:crypto so the same helpers run in middleware and on the server.
 */

const SESSION_COOKIE = "kpi_session"
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7

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

/** `payload.signature`, where payload is `email|expiryEpochMs`. */
export async function signSession(email: string): Promise<string> {
  const payload = `${email}|${Date.now() + MAX_AGE_SECONDS * 1000}`
  const bytes = encoder.encode(payload)
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(), bytes)
  return `${b64url(bytes)}.${b64url(new Uint8Array(signature))}`
}

/** The signed-in email, or null when the token is missing, forged, or expired. */
export async function verifySession(token: string | undefined): Promise<string | null> {
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

    const [email, expiry] = new TextDecoder().decode(payloadBytes).split("|")
    if (!email || Number(expiry) < Date.now()) return null
    return email
  } catch {
    return null
  }
}

export const SESSION = { cookie: SESSION_COOKIE, maxAge: MAX_AGE_SECONDS }
