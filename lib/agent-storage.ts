import { emptyAgentState, binding, validatePayload } from "./agent/actions";
import { domains, type AgentState } from "./agent/types";
export const AGENT_KEY = "growth-engine.agent.v1";
function object(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object" && !Array.isArray(x);
}
function text(x: unknown) {
  return typeof x === "string" && x.length <= 6000;
}
function refs(x: unknown): boolean {
  return (
    Array.isArray(x) &&
    x.every(
      (r) =>
        object(r) &&
        domains.includes(r.domain as (typeof domains)[number]) &&
        text(r.entityType) &&
        text(r.entityId) &&
        (!r.route ||
          (typeof r.route === "string" &&
            r.route.startsWith("/") &&
            !r.route.startsWith("//"))),
    )
  );
}
export function parseAgent(raw: string): AgentState {
  const s: unknown = JSON.parse(raw);
  if (
    !object(s) ||
    s.version !== 1 ||
    Object.keys(s).some(
      (k) =>
        ![
          "version",
          "evidence",
          "observations",
          "recommendations",
          "proposals",
          "approvals",
          "audit",
        ].includes(k),
    )
  )
    throw Error("داده آزمایشی Agent معتبر نیست.");
  for (const key of [
    "evidence",
    "observations",
    "recommendations",
    "proposals",
    "approvals",
    "audit",
  ]) {
    const a = s[key];
    if (
      !Array.isArray(a) ||
      a.length > 2000 ||
      a.some((x) => !object(x) || !text(x.id))
    )
      throw Error("ساختار داده Agent معتبر نیست.");
    if (new Set(a.map((x) => x.id)).size !== a.length)
      throw Error("شناسه تکراری Agent.");
  }
  const result = s as unknown as AgentState;
  for (const r of result.recommendations)
    if (
      !text(r.title) ||
      !text(r.summary) ||
      !text(r.rationale) ||
      !["Low", "Medium", "High"].includes(r.confidence) ||
      !["Low", "Medium", "High", "Critical"].includes(r.priority) ||
      ![
        "New",
        "Reviewed",
        "Accepted",
        "Dismissed",
        "ConvertedToAction",
        "Archived",
      ].includes(r.status) ||
      !Array.isArray(r.suggestedActions) ||
      r.suggestedActions.some((x) => !text(x))
    )
      throw Error("توصیه نامعتبر.");
  for (const o of result.observations)
    if (!text(o.statement) || !text(o.type)) throw Error("مشاهده نامعتبر.");
  for (const e of result.evidence)
    if (
      !domains.includes(e.domain) ||
      !text(e.title) ||
      !text(e.summary) ||
      !text(e.createdAt) ||
      ![
        "Metric",
        "Status",
        "Trend",
        "Risk",
        "HistoricalRecord",
        "Relationship",
        "Decision",
        "Learning",
        "Capacity",
        "Constraint",
        "Process",
        "Other",
      ].includes(e.evidenceType) ||
      (e.entityRef && !refs([e.entityRef])) ||
      (e.route && (!e.route.startsWith("/") || e.route.startsWith("//")))
    )
      throw Error("شواهد نامعتبر.");
  for (const a of [...result.observations, ...result.recommendations])
    if (
      !Array.isArray(a.evidenceIds) ||
      a.evidenceIds.some((id) => !result.evidence.some((e) => e.id === id)) ||
      !domains.includes(a.domain) ||
      !text(a.createdAt)
    )
      throw Error("ارجاع شواهد نامعتبر.");
  for (const p of result.proposals) {
    validatePayload(p.capabilityId, p.payload);
    if (
      !refs(p.affectedEntities) ||
      !text(p.title) ||
      !text(p.rationale) ||
      !text(p.createdAt) ||
      !domains.includes(p.domain) ||
      p.dryRun !== true ||
      !p.requiresApproval ||
      !object(p.expectedCurrentState) ||
      !Array.isArray(p.evidenceIds) ||
      p.evidenceIds.some((id) => !result.evidence.some((e) => e.id === id)) ||
      ![
        "Draft",
        "ReadyForApproval",
        "Approved",
        "Rejected",
        "Executed",
        "Failed",
        "Cancelled",
      ].includes(p.status)
    )
      throw Error("پیشنهاد نامعتبر.");
  }
  for (const a of result.approvals) {
    const p = result.proposals.find((p) => p.id === a.proposedActionId);
    if (
      !p ||
      !text(a.title) ||
      !text(a.description) ||
      !text(a.changeSummary) ||
      !refs(a.affectedEntities) ||
      !["Pending", "Approved", "Rejected", "Expired", "Executed"].includes(
        a.status,
      ) ||
      !Number.isFinite(Date.parse(a.expiresAt)) ||
      a.binding !== binding(p, result)
    )
      throw Error("تأیید نامعتبر.");
  }
  for (const a of result.audit)
    if (
      !refs(a.affectedEntities) ||
      !text(a.summary) ||
      !text(a.timestamp) ||
      ![
        "ObservationCreated",
        "RecommendationCreated",
        "ActionPrepared",
        "ApprovalRequested",
        "ActionApproved",
        "ActionRejected",
        "ActionExecuted",
        "ActionFailed",
        "AdvisorQuestionAsked",
        "ContextBuilt",
        "ModelCalled",
        "AdvisorResponseCreated",
        "ModelError",
      ].includes(a.event)
    )
      throw Error("گزارش نامعتبر.");
  return result;
}
export function loadAgent(storage: Pick<Storage, "getItem">) {
  const raw = storage.getItem(AGENT_KEY);
  try {
    return {
      state: raw ? parseAgent(raw) : emptyAgentState(),
      raw,
      warning: "",
    };
  } catch {
    return {
      state: emptyAgentState(),
      raw,
      warning:
        "داده Agent قابل خواندن نیست. داده قبلی محفوظ است؛ برای ادامه، فضای آزمایشی را بازنشانی کنید.",
    };
  }
}
export function saveAgent(
  storage: Pick<Storage, "getItem" | "setItem">,
  state: AgentState,
  expected: string | null,
) {
  if (storage.getItem(AGENT_KEY) !== expected)
    throw Error("داده Agent در زبانه دیگری تغییر کرده است؛ صفحه را تازه کنید.");
  const raw = JSON.stringify(state);
  if (raw.length > 2000000)
    throw Error("فضای آزمایشی پر شده است؛ پیش از ادامه بازنشانی کنید.");
  parseAgent(raw);
  storage.setItem(AGENT_KEY, raw);
  return raw;
}
