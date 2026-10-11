import "server-only";
import { and, eq, is, getTableColumns, getTableName } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import type { Database } from "../db/types";
import * as schema from "../db/schema";
import {
  type OrganizationContext,
  reauthorize,
  requirePermission,
} from "../context";
import { validateLocalExport } from "../../persistence/export";
import { DataError } from "../db/errors";
import { createHash } from "node:crypto";
import { assertBusinessBackupHasNoSecrets } from "../../persistence/business-export";
// Explicit business-only backup boundary. Newly added tables require review.
export const businessExportTables = new Set(
  `organization_profiles organization_settings
business_departments business_people business_roles business_role_responsibilities
department_managers business_organization_nodes processes process_maps process_steps
process_connections process_sops sop_procedures process_checklists checklist_items
process_decision_rules process_assets implementation_plans process_kpis kpi_entries
improvements system_snapshots process_analyses process_reviews strategy_cycles
strategy_priorities strategy_objectives key_results strategy_initiatives strategy_contexts
strategy_choices kr_milestones kr_check_ins strategy_weekly_reviews strategy_adapt_reviews
strategy_cycle_reviews strategy_snapshots strategy_learnings strategy_changes
strategic_assumptions strategy_cycle_resets growth_profiles growth_constraints
tenant_growth_levers growth_ideas growth_experiments growth_metrics growth_diagnostics
constraint_evidence constraint_levers experiment_metrics experiment_measurements
growth_funnels funnel_stages funnel_periods funnel_measurements funnel_revenue_models
growth_channels channel_periods growth_loops loop_nodes loop_periods loop_evidence
loop_leakage scale_candidates capacity_areas capacity_scenarios financial_capacity
scale_investments scale_preparation_items scale_decisions experiment_learnings
experiment_decisions idea_reviews idea_history channel_decisions scale_readiness_snapshots
scale_snapshots agent_sessions agent_messages agent_evidence agent_diagnoses
agent_recommendations agent_proposed_actions agent_approvals agent_execution_records
agent_diagnosis_history agent_action_revisions agent_rollback_records assessment_runs
assessment_answers assessment_domain_records system_domain_records
strategy_domain_records scale_domain_records agent_domain_records domain_store_headers`.split(/\s+/),
);
export async function stageLocalImport(
  db: Database,
  context: OrganizationContext,
  value: unknown,
) {
  await reauthorize(db, context, "organization.update");
  let archive;
  try {
    archive = validateLocalExport(value);
  } catch {
    throw new DataError("InvalidInput");
  }
  if (Buffer.byteLength(JSON.stringify(archive)) > 32 * 1024 * 1024)
    throw new DataError("InvalidInput");
  const hash = createHash("sha256")
    .update(JSON.stringify(archive.stores))
    .digest("hex");
  return db.transaction(async (tx) => {
    await reauthorize(tx, context, "organization.update");
    const [saved] = await tx
      .insert(schema.migrationImports)
      .values({
        organizationId: context.organizationId,
        importedByUserId: context.userId,
        exportSchemaVersion: 1,
        source: archive.source,
        contentHash: hash,
        archive,
        status: "Staged",
      })
      .onConflictDoNothing()
      .returning();
    if (saved) return saved;
    const [old] = await tx
      .select()
      .from(schema.migrationImports)
      .where(
        and(
          eq(schema.migrationImports.organizationId, context.organizationId),
          eq(schema.migrationImports.contentHash, hash),
        ),
      );
    return old;
  });
}
export async function exportOrganization(
  db: Database,
  context: OrganizationContext,
) {
  return db.transaction(
    async (tx) => {
      const fresh = await reauthorize(tx, context, "organization.update");
      requirePermission(fresh, "audit.view");
      requirePermission(fresh, "members.view");
      // Repeatable-read snapshot prevents an export spanning different committed revisions.
      const tables: Record<string, unknown[]> = {};
      const [organization] = await tx
        .select()
        .from(schema.organizations)
        .where(eq(schema.organizations.id, context.organizationId));
      for (const table of Object.values(schema))
        if (is(table, PgTable)) {
          const columns = getTableColumns(table);
          // Business backups must never contain membership, invitation, auth,
          // access-control or raw staged archives. Keep this allowlist explicit.
          const name = getTableName(table);
          if ("organizationId" in columns && businessExportTables.has(name))
            tables[getTableName(table)] = await tx
              .select()
              .from(table)
              .where(eq(columns.organizationId, context.organizationId));
        }
      const backup = {
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        source: "server-postgresql-v1",
        organization,
        moduleVersions: { system: 1, strategy: 1, scale: 1, agent: 1 },
        tables,
      };
      // Fail closed rather than disclose credentials or silently strip business fields.
      assertBusinessBackupHasNoSecrets(backup);
      return backup;
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
