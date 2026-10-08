import { environmentStatus } from "@/server/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = environmentStatus();
  return Response.json(
    {
      status: status.databaseConfigured && status.metaConfigured ? "ready" : "configuration_required",
      service: "passion-fruit-web",
      timestamp: new Date().toISOString(),
      checks: {
        database: status.databaseConfigured,
        meta: status.metaConfigured,
        liveSends: status.liveSendsEnabled,
      },
      missingConfiguration: status.missing,
    },
    { status: status.databaseConfigured ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
