import type { StrategyStore, StrategyRole, StrategyObjective } from "../model";
import { calculateKRStatus } from "../kr/calculations";
import { krStatuses } from "../kr/types";
import { objectiveMeasurement } from "../kr/report";
import {
  portfolioSummary,
  initiativeKRSignals,
  objectiveExecution,
} from "../initiatives/report";
import {
  activeWeeklyKRs,
  weeklyCheckInCompletion,
  weeklyReviewQuality,
} from "./calculations";
import type {
  StrategyWeeklyReview,
  StrategyWeeklySnapshot,
  ObjectiveWeeklySnapshot,
  WeeklyBlocker,
} from "./types";
// Checked KRs use this review's evidence. Unchecked KRs keep live values with
// explicit coverage flags; later ad-hoc edits do not masquerade as a check-in.
function weeklyMeasurementStore(
  store: StrategyStore,
  review: StrategyWeeklyReview,
): StrategyStore {
  return {
    ...store,
    keyResults: store.keyResults?.map((k) => {
      const c = store.krCheckIns?.find(
        (c) => c.reviewId === review.id && c.keyResultId === k.id,
      );
      return c
        ? { ...c.krSnapshot, lifecycle: k.lifecycle, weight: k.weight }
        : k;
    }),
  };
}
export function aggregateBlockers(
  store: StrategyStore,
  review: StrategyWeeklyReview,
): WeeklyBlocker[] {
  const rows: WeeklyBlocker[] = [
    ...(store.krCheckIns ?? [])
      .filter((c) => c.reviewId === review.id && c.blocker.trim())
      .map((c) => ({
        entityId: c.keyResultId,
        source: "kr" as const,
        title: c.krSnapshot.title,
        text: c.blocker,
      })),
    ...(store.initiatives ?? [])
      .filter((i) => i.cycleId === review.cycleId && i.status === "blocked")
      .map((i) => ({
        entityId: i.id,
        source: "initiative" as const,
        title: i.title,
        text: i.blockedReason,
      })),
    ...review.blockers
      .filter((x) => x.trim())
      .map((text, n) => ({
        entityId: review.id,
        source: "review" as const,
        title: "مانع مدیریت",
        text,
      })),
  ];
  const seen = new Set<string>();
  return rows.filter((x) => {
    const k = x.entityId + "|" + x.text.trim().replace(/\s+/g, " ");
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
export function weeklyReviewSignals(
  store: StrategyStore,
  review: StrategyWeeklyReview,
  today: string,
) {
  store = weeklyMeasurementStore(store, review);
  const krs = activeWeeklyKRs(store, review.cycleId),
    ins = (store.krCheckIns ?? []).filter((c) => c.reviewId === review.id),
    completion = weeklyCheckInCompletion(krs, ins, review.weekNumber),
    riskIds = krs
      .filter((k) =>
        ["atRisk", "offTrack"].includes(
          calculateKRStatus(k, today).status ?? "",
        ),
      )
      .map((k) => k.id),
    blockers = aggregateBlockers(store, review);
  const signals = [
    ...(store.initiatives ?? [])
      .filter(
        (i) =>
          i.cycleId === review.cycleId &&
          i.status !== "cancelled" &&
          i.progress > 70,
      )
      .flatMap((i) => {
        const rows = (store.krCheckIns ?? [])
          .filter(
            (c) =>
              c.keyResultId === i.keyResultId &&
              c.weekNumber <= review.weekNumber,
          )
          .sort((a, b) => b.weekNumber - a.weekNumber);
        let count = 0;
        for (const c of rows) {
          if (
            c.weekNumber !== review.weekNumber - count ||
            c.movement !== "stable"
          )
            break;
          count++;
        }
        return count >= 3
          ? [
              `${i.code}: اجرا ${Math.round(i.progress)}٪ است اما KR در ${count} هفته پیاپی ثبت‌شده تغییر معنادار نداشته؛ نیازمند بررسی، بدون استنتاج علت‌ومعلولی.`,
            ]
          : [];
      }),
    ...krs
      .filter((k) => riskIds.includes(k.id))
      .map(
        (k) =>
          `${k.code}: ${krStatuses[calculateKRStatus(k, today).status as "atRisk" | "offTrack"]}؛ وضعیت و قدم بعدی را بررسی کنید.`,
      ),
    ...completion.stale.map((k) => `${k.code}: به‌روزرسانی نشده در این هفته`),
    ...ins
      .filter((c) => (c.confidenceDelta ?? 0) < 0)
      .map(
        (c) => `${c.krSnapshot.code}: اطمینان نسبت به ثبت قبلی کاهش یافته است.`,
      ),
    ...ins
      .filter((c) => c.movement === "regressed")
      .map((c) => `${c.krSnapshot.code}: نتیجه پسرفت کرده است.`),
    ...(store.initiatives ?? [])
      .filter((i) => i.cycleId === review.cycleId)
      .flatMap((i) =>
        initiativeKRSignals(i, store, today).map(
          (f) => i.code + " · " + f.text,
        ),
      ),
    ...store.objectives
      .filter((o) => o.cycleId === review.cycleId && o.status === "active")
      .flatMap((o) => {
        const gap = objectiveExecution(store, o.id, today);
        return gap.needsReview ? [`${o.code}: ${gap.text}`] : [];
      }),
  ];
  return { krs, ins, completion, riskIds, blockers, signals };
}
export function createObjectiveSnapshot(
  store: StrategyStore,
  o: StrategyObjective,
  review: StrategyWeeklyReview,
  roles: StrategyRole[],
  today: string,
  now: string,
): ObjectiveWeeklySnapshot {
  store = weeklyMeasurementStore(store, review);
  const m = objectiveMeasurement(store, o, roles, today),
    checked = weeklyCheckInCompletion(
      m.krs,
      (store.krCheckIns ?? []).filter((i) => i.reviewId === review.id),
      review.weekNumber,
    );
  return {
    reviewId: review.id,
    cycleId: o.cycleId,
    objectiveId: o.id,
    title: o.title,
    weekNumber: review.weekNumber,
    progress: m.progress,
    confidence: m.confidence,
    health: m.health.health,
    recordedAt: now,
    checkedIn: checked.checkedIn,
    total: checked.total,
  };
}
export function createStrategySnapshot(
  store: StrategyStore,
  review: StrategyWeeklyReview,
  roles: StrategyRole[],
  today: string,
  now: string,
): StrategyWeeklySnapshot {
  store = weeklyMeasurementStore(store, review);
  const data = weeklyReviewSignals(store, review, today),
    objectives = store.objectives
      .filter((o) => o.cycleId === review.cycleId && o.status === "active")
      .map((o) => createObjectiveSnapshot(store, o, review, roles, today, now)),
    known = objectives.filter((o) => o.progress !== null),
    confidence = data.krs.filter((k) => k.confidence !== null),
    initiatives = (store.initiatives ?? []).filter(
      (i) => i.cycleId === review.cycleId,
    ),
    p = portfolioSummary(initiatives, today);
  const krStatusCounts: StrategyWeeklySnapshot["krStatusCounts"] = {
      notStarted: 0,
      onTrack: 0,
      atRisk: 0,
      offTrack: 0,
      achieved: 0,
      unknown: 0,
    },
    objectiveHealthCounts: StrategyWeeklySnapshot["objectiveHealthCounts"] = {
      healthy: 0,
      atRisk: 0,
      offTrack: 0,
      achieved: 0,
      insufficient: 0,
    };
  for (const k of data.krs)
    krStatusCounts[calculateKRStatus(k, today).status ?? "unknown"]++;
  for (const o of objectives) objectiveHealthCounts[o.health]++;
  const quality = weeklyReviewQuality(
    data.completion.percent,
    data.riskIds,
    review,
    data.blockers.length,
    (store.strategyDecisions ?? []).filter((d) => d.reviewId === review.id)
      .length,
    data.ins.filter((i) => i.nextAction.trim()).length,
  ).score;
  return {
    reviewId: review.id,
    cycleId: review.cycleId,
    weekNumber: review.weekNumber,
    date: today,
    recordedAt: now,
    overallProgress: known.length
      ? known.reduce((n, o) => n + o.progress!, 0) / known.length
      : null,
    objectiveCoverage: known.length,
    objectiveTotal: objectives.length,
    objectiveHealthCounts,
    krStatusCounts,
    averageConfidence: confidence.length
      ? confidence.reduce((n, k) => n + k.confidence!, 0) / confidence.length
      : null,
    activeInitiatives: p.active,
    blockedInitiatives: p.blocked,
    overdueInitiatives: p.overdue,
    checkInCompletion: data.completion.percent,
    checkedIn: data.completion.checkedIn,
    total: data.completion.total,
    quality,
    improved: data.ins.filter((c) => c.movement === "improved").length,
    regressed: data.ins.filter((c) => c.movement === "regressed").length,
    confidenceDrops: data.ins.filter((c) => (c.confidenceDelta ?? 0) < 0)
      .length,
    staleKRIds: data.completion.stale.map((k) => k.id),
    mainRisk: data.riskIds.length
      ? `${data.riskIds.length} نتیجه پرریسک`
      : (data.blockers[0]?.text ?? data.signals[0] ?? "هشدار ثبت نشده"),
    blockers: structuredClone(data.blockers),
    initiativeContext: structuredClone(initiatives),
    signals: data.signals,
    krContext: structuredClone(data.krs),
  };
}
export function reviewCompletionWarnings(
  store: StrategyStore,
  review: StrategyWeeklyReview,
  today: string,
) {
  const d = weeklyReviewSignals(store, review, today),
    warnings: string[] = [];
  if (d.completion.percent < 100)
    warnings.push(
      "همه نتایج فعال این هفته ثبت نشده‌اند؛ مقادیر بررسی‌نشده در تصویر دوره مشخص می‌مانند.",
    );
  if (!d.krs.length) warnings.push("این دوره نتیجه فعال برای بررسی ندارد.");
  if (d.riskIds.some((id) => !review.reviewedRiskIds.includes(id)))
    warnings.push("بررسی همه نتایج پرریسک تایید نشده است.");
  if (d.blockers.length && !review.blockersReviewed)
    warnings.push("بررسی موانع تایید نشده است.");
  if (!review.nextWeekFocus.some((x) => x.trim()))
    warnings.push("تمرکز هفته بعد مشخص نشده است.");
  if (review.nextWeekFocus.length > 5)
    warnings.push("بیش از پنج موضوع تمرکز انتخاب شده است.");
  return warnings;
}
