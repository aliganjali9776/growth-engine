import {
  emptyPreparation,
  type PreparationState,
} from "./agent/preparation/types";
import { template } from "./agent/preparation/templates";
import { validateEvidence } from "./agent/advisor/validation";
import { approvalBinding } from "./agent/preparation/engine";
import { validatePlan } from "./agent/preparation/recommendations";
import { canonical } from "./agent/actions";
export const PREPARATION_KEY = "growth-engine.agent.preparation.v1";
const MAX_BYTES = 8_000_000;
const status = [
  "Draft",
  "ReadyForApproval",
  "Approved",
  "Rejected",
  "Archived",
  "NeedsReview",
  "ReadyToExecute",
  "Executing",
  "Executed",
  "ExecutionFailed",
  "Stale",
  "Cancelled",
];
const events = [
  "RecommendationCreated",
  "ActionOptionSelected",
  "ActionDraftCreated",
  "DraftEdited",
  "DraftValidated",
  "ApprovalRequested",
  "ApprovalApproved",
  "ApprovalRejected",
  "ActionMarkedStale",
  "PreviewRebuilt",
  "ActionArchived",
];
const date = (x: unknown) =>
  typeof x === "string" && Number.isFinite(Date.parse(x));
function check(x: unknown): asserts x {
  if (!x) throw Error("ساختار ذخیره اقدام نامعتبر است.");
}
function safe(x: unknown, depth = 0): boolean {
  if (depth > 9) return false;
  if (x === null || typeof x === "boolean") return true;
  if (typeof x === "number") return Number.isFinite(x);
  if (typeof x === "string") return x.length <= 12000;
  if (Array.isArray(x))
    return x.length <= 20000 && x.every((v) => safe(v, depth + 1));
  if (x && typeof x === "object")
    return Object.entries(x).every(
      ([k, v]) =>
        !["__proto__", "prototype", "constructor"].includes(k) &&
        (v === undefined || safe(v, depth + 1)),
    );
  return false;
}
export function validatePreparation(s: PreparationState) {
  check(s && s.version === 1);
  for (const key of [
    "evidence",
    "recommendations",
    "plans",
    "actions",
    "revisions",
    "approvals",
    "audit",
  ] as const) {
    check(Array.isArray(s[key]) && s[key].length <= 20000);
    check(
      s[key].every(
        (x) =>
          x &&
          typeof x.id === "string" &&
          x.id.length > 0 &&
          x.id.length <= 200,
      ),
    );
    check(new Set(s[key].map((x) => x.id)).size === s[key].length);
  }
  const evidence = new Set(s.evidence.map((e) => e.id)),
    actions = new Set(s.actions.map((a) => a.id));
  const ids = (x: unknown) =>
    Array.isArray(x) &&
    x.every((id) => typeof id === "string" && evidence.has(id));
  for (const e of s.evidence) validateEvidence(e);
  for (const r of s.recommendations) {
    check(
      typeof r.title === "string" &&
        ids(r.evidenceIds) &&
        Array.isArray(r.actionOptions) &&
        r.actionOptions.length <= 8 &&
        typeof r.sourceVersion === "string" &&
        Array.isArray(r.assumptions) &&
        Array.isArray(r.risks),
    );
    check(
      [
        "New",
        "Reviewed",
        "Accepted",
        "Dismissed",
        "ConvertedToAction",
        "Archived",
        "PotentiallyStale",
      ].includes(r.status),
    );
    for (const o of r.actionOptions) {
      const t = template(o.templateId);
      check(
        o.recommendationId === r.id &&
          o.capabilityId === t.capabilityId &&
          o.riskLevel === t.risk &&
          ids(o.evidenceIds),
      );
    }
  }
  for (const p of s.plans)
    check(
      ids(p.evidenceIds) &&
        !validatePlan(p).length &&
        p.steps.every(
          (x) => !x.proposedActionId || actions.has(x.proposedActionId),
        ),
    );
  for (const a of s.actions) {
    const t = template(a.templateId);
    if (["Executing", "Executed", "ExecutionFailed"].includes(a.status))
      check(
        typeof a.executionRecordId === "string" &&
          a.executionRecordId.length > 0,
      );
    check(
      a.capabilityId === t.capabilityId &&
        a.domain === t.domain &&
        a.actionType === t.id &&
        a.risk === t.risk &&
        a.riskLevel === t.risk &&
        a.requiresApproval === true &&
        a.approvalPolicy === "AlwaysRequired" &&
        a.dryRun === true &&
        status.includes(a.status),
    );
    check(ids(a.evidenceIds) && a.evidenceIds.length > 0);
    check(
      Number.isInteger(a.revision) &&
        a.revision >= 1 &&
        date(a.createdAt) &&
        date(a.updatedAt) &&
        safe(a.payload) &&
        safe(a.expectedCurrentState) &&
        safe(a.proposedStateSnapshot) &&
        Array.isArray(a.fields),
    );
    check(
      a.fields.every(
        (f) =>
          typeof f.path === "string" &&
          /^[a-zA-Z][a-zA-Z0-9]*(\.[a-zA-Z][a-zA-Z0-9]*)*$/.test(f.path) &&
          !f.path
            .split(".")
            .some((k) =>
              ["prototype", "constructor", "__proto__"].includes(k),
            ) &&
          ["AgentSuggested", "UserEdited"].includes(f.source) &&
          ["Resolved", "Suggested", "NeedsUserInput", "Invalid"].includes(
            f.state,
          ),
      ),
    );
    check(
      ["Valid", "NeedsInput", "Stale", "Invalid"].includes(a.validation.status),
    );
    check(
      Array.isArray(a.affectedEntities) &&
        a.affectedEntities.every(
          (r) =>
            typeof r.entityId === "string" &&
            (!r.route || /^\/(system|strategy|scale)(\/|\?|$)/.test(r.route)),
        ),
    );
    check(
      Array.isArray(a.dependencyIds) &&
        a.dependencyIds.every((id) =>
          s.plans.some((p) => p.dependencies.some((d) => d.id === id)),
        ),
    );
    check(
      !a.sourceRecommendationId ||
        s.recommendations.some((r) => r.id === a.sourceRecommendationId),
    );
    if (["Approved", "ReadyForApproval"].includes(a.status)) {
      check(a.validation.status === "Valid");
      check(
        s.approvals.some(
          (r) =>
            r.proposedActionId === a.id &&
            r.status === (a.status === "Approved" ? "Approved" : "Pending") &&
            r.binding === approvalBinding(a, s),
        ),
      );
    }
  }
  for (const r of s.revisions)
    check(
      actions.has(r.actionId) &&
        Number.isInteger(r.revision) &&
        date(r.changedAt) &&
        safe(r.payload) &&
        ["Agent", "User"].includes(r.source),
    );
  for (const a of s.actions)
    check(
      s.revisions.some((r) => r.actionId === a.id && r.revision === a.revision),
    );
  for (const r of s.approvals)
    check(
      actions.has(r.proposedActionId) &&
        ["Pending", "Approved", "Rejected", "Expired"].includes(r.status) &&
        typeof r.binding === "string" &&
        date(r.requestedAt) &&
        date(r.expiresAt) &&
        ids(r.evidenceIds),
    );
  for (const a of s.audit)
    check(events.includes(a.event) && a.dryRun === true && date(a.timestamp));
}
export function readPreparation(storage: Pick<Storage, "getItem">): {
  state: PreparationState;
  raw: string | null;
  error?: string;
} {
  let raw: string | null = null;
  try {
    raw = storage.getItem(PREPARATION_KEY);
    if (!raw) return { state: emptyPreparation(), raw };
    if (new TextEncoder().encode(raw).length > MAX_BYTES) throw Error();
    const state: PreparationState & { storageEncoding?: string } =
      JSON.parse(raw);
    if (state.storageEncoding !== undefined) {
      if (
        state.storageEncoding !== "compact-snapshots-v1" ||
        !Array.isArray(state.actions)
      )
        throw Error();
      for (const action of state.actions) {
        if (!Object.hasOwn(action, "currentStateSnapshot"))
          action.currentStateSnapshot = structuredClone(
            action.expectedCurrentState,
          );
        if (!Object.hasOwn(action, "proposedStateSnapshot"))
          action.proposedStateSnapshot = structuredClone(action.payload);
      }
      delete state.storageEncoding;
    }
    if (Array.isArray(state.actions))
      for (const action of state.actions) {
        if (action.approvalPolicy === undefined)
          action.approvalPolicy = "AlwaysRequired";
      }
    validatePreparation(state);
    return { state, raw };
  } catch {
    return {
      state: emptyPreparation(),
      raw,
      error:
        "داده اقدامات قابل خواندن نیست؛ نسخه قبلی حفظ شده و نوشتن متوقف است.",
    };
  }
}
export function savePreparation(
  storage: Pick<Storage, "getItem" | "setItem">,
  state: PreparationState,
  expectedRaw: string | null,
) {
  if (storage.getItem(PREPARATION_KEY) !== expectedRaw)
    throw Error("اقدامات در پنجره دیگری تغییر کرده‌اند؛ صفحه را تازه کنید.");
  if (readPreparation(storage).error)
    throw Error("داده نامعتبر قبلی بازنویسی نمی‌شود.");
  validatePreparation(state);
  const encoded: PreparationState & { storageEncoding: string } = {
    ...structuredClone(state),
    storageEncoding: "compact-snapshots-v1",
  };
  for (const action of encoded.actions) {
    if (
      canonical(action.currentStateSnapshot) ===
      canonical(action.expectedCurrentState)
    )
      delete (action as Partial<typeof action>).currentStateSnapshot;
    if (canonical(action.proposedStateSnapshot) === canonical(action.payload))
      delete (action as Partial<typeof action>).proposedStateSnapshot;
  }
  const raw = JSON.stringify(encoded);
  if (new TextEncoder().encode(raw).length > MAX_BYTES)
    throw Error("ظرفیت ذخیره اقدامات کافی نیست؛ نسخه قبلی حفظ شد.");
  storage.setItem(PREPARATION_KEY, raw);
  return raw;
}
