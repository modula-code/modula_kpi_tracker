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
  
  const tests = [
    { model: 'res.users', method: 'read', args: [[uid], ['company_ids']] },
    { model: 'res.company', method: 'search_read', args: [[], ['id', 'name']] },
    { model: 'crm.stage', method: 'search_read', args: [[], ['id', 'name', 'sequence', 'is_won']] },
    { model: 'crm.lead', method: 'fields_get', args: [['x_studio_design_poc_1'], ['selection']] },
    { model: 'crm.lead', method: 'search_read', args: [[], ['id', 'name', 'x_studio_design_poc_1', 'company_id', 'source_id', 'stage_id', 'create_date', 'date_closed', 'active', 'lost_reason_id', 'referred', 'x_studio_referrer_name', 'x_studio_referrer_email', 'x_studio_referrer_phone']] },
    { model: 'sale.order', method: 'search_read', args: [[], ['id', 'name', 'x_studio_project_name', 'amount_total', 'date_order', 'state']] },
    { model: 'x_lead_stage_history', method: 'search_read', args: [[], ['x_lead_id', 'x_in_date']] },
  ];

  for (const t of tests) {
    try {
      await rpc("object", "execute_kw", [DB, uid, PASSWORD, t.model, t.method, t.args, { limit: 1 }]);
      console.log(`✅ ${t.model} ${t.method} OK`);
    } catch(e) {
      console.error(`❌ ${t.model} ${t.method} FAILED:`, e.message);
    }
  }
}
test();
