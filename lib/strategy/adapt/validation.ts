import type { StrategyStore } from "../model";
import { isoDateValid } from "../model";
import { validateKRStorage } from "../kr/validation";
import { validateInitiativeStorage } from "../initiatives/validation";
import {
  outcomeLabels,
  assumptionStatuses,
  learningCategories,
  adaptationDecisions,
  resourceTypes,
  priorityReviewLabels,
  hypothesisResults,
  decisionTypes,
} from "./types";
export function validateAdaptStorage(s: StrategyStore) {
  const fail = () => {
    throw Error("داده مرور تطبیقی یا یادگیری معتبر نیست؛ نسخه قبلی حفظ شد.");
  };
  const text = (v: unknown) => {
    if (typeof v !== "string" || v.length > 20000) fail();
  };
  const texts = (v: unknown) => {
    if (!Array.isArray(v) || v.length > 1000) fail();
    for (const x of v as unknown[]) text(x);
  };
  const stamp = (v: unknown) => {
    text(v);
    if (!Number.isFinite(Date.parse(v as string))) fail();
  };
  const links = (
    row: {
      relatedObjectiveId?: string;
      relatedKRId?: string;
      relatedInitiativeId?: string;
      relatedPriorityId?: string;
    },
    cycleId: string,
  ) => {
    for (const [key, rows] of [
      ["relatedObjectiveId", s.objectives],
      ["relatedKRId", s.keyResults ?? []],
      ["relatedInitiativeId", s.initiatives ?? []],
      ["relatedPriorityId", s.priorities],
    ] as const) {
      const id = row[key];
      if (id !== undefined) {
        text(id);
        if (id && !rows.some((x) => x.id === id && x.cycleId === cycleId))
          fail();
      }
    }
  };
  for (const key of [
    "adaptReviews",
    "cycleReviews",
    "strategyChanges",
    "strategicAssumptions",
    "strategyLearnings",
    "cycleResets",
  ] as const) {
    const rows = s[key];
    if (rows === undefined) continue;
    if (!Array.isArray(rows) || rows.length > 20000) fail();
    const ids = new Set();
    for (const row of rows) {
      if (!row || typeof row !== "object" || !row.id || ids.has(row.id)) fail();
      ids.add(row.id);
      if ("cycleId" in row && !s.cycles.some((c) => c.id === row.cycleId))
        fail();
    }
  }
  for (const r of [...(s.adaptReviews ?? []), ...(s.cycleReviews ?? [])]) {
    if (!["draft", "completed"].includes(r.status)) fail();
    text(r.reviewedByRoleId);
    stamp(r.createdAt);
    stamp(r.updatedAt);
    text(r.overrideReason);
    if (r.status === "completed") {
      stamp(r.completedAt);
      if (
        !r.snapshot ||
        r.snapshot.cycle.id !== r.cycleId ||
        !Array.isArray(r.snapshot.keyResults) ||
        !Array.isArray(r.snapshot.checkIns) ||
        !Array.isArray(r.snapshot.objectiveOutcomes) ||
        !Array.isArray(r.snapshot.signals)
      )
        fail();
      const snap = r.snapshot!;
      for (const list of [
        snap.objectives,
        snap.priorities,
        snap.initiatives,
        snap.roles,
        snap.assumptions,
        snap.learnings,
      ])
        if (!Array.isArray(list)) fail();
      stamp(snap.recordedAt);
      if (
        !Number.isFinite(snap.quality) ||
        snap.quality < 0 ||
        snap.quality > 100
      )
        fail();
      for (const v of [snap.overallProgress, snap.averageConfidence])
        if (v !== null && (typeof v !== "number" || !Number.isFinite(v)))
          fail();
      validateKRStorage({
        ...s,
        cycles: [snap.cycle],
        objectives: snap.objectives,
        keyResults: snap.keyResults,
      });
      validateInitiativeStorage({
        ...s,
        cycles: [snap.cycle],
        objectives: snap.objectives,
        keyResults: snap.keyResults,
        initiatives: snap.initiatives,
      });
    }
  }
  const periods = new Map<string, [string, string][]>();
  for (const r of s.adaptReviews ?? []) {
    if (!isoDateValid(r.periodStart) || !isoDateValid(r.periodEnd)) fail();
    for (const x of [
      r.periodLabel,
      r.periodStart,
      r.periodEnd,
      r.progressSummary,
      r.notes,
    ])
      text(x);
    const c = s.cycles.find((c) => c.id === r.cycleId)!;
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(r.periodStart) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(r.periodEnd) ||
      r.periodStart > r.periodEnd ||
      r.periodStart < c.startDate ||
      r.periodEnd > c.endDate
    )
      fail();
    const previous = periods.get(r.cycleId) ?? [];
    if (previous.some(([a, b]) => a <= r.periodEnd && b >= r.periodStart))
      fail();
    periods.set(r.cycleId, [...previous, [r.periodStart, r.periodEnd]]);
    for (const list of [
      r.marketChanges,
      r.internalChanges,
      r.majorRisks,
      r.nextFocus,
      r.reviewedRiskIds,
      r.objectiveChanges,
    ])
      texts(list);
    if (typeof r.resourcesReviewed !== "boolean") fail();
    for (const list of [
      r.decisions,
      r.resourceShifts,
      r.priorityChanges,
      r.initiativeChanges,
    ])
      if (!Array.isArray(list)) fail();
    for (const d of r.decisions) {
      links(d, r.cycleId);
      if (!Object.hasOwn(decisionTypes, d.decisionType)) fail();
      text(d.title);
      text(d.description);
      text(d.ownerRoleId);
      if (d.reviewId !== r.id) fail();
    }
    for (const d of r.initiativeChanges) {
      if (
        !Object.hasOwn(adaptationDecisions, d.decision) ||
        !s.initiatives?.some(
          (i) => i.id === d.initiativeId && i.cycleId === r.cycleId,
        )
      )
        fail();
      text(d.rationale);
      text(d.effectiveDate);
      text(d.ownerRoleId);
      text(d.newDueDate);
      if (d.appliedAt) stamp(d.appliedAt);
    }
    for (const d of r.priorityChanges) {
      if (
        !Object.hasOwn(priorityReviewLabels, d.decision) ||
        !s.priorities.some(
          (p) => p.id === d.priorityId && p.cycleId === r.cycleId,
        )
      )
        fail();
      text(d.rationale);
    }
    for (const d of r.resourceShifts) {
      links(d, r.cycleId);
      if (d.reviewId !== r.id || !Object.hasOwn(resourceTypes, d.resourceType))
        fail();
      for (const v of [d.fromArea, d.toArea, d.description, d.rationale])
        text(v);
    }
  }
  const cycleIds = new Set();
  for (const r of s.cycleReviews ?? []) {
    if (cycleIds.has(r.cycleId)) fail();
    cycleIds.add(r.cycleId);
    for (const list of [
      r.keyWins,
      r.keyMisses,
      r.lessonsLearned,
      r.assumptionsValidated,
      r.assumptionsInvalidated,
      r.strategicChanges,
    ])
      texts(list);
    text(r.executiveConclusion);
    for (const map of [r.objectiveClassifications, r.krClassifications]) {
      if (!map || typeof map !== "object" || Array.isArray(map)) fail();
      for (const v of Object.values(map))
        if (!Object.hasOwn(outcomeLabels, v)) fail();
    }
    if (!Array.isArray(r.initiativeLearnings)) fail();
    for (const l of r.initiativeLearnings) {
      if (
        !Object.hasOwn(hypothesisResults, l.hypothesisResult) ||
        !["repeat", "stop", "reconsider"].includes(l.repeatDecision) ||
        !s.initiatives?.some(
          (i) => i.id === l.initiativeId && i.cycleId === r.cycleId,
        )
      )
        fail();
      text(l.lesson);
    }
    for (const [id] of Object.entries(r.objectiveClassifications))
      if (!s.objectives.some((o) => o.id === id && o.cycleId === r.cycleId))
        fail();
    for (const [id] of Object.entries(r.krClassifications))
      if (!s.keyResults?.some((k) => k.id === id && k.cycleId === r.cycleId))
        fail();
  }
  for (const c of s.strategyChanges ?? []) {
    for (const v of [c.entityId, c.fieldChanged, c.reason, c.reviewId]) text(v);
    if (
      !c.reason.trim() ||
      !["kr", "objective", "priority", "initiative", "cycle"].includes(
        c.entityType,
      )
    )
      fail();
    stamp(c.changedAt);
    if (
      ![...(s.adaptReviews ?? []), ...(s.cycleReviews ?? [])].some(
        (r) => r.id === c.reviewId && r.cycleId === c.cycleId,
      )
    )
      fail();
  }
  for (const a of s.strategicAssumptions ?? []) {
    links(a, a.cycleId);
    text(a.statement);
    text(a.evidence);
    text(a.relatedPriorityId);
    if (!a.statement.trim() || !Object.hasOwn(assumptionStatuses, a.status))
      fail();
    stamp(a.createdAt);
    stamp(a.updatedAt);
  }
  for (const l of s.strategyLearnings ?? []) {
    links(l, l.cycleId);
    text(l.statement);
    text(l.evidence);
    if (!l.statement.trim() || !Object.hasOwn(learningCategories, l.category))
      fail();
    stamp(l.createdAt);
  }
  for (const r of s.cycleResets ?? []) {
    if (
      !s.cycles.some((c) => c.id === r.sourceCycleId) ||
      !s.cycles.some((c) => c.id === r.newCycleId) ||
      !s.cycleReviews?.some(
        (c) => c.id === r.reviewId && c.status === "completed",
      )
    )
      fail();
    if (!Array.isArray(r.mappings) || !r.selection) fail();
    stamp(r.createdAt);
  }
}
