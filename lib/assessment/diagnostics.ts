import { makeFinding, rankFindings } from "./severity";
import { generateHiddenRisks } from "./hidden-risks";
import { recommendedFocus } from "./focus";
import { classify, scoreInterpretations } from "./interpretation";
import { generateExecutiveSummary } from "./summary";
import { dimensionMeta, dimensions, questions } from "./questions";
import { calculateScores } from "./scoring";
import type { Answers, AssessmentResult, DiagnosticIssue } from "./types";
export function diagnose(answers: Answers): AssessmentResult {
  const base = calculateScores(answers);
  const min = Math.min(...Object.values(base.scores));
  const tiedDimensions = dimensions.filter(
    (d) => Math.abs(base.scores[d] - min) < 0.000001,
  );
  const primaryConstraint = tiedDimensions[0];
  const allStrong = dimensions.every((d) => base.scores[d] >= 80);
  const findings = questions
    .map((q) => makeFinding(q, answers[q.id]))
    .sort(rankFindings);
  const issues = findings.slice(0, 3);
  const hiddenRisks = generateHiddenRisks(answers);
  const dimensionDiagnostics = dimensions.map((d) => {
    const related = findings.filter((f) => f.dimension === d);
    const strengths = related.filter((f) => f.severity === "strength");
    const good = related.filter((f) => f.answer === 4);
    const risks = hiddenRisks.filter((r) => r.dimension === d);
    const status = classify(base.scores[d]);
    return {
      dimension: d,
      score: base.scores[d],
      status,
      interpretation: scoreInterpretations[status],
      findings: related,
      risks,
      ...recommendedFocus(d, related),
      working: strengths.length
        ? strengths
            .map((f) => f.title)
            .slice(0, 2)
            .join("؛ ")
        : good.length
          ? "در این موارد عملکرد خوب گزارش شده، اما پایداری کامل تأیید نشده است: " +
            good
              .slice(0, 2)
              .map((f) => f.title.replace("استانداردسازی ", ""))
              .join("، ")
          : "پاسخ‌ها هنوز شواهد کافی برای معرفی یک نقطه قوت پایدار نشان نمی‌دهند؛ ابتدا قابلیت‌های پایه را تثبیت کنید.",
      riskNote: risks.length
        ? "ریسک‌های زیر مستقیماً از پاسخ‌های شما استخراج شده‌اند."
        : related.some((f) => f.answer === 4)
          ? "ریسک مشخصی از قواعد فعلی احراز نشد؛ پایداری قابلیت‌های دارای امتیاز ۴ را پیش از رشد بیشتر بررسی کنید."
          : "از پاسخ‌های فعلی ریسک مشخصی احراز نشد؛ این نتیجه جایگزین بررسی شواهد اجرا در شرایط رشد نیست.",
    };
  });
  const insights: string[] = [];
  if (base.scores.system < 40 && base.scores.scale > 60)
    insights.push(
      "رشد بیشتر در شرایط فعلی می‌تواند مشکلات عملیاتی موجود را تشدید کند.",
    );
  if (base.scores.strategy < 40)
    insights.push(
      "قبل از افزایش سرعت اجرا، لازم است مقصد و اولویت‌های کسب‌وکار شفاف شوند.",
    );
  if (
    base.scores.scale < 40 &&
    base.scores.system >= 60 &&
    base.scores.strategy >= 60
  )
    insights.push(
      "زیرساخت مدیریتی مناسب است، اما موتور رشد هنوز تکرارپذیر نشده است.",
    );
  if (allStrong)
    insights.push(
      "کسب‌وکار از نظر 3S در وضعیت قوی قرار دارد و آماده تمرکز بر توسعه و مقیاس‌پذیری پیشرفته است.",
    );
  if (!insights.length)
    insights.push(
      base.status === "critical"
        ? "پیش از توسعه، روی کاهش آسیب‌پذیری و تثبیت عملکرد روزمره تمرکز کنید."
        : "برای رشد پایدار، ابتدا ضعیف‌ترین رکن را تقویت و اثر اقدامات را در یک مرور منظم ارزیابی کنید.",
    );
  const meta = dimensionMeta[primaryConstraint];
  return {
    ...base,
    primaryConstraint,
    tiedDimensions,
    allStrong,
    issues,
    findings,
    hiddenRisks,
    dimensionDiagnostics,
    executiveSummary: generateExecutiveSummary(
      base.status,
      dimensionDiagnostics,
    ),
    consultationCopy: findings.some(
      (f) => f.severity === "critical" || f.severity === "action",
    )
      ? "گزارش شما شکاف‌های مشخصی را نشان می‌دهد که ممکن است سرعت یا کیفیت رشد را محدود کنند. تحلیل تخصصی می‌تواند به بررسی شواهد و اولویت‌بندی اصلاحات کمک کند."
      : findings.some((f) => f.severity === "improvement")
        ? "قابلیت‌های پایه وجود دارند؛ تحلیل تخصصی می‌تواند فرصت‌های استانداردسازی و بهینه‌سازی را به اولویت‌های روشن توسعه تبدیل کند."
        : "پاسخ‌های شما از بلوغ بالا حکایت دارند. تحلیل تخصصی می‌تواند به اعتبارسنجی پایداری نقاط قوت و آمادگی آن‌ها برای مقیاس بزرگ‌تر کمک کند.",
    insights,
    recommendation: {
      title: dimensionDiagnostics.find(
        (d) => d.dimension === primaryConstraint,
      )!.focus,
      description: dimensionDiagnostics.find(
        (d) => d.dimension === primaryConstraint,
      )!.action,
    },
  };
}
