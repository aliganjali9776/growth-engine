import type { Process, PriorityLevel } from "./types";
export function calculatePriority(
  p: Pick<Process, "impact" | "variation" | "dependency" | "frequency">,
): { priorityScore: number; priorityLevel: PriorityLevel } {
  const values = [p.impact, p.variation, p.dependency, p.frequency];
  if (values.some((v) => !Number.isInteger(v) || v < 1 || v > 3))
    throw new Error("هر عامل اولویت باید بین ۱ و ۳ باشد.");
  const priorityScore = values.reduce((s, n) => s + n, 0);
  return {
    priorityScore,
    priorityLevel:
      priorityScore >= 10
        ? "critical"
        : priorityScore >= 8
          ? "high"
          : priorityScore >= 6
            ? "medium"
            : "low",
  };
}
