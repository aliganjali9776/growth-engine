import "server-only";
import { and, eq, sql } from "drizzle-orm";
import type { Database } from "../db/types";
import {
  objectives,
  strategyCycles,
  auditEvents,
  idempotencyKeys,
  agentSessions,
} from "../db/schema";
import {
  type OrganizationContext,
  reauthorize,
  requireScope,
  requireAllPermissions,
} from "../context";
import { DataError, safeDataError } from "../db/errors";
import {
  SystemRepository,
  StrategyRepository,
  ScaleRepository,
  AgentRepository,
} from "../repositories/domains";
import {
  saveObjective,
  type StrategyStore,
  type StrategyObjective,
} from "../../strategy/model";
import { createHash, randomUUID } from "node:crypto";
export class SystemService {
  constructor(private db: Database) {}
  async list(context: OrganizationContext) {
    await reauthorize(this.db, context, "system.view");
    return new SystemRepository(this.db).listProcesses(context.organizationId);
  }
}
export class ScaleService {
  constructor(private db: Database) {}
  async list(context: OrganizationContext) {
    await reauthorize(this.db, context, "scale.view");
    return new ScaleRepository(this.db).listExperiments(context.organizationId);
  }
}
export class AgentService {
  constructor(private db: Database) {}
  async list(context: OrganizationContext) {
    await reauthorize(this.db, context, "agent.view");
    return new AgentRepository(this.db).listSessions(
      context.organizationId,
      context.userId,
    );
  }
  async createSession(context: OrganizationContext, title: string) {
    if (!title.trim() || title.length > 200)
      throw new DataError("InvalidInput");
    try {
      return await this.db.transaction(async (tx) => {
        await reauthorize(tx, context, "agent.recommend");
        const [r] = await tx
          .insert(agentSessions)
          .values({
            organizationId: context.organizationId,
            createdByUserId: context.userId,
            title: title.trim(),
            contextType: "executive",
          })
          .returning();
        await tx.insert(auditEvents).values({
          organizationId: context.organizationId,
          actorUserId: context.userId,
          actorType: "User",
          module: "Agent",
          action: "SessionCreated",
          entityType: "agentSession",
          entityId: r.id,
          metadata: { version: r.version },
        });
        return r;
      });
    } catch (error) {
      throw safeDataError(error);
    }
  }
  // No server Agent approval or execution method exists in 7A.
}
export interface ObjectiveInput {
  cycleId: string;
  code: string;
  title: string;
  startDate: string;
  deadline: string;
  description?: string;
}
export class StrategyService {
  constructor(private db: Database) {}
  async list(context: OrganizationContext) {
    await reauthorize(this.db, context, "strategy.view");
    return new StrategyRepository(this.db).listObjectives(
      context.organizationId,
    );
  }
  async createDraft(
    context: OrganizationContext,
    input: ObjectiveInput,
    key: string,
  ) {
    requireScope(input.cycleId);
    if (
      !key ||
      key.length > 120 ||
      !input.title?.trim() ||
      input.title.length > 200 ||
      !input.code?.trim() ||
      input.code.length > 40
    )
      throw new DataError("InvalidInput");
    const hash = createHash("sha256")
      .update(
        JSON.stringify([
          input.cycleId,
          input.code,
          input.title,
          input.startDate,
          input.deadline,
          input.description ?? "",
        ]),
      )
      .digest("hex");
    try {
      return await this.db.transaction(async (tx) => {
        await requireAllPermissions(tx, context, [
          "strategy.edit",
          "strategy.create",
          "strategy.objective.edit",
        ]);
        const [reservation] = await tx
          .insert(idempotencyKeys)
          .values({
            organizationId: context.organizationId,
            key,
            operation: "strategy.createDraftObjective",
            actorUserId: context.userId,
            requestHash: hash,
            status: "Pending",
          })
          .onConflictDoNothing()
          .returning();
        if (!reservation) {
          const [old] = await tx
            .select()
            .from(idempotencyKeys)
            .where(
              and(
                eq(idempotencyKeys.organizationId, context.organizationId),
                eq(idempotencyKeys.key, key),
                eq(idempotencyKeys.operation, "strategy.createDraftObjective"),
              ),
            );
          if (
            !old ||
            old.requestHash !== hash ||
            old.actorUserId !== context.userId ||
            old.status !== "Completed"
          )
            throw new DataError("Conflict", 409);
          return old.result as typeof objectives.$inferSelect;
        }
        const [cycle] = await tx
          .select()
          .from(strategyCycles)
          .where(
            and(
              eq(strategyCycles.organizationId, context.organizationId),
              eq(strategyCycles.id, input.cycleId),
            ),
          );
        if (!cycle) throw new DataError("NotFound", 404);
        const id = randomUUID(),
          now = new Date().toISOString();
        const candidate: StrategyObjective = {
          id,
          cycleId: cycle.id,
          code: input.code,
          title: input.title,
          description: input.description ?? "",
          ownerRoleId: "",
          relatedPriorityId: "",
          status: "draft",
          startDate: input.startDate,
          deadline: input.deadline,
          createdAt: now,
          updatedAt: now,
        };
        // Existing pure validator remains authoritative; no new health/progress formula.
        const store: StrategyStore = {
          version: 1,
          sample: false,
          cycles: [
            {
              ...cycle,
              ownerRoleId: cycle.ownerRoleId ?? "",
              status: cycle.status as "draft",
              cycleType: cycle.cycleType as "quarterly",
              closedAt: cycle.closedAt?.toISOString(),
              createdAt: cycle.createdAt.toISOString(),
              updatedAt: cycle.updatedAt.toISOString(),
            },
          ],
          contexts: [],
          priorities: [],
          choices: [],
          objectives: [],
        };
        try {
          saveObjective(store, candidate, []);
        } catch {
          throw new DataError("InvalidInput");
        }
        const [created] = await tx
          .insert(objectives)
          .values({
            organizationId: context.organizationId,
            id,
            cycleId: input.cycleId,
            code: input.code,
            title: input.title,
            description: input.description ?? "",
            startDate: input.startDate,
            deadline: input.deadline,
            status: "draft",
          })
          .returning();
        await tx.insert(auditEvents).values({
          organizationId: context.organizationId,
          actorUserId: context.userId,
          actorType: "User",
          module: "Strategy",
          action: "ObjectiveCreated",
          entityType: "objective",
          entityId: id,
          metadata: { version: created.version },
        });
        await tx
          .update(idempotencyKeys)
          .set({ status: "Completed", result: created, updatedAt: new Date() })
          .where(
            and(
              eq(idempotencyKeys.organizationId, context.organizationId),
              eq(idempotencyKeys.id, reservation.id),
            ),
          );
        return created;
      });
    } catch (error) {
      throw safeDataError(error);
    }
  }
  async updateTitle(
    context: OrganizationContext,
    id: string,
    version: number,
    title: string,
  ) {
    requireScope(id);
    if (
      !Number.isInteger(version) ||
      version < 1 ||
      !title.trim() ||
      title.length > 200
    )
      throw new DataError("InvalidInput");
    return this.db.transaction(async (tx) => {
      await reauthorize(tx, context, "strategy.edit");
      const [r] = await tx
        .update(objectives)
        .set({
          title,
          version: sql`${objectives.version}+1`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(objectives.organizationId, context.organizationId),
            eq(objectives.id, id),
            eq(objectives.version, version),
          ),
        )
        .returning();
      if (!r) throw new DataError("Conflict", 409);
      await tx.insert(auditEvents).values({
        organizationId: context.organizationId,
        actorUserId: context.userId,
        actorType: "User",
        module: "Strategy",
        action: "ObjectiveTitleChanged",
        entityType: "objective",
        entityId: id,
        metadata: { previousVersion: version, version: r.version },
      });
      return r;
    });
  }
}
