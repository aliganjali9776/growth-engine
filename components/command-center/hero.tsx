import Link from "next/link";
import type { CommandReport } from "@/lib/system/command-center/report";
import { number } from "@/components/measurement/shared";
export function SystemHealthHero({ report: r }: { report: CommandReport }) {
  return (
    <header className="command-hero">
      <span className="command-eyebrow">SYSTEM COMMAND CENTER</span>
      <h1>مرکز فرمان سیستم</h1>
      <div className="command-hero-grid">
        <div className="command-main-score">
          <span>سلامت سیستم</span>
          <strong
            className={r.health.score === null ? "command-unknown" : undefined}
          >
            {number(r.health.score)}
            <small>/ ۱۰۰</small>
          </strong>
          <b>
            {r.health.status}
            {r.health.partial ? " · برآورد با داده ناقص" : ""}
          </b>
          <p>کامل‌بودن داده: {number(r.health.completeness)}٪</p>
          <a
            href="#system-health-breakdown"
            onClick={() => {
              const details = document.getElementById(
                "system-health-breakdown",
              );
              if (details instanceof HTMLDetailsElement) details.open = true;
            }}
          >
            مشاهده سهم مؤلفه‌ها
          </a>
        </div>
        <div className="command-focus">
          <span>تمرکز اصلی مدیریت</span>
          <h2>{r.focus.title}</h2>
          <p>{r.focus.reason}</p>
          <span>بزرگ‌ترین ریسک ثبت‌شده</span>
          {r.risks[0] ? (
            <Link href={r.risks[0].href}>{r.risks[0].title}</Link>
          ) : (
            <p>ریسکی با قواعد فعلی شناسایی نشده است.</p>
          )}
        </div>
        <div className="command-independence">
          <span>استقلال ۳۰ روزه</span>
          <strong
            className={
              r.independence.score === null ? "command-unknown" : undefined
            }
          >
            {number(r.independence.score)}
            <small>/ ۱۰۰</small>
          </strong>
          <p>{r.independence.label}</p>
          <Link href="/system/independence">مشاهده گزارش کامل استقلال</Link>
        </div>
      </div>
      <div className="command-executive-summary">
        {r.summary.map((x) => (
          <p key={x}>{x}</p>
        ))}
      </div>
    </header>
  );
}
export function SystemHealthBreakdown({
  report: r,
}: {
  report: CommandReport;
}) {
  return (
    <details className="command-disclosure" id="system-health-breakdown">
      <summary>شفافیت سلامت و کامل‌بودن داده‌های مدیریتی</summary>
      <p>
        سلامت از مجموع «امتیاز × وزن» مؤلفه‌های موجود، تقسیم بر مجموع وزن موجود
        محاسبه می‌شود. اکنون {number(r.health.usedWeight)}٪ وزن فرمول قابل
        محاسبه است. امتیاز ناشناخته، عملکرد صفر محسوب نمی‌شود؛ نبود استاندارد یا
        مالک، شکاف آمادگی واقعی است.
      </p>
      <div className="command-breakdown">
        {r.health.components.map((c) => (
          <article key={c.key}>
            <div>
              <strong>{c.label}</strong>
              <b>{number(c.value)} / ۱۰۰</b>
            </div>
            <p>
              وزن {number(c.weight)}٪ · سهم نهایی{" "}
              {c.value === null
                ? "نامشخص"
                : number((c.value * c.weight) / r.health.usedWeight)}{" "}
              · داده {number(c.known)} از {number(c.total)}
            </p>
            {c.value !== null && (
              <progress aria-label={c.label} max={100} value={c.value} />
            )}
            <small>{c.note}</small>
          </article>
        ))}
      </div>
      <h3>کامل‌بودن داده‌ها: {number(r.health.completeness)}٪</h3>
      <p>
        این شاخص، پوشش ورودی‌هاست و با عملکرد متفاوت است. مؤلفه‌ای ممکن است
        امتیاز داشته باشد ولی پوشش آن محدود باشد.
      </p>
      <ul>
        {r.health.checks.map((c) => (
          <li key={c.label}>
            {c.label}: {number(c.value * 100)}٪ · وزن {number(c.weight)}٪{" "}
            {c.value < 1 ? "— نیازمند تکمیل داده" : ""}
          </li>
        ))}
      </ul>
    </details>
  );
}
