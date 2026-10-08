import "server-only";

const requiredForDatabase = ["PF_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "PF_SUPABASE_SERVER_KEY"] as const;
const requiredForMeta = ["PF_META_GRAPH_VERSION", "PF_META_APP_SECRET", "PF_META_WEBHOOK_VERIFY_TOKEN"] as const;

export function environmentStatus() {
  const missingDatabase = requiredForDatabase.filter((key) => !process.env[key]);
  const missingMeta = requiredForMeta.filter((key) => !process.env[key]);
  return {
    mode: process.env.PF_ENV ?? "development",
    deploymentProfile: process.env.PF_DEPLOYMENT_PROFILE ?? "local",
    databaseConfigured: missingDatabase.length === 0,
    metaConfigured: missingMeta.length === 0,
    liveSendsEnabled: process.env.PF_LIVE_SENDS_ENABLED === "true",
    missing: [...missingDatabase, ...missingMeta],
  };
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required server environment variable: ${name}`);
  return value;
}

export function databaseEnvironment() {
  return {
    url: required("PF_SUPABASE_URL"),
    publishableKey: required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    serverKey: required("PF_SUPABASE_SERVER_KEY"),
  };
}

export function workerEnvironment() {
  return {
    workerSecret: required("PF_WORKER_TRIGGER_SECRET"),
    credentialKey: required("PF_CREDENTIAL_ENCRYPTION_KEY"),
    credentialKeyId: process.env.PF_CREDENTIAL_KEY_ID ?? "pilot-key-v1",
    graphVersion: required("PF_META_GRAPH_VERSION"),
    liveSendsEnabled: process.env.PF_LIVE_SENDS_ENABLED === "true",
    batchSize: Math.max(1, Math.min(Number(process.env.PF_WORKER_BATCH_SIZE ?? 10), 50)),
    phoneSendsPerSecond: Math.max(0.1, Math.min(Number(process.env.PF_PILOT_PHONE_SENDS_PER_SECOND ?? 1), 20)),
    timeBudgetSeconds: Math.max(5, Math.min(Number(process.env.PF_WORKER_TIME_BUDGET_SECONDS ?? 20), 50)),
  };
}
