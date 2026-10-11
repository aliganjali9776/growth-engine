import "server-only";
import { and, eq, asc } from "drizzle-orm";
import type { Database } from "../db/types";
import {
  processes,
  objectives,
  experiments,
  agentSessions,
  auditEvents,
} from "../db/schema";
import { requireScope } from "../context";
const scope = (organizationId: string) => {
  requireScope(organizationId);
  return organizationId;
};
export class SystemRepository {
  constructor(private readonly db: Database) {}
  listProcesses(organizationId: string) {
    return this.db
      .select()
      .from(processes)
      .where(eq(processes.organizationId, scope(organizationId)))
      .orderBy(asc(processes.code))
      .limit(500);
  }
  async getProcess(input: { organizationId: string; processId: string }) {
    scope(input.organizationId);
    requireScope(input.processId);
    const [r] = await this.db
      .select()
      .from(processes)
      .where(
        and(
          eq(processes.organizationId, input.organizationId),
          eq(processes.id, input.processId),
        ),
      );
    return r ?? null;
  }
}
export class StrategyRepository {
  constructor(private readonly db: Database) {}
  listObjectives(organizationId: string) {
    return this.db
      .select()
      .from(objectives)
      .where(eq(objectives.organizationId, scope(organizationId)))
      .orderBy(asc(objectives.code))
      .limit(500);
  }
  async getObjective(input: { organizationId: string; objectiveId: string }) {
    scope(input.organizationId);
    requireScope(input.objectiveId);
    const [r] = await this.db
      .select()
      .from(objectives)
      .where(
        and(
          eq(objectives.organizationId, input.organizationId),
          eq(objectives.id, input.objectiveId),
        ),
      );
    return r ?? null;
  }
}
export class ScaleRepository {
  constructor(private readonly db: Database) {}
  listExperiments(organizationId: string) {
    return this.db
      .select()
      .from(experiments)
      .where(eq(experiments.organizationId, scope(organizationId)))
      .orderBy(asc(experiments.code))
      .limit(500);
  }
  async getExperiment(input: { organizationId: string; experimentId: string }) {
    scope(input.organizationId);
    requireScope(input.experimentId);
    const [r] = await this.db
      .select()
      .from(experiments)
      .where(
        and(
          eq(experiments.organizationId, input.organizationId),
          eq(experiments.id, input.experimentId),
        ),
      );
    return r ?? null;
  }
}
export class AgentRepository {
  constructor(private readonly db: Database) {}
  listSessions(organizationId: string, createdByUserId: string) {
    requireScope(createdByUserId);
    return this.db
      .select()
      .from(agentSessions)
      .where(
        and(
          eq(agentSessions.organizationId, scope(organizationId)),
          eq(agentSessions.createdByUserId, createdByUserId),
        ),
      )
      .orderBy(asc(agentSessions.createdAt))
      .limit(100);
  }
  listAudit(organizationId: string) {
    return this.db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.organizationId, scope(organizationId)))
      .orderBy(asc(auditEvents.createdAt))
      .limit(500);
  }
}
