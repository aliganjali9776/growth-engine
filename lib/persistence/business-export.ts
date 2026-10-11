import {
  exportLocalWorkspace,
  localStoreKeys,
  validateLocalExport,
  type LocalBusinessOSExport,
} from "./export";

type Section = Record<string, string | null>;
export interface BusinessOSExport {
  schemaVersion: 2;
  applicationVersion?: string;
  exportedAt: string;
  sourceMode: "local";
  organizationProfile: Record<string, unknown> | null;
  assessment: Section;
  system: Section;
  strategy: Section;
  scale: Section;
  agent: Section;
  metadata: {
    localWorkspaceId: string;
    moduleVersions: Record<string, number | null>;
  };
}
export type BusinessModule =
  "assessment" | "system" | "strategy" | "scale" | "agent";
export interface MigrationIssue {
  code: string;
  path: string;
  targetId?: string;
}
export interface BusinessInspection {
  counts: Record<BusinessModule, Record<string, number>>;
  criticalReferences: number;
  errors: MigrationIssue[];
  warnings: MigrationIssue[];
}
export function moduleForStore(key: string): BusinessModule {
  if (key === localStoreKeys[0]) return "assessment";
  if (key === "growth-engine.strategy.v1") return "strategy";
  if (key === "growth-engine.scale.v1") return "scale";
  if (key.includes("agent") || key.includes("advisor")) return "agent";
  return "system";
}
export function businessExportFromLocal(value: unknown): BusinessOSExport {
  const local = validateLocalExport(value);
  const sections = {
    assessment: {},
    system: {},
    strategy: {},
    scale: {},
    agent: {},
  } as Record<BusinessModule, Section>;
  for (const key of localStoreKeys)
    sections[moduleForStore(key)][key] = local.stores[key];
  return {
    schemaVersion: 2,
    exportedAt: local.exportedAt,
    sourceMode: "local",
    organizationProfile: local.organizationProfile,
    ...sections,
    metadata: {
      localWorkspaceId: local.localWorkspaceId,
      moduleVersions: local.moduleVersions,
    },
  };
}
export function exportLocalBusiness(
  storage: Pick<Storage, "getItem">,
  workspaceId: string,
) {
  return businessExportFromLocal(exportLocalWorkspace(storage, workspaceId));
}
const modules: BusinessModule[] = [
  "assessment",
  "system",
  "strategy",
  "scale",
  "agent",
];
// Do not accept credential fields even when hidden in otherwise valid business JSON.
const forbidden = new Set([
  "password",
  "passwordHash",
  "password_hash",
  "accessToken",
  "refreshToken",
  "sessionSecret",
  "tokenHash",
  "token_hash",
  "invitationToken",
  "rawInvitationToken",
  "apiKey",
  "api_key",
  "apiSecret",
  "api_secret",
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "environmentSecrets",
  "environment_secrets",
  "__proto__",
  "prototype",
  "constructor",
]);
function safeTree(value: unknown, depth = 0): void {
  if (depth > 64) throw Error("InvalidBusinessExport");
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (forbidden.has(key)) throw Error("ForbiddenBusinessExportField");
    safeTree(child, depth + 1);
  }
}
export function assertBusinessBackupHasNoSecrets(value: unknown) {
  safeTree(value);
}
export function validateBusinessExport(value: unknown): BusinessOSExport {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("InvalidBusinessExport");
  const e = value as BusinessOSExport;
  if (
    e.schemaVersion !== 2 ||
    e.sourceMode !== "local" ||
    !e.metadata ||
    (e.applicationVersion !== undefined &&
      (typeof e.applicationVersion !== "string" ||
        e.applicationVersion.length > 80))
  )
    throw Error("InvalidBusinessExport");
  if (
    Object.keys(e).some(
      (k) =>
        ![
          "schemaVersion",
          "applicationVersion",
          "exportedAt",
          "sourceMode",
          "organizationProfile",
          ...modules,
          "metadata",
        ].includes(k),
    )
  )
    throw Error("InvalidBusinessExport");
  const stores: Section = {};
  for (const module of modules) {
    const section = e[module];
    if (!section || typeof section !== "object" || Array.isArray(section))
      throw Error("InvalidBusinessExport");
    const expected = localStoreKeys.filter(
      (key) => moduleForStore(key) === module,
    );
    if (
      Object.keys(section).length !== expected.length ||
      Object.keys(section).some(
        (key) => !expected.includes(key as (typeof localStoreKeys)[number]),
      )
    )
      throw Error("InvalidBusinessExport");
    Object.assign(stores, section);
  }
  if (new TextEncoder().encode(JSON.stringify(e)).length > 32 * 1024 * 1024)
    throw Error("BusinessExportTooLarge");
  for (const raw of Object.values(stores))
    if (raw !== null) safeTree(JSON.parse(raw));
  const local = validateLocalExport({
    schemaVersion: 1,
    source: "browser-local-v1",
    exportedAt: e.exportedAt,
    localWorkspaceId: e.metadata.localWorkspaceId,
    moduleVersions: e.metadata.moduleVersions,
    stores,
  });
  // Profile is derived from the assessment payload, never a second conflicting source.
  if (
    JSON.stringify(e.organizationProfile) !==
    JSON.stringify(local.organizationProfile)
  )
    throw Error("ConflictingExportProfile");
  return {
    ...businessExportFromLocal(local),
    ...(e.applicationVersion
      ? { applicationVersion: e.applicationVersion }
      : {}),
  };
}
export function localEnvelope(value: BusinessOSExport): LocalBusinessOSExport {
  const e = validateBusinessExport(value);
  return validateLocalExport({
    schemaVersion: 1,
    source: "browser-local-v1",
    exportedAt: e.exportedAt,
    localWorkspaceId: e.metadata.localWorkspaceId,
    moduleVersions: e.metadata.moduleVersions,
    stores: Object.assign({}, ...modules.map((module) => e[module])),
  });
}

// Shape validators remain the same pure validators used by local mode. This
// inspection adds package-wide links that an individual store cannot validate.
export function inspectBusinessExport(value: unknown): BusinessInspection {
  const e = validateBusinessExport(value),
    stores = localEnvelope(e).stores;
  const get = (key: string): any =>
    stores[key as (typeof localStoreKeys)[number]]
      ? JSON.parse(stores[key as (typeof localStoreKeys)[number]]!)
      : {};
  const system = get("growth-engine.system.v1"),
    strategy = get("growth-engine.strategy.v1"),
    scale = get("growth-engine.scale.v1");
  const result: BusinessInspection = {
    counts: { assessment: {}, system: {}, strategy: {}, scale: {}, agent: {} },
    criticalReferences: 0,
    errors: [],
    warnings: [],
  };
  const collection = (
    module: BusinessModule,
    name: string,
    rows: any[] = [],
    key = "id",
  ) => {
    result.counts[module][name] = rows.length;
    const ids = new Set<string>();
    for (const row of rows) {
      if (!row || typeof row[key] !== "string" || !row[key])
        result.errors.push({ code: "MissingId", path: `${module}.${name}` });
      else if (ids.has(row[key]))
        result.errors.push({
          code: "DuplicateId",
          path: `${module}.${name}`,
          targetId: row[key],
        });
      else ids.add(row[key]);
    }
    return ids;
  };
  const ref = (
    path: string,
    id: unknown,
    ids: Set<string>,
    required = false,
  ) => {
    if (!id && !required) return;
    result.criticalReferences++;
    if (typeof id !== "string" || !ids.has(id))
      result.errors.push({
        code: "BrokenReference",
        path,
        ...(typeof id === "string" ? { targetId: id } : {}),
      });
  };
  const departments = collection("system", "departments", system.departments),
    roles = collection("system", "roles", system.roles),
    people = collection("system", "people", system.people),
    processes = collection("system", "processes", system.processes);
  for (const d of system.departments ?? []) {
    ref(
      `department.${d.id}.parentDepartmentId`,
      d.parentDepartmentId,
      departments,
    );
    ref(`department.${d.id}.managerRoleId`, d.managerRoleId, roles);
  }
  for (const r of system.roles ?? []) {
    ref(`role.${r.id}.departmentId`, r.departmentId, departments, true);
    ref(`role.${r.id}.personId`, r.personId, people);
    ref(`role.${r.id}.reportsToRoleId`, r.reportsToRoleId, roles);
  }
  for (const p of system.processes ?? []) {
    ref(`process.${p.id}.departmentId`, p.departmentId, departments);
    ref(`process.${p.id}.ownerRoleId`, p.ownerRoleId, roles);
  }
  for (const map of get("growth-engine.process-maps.v1").maps ?? []) {
    ref(`map.${map.processId}.processId`, map.processId, processes, true);
    const steps = collection(
        "system",
        `map.${map.processId}.${map.variant}.steps`,
        map.steps,
      ),
      edges = map.connections ?? [];
    collection(
      "system",
      `map.${map.processId}.${map.variant}.connections`,
      edges,
    );
    for (const s of map.steps ?? []) {
      ref(`step.${s.id}.ownerRoleId`, s.ownerRoleId, roles);
      if (s.processId !== map.processId)
        result.errors.push({
          code: "WrongParent",
          path: `step.${s.id}.processId`,
        });
    }
    for (const edge of edges) {
      ref(`edge.${edge.id}.source`, edge.sourceStepId, steps, true);
      ref(`edge.${edge.id}.target`, edge.targetStepId, steps, true);
    }
  }
  for (const key of [
    "growth-engine.process-analysis.v1",
    "growth-engine.process-standards.v1",
    "growth-engine.process-measurement.v1",
  ]) {
    const records = get(key).records ?? [];
    collection("system", key, records, "processId");
    for (const r of records)
      ref(`${key}.${r.processId}.processId`, r.processId, processes, true);
  }
  const cycles = collection("strategy", "cycles", strategy.cycles),
    objectives = collection("strategy", "objectives", strategy.objectives),
    krs = collection("strategy", "keyResults", strategy.keyResults),
    priorities = collection("strategy", "priorities", strategy.priorities);
  for (const key of [
    "contexts",
    "choices",
    "initiatives",
    "krCheckIns",
    "weeklyReviews",
    "strategyDecisions",
    "objectiveWeeklySnapshots",
    "strategyWeeklySnapshots",
    "adaptReviews",
    "cycleReviews",
    "strategyChanges",
    "strategyLearnings",
    "strategicAssumptions",
    "cycleResets",
  ]) {
    const rows = strategy[key] ?? [];
    if (
      key === "objectiveWeeklySnapshots" ||
      key === "strategyWeeklySnapshots"
    ) {
      result.counts.strategy[key] = rows.length;
      const seen = new Set<string>();
      for (const row of rows) {
        const id = `${row.reviewId}:${key === "objectiveWeeklySnapshots" ? row.objectiveId : row.cycleId}`;
        if (seen.has(id))
          result.errors.push({
            code: "DuplicateId",
            path: `strategy.${key}`,
            targetId: id,
          });
        seen.add(id);
      }
    } else
      collection("strategy", key, rows, key === "contexts" ? "cycleId" : "id");
    for (const row of rows) {
      if (row.cycleId)
        ref(`${key}.${row.id}.cycleId`, row.cycleId, cycles, true);
    }
  }
  for (const row of [
    ...(strategy.cycles ?? []),
    ...(strategy.priorities ?? []),
    ...(strategy.objectives ?? []),
    ...(strategy.keyResults ?? []),
    ...(strategy.initiatives ?? []),
  ])
    ref(`strategy.${row.id}.ownerRoleId`, row.ownerRoleId, roles);
  for (const o of strategy.objectives ?? []) {
    ref(`objective.${o.id}.cycleId`, o.cycleId, cycles, true);
    ref(`objective.${o.id}.relatedPriorityId`, o.relatedPriorityId, priorities);
  }
  for (const kr of strategy.keyResults ?? []) {
    ref(`kr.${kr.id}.objectiveId`, kr.objectiveId, objectives, true);
    ref(`kr.${kr.id}.cycleId`, kr.cycleId, cycles, true);
    if (
      (strategy.objectives ?? []).find((o: any) => o.id === kr.objectiveId)
        ?.cycleId !== kr.cycleId
    )
      result.errors.push({ code: "WrongParent", path: `kr.${kr.id}.cycleId` });
  }
  for (const i of strategy.initiatives ?? []) {
    ref(`initiative.${i.id}.objectiveId`, i.objectiveId, objectives, true);
    ref(`initiative.${i.id}.keyResultId`, i.keyResultId, krs);
    ref(
      `initiative.${i.id}.linkedSystemProcessId`,
      i.linkedSystemProcessId,
      processes,
    );
  }
  const constraints = collection("scale", "constraints", scale.constraints),
    ideas = collection("scale", "ideas", scale.ideas),
    levers = collection("scale", "levers", scale.levers);
  ref("scale.primaryConstraintId", scale.primaryConstraintId, constraints);
  ref(
    "scale.profile.linkedStrategyKRId",
    scale.profile?.linkedStrategyKRId,
    krs,
  );
  for (const c of scale.constraints ?? []) {
    ref(`constraint.${c.id}.ownerRoleId`, c.ownerRoleId, roles);
    ref(
      `constraint.${c.id}.objectiveId`,
      c.linkedStrategyObjectiveId,
      objectives,
    );
    ref(`constraint.${c.id}.krId`, c.linkedStrategyKRId, krs);
    ref(`constraint.${c.id}.processId`, c.linkedSystemProcessId, processes);
    for (const id of c.leverIds ?? [])
      ref(`constraint.${c.id}.leverIds`, id, levers, true);
  }
  for (const i of scale.ideas ?? []) {
    ref(`idea.${i.id}.constraintId`, i.constraintId, constraints);
    ref(`idea.${i.id}.leverId`, i.leverId, levers);
    ref(`idea.${i.id}.ownerRoleId`, i.ownerRoleId, roles);
  }
  const experiments = collection(
    "scale",
    "experiments",
    scale.experimentData?.experiments,
  );
  for (const x of scale.experimentData?.experiments ?? []) {
    ref(`experiment.${x.id}.constraintId`, x.constraintId, constraints);
    ref(`experiment.${x.id}.ideaId`, x.ideaId, ideas);
    ref(`experiment.${x.id}.ownerRoleId`, x.ownerRoleId, roles);
    ref(
      `experiment.${x.id}.parentExperimentId`,
      x.parentExperimentId,
      experiments,
    );
  }
  for (const key of ["measurements", "learnings", "decisions", "ideaReviews"]) {
    const rows = scale.experimentData?.[key] ?? [];
    collection("scale", key, rows);
    for (const row of rows)
      ref(`${key}.${row.id}.experimentId`, row.experimentId, experiments, true);
  }
  for (const [storeKey, raw] of Object.entries(stores)) {
    if (moduleForStore(storeKey) !== "agent" || !raw) continue;
    const data = JSON.parse(raw);
    for (const [key, rows] of Object.entries(data))
      if (Array.isArray(rows)) collection("agent", `${storeKey}.${key}`, rows);
    if (data.session)
      collection("agent", `${storeKey}.sessions`, [data.session]);
  }
  const diagnosis = get("growth-engine.agent.diagnosis.v1"),
    preparation = get("growth-engine.agent.preparation.v1"),
    execution = get("growth-engine.agent.execution.v1");
  const diagnosisIds = new Set<string>(
      (diagnosis.diagnoses ?? []).map((x: any) => x.id),
    ),
    recommendationIds = new Set<string>(
      (preparation.recommendations ?? []).map((x: any) => x.id),
    ),
    actionIds = new Set<string>(
      (preparation.actions ?? []).map((x: any) => x.id),
    ),
    approvalIds = new Set<string>(
      (preparation.approvals ?? []).map((x: any) => x.id),
    );
  for (const a of preparation.actions ?? []) {
    ref(`action.${a.id}.sourceDiagnosisId`, a.sourceDiagnosisId, diagnosisIds);
    ref(
      `action.${a.id}.sourceRecommendationId`,
      a.sourceRecommendationId,
      recommendationIds,
    );
  }
  for (const a of preparation.approvals ?? [])
    ref(
      `approval.${a.id}.proposedActionId`,
      a.proposedActionId,
      actionIds,
      true,
    );
  for (const r of execution.records ?? []) {
    ref(`execution.${r.id}.actionId`, r.actionId, actionIds, true);
    ref(`execution.${r.id}.approvalId`, r.approvalId, approvalIds, true);
  }
  if (Object.values(e.agent).some(Boolean))
    result.warnings.push({ code: "LegacyLocalActors", path: "agent" });
  result.counts.assessment.latest = stores[localStoreKeys[0]] ? 1 : 0;
  return result;
}
