import fs from "node:fs";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

function localEnvironment() {
  const values = {};
  for (const line of fs.readFileSync("apps/web/.env.local", "utf8").split(/\r?\n/)) {
    const separator = line.indexOf("=");
    if (separator > 0) values[line.slice(0, separator)] = line.slice(separator + 1);
  }
  for (const name of ["PF_SUPABASE_URL", "PF_SUPABASE_SERVER_KEY", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]) {
    if (!values[name]) throw new Error(`Missing ${name}`);
  }
  return values;
}

const environment = localEnvironment();
const admin = createClient(environment.PF_SUPABASE_URL, environment.PF_SUPABASE_SERVER_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const stamp = Date.now();
const password = `Pf!${crypto.randomBytes(18).toString("base64url")}9a`;
const emails = [`rls-a-${stamp}@passionfruit.test`, `rls-b-${stamp}@passionfruit.test`];
const users = [];
const tenants = [];

try {
  for (const email of emails) {
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { test_only: true } });
    if (error) throw error;
    users.push(data.user);
  }

  for (const [index, user] of users.entries()) {
    const { data, error } = await admin.rpc("provision_tenant", {
      p_name: `RLS Test ${index + 1} ${stamp}`,
      p_slug: `rls-test-${index + 1}-${stamp}`,
      p_owner_user_id: user.id,
      p_feature_keys: ["shared_inbox", "contacts"],
    });
    if (error) throw error;
    tenants.push(data);
  }

  const { error: membershipError } = await admin.from("memberships").update({ status: "active" }).in("tenant_id", tenants);
  if (membershipError) throw membershipError;
  const { error: contactError } = await admin.from("contacts").insert([
    { tenant_id: tenants[0], wa_id: `91${stamp}01`, display_name: "Tenant A Contact" },
    { tenant_id: tenants[1], wa_id: `91${stamp}02`, display_name: "Tenant B Contact" },
  ]);
  if (contactError) throw contactError;

  const clients = emails.map(() => createClient(environment.PF_SUPABASE_URL, environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  }));
  for (const [index, client] of clients.entries()) {
    const { error } = await client.auth.signInWithPassword({ email: emails[index], password });
    if (error) throw error;
  }

  const [ownA, ownB, crossA, crossB, tenantListA, tenantListB] = await Promise.all([
    clients[0].from("contacts").select("tenant_id"),
    clients[1].from("contacts").select("tenant_id"),
    clients[0].from("contacts").select("id", { count: "exact", head: true }).eq("tenant_id", tenants[1]),
    clients[1].from("contacts").select("id", { count: "exact", head: true }).eq("tenant_id", tenants[0]),
    clients[0].from("tenants").select("id"),
    clients[1].from("tenants").select("id"),
  ]);
  for (const result of [ownA, ownB, crossA, crossB, tenantListA, tenantListB]) if (result.error) throw result.error;

  const checks = {
    tenantASeesOwnContact: ownA.data.length === 1 && ownA.data[0].tenant_id === tenants[0],
    tenantBSeesOwnContact: ownB.data.length === 1 && ownB.data[0].tenant_id === tenants[1],
    tenantACannotReadTenantB: crossA.count === 0,
    tenantBCannotReadTenantA: crossB.count === 0,
    tenantListsIsolated: tenantListA.data.length === 1 && tenantListB.data.length === 1,
  };
  if (!Object.values(checks).every(Boolean)) throw new Error(`Hosted RLS verification failed: ${JSON.stringify(checks)}`);
  console.log(JSON.stringify({ passed: true, checks }));
} finally {
  if (tenants.length) await admin.from("tenants").delete().in("id", tenants);
  for (const user of users) await admin.auth.admin.deleteUser(user.id);
}
