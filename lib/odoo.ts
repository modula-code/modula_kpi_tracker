import "server-only"

/**
 * Minimal Odoo JSON-RPC client. Credentials live in .env and never leave the
 * server — pages fetch through here and hand the UI plain rows.
 */

const URL_ = process.env.ODOO_URL
const DB = process.env.ODOO_DB
const USERNAME = process.env.ODOO_USERNAME
const PASSWORD = process.env.ODOO_PASSWORD

let uidPromise: Promise<number> | null = null

async function rpc<T>(service: string, method: string, args: unknown[]): Promise<T> {
  if (!URL_ || !DB || !USERNAME || !PASSWORD) {
    throw new Error("Odoo credentials are missing from .env")
  }
  const res = await fetch(`${URL_}/jsonrpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method: "call", params: { service, method, args } }),
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`Odoo HTTP ${res.status}`)

  const body = (await res.json()) as { result?: T; error?: { data?: { message?: string } } }
  if (body.error) throw new Error(body.error.data?.message ?? "Odoo RPC error")
  return body.result as T
}

function uid(): Promise<number> {
  // Cached for the life of the process; Odoo uids don't rotate.
  uidPromise ??= rpc<number>("common", "login", [DB, USERNAME, PASSWORD]).then((id) => {
    if (!id) throw new Error("Odoo login failed — check ODOO_USERNAME / ODOO_PASSWORD")
    return id
  })
  return uidPromise
}

/** The uid the RPC user authenticated as — needed to read its company access. */
export async function odooUid(): Promise<number> {
  return uid()
}

export async function odooCall<T>(
  model: string,
  method: string,
  args: unknown[] = [],
  kwargs: Record<string, unknown> = {},
): Promise<T> {
  return rpc<T>("object", "execute_kw", [DB, await uid(), PASSWORD, model, method, args, kwargs])
}
