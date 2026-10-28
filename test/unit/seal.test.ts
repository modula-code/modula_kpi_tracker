import assert from "node:assert/strict"
import { test } from "node:test"

import { seal, unseal } from "../../lib/seal.ts"

process.env.AUTH_SECRET = "unit-test-secret-unit-test-secret-1234"

test("round-trips a value", () => {
  assert.deepEqual(unseal("sso-cookie", seal("sso-cookie", { sub: "u1", n: 1 })), { sub: "u1", n: 1 })
})

test("a tampered cookie is rejected", () => {
  const bytes = Buffer.from(seal("sso-cookie", { sub: "u1" }), "base64url")
  for (const index of [0, 12, bytes.length - 1]) {
    const copy = Buffer.from(bytes)
    copy[index] ^= 1 // iv, auth tag, ciphertext
    assert.equal(unseal("sso-cookie", copy.toString("base64url")), null)
  }
})

test("garbled, short and missing cookies are rejected", () => {
  assert.equal(unseal("sso-cookie", "not-a-token"), null)
  assert.equal(unseal("sso-cookie", "AAAA"), null)
  assert.equal(unseal("sso-cookie", ""), null)
  assert.equal(unseal("sso-cookie", undefined), null)
})

test("a value sealed for one purpose does not open as another", () => {
  assert.equal(unseal("sso-cookie", seal("sso-flow", { sub: "u1" })), null)
})

test("a value sealed under another secret does not open", () => {
  const token = seal("sso-cookie", { sub: "u1" })
  const saved = process.env.AUTH_SECRET
  process.env.AUTH_SECRET = "a-different-secret-a-different-secret"
  try {
    assert.equal(unseal("sso-cookie", token), null)
  } finally {
    process.env.AUTH_SECRET = saved
  }
})

test("a missing secret throws instead of sealing with no key", () => {
  const saved = process.env.AUTH_SECRET
  delete process.env.AUTH_SECRET
  try {
    assert.throws(() => seal("sso-cookie", {}), /AUTH_SECRET/)
    assert.throws(() => unseal("sso-cookie", "AAAA"), /AUTH_SECRET/)
  } finally {
    process.env.AUTH_SECRET = saved
  }
})
