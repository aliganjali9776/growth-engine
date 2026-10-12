import "server-only";
import type { Database } from "./db/types";
import type { SaaSAuth } from "./auth";
import { and, eq, sql } from "drizzle-orm";
import * as S from "./db/schema";
import { authenticatedSession, activeContext } from "./session";
import { safeDataError, DataError } from "./db/errors";
import { reauthorize, resolveOrganizationContext } from "./context";
import * as C from "./services/companies";
import * as AgentAuthorization from "./services/agent-authorization";
import { requireFullAccess, requestAccess } from "./services/platform-admin";
import {
  previewDataMigration,
  listDataMigrations,
  executeDataMigration,
} from "./services/data-migration";
import {
  readTenantWorkspace,
  writeTenantWorkspace,
} from "./services/workspace";
export function createSaaSHandlers(
  db: Database,
  auth: SaaSAuth,
  baseURL: string,
) {
  const reply = (value: unknown, status = 200) =>
    Response.json(value, {
      status,
      headers: {
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  return async function handle(request: Request) {
    try {
      if (
        request.method === "POST" &&
        request.headers.get("origin") !== baseURL
      )
        throw new DataError("Forbidden", 403);
      const identity = await authenticatedSession(db, auth, request.headers),
        url = new URL(request.url);
      if (request.method === "GET") {
        const operation = url.searchParams.get("operation") ?? "context";
        if (operation === "context") {
          const organizations = await C.listOrganizations(db, identity.user.id);
          let current = null;
          if (identity.session.activeOrganizationId) {
            try {
              const a = await activeContext(db, auth, request.headers);
              current = {
                organization: organizations.find(
                  (o) => o.id === a.context.organizationId,
                ),
                permissions: a.context.permissions,
              };
            } catch {
              /* stale selection cannot authorize */
            }
          }
          return reply({
            user: {
              id: identity.user.id,
              name: identity.user.name,
              email: identity.user.email,
              avatarUrl: identity.user.avatarUrl,
              locale: identity.user.locale,
              timezone: identity.user.timezone,
            },
            organizations,
            current,
            next: organizations.length
              ? "/organizations"
              : "/onboarding/company",
          });
        }
        const { context } = await activeContext(db, auth, request.headers);
        if (request.headers.get("x-organization-id") !== context.organizationId)
          throw new DataError("Conflict", 409);
        if (operation === "workspace")
          return reply(await readTenantWorkspace(db, context));
        if (!["company"].includes(operation)) await requireFullAccess(db,context);
        if (operation === "dataMigrations")
          return reply({ migrations: await listDataMigrations(db, context) });
        if (operation === "members")
          return reply(await C.membersView(db, context));
        if (operation === "agentActions")
          return reply(await AgentAuthorization.listAgentActions(db, context));
        if (operation === "audit") {
          await reauthorize(db, context, "audit.view");
          return reply({
            events: await db
              .select()
              .from(S.auditEvents)
              .where(eq(S.auditEvents.organizationId, context.organizationId))
              .limit(200),
          });
        }
        if (operation === "company") {
          await reauthorize(db, context, "organization.view");
          const [company] = await db
            .select()
            .from(S.organizations)
            .where(eq(S.organizations.id, context.organizationId));
          return reply({ company });
        }
        throw new DataError("InvalidInput");
      }
      if (!request.headers.get("content-type")?.startsWith("application/json"))
        throw new DataError("InvalidInput");
      const max = ["workspace", "previewDataMigration", "executeDataMigration"].includes(
        url.searchParams.get("operation") ?? "",
      )
        ? 8 * 1024 * 1024
        : 12000;
      const reader = request.body?.getReader();
      if (!reader) throw new DataError("InvalidInput");
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          size += part.value.length;
          if (size > max) {
            await reader.cancel();
            throw new DataError("InvalidInput", 413);
          }
          chunks.push(part.value);
        }
      } finally {
        reader.releaseLock();
      }
      let body: Record<string, any>;
      try {
        body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (!body || typeof body !== "object" || Array.isArray(body))
          throw Error();
      } catch {
        throw new DataError("InvalidInput");
      }
      if (
        [
          "userId",
          "actorUserId",
          "requestedByUserId",
          "preparedByUserId",
          "approvedByUserId",
          "executedByUserId",
          "permissions",
        ].some((k) => k in body)
      )
        throw new DataError("InvalidInput");
      if (body.operation === "createCompany") {
        for (const key of [
          "name",
          "industry",
          "businessModel",
          "teamSize",
          "country",
          "currency",
          "timezone",
        ])
          if (typeof body[key] !== "string")
            throw new DataError("InvalidInput");
        const made = await C.createCompany(
          db,
          identity.user.id,
          body as C.CompanyInput,
        );
        await C.switchOrganization(
          db,
          identity.user.id,
          identity.session.id,
          made.organization.id,
        );
        return reply({ organization: made.organization }, 201);
      }
      if (body.operation === "switch") {
        await C.switchOrganization(
          db,
          identity.user.id,
          identity.session.id,
          body.organizationId,
        );
        return reply({ ok: true });
      }
      if (body.operation === "acceptInvite") {
        const joined = await C.acceptInvitation(
          db,
          identity.user.id,
          body.token,
        );
        await C.switchOrganization(
          db,
          identity.user.id,
          identity.session.id,
          joined.organizationId,
        );
        return reply(joined);
      }
      if (body.operation === "profile") {
        if (
          typeof body.name !== "string" ||
          !body.name.trim() ||
          body.name.length > 160 ||
          typeof body.locale !== "string" ||
          body.locale.length > 32 ||
          typeof body.timezone !== "string"
        )
          throw new DataError("InvalidInput");
        try {
          new Intl.DateTimeFormat(body.locale, { timeZone: body.timezone });
        } catch {
          throw new DataError("InvalidInput");
        }
        if (
          body.avatarUrl &&
          (!/^https:\/\//.test(body.avatarUrl) || body.avatarUrl.length > 2000)
        )
          throw new DataError("InvalidInput");
        await db
          .update(S.users)
          .set({
            name: body.name.trim(),
            locale: body.locale,
            timezone: body.timezone,
            avatarUrl: body.avatarUrl || null,
            updatedAt: new Date(),
          })
          .where(eq(S.users.id, identity.user.id));
        return reply({ ok: true });
      }
      return await db.transaction(async (tx) => {
        // Serializes organization-switch vs workspace writes for the same session.
        const [session] = await tx
          .select()
          .from(S.authSessions)
          .where(
            and(
              eq(S.authSessions.id, identity.session.id),
              eq(S.authSessions.userId, identity.user.id),
            ),
          )
          .for("update");
        if (
          !session ||
          session.expiresAt <= new Date() ||
          !session.activeOrganizationId
        )
          throw new DataError("Forbidden", 401);
        const context = await resolveOrganizationContext(
          tx,
          identity.user.id,
          session.activeOrganizationId,
        );
        if (request.headers.get("x-organization-id") !== context.organizationId)
          throw new DataError("Conflict", 409);
        if (
          body.organizationId !== undefined &&
          body.organizationId !== context.organizationId
        )
          throw new DataError("Forbidden", 403);
        if (body.operation === "requestAccess") return reply(await requestAccess(tx,context));
        if (!["workspace","company"].includes(body.operation)) await requireFullAccess(tx,context);
        if (body.operation === "prepareAgentAction")
          return reply(
            await AgentAuthorization.prepareAgentAction(
              tx,
              context,
              body as Parameters<
                typeof AgentAuthorization.prepareAgentAction
              >[2],
            ),
            201,
          );
        if (body.operation === "previewDataMigration")
          return reply(
            await previewDataMigration(
              tx,
              context,
              body as Parameters<typeof previewDataMigration>[2],
            ),
          );
        if (body.operation === "executeDataMigration") {
          const result = await executeDataMigration(tx, context, body as Parameters<typeof executeDataMigration>[2]);
          return reply(result, result.status === "Failed" ? 422 : 200);
        }
        if (body.operation === "approveAgentAction")
          return reply(
            await AgentAuthorization.approveAgentAction(
              tx,
              context,
              body as Parameters<
                typeof AgentAuthorization.approveAgentAction
              >[2],
            ),
          );
        if (body.operation === "executeAgentAction")
          return reply(
            await AgentAuthorization.authorizeAgentExecution(
              tx,
              context,
              body as Parameters<
                typeof AgentAuthorization.authorizeAgentExecution
              >[2],
            ),
          );
        if (body.operation === "workspace")
          return reply(
            await writeTenantWorkspace(
              tx,
              context,
              body as Parameters<typeof writeTenantWorkspace>[2],
            ),
          );
        if (body.operation === "invite") {
          if (typeof body.email !== "string" || typeof body.role !== "string")
            throw new DataError("InvalidInput");
          const invitation = await C.inviteMember(tx, context, body.email, body.role);
          return reply({ ...invitation, url: new URL("/invite/" + invitation.token, baseURL).href }, 201);
        }
        if (body.operation === "changeMember")
          return reply(
            await C.changeMember(
              tx,
              context,
              body as Parameters<typeof C.changeMember>[2],
            ),
          );
        if (body.operation === "revokeInvite")
          return reply(
            await C.revokeInvitation(tx, context, body.invitationId),
          );
        if (body.operation === "company") {
          await reauthorize(tx, context, "organization.update");
          for (const key of [
            "name",
            "industry",
            "businessModel",
            "currency",
            "timezone",
          ])
            if (typeof body[key] !== "string" || body[key].length > 160)
              throw new DataError("InvalidInput");
          if (!body.name.trim() || !/^[A-Z]{3}$/.test(body.currency))
            throw new DataError("InvalidInput");
          try {
            new Intl.DateTimeFormat("fa", { timeZone: body.timezone });
          } catch {
            throw new DataError("InvalidInput");
          }
          const [updated] = await tx
            .update(S.organizations)
            .set({
              name: body.name.trim(),
              industry: body.industry,
              businessModel: body.businessModel,
              currency: body.currency,
              timezone: body.timezone,
              updatedAt: new Date(),
            })
            .where(eq(S.organizations.id, context.organizationId))
            .returning();
          await tx
            .update(S.organizationSettings)
            .set({
              currency: body.currency,
              timezone: body.timezone,
              version: sql`${S.organizationSettings.version}+1`,
              updatedAt: new Date(),
            })
            .where(
              eq(S.organizationSettings.organizationId, context.organizationId),
            );
          await tx.insert(S.auditEvents).values({
            organizationId: context.organizationId,
            actorUserId: identity.user.id,
            actorType: "User",
            module: "Organization",
            action: "OrganizationUpdated",
            entityType: "organization",
            entityId: context.organizationId,
            metadata: {
              fields: [
                "name",
                "industry",
                "businessModel",
                "currency",
                "timezone",
              ],
            },
          });
          return reply({ company: updated });
        }
        throw new DataError("InvalidInput");
      });
    } catch (error) {
      const safe = safeDataError(error);
      return reply(
        {
          error: {
            code: safe.code,
            message:
              safe.status === 403
                ? "شما برای انجام این عملیات دسترسی لازم را ندارید."
                : undefined,
          },
        },
        safe.status,
      );
    }
  };
}
