import { dimensionMeta } from "./questions";
import { healthLabels } from "./interpretation";
import type { DimensionDiagnostic, HealthStatus } from "./types";
export function generateExecutiveSummary(
  status: HealthStatus,
  dimensions: DimensionDiagnostic[],
): string[] {
  const summary = [
    `وضعیت کلی کسب‌وکار بر اساس پاسخ‌های شما «${healthLabels[status]}» است؛ امتیاز میانگین جایگزین بررسی شکاف‌های هر محور نیست.`,
  ];
  for (const d of dimensions) {
    const critical = d.findings.filter((f) => f.severity === "critical");
    const action = d.findings.filter((f) => f.severity === "action");
    const improvement = d.findings.filter((f) => f.severity === "improvement");
    const finding = critical[0] ?? action[0] ?? improvement[0];
    summary.push(
      finding
        ? `در ${dimensionMeta[d.dimension].label}، ${critical.length ? "مسئله بحرانی" : action.length ? "اقدام اولویت‌دار" : "فرصت بهبود"} «${finding.title}» نیازمند توجه است؛ پیشنهاد بعدی: «${d.focus}».`
        : `در ${dimensionMeta[d.dimension].label}، پاسخ‌ها از عملکرد سیستماتیک حکایت دارند؛ حفظ استانداردها و انتقال این قابلیت‌ها به تیم، موضوع بعدی مدیریت است.`,
    );
  }
  return summary;
}
