import { defaultPermissions, findCapability, permitted } from "./capabilities";
import type {
  AgentState,
  AgentPermission,
  AgentProposedAction,
  AgentApprovalRequest,
  AgentEntityRef,
  AgentExecutionResult,
  ErrorCode,
  AgentAuditRecord,
} from "./types";
import type { AgentReadContext, EntitySnapshot } from "./context";
export const emptyAgentState = (): AgentState => ({
  version: 1,
  evidence: [],
  observations: [],
  recommendations: [],
  proposals: [],
  approvals: [],
  audit: [],
});
export class AgentError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}
export const fail = (code: ErrorCode, message: string): never => {
  throw new AgentError(code, message);
};
export function canonical(value: unknown): string {
  if (value === null || typeof value !== "object")
    return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  const o = value as Record<string, unknown>;
  return (
    "{" +
    Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => JSON.stringify(k) + ":" + canonical(o[k]))
      .join(",") +
    "}"
  );
}
export const binding = (p: AgentProposedAction, s: AgentState) =>
  canonical({
    id: p.id,
    capabilityId: p.capabilityId,
    domain: p.domain,
    actionType: p.actionType,
    title: p.title,
    rationale: p.rationale,
    payload: p.payload,
    affectedEntities: p.affectedEntities,
    evidence: s.evidence.filter((e) => p.evidenceIds.includes(e.id)),
    evidenceIds: p.evidenceIds,
    expectedCurrentState: p.expectedCurrentState,
    risk: p.risk,
    requiresApproval: p.requiresApproval,
    dryRun: p.dryRun,
  });
export function audit(
  s: AgentState,
  event: AgentAuditRecord["event"],
  id: string,
  summary: string,
  at: string,
  refs: AgentEntityRef[] = [],
  errorCode?: ErrorCode,
) {
  s.audit.push({
    id: crypto.randomUUID(),
    event,
    artifactId: id,
    summary,
    timestamp: at,
    affectedEntities: structuredClone(refs),
    dryRun: true,
    errorCode,
  });
}
function capability(id: string, permissions: readonly AgentPermission[]) {
  const c = findCapability(id);
  if (!c || !c.enabled)
    return fail("UnsupportedCapability", "قابلیت موجود یا فعال نیست.");
  if (!permitted(c, permissions))
    return fail("PermissionDenied", "مجوز این قابلیت وجود ندارد.");
  return c;
}
export function validatePayload(id: string, p: unknown) {
  const c = findCapability(id);
  if (!c || c.authorityLevel !== "Execute")
    return fail("UnsupportedCapability", "قرارداد نوشتن شناخته‌شده نیست.");
  if (!p || typeof p !== "object" || Array.isArray(p))
    return fail("InvalidPayload", "ساختار اقدام معتبر نیست.");
  const x = p as Record<string, unknown>;
  if (
    Object.keys(x).some((k) => !["entityId", "value"].includes(k)) ||
    typeof x.entityId !== "string" ||
    !x.entityId.trim() ||
    x.entityId.length > 200
  )
    return fail("InvalidPayload", "شناسه یا ساختار اقدام معتبر نیست.");
  if (c.name === "updateKRTarget") {
    if (typeof x.value !== "number" || !Number.isFinite(x.value) || x.value < 0)
      return fail("InvalidPayload", "هدف باید عدد معتبر غیرمنفی باشد.");
  } else if (c.name === "applyScaleDecision") {
    if (
      !["scale", "prepare", "experiment", "hold", "stop"].includes(
        String(x.value),
      )
    )
      return fail("InvalidPayload", "تصمیم معتبر نیست.");
  } else if (
    ["cancelObjective", "stopExperiment", "approveSOP"].includes(c.name)
  ) {
    if (x.value !== true)
      return fail("InvalidPayload", "تأیید صریح مقدار لازم است.");
  } else if (c.name === "updatePrimaryConstraint") {
    if (x.value !== x.entityId)
      return fail("InvalidPayload", "شناسه گلوگاه تطبیق ندارد.");
  } else if (
    typeof x.value !== "string" ||
    !x.value.trim() ||
    x.value.length > 500
  )
    return fail("InvalidPayload", "عنوان یا مالک معتبر لازم است.");
  return c;
}
export function prepareAction(
  s: AgentState,
  ctx: AgentReadContext,
  id: string,
  payload: unknown,
  evidenceIds: string[],
  at = new Date().toISOString(),
  permissions: readonly AgentPermission[] = defaultPermissions,
) {
  const c = capability(id, permissions);
  validatePayload(id, payload);
  const data = payload as Record<string, unknown>;
  const e = ctx.entities.find(
    (e) =>
      e.ref.domain === c.domain &&
      e.ref.entityType === c.entityType &&
      e.ref.entityId === data.entityId,
  );
  if (!e) return fail("EntityNotFound", "موجودیت مرتبط پیدا نشد.");
  if (
    !evidenceIds.length ||
    evidenceIds.some((id) => !ctx.evidence.some((e) => e.id === id))
  )
    return fail("InvalidPayload", "شواهد معتبر لازم است.");
  if (
    c.name === "updateKRTarget" &&
    !["increase", "decrease", "maintain"].includes(String(e.state.type))
  )
    return fail(
      "InvalidPayload",
      "این نوع نتیجه کلیدی قرارداد هدف عددی ندارد.",
    );
  ctx.evidence
    .filter((e) => evidenceIds.includes(e.id))
    .forEach((e) => {
      if (!s.evidence.some((x) => x.id === e.id))
        s.evidence.push(structuredClone(e));
    });
  const entityEvidence = {
    id: crypto.randomUUID(),
    domain: c.domain,
    entityRef: structuredClone(e.ref),
    evidenceType: "Status" as const,
    title: e.ref.label ?? "وضعیت موجودیت انتخابی",
    summary: "وضعیت ثبت‌شده هنگام تهیه پیشنهاد",
    value: structuredClone(e.state),
    sourceSelector: "AgentReadContext.entities (canonical source projection)",
    route: e.ref.route,
    createdAt: at,
  };
  s.evidence.push(entityEvidence);
  const p: AgentProposedAction = {
    id: crypto.randomUUID(),
    capabilityId: id,
    domain: c.domain,
    actionType: c.name,
    title: c.name + " · " + e.ref.label,
    rationale: "پیشنهاد آزمایشی؛ تأیید کاربر ضروری است.",
    payload: structuredClone(data),
    affectedEntities: [structuredClone(e.ref)],
    evidenceIds: [entityEvidence.id, ...evidenceIds],
    risk: c.riskLevel,
    requiresApproval: true,
    status: "Draft",
    createdAt: at,
    expectedCurrentState: structuredClone(e.state),
    dryRun: true,
  };
  s.proposals.push(p);
  audit(s, "ActionPrepared", p.id, p.title, at, p.affectedEntities);
  return p;
}
export function requestApproval(
  s: AgentState,
  id: string,
  at = new Date().toISOString(),
) {
  const p = s.proposals.find((p) => p.id === id);
  if (!p || p.status !== "Draft")
    return fail("InvalidPayload", "فقط پیش‌نویس تازه قابل ارسال است.");
  const a: AgentApprovalRequest = {
    id: crypto.randomUUID(),
    proposedActionId: id,
    title: p.title,
    description: p.rationale,
    risk: p.risk,
    affectedEntities: structuredClone(p.affectedEntities),
    changeSummary: "شبیه‌سازی " + canonical(p.payload),
    evidenceIds: [...p.evidenceIds],
    status: "Pending",
    requestedAt: at,
    expiresAt: new Date(Date.parse(at) + 86400000).toISOString(),
    binding: binding(p, s),
  };
  s.approvals.push(a);
  p.status = "ReadyForApproval";
  audit(
    s,
    "ApprovalRequested",
    id,
    "درخواست تأیید شبیه‌سازی",
    at,
    p.affectedEntities,
  );
  return a;
}
export function decideApproval(
  s: AgentState,
  id: string,
  approved: boolean,
  reason = "Not now",
  at = new Date().toISOString(),
) {
  const a = s.approvals.find((a) => a.id === id),
    p = a && s.proposals.find((p) => p.id === a.proposedActionId);
  if (!a || !p || a.status !== "Pending" || p.status !== "ReadyForApproval")
    return fail("ApprovalRequired", "درخواست در انتظار بررسی نیست.");
  if (Date.parse(at) >= Date.parse(a.expiresAt)) {
    a.status = "Expired";
    return fail("ApprovalRequired", "درخواست منقضی شده است.");
  }
  if (a.binding !== binding(p, s))
    return fail(
      "StaleProposal",
      "پیشنهاد تغییر کرده است؛ تأیید تازه لازم است.",
    );
  a.status = approved ? "Approved" : "Rejected";
  p.status = approved ? "Approved" : "Rejected";
  if (approved) a.approvedAt = at;
  else {
    a.rejectedAt = at;
    a.rejectionReason = reason.slice(0, 300);
  }
  audit(
    s,
    approved ? "ActionApproved" : "ActionRejected",
    p.id,
    approved
      ? "کاربر شبیه‌سازی را تأیید کرد"
      : "رد پیشنهاد: " + reason.slice(0, 300),
    at,
    p.affectedEntities,
  );
}
export class AgentActionExecutor {
  constructor(
    private permissions: readonly AgentPermission[] = defaultPermissions,
  ) {}
  execute(
    s: AgentState,
    id: string,
    readEntity: (ref: AgentEntityRef) => EntitySnapshot | undefined,
    at = new Date().toISOString(),
  ): AgentExecutionResult {
    const p = s.proposals.find((p) => p.id === id);
    try {
      if (!p) return fail("EntityNotFound", "پیشنهاد پیدا نشد.");
      const c = capability(p.capabilityId, this.permissions);
      if (
        c.authorityLevel !== "Execute" ||
        p.domain !== c.domain ||
        p.actionType !== c.name ||
        p.risk !== c.riskLevel ||
        !p.requiresApproval ||
        p.dryRun !== true
      )
        return fail("InvalidPayload", "قرارداد با قابلیت تطبیق ندارد.");
      const a = s.approvals.find(
        (a) => a.proposedActionId === id && a.status === "Approved",
      );
      if (
        p.status !== "Approved" ||
        !a ||
        Date.parse(at) >= Date.parse(a.expiresAt) ||
        a.binding !== binding(p, s)
      )
        return fail(
          "ApprovalRequired",
          "تأیید معتبر و دقیقاً برای این پیشنهاد لازم است.",
        );
      if (
        p.affectedEntities.length !== 1 ||
        p.affectedEntities[0].domain !== c.domain ||
        p.affectedEntities[0].entityType !== c.entityType ||
        p.affectedEntities[0].entityId !== p.payload.entityId
      )
        return fail("InvalidPayload", "مرجع موجودیت تطبیق ندارد.");
      const live = readEntity(p.affectedEntities[0]);
      if (!live) return fail("EntityNotFound", "موجودیت منبع پیدا نشد.");
      if (
        canonical(live.ref) !== canonical(p.affectedEntities[0]) ||
        canonical(live.state) !== canonical(p.expectedCurrentState)
      )
        return fail(
          "StaleProposal",
          "داده از زمان ایجاد پیشنهاد تغییر کرده است. پیشنهاد باید دوباره بررسی شود.",
        );
      validatePayload(p.capabilityId, p.payload);
      p.status = "Executed";
      a.status = "Executed";
      audit(
        s,
        "ActionExecuted",
        id,
        "شبیه‌سازی موفق؛ هیچ داده کسب‌وکاری تغییر نکرد.",
        at,
        p.affectedEntities,
      );
      return {
        success: true,
        dryRun: true,
        actionId: id,
        summary: "شبیه‌سازی موفق؛ هیچ داده کسب‌وکاری تغییر نکرد.",
        affectedEntities: structuredClone(p.affectedEntities),
      };
    } catch (error) {
      const e =
        error instanceof AgentError
          ? error
          : new AgentError("ExecutionFailed", "اجرای شبیه‌سازی ممکن نشد.");
      audit(
        s,
        "ActionFailed",
        id,
        e.message,
        at,
        p?.affectedEntities ?? [],
        e.code,
      );
      if (p?.status === "Approved" && e.code === "StaleProposal")
        p.status = "Failed";
      return {
        success: false,
        dryRun: true,
        actionId: id,
        summary: e.message,
        affectedEntities: p?.affectedEntities ?? [],
        error: { code: e.code, message: e.message },
      };
    }
  }
}
