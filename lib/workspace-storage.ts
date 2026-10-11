import { readAdvisor } from "./advisor-storage";
import {
  newWorkspaceSession,
  type WorkspaceSession,
  type WorkspaceContext,
} from "./agent/workspace";
import { validateEvidence } from "./agent/advisor/validation";
export const WORKSPACE_KEY = "growth-engine.agent.workspace.v1";
export interface WorkspaceStore {
  version: 1;
  activeSessionId: string | null;
  sessions: WorkspaceSession[];
  importedAdvisorSessionId?: string;
}
export const emptyWorkspace = (): WorkspaceStore => ({
  version: 1,
  activeSessionId: null,
  sessions: [],
});
function validContext(c: WorkspaceContext) {
  return (
    c &&
    [
      "executive",
      "process",
      "objective",
      "kr",
      "constraint",
      "experiment",
      "candidate",
      "diagnosis",
    ].includes(c.type) &&
    (c.type === "executive" ||
      (typeof c.id === "string" && /^[a-zA-Z0-9_-]{1,160}$/.test(c.id)))
  );
}
function validate(s: WorkspaceStore) {
  if (
    s.version !== 1 ||
    !Array.isArray(s.sessions) ||
    s.sessions.length > 100 ||
    new Set(s.sessions.map((x) => x.id)).size !== s.sessions.length ||
    (s.activeSessionId !== null &&
      !s.sessions.some((x) => x.id === s.activeSessionId))
  )
    throw Error();
  for (const x of s.sessions) {
    for (const id of [
      x.activeDiagnosisId,
      x.activeRecommendationId,
      x.activeActionId,
      x.selectedOptionId,
    ])
      if (id !== undefined && (typeof id !== "string" || id.length > 200))
        throw Error();
    if (
      typeof x.id !== "string" ||
      typeof x.title !== "string" ||
      x.title.length > 300 ||
      !validContext(x.activeContext) ||
      ![
        "Conversation",
        "Diagnosis",
        "Recommendation",
        "ActionReview",
        "ExecutionResult",
      ].includes(x.workspaceState) ||
      !Number.isFinite(Date.parse(x.lastActivityAt)) ||
      !Number.isFinite(Date.parse(x.createdAt)) ||
      !Number.isFinite(Date.parse(x.updatedAt)) ||
      typeof x.contextLocked !== "boolean" ||
      !Array.isArray(x.dismissedOptions) ||
      x.dismissedOptions.length > 500 ||
      x.dismissedOptions.some((k) => typeof k !== "string") ||
      !Array.isArray(x.messages) ||
      new Set(x.messages.map((m) => m?.id)).size !== x.messages.length ||
      x.messages.length > 1000
    )
      throw Error();
    for (const m of x.messages) {
      if (m.context && !validContext(m.context)) throw Error();
      if (
        typeof m.id !== "string" ||
        !["user", "advisor"].includes(m.role) ||
        typeof m.content !== "string" ||
        m.content.length > 4000 ||
        !Number.isFinite(Date.parse(m.at)) ||
        !Array.isArray(m.refs) ||
        m.refs.length > 12 ||
        new Set(m.refs.map((r) => `${r?.type}:${r?.id}`)).size !==
          m.refs.length ||
        m.refs.some(
          (r) =>
            !["diagnosis", "recommendation", "action", "execution"].includes(
              r.type,
            ) || typeof r.id !== "string",
        ) ||
        !Array.isArray(m.evidence) ||
        m.evidence.length > 24
      )
        throw Error();
      m.evidence.forEach(validateEvidence);
    }
  }
}
export function readWorkspace(storage: Pick<Storage, "getItem">) {
  let raw: string | null = null;
  try {
    raw = storage.getItem(WORKSPACE_KEY);
    if (!raw) return { store: emptyWorkspace(), raw };
    if (new TextEncoder().encode(raw).length > 12_000_000) throw Error();
    const store = JSON.parse(raw) as WorkspaceStore;
    validate(store);
    return { store, raw };
  } catch {
    return {
      store: emptyWorkspace(),
      raw,
      error:
        "تاریخچه فضای مشاور قابل خواندن نیست؛ برای حفظ داده ذخیره متوقف شد.",
    };
  }
}
export function saveWorkspace(
  storage: Pick<Storage, "getItem" | "setItem">,
  store: WorkspaceStore,
  expected: string | null,
) {
  if (expected && readWorkspace(storage).error)
    throw Error("تاریخچه نامعتبر قبلی قابل بازنویسی نیست.");
  if (storage.getItem(WORKSPACE_KEY) !== expected)
    throw Error("گفت‌وگو در زبانه دیگری تغییر کرده است؛ دوباره بارخوانی کنید.");
  validate(store);
  const raw = JSON.stringify(store);
  if (new TextEncoder().encode(raw).length > 12_000_000)
    throw Error("حجم تاریخچه به سقف ذخیره محلی رسیده است؛ داده قبلی حفظ شد.");
  storage.setItem(WORKSPACE_KEY, raw);
  return raw;
}
export function importAdvisorSession(
  storage: Pick<Storage, "getItem">,
  store: WorkspaceStore,
) {
  const legacy = readAdvisor(storage);
  if (
    legacy.error ||
    !legacy.store.session ||
    store.importedAdvisorSessionId === legacy.store.session.id
  )
    return store;
  const old = legacy.store.session;
  if (store.sessions.length >= 100) return store;
  const session = newWorkspaceSession(
    old.currentContext,
    "گفت‌وگوی پیشین مشاور",
  );
  session.id = "legacy-" + old.id;
  session.createdAt = old.createdAt;
  session.updatedAt = old.updatedAt;
  session.lastActivityAt = old.updatedAt;
  session.messages = old.messages
    .filter((m) => m.role !== "system-event")
    .map((m) => ({
      id: m.id,
      role: m.role as "user" | "advisor",
      content: m.content,
      at: m.generatedAt,
      evidence: m.evidenceRefs,
      refs: [],
    }));
  return {
    ...store,
    importedAdvisorSessionId: old.id,
    sessions: [...store.sessions, session],
  };
}
