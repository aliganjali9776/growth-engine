import type { DiagnosisState } from "./types";
import type { AgentAdvisorResponse } from "../advisor/types";
import { fingerprint } from "./source";
export const DIAGNOSIS_PROMPT_VERSION = "diagnosis-wording-v1";
export interface DiagnosisWording {
  diagnosisTitle: string;
  diagnosisSummary: string;
  managementQuestion: string;
  businessRationale: string;
}
export function applyDiagnosisWording(
  previous: DiagnosisState,
  id: string,
  wording: unknown,
  model: string,
  at = new Date().toISOString(),
): DiagnosisState {
  if (!wording || typeof wording !== "object" || Array.isArray(wording))
    throw Error("عبارت‌بندی نامعتبر");
  const w = wording as DiagnosisWording;
  if (
    Object.keys(w).sort().join(",") !==
      "businessRationale,diagnosisSummary,diagnosisTitle,managementQuestion" ||
    Object.values(w).some(
      (v) => typeof v !== "string" || !v.trim() || v.length > 600,
    )
  )
    throw Error("عبارت‌بندی نامعتبر");
  // Wording cannot introduce new numbers, causal certainty or execution commands.
  const state = structuredClone(previous),
    d = state.diagnoses.find((d) => d.id === id);
  if (!d) throw Error("تحلیل پیدا نشد.");
  const factText = state.evidence
    .filter((e) => d.evidenceIds.includes(e.id))
    .map((e) => JSON.stringify(e.value))
    .join(" ");
  const normalize = (s: string) =>
    s.replace(/[۰-۹]/g, (c) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c)));
  const allowed = new Set(normalize(factText).match(/\d+(?:\.\d+)?/g) ?? []);
  if (
    Object.values(w).some(
      (v) =>
        (normalize(v).match(/\d+(?:\.\d+)?/g) ?? []).some(
          (n) => !allowed.has(n),
        ) ||
        /قطعاً|علت قطعی|اثبات می‌کند|caused by|definitely|automatically execute/i.test(
          v,
        ),
    )
  )
    throw Error("عبارت‌بندی با شواهد سازگار نیست");
  d.title = w.diagnosisTitle;
  d.summary = w.diagnosisSummary;
  d.managementQuestion = w.managementQuestion;
  for (const r of d.recommendations) r.rationale = w.businessRationale;
  state.history.push({
    id: "h-" + fingerprint([id, at, state.history.length]),
    diagnosisId: id,
    event: "Updated",
    timestamp: at,
    summary: w.businessRationale,
    evidenceIds: [...d.evidenceIds],
  });
  const run = state.runs.at(-1);
  if (run) {
    run.mode = "Hybrid";
    run.modelUsed = model;
    run.promptVersion = DIAGNOSIS_PROMPT_VERSION;
  }
  return state;
}
export function responseWording(
  response: AgentAdvisorResponse,
): DiagnosisWording {
  return {
    diagnosisTitle: response.observations[0]?.text ?? response.answer,
    diagnosisSummary: response.summary,
    managementQuestion:
      response.recommendations[0]?.text ??
      "کدام شواهد مرتبط باید پیش از تصمیم مدیریت بازبینی شوند؟",
    businessRationale: response.answer,
  };
}
