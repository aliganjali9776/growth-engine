import { sql } from "drizzle-orm";
import { appMode, getSaaSRuntime } from "@/lib/server/saas-runtime";
import journal from "@/drizzle/meta/_journal.json";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  try {
    if (appMode() === "saas") {
      const { db } = await getSaaSRuntime();
      await db.execute(sql`SELECT id FROM organizations LIMIT 1`);
      const result = await db.execute(
        sql`SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations`,
      );
      if (
        Number((result as { rows: { count: number }[] }).rows[0]?.count) !==
        journal.entries.length
      )
        throw Error("MigrationMissing");
    }
    return Response.json({ status: "ready" }, { headers });
  } catch {
    return Response.json({ status: "not_ready" }, { status: 503, headers });
  }
}
