import { reviewDate } from "./definition";
import {
  validateStrategy,
  type StrategyStore,
  type StrategyRole,
} from "../model";
import type { KeyResult } from "../kr/types";
import { calculateKRProgress } from "../kr/calculations";
import {
  adaptReviewQuality,
  adaptReviewSignals,
  evidenceSnapshot,
  cycleReviewReadiness,
} from "./report";
import type {
  StrategyAdaptReview,
  StrategyCycleReview,
  EntityKind,
  StrategyChangeRecord,
} from "./types";
const uuid = () => crypto.randomUUID();
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
export function openCycle(store: StrategyStore, id: string) {
  const c = store.cycles.find((c) => c.id === id);
  if (!c || ["completed", "archived"].includes(c.status))
    throw Error("دوره بسته یا ناموجود فقط خواندنی است.");
  return c;
}
export function requiresControlledChange(
  store: StrategyStore,
  cycleId: string,
) {
  return (
    store.cycles.find((c) => c.id === cycleId)?.status !== "draft" ||
    !!store.krCheckIns?.some((c) => c.cycleId === cycleId) ||
    !!store.adaptReviews?.some((r) => r.cycleId === cycleId) ||
    !!store.initiatives?.some((i) => i.cycleId === cycleId && i.startedAt)
  );
}
export function newAdaptReview(
  store: StrategyStore,
  cycleId: string,
  start: string,
  end: string,
  now = new Date().toISOString(),
): StrategyAdaptReview {
  const c = openCycle(store, cycleId);
  if (
    !start ||
    !end ||
    start > end ||
    start < c.startDate ||
    end > c.endDate ||
    start > reviewDate(now)
  )
    throw Error("بازه مرور باید در دوره و شروع آن تا امروز باشد.");
  if (
    store.adaptReviews?.some(
      (r) =>
        r.cycleId === cycleId && r.periodStart <= end && r.periodEnd >= start,
    )
  )
    throw Error("برای این بازه مرور دیگری وجود دارد.");
  return {
    id: uuid(),
    cycleId,
    periodLabel: start + " — " + end,
    periodStart: start,
    periodEnd: end,
    status: "draft",
    reviewedByRoleId: "",
    progressSummary: "",
    marketChanges: [],
    internalChanges: [],
    majorRisks: [],
    decisions: [],
    resourceShifts: [],
    priorityChanges: [],
    initiativeChanges: [],
    objectiveChanges: [],
    notes: "",
    nextFocus: [],
    reviewedRiskIds: [],
    resourcesReviewed: false,
    createdAt: now,
    updatedAt: now,
    overrideReason: "",
  };
}
export function saveAdaptReview(
  store: StrategyStore,
  r: StrategyAdaptReview,
  now = new Date().toISOString(),
) {
  openCycle(store, r.cycleId);
  const old = store.adaptReviews?.find((x) => x.id === r.id);
  if (old?.status === "completed" || r.status !== "draft")
    throw Error("مرور تکمیل‌شده فقط خواندنی است.");
  for (const d of old?.initiativeChanges ?? [])
    if (
      d.appliedAt &&
      !same(
        d,
        r.initiativeChanges.find((x) => x.id === d.id),
      )
    )
      throw Error(
        "تصمیم اعمال‌شده ثابت است؛ تصمیم جدید را در مرور بعد ثبت کنید.",
      );
  if (
    old &&
    (old.cycleId !== r.cycleId ||
      old.periodStart !== r.periodStart ||
      old.periodEnd !== r.periodEnd)
  )
    throw Error("بازه مرور ثبت‌شده قابل تغییر نیست.");
  return validateStrategy({
    ...store,
    adaptReviews: [
      ...(store.adaptReviews ?? []).filter((x) => x.id !== r.id),
      { ...r, updatedAt: now },
    ],
  });
}
export function completeAdaptReview(
  store: StrategyStore,
  id: string,
  roles: StrategyRole[],
  overrideReason = "",
  now = new Date().toISOString(),
) {
  const r = store.adaptReviews?.find((r) => r.id === id);
  if (!r || r.status !== "draft") throw Error("مرور باز پیدا نشد.");
  openCycle(store, r.cycleId);
  if (
    !r.progressSummary.trim() ||
    !roles.some((x) => x.id === r.reviewedByRoleId)
  )
    throw Error("جمع‌بندی و مسئول مرور لازم است.");
  const quality = adaptReviewQuality(
    store,
    r,
    adaptReviewSignals(store, r.cycleId, roles, reviewDate(now), r.periodEnd),
  );
  if (quality.score < 100 && !overrideReason.trim())
    throw Error("پوشش مرور کامل نیست؛ دلیل تکمیل با موارد باز را ثبت کنید.");
  const snapshot = evidenceSnapshot(
    store,
    r.cycleId,
    roles,
    reviewDate(now),
    now,
    r.periodEnd,
  );
  snapshot.quality = quality.score;
  return validateStrategy({
    ...store,
    adaptReviews: store.adaptReviews!.map((x) =>
      x.id === id
        ? {
            ...r,
            status: "completed",
            completedAt: now,
            updatedAt: now,
            overrideReason,
            snapshot,
          }
        : x,
    ),
  });
}
export const controlledFields = {
  kr: [
    "title",
    "description",
    "type",
    "unit",
    "startValue",
    "targetValue",
    "startDate",
    "deadline",
    "ownerRoleId",
    "weight",
    "lifecycle",
    "milestones",
  ],
  objective: [
    "title",
    "description",
    "deadline",
    "ownerRoleId",
    "relatedPriorityId",
    "status",
    "krWeightMode",
  ],
  priority: ["rank", "status", "rationale"],
  initiative: ["status", "ownerRoleId", "dueDate", "description"],
  cycle: ["status"],
} as const;
const collection = {
  kr: "keyResults",
  objective: "objectives",
  priority: "priorities",
  initiative: "initiatives",
  cycle: "cycles",
} as const;
export function applyStrategyChange(
  store: StrategyStore,
  reviewId: string,
  kind: EntityKind,
  entityId: string,
  patch: Record<string, unknown>,
  reason: string,
  confirmed: boolean,
  now = new Date().toISOString(),
): StrategyStore {
  const review = store.adaptReviews?.find((r) => r.id === reviewId);
  if (!review || review.status !== "draft")
    throw Error("تغییر فقط در مرور تطبیقی باز مجاز است.");
  openCycle(store, review.cycleId);
  if (!reason.trim() || !confirmed)
    throw Error("دلیل و تأیید صریح اعمال تغییر لازم است.");
  if (kind === "cycle")
    throw Error("بستن دوره از مرور پایان دوره انجام می‌شود.");
  const key = collection[kind],
    rows = store[key] ?? [],
    old = rows.find((x) => x.id === entityId);
  if (!old || old.cycleId !== review.cycleId)
    throw Error("رکورد متعلق به این دوره نیست.");
  if (kind === "kr") {
    const candidate = { ...old, ...patch } as KeyResult;
    if (
      (Object.hasOwn(patch, "type") ||
        Object.hasOwn(patch, "unit") ||
        Object.hasOwn(patch, "startValue") ||
        Object.hasOwn(patch, "targetValue") ||
        Object.hasOwn(patch, "milestones")) &&
      store.krCheckIns?.some(
        (c) =>
          c.keyResultId === entityId &&
          store.weeklyReviews?.some(
            (w) => w.id === c.reviewId && w.status === "draft",
          ),
      )
    )
      throw Error(
        "ابتدا مرور هفتگی باز را تکمیل کنید؛ تعریف KR در میان یک مرور تغییر نمی‌کند.",
      );
    if (
      calculateKRProgress({
        ...candidate,
        currentValue: candidate.currentValue ?? candidate.startValue,
      }) === null
    )
      throw Error("مبنا، هدف، نوع یا وزن مراحل با هم سازگار نیستند.");
  }
  const changes: StrategyChangeRecord[] = [];
  for (const [field, newValue] of Object.entries(patch)) {
    if (
      !(controlledFields[kind] as readonly string[]).includes(field) &&
      !(
        kind === "kr" &&
        field === "currentValue" &&
        Object.hasOwn(patch, "type")
      )
    )
      throw Error("این فیلد از مسیر تطبیق قابل تغییر نیست.");
    const oldValue = (old as unknown as Record<string, unknown>)[field];
    if (!same(oldValue, newValue))
      changes.push({
        id: uuid(),
        cycleId: review.cycleId,
        entityId,
        entityType: kind,
        fieldChanged: field,
        oldValue,
        newValue,
        reason: reason.trim(),
        reviewId,
        changedAt: now,
      });
  }
  if (!changes.length) throw Error("تغییری انتخاب نشده است.");
  const rankPeer =
    kind === "priority" && Object.hasOwn(patch, "rank")
      ? store.priorities.find(
          (p) =>
            p.cycleId === review.cycleId &&
            p.id !== entityId &&
            p.rank === patch.rank,
        )
      : undefined;
  if (rankPeer)
    changes.push({
      id: uuid(),
      cycleId: review.cycleId,
      entityId: rankPeer.id,
      entityType: "priority",
      fieldChanged: "rank",
      oldValue: rankPeer.rank,
      newValue: (old as import("../model").StrategicPriority).rank,
      reason: reason.trim(),
      reviewId,
      changedAt: now,
    });
  const next = {
    ...store,
    [key]: rows.map((x) =>
      x.id === entityId
        ? { ...x, ...patch, updatedAt: now }
        : x.id === rankPeer?.id
          ? {
              ...x,
              rank: (old as import("../model").StrategicPriority).rank,
              updatedAt: now,
            }
          : x,
    ),
    strategyChanges: [...(store.strategyChanges ?? []), ...changes],
  };
  return validateStrategy(next);
}
export function applyInitiativeDecision(
  store: StrategyStore,
  reviewId: string,
  decisionId: string,
  confirmed: boolean,
  now = new Date().toISOString(),
) {
  const r = store.adaptReviews?.find((r) => r.id === reviewId),
    d = r?.initiativeChanges.find((d) => d.id === decisionId);
  if (
    !r ||
    r.status !== "draft" ||
    !d ||
    d.appliedAt ||
    !d.rationale.trim() ||
    !confirmed
  )
    throw Error("تصمیم باز، دلیل و تأیید اعمال لازم است.");
  openCycle(store, r.cycleId);
  const i = store.initiatives?.find(
    (i) => i.id === d.initiativeId && i.cycleId === r.cycleId,
  );
  if (!i) throw Error("اقدام پیدا نشد.");
  if (d.effectiveDate > reviewDate(now))
    throw Error("موعد اعمال تصمیم هنوز نرسیده است.");
  let next = store;
  const patch: Record<string, unknown> = {};
  if (d.decision === "stop") patch.status = "cancelled";
  if (d.decision === "pause") patch.status = "blocked";
  if (d.decision === "owner") {
    if (!d.ownerRoleId) throw Error("مالک جدید لازم است.");
    patch.ownerRoleId = d.ownerRoleId;
  }
  if (d.decision === "extend") {
    if (!d.newDueDate || d.newDueDate <= i.dueDate)
      throw Error("مهلت جدید باید بعد از مهلت قبلی باشد.");
    patch.dueDate = d.newDueDate;
  }
  if (
    Object.entries(patch).some(
      ([k, v]) => !same((i as unknown as Record<string, unknown>)[k], v),
    )
  ) {
    if (d.decision === "pause")
      next = {
        ...store,
        initiatives: store.initiatives!.map((x) =>
          x.id === i.id ? { ...x, blockedReason: d.rationale } : x,
        ),
      };
    next = applyStrategyChange(
      next,
      reviewId,
      "initiative",
      i.id,
      patch,
      d.rationale,
      confirmed,
      now,
    );
  }
  return validateStrategy({
    ...next,
    adaptReviews: next.adaptReviews!.map((x) =>
      x.id === r.id
        ? {
            ...x,
            updatedAt: now,
            initiativeChanges: x.initiativeChanges.map((a) =>
              a.id === d.id ? { ...a, appliedAt: now } : a,
            ),
          }
        : x,
    ),
  });
}
export function newCycleReview(
  store: StrategyStore,
  cycleId: string,
  now = new Date().toISOString(),
): StrategyCycleReview {
  openCycle(store, cycleId);
  if (store.cycleReviews?.some((r) => r.cycleId === cycleId))
    throw Error("مرور پایان دوره موجود است.");
  return {
    id: uuid(),
    cycleId,
    status: "draft",
    objectiveClassifications: {},
    krClassifications: {},
    keyWins: [],
    keyMisses: [],
    lessonsLearned: [],
    assumptionsValidated: [],
    assumptionsInvalidated: [],
    initiativeLearnings: [],
    strategicChanges: [],
    executiveConclusion: "",
    reviewedByRoleId: "",
    createdAt: now,
    updatedAt: now,
    overrideReason: "",
  };
}
export function saveCycleReview(
  store: StrategyStore,
  r: StrategyCycleReview,
  now = new Date().toISOString(),
) {
  openCycle(store, r.cycleId);
  if (
    store.cycleReviews?.find((x) => x.id === r.id)?.status === "completed" ||
    r.status !== "draft"
  )
    throw Error("مرور پایان دوره تکمیل‌شده ثابت است.");
  return validateStrategy({
    ...store,
    cycleReviews: [
      ...(store.cycleReviews ?? []).filter((x) => x.id !== r.id),
      { ...r, updatedAt: now },
    ],
  });
}
export function completeCycleReview(
  store: StrategyStore,
  id: string,
  roles: StrategyRole[],
  overrideReason = "",
  now = new Date().toISOString(),
) {
  const r = store.cycleReviews?.find((r) => r.id === id);
  if (!r || r.status !== "draft") throw Error("مرور باز پیدا نشد.");
  openCycle(store, r.cycleId);
  if (
    !r.executiveConclusion.trim() ||
    !roles.some((x) => x.id === r.reviewedByRoleId)
  )
    throw Error("جمع‌بندی مدیریتی و مسئول مرور لازم است.");
  if (
    store.objectives.some(
      (o) => o.cycleId === r.cycleId && !r.objectiveClassifications[o.id],
    ) ||
    store.keyResults?.some(
      (k) => k.cycleId === r.cycleId && !r.krClassifications[k.id],
    )
  )
    throw Error("نتیجه همه اهداف و KRها را طبقه‌بندی کنید.");
  const warnings = cycleReviewReadiness(store, r);
  if (warnings.length && !overrideReason.trim())
    throw Error(warnings.join(" ") + " دلیل ادامه را ثبت کنید.");
  return validateStrategy({
    ...store,
    cycleReviews: store.cycleReviews!.map((x) =>
      x.id === id
        ? {
            ...r,
            status: "completed",
            updatedAt: now,
            completedAt: now,
            overrideReason,
            snapshot: evidenceSnapshot(
              store,
              r.cycleId,
              roles,
              reviewDate(now),
              now,
            ),
            lessonsLearned: (store.strategyLearnings ?? [])
              .filter((l) => l.cycleId === r.cycleId)
              .map((l) => l.id),
            assumptionsValidated: (store.strategicAssumptions ?? [])
              .filter(
                (a) => a.cycleId === r.cycleId && a.status === "supported",
              )
              .map((a) => a.id),
            assumptionsInvalidated: (store.strategicAssumptions ?? [])
              .filter(
                (a) => a.cycleId === r.cycleId && a.status === "invalidated",
              )
              .map((a) => a.id),
          }
        : x,
    ),
  });
}
export function closeCycle(
  store: StrategyStore,
  id: string,
  reason: string,
  confirmed: boolean,
  now = new Date().toISOString(),
) {
  const c = openCycle(store, id),
    review = store.cycleReviews?.find(
      (r) => r.cycleId === id && r.status === "completed",
    );
  if (!confirmed || !reason.trim())
    throw Error("دلیل و تأیید بستن دوره لازم است.");
  if (c.status !== "review")
    throw Error("ابتدا دوره را به وضعیت بازبینی منتقل کنید.");
  if (!review) throw Error("ابتدا مرور پایان دوره را تکمیل کنید.");
  return validateStrategy({
    ...store,
    cycles: store.cycles.map((x) =>
      x.id === id
        ? { ...x, status: "completed", closedAt: now, updatedAt: now }
        : x,
    ),
    strategyChanges: [
      ...(store.strategyChanges ?? []),
      {
        id: uuid(),
        cycleId: id,
        entityId: id,
        entityType: "cycle",
        fieldChanged: "status",
        oldValue: c.status,
        newValue: "completed",
        reason,
        reviewId: review.id,
        changedAt: now,
      },
    ],
  });
}
export function assertStrategyTransition(
  before: StrategyStore,
  after: StrategyStore,
) {
  // Completed weekly evidence is immutable, except for an explicit latest-review
  // reopen. Reopening unlocks check-ins; it does not rewrite the old snapshots.
  for (const old of before.weeklyReviews ?? []) {
    const next = after.weeklyReviews?.find((r) => r.id === old.id);
    if (!next) throw Error("حذف مرور و سابقه هفتگی مجاز نیست.");
    if (old.status !== "completed") continue;
    const reopening =
      next.status === "draft" &&
      !!next.reopenedAt &&
      next.reopenedAt !== old.reopenedAt;
    if (reopening) {
      if (
        before.weeklyReviews?.some(
          (r) => r.cycleId === old.cycleId && r.weekNumber > old.weekNumber,
        )
      )
        throw Error("فقط آخرین مرور قابل بازگشایی است.");
      const allowed = {
        ...old,
        status: "draft",
        reopenedAt: next.reopenedAt,
        updatedAt: next.updatedAt,
      };
      if (!same(allowed, next))
        throw Error("بازگشایی مرور نباید شواهد قبلی را تغییر دهد.");
    } else if (!same(old, next))
      throw Error("مرور تکمیل‌شده قابل بازنویسی نیست.");
    for (const key of [
      "krCheckIns",
      "strategyDecisions",
      "objectiveWeeklySnapshots",
      "strategyWeeklySnapshots",
    ] as const) {
      if (
        !same(
          (before[key] ?? []).filter((r) => r.reviewId === old.id),
          (after[key] ?? []).filter((r) => r.reviewId === old.id),
        )
      )
        throw Error(
          "شواهد مرور تکمیل‌شده ثابت است؛ ابتدا مرور را بازگشایی کنید.",
        );
    }
  }
  for (const key of ["adaptReviews", "cycleReviews"] as const)
    for (const r of before[key] ?? [])
      if (
        r.status === "completed" &&
        !same(
          r,
          after[key]?.find((x) => x.id === r.id),
        )
      )
        throw Error("مرور تکمیل‌شده قابل بازنویسی نیست.");
  for (const r of before.cycleResets ?? [])
    if (
      !same(
        r,
        after.cycleResets?.find((x) => x.id === r.id),
      )
    )
      throw Error("سابقه انتقال دوره ثابت است.");
  for (const r of before.strategyChanges ?? [])
    if (
      !same(
        r,
        after.strategyChanges?.find((x) => x.id === r.id),
      )
    )
      throw Error("سابقه تغییر قابل حذف یا ویرایش نیست.");
  for (const c of before.cycles) {
    const proposed = after.cycles.find((x) => x.id === c.id);
    if (!proposed) throw Error("دوره دارای سابقه قابل حذف نیست.");
    if (["active", "review"].includes(c.status) && proposed.status === "draft")
      throw Error("دوره شروع‌شده به پیش‌نویس برنمی‌گردد؛ دوره جدید بسازید.");
    if (["completed", "archived"].includes(c.status)) {
      for (const key of [
        "cycles",
        "contexts",
        "priorities",
        "choices",
        "objectives",
        "keyResults",
        "initiatives",
        "adaptReviews",
        "cycleReviews",
        "strategicAssumptions",
        "strategyLearnings",
        "weeklyReviews",
        "krCheckIns",
        "objectiveWeeklySnapshots",
        "strategyWeeklySnapshots",
        "strategyDecisions",
      ] as const) {
        const scoped = (s: StrategyStore) =>
          (s[key] ?? []).filter((x) =>
            key === "cycles"
              ? "id" in x && x.id === c.id
              : "cycleId" in x
                ? x.cycleId === c.id
                : "reviewId" in x &&
                  s.weeklyReviews?.some(
                    (r) => r.id === x.reviewId && r.cycleId === c.id,
                  ),
          );
        const archiving =
          key === "cycles" &&
          c.status === "completed" &&
          proposed.status === "archived";
        const previousRows = scoped(before),
          nextRows = archiving
            ? [{ ...proposed, status: c.status, updatedAt: c.updatedAt }]
            : scoped(after);
        if (!same(previousRows, nextRows))
          throw Error("دوره بسته فقط خواندنی است.");
      }
    }
    const updated = after.cycles.find((x) => x.id === c.id);
    if (
      updated &&
      ["completed", "archived"].includes(updated.status) &&
      updated.status !== c.status &&
      !after.strategyChanges?.some(
        (a) =>
          a.entityType === "cycle" &&
          a.entityId === c.id &&
          a.newValue === updated.status &&
          !before.strategyChanges?.some((b) => b.id === a.id),
      )
    )
      throw Error("بستن دوره را از صفحه یادگیری انجام دهید.");
  }
  for (const kind of ["kr", "objective", "priority"] as const) {
    const key = collection[kind];
    for (const old of before[key] ?? []) {
      if (!requiresControlledChange(before, old.cycleId)) continue;
      const next = after[key]?.find((x) => x.id === old.id);
      if (!next) throw Error("حذف سابقه مجاز نیست؛ از لغو استفاده کنید.");
      for (const field of controlledFields[kind]) {
        if (
          kind === "kr" &&
          field === "milestones" &&
          same(
            (old as KeyResult).milestones.map((m) => [m.id, m.title, m.weight]),
            (next as KeyResult).milestones.map((m) => [
              m.id,
              m.title,
              m.weight,
            ]),
          )
        )
          continue;
        const a = (old as unknown as Record<string, unknown>)[field],
          b = (next as unknown as Record<string, unknown>)[field];
        if (same(a, b)) continue;
        const audit = after.strategyChanges?.find(
          (c) =>
            c.entityType === kind &&
            c.entityId === old.id &&
            c.fieldChanged === field &&
            same(c.oldValue, a) &&
            same(c.newValue, b) &&
            c.reason.trim() &&
            before.adaptReviews?.some(
              (r) =>
                r.id === c.reviewId &&
                r.status === "draft" &&
                r.cycleId === c.cycleId,
            ) &&
            !before.strategyChanges?.some((x) => x.id === c.id),
        );
        if (!audit)
          throw Error(
            "تغییر تعریف، مالک، موعد یا اولویت از مسیر مرور تطبیقی و با ثبت دلیل انجام می‌شود.",
          );
      }
    }
  }
}
