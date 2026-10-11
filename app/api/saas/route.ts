import { getSaaSRuntime, appMode } from "@/lib/server/saas-runtime";
import { createSaaSHandlers } from "@/lib/server/saas-api";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handle(request: Request) {
  if (appMode() !== "saas")
    return Response.json({ error: { code: "Disabled" } }, { status: 404 });
  try {
    const { db, auth } = await getSaaSRuntime();
    return await createSaaSHandlers(
      db,
      auth,
      process.env.BETTER_AUTH_URL!,
    )(request);
  } catch {
    return Response.json(
      { error: { code: "DatabaseUnavailable" } },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
export const GET = handle;
export const POST = handle;
