import {
  validateStrategy,
  type StrategyStore,
  type StrategyRole,
} from "../model";
import { calculateKRProgress, validDate } from "../kr/calculations";
import { validateInitiative } from "./validation";
import type { StrategicInitiative } from "./types";
export function saveInitiative(
  store: StrategyStore,
  input: StrategicInitiative,
  roles: StrategyRole[],
  now = new Date().toISOString(),
): StrategyStore {
  const previous = store.initiatives?.find((i) => i.id === input.id),
    kr = store.keyResults?.find((k) => k.id === input.keyResultId),
    cycle = store.cycles.find((c) => c.id === input.cycleId);
  if (!cycle || cycle.status === "archived" || cycle.status === "completed")
    throw Error("دوره بسته یا نامعتبر است؛ ابتدا دوره را بازبینی کنید.");
  if (
    previous &&
    store.cycles.some(
      (c) =>
        c.id === previous.cycleId &&
        ["archived", "completed"].includes(c.status),
    )
  )
    throw Error("اقدام دوره بسته قابل تغییر یا انتقال نیست.");
  if (
    previous?.startedAt &&
    (previous.keyResultId !== input.keyResultId ||
      previous.cycleId !== input.cycleId)
  )
    throw Error(
      "ارتباط اقدام آغازشده را تغییر ندهید؛ برای KR جدید اقدام جدا بسازید.",
    );
  if (kr && input.objectiveId && input.objectiveId !== kr.objectiveId)
    throw Error("هدف انتخاب‌شده با نتیجه کلیدی سازگار نیست.");
  const next = {
    ...input,
    objectiveId: kr?.objectiveId ?? input.objectiveId,
    progress: input.status === "completed" ? 100 : input.progress,
  };
  const errors = validateInitiative(next, store);
  if (errors.length) throw Error(errors.join(" "));
  const executing = ["inProgress", "blocked", "completed"].includes(
    next.status,
  );
  if (executing) {
    if (!kr || kr.lifecycle === "cancelled")
      throw Error("برای اجرا یک نتیجه کلیدی فعال لازم است.");
    if (!roles.some((r) => r.id === next.ownerRoleId))
      throw Error("برای اجرا نقش مالک معتبر لازم است.");
    if (!next.hypothesis.trim())
      throw Error("برای اجرا فرضیه اثرگذاری لازم است.");
    if (!validDate(next.startDate) || !validDate(next.dueDate))
      throw Error("برای اجرا تاریخ شروع و مهلت لازم است.");
    if (
      store.objectives.find((o) => o.id === next.objectiveId)?.status ===
      "cancelled"
    )
      throw Error("هدف مرتبط لغوشده است.");
  }
  const firstStart = executing && !previous?.startedAt;
  const saved: StrategicInitiative = {
    ...next,
    createdAt: previous?.createdAt ?? next.createdAt,
    updatedAt: now,
    startedAt: firstStart ? now : previous?.startedAt,
    completedAt:
      next.status === "completed"
        ? previous?.status === "completed"
          ? (previous.completedAt ?? now)
          : now
        : previous?.completedAt,
    krProgressAtStart:
      firstStart && kr ? calculateKRProgress(kr) : previous?.krProgressAtStart,
    krValueAtStart:
      firstStart && kr ? kr.currentValue : previous?.krValueAtStart,
    baselineCapturedAt: firstStart ? now : previous?.baselineCapturedAt,
    baselineKeyResultId: firstStart
      ? next.keyResultId
      : previous?.baselineKeyResultId,
  };
  return validateStrategy({
    ...store,
    initiatives: [
      ...(store.initiatives ?? []).filter((i) => i.id !== saved.id),
      saved,
    ],
  });
}
