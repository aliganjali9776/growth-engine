import { appMode, getSaaSRuntime } from "@/lib/server/saas-runtime";
import { activeContext } from "@/lib/server/session";
import { exportOrganization } from "@/lib/server/services/migration";
import { DataError, safeDataError } from "@/lib/server/db/errors";

export async function GET(request: Request) {
  if (appMode() !== "saas") return new Response(null, { status: 404 });
  try {
    const { db, auth } = await getSaaSRuntime();
    const { context } = await activeContext(db, auth, request.headers);
    // Native download links cannot set a custom header. Bind their explicit
    // target to the fresh session to prevent a switch downloading another org.
    if (new URL(request.url).searchParams.get("organizationId") !== context.organizationId) throw new DataError("Conflict", 409);
    const data = await exportOrganization(db, context);
    return new Response(JSON.stringify(data, null, 2), { headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="growth-engine-server-${context.organizationId}-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer",
    } });
  } catch (error) {
    const safe = safeDataError(error);
    return Response.json({ error: { code: safe.code } }, { status: safe.status, headers: { "Cache-Control": "no-store" } });
  }
}
