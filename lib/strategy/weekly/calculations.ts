import type { StrategyCycle, StrategyStore } from "../model";
import type { KeyResult } from "../kr/types";
import { validDate } from "../kr/calculations";
import type {
  KRCheckIn,
  StrategyWeeklyReview,
  StrategyWeeklySnapshot,
  Movement,
} from "./types";
const day = 86400000;
export function getCycleWeek(
  c: Pick<StrategyCycle, "startDate" | "endDate">,
  today: string,
) {
  if (
    !validDate(c.startDate) ||
    !validDate(c.endDate) ||
    !validDate(today) ||
    c.endDate < c.startDate
  )
    throw Error("بازه دوره یا روز بررسی معتبر نیست.");
  const totalWeeks = Math.ceil(
    (Date.parse(c.endDate) - Date.parse(c.startDate) + day) / (7 * day),
  );
  return {
    totalWeeks,
    phase:
      today < c.startDate ? "before" : today > c.endDate ? "after" : "inside",
    weekNumber:
      today < c.startDate || today > c.endDate
        ? null
        : Math.floor(
            (Date.parse(today) - Date.parse(c.startDate)) / (7 * day),
          ) + 1,
  };
}
export function weekPeriod(
  c: Pick<StrategyCycle, "startDate" | "endDate">,
  weekNumber: number,
) {
  const count = getCycleWeek(c, c.startDate).totalWeeks;
  if (!Number.isInteger(weekNumber) || weekNumber < 1 || weekNumber > count)
    throw Error("شماره هفته خارج از دوره است.");
  const start = Date.parse(c.startDate) + (weekNumber - 1) * 7 * day;
  return {
    weekNumber,
    periodStart: new Date(start).toISOString().slice(0, 10),
    periodEnd: new Date(Math.min(start + 6 * day, Date.parse(c.endDate)))
      .toISOString()
      .slice(0, 10),
  };
}
export function getPreviousCheckIn(
  items: KRCheckIn[],
  keyResultId: string,
  weekNumber: number,
) {
  return items
    .filter((i) => i.keyResultId === keyResultId && i.weekNumber < weekNumber)
    .sort((a, b) => b.weekNumber - a.weekNumber)[0];
}
export const calculateCheckInDelta = (
  current: number | null,
  previous: number | null,
) => (current === null || previous === null ? null : current - previous);
export const calculateConfidenceDelta = calculateCheckInDelta;
export function calculateMovementSignal(
  type: KeyResult["type"],
  previous: number | null,
  current: number | null,
  previousProgress: number | null,
  progress: number | null,
): Movement {
  const delta =
    type === "milestone" || type === "binary"
      ? calculateCheckInDelta(progress, previousProgress)
      : calculateCheckInDelta(current, previous);
  if (delta === null) return "insufficient";
  const directed = type === "decrease" ? -delta : delta;
  return Math.abs(directed) < 0.000001
    ? "stable"
    : directed > 0
      ? "improved"
      : "regressed";
}
export function activeWeeklyKRs(store: StrategyStore, cycleId: string) {
  return (store.keyResults ?? []).filter(
    (k) =>
      k.cycleId === cycleId &&
      k.lifecycle === "active" &&
      store.objectives.some(
        (o) => o.id === k.objectiveId && o.status === "active",
      ),
  );
}
export function weeklyCheckInCompletion(
  krs: KeyResult[],
  checkIns: KRCheckIn[],
  weekNumber: number,
) {
  const ids = new Set(
      checkIns
        .filter((c) => c.weekNumber === weekNumber)
        .map((c) => c.keyResultId),
    ),
    stale = krs.filter((k) => !ids.has(k.id));
  return {
    total: krs.length,
    checkedIn: krs.length - stale.length,
    percent: krs.length ? ((krs.length - stale.length) * 100) / krs.length : 0,
    stale,
  };
}
export function weeklyReviewQuality(
  coverage: number,
  riskIds: string[],
  review: StrategyWeeklyReview,
  blockerCount: number,
  decisionCount: number,
  actionCount: number,
) {
  const risk = riskIds.length
    ? riskIds.filter((id) => review.reviewedRiskIds.includes(id)).length /
      riskIds.length
    : 1;
  const parts = {
    coverage: coverage * 0.4,
    risk: risk * 20,
    blockers: !blockerCount || review.blockersReviewed ? 15 : 0,
    actions: decisionCount || actionCount ? 10 : 0,
    focus: review.nextWeekFocus.some((x) => x.trim()) ? 15 : 0,
  };
  return {
    score: Math.round(Object.values(parts).reduce((a, b) => a + b, 0)),
    parts,
  };
}
export function weeklyComparison(
  current: StrategyWeeklySnapshot,
  previous?: StrategyWeeklySnapshot,
) {
  const pairs = [
    ["overallProgress", current.overallProgress, previous?.overallProgress],
    [
      "averageConfidence",
      current.averageConfidence,
      previous?.averageConfidence,
    ],
    [
      "onTrack",
      current.krStatusCounts.onTrack,
      previous?.krStatusCounts.onTrack,
    ],
    ["atRisk", current.krStatusCounts.atRisk, previous?.krStatusCounts.atRisk],
    [
      "offTrack",
      current.krStatusCounts.offTrack,
      previous?.krStatusCounts.offTrack,
    ],
    [
      "blockedInitiatives",
      current.blockedInitiatives,
      previous?.blockedInitiatives,
    ],
  ] as const;
  return pairs.map(([key, value, before]) => ({
    key,
    current: value,
    previous: before ?? null,
    delta: previous ? calculateCheckInDelta(value, before ?? null) : null,
  }));
}
export function weeklyMomentum(
  current: StrategyWeeklySnapshot,
  previous?: StrategyWeeklySnapshot,
) {
  if (!previous)
    return {
      label: "داده کافی نیست",
      reason: "مرور تکمیل‌شده قبلی برای مقایسه وجود ندارد.",
    };
  const pairs = weeklyComparison(current, previous),
    progress = pairs[0].delta,
    confidence = pairs[1].delta,
    risk =
      current.krStatusCounts.atRisk +
      current.krStatusCounts.offTrack -
      previous.krStatusCounts.atRisk -
      previous.krStatusCounts.offTrack;
  if (
    progress === null ||
    confidence === null ||
    current.checkInCompletion < 50 ||
    previous.checkInCompletion < 50
  )
    return {
      label: "داده کافی نیست",
      reason: "مقایسه به مقدار معتبر و پوشش حداقل ۵۰٪ در هر دو مرور نیاز دارد.",
    };
  const signs = [Math.sign(progress), Math.sign(confidence), -Math.sign(risk)];
  return {
    label:
      signs.some((s) => s > 0) && !signs.some((s) => s < 0)
        ? "حرکت مثبت"
        : signs.some((s) => s < 0) && !signs.some((s) => s > 0)
          ? "حرکت منفی"
          : "پایدار / ترکیبی",
    reason:
      "جهت تغییر پیشرفت، اطمینان و تعداد نتایج پرریسک؛ بدون امتیاز ترکیبی یا پیش‌بینی.",
  };
}
