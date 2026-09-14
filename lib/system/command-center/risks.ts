import type { SystemData } from "../types";
import { reliableRole } from "../measurement/health";
import type { CommandRow, HealthComponent } from "./aggregation";
import { ownershipConcentration } from "./aggregation";
export interface SystemRisk {
  id: string;
  type: string;
  title: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low";
  processId?: string;
  departmentId?: string;
  roleId?: string;
  metric: string;
  recommendedAction: string;
  source: string;
  href: string;
  rank: number;
}
const severityRank = { critical: 4000, high: 3000, medium: 2000, low: 1000 };
export function systemRisks(
  rows: CommandRow[],
  system: SystemData,
  day: string,
) {
  const risks: SystemRisk[] = [];
  for (const x of rows) {
    const p = x.process,
      critical = p.priorityLevel === "critical",
      add = (
        type: string,
        title: string,
        description: string,
        severity: SystemRisk["severity"],
        metric: string,
        action: string,
        path: string,
        source: string,
        entity = "",
      ) =>
        risks.push({
          id: `${type}:${p.id}:${entity}`,
          type,
          title: `${title} · ${p.name}`,
          description,
          severity,
          processId: p.id,
          departmentId: p.departmentId,
          metric,
          recommendedAction: action,
          source,
          href: `/system/processes/${p.id}${path}`,
          rank: severityRank[severity] + p.priorityScore * 10 + p.impact * 5,
        });
    if (!x.owner)
      add(
        "owner",
        "مالکیت نامطمئن",
        "نقش مالک یا متصدی فعال آن مشخص نیست.",
        critical ? "critical" : "high",
        "بدون مالک قابل اتکا",
        `برای «${p.name}» نقش مالک و فرد فعال تعیین کنید.`,
        "",
        "مالکیت",
      );
    if (x.founderDependent)
      add(
        "founder",
        "وابستگی به بنیان‌گذار",
        "مالک فرآیند یا مرحله‌های نقشه مبنا وابسته به بنیان‌گذار هستند.",
        critical ? "critical" : "high",
        `${x.founderSteps.length} مرحله؛ مالک بنیان‌گذار: ${x.founderOwned ? "بله" : "خیر"}`,
        `حدود اختیار و مالکیت «${p.name}» را به نقش جایگزین منتقل کنید.`,
        "/analysis",
        "نقشه و نقش‌ها",
      );
    if (critical && !x.approved)
      add(
        "sop",
        "استاندارد معتبر ندارد",
        "SOP این فرآیند بحرانی مفقود یا نیازمند بازبینی است.",
        "high",
        x.mismatch ? "نسخه منبع تغییر کرده" : "SOP معتبر موجود نیست",
        `SOP «${p.name}» را تکمیل و تأیید کنید.`,
        "/standardize",
        "استاندارد",
      );
    if (x.adoption && x.adoption.score < 70)
      add(
        "adoption",
        "پذیرش پایین",
        x.eligibleKPI
          ? "مرحله اجرا ثبت شده اما شواهد پذیرش کافی نیست."
          : "برنامه پذیرش هنوز کامل نشده است.",
        x.eligibleKPI ? "high" : "medium",
        `${Math.round(x.adoption.score)} / ۱۰۰`,
        `آموزش، پایلوت و تأیید مطالعه نقش‌های «${p.name}» را تکمیل کنید.`,
        "/implementation",
        "برنامه اجرا",
      );
    if (x.eligibleKPI && x.health.kpi.score === null)
      add(
        "kpi-missing",
        "اندازه‌گیری ناکافی",
        "شاخص فعال با اندازه‌گیری، مالک و وزن معتبر لازم است.",
        critical ? "high" : "medium",
        `${x.kpis.length} شاخص فعال`,
        `شاخص‌ها و اندازه‌گیری معتبر «${p.name}» را تکمیل کنید.`,
        "/kpis",
        "شاخص‌ها",
      );
    for (const k of x.kpis)
      if (k.score !== null && k.score < 40)
        add(
          "kpi-gap",
          `عملکرد بحرانی «${k.k.name}»`,
          "مقدار ثبت‌شده از مسیر هدف فاصله دارد.",
          "critical",
          `${Math.round(k.score)} / ۱۰۰؛ فعلی ${k.current?.value}، هدف ${k.k.targetValue}`,
          `برای شکاف «${k.k.name}» اقدام دارای مالک و موعد ثبت کنید.`,
          "/kpis",
          "اندازه‌گیری",
          k.k.id,
        );
    for (const item of x.health.discipline.overdue)
      add(
        "overdue",
        `اقدام عقب‌افتاده «${item.title}»`,
        "موعد گذشته و اقدام هنوز تکمیل یا لغو نشده است.",
        item.priority === "critical" ? "critical" : "high",
        `موعد ${item.dueDate}`,
        `مانع و موعد اقدام «${item.title}» را با مالک آن تعیین تکلیف کنید.`,
        "/improvements",
        "اقدام بهبود",
        item.id,
      );
    if (x.health.score !== null && x.health.score < 60)
      add(
        "health",
        "سلامت پایین",
        "سلامت مبتنی بر داده‌های موجود زیر سطح قابل قبول است.",
        x.health.score < 40 ? "critical" : "high",
        `${x.health.score} / ۱۰۰`,
        `ضعف‌های «${p.name}» را در مرور هفتگی به اقدام تبدیل کنید.`,
        "/review",
        "سلامت فرآیند",
      );
    if (x.metrics && x.metrics.wait >= 60 && x.metrics.waitingRatio >= 50)
      add(
        "wait",
        "انتظار زیاد در نقشه",
        "جمع زمان انتظار ثبت‌شده بیش از نیمی از زمان نقشه است؛ زمان واقعی اجرا شبیه‌سازی نشده است.",
        "medium",
        `${Math.round(x.metrics.waitingRatio)}٪ انتظار`,
        `صف‌ها و معیار تحویل «${p.name}» را در تحلیل بررسی کنید.`,
        "/analysis",
        "نقشه عملیاتی",
      );
  }
  for (const role of system.roles.filter(
    (r) => r.isKeyRole && !reliableRole(system, r.id),
  ))
    risks.push({
      id: `vacancy:${role.id}`,
      type: "vacancy",
      title: `نقش کلیدی بدون متصدی · ${role.title}`,
      description: "فرد فعال برای این نقش کلیدی مشخص نشده است.",
      severity: "high",
      roleId: role.id,
      departmentId: role.departmentId,
      metric: "متصدی فعال ندارد",
      recommendedAction: `متصدی فعال و برنامه آموزش جایگزین برای «${role.title}» تعیین کنید.`,
      source: "افراد و نقش‌ها",
      href: "/system/people",
      rank: 3100,
    });
  for (const x of ownershipConcentration(
    system,
    rows.map((x) => x.process),
  ).filter((x) => x.overloaded))
    risks.push({
      id: `concentration:${x.role.id}`,
      type: "concentration",
      title: `تمرکز مالکیت · ${x.role.title}`,
      description:
        "تمرکز فرآیندها روی یک نقش، نیازمند بررسی ظرفیت و جانشینی است.",
      severity: x.role.isFounderRole ? "high" : "medium",
      roleId: x.role.id,
      departmentId: x.role.departmentId,
      metric: `${x.count} فرآیند؛ ${x.critical} بحرانی`,
      recommendedAction: `ظرفیت و توزیع مالکیت نقش «${x.role.title}» را بازبینی کنید.`,
      source: "مالکیت فرآیند",
      href: `/system/processes?owner=${encodeURIComponent(x.role.id)}`,
      rank: (x.role.isFounderRole ? 3000 : 2000) + x.count * 10,
    });
  return risks.sort((a, b) => b.rank - a.rank || a.id.localeCompare(b.id));
}
export function managementActions(risks: SystemRisk[]) {
  const seen = new Set<string>();
  return risks
    .filter((r) => {
      const key = r.recommendedAction;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 5)
    .map((r) => ({
      id: r.id,
      title: r.recommendedAction,
      reason: r.title,
      href: r.href,
      severity: r.severity,
    }));
}
const focusLabels = {
  standardization: "تکمیل استانداردهای اجرایی",
  adoption: "تقویت پذیرش و آموزش تیم",
  kpi: "تکمیل اندازه‌گیری و رفع شکاف KPI",
  independence: "کاهش وابستگی اجرایی به بنیان‌گذار",
  improvement: "تثبیت مرور و پیگیری اقدامات",
  ownership: "شفاف‌کردن مالکیت و پوشش نقش‌ها",
  processHealth: "بهبود سلامت فرآیندهای بحرانی",
};
export function managementFocus(components: HealthComponent[]) {
  const c = [...components]
    .filter((c) => c.key !== "processHealth")
    .sort(
      (a, b) =>
        b.weight * (1 - (b.value ?? 0) / 100) -
          a.weight * (1 - (a.value ?? 0) / 100) || a.key.localeCompare(b.key),
    )[0];
  return {
    key: c.key,
    title: focusLabels[c.key],
    reason:
      c.value === null
        ? "داده کافی این مؤلفه موجود نیست؛ ابتدا شواهد آن را تکمیل کنید."
        : `بیشترین فاصله وزنی قابل اقدام در «${c.label}» است.`,
    component: c,
  };
}
export function executiveSummary(
  score: number | null,
  status: string,
  completeness: number,
  risks: SystemRisk[],
  focus: ReturnType<typeof managementFocus>,
  count: number,
) {
  return [
    score === null
      ? "داده کافی برای محاسبه سلامت سیستم وجود ندارد."
      : `سلامت بر پایه داده‌های موجود ${score} از ۱۰۰ و در سطح «${status}» است.`,
    `کامل‌بودن داده‌های مدیریتی ${completeness}٪ است؛ ${count} فرآیند فعال در این گزارش لحاظ شده‌اند.`,
    risks.length
      ? `مهم‌ترین ریسک فعلی: ${risks[0].title}.`
      : "با قواعد فعلی ریسک مشخصی شناسایی نشده است؛ نبود ریسک ثبت‌شده تضمین سلامت نیست.",
    `تمرکز اصلی مدیریت: ${focus.title}.`,
  ];
}
