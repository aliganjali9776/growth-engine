import type {
  AssessmentAnswer,
  AssessmentQuestion,
  DiagnosticIssue,
  FindingSeverity,
} from "./types";
export const severityOrder: FindingSeverity[] = [
  "critical",
  "action",
  "improvement",
  "strength",
];
export const severityLabels: Record<FindingSeverity, string> = {
  critical: "بحرانی",
  action: "نیازمند اقدام",
  improvement: "فرصت بهبود",
  strength: "نقطه قوت",
};
export function classifySeverity(
  answer: AssessmentAnswer,
  critical: boolean,
): FindingSeverity {
  if (answer === 1 || (answer === 2 && critical)) return "critical";
  if (answer === 2 || (answer === 3 && critical)) return "action";
  if (answer === 3 || answer === 4) return "improvement";
  return "strength";
}
export function makeFinding(
  q: AssessmentQuestion,
  answer: AssessmentAnswer,
): DiagnosticIssue {
  const severity = classifySeverity(answer, q.weight > 1);
  return {
    id: q.id,
    dimension: q.dimension,
    answer,
    critical: q.weight > 1,
    severity,
    title:
      answer <= 2
        ? q.issueTitle
        : answer === 3
          ? `تقویت ${q.focus}`
          : answer === 4
            ? `استانداردسازی ${q.focus}`
            : `${q.focus}؛ نقطه قوت قابل حفظ`,
    explanation:
      answer <= 3
        ? q.explanation
        : answer === 4
          ? `در «${q.focus}» عملکرد خوبی گزارش شده، اما پایداری و سیستماتیک‌بودن کامل هنوز تأیید نشده است؛ معیار اجرا، مالک و روش انتقال آن به تیم را مشخص کنید.`
          : `در «${q.focus}» عملکرد سیستماتیک و پایدار گزارش کرده‌اید. این نقطه قوت را حفظ و مستند کنید و قابلیت انتقال آن به تیم را برای رشد آینده بسنجید.`,
  };
}
export function rankFindings(a: DiagnosticIssue, b: DiagnosticIssue) {
  return (
    severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity) ||
    a.answer - b.answer ||
    Number(b.critical) - Number(a.critical)
  );
}
