import type { StrategyStore, StrategyRole } from "../model";
import { calculateKRProgress, calculateKRStatus } from "../kr/calculations";
import { objectiveMeasurement } from "../kr/report";
import {
  isInitiativeActive,
  isInitiativeOverdue,
  initiativeKRSignals,
} from "../initiatives/report";
import {
  adaptThresholds as t,
  type StrategyAdaptReview,
  type StrategyCycleReview,
  type EvidenceSnapshot,
  type AdaptSignal,
} from "./types";
import type { KRCheckIn } from "../weekly/types";
import { measurementDefinition } from "./definition";
export function completedHistory(
  store: StrategyStore,
  cycleId: string,
  end: string,
) {
  return (store.krCheckIns ?? []).filter(
    (c) =>
      c.cycleId === cycleId &&
      c.periodStart <= end &&
      store.weeklyReviews?.some(
        (r) => r.id === c.reviewId && r.status === "completed",
      ),
  );
}
function series(rows: KRCheckIn[]) {
  return [...new Set(rows.map((r) => r.keyResultId))]
    .map((id) =>
      rows
        .filter((r) => r.keyResultId === id)
        .sort((a, b) => b.weekNumber - a.weekNumber)
        .slice(0, t.consecutiveWeeks),
    )
    .filter(
      (xs) =>
        xs.length === t.consecutiveWeeks &&
        xs.every((x, i) => !i || xs[i - 1].weekNumber === x.weekNumber + 1),
    );
}
const normalized = (s: string) =>
  s.trim().replace(/[ي]/g, "ی").replace(/[ك]/g, "ک").replace(/\s+/g, " ");
export function detectRepeatedBlockers(rows: KRCheckIn[]) {
  return series(rows)
    .filter(
      (xs) =>
        normalized(xs[0].blocker) &&
        xs.every((x) => normalized(x.blocker) === normalized(xs[0].blocker)),
    )
    .map((xs) => ({
      keyResultId: xs[0].keyResultId,
      text: xs[0].blocker,
      weeks: xs.map((x) => x.weekNumber),
    }));
}
export function detectStalledKRs(rows: KRCheckIn[]) {
  return series(rows)
    .filter((xs) =>
      xs.every(
        (x) =>
          x.movement === "stable" &&
          x.progress !== null &&
          x.progress < 100 &&
          measurementDefinition(x.krSnapshot) ===
            measurementDefinition(xs[0].krSnapshot),
      ),
    )
    .map((xs) => xs[0].keyResultId);
}
export function detectConfidenceDecline(rows: KRCheckIn[]) {
  return series(rows)
    .filter(
      (xs) =>
        xs.every((x) => x.confidence !== null) &&
        xs.every((x, i) => !i || xs[i - 1].confidence! < x.confidence!) &&
        xs.at(-1)!.confidence! - xs[0].confidence! >= t.confidenceDrop,
    )
    .map((xs) => xs[0].keyResultId);
}
export function adaptReviewSignals(
  store: StrategyStore,
  cycleId: string,
  roles: StrategyRole[],
  today: string,
  end = today,
): AdaptSignal[] {
  const rows = completedHistory(store, cycleId, end),
    signals: AdaptSignal[] = [];
  const add = (
    kind: string,
    entityId: string,
    severity: number,
    text: string,
  ) =>
    signals.push({ id: kind + "-" + entityId, entityId, kind, severity, text });
  for (const o of store.objectives.filter(
    (o) => o.cycleId === cycleId && o.status === "active",
  )) {
    const m = objectiveMeasurement(store, o, roles, today);
    if (["offTrack", "atRisk"].includes(m.health.health))
      add(
        "objective-risk",
        o.id,
        90,
        `${o.code}: هدف ${m.health.health === "offTrack" ? "خارج از مسیر" : "در معرض ریسک"} است.`,
      );
  }
  for (const k of (store.keyResults ?? []).filter(
    (k) => k.cycleId === cycleId && k.lifecycle === "active",
  )) {
    const status = calculateKRStatus(k, today).status;
    if (status === "offTrack" || status === "atRisk")
      add(
        "kr-risk",
        k.id,
        status === "offTrack" ? 95 : 80,
        `${k.code}: نتیجه ${status === "offTrack" ? "خارج از مسیر" : "در معرض ریسک"} است.`,
      );
  }
  for (const b of detectRepeatedBlockers(rows))
    add(
      "repeated",
      b.keyResultId,
      95,
      `این مانع در ${t.consecutiveWeeks} مرور متوالی تکرار شده است: ${b.text}`,
    );
  for (const id of detectStalledKRs(rows))
    add(
      "stalled",
      id,
      90,
      `این نتیجه کلیدی طی ${t.consecutiveWeeks} هفته ثبت‌شده متوالی حرکت معناداری نداشته است.`,
    );
  for (const id of detectConfidenceDecline(rows))
    add(
      "confidence",
      id,
      85,
      "اطمینان تیم نسبت به تحقق این نتیجه در حال کاهش است.",
    );
  for (const i of (store.initiatives ?? []).filter(
    (i) => i.cycleId === cycleId && i.status !== "cancelled",
  )) {
    if (["weak", "ineffective"].includes(i.effectiveness))
      add(
        "ineffective",
        i.id,
        80,
        `${i.code}: اثربخشی اقدام ${i.effectiveness === "weak" ? "کم" : "ناموفق"} ارزیابی شده است.`,
      );
    if (i.status === "blocked" && ["critical", "high"].includes(i.priority))
      add(
        "blocked",
        i.id,
        95,
        `${i.code}: اقدام مهم متوقف است؛ ${i.blockedReason}`,
      );
    if (isInitiativeOverdue(i, today))
      add("overdue", i.id, 85, `${i.code}: مهلت اقدام گذشته است.`);
    for (const f of initiativeKRSignals(i, store, today))
      add("execution-" + f.id, i.id, f.severity, f.text);
  }
  for (const p of store.priorities.filter(
    (p) => p.cycleId === cycleId && p.status === "selected",
  )) {
    const outcomes = store.objectives
      .filter((o) => o.relatedPriorityId === p.id && o.status === "active")
      .map((o) => objectiveMeasurement(store, o, roles, today).progress);
    if (
      !outcomes.length ||
      outcomes.every((x) => x === null || x < t.lowProgress)
    )
      add(
        "priority-progress",
        p.id,
        65,
        `${p.title}: پیشرفت اهداف مرتبط کم یا نامشخص است؛ اعتبار و تمرکز اولویت را بررسی کنید.`,
      );
  }
  return signals.sort(
    (a, b) => b.severity - a.severity || a.id.localeCompare(b.id),
  );
}
export function adaptReviewQuality(
  store: StrategyStore,
  r: StrategyAdaptReview,
  signals: AdaptSignal[],
) {
  const risks = signals.filter((s) => s.severity >= 80),
    initiatives = (store.initiatives ?? []).filter(
      (i) =>
        i.cycleId === r.cycleId &&
        isInitiativeActive(i) &&
        ["critical", "high"].includes(i.priority),
    ),
    priorities = store.priorities.filter(
      (p) => p.cycleId === r.cycleId && p.status === "selected",
    );
  const ratio = (have: number, total: number) => (total ? have / total : 1);
  const parts = {
    risk:
      25 *
      ratio(
        risks.filter((s) => r.reviewedRiskIds.includes(s.id)).length,
        risks.length,
      ),
    initiatives:
      25 *
      ratio(
        initiatives.filter((i) =>
          r.initiativeChanges.some(
            (d) => d.initiativeId === i.id && d.rationale.trim(),
          ),
        ).length,
        initiatives.length,
      ),
    decisions:
      r.decisions.some((d) => d.title.trim() && d.description.trim()) ||
      r.initiativeChanges.some((d) => d.rationale.trim())
        ? 20
        : 0,
    resources:
      r.resourcesReviewed &&
      priorities.every((p) =>
        r.priorityChanges.some(
          (x) => x.priorityId === p.id && x.rationale.trim(),
        ),
      )
        ? 15
        : 0,
    focus: r.nextFocus.some((x) => x.trim()) ? 15 : 0,
  };
  return {
    parts,
    score: Math.round(Object.values(parts).reduce((a, b) => a + b, 0)),
  };
}
export function evidenceSnapshot(
  store: StrategyStore,
  cycleId: string,
  roles: StrategyRole[],
  today: string,
  now: string,
  end = today,
): EvidenceSnapshot {
  const objectives = store.objectives.filter((o) => o.cycleId === cycleId),
    keyResults = (store.keyResults ?? []).filter((k) => k.cycleId === cycleId),
    initiatives = (store.initiatives ?? []).filter(
      (i) => i.cycleId === cycleId,
    ),
    rows = completedHistory(store, cycleId, end),
    objectiveOutcomes = objectives.map((o) => {
      const m = objectiveMeasurement(store, o, roles, today);
      return {
        id: o.id,
        progress: m.progress,
        confidence: m.confidence,
        health: m.health.health,
        achievedKRs: m.krs.filter((k) => calculateKRProgress(k) === 100).length,
        missedKRs: m.krs.filter(
          (k) =>
            calculateKRProgress(k) !== null && calculateKRProgress(k)! < 100,
        ).length,
      };
    }),
    known = objectiveOutcomes.filter(
      (m) =>
        m.progress !== null &&
        objectives.find((o) => o.id === m.id)?.status !== "cancelled",
    ),
    valid = keyResults.filter(
      (k) => k.lifecycle === "active" && k.confidence !== null,
    ),
    krStatuses: EvidenceSnapshot["krStatuses"] = {
      notStarted: 0,
      onTrack: 0,
      atRisk: 0,
      offTrack: 0,
      achieved: 0,
      unknown: 0,
    };
  for (const k of keyResults.filter((k) => k.lifecycle === "active"))
    krStatuses[calculateKRStatus(k, today).status ?? "unknown"]++;
  return structuredClone({
    recordedAt: now,
    cycle: store.cycles.find((c) => c.id === cycleId)!,
    roles,
    objectives,
    priorities: store.priorities.filter((p) => p.cycleId === cycleId),
    keyResults,
    initiatives,
    checkIns: rows,
    assumptions: (store.strategicAssumptions ?? []).filter(
      (a) => a.cycleId === cycleId,
    ),
    learnings: (store.strategyLearnings ?? []).filter(
      (l) => l.cycleId === cycleId,
    ),
    signals: adaptReviewSignals(store, cycleId, roles, today, end),
    objectiveOutcomes,
    overallProgress: known.length
      ? known.reduce((n, o) => n + o.progress!, 0) / known.length
      : null,
    averageConfidence: valid.length
      ? valid.reduce((n, k) => n + k.confidence!, 0) / valid.length
      : null,
    krStatuses,
    repeatedBlockers: detectRepeatedBlockers(rows).length,
    stalledKRs: detectStalledKRs(rows).length,
    confidenceDeclines: detectConfidenceDecline(rows).length,
    activeInitiatives: initiatives.filter(isInitiativeActive).length,
    blockedInitiatives: initiatives.filter((i) => i.status === "blocked")
      .length,
    ineffectiveInitiatives: initiatives.filter((i) =>
      ["weak", "ineffective"].includes(i.effectiveness),
    ).length,
    quality: 0,
  });
}
export function objectiveFinalOutcome(s: EvidenceSnapshot, id: string) {
  return s.objectiveOutcomes.find((o) => o.id === id);
}
export function krFinalOutcome(s: EvidenceSnapshot, id: string) {
  const k = s.keyResults.find((k) => k.id === id);
  return k
    ? {
        kr: k,
        progress: calculateKRProgress(k),
        status: calculateKRStatus(k, s.recordedAt.slice(0, 10)).status,
        history: s.checkIns.filter((c) => c.keyResultId === id),
      }
    : null;
}
export function cycleReviewReadiness(
  store: StrategyStore,
  r: StrategyCycleReview,
) {
  const warnings: string[] = [];
  if (
    store.objectives.some(
      (o) => o.cycleId === r.cycleId && !r.objectiveClassifications[o.id],
    )
  )
    warnings.push("طبقه‌بندی نتیجه همه اهداف لازم است.");
  if (
    store.keyResults?.some(
      (k) => k.cycleId === r.cycleId && !r.krClassifications[k.id],
    )
  )
    warnings.push("طبقه‌بندی نتیجه همه KRها لازم است.");
  if (!(store.strategyLearnings ?? []).some((l) => l.cycleId === r.cycleId))
    warnings.push("هنوز درس‌آموخته‌ای ثبت نشده است.");
  if (
    store.initiatives?.some(
      (i) =>
        i.cycleId === r.cycleId &&
        i.status !== "cancelled" &&
        (!r.initiativeLearnings.some(
          (l) => l.initiativeId === i.id && l.lesson.trim(),
        ) ||
          i.effectiveness === "notEvaluated"),
    )
  )
    warnings.push("یادگیری یا اثربخشی برخی اقدامات هنوز ثبت نشده است.");
  if (
    store.weeklyReviews?.some(
      (w) => w.cycleId === r.cycleId && w.status === "draft",
    ) ||
    store.adaptReviews?.some(
      (a) => a.cycleId === r.cycleId && a.status === "draft",
    )
  )
    warnings.push("مرور هفتگی یا تطبیقی باز وجود دارد.");
  return warnings;
}
export function strategyChangeSummary(store: StrategyStore, cycleId: string) {
  const rows = (store.strategyChanges ?? []).filter(
    (c) => c.cycleId === cycleId,
  );
  return {
    total: rows.length,
    krTargets: rows.filter(
      (c) => c.entityType === "kr" && c.fieldChanged === "targetValue",
    ).length,
    objectiveDeadlines: rows.filter(
      (c) => c.entityType === "objective" && c.fieldChanged === "deadline",
    ).length,
    initiativeChanges: rows.filter((c) => c.entityType === "initiative").length,
    priorityChanges: rows.filter((c) => c.entityType === "priority").length,
  };
}
export function learningSummary(store: StrategyStore, cycleId: string) {
  return {
    lessons: (store.strategyLearnings ?? []).filter(
      (l) => l.cycleId === cycleId,
    ).length,
    validated: (store.strategicAssumptions ?? []).filter(
      (a) => a.cycleId === cycleId && a.status === "supported",
    ).length,
    invalidated: (store.strategicAssumptions ?? []).filter(
      (a) => a.cycleId === cycleId && a.status === "invalidated",
    ).length,
    effective: (store.initiatives ?? []).filter(
      (i) => i.cycleId === cycleId && i.effectiveness === "effective",
    ).length,
    ineffective: (store.initiatives ?? []).filter(
      (i) => i.cycleId === cycleId && i.effectiveness === "ineffective",
    ).length,
    carryForward: (store.cycleResets ?? [])
      .filter((r) => r.sourceCycleId === cycleId)
      .reduce((n, r) => n + r.mappings.length, 0),
  };
}
