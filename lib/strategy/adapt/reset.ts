import {
  validateStrategy,
  type StrategyStore,
  type StrategyCycle,
} from "../model";
import type { CarryForwardSelection, CycleResetRecord } from "./types";
export function resetCycle(
  store: StrategyStore,
  sourceId: string,
  nextCycle: StrategyCycle,
  selection: CarryForwardSelection,
  targets: Record<string, number>,
  confirmed: boolean,
  now = new Date().toISOString(),
): StrategyStore {
  const review = store.cycleReviews?.find(
    (r) => r.cycleId === sourceId && r.status === "completed",
  );
  if (!review || !confirmed)
    throw Error("مرور پایان دوره تکمیل‌شده و تأیید انتقال لازم است.");
  const source = review.snapshot!;
  if (
    store.cycles.some((c) => c.id === nextCycle.id) ||
    nextCycle.status !== "draft"
  )
    throw Error("دوره مقصد باید یک پیش‌نویس جدید باشد.");
  const mappings: CycleResetRecord["mappings"] = [],
    ids = new Map<string, string>();
  const map = (kind: string, id: string) => {
    const fresh = crypto.randomUUID();
    ids.set(id, fresh);
    mappings.push({ kind, oldId: id, newId: fresh });
    return fresh;
  };
  const pick = <T extends { id: string; cycleId: string }>(
    rows: T[],
    chosen: string[],
  ) => {
    if (new Set(chosen).size !== chosen.length)
      throw Error("انتخاب تکراری است.");
    return chosen.map((id) => {
      const row = rows.find((x) => x.id === id && x.cycleId === sourceId);
      if (!row) throw Error("انتخاب متعلق به دوره مبدأ نیست.");
      return row;
    });
  };
  const priorities = pick(source.priorities, selection.priorityIds).map(
    (p) => ({
      ...p,
      id: map("priority", p.id),
      cycleId: nextCycle.id,
      status: "proposed" as const,
      createdAt: now,
      updatedAt: now,
    }),
  );
  const objectives = pick(source.objectives, selection.objectiveIds).map(
    (o) => {
      if (o.relatedPriorityId && !ids.has(o.relatedPriorityId))
        throw Error("اولویت مرتبط هدف را نیز انتخاب کنید.");
      return {
        ...o,
        id: map("objective", o.id),
        cycleId: nextCycle.id,
        relatedPriorityId: ids.get(o.relatedPriorityId) ?? "",
        status: "draft" as const,
        startDate: nextCycle.startDate,
        deadline: nextCycle.endDate,
        createdAt: now,
        updatedAt: now,
      };
    },
  );
  const keyResults = pick(source.keyResults, selection.krIds).map((k) => {
    if (!ids.has(k.objectiveId))
      throw Error("هدف مرتبط KR را نیز انتخاب کنید.");
    const id = map("kr", k.id),
      numeric = ["increase", "decrease"].includes(k.type),
      start = numeric ? k.currentValue : 0,
      target = numeric ? targets[k.id] : k.type === "binary" ? 1 : null;
    if (
      numeric &&
      (start === null ||
        !Number.isFinite(target) ||
        (k.type === "increase" ? target! <= start : target! >= start))
    )
      throw Error(
        "برای هر KR عددی، هدف جدید معتبر نسبت به مقدار نهایی دوره قبل وارد کنید.",
      );
    return {
      ...k,
      id,
      cycleId: nextCycle.id,
      objectiveId: ids.get(k.objectiveId)!,
      startValue: start,
      targetValue: target,
      currentValue: numeric ? start : k.type === "binary" ? 0 : null,
      confidence: null,
      lifecycle: "active" as const,
      startDate: nextCycle.startDate,
      deadline: nextCycle.endDate,
      createdAt: now,
      updatedAt: now,
      lastUpdateAt: undefined,
      milestones: k.milestones.map((m) => ({
        ...m,
        id: crypto.randomUUID(),
        keyResultId: id,
        completed: false,
        completedAt: undefined,
      })),
    };
  });
  const initiatives = pick(source.initiatives, selection.initiativeIds).map(
    (i) => {
      if (["completed", "cancelled"].includes(i.status))
        throw Error("فقط اقدام ناتمام قابل انتقال است.");
      if (!ids.has(i.keyResultId) || !ids.has(i.objectiveId))
        throw Error("هدف و KR مرتبط اقدام را نیز انتخاب کنید.");
      return {
        ...i,
        id: map("initiative", i.id),
        cycleId: nextCycle.id,
        objectiveId: ids.get(i.objectiveId)!,
        keyResultId: ids.get(i.keyResultId)!,
        status: "proposed" as const,
        progress: 0,
        effectiveness: "notEvaluated" as const,
        actualImpact: "",
        blockedReason: "",
        startDate: nextCycle.startDate,
        dueDate: nextCycle.endDate,
        startedAt: undefined,
        completedAt: undefined,
        krProgressAtStart: undefined,
        krValueAtStart: undefined,
        baselineCapturedAt: undefined,
        baselineKeyResultId: undefined,
        createdAt: now,
        updatedAt: now,
      };
    },
  );
  const learnings = pick(source.learnings, selection.learningIds).map((l) => ({
    ...l,
    id: map("learning", l.id),
    sourceId: l.id,
    cycleId: nextCycle.id,
    relatedObjectiveId: ids.get(l.relatedObjectiveId) ?? "",
    relatedKRId: ids.get(l.relatedKRId) ?? "",
    relatedInitiativeId: ids.get(l.relatedInitiativeId) ?? "",
    createdAt: now,
  }));
  const assumptions = pick(source.assumptions, selection.assumptionIds).map(
    (a) => ({
      ...a,
      id: map("assumption", a.id),
      sourceId: a.id,
      cycleId: nextCycle.id,
      relatedPriorityId: ids.get(a.relatedPriorityId) ?? "",
      createdAt: now,
      updatedAt: now,
    }),
  );
  return validateStrategy({
    ...store,
    cycles: [...store.cycles, nextCycle],
    priorities: [...store.priorities, ...priorities],
    objectives: [...store.objectives, ...objectives],
    keyResults: [...(store.keyResults ?? []), ...keyResults],
    initiatives: [...(store.initiatives ?? []), ...initiatives],
    strategyLearnings: [...(store.strategyLearnings ?? []), ...learnings],
    strategicAssumptions: [
      ...(store.strategicAssumptions ?? []),
      ...assumptions,
    ],
    cycleResets: [
      ...(store.cycleResets ?? []),
      {
        id: crypto.randomUUID(),
        sourceCycleId: sourceId,
        newCycleId: nextCycle.id,
        reviewId: review.id,
        selection: structuredClone(selection),
        mappings,
        createdAt: now,
      },
    ],
  });
}
