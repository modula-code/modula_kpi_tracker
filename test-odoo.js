require('dotenv').config({ path: '.env' });

const URL_ = process.env.ODOO_URL;
const DB = process.env.ODOO_DB;
const USERNAME = process.env.ODOO_USERNAME;
const PASSWORD = process.env.ODOO_PASSWORD;

async function rpc(service, method, args) {
  if (!URL_ || !DB || !USERNAME || !PASSWORD) {
    throw new Error("Odoo credentials are missing from .env");
  }
  const res = await fetch(`${URL_}/jsonrpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method: "call", params: { service, method, args } }),
  });
  if (!res.ok) throw new Error(`Odoo HTTP ${res.status}`);

  const body = await res.json();
  if (body.error) throw new Error(body.error.data?.message ?? "Odoo RPC error");
  return body.result;
}

async function test() {
  try {
    const uid = await rpc("common", "login", [DB, USERNAME, PASSWORD]);
    console.log("Successfully logged in! UID:", uid);
    
    if (!uid) {
        console.error("Login failed (returned falsy uid). Check credentials.");
        process.exit(1);
    }

    // Try a simple call to verify we have access
    const result = await rpc("object", "execute_kw", [DB, uid, PASSWORD, 'res.users', 'search_read', [[['id', '=', uid]]], { fields: ['name'] }]);
    console.log("User info:", result);
    console.log("Odoo connection is healthy.");
  } catch (error) {
    console.error("Error connecting to Odoo:", error);
    process.exit(1);
  }
}

test();

async function testModels() {
  try {
    const uid = await rpc("common", "login", [DB, USERNAME, PASSWORD]);
    console.log("Logged in UID:", uid);

    const modelsToTest = [
      'res.users',
      'res.company',
      'crm.stage',
      'crm.lead',
      'sale.order',
      'crm.lead.stage.log' // wait, is this a real model? Let's check sales-source.ts
    ];
    
    for (const model of modelsToTest) {
      try {
        await rpc("object", "execute_kw", [DB, uid, PASSWORD, model, 'search_read', [[]], { limit: 1, fields: ['id'] }]);
        console.log(`✅ Access to ${model} is OK.`);
      } catch (err) {
         // might fail if table doesn't exist or no access
         console.error(`❌ Access to ${model} FAILED:`, err.message);
      }
    }
  } catch (error) {
    console.error("Setup error:", error);
  }
}

testModels();
