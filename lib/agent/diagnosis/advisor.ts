import type { SignalInput, DiagnosisState } from "./types";
import type { AgentAdvisorResponse } from "../advisor/types";
export function diagnosisAdvisorAnswer(
  state: DiagnosisState,
  input: SignalInput,
  at = new Date().toISOString(),
): AgentAdvisorResponse | null {
  if (!state.runs.length) return null;
  const stale = state.runs.at(-1)!.contextVersion !== input.signature;
  const selected = state.priorities
    .map((p) => state.diagnoses.find((d) => d.id === p.diagnosisId)!)
    .filter(Boolean);
  const opportunities = state.diagnoses
    .filter(
      (d) =>
        d.category === "Opportunity" &&
        !["Resolved", "Dismissed"].includes(d.status),
    )
    .slice(0, 1);
  const quality = state.diagnoses
    .filter(
      (d) =>
        d.category === "DataQuality" &&
        !["Resolved", "Dismissed"].includes(d.status),
    )
    .slice(0, 1);
  const picked = [
    ...new Map(
      [...selected, ...opportunities, ...quality].map((d) => [d.id, d]),
    ).values(),
  ];
  // Current facts are retrieved again. Historical diagnoses are explicitly dated, never silently refreshed.
  const ids = new Set(picked.flatMap((d) => d.evidenceIds));
  const evidenceRefs = input.evidence
    .filter(
      (e) =>
        ids.has(e.id) &&
        e.summary.length <= 600 &&
        (!e.entityRef ||
          [
            "process",
            "objective",
            "KR",
            "constraint",
            "experiment",
            "candidate",
            "channel",
          ].includes(e.entityRef.entityType)),
    )
    .slice(0, 6)
    .map((e) => ({ ...e, value: e.summary, summary: e.summary.slice(0, 600) }));
  const claims = picked
    .map((d) => ({
      text: d.title,
      evidenceIds: d.evidenceIds.filter((id) =>
        evidenceRefs.some((e) => e.id === id),
      ),
    }))
    .filter((c) => c.evidenceIds.length);
  const answer = stale
    ? "داده‌ها پس از آخرین تحلیل تغییر کرده‌اند؛ برای تعیین مشکلات فعلی، تحلیل وضعیت فعلی را در مرکز تحلیل اجرا کنید."
    : claims
        .filter((c) => selected.some((d) => d.title === c.text))
        .map((c) => c.text)
        .join("؛ ") ||
      (selected.length
        ? "برای نمایش تحلیل، شواهد قابل ارجاع کافی نیست؛ مرکز تحلیل را بررسی کنید."
        : "در داده‌های فعلی مسئله مهم و قابل اتکایی شناسایی نشد.");
  return {
    answer,
    summary:
      "بر پایه آخرین تحلیل دستی؛ زمان تحلیل در مرکز تحلیل نمایش داده می‌شود.",
    observations: stale ? [] : claims,
    recommendations: [],
    evidenceRefs: stale ? [] : evidenceRefs,
    dataGaps: quality.map((d) => d.managementQuestion),
    warnings: stale
      ? ["تحلیل ذخیره‌شده نیازمند تازه‌سازی است."]
      : ["الگوهای همراه، رابطه علت‌ومعلولی را اثبات نمی‌کنند."],
    brief: stale
      ? []
      : [
          {
            title: "اولویت‌های مدیریت",
            items: claims.filter((c) =>
              selected.some((d) => d.title === c.text),
            ),
          },
          {
            title: "فرصت و کیفیت داده",
            items: claims.filter(
              (c) => !selected.some((d) => d.title === c.text),
            ),
          },
        ].filter((s) => s.items.length),
    comparison: [],
    confidence: stale
      ? "Low"
      : selected.some((d) => d.confidence === "Low")
        ? "Low"
        : "Medium",
    generatedAt: at,
    provider: "policy",
    model: "diagnosis-rules",
    promptVersion: "diagnosis-v1",
    requestTimestamp: at,
    schemaValidated: true,
    modelCalled: false,
    intent: "PriorityQuestion",
  };
}
