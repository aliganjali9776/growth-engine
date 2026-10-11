import type { StrategyStore } from "../model";
import type { KeyResult } from "./types";
// Fresh installations only. Never append sample measurements to stored 4A records.
export function withSampleKRs(store: StrategyStore): StrategyStore {
  const rows: [string, string, number, number, number, string, number][] = [
    [
      "sample-o1",
      "افزایش درآمد دوره از ۱ به ۱٫۵ میلیارد تومان",
      1,
      1.5,
      1.18,
      "میلیارد تومان",
      40,
    ],
    ["sample-o1", "جذب ۵ قرارداد مشاوره", 0, 5, 2, "تعداد", 35],
    ["sample-o1", "ایجاد ۱۰۰ لید واجد شرایط", 0, 100, 35, "لید", 25],
    [
      "sample-o2",
      "افزایش دسترسی محتوای چهره‌محور",
      10000,
      25000,
      14500,
      "نفر",
      40,
    ],
    ["sample-o2", "افزایش دنبال‌کنندگان مرتبط", 2000, 3500, 2450, "نفر", 35],
    ["sample-o2", "حضور در ۴ رسانه معتبر", 0, 4, 1, "تعداد", 25],
  ];
  const keyResults: KeyResult[] = rows.map(
    (
      [objectiveId, title, startValue, targetValue, currentValue, unit, weight],
      i,
    ) => {
      const o = store.objectives.find((o) => o.id === objectiveId)!;
      return {
        id: `sample-kr${i + 1}`,
        objectiveId,
        cycleId: o.cycleId,
        code: `KR${i + 1}`,
        title,
        description: "داده نمونه برای نمایش روش محاسبه؛ قابل ویرایش.",
        ownerRoleId: o.ownerRoleId,
        type: "increase",
        startValue,
        targetValue,
        currentValue,
        unit,
        weight,
        confidence: 6,
        startDate: o.startDate,
        deadline: o.deadline,
        lastUpdateAt: "2026-09-21T09:00:00Z",
        createdAt: "2026-09-21T09:00:00Z",
        updatedAt: "2026-09-21T09:00:00Z",
        notes: "نمونه روش‌شناسی؛ اندازه‌گیری واقعی نیست.",
        lifecycle: "active",
        milestones: [],
      };
    },
  );
  return {
    ...store,
    keyResults,
    objectives: store.objectives.map((o) =>
      ["sample-o1", "sample-o2"].includes(o.id)
        ? { ...o, krWeightMode: "custom" }
        : o,
    ),
  };
}
