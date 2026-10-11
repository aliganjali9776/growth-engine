import { validateStrategy, type StrategyStore } from "../model";
import type { KeyResult } from "./types";
export function saveKR(
  store: StrategyStore,
  input: KeyResult,
  now = new Date().toISOString(),
): StrategyStore {
  const previous = store.keyResults?.find((k) => k.id === input.id),
    objective = store.objectives.find(
      (o) => o.id === input.objectiveId && o.cycleId === input.cycleId,
    ),
    cycle = store.cycles.find((c) => c.id === input.cycleId);
  if (!objective || !cycle) throw Error("هدف مرتبط معتبر نیست.");
  if (
    objective.status === "cancelled" ||
    cycle.status === "archived" ||
    cycle.status === "completed"
  )
    throw Error(
      "دوره بسته یا هدف لغوشده فقط خواندنی است؛ ابتدا وضعیت آن را بازبینی کنید.",
    );
  if (
    previous &&
    (previous.objectiveId !== input.objectiveId ||
      previous.cycleId !== input.cycleId)
  )
    throw Error(
      "انتقال نتیجه ثبت‌شده به هدف دیگر مجاز نیست؛ برای آن هدف نتیجه جدید بسازید.",
    );
  const observed = (k: KeyResult) =>
    JSON.stringify(
      k.type === "milestone"
        ? k.milestones
            .filter((m) => m.completed)
            .map((m) => m.id)
            .sort()
        : k.currentValue,
    );
  const changed = !previous
    ? input.type === "milestone"
      ? input.milestones.some((m) => m.completed)
      : input.currentValue !== null
    : input.type !== previous.type || observed(input) !== observed(previous);
  const next: KeyResult = {
    ...input,
    createdAt: previous?.createdAt ?? input.createdAt,
    updatedAt: now,
    lastUpdateAt: changed ? now : previous?.lastUpdateAt,
    milestones: input.milestones.map((m) => {
      const old = previous?.milestones.find((x) => x.id === m.id);
      return {
        ...m,
        completedAt: m.completed
          ? old?.completed
            ? (old.completedAt ?? now)
            : now
          : undefined,
      };
    }),
  };
  return validateStrategy({
    ...store,
    keyResults: [
      ...(store.keyResults ?? []).filter((k) => k.id !== next.id),
      next,
    ],
  });
}
export function setKRWeightMode(
  store: StrategyStore,
  objectiveId: string,
  mode: "equal" | "custom",
): StrategyStore {
  const objective = store.objectives.find((o) => o.id === objectiveId),
    cycle = store.cycles.find((c) => c.id === objective?.cycleId);
  if (
    !objective ||
    objective.status === "cancelled" ||
    cycle?.status === "archived" ||
    cycle?.status === "completed"
  )
    throw Error("هدف یا دوره بسته قابل تغییر نیست.");
  return validateStrategy({
    ...store,
    objectives: store.objectives.map((o) =>
      o.id === objectiveId
        ? { ...o, krWeightMode: mode, updatedAt: new Date().toISOString() }
        : o,
    ),
  });
}
