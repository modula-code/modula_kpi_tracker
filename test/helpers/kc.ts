/**
 * Keycloak Admin API helpers for tests, against the local Keycloak only (see test/local.env).
 * Copied from centralauth/test/helpers/kc.ts, trimmed to what this app's tests need.
 */

function need(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set (run with --env-file=test/local.env)`)
  return value
}

export const KC = new URL(need("HUB_ISSUER")).origin
export const REALM = "modula"
if (new URL(KC).hostname !== "localhost") throw new Error("Test helpers only run against a local Keycloak")

let master: { value: string; expires: number } | undefined

async function masterToken(): Promise<string> {
  if (master && master.expires > Date.now() + 10_000) return master.value
  const res = await fetch(`${KC}/realms/master/protocol/openid-connect/token`, {
    method: "POST",
    body: new URLSearchParams({
      grant_type: "password",
      client_id: "admin-cli",
      username: need("KC_BOOTSTRAP_ADMIN_USERNAME"),
      password: need("KC_BOOTSTRAP_ADMIN_PASSWORD"),
    }),
  })
  if (!res.ok) throw new Error(`master admin token: ${res.status}`)
  const body = (await res.json()) as { access_token: string; expires_in: number }
  master = { value: body.access_token, expires: Date.now() + body.expires_in * 1000 }
  return master.value
}

/** `path` starts after /admin/realms. */
export async function admin(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${KC}/admin/realms${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${await masterToken()}`, "Content-Type": "application/json" },
  })
}

export async function adminJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await admin(path, init)
  const text = await res.text()
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path}: ${res.status} ${text}`)
  return (text ? JSON.parse(text) : undefined) as T
}

const createdId = (res: Response) => res.headers.get("location")!.split("/").pop()!

/** Users this process created, deleted again by `cleanup()` (the Keycloak is shared). */
const created: { realm: string; id: string }[] = []

let counter = 0
/** Unique per run, so tests never collide with each other, other suites, or leftovers. */
export const freshEmail = (name: string) => `kpi-${name}-${process.pid}-${Date.now()}-${counter++}@test.local`

export const UPSTREAM_PASSWORD = "upstream-pw"

/**
 * Local only: a second realm `upstream` plays Google. The modula realm's `google` provider is
 * re-pointed at it under the same alias, so `kc_idp_hint=google` and the first-login flow run
 * unchanged. Idempotent, and the same as centralauth's, so suites can share it.
 */
export async function ensureUpstream(): Promise<void> {
  if ((await admin("/upstream")).status === 404) {
    await adminJson("", { method: "POST", body: JSON.stringify({ realm: "upstream", enabled: true }) })
    await adminJson("/upstream/clients", {
      method: "POST",
      body: JSON.stringify({
        clientId: "modula-broker",
        secret: "upstream-broker-secret",
        publicClient: false,
        standardFlowEnabled: true,
        directAccessGrantsEnabled: false,
        redirectUris: [`${KC}/realms/${REALM}/broker/google/endpoint`],
      }),
    })
  }
  const idp = await adminJson<{ providerId: string; firstBrokerLoginFlowAlias: string }>(
    `/${REALM}/identity-provider/instances/google`,
  )
  if (idp.providerId === "oidc") return
  const up = `${KC}/realms/upstream/protocol/openid-connect`
  await adminJson(`/${REALM}/identity-provider/instances/google`, { method: "DELETE" })
  await adminJson(`/${REALM}/identity-provider/instances`, {
    method: "POST",
    body: JSON.stringify({
      alias: "google",
      providerId: "oidc",
      enabled: true,
      trustEmail: true,
      firstBrokerLoginFlowAlias: idp.firstBrokerLoginFlowAlias,
      config: {
        authorizationUrl: `${up}/auth`,
        tokenUrl: `${up}/token`,
        jwksUrl: `${up}/certs`,
        issuer: `${KC}/realms/upstream`,
        useJwksUrl: "true",
        validateSignature: "true",
        clientId: "modula-broker",
        clientSecret: "upstream-broker-secret",
        clientAuthMethod: "client_secret_post",
        syncMode: "FORCE",
        defaultScope: "openid email profile",
      },
    }),
  })
}

/** A "Google account" in the upstream realm. */
export async function googleAccount(email: string, name = "Test User"): Promise<string> {
  const [firstName, lastName] = name.split(" ")
  const res = await admin("/upstream/users", {
    method: "POST",
    body: JSON.stringify({
      username: email,
      email,
      emailVerified: true,
      enabled: true,
      firstName,
      lastName,
      credentials: [{ type: "password", value: UPSTREAM_PASSWORD, temporary: false }],
    }),
  })
  if (res.status !== 201) throw new Error(`upstream user: ${res.status} ${await res.text()}`)
  const id = createdId(res)
  created.push({ realm: "upstream", id })
  return id
}

/** A pre-created modula user, as the hub's "Add user" does; returns its id (the `sub`). */
export async function modulaUser(email: string): Promise<string> {
  const res = await admin(`/${REALM}/users`, {
    method: "POST",
    body: JSON.stringify({ username: email, email, emailVerified: true, enabled: true }),
  })
  if (res.status !== 201) throw new Error(`modula user: ${res.status} ${await res.text()}`)
  const id = createdId(res)
  created.push({ realm: REALM, id })
  return id
}

/** A Google account plus its pre-created modula user holding `roles` on `clientId`. */
export async function userWith(email: string, clientId: string, roles: string[]): Promise<string> {
  const id = await modulaUser(email)
  for (const role of roles) await grant(id, clientId, role)
  await googleAccount(email)
  return id
}

async function clientUuid(clientId: string): Promise<string> {
  return (await adminJson<{ id: string }[]>(`/${REALM}/clients?clientId=${encodeURIComponent(clientId)}`))[0].id
}

export async function grant(userId: string, clientId: string, role: string): Promise<void> {
  const uuid = await clientUuid(clientId)
  const representation = await adminJson(`/${REALM}/clients/${uuid}/roles/${role}`)
  await adminJson(`/${REALM}/users/${userId}/role-mappings/clients/${uuid}`, {
    method: "POST",
    body: JSON.stringify([representation]),
  })
}

export async function ungrant(userId: string, clientId: string, role: string): Promise<void> {
  const uuid = await clientUuid(clientId)
  const representation = await adminJson(`/${REALM}/clients/${uuid}/roles/${role}`)
  await adminJson(`/${REALM}/users/${userId}/role-mappings/clients/${uuid}`, {
    method: "DELETE",
    body: JSON.stringify([representation]),
  })
}

export async function disable(userId: string): Promise<void> {
  const user = await adminJson<Record<string, unknown>>(`/${REALM}/users/${userId}`)
  await adminJson(`/${REALM}/users/${userId}`, { method: "PUT", body: JSON.stringify({ ...user, enabled: false }) })
}

/** What the hub's suspend and revoke do besides changing the user. */
export const logoutUser = (userId: string) => adminJson(`/${REALM}/users/${userId}/logout`, { method: "POST" })

export async function sessionCount(userId: string): Promise<number> {
  return (await adminJson<unknown[]>(`/${REALM}/users/${userId}/sessions`)).length
}

export async function cleanup(): Promise<void> {
  for (const { realm, id } of created.splice(0)) await admin(`/${realm}/users/${id}`, { method: "DELETE" })
}
