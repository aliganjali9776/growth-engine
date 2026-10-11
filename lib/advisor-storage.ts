import type { AdvisorLocalStore, AgentSession } from "./agent/advisor/types";
import {
  isObject,
  validateEvidence,
  validatePacket,
  validateModelOutput,
} from "./agent/advisor/validation";
import { parseSelection } from "./agent/advisor/context";
export const ADVISOR_KEY = "growth-engine.advisor.v1";
const MAX_BYTES = 1500000;
export function newAdvisorSession(
  context: AgentSession["currentContext"] = { type: "executive" },
): AgentSession {
  const at = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    createdAt: at,
    updatedAt: at,
    initialContext: context,
    currentContext: context,
    status: "active",
    messages: [],
    audit: [],
  };
}
export function readAdvisor(storage: Pick<Storage, "getItem">): {
  store: AdvisorLocalStore;
  raw: string | null;
  error?: string;
} {
  const raw = storage.getItem(ADVISOR_KEY);
  if (!raw) return { store: { version: 1, session: null }, raw };
  try {
    if (new TextEncoder().encode(raw).length > MAX_BYTES) throw Error();
    const store = JSON.parse(raw);
    if (
      store.version !== 1 ||
      (store.session !== null &&
        (!store.session ||
          store.session.status !== "active" ||
          !Array.isArray(store.session.messages) ||
          store.session.messages.length > 24 ||
          !Array.isArray(store.session.audit) ||
          store.session.audit.length > 120 ||
          typeof store.session.id !== "string" ||
          store.session.messages.some(
            (m: unknown) =>
              !m ||
              typeof m !== "object" ||
              !("role" in m) ||
              !["user", "advisor", "system-event"].includes(String(m.role)) ||
              !("content" in m) ||
              typeof m.content !== "string",
          )))
    )
      throw Error();
    if (store.session) {
      const session = store.session as AgentSession;
      parseSelection(
        session.currentContext?.type,
        session.currentContext?.id ?? null,
      );
      parseSelection(
        session.initialContext?.type,
        session.initialContext?.id ?? null,
      );
      if (
        !Number.isFinite(Date.parse(session.createdAt)) ||
        !Number.isFinite(Date.parse(session.updatedAt))
      )
        throw Error();
      if (session.lastPacket) validatePacket(session.lastPacket);
      for (const message of session.messages) {
        if (
          message.sessionId !== session.id ||
          typeof message.id !== "string" ||
          message.content.length > 2000 ||
          !Number.isFinite(Date.parse(message.generatedAt)) ||
          !Array.isArray(message.evidenceRefs) ||
          message.evidenceRefs.length > 6
        )
          throw Error();
        message.evidenceRefs.forEach(validateEvidence);
        if (message.response) {
          const r = message.response;
          if (
            !isObject(r) ||
            !["Low", "Medium", "High"].includes(r.confidence) ||
            !Array.isArray(r.recommendations)
          )
            throw Error();
          if (
            typeof r.provider !== "string" ||
            r.provider.length > 100 ||
            typeof r.model !== "string" ||
            r.model.length > 100 ||
            typeof r.promptVersion !== "string" ||
            r.promptVersion.length > 100 ||
            r.schemaValidated !== true ||
            typeof r.modelCalled !== "boolean" ||
            !Number.isFinite(Date.parse(r.generatedAt)) ||
            !Number.isFinite(Date.parse(r.requestTimestamp)) ||
            !Array.isArray(r.evidenceRefs)
          )
            throw Error();
          r.evidenceRefs.forEach(validateEvidence);
          const {
            answer,
            summary,
            observations,
            dataGaps,
            warnings,
            brief,
            comparison,
          } = r;
          const evidence = r.evidenceRefs;
          validateModelOutput(
            {
              answer,
              summary,
              observations,
              dataGaps,
              warnings,
              brief,
              comparison,
              recommendations: r.recommendations.map(
                ({ text, evidenceIds }) => ({ text, evidenceIds }),
              ),
              evidenceRefs: evidence.map((e) => e.id),
            },
            {
              requestId: message.id,
              question: "وضعیت",
              selection: { type: "executive" },
              packet: {
                topic: "Executive3SContext",
                entities: [],
                metrics: [],
                risks: [],
                historySummary: [],
                evidence,
                generatedAt: message.generatedAt,
              },
              capabilityIds: ["executive.get3SSummary"],
              history: [],
              mode: "answer",
              demo: false,
            },
            r.provider,
            r.model,
            r.generatedAt,
            r.modelCalled,
          );
        }
      }
    }
    return { store, raw };
  } catch {
    return {
      store: { version: 1, session: null },
      raw,
      error:
        "گفت‌وگوی ذخیره‌شده معتبر نیست؛ برای حفظ داده، ذخیره جدید متوقف شد.",
    };
  }
}
export function saveAdvisor(
  storage: Pick<Storage, "getItem" | "setItem">,
  session: AgentSession,
  expected: string | null,
): string {
  if (storage.getItem(ADVISOR_KEY) !== expected)
    throw Error("گفت‌وگو در زبانه دیگری تغییر کرده است؛ صفحه را تازه کنید.");
  const bounded = {
      ...session,
      messages: session.messages.slice(-24),
      audit: session.audit.slice(-120),
    },
    raw = JSON.stringify({ version: 1, session: bounded });
  if (new TextEncoder().encode(raw).length > MAX_BYTES)
    throw Error(
      "گفت‌وگو برای ذخیره محلی بیش از حد بزرگ است؛ گفت‌وگوی تازه شروع کنید.",
    );
  storage.setItem(ADVISOR_KEY, raw);
  return raw;
}
