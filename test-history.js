require('dotenv').config({ path: '.env' });

const URL_ = process.env.ODOO_URL;
const DB = process.env.ODOO_DB;
const USERNAME = process.env.ODOO_USERNAME;
const PASSWORD = process.env.ODOO_PASSWORD;

async function rpc(service, method, args) {
  const res = await fetch(`${URL_}/jsonrpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method: "call", params: { service, method, args } }),
  });
  const body = await res.json();
  if (body.error) throw new Error(body.error.data?.message ?? "Odoo RPC error");
  return body.result;
}

async function test() {
  const uid = await rpc("common", "login", [DB, USERNAME, PASSWORD]);
  try {
     const history = await rpc("object", "execute_kw", [DB, uid, PASSWORD, 'x_lead_stage_history', 'search_read', [[]], { limit: 1 }]);
     console.log("x_lead_stage_history OK:", history.length);
  } catch(e) {
     console.error("x_lead_stage_history FAIL:", e.message);
  }
}
test();
