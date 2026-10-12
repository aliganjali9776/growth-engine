import { sessionRuntime } from "@/lib/server/session";
import {
  changeAccess,
  platformOverview,
  requirePlatformAdmin,
} from "@/lib/server/services/platform-admin";
import { safeDataError, DataError } from "@/lib/server/db/errors";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handle(request: Request) {
  try {
    const { db, user } = await sessionRuntime(request.headers);
    await requirePlatformAdmin(db, user.id);
    if (request.method === "GET")
      return Response.json(await platformOverview(db, user.id), {
        headers: { "Cache-Control": "no-store" },
      });
    if (
      request.headers.get("origin") !== process.env.BETTER_AUTH_URL ||
      !request.headers.get("content-type")?.startsWith("application/json")
    )
      throw new DataError("Forbidden", 403);
    const reader = request.body?.getReader();
    if (!reader) throw new DataError("InvalidInput");
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.length;
        if (size > 4096) {
          await reader.cancel();
          throw new DataError("InvalidInput", 413);
        }
        chunks.push(part.value);
      }
    } finally {
      reader.releaseLock();
    }
    let body;
    try {
      body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      throw new DataError("InvalidInput");
    }
    if (
      !body ||
      !["grant", "revoke", "approve", "reject"].includes(body.operation) ||
      typeof body.organizationId !== "string" ||
      typeof body.previousTier !== "string"
    )
      throw new DataError("InvalidInput");
    const result = await changeAccess(db, user.id, {
      organizationId: body.organizationId,
      previousTier: body.previousTier,
      tier:
        body.operation === "grant" || body.operation === "approve"
          ? "full_access"
          : "assessment_only",
      confirmed: body.confirmed,
      reason: body.reason,
      requestId: body.requestId,
      reject: body.operation === "reject",
    });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const safe = safeDataError(error);
    return Response.json(
      { error: { code: safe.code } },
      { status: safe.status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
export const GET = handle;
export const POST = handle;
