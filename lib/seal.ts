import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto"

/**
 * Small JSON values as cookie values, encrypted and authenticated with AES-256-GCM, so a tampered,
 * garbled or foreign cookie fails to open instead of being trusted. The key is derived by HKDF
 * from the existing AUTH_SECRET with `info = purpose` ("sso-cookie" for kpi_sso), so no new
 * secret is needed and a value sealed for one purpose never opens as another.
 */
function key(purpose: string): Buffer {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error("AUTH_SECRET is not set")
  return Buffer.from(hkdfSync("sha256", secret, "", purpose, 32))
}

export function seal(purpose: string, value: unknown): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key(purpose), iv)
  const body = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url")
}

export function unseal<T>(purpose: string, token: string | undefined): T | null {
  if (!token) return null
  const k = key(purpose) // outside the try: a missing secret must throw, not sign everyone out
  try {
    const raw = Buffer.from(token, "base64url")
    const decipher = createDecipheriv("aes-256-gcm", k, raw.subarray(0, 12), { authTagLength: 16 })
    decipher.setAuthTag(raw.subarray(12, 28))
    return JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8")) as T
  } catch {
    return null
  }
}
