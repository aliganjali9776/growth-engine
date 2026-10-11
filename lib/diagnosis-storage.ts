import {
  emptyDiagnosisState,
  type DiagnosisState,
} from "./agent/diagnosis/types";
export const DIAGNOSIS_KEY = "growth-engine.agent.diagnosis.v1";
const MAX_BYTES = 4000000;
function validate(value: unknown): asserts value is DiagnosisState {
  if (!value || typeof value !== "object") throw Error("ساختار نامعتبر");
  const s = value as DiagnosisState;
  if (s.version !== 1) throw Error("نسخه نامعتبر");
  for (const key of [
    "evidence",
    "signals",
    "patterns",
    "diagnoses",
    "priorities",
    "runs",
    "history",
  ] as const) {
    if (
      !Array.isArray(s[key]) ||
      s[key].length > 20000 ||
      s[key].some((x) => !x || typeof x.id !== "string")
    )
      throw Error("ساختار نامعتبر");
    if (new Set(s[key].map((x) => x.id)).size !== s[key].length)
      throw Error("شناسه تکراری");
  }
  const ev = new Set(s.evidence.map((e) => e.id)),
    sig = new Set(s.signals.map((x) => x.id)),
    pat = new Set(s.patterns.map((x) => x.id)),
    diagnoses = new Set(s.diagnoses.map((x) => x.id));
  const safeRef = (r: unknown) =>
    !!r &&
    typeof r === "object" &&
    "entityId" in r &&
    typeof r.entityId === "string" &&
    "domain" in r &&
    ["System", "Strategy", "Scale", "Executive", "CrossModule"].includes(
      String(r.domain),
    ) &&
    (!("route" in r) ||
      r.route === undefined ||
      (typeof r.route === "string" &&
        /^\/(system|strategy|scale)(\/|\?|$)/.test(r.route)));
  const safeRefs = (rs: unknown) => Array.isArray(rs) && rs.every(safeRef);
  const risk = (r: unknown) =>
    ["Low", "Medium", "High", "Critical"].includes(String(r));
  const refs = (ids: string[], known: Set<string>) =>
    Array.isArray(ids) &&
    ids.every((id) => typeof id === "string" && known.has(id));
  for (const e of s.evidence)
    if (
      typeof e.title !== "string" ||
      typeof e.summary !== "string" ||
      typeof e.createdAt !== "string" ||
      (e.route && !/^\/(system|strategy|scale)(\/|\?|$)/.test(e.route))
    )
      throw Error("شاهد نامعتبر");
  for (const x of s.signals)
    if (
      !refs(x.evidenceIds, ev) ||
      !safeRefs(x.entityRefs) ||
      !risk(x.severity) ||
      typeof x.fingerprint !== "string" ||
      !["Active", "Resolved", "Suppressed", "Stale"].includes(x.status)
    )
      throw Error("سیگنال نامعتبر");
  for (const x of s.patterns)
    if (
      !refs(x.evidenceIds, ev) ||
      !refs(x.signalIds, sig) ||
      !safeRefs(x.entityRefs) ||
      typeof x.fingerprint !== "string" ||
      !["Active", "Resolved", "Stale"].includes(x.status)
    )
      throw Error("الگوی نامعتبر");
  for (const x of s.diagnoses)
    if (
      !refs(x.evidenceIds, ev) ||
      !refs(x.patternIds, pat) ||
      !safeRefs(x.affectedEntities) ||
      !risk(x.severity) ||
      !Array.isArray(x.sourceFamilies) ||
      typeof x.needsRefresh !== "boolean" ||
      !Array.isArray(x.recommendations) ||
      x.recommendations.length > 3 ||
      x.recommendations.some(
        (r) =>
          !refs(r.evidenceIds, ev) ||
          typeof r.title !== "string" ||
          typeof r.summary !== "string",
      ) ||
      typeof x.title !== "string" ||
      typeof x.summary !== "string" ||
      !["New", "Reviewed", "Monitoring", "Resolved", "Dismissed"].includes(
        x.status,
      ) ||
      !["Low", "Medium", "High"].includes(x.confidence)
    )
      throw Error("تحلیل نامعتبر");
  for (const x of s.history)
    if (
      !diagnoses.has(x.diagnosisId) ||
      !refs(x.evidenceIds, ev) ||
      typeof x.summary !== "string"
    )
      throw Error("تاریخچه نامعتبر");
  if (
    s.priorities.length > 3 ||
    s.priorities.some(
      (x) => !diagnoses.has(x.diagnosisId) || !refs(x.evidenceIds, ev),
    )
  )
    throw Error("اولویت نامعتبر");
}
export function readDiagnosis(storage: Pick<Storage, "getItem">): {
  state: DiagnosisState;
  raw: string | null;
  error?: string;
} {
  let raw: string | null = null;
  try {
    raw = storage.getItem(DIAGNOSIS_KEY);
    if (!raw) return { state: emptyDiagnosisState(), raw };
    if (new TextEncoder().encode(raw).length > MAX_BYTES) throw Error();
    const state: unknown = JSON.parse(raw);
    validate(state);
    return { state, raw };
  } catch {
    return {
      state: emptyDiagnosisState(),
      raw,
      error:
        "داده تحلیل قابل خواندن نیست؛ نسخه قبلی حفظ شده و نوشتن متوقف است.",
    };
  }
}
export function saveDiagnosis(
  storage: Pick<Storage, "getItem" | "setItem">,
  state: DiagnosisState,
  expectedRaw: string | null,
): string {
  if (storage.getItem(DIAGNOSIS_KEY) !== expectedRaw)
    throw Error("تحلیل در پنجره دیگری تغییر کرده است؛ صفحه را تازه‌سازی کنید.");
  if (expectedRaw && readDiagnosis(storage).error)
    throw Error("داده نامعتبر قبلی قابل بازنویسی نیست.");
  validate(state);
  const raw = JSON.stringify(state);
  if (new TextEncoder().encode(raw).length > MAX_BYTES)
    throw Error("فضای تاریخچه تحلیل کافی نیست؛ داده قبلی حفظ شد.");
  storage.setItem(DIAGNOSIS_KEY, raw);
  return raw;
}
