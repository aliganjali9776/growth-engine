import { defaultPermissions, findCapability, permitted } from "../capabilities";
import { canonical } from "../actions";
import {
  preparationContext,
  type PreparationContext,
} from "../preparation/context";
import { approvalBinding } from "../preparation/engine";
import { validateAgentProposedAction } from "../preparation/validation";
import { template } from "../preparation/templates";
import type { PreparedAction, PreparationState } from "../preparation/types";
import { readPreparation, savePreparation } from "../../preparation-storage";
import { readExecution, saveExecution } from "../../execution-storage";
import { executable } from "./registry";
import {
  domainCommand,
  simulateDomain,
  commitDomain,
  createdEntity,
  matchesResult,
  resultRef,
  resultSnapshot,
} from "./adapters";
import type {
  ExecutionStorage,
  ExecutionState,
  AgentExecutionRecord,
  ExecutionActor,
  ExecutionErrorCode,
} from "./types";
import { saveIdea, persistScale } from "../../scale/persistence";
import { SCALE_KEY } from "../../scale/model";
export const localActor: ExecutionActor = {
  actorUserId: "local-user",
  organizationId: "local-organization",
  permissions: defaultPermissions,
};
export class ExecutionError extends Error {
  constructor(
    public code: ExecutionErrorCode,
    public detail = "",
  ) {
    super(messages[code]);
  }
}
const messages: Record<ExecutionErrorCode, string> = {
  ApprovalMissing: "ابتدا این اقدام را تأیید کنید.",
  ApprovalInvalid:
    "تأیید با نسخه فعلی مطابقت ندارد یا اعتبار آن پایان یافته است.",
  ActionStale:
    "داده‌های مرتبط از زمان تأیید تغییر کرده‌اند. اقدام باید دوباره بررسی شود.",
  CapabilityDisabled: "این قابلیت غیرفعال است.",
  ExecutionNotAllowed: "این نوع پیشنهاد در این نسخه قابل اجرا نیست.",
  DomainValidationFailed:
    "پیشنهاد با قواعد فعلی کسب‌وکار سازگار نیست؛ اطلاعات را بازبینی کنید.",
  EntityConflict:
    "رکوردی با این شناسه وجود دارد؛ برای جلوگیری از تکرار، اجرا متوقف شد.",
  DuplicateExecution: "این اقدام قبلاً اجرا شده است.",
  ExecutionFailed: "اجرا کامل نشد؛ وضعیت رکورد را بررسی کنید.",
  PostExecutionVerificationFailed:
    "ذخیره انجام شد اما نتیجه تأیید نشد؛ قبل از تکرار وضعیت کسب‌وکار را بررسی کنید.",
  RollbackNotSupported:
    "بازگردانی خودکار برای این اقدام پشتیبانی نمی‌شود؛ از مسیر بخش مربوط آن را بازبینی کنید.",
  StorageConflict: "اطلاعات هم‌زمان تغییر کرده است؛ صفحه را تازه کنید.",
  DependencyBlocked: "ابتدا گام پیش‌نیاز باید اجرا و نتیجه آن تأیید شود.",
};
function fail(code: ExecutionErrorCode, detail = ""): never {
  throw new ExecutionError(code, detail);
}
export function validateExecutableAction(
  a: PreparedAction,
  s: PreparationState,
  c: PreparationContext,
  e: ExecutionState,
  actor = localActor,
  at = new Date().toISOString(),
) {
  const policy = executable(a.templateId),
    cap = policy && findCapability(policy.capabilityId);
  if (!policy?.executionEnabled) fail("ExecutionNotAllowed");
  if (!cap?.enabled) fail("CapabilityDisabled");
  if (a.domain !== policy.domain || !["Low", "Medium"].includes(a.riskLevel))
    fail("ExecutionNotAllowed");
  if (!["Approved", "ReadyToExecute"].includes(a.status))
    fail("ApprovalMissing");
  const approval = [...s.approvals]
    .reverse()
    .find((r) => r.proposedActionId === a.id && r.status === "Approved");
  if (!approval) fail("ApprovalMissing");
  if (
    approval.binding !== approvalBinding(a, s) ||
    Date.parse(approval.expiresAt) <= Date.parse(at)
  )
    fail("ApprovalInvalid");
  if (
    !actor.actorUserId ||
    !actor.organizationId ||
    !permitted(cap, actor.permissions)
  )
    fail("ExecutionNotAllowed");
  const v = validateAgentProposedAction(a, s, c, actor.permissions, at);
  if (v.status === "Stale") fail("ActionStale");
  if (v.status !== "Valid")
    fail("DomainValidationFailed", [...v.missing, ...v.errors].join(" "));
  const target = template(a.templateId).targetType,
    paths: Record<string, string> = {
      process: "processId",
      cycle: "cycleId",
      objective: "objectiveId",
      KR: "keyResultId",
      constraint: "constraintId",
      candidate: "candidateId",
    };
  if (
    target &&
    a.targetEntityId &&
    a.payload[paths[target]] !== a.targetEntityId
  )
    fail("DomainValidationFailed", "Primary target metadata mismatch");
  if (
    ["Objective", "KR", "Initiative"].includes(a.templateId) &&
    c.strategy?.cycles.find((x) => x.id === a.payload.cycleId)?.status !==
      "active"
  )
    fail("DomainValidationFailed", "An active cycle is required");
  for (const id of a.dependencyIds) {
    const p = s.plans.find((p) => p.dependencies.some((d) => d.id === id)),
      d = p?.dependencies.find((d) => d.id === id),
      step = p?.steps.find((x) => x.id === d?.fromStepId),
      record = e.records.find(
        (r) =>
          r.actionId === step?.proposedActionId && r.status === "Succeeded",
      );
    if (!record) fail("DependencyBlocked");
    const prior = s.actions.find((x) => x.id === record.actionId);
    if (!prior || !matchesResult(prior, createdEntity(c, prior)))
      fail("DependencyBlocked");
  }
  if (
    e.records.some(
      (r) =>
        r.actionId === a.id && ["Succeeded", "RolledBack"].includes(r.status),
    )
  )
    fail("DuplicateExecution");
  return { approval, policy, validation: v };
}
function load(storage: ExecutionStorage) {
  const p = readPreparation(storage),
    e = readExecution(storage);
  if (p.error || e.error) fail("StorageConflict", p.error ?? e.error);
  return { p, e, c: preparationContext(storage) };
}
export function dryRunAction(
  storage: ExecutionStorage,
  id: string,
  actor = localActor,
) {
  const { p, e, c } = load(storage),
    a = p.state.actions.find((a) => a.id === id);
  if (!a) fail("ApprovalMissing");
  const valid = validateExecutableAction(a, p.state, c, e.state, actor);
  if (createdEntity(c, a)) fail("EntityConflict");
  const simulation = simulateDomain(a, c);
  return {
    success: true,
    command: domainCommand(a),
    approvalId: valid.approval.id,
    binding: approvalBinding(a, p.state),
    revision: a.revision,
    entityRef: resultRef(a),
    beforeSnapshot: { exists: false, parentEntityId: a.targetEntityId },
    afterSnapshot: resultSnapshot(a, a.payload),
    warnings: valid.validation.warnings,
    simulationKey: simulation.key,
  };
}
function audit(
  s: ExecutionState,
  r: AgentExecutionRecord,
  event: ExecutionState["audit"][number]["event"],
  summary: string,
) {
  s.audit.push({
    id: crypto.randomUUID(),
    executionId: r.id,
    event,
    at: new Date().toISOString(),
    summary,
  });
}
function validationFailure(
  storage: ExecutionStorage,
  a: PreparedAction,
  p: PreparationState,
  e: { state: ExecutionState; raw: string | null },
  actor: ExecutionActor,
  error: ExecutionError,
) {
  const policy = executable(a.templateId);
  if (!policy) return;
  let r = e.state.records.find((r) => r.actionId === a.id);
  if (r && ["Succeeded", "RolledBack"].includes(r.status)) return;
  if (!r) {
    r = {
      id: crypto.randomUUID(),
      actionId: a.id,
      approvalId:
        p.approvals.filter((x) => x.proposedActionId === a.id).at(-1)?.id ??
        "missing",
      approvedRevision: a.revision,
      binding: approvalBinding(a, p),
      commandId: "command:" + a.id,
      capabilityId: policy.capabilityId,
      domain: policy.domain,
      riskLevel: a.riskLevel,
      templateId: a.templateId,
      command: domainCommand(a),
      beforeSnapshot: { exists: false, parentEntityId: a.targetEntityId },
      entityRefs: [],
      startedAt: new Date().toISOString(),
      status: "Failed",
      rollbackSupported: false,
      rollbackRecordId: crypto.randomUUID(),
      actorUserId: actor.actorUserId,
      organizationId: actor.organizationId,
      origin: a.origin,
    };
    e.state.records.push(r);
    e.state.rollbacks.push({
      id: r.rollbackRecordId,
      executionId: r.id,
      supported: false,
      rollbackType: "NotSupported",
      status: "NotSupported",
      createdAt: r.startedAt,
    });
  }
  r.status = "Failed";
  r.error = error.code;
  r.technicalDetail = error.detail;
  r.completedAt = new Date().toISOString();
  audit(e.state, r, "ExecutionRequested", "اجرای صریح درخواست شد.");
  audit(e.state, r, "ExecutionValidationFailed", error.message);
  saveExecution(storage, e.state, e.raw);
}
const busy = new WeakSet<object>();
export function executeAction(
  storage: ExecutionStorage,
  id: string,
  confirmation: { explicit: true; dryRunBinding: string },
  actor = localActor,
) {
  if(storage.serverExecutionDisabled)fail("ExecutionNotAllowed");
  if (busy.has(storage)) fail("StorageConflict");
  busy.add(storage);
  try {
    return perform(storage, id, confirmation, actor);
  } finally {
    busy.delete(storage);
  }
}
function perform(
  storage: ExecutionStorage,
  id: string,
  confirmation: { explicit: true; dryRunBinding: string },
  actor: ExecutionActor,
) {
  let { p, e, c } = load(storage);
  const a = p.state.actions.find((a) => a.id === id);
  if (!a) fail("ApprovalMissing");
  const previous = e.state.records.find((r) => r.actionId === id);
  if (previous && ["Succeeded", "RolledBack"].includes(previous.status))
    return previous;
  if (confirmation.explicit !== true) fail("ExecutionNotAllowed");
  // Interrupted write recovery: verify an existing exact result before considering a retry.
  if (previous && createdEntity(c, a)) {
    if (
      previous.binding !== approvalBinding(a, p.state) ||
      !matchesResult(a, createdEntity(c, a))
    )
      fail("EntityConflict");
    if (
      !permitted(findCapability(previous.capabilityId)!, actor.permissions) ||
      previous.actorUserId !== actor.actorUserId ||
      previous.organizationId !== actor.organizationId
    )
      fail("ExecutionNotAllowed");
    previous.status = "Succeeded";
    previous.error = undefined;
    previous.completedAt = new Date().toISOString();
    previous.afterSnapshot = resultSnapshot(a, createdEntity(c, a));
    previous.entityRefs = [resultRef(a)];
    audit(
      e.state,
      previous,
      "ExecutionSucceeded",
      "نتیجه اجرای قبلی از منبع مرجع تأیید شد؛ هیچ نوشتن مجددی انجام نشد.",
    );
    saveExecution(storage, e.state, e.raw);
    finishAction(storage, a.id);
    return previous;
  }
  let valid: ReturnType<typeof validateExecutableAction>;
  try {
    valid = validateExecutableAction(a, p.state, c, e.state, actor);
    if (confirmation.dryRunBinding !== approvalBinding(a, p.state))
      fail("ApprovalInvalid");
  } catch (error) {
    if (error instanceof ExecutionError)
      validationFailure(storage, a, p.state, e, actor, error);
    if (
      error instanceof ExecutionError &&
      ["ActionStale", "ApprovalInvalid"].includes(error.code)
    ) {
      a.status = "NeedsReview";
      a.validation.status =
        error.code === "ActionStale" ? "Stale" : a.validation.status;
      for (const approval of p.state.approvals.filter(
        (r) => r.proposedActionId === id && r.status === "Approved",
      ))
        approval.status = "Expired";
      savePreparation(storage, p.state, p.raw);
    }
    throw error;
  }
  if (createdEntity(c, a)) fail("EntityConflict");
  let simulation: ReturnType<typeof simulateDomain>;
  try {
    simulation = simulateDomain(a, c);
  } catch (error) {
    const failure = new ExecutionError(
      "DomainValidationFailed",
      error instanceof Error ? error.message : "Domain command rejected",
    );
    validationFailure(storage, a, p.state, e, actor, failure);
    throw failure;
  }
  const expected = storage.getItem(simulation.key),
    now = new Date().toISOString();
  if (previous && previous.binding !== approvalBinding(a, p.state))
    fail("ApprovalInvalid");
  const record: AgentExecutionRecord = previous ?? {
    id: crypto.randomUUID(),
    actionId: id,
    approvalId: valid.approval.id,
    approvedRevision: a.revision,
    binding: approvalBinding(a, p.state),
    commandId: "command:" + id,
    capabilityId: valid.policy.capabilityId,
    domain: valid.policy.domain,
    riskLevel: a.riskLevel,
    templateId: a.templateId,
    command: domainCommand(a),
    beforeSnapshot: { exists: false, parentEntityId: a.targetEntityId },
    entityRefs: [],
    startedAt: now,
    status: "Pending",
    rollbackSupported: valid.policy.rollbackSupported,
    rollbackRecordId: crypto.randomUUID(),
    actorUserId: actor.actorUserId,
    organizationId: actor.organizationId,
    origin: p.state.plans.some((x) =>
      x.steps.some((y) => y.proposedActionId === id),
    )
      ? "ActionPlan"
      : a.origin,
  };
  if (!previous) {
    e.state.records.push(record);
    e.state.rollbacks.push({
      id: record.rollbackRecordId,
      executionId: record.id,
      supported: record.rollbackSupported,
      rollbackType: record.rollbackSupported
        ? "CompensatingAction"
        : "NotSupported",
      status: record.rollbackSupported ? "Available" : "NotSupported",
      createdAt: now,
      ...(record.rollbackSupported
        ? {
            inverseCommand: {
              operation: "archive" as const,
              entityRef: resultRef(a),
            },
          }
        : {}),
    });
  }
  audit(e.state, record, "ExecutionRequested", "اجرای صریح مدیر درخواست شد.");
  audit(
    e.state,
    record,
    "ExecutionValidationPassed",
    "تأیید، مجوز، تازگی، قواعد دامنه و پیش‌نیازها معتبرند.",
  );
  record.status = "Executing";
  record.error = undefined;
  audit(e.state, record, "ExecutionStarted", "عملیات محدود ذخیره آغاز شد.");
  e.raw = saveExecution(storage, e.state, e.raw);
  try {
    // Re-read immediately before the sole canonical domain commit; never trust preview-time state.
    const fresh = load(storage);
    if (fresh.e.raw !== e.raw) fail("StorageConflict");
    validateExecutableAction(
      fresh.p.state.actions.find((x) => x.id === id)!,
      fresh.p.state,
      fresh.c,
      fresh.e.state,
      actor,
    );
    if (
      approvalBinding(
        fresh.p.state.actions.find((x) => x.id === id)!,
        fresh.p.state,
      ) !== record.binding ||
      canonical(fresh.c) !== canonical(c)
    )
      fail("ActionStale");
    commitDomain(storage, simulation, expected);
    const after = preparationContext(storage),
      row = createdEntity(after, a);
    if (!matchesResult(a, row)) fail("PostExecutionVerificationFailed");
    record.afterSnapshot = resultSnapshot(a, row);
    record.entityRefs = [resultRef(a)];
    record.status = "Succeeded";
    record.completedAt = new Date().toISOString();
    audit(
      e.state,
      record,
      "ExecutionSucceeded",
      "رکورد ایجادشده از منبع مرجع تأیید شد.",
    );
    saveExecution(storage, e.state, e.raw);
    finishAction(storage, id);
    return record;
  } catch (error) {
    record.status = "Failed";
    record.error =
      error instanceof ExecutionError ? error.code : "ExecutionFailed";
    record.technicalDetail =
      error instanceof Error ? error.message : "Unknown failure";
    record.completedAt = new Date().toISOString();
    audit(e.state, record, "ExecutionFailed", messages[record.error]);
    try {
      saveExecution(storage, e.state, e.raw);
    } catch {
      /* Persisted Executing journal enables explicit recovery; never replay blindly. */
    }
    throw error instanceof ExecutionError
      ? error
      : new ExecutionError("ExecutionFailed", record.technicalDetail);
  }
}
function finishAction(storage: ExecutionStorage, id: string) {
  const p = readPreparation(storage);
  if (p.error) return;
  const r = readExecution(storage).state.records.find(
      (r) => r.actionId === id && r.status === "Succeeded",
    ),
    a = p.state.actions.find((x) => x.id === id);
  if (!a || !r) return;
  a.status = "Executed";
  a.executionRecordId = r.id;
  try {
    savePreparation(storage, p.state, p.raw);
  } catch {
    /* The verified execution journal remains authoritative for UI/history. */
  }
}
export function rollbackAction(
  storage: ExecutionStorage,
  id: string,
  confirmation: { explicit: true },
  actor = localActor,
) {
  if(storage.serverExecutionDisabled)fail("ExecutionNotAllowed");
  if (busy.has(storage)) fail("StorageConflict");
  busy.add(storage);
  try {
    return performRollback(storage, id, confirmation, actor);
  } finally {
    busy.delete(storage);
  }
}
function performRollback(
  storage: ExecutionStorage,
  id: string,
  confirmation: { explicit: true },
  actor: ExecutionActor,
) {
  if (confirmation.explicit !== true) fail("ExecutionNotAllowed");
  const { p, e, c } = load(storage),
    r = e.state.records.find((x) => x.id === id);
  if (!r) fail("RollbackNotSupported");
  if (
    r.actorUserId !== actor.actorUserId ||
    r.organizationId !== actor.organizationId
  )
    fail("ExecutionNotAllowed");
  if (r.status === "RolledBack") return r;
  const b = e.state.rollbacks.find((x) => x.id === r.rollbackRecordId),
    a = p.state.actions.find((x) => x.id === r.actionId);
  if (
    !b?.supported ||
    r.templateId !== "GrowthIdea" ||
    r.status !== "Succeeded" ||
    !a ||
    !c.scale
  )
    fail("RollbackNotSupported");
  if (!permitted(findCapability(r.capabilityId)!, actor.permissions))
    fail("ExecutionNotAllowed");
  const expected = storage.getItem(SCALE_KEY);
  const recoveryRow = createdEntity(c, a);
  if (
    recoveryRow &&
    canonical(resultSnapshot(a, recoveryRow)) ===
      canonical({ ...r.afterSnapshot, status: "archived" }) &&
    e.state.audit.some(
      (x) => x.executionId === r.id && x.event === "RollbackRequested",
    )
  ) {
    b.status = "RolledBack";
    b.rolledBackAt = new Date().toISOString();
    r.status = "RolledBack";
    audit(
      e.state,
      r,
      "RollbackSucceeded",
      "آرشیو جبرانی قبلی از منبع مرجع تأیید شد؛ نوشتن دوباره انجام نشد.",
    );
    saveExecution(storage, e.state, e.raw);
    return r;
  }
  audit(
    e.state,
    r,
    "RollbackRequested",
    "آرشیو جبرانی ایده به درخواست صریح مدیر.",
  );
  e.raw = saveExecution(storage, e.state, e.raw);
  try {
    const row = createdEntity(c, a);
    if (
      !row ||
      canonical(resultSnapshot(a, row)) !== canonical(r.afterSnapshot) ||
      c.scale.experimentData?.experiments.some((x) => x.ideaId === a.payload.id)
    )
      fail("EntityConflict");
    const idea = c.scale.ideas.find((x) => x.id === a.payload.id)!;
    if (idea.status !== "inbox") fail("EntityConflict");
    const fresh = load(storage);
    if (fresh.e.raw !== e.raw || canonical(fresh.c) !== canonical(c))
      fail("ActionStale");
    persistScale(
      storage,
      saveIdea(c.scale, { ...idea, status: "archived" }),
      expected,
    );
    const after = preparationContext(storage).scale?.ideas.find(
      (x) => x.id === idea.id,
    );
    if (after?.status !== "archived") fail("PostExecutionVerificationFailed");
    b.status = "RolledBack";
    b.rolledBackAt = new Date().toISOString();
    r.status = "RolledBack";
    audit(
      e.state,
      r,
      "RollbackSucceeded",
      "ایده ایجادشده آرشیو شد؛ تاریخچه اجرا حفظ شد.",
    );
    saveExecution(storage, e.state, e.raw);
    return r;
  } catch (error) {
    b.status = "Failed";
    audit(
      e.state,
      r,
      "RollbackFailed",
      "بازگردانی تأیید نشد؛ وضعیت ایده را در بخش رشد بررسی کنید.",
    );
    try {
      saveExecution(storage, e.state, e.raw);
    } catch {}
    throw error;
  }
}
