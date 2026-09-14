import Link from "next/link";
import type { CommandReport } from "@/lib/system/command-center/report";
import type { operationalSummaries } from "@/lib/system/command-center/summaries";
import type { CommandRow } from "@/lib/system/command-center/aggregation";
import { number } from "@/components/measurement/shared";
type Summaries = ReturnType<typeof operationalSummaries>;
function Metrics({ items }: { items: [string, string | number | null][] }) {
  return (
    <dl className="command-metrics">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>
            {typeof value === "number" || value === null
              ? number(value)
              : value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
function ProcessLinks({ rows, path }: { rows: CommandRow[]; path: string }) {
  return (
    <ul>
      {rows.map((x) => (
        <li key={x.process.id}>
          <Link href={`/system/processes/${x.process.id}${path}`}>
            {x.process.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}
export function StandardizationSummary({
  summary: s,
  total,
}: {
  summary: Summaries["standard"];
  total: number;
}) {
  return (
    <section>
      <h3>استانداردهای اجرایی</h3>
      <Metrics
        items={[
          ["SOP معتبر", `${number(s.approved.length)} از ${number(total)}`],
          ["نیازمند بازبینی", s.needsReview.length],
          ["بحرانی بدون SOP معتبر", s.missingCritical.length],
          ["ناهماهنگی TO-BE / SOP", s.mismatch.length],
          ["شکاف قواعد تصمیم", s.decisionGaps.length],
          ["تعریف پایان صحیح", `${number(s.dod.length)} از ${number(total)}`],
        ]}
      />
      <details className="command-nested">
        <summary>فرآیندهای نیازمند استاندارد یا بازبینی</summary>
        <ProcessLinks
          rows={[
            ...new Map(
              [
                ...s.missingCritical,
                ...s.needsReview,
                ...s.mismatch,
                ...s.decisionGaps,
              ].map((x) => [x.process.id, x]),
            ).values(),
          ]}
          path="/standardize"
        />
      </details>
    </section>
  );
}
export function AdoptionSummary({
  summary: s,
  average,
}: {
  summary: Summaries["adoption"];
  average: number | null;
}) {
  return (
    <section>
      <h3>پذیرش و استفاده</h3>
      <p>
        مستندسازی بدون پذیرش واقعی، سیستم‌سازی محسوب نمی‌شود. امتیاز موجود از
        تأییدهای دستی برنامه اجراست.
      </p>
      <Metrics
        items={[
          ["میانگین پذیرش موجود", average],
          ["پذیرش پایین", s.low.length],
          ["اجراشده با پذیرش پایین", s.implementedLow.length],
          ["آموزش ناتمام", s.training.length],
          ["پایلوت ناتمام", s.pilot.length],
          ["Live با پذیرش پایین", s.liveLow.length],
          ["تأیید مطالعه مفقود", s.acknowledgements],
          ["بدون داده برنامه", s.missing.length],
        ]}
      />
      <details className="command-nested">
        <summary>پیگیری آموزش و اجرای فرآیندها</summary>
        <ProcessLinks
          rows={[
            ...new Map(
              [...s.low, ...s.training, ...s.pilot].map((x) => [
                x.process.id,
                x,
              ]),
            ).values(),
          ]}
          path="/implementation"
        />
      </details>
    </section>
  );
}
export function KPISummary({
  summary: s,
  report: r,
}: {
  summary: Summaries["kpis"];
  report: CommandReport;
}) {
  return (
    <section>
      <h3>دید و عملکرد KPI</h3>
      <Metrics
        items={[
          [
            "پوشش شاخص فعال در مراحل اجرا",
            r.health.kpiCoverage === null
              ? "داده کافی نیست"
              : `${number(r.health.kpiCoverage)}٪`,
          ],
          ["میانگین عملکرد موجود", r.health.kpiPerformance],
          ["شکاف بحرانی", s.critical.length],
          ["شاخص رو به افت", s.declining.length],
          ["فرآیند بدون دید معتبر KPI", s.missing.length],
        ]}
      />
      <div className="command-two">
        {[
          { title: "شاخص‌های رو به بهبود", rows: s.improving },
          { title: "شاخص‌های رو به افت", rows: s.declining },
        ].map((g) => (
          <div key={g.title}>
            <h4>{g.title}</h4>
            {g.rows.slice(0, 5).map((x) => (
              <p key={x.k.id}>
                <Link href={`/system/processes/${x.process.id}/kpis`}>
                  {x.k.name} · {x.process.name}
                </Link>{" "}
                — {number(x.current?.value)} {x.k.unit}
              </p>
            ))}
            {!g.rows.length && <p>روندی با داده کافی ثبت نشده است.</p>}
          </div>
        ))}
      </div>
      <details className="command-nested">
        <summary>فرآیندهای نیازمند اندازه‌گیری</summary>
        <ProcessLinks rows={s.missing} path="/kpis" />
      </details>
    </section>
  );
}
export function ImprovementSummary({
  summary: s,
  score,
}: {
  summary: Summaries["improvements"];
  score: number | null;
}) {
  return (
    <section>
      <h3>پیگیری بهبود</h3>
      <Metrics
        items={[
          ["انضباط بهبود موجود", score],
          ["باز", s.open.length],
          ["بحرانی باز", s.critical.length],
          ["عقب‌افتاده", s.overdue.length],
          ["تکمیل‌شده در دوره انتخابی", s.completed.length],
          ["متوقف", s.blocked.length],
          ["بدون نقش مالک معتبر", s.unowned.length],
        ]}
      />
      <ul>
        {s.overdue.slice(0, 5).map((x) => (
          <li key={x.item.id}>
            <Link href={`/system/processes/${x.process.id}/improvements`}>
              {x.item.title} · {x.process.name}
            </Link>{" "}
            — موعد {x.item.dueDate}
          </li>
        ))}
      </ul>
    </section>
  );
}
export function OwnershipSummary({
  report: r,
  founder: f,
}: {
  report: CommandReport;
  founder: Summaries["founder"];
}) {
  return (
    <>
      <Metrics
        items={[
          ["پوشش مالک قابل اتکا", `${number(r.health.ownerCoverage)}٪`],
          ["پوشش نقش کلیدی", `${number(r.health.keyCoverage)}٪`],
          ["فرآیند وابسته به بنیان‌گذار", f.dependent.length],
          ["بحرانی وابسته", f.critical.length],
          ["مراحل وابسته", f.steps],
          ["تصمیم‌های وابسته", f.decisions],
          ["انتظار ثبت‌شده وابسته (دقیقه)", f.wait],
        ]}
      />
      <p>
        تمرکز زیاد: حداقل ۴ فرآیند و سهم حداقل ۲۵٪؛ یا نقش بنیان‌گذار با حداقل ۲
        فرآیند بحرانی. این علامت، نیاز به بررسی ظرفیت است، نه اثبات اضافه‌بار.
      </p>
      <div className="command-table">
        <table>
          <thead>
            <tr>
              <th>نقش</th>
              <th>فرآیند</th>
              <th>بحرانی</th>
              <th>سهم</th>
              <th>وضعیت</th>
            </tr>
          </thead>
          <tbody>
            {r.health.concentration.map((x) => (
              <tr key={x.role.id}>
                <td>
                  <Link href={`/system/processes?owner=${x.role.id}`}>
                    {x.role.title}
                  </Link>
                </td>
                <td>{number(x.count)}</td>
                <td>{number(x.critical)}</td>
                <td>{number(x.share * 100)}٪</td>
                <td>
                  {x.overloaded ? "تمرکز نیازمند بررسی" : "تمرکز محدود"}
                  {!x.covered ? " · بدون متصدی فعال" : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details className="command-nested">
        <summary>فرآیندهای بحرانی وابسته به بنیان‌گذار</summary>
        <ProcessLinks rows={f.critical} path="/analysis" />
      </details>
      <Link href="/system/independence">مشاهده گزارش کامل استقلال</Link>
    </>
  );
}
