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
      await rpc("object", "execute_kw", [DB, uid, PASSWORD, 'res.users', 'read', [[uid], ['company_ids']]]);
      console.log(`✅ res.users read OK`);
  } catch(e) {
      console.error(`❌ res.users read FAILED:`, e.message);
  }

  try {
      await rpc("object", "execute_kw", [DB, uid, PASSWORD, 'crm.lead', 'fields_get', [['x_studio_design_poc_1']], { attributes: ["selection"] }]);
      console.log(`✅ crm.lead fields_get OK`);
  } catch(e) {
      console.error(`❌ crm.lead fields_get FAILED:`, e.message);
  }
}
test();
