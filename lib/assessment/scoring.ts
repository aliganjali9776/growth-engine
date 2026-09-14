import { dimensions, questions } from "./questions";
import type { Answers, AssessmentDimension, HealthStatus } from "./types";
import { classify } from "./interpretation";
export { classify, healthLabels } from "./interpretation";
export function isComplete(answers: Answers): boolean {
  return questions.every(
    (q) =>
      Number.isInteger(answers[q.id]) &&
      answers[q.id] >= 1 &&
      answers[q.id] <= 5,
  );
}
export function calculateScores(answers: Answers) {
  if (!isComplete(answers))
    throw new Error("All 30 answers must be integers from 1 to 5.");
  const scores = {} as Record<AssessmentDimension, number>;
  for (const d of dimensions) {
    const section = questions.filter((q) => q.dimension === d);
    scores[d] =
      (section.reduce((sum, q) => sum + answers[q.id] * q.weight, 0) /
        section.reduce((sum, q) => sum + 5 * q.weight, 0)) *
      100;
  }
  const overall = dimensions.reduce((sum, d) => sum + scores[d], 0) / 3;
  const numericStatus = classify(overall);
  const capped =
    dimensions.some((d) => scores[d] < 40) &&
    (numericStatus === "healthy" ||
      numericStatus === "strong" ||
      numericStatus === "excellent");
  return {
    scores,
    overall,
    status: capped ? ("developing" as const) : numericStatus,
    capped,
  };
}
