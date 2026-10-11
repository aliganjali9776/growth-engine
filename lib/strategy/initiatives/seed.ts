import type { StrategyStore, StrategyRole } from "../model";
import { calculateKRProgress } from "../kr/calculations";
import type { StrategicInitiative } from "./types";
export function withSampleInitiatives(
  store: StrategyStore,
  roles: StrategyRole[],
): StrategyStore {
  const rows = [
    [
      "sample-kr3",
      "انتشار گزارش تخصصی صنعت",
      "گزارش تخصصی، مدیران تصمیم‌گیر را وارد قیف مشاوره می‌کند.",
      30,
      "لید",
      40,
    ],
    [
      "sample-kr2",
      "برگزاری رویداد مدیران عامل",
      "گفت‌وگوی متمرکز با مدیران می‌تواند اعتماد لازم برای قرارداد مشاوره ایجاد کند.",
      2,
      "قرارداد",
      0,
    ],
    [
      "sample-kr4",
      "سری محتوای چهره‌محور",
      "حضور مستمر چهره متخصص می‌تواند دسترسی به مخاطبان مرتبط را افزایش دهد.",
      5000,
      "نفر",
      25,
    ],
  ] as const;
  const initiatives: StrategicInitiative[] = rows.map(
    (
      [
        keyResultId,
        title,
        hypothesis,
        expectedImpactValue,
        expectedImpactUnit,
        progress,
      ],
      n,
    ) => {
      const kr = store.keyResults!.find((k) => k.id === keyResultId)!,
        now = "2026-09-22T09:00:00Z";
      return {
        id: `sample-i${n + 1}`,
        cycleId: kr.cycleId,
        objectiveId: kr.objectiveId,
        keyResultId,
        code: `I${n + 1}`,
        title,
        description:
          "نمونه قابل ویرایش؛ فعالیت و نتیجه واقعی کسب‌وکار محسوب نمی‌شود.",
        ownerRoleId:
          roles.find((r) => r.title.includes("بازاریابی"))?.id ??
          kr.ownerRoleId,
        hypothesis,
        expectedImpact: "",
        actualImpact: "",
        impactType: "numeric",
        expectedImpactValue,
        expectedImpactUnit,
        priority: n === 0 ? "high" : "medium",
        status: progress ? "inProgress" : "planned",
        progress,
        effectiveness: "notEvaluated",
        startDate: "2026-09-22",
        dueDate: "2026-11-10",
        startedAt: progress ? now : undefined,
        blockedReason: "",
        notes: "نمونه روش‌شناسی",
        createdAt: now,
        updatedAt: now,
        effort: "medium",
        impactLevel: "high",
        krProgressAtStart: progress ? calculateKRProgress(kr) : undefined,
        krValueAtStart: progress ? kr.currentValue : undefined,
        baselineCapturedAt: progress ? now : undefined,
        baselineKeyResultId: progress ? keyResultId : undefined,
      };
    },
  );
  return { ...store, initiatives };
}
