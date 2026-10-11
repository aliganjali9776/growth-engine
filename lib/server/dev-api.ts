import "server-only";
import { timingSafeEqual } from "node:crypto";
import type { Database } from "./db/types";
import { organizations } from "./db/schema";
import { DataError, safeDataError } from "./db/errors";
import { requireOrganizationContext } from "./context";
import { OrganizationRepository } from "./repositories/organization";
import { StrategyService } from "./services/domains";
import { createOrganizationWithOwner } from "./services/organization";
export interface DevConfiguration {
  environment: string;
  enabled: boolean;
  token: string;
  actorUserId: string;
}
const response = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
export function createDevHandlers(
  getDb: () => Database,
  configuration: DevConfiguration,
) {
  function authorize(request: Request) {
    if (
      configuration.environment === "production" ||
      !configuration.enabled ||
      configuration.token.length < 32
    )
      throw new DataError("Disabled", 404);
    const url = new URL(request.url),
      host = request.headers.get("host");
    if (
      !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
      host !== url.host
    )
      throw new DataError("Forbidden", 403);
    const supplied = Buffer.from(request.headers.get("x-saas-dev-token") ?? ""),
      expected = Buffer.from(configuration.token);
    if (
      supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)
    )
      throw new DataError("Forbidden", 403);
    if (
      request.method === "POST" &&
      request.headers.get("origin") !== url.origin
    )
      throw new DataError("Forbidden", 403);
  }
  const actor = {
    resolveUserId: async () => configuration.actorUserId || null,
  };
  async function handle(request: Request) {
    try {
      authorize(request);
      const db = getDb(),
        url = new URL(request.url);
      if (request.method === "GET") {
        if (url.searchParams.get("operation") === "health") {
          await db
            .select({ id: organizations.id })
            .from(organizations)
            .limit(1);
          return response({
            status: "ready",
            driver: "postgresql",
            developmentOnly: true,
          });
        }
        const organizationId = url.searchParams.get("organizationId");
        if (!organizationId)
          return response({
            organizations: await new OrganizationRepository(db).listForUser(
              configuration.actorUserId,
            ),
          });
        const context = await requireOrganizationContext(
          db,
          actor,
          organizationId,
        );
        return response({
          objectives: await new StrategyService(db).list(context),
        });
      }
      if (!request.headers.get("content-type")?.startsWith("application/json"))
        throw new DataError("InvalidInput");
      const reader = request.body?.getReader();
      if (!reader) throw new DataError("InvalidInput");
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          size += chunk.value.length;
          if (size > 8192) {
            await reader.cancel();
            throw new DataError("InvalidInput", 413);
          }
          chunks.push(chunk.value);
        }
      } finally {
        reader.releaseLock();
      }
      let body: Record<string, unknown>;
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
          throw Error();
        body = parsed;
      } catch {
        throw new DataError("InvalidInput");
      }
      if (body.operation === "createOrganization") {
        if (
          Object.keys(body).some(
            (k) => !["operation", "name", "slug"].includes(k),
          ) ||
          typeof body.name !== "string" ||
          typeof body.slug !== "string"
        )
          throw new DataError("InvalidInput");
        return response(
          await createOrganizationWithOwner(db, configuration.actorUserId, {
            name: body.name,
            slug: body.slug,
          }),
          201,
        );
      }
      if (body.operation === "createObjective") {
        if (
          Object.keys(body).some(
            (k) =>
              ![
                "operation",
                "organizationId",
                "cycleId",
                "code",
                "title",
                "startDate",
                "deadline",
                "description",
              ].includes(k),
          )
        )
          throw new DataError("InvalidInput");
        for (const key of [
          "organizationId",
          "cycleId",
          "code",
          "title",
          "startDate",
          "deadline",
        ])
          if (typeof body[key] !== "string")
            throw new DataError("InvalidInput");
        const context = await requireOrganizationContext(
          db,
          actor,
          body.organizationId as string,
        );
        return response(
          await new StrategyService(db).createDraft(
            context,
            {
              cycleId: body.cycleId as string,
              code: body.code as string,
              title: body.title as string,
              startDate: body.startDate as string,
              deadline: body.deadline as string,
              description:
                typeof body.description === "string"
                  ? body.description
                  : undefined,
            },
            request.headers.get("idempotency-key") ?? "",
          ),
          201,
        );
      }
      throw new DataError("InvalidInput");
    } catch (error) {
      const safe = safeDataError(error);
      return response({ error: { code: safe.code } }, safe.status);
    }
  }
  return { GET: handle, POST: handle };
}
