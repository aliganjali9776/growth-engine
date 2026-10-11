import type { StrategyStore, StrategyRole, StrategyObjective } from "../model";
import type { KeyResult, KRFinding } from "./types";
import {
  calculateKRProgress,
  calculateKRStatus,
  calculateObjectiveProgress,
  calculateObjectiveConfidence,
  calculateObjectiveHealth,
  calculateWeightedContribution,
  weightInfo,
} from "./calculations";
import { calculateKRCompleteness } from "./validation";
export function objectiveMeasurement(
  store: StrategyStore,
  objective: StrategyObjective,
  roles: StrategyRole[],
  today: string,
) {
  const krs = (store.keyResults ?? []).filter(
    (k) => k.objectiveId === objective.id && k.lifecycle === "active",
  );
  const mode = objective.krWeightMode ?? "equal",
    weights = weightInfo(krs, mode);
  const rows = krs.map((k) => ({
    kr: k,
    progress: calculateKRProgress(k),
    pacing: calculateKRStatus(k, today),
    completeness: calculateKRCompleteness(k, store, roles, mode),
    weight: weights.weights.find((w) => w.id === k.id)?.weight ?? null,
    contribution: weights.valid
      ? calculateWeightedContribution(
          calculateKRProgress(k),
          weights.weights.find((w) => w.id === k.id)?.weight ?? null,
        )
      : null,
  }));
  return {
    objective,
    krs,
    rows,
    weights,
    progress: calculateObjectiveProgress(krs, mode),
    confidence: calculateObjectiveConfidence(krs, mode),
    confidenceCoverage: krs.length
      ? (rows.filter((r) => r.kr.confidence !== null).length / krs.length) * 100
      : 0,
    health: calculateObjectiveHealth(
      krs,
      mode,
      today,
      (k) =>
        calculateKRCompleteness(k, store, roles, mode).missing.length === 0,
    ),
    completeness: rows.length
      ? Math.round(
          rows.reduce((n, r) => n + r.completeness.score, 0) / rows.length,
        )
      : 0,
  };
}
export function measurementReport(
  store: StrategyStore,
  roles: StrategyRole[],
  today: string,
  cycleId?: string,
) {
  const id = cycleId ?? store.cycles.find((c) => c.status === "active")?.id,
    cycle = store.cycles.find((c) => c.id === id);
  const objectives = store.objectives.filter(
    (o) => o.cycleId === id && o.status !== "cancelled",
  );
  const measured = objectives.map((o) =>
    objectiveMeasurement(store, o, roles, today),
  );
  const active = measured.filter((m) => m.objective.status === "active");
  const rows = measured.flatMap((m) => m.rows),
    known = active.filter((m) => m.progress !== null);
  const findings: KRFinding[] = [];
  const add = (id: string, severity: number, text: string, href: string) =>
    findings.push({ id, severity, text, href });
  for (const m of measured) {
    const href = `/strategy/cycles/${m.objective.cycleId}/objectives/${m.objective.id}`;
    if (!m.krs.length)
      add(
        "no-kr-" + m.objective.id,
        65,
        `«${m.objective.title}»: هنوز نتیجه کلیدی تعریف نشده است.`,
        href,
      );
    else if (!m.weights.valid)
      add(
        "weight-" + m.objective.id,
        95,
        `«${m.objective.title}»: ${m.weights.label}؛ پیشرفت هدف محاسبه نمی‌شود.`,
        href,
      );
    if (
      m.rows.filter(
        (r) => r.pacing.status === "offTrack" || r.pacing.status === "atRisk",
      ).length >= 2
    )
      add(
        "weak-" + m.objective.id,
        85,
        `«${m.objective.title}»: چند نتیجه کلیدی نیازمند توجه است.`,
        href,
      );
    for (const r of m.rows) {
      const k = r.kr,
        link = href + "#kr-" + k.id;
      if (r.completeness.missing.length)
        add(
          "missing-" + k.id,
          90,
          `${k.code}: داده ناقص — ${r.completeness.missing.join(" ")}`,
          link,
        );
      if (r.pacing.status === "offTrack")
        add("off-" + k.id, 100, `${k.code} · ${k.title}: خارج از مسیر`, link);
      else if (r.pacing.status === "atRisk")
        add("risk-" + k.id, 80, `${k.code} · ${k.title}: در معرض ریسک`, link);
      if (k.confidence !== null && k.confidence <= 3)
        add(
          "confidence-" + k.id,
          75,
          `${k.code}: اطمینان مدیریت پایین است.`,
          link,
        );
      if (r.pacing.overdue)
        add(
          "overdue-" + k.id,
          98,
          `${k.code}: مهلت گذشته و تحقق کامل ثبت نشده است.`,
          link,
        );
      if (
        r.pacing.stale &&
        m.objective.status === "active" &&
        cycle?.status === "active"
      )
        add(
          "stale-" + k.id,
          70,
          `${k.code}: نیازمند به‌روزرسانی؛ مقدار فعلی ثبت نشده یا بیش از ۷ روز از آن گذشته است.`,
          link,
        );
    }
  }
  findings.sort((a, b) => b.severity - a.severity || a.id.localeCompare(b.id));
  const activeRows = active.flatMap((m) => m.rows);
  return {
    cycle,
    measured,
    rows,
    activeRows,
    findings,
    activeObjectives: active.length,
    totalKRs: rows.length,
    progress: known.length
      ? known.reduce((n, m) => n + m.progress!, 0) / known.length
      : null,
    progressCoverage: active.length ? (known.length / active.length) * 100 : 0,
    completeness: rows.length
      ? Math.round(
          rows.reduce((n, r) => n + r.completeness.score, 0) / rows.length,
        )
      : 0,
    counts: {
      onTrack: activeRows.filter((r) => r.pacing.status === "onTrack").length,
      atRisk: activeRows.filter((r) => r.pacing.status === "atRisk").length,
      offTrack: activeRows.filter((r) => r.pacing.status === "offTrack").length,
      lowConfidence: activeRows.filter(
        (r) => r.kr.confidence !== null && r.kr.confidence <= 3,
      ).length,
    },
  };
}
export function krReadOnly(
  store: StrategyStore,
  k: Pick<KeyResult, "objectiveId" | "cycleId">,
) {
  return (
    store.objectives.find((o) => o.id === k.objectiveId)?.status ===
      "cancelled" ||
    ["archived", "completed"].includes(
      store.cycles.find((c) => c.id === k.cycleId)?.status ?? "",
    )
  );
}
