"use client";
import Link from "next/link";
import { Panel } from "@/components/system/ui";
import { useSystem } from "@/components/system/provider";
import { useMeasurement } from "./provider";
import { processHealth } from "@/lib/system/measurement/health";
import { independenceTest } from "@/lib/system/measurement/independence";
import { today } from "@/lib/system/measurement/model";
import { number } from "./shared";
export function MeasurementSummary({ id }: { id: string }) {
  const c = useMeasurement(),
    r = c.record(id),
    h = processHealth(r, c.evidence(id), today()),
    latest = [...r.entries].sort((a, b) =>
      b.periodDate.localeCompare(a.periodDate),
    )[0];
  return (
    <Panel title="اندازه‌گیری، بهبود و استقلال">
      <div className="measurement-kpi-values">
        <div>
          <span>شاخص فعال</span>
          <strong>{number(h.kpi.active.length)}</strong>
        </div>
        <div>
          <span>عملکرد KPI</span>
          <strong>{number(h.kpi.score)}</strong>
        </div>
        <div>
          <span>سلامت</span>
          <strong>{number(h.score)}</strong>
        </div>
        <div>
          <span>استقلال بنیان‌گذار</span>
          <strong>{number(h.founder.score)}</strong>
        </div>
      </div>
      <p>
        آخرین اندازه‌گیری: {latest?.periodDate ?? "ثبت نشده"} · آخرین مرور:{" "}
        {h.discipline.latest?.periodEnd ?? "ثبت نشده"}
      </p>
      <p>
        {number(h.discipline.open.length)} اقدام باز ·{" "}
        {number(h.discipline.overdue.length)} عقب‌افتاده ·{" "}
        {number(h.discipline.completed.length)} تکمیل‌شده
      </p>
      <p>مبنای استقلال: {h.founder.basis}؛ امتیاز ساختاری است.</p>
      <div className="measurement-actions">
        <Link href={`/system/processes/${id}/kpis`}>شاخص‌ها و سلامت</Link>
        <Link href={`/system/processes/${id}/review`}>مرور هفتگی</Link>
        <Link href={`/system/processes/${id}/improvements`}>دفتر بهبود</Link>
      </div>
    </Panel>
  );
}
export function MeasurementOverview() {
  const c = useMeasurement(),
    { data } = useSystem(),
    report = independenceTest(
      data,
      c.store ?? { version: 1, records: [] },
      c.evidence,
      today(),
    ),
    rows = report.rows,
    average = (v: (number | null)[]) => {
      const known = v.filter((x): x is number => x !== null);
      return known.length
        ? known.reduce((a, b) => a + b, 0) / known.length
        : null;
    },
    knownKPI = rows.filter((x) => x.health.kpi.score !== null).length,
    knownHealth = rows.filter((x) => x.health.score !== null).length;
  return (
    <Panel
      title="اندازه‌گیری و استقلال"
      caption="میانگین‌ها فقط روی فرآیندهای دارای داده معتبر محاسبه می‌شوند؛ پوشش را کنار میانگین بخوانید."
    >
      <div className="measurement-kpi-values">
        {[
          ["پوشش KPI", `${number(knownKPI)} از ${number(rows.length)}`],
          [
            "میانگین عملکرد",
            number(average(rows.map((x) => x.health.kpi.score))),
          ],
          [
            "میانگین سلامت",
            `${number(average(rows.map((x) => x.health.score)))} (${number(knownHealth)} فرآیند)`,
          ],
          [
            "بهبود بحرانی باز",
            number(
              rows.reduce(
                (n, x) =>
                  n +
                  x.health.discipline.open.filter(
                    (a) => a.priority === "critical",
                  ).length,
                0,
              ),
            ),
          ],
          [
            "اقدام عقب‌افتاده",
            number(
              rows.reduce((n, x) => n + x.health.discipline.overdue.length, 0),
            ),
          ],
          [
            "میانگین استقلال",
            `${number(average(rows.map((x) => x.health.founder.score)))} (${number(rows.filter((x) => x.health.founder.score !== null).length)} فرآیند)`,
          ],
          ["استقلال ۳۰ روزه", number(report.score)],
        ].map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <Link href="/system/independence" className="sys-text-link">
        گزارش آزمون استقلال ۳۰ روزه
      </Link>
    </Panel>
  );
}
