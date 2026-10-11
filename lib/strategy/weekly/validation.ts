import type { StrategyStore } from "../model";
import { weekPeriod } from "./calculations";
import { krStatuses, objectiveHealthLabels } from "../kr/types";
import { movementLabels } from "./types";
import { validateKRStorage } from "../kr/validation";
import { validateInitiativeStorage } from "../initiatives/validation";
export function validateWeeklyStorage(store: StrategyStore) {
  const fail = () => {
    throw Error("داده تاریخچه هفتگی معتبر نیست؛ نسخه قبلی حفظ شد.");
  };
  const str = (v: unknown) => {
    if (typeof v !== "string" || v.length > 20000) fail();
  };
  const num = (v: unknown, nullable = false) => {
    if (nullable && v === null) return;
    if (typeof v !== "number" || !Number.isFinite(v)) fail();
  };
  const stamp = (v: unknown) => {
    str(v);
    if (!Number.isFinite(Date.parse(v as string))) fail();
  };
  const texts = (v: unknown) => {
    if (!Array.isArray(v) || v.length > 1000) fail();
    for (const x of v as unknown[]) str(x);
  };
  const lists = [
    "krCheckIns",
    "weeklyReviews",
    "strategyDecisions",
    "objectiveWeeklySnapshots",
    "strategyWeeklySnapshots",
  ] as const;
  for (const key of lists) {
    const rows = store[key];
    if (rows !== undefined && (!Array.isArray(rows) || rows.length > 20000))
      fail();
  }
  const reviews = store.weeklyReviews ?? [],
    ids = new Set<string>(),
    weeks = new Set<string>();
  for (const r of reviews) {
    if (!r || typeof r !== "object") fail();
    for (const key of [
      "id",
      "cycleId",
      "reviewedByRoleId",
      "executiveSummary",
    ] as const)
      str(r[key]);
    if (!r.id || ids.has(r.id) || weeks.has(r.cycleId + "|" + r.weekNumber))
      fail();
    ids.add(r.id);
    weeks.add(r.cycleId + "|" + r.weekNumber);
    const c = store.cycles.find((c) => c.id === r.cycleId);
    if (!c) fail();
    const p = weekPeriod(c!, r.weekNumber);
    if (r.periodStart !== p.periodStart || r.periodEnd !== p.periodEnd) fail();
    if (!["draft", "completed"].includes(r.status)) fail();
    for (const k of [
      "wins",
      "blockers",
      "nextWeekFocus",
      "reviewedRiskIds",
    ] as const)
      texts(r[k]);
    for (const k of ["createdAt", "updatedAt"] as const) stamp(r[k]);
    if (r.completedAt !== undefined) stamp(r.completedAt);
    if (r.reopenedAt !== undefined) stamp(r.reopenedAt);
    if (
      typeof r.blockersReviewed !== "boolean" ||
      typeof r.incompleteAcknowledged !== "boolean" ||
      !Number.isInteger(r.revision) ||
      r.revision < 0
    )
      fail();
    if (r.status === "completed" && (!r.completedAt || r.revision < 1)) fail();
  }
  const seen = new Set<string>(),
    checkIds = new Set<string>();
  for (const c of store.krCheckIns ?? []) {
    if (!c || typeof c !== "object") fail();
    for (const k of [
      "id",
      "reviewId",
      "cycleId",
      "objectiveId",
      "keyResultId",
      "ownerRoleId",
      "win",
      "blocker",
      "nextAction",
      "comment",
    ] as const)
      str(c[k]);
    const r = reviews.find((r) => r.id === c.reviewId),
      k = store.keyResults?.find((k) => k.id === c.keyResultId);
    if (
      !r ||
      !k ||
      r.cycleId !== c.cycleId ||
      k.cycleId !== c.cycleId ||
      k.objectiveId !== c.objectiveId ||
      r.weekNumber !== c.weekNumber ||
      r.periodStart !== c.periodStart ||
      r.periodEnd !== c.periodEnd ||
      !c.id ||
      checkIds.has(c.id) ||
      seen.has(c.keyResultId + "|" + c.weekNumber)
    )
      fail();
    checkIds.add(c.id);
    seen.add(c.keyResultId + "|" + c.weekNumber);
    for (const f of [
      "previousValue",
      "currentValue",
      "delta",
      "previousProgress",
      "progress",
      "previousConfidence",
      "confidence",
      "confidenceDelta",
    ] as const)
      num(c[f], true);
    if (
      (c.progress !== null && (c.progress < 0 || c.progress > 100)) ||
      (c.confidence !== null && (c.confidence < 1 || c.confidence > 10))
    )
      fail();
    if (
      (c.status !== null && !Object.hasOwn(krStatuses, c.status)) ||
      !Object.hasOwn(movementLabels, c.movement)
    )
      fail();
    stamp(c.createdAt);
    stamp(c.updatedAt);
    if (
      !c.krSnapshot ||
      c.krSnapshot.id !== c.keyResultId ||
      c.krSnapshot.objectiveId !== c.objectiveId ||
      c.krSnapshot.cycleId !== c.cycleId ||
      !Array.isArray(c.krSnapshot.milestones)
    )
      fail();
    str(c.krSnapshot.title);
    str(c.krSnapshot.unit);
    validateKRStorage({ ...store, keyResults: [c.krSnapshot] });
  }
  const decisions = new Set<string>();
  for (const d of store.strategyDecisions ?? []) {
    if (!d || typeof d !== "object") fail();
    for (const k of [
      "id",
      "reviewId",
      "title",
      "description",
      "ownerRoleId",
      "relatedObjectiveId",
      "relatedKRId",
      "relatedInitiativeId",
    ] as const)
      str(d[k]);
    if (!d.id || !d.title.trim() || decisions.has(d.id) || !ids.has(d.reviewId))
      fail();
    decisions.add(d.id);
    stamp(d.createdAt);
  }
  const snapshotIds = new Set<string>();
  for (const s of store.strategyWeeklySnapshots ?? []) {
    if (!s || typeof s !== "object") fail();
    const r = reviews.find((r) => r.id === s.reviewId);
    if (
      !r ||
      r.cycleId !== s.cycleId ||
      r.weekNumber !== s.weekNumber ||
      snapshotIds.has(s.reviewId)
    )
      fail();
    snapshotIds.add(s.reviewId);
    stamp(s.recordedAt);
    stamp(s.date);
    for (const f of ["overallProgress", "averageConfidence"] as const)
      num(s[f], true);
    for (const f of [
      "objectiveCoverage",
      "objectiveTotal",
      "activeInitiatives",
      "blockedInitiatives",
      "overdueInitiatives",
      "checkInCompletion",
      "checkedIn",
      "total",
      "quality",
      "improved",
      "regressed",
      "confidenceDrops",
    ] as const) {
      num(s[f]);
      if (s[f] < 0) fail();
    }
    if (s.quality > 100 || s.checkInCompletion > 100 || s.checkedIn > s.total)
      fail();
    for (const field of ["krStatusCounts", "objectiveHealthCounts"] as const) {
      if (!s[field] || typeof s[field] !== "object") fail();
      for (const key of Object.keys(
        field === "krStatusCounts"
          ? { ...krStatuses, unknown: "" }
          : objectiveHealthLabels,
      )) {
        num((s[field] as Record<string, number>)[key]);
      }
    }
    texts(s.staleKRIds);
    texts(s.signals);
    str(s.mainRisk);
    if (
      !Array.isArray(s.blockers) ||
      !Array.isArray(s.initiativeContext) ||
      !Array.isArray(s.krContext)
    )
      fail();
    for (const b of s.blockers) {
      str(b.text);
      str(b.title);
      str(b.entityId);
      if (!["kr", "initiative", "review"].includes(b.source)) fail();
    }
    for (const k of s.krContext) {
      str(k.id);
      str(k.title);
      str(k.code);
      if (!Array.isArray(k.milestones)) fail();
    }
    validateKRStorage({ ...store, keyResults: s.krContext });
    validateInitiativeStorage({ ...store, initiatives: s.initiativeContext });
    for (const i of s.initiativeContext) {
      str(i.id);
      str(i.title);
      num(i.progress);
    }
  }
  const objectiveIds = new Set<string>();
  for (const s of store.objectiveWeeklySnapshots ?? []) {
    const r = reviews.find((r) => r.id === s.reviewId);
    if (
      !r ||
      !snapshotIds.has(s.reviewId) ||
      s.cycleId !== r.cycleId ||
      s.weekNumber !== r.weekNumber ||
      !store.objectives.some(
        (o) => o.id === s.objectiveId && o.cycleId === s.cycleId,
      ) ||
      objectiveIds.has(s.reviewId + "|" + s.objectiveId)
    )
      fail();
    objectiveIds.add(s.reviewId + "|" + s.objectiveId);
    str(s.title);
    stamp(s.recordedAt);
    num(s.progress, true);
    num(s.confidence, true);
    num(s.checkedIn);
    num(s.total);
    if (!Object.hasOwn(objectiveHealthLabels, s.health)) fail();
  }
  for (const r of reviews)
    if (r.status === "completed" && !snapshotIds.has(r.id)) fail();
}
