import {
  validateStrategy,
  type StrategyStore,
  type StrategyRole,
} from "../model";
import type { KeyResult } from "../kr/types";
import {measurementDefinition} from '../adapt/definition';
import { calculateKRProgress, calculateKRStatus } from "../kr/calculations";
import { saveKR } from "../kr/mutations";
import {
  activeWeeklyKRs,
  weekPeriod,
  getPreviousCheckIn,
  calculateCheckInDelta,
  calculateConfidenceDelta,
  calculateMovementSignal,
} from "./calculations";
import {
  createObjectiveSnapshot,
  createStrategySnapshot,
  reviewCompletionWarnings,
} from "./report";
import type {
  KRCheckIn,
  StrategyWeeklyReview,
  StrategyDecision,
} from "./types";
function openReview(store: StrategyStore, id: string, today: string) {
  const review = store.weeklyReviews?.find((r) => r.id === id);
  if (!review) throw Error("مرور پیدا نشد.");
  const cycle = store.cycles.find((c) => c.id === review.cycleId);
  if (!cycle || ["completed", "archived"].includes(cycle.status))
    throw Error("دوره بسته فقط خواندنی است.");
  if (review.status === "completed")
    throw Error("مرور تکمیل‌شده قفل است؛ ابتدا آن را صریح بازگشایی کنید.");
  if (review.periodStart > today) throw Error("ثبت هفته آینده مجاز نیست.");
  if (
    store.weeklyReviews?.some(
      (r) => r.cycleId === review.cycleId && r.weekNumber > review.weekNumber,
    )
  )
    throw Error("برای حفظ تاریخچه، فقط آخرین مرور قابل ویرایش است.");
  return review;
}
export function createWeeklyReview(
  store: StrategyStore,
  cycleId: string,
  weekNumber: number,
  id: string,
  today: string,
  now: string,
): StrategyStore {
  const cycle = store.cycles.find((c) => c.id === cycleId);
  if (!cycle || ["completed", "archived"].includes(cycle.status))
    throw Error("دوره بسته یا نامعتبر است.");
  if (
    store.weeklyReviews?.some(
      (r) => r.cycleId === cycleId && r.weekNumber === weekNumber,
    )
  )
    throw Error("برای این هفته مرور وجود دارد؛ همان مرور را باز کنید.");
  const period = weekPeriod(cycle, weekNumber);
  if (period.periodStart > today)
    throw Error("مرور هفته آینده هنوز آغاز نشده است.");
  if (
    store.weeklyReviews?.some(
      (r) =>
        r.cycleId === cycleId &&
        (r.weekNumber > weekNumber || r.status === "draft"),
    )
  )
    throw Error(
      "ابتدا مرور باز را تکمیل کنید؛ تاریخچه جدید باید پس از آخرین هفته باشد.",
    );
  const review: StrategyWeeklyReview = {
    id,
    cycleId,
    ...period,
    status: "draft",
    reviewedByRoleId: "",
    executiveSummary: "",
    wins: [],
    blockers: [],
    nextWeekFocus: [],
    reviewedRiskIds: [],
    blockersReviewed: false,
    createdAt: now,
    updatedAt: now,
    revision: 0,
    incompleteAcknowledged: false,
  };
  return validateStrategy({
    ...store,
    weeklyReviews: [...(store.weeklyReviews ?? []), review],
  });
}
export interface CheckInInput {
  keyResultId: string;
  currentValue: number | null;
  confidence: number | null;
  completedMilestoneIds: string[];
  win: string;
  blocker: string;
  nextAction: string;
  comment: string;
}
export function saveCheckIn(
  store: StrategyStore,
  reviewId: string,
  input: CheckInInput,
  id: string,
  today: string,
  now: string,
): StrategyStore {
  const review = openReview(store, reviewId, today),
    kr = activeWeeklyKRs(store, review.cycleId).find(
      (k) => k.id === input.keyResultId,
    );
  if (!kr) throw Error("نتیجه فعال در این دوره یافت نشد.");
  const old = store.krCheckIns?.find(
      (c) => c.reviewId === review.id && c.keyResultId === kr.id,
    ),
    previous = getPreviousCheckIn(
      store.krCheckIns ?? [],
      kr.id,
      review.weekNumber,
    );
  if (!old && store.krCheckIns?.some((c) => c.id === id))
    throw Error("شناسه ثبت هفتگی تکراری است.");
  if (
    input.confidence === null ||
    !Number.isInteger(input.confidence) ||
    input.confidence < 1 ||
    input.confidence > 10
  )
    throw Error("اطمینان ۱ تا ۱۰ لازم است.");
  if (
    kr.type !== "milestone" &&
    (input.currentValue === null || !Number.isFinite(input.currentValue))
  )
    throw Error("مقدار فعلی معتبر لازم است.");
  if (
    kr.type === "milestone" &&
    input.completedMilestoneIds.some(
      (id) => !kr.milestones.some((m) => m.id === id),
    )
  )
    throw Error("مرحله انتخابی معتبر نیست.");
  const definitionChanged = !!previous && measurementDefinition(previous.krSnapshot)!==measurementDefinition(kr);
  const auditedDefinition = previous && store.strategyChanges?.some(c=>c.entityType==='kr'&&c.entityId===kr.id&&['type','unit','startValue','targetValue','milestones'].includes(c.fieldChanged)&&c.changedAt>=previous.createdAt);
  if ((definitionChanged&&!auditedDefinition)|| (old&&measurementDefinition(old.krSnapshot)!==measurementDefinition(kr)))
    throw Error(
      "نوع KR نسبت به تاریخچه تغییر کرده است؛ برای تعریف متفاوت، KR جدید بسازید.",
    );
  const updated: KeyResult = {
    ...kr,
    currentValue: kr.type === "milestone" ? null : input.currentValue,
    confidence: input.confidence,
    milestones: kr.milestones.map((m) => ({
      ...m,
      completed: input.completedMilestoneIds.includes(m.id),
    })),
  };
  const measured = saveKR(store, updated, now),
    live = {
      ...measured.keyResults!.find((k) => k.id === kr.id)!,
      lastUpdateAt: now,
    };
  const progress = calculateKRProgress(live),
    status = calculateKRStatus(live, today).status;
  if (progress === null)
    throw Error("تعریف یا وزن مراحل KR برای ثبت معتبر نیست.");
  if (
    (input.blocker.trim() || status === "atRisk" || status === "offTrack") &&
    !input.nextAction.trim()
  )
    throw Error("برای نتیجه پرریسک یا دارای مانع، قدم بعدی را مشخص کنید.");
  const previousValue = old
      ? old.previousValue
      : previous && !definitionChanged
        ? previous.currentValue
        : kr.currentValue,
    previousProgress = old
      ? old.previousProgress
      : previous && !definitionChanged
        ? previous.progress
        : calculateKRProgress(kr),
    previousConfidence = old
      ? old.previousConfidence
      : previous
        ? previous.confidence
        : kr.confidence;
  const row: KRCheckIn = {
    id: old?.id ?? id,
    reviewId,
    cycleId: kr.cycleId,
    objectiveId: kr.objectiveId,
    keyResultId: kr.id,
    weekNumber: review.weekNumber,
    periodStart: review.periodStart,
    periodEnd: review.periodEnd,
    previousValue,
    currentValue: live.currentValue,
    delta:
      kr.type === "milestone"
        ? calculateCheckInDelta(progress, previousProgress)
        : calculateCheckInDelta(live.currentValue, previousValue),
    previousProgress,
    progress,
    previousConfidence,
    confidence: live.confidence,
    confidenceDelta: calculateConfidenceDelta(
      live.confidence,
      previousConfidence,
    ),
    movement: calculateMovementSignal(
      kr.type,
      previousValue,
      live.currentValue,
      previousProgress,
      progress,
    ),
    status,
    win: input.win.trim(),
    blocker: input.blocker.trim(),
    nextAction: input.nextAction.trim(),
    comment: input.comment.trim(),
    ownerRoleId: kr.ownerRoleId,
    createdAt: old?.createdAt ?? now,
    updatedAt: now,
    krSnapshot: structuredClone(live),
  };
  return validateStrategy({
    ...measured,
    keyResults: measured.keyResults!.map((k) => (k.id === live.id ? live : k)),
    krCheckIns: [
      ...(store.krCheckIns ?? []).filter((c) => c.id !== row.id),
      row,
    ],
    weeklyReviews: store.weeklyReviews!.map((r) =>
      r.id === review.id
        ? {
            ...r,
            updatedAt: now,
            reviewedRiskIds: r.reviewedRiskIds.filter((id) => id !== kr.id),
            blockersReviewed: false,
          }
        : r,
    ),
  });
}
export function saveReviewNotes(
  store: StrategyStore,
  input: StrategyWeeklyReview,
  today: string,
  now: string,
): StrategyStore {
  const old = openReview(store, input.id, today);
  const next = {
    ...old,
    reviewedByRoleId: input.reviewedByRoleId,
    executiveSummary: input.executiveSummary,
    wins: input.wins.filter((x) => x.trim()),
    blockers: input.blockers.filter((x) => x.trim()),
    nextWeekFocus: input.nextWeekFocus.filter((x) => x.trim()),
    reviewedRiskIds: input.reviewedRiskIds,
    blockersReviewed:
      JSON.stringify(old.blockers) !==
      JSON.stringify(input.blockers.filter((x) => x.trim()))
        ? false
        : input.blockersReviewed,
    updatedAt: now,
  };
  return validateStrategy({
    ...store,
    weeklyReviews: store.weeklyReviews!.map((r) =>
      r.id === old.id ? next : r,
    ),
  });
}
export function saveStrategyDecision(
  store: StrategyStore,
  input: StrategyDecision,
  today: string,
): StrategyStore {
  const review = openReview(store, input.reviewId, today);
  if (!input.title.trim()) throw Error("عنوان تصمیم لازم است.");
  const o = store.objectives.find((o) => o.id === input.relatedObjectiveId),
    k = store.keyResults?.find((k) => k.id === input.relatedKRId),
    i = store.initiatives?.find((i) => i.id === input.relatedInitiativeId);
  if (
    (input.relatedObjectiveId && o?.cycleId !== review.cycleId) ||
    (input.relatedKRId &&
      (k?.cycleId !== review.cycleId || (o && k.objectiveId !== o.id))) ||
    (input.relatedInitiativeId &&
      (i?.cycleId !== review.cycleId ||
        (k && i.keyResultId !== k.id) ||
        (o && i.objectiveId !== o.id)))
  )
    throw Error("ارتباط تصمیم با هدف، KR یا اقدام سازگار نیست.");
  if (
    store.strategyDecisions?.some(
      (d) => d.id === input.id && d.reviewId !== input.reviewId,
    )
  )
    throw Error("شناسه تصمیم تکراری است.");
  return validateStrategy({
    ...store,
    strategyDecisions: [
      ...(store.strategyDecisions ?? []).filter((d) => d.id !== input.id),
      { ...input, title: input.title.trim() },
    ],
  });
}
export function completeWeeklyReview(
  store: StrategyStore,
  id: string,
  roles: StrategyRole[],
  acknowledge: boolean,
  today: string,
  now: string,
): StrategyStore {
  const review = openReview(store, id, today),
    warnings = reviewCompletionWarnings(store, review, today);
  if (warnings.length && !acknowledge)
    throw Error(
      "مرور ناقص است؛ هشدارها را بررسی و تکمیل با وجود کمبودها را صریح تایید کنید.",
    );
  const snapshot = createStrategySnapshot(store, review, roles, today, now),
    objectives = store.objectives
      .filter((o) => o.cycleId === review.cycleId && o.status === "active")
      .map((o) => createObjectiveSnapshot(store, o, review, roles, today, now));
  return validateStrategy({
    ...store,
    weeklyReviews: store.weeklyReviews!.map((r) =>
      r.id === id
        ? {
            ...r,
            status: "completed",
            completedAt: now,
            updatedAt: now,
            revision: r.revision + 1,
            incompleteAcknowledged: warnings.length > 0,
          }
        : r,
    ),
    strategyWeeklySnapshots: [
      ...(store.strategyWeeklySnapshots ?? []).filter((s) => s.reviewId !== id),
      snapshot,
    ],
    objectiveWeeklySnapshots: [
      ...(store.objectiveWeeklySnapshots ?? []).filter(
        (s) => s.reviewId !== id,
      ),
      ...objectives,
    ],
  });
}
export function reopenWeeklyReview(
  store: StrategyStore,
  id: string,
  today: string,
  now: string,
): StrategyStore {
  const r = store.weeklyReviews?.find((r) => r.id === id);
  if (!r || r.status !== "completed") throw Error("مرور تکمیل‌شده یافت نشد.");
  const next = {
    ...store,
    weeklyReviews: store.weeklyReviews!.map((x) =>
      x.id === id
        ? { ...x, status: "draft" as const, reopenedAt: now, updatedAt: now }
        : x,
    ),
  };
  openReview(next, id, today);
  return validateStrategy(next);
}
