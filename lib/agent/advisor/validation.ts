import { domains, type AgentContextPacket, type AgentEvidence } from "../types";
import {
  contextTypes,
  AdvisorError,
  type AdvisorRequest,
  type AdvisorModelOutput,
  type AgentAdvisorResponse,
  type AdvisorClaim,
} from "./types";
import { ADVISOR_LIMITS, AGENT_PROMPT_VERSION } from "./prompt";
import { advisorReadAllowed, classifyIntent } from "./policy";
export const isObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
function error(message = "زمینه ارسالی معتبر نیست."): never {
  throw new AdvisorError("InvalidContext", message);
}
function keys(v: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(v).some((k) => !allowed.includes(k))) error();
}
function text(v: unknown, max = 600): v is string {
  return (
    typeof v === "string" &&
    v.length <= max &&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v)
  );
}
const finiteDate = (v: unknown) =>
  text(v, 40) && Number.isFinite(Date.parse(v as string));
export function safeValue(v: unknown, depth = 0): boolean {
  if (
    v === null ||
    typeof v === "boolean" ||
    (typeof v === "number" && Number.isFinite(v))
  )
    return true;
  if (typeof v === "string") return text(v, 600);
  if (depth >= 3) return false;
  if (Array.isArray(v))
    return v.length <= 12 && v.every((x) => safeValue(x, depth + 1));
  return (
    isObject(v) &&
    Object.keys(v).length <= 18 &&
    Object.entries(v).every(
      ([k, x]) =>
        text(k, 80) &&
        !["__proto__", "constructor", "prototype"].includes(k) &&
        safeValue(x, depth + 1),
    )
  );
}
const refTypes = [
  "process",
  "objective",
  "KR",
  "constraint",
  "experiment",
  "candidate",
  "cycle",
  "channel",
  "funnel",
];
export function validateRef(v: unknown) {
  if (!isObject(v)) error();
  keys(v, ["domain", "entityType", "entityId", "label", "route"]);
  if (
    !domains.includes(v.domain as (typeof domains)[number]) ||
    !refTypes.includes(String(v.entityType)) ||
    !text(v.entityId, 160) ||
    !String(v.entityId).trim() ||
    (v.label !== undefined && !text(v.label, 250))
  )
    error();
  if (
    v.route !== undefined &&
    (!text(v.route, 400) ||
      !/^\/(system|strategy|scale)(\/|\?|$)/.test(String(v.route)) ||
      String(v.route).includes("\\") ||
      String(v.route).includes("//"))
  )
    error();
}
const evidenceTypes = [
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
];
export function validateEvidence(v: unknown): asserts v is AgentEvidence {
  if (!isObject(v)) error();
  keys(v, [
    "id",
    "domain",
    "entityRef",
    "evidenceType",
    "title",
    "summary",
    "value",
    "previousValue",
    "status",
    "timestamp",
    "sourceSelector",
    "route",
    "confidence",
    "createdAt",
  ]);
  if (
    !text(v.id, 200) ||
    !String(v.id).trim() ||
    !domains.includes(v.domain as (typeof domains)[number]) ||
    !evidenceTypes.includes(String(v.evidenceType)) ||
    !text(v.title, 250) ||
    !text(v.summary, 600) ||
    !finiteDate(v.createdAt) ||
    (v.value !== undefined && !safeValue(v.value)) ||
    (v.previousValue !== undefined && !safeValue(v.previousValue)) ||
    (v.sourceSelector !== undefined && !text(v.sourceSelector, 180)) ||
    (v.status !== undefined && !text(v.status, 100)) ||
    (v.timestamp !== undefined && !finiteDate(v.timestamp)) ||
    (v.confidence !== undefined &&
      !["Low", "Medium", "High"].includes(String(v.confidence)))
  )
    error();
  if (v.entityRef) {
    validateRef(v.entityRef);
    if ((v.entityRef as Record<string, unknown>).domain !== v.domain) error();
  }
  if (
    v.route !== undefined &&
    (!text(v.route, 400) ||
      !/^\/(system|strategy|scale)(\/|\?|$)/.test(String(v.route)) ||
      String(v.route).includes("//") ||
      String(v.route).includes("\\"))
  )
    error();
}
export function validatePacket(v: unknown): asserts v is AgentContextPacket {
  if (!isObject(v)) error();
  keys(v, [
    "topic",
    "entities",
    "metrics",
    "risks",
    "evidence",
    "historySummary",
    "generatedAt",
  ]);
  if (
    !text(v.topic, 50) ||
    ![
      "Executive3SContext",
      "SystemProcessContext",
      "StrategyObjectiveContext",
      "StrategyKRContext",
      "ScaleConstraintContext",
      "ScaleExperimentContext",
      "SystemDiagnosis",
      "StrategyDiagnosis",
      "ScaleDiagnosis",
    ].includes(String(v.topic)) ||
    !finiteDate(v.generatedAt) ||
    new TextEncoder().encode(JSON.stringify(v)).length >
      ADVISOR_LIMITS.packetBytes
  )
    error();
  for (const k of [
    "entities",
    "metrics",
    "risks",
    "evidence",
    "historySummary",
  ])
    if (!Array.isArray(v[k])) error();
  const p = v as unknown as AgentContextPacket;
  if (
    p.entities.length > ADVISOR_LIMITS.entities ||
    p.evidence.length > ADVISOR_LIMITS.evidence ||
    p.historySummary.length > ADVISOR_LIMITS.historyPoints ||
    p.metrics.length > 20 ||
    p.risks.length > 20
  )
    error();
  p.entities.forEach(validateRef);
  p.evidence.forEach(validateEvidence);
  if (new Set(p.evidence.map((e) => e.id)).size !== p.evidence.length) error();
  for (const e of [...p.metrics, ...p.risks]) {
    validateEvidence(e);
    const known = p.evidence.find((x) => x.id === e.id);
    if (!known || JSON.stringify(known) !== JSON.stringify(e)) error();
  }
  if (p.historySummary.some((h) => !text(h, 600))) error();
}
export function validateRequest(v: unknown): AdvisorRequest {
  if (!isObject(v)) error();
  keys(v, [
    "requestId",
    "question",
    "selection",
    "packet",
    "capabilityIds",
    "history",
    "mode",
    "demo",
  ]);
  if (!text(v.requestId, 80) || !String(v.requestId).trim()) error();
  if (!text(v.question, ADVISOR_LIMITS.question) || !String(v.question).trim())
    throw new AdvisorError(
      "InvalidQuestion",
      "پرسش باید بین ۱ تا ۲۰۰۰ نویسه باشد.",
    );
  if (!isObject(v.selection)) error();
  keys(v.selection, ["type", "id"]);
  if (
    !contextTypes.includes(v.selection.type as (typeof contextTypes)[number]) ||
    (v.selection.id !== undefined &&
      (!text(v.selection.id, 160) ||
        !String(v.selection.id).trim() ||
        !/^[a-zA-Z0-9_-]+$/.test(String(v.selection.id))))
  )
    error();
  if (
    (v.selection.type !== "executive" && !v.selection.id) ||
    (v.selection.type === "executive" && v.selection.id !== undefined)
  )
    error();
  validatePacket(v.packet);
  if (
    !Array.isArray(v.capabilityIds) ||
    !v.capabilityIds.length ||
    v.capabilityIds.length > 8 ||
    v.capabilityIds.some((x) => typeof x !== "string" || !advisorReadAllowed(x))
  )
    error("فقط قابلیت‌های خواندن مجاز هستند.");
  if (
    !Array.isArray(v.history) ||
    v.history.length > ADVISOR_LIMITS.historyMessages
  )
    error();
  for (const h of v.history) {
    if (!isObject(h)) error();
    keys(h, ["role", "content"]);
    if (!["user", "advisor"].includes(String(h.role)) || !text(h.content, 1200))
      error();
  }
  if (
    !["answer", "brief"].includes(String(v.mode)) ||
    typeof v.demo !== "boolean"
  )
    error();
  const request = v as unknown as AdvisorRequest;
  const topics: Record<string, string> = {
    executive: "Executive3SContext",
    process: "SystemProcessContext",
    objective: "StrategyObjectiveContext",
    kr: "StrategyKRContext",
    constraint: "ScaleConstraintContext",
    experiment: "ScaleExperimentContext",
  };
  if (
    request.selection.type !== "executive" &&
    request.packet.topic !== topics[request.selection.type]
  )
    error();
  if (
    request.selection.id &&
    !request.packet.entities.some(
      (e) =>
        e.entityId === request.selection.id &&
        e.entityType ===
          (request.selection.type === "kr" ? "KR" : request.selection.type),
    )
  )
    error("موجودیت انتخابی در زمینه نیست.");
  return request;
}
function invalid(): never {
  throw new AdvisorError(
    "InvalidResponse",
    "پاسخ Agent قابل اعتبارسنجی نبود. دوباره تلاش کنید.",
    502,
  );
}
function outputText(x: unknown, max = 2000): x is string {
  return text(x, max) && !/<\/?(?:script|iframe|style)\b/i.test(String(x));
}
function ids(v: unknown, known: Set<string>, required = true): v is string[] {
  return (
    Array.isArray(v) &&
    v.length <= 6 &&
    (!required || v.length > 0) &&
    v.every((x) => typeof x === "string" && known.has(x)) &&
    new Set(v).size === v.length
  );
}
const digits = (s: string) =>
  s
    .replace(/[۰-۹٠-٩]/g, (c) =>
      String(
        "۰۱۲۳۴۵۶۷۸۹".includes(c)
          ? "۰۱۲۳۴۵۶۷۸۹".indexOf(c)
          : "٠١٢٣٤٥٦٧٨٩".indexOf(c),
      ),
    )
    .replace(/٫/g, ".")
    .replace(/٬|,/g, "");
function numbers(s: string) {
  return (digits(s).match(/-?\d+(?:\.\d+)?/g) ?? [])
    .map(Number)
    .filter(Number.isFinite);
}
function groundedNumbers(s: string, evidence: AgentEvidence[]) {
  const allowed = new Set<number>();
  for (const e of evidence) {
    for (const n of numbers(
      JSON.stringify({
        title: e.title,
        value: e.value,
        previousValue: e.previousValue,
        summary: e.summary,
        status: e.status,
        timestamp: e.timestamp,
      }),
    )) {
      allowed.add(n);
      if (Math.abs(n) >= 1e6) allowed.add(n / 1e6);
      if (Math.abs(n) >= 1e9) allowed.add(n / 1e9);
    }
  }
  return numbers(s.replace(/\[ev-[a-zA-Z0-9_-]+\]/g, "")).every((n) => allowed.has(n));
}
export function hasUnknown(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string")
    return ["unknown", "نامشخص", "دوره فعال وجود ندارد"].includes(value);
  if (Array.isArray(value)) return value.some(hasUnknown);
  return isObject(value) && Object.values(value).some(hasUnknown);
}
export function evidenceConfidence(
  evidence: AgentEvidence[],
  dataGaps: string[] = [],
): "Low" | "Medium" | "High" {
  const known = evidence.filter(
    (e) => !hasUnknown(e.value) && e.summary.trim() && e.confidence !== "Low",
  );
  if (
    dataGaps.length ||
    known.length < 2 ||
    known.length / evidence.length < 0.6
  )
    return "Low";
  return known.length >= 3 && known.every((e) => e.confidence === "High")
    ? "High"
    : "Medium";
}
export function validateModelOutput(
  value: unknown,
  request: AdvisorRequest,
  provider: string,
  model: string,
  generatedAt = new Date().toISOString(),
  modelCalled = true,
): AgentAdvisorResponse {
  if (!isObject(value)) invalid();
  const fields = [
    "answer",
    "summary",
    "observations",
    "recommendations",
    "evidenceRefs",
    "dataGaps",
    "warnings",
    "brief",
    "comparison",
  ];
  if (
    fields.some((k) => !(k in value)) ||
    Object.keys(value).some((k) => !fields.includes(k)) ||
    !outputText(value.answer) ||
    !String(value.answer).trim() ||
    !outputText(value.summary, 500)
  )
    invalid();
  const known = new Set(request.packet.evidence.map((e) => e.id));
  if (!ids(value.evidenceRefs, known, false)) invalid();
  for (const k of ["dataGaps", "warnings"])
    if (
      !Array.isArray(value[k]) ||
      (value[k] as unknown[]).length > 6 ||
      (value[k] as unknown[]).some((t) => !outputText(t, 600))
    )
      invalid();
  const used = new Set(value.evidenceRefs as string[]);
  // Inline source IDs are references too; reject invented IDs in narrative text.
  for (const id of JSON.stringify(value).match(/\bev-[a-zA-Z0-9_-]+\b/g) ?? []) {
    if (!known.has(id)) invalid();
  }
  const validateClaim = (v: unknown): AdvisorClaim => {
    if (
      !isObject(v) ||
      Object.keys(v).some((k) => !["text", "evidenceIds"].includes(k)) ||
      !outputText(v.text, 800) ||
      !ids(v.evidenceIds, known)
    )
      invalid();
    const es = request.packet.evidence.filter((e) =>
      (v.evidenceIds as string[]).includes(e.id),
    );
    if (!groundedNumbers(String(v.text), es)) invalid();
    (v.evidenceIds as string[]).forEach((id) => used.add(id));
    return v as unknown as AdvisorClaim;
  };
  if (
    !Array.isArray(value.observations) ||
    value.observations.length > 6 ||
    !Array.isArray(value.recommendations) ||
    value.recommendations.length > 3
  )
    invalid();
  value.observations.forEach(validateClaim);
  value.recommendations.forEach(validateClaim);
  if (
    !Array.isArray(value.brief) ||
    value.brief.length > 6 ||
    !Array.isArray(value.comparison) ||
    value.comparison.length > 2
  )
    invalid();
  for (const section of value.brief) {
    if (
      !isObject(section) ||
      Object.keys(section).some((k) => !["title", "items"].includes(k)) ||
      !outputText(section.title, 100) ||
      !Array.isArray(section.items) ||
      section.items.length > 3
    )
      invalid();
    section.items.forEach(validateClaim);
  }
  for (const option of value.comparison) {
    if (
      !isObject(option) ||
      Object.keys(option).some(
        (k) => !["option", "benefits", "risks", "evidenceIds"].includes(k),
      ) ||
      !outputText(option.option, 150) ||
      !outputText(option.benefits, 600) ||
      !outputText(option.risks, 600) ||
      !ids(option.evidenceIds, known)
    )
      invalid();
    (option.evidenceIds as string[]).forEach((id) => used.add(id));
    const es = request.packet.evidence.filter((e) =>
      (option.evidenceIds as string[]).includes(e.id),
    );
    if (
      !groundedNumbers(
        String(option.option) +
          " " +
          String(option.benefits) +
          " " +
          String(option.risks),
        es,
      )
    )
      invalid();
  }
  if (used.size > 6) invalid();
  const ev = request.packet.evidence.filter((e) => used.has(e.id));
  if (
    !groundedNumbers(
      [
        value.answer,
        value.summary,
        ...(value.dataGaps as string[]),
        ...(value.warnings as string[]),
      ].join(" "),
      ev,
    )
  )
    invalid();
  if (value.observations.length && !ev.length) invalid();
  const output = value as unknown as AdvisorModelOutput;
  return {
    ...structuredClone(output),
    recommendations: output.recommendations.map((r) => ({
      ...r,
      confidence: evidenceConfidence(
        request.packet.evidence.filter((e) => r.evidenceIds.includes(e.id)),
        output.dataGaps,
      ),
    })),
    evidenceRefs: structuredClone(ev),
    confidence: evidenceConfidence(ev, output.dataGaps),
    generatedAt,
    provider,
    model,
    promptVersion: AGENT_PROMPT_VERSION,
    requestTimestamp: request.packet.generatedAt,
    schemaValidated: true,
    modelCalled,
    intent: classifyIntent(
      request.question,
      request.selection,
      request.history,
    ),
  };
}
