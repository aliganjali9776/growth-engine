"use client";
import { useState } from "react";
import Link from "next/link";
import { Panel, Field } from "@/components/system/ui";
import { useSystem } from "@/components/system/provider";
import { independenceTest } from "@/lib/system/measurement/independence";
import { today } from "@/lib/system/measurement/model";
import { reliableRole } from "@/lib/system/measurement/health";
import { useMeasurement } from "./provider";
import { Workspace, ScoreCard, number } from "./shared";
export function IndependencePage() {
  const c = useMeasurement(),
    { data } = useSystem(),
    [sort, set] = useState("risk"),
    result = independenceTest(
      data,
      c.store ?? { version: 1, records: [] },
      c.evidence,
      today(),
    ),
    rows = [...result.rows].sort((a, b) =>
      sort === "name"
        ? a.process.name.localeCompare(b.process.name, "fa")
        : b.risk - a.risk,
    );
  return (
    <Workspace
      title="آزمون استقلال ۳۰ روزه"
      eyebrow="30-DAY INDEPENDENCE · READINESS"
    >
      <p className="measurement-intro">
        اگر بنیان‌گذار ۳۰ روز در عملیات روزمره حضور نداشته باشد، کدام فرآیندها
        آسیب‌پذیرترند؟ این گزارش، تشخیص آمادگی بر پایه داده‌های موجود است؛ آزمون
        زمانی یا تضمین تداوم کسب‌وکار نیست.
      </p>
      <ScoreCard
        title="آمادگی استقلال عملیاتی"
        score={result.score}
        label={result.label}
        parts={result.parts}
      >
        <p>
          بزرگ‌ترین فاصله وزنی: {result.biggest.label}. سلامت{" "}
          {number(result.unknown)} فرآیند هنوز داده کافی ندارد. داده ناشناخته در
          این تشخیص آمادگی، امتیاز آمادگی نمی‌گیرد.
        </p>
        <details>
          <summary>مبنای محاسبه و محدودیت‌ها</summary>
          <p>
            میانگین مؤلفه‌ها برای فرآیندهای فعال محاسبه می‌شود. مالکیت و سلامت
            بر فرآیندهای بحرانی تمرکز دارند؛ اگر فرآیند بحرانی نباشد، همه
            فعال‌ها لحاظ می‌شوند. پوشش نقش کلیدی به فرد فعال غیر بنیان‌گذار نیاز
            دارد. تصمیم بدون مسئول معتبر تفویض‌شده محسوب نمی‌شود. تفویض تصمیم
            نیز میانگین فرآیندهاست؛ فرآیند بدون نقشه امتیاز این بخش را نمی‌گیرد.
          </p>
          <p>
            استقلال هر فرآیند: مالک غیر بنیان‌گذار ۲۵٪ + سهم مراحل مستقل ۳۵٪ +
            تصمیم‌های مستقل ۲۵٪ + سهم انتظار مستقل ۱۵٪. نقشه TO-BE فقط با تأیید
            معتبر اجرای آن مبناست؛ در غیر این صورت AS-IS استفاده می‌شود. زمان
            انتظار نامعلوم امتیاز استقلال انتظار نمی‌گیرد. تکرار واقعی ارجاع به
            بنیان‌گذار هنوز اندازه‌گیری خودکار ندارد.
          </p>
        </details>
      </ScoreCard>
      <div className="measurement-columns">
        <Panel title="پنج اقدام اول برای کاهش وابستگی">
          {result.actions.map((x, i) => (
            <article
              className="measurement-risk"
              key={`${x.process.id}-${x.label}`}
            >
              <strong>
                {number(i + 1)} · {x.process.name}
              </strong>
              <p>{x.action}</p>
              <Link href={`/system/processes/${x.process.id}`}>
                بررسی فرآیند
              </Link>
            </article>
          ))}
          {!result.actions.length && (
            <p>
              {result.rows.length
                ? "با قواعد فعلی ریسک ثبت‌شده‌ای شناسایی نشد."
                : "ابتدا فرآیندهای عملیاتی را تعریف کنید."}
            </p>
          )}
        </Panel>
        <Panel title="ریسک‌های اصلی">
          {result.risks.slice(0, 12).map((x) => (
            <p key={`${x.process.id}-${x.label}`}>
              <Link href={`/system/processes/${x.process.id}`}>
                {x.process.name}
              </Link>{" "}
              · {x.label}
            </p>
          ))}
        </Panel>
      </div>
      <Panel title="تصمیم‌های تفویض‌شده">
        <p>
          تصمیم با نقش غیر بنیان‌گذار و متصدی فعال در نقشه مبنا؛ این فهرست مدرک
          استفاده واقعی از اختیار نیست.
        </p>
        {result.rows.flatMap((x) =>
          x.delegated.map((d) => (
            <p key={`${x.process.id}-${d.id}`}>
              {x.process.name} · {d.title} ·{" "}
              {data.roles.find((r) => r.id === d.ownerRoleId)?.title}
            </p>
          )),
        )}
        {!result.delegated.length && <p>تصمیم با شرایط فوق ثبت نشده است.</p>}
      </Panel>
      <Panel title="نقش‌های کلیدی بدون پوشش">
        <p>
          فرد فعال برای این نقش‌ها مشخص نشده است؛ تعیین متصدی و آموزش جایگزین را
          پیگیری کنید.
        </p>
        {data.roles
          .filter((r) => r.isKeyRole && !reliableRole(data, r.id))
          .map((r) => (
            <p key={r.id}>
              <Link href="/system/people">{r.title}</Link>
            </p>
          ))}
        {!data.roles.some((r) => r.isKeyRole && !reliableRole(data, r.id)) && (
          <p>نقش کلیدی بدون متصدی فعال وجود ندارد.</p>
        )}
      </Panel>
      <Panel title="نقشه ریسک فرآیندها">
        <Field label="مرتب‌سازی فرآیندهای استقلال">
          <select value={sort} onChange={(e) => set(e.target.value)}>
            <option value="risk">بیشترین ریسک</option>
            <option value="name">نام فرآیند</option>
          </select>
        </Field>
        <div className="measurement-table">
          <table>
            <thead>
              <tr>
                {[
                  "فرآیند",
                  "سلامت",
                  "استقلال",
                  "مالک قابل اتکا",
                  "SOP معتبر",
                  "پذیرش",
                  "دید KPI",
                  "ریسک",
                ].map((x) => (
                  <th key={x}>{x}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((x) => (
                <tr key={x.process.id}>
                  <td>
                    <Link href={`/system/processes/${x.process.id}`}>
                      {x.process.name}
                    </Link>
                  </td>
                  <td>{number(x.health.score)}</td>
                  <td>{number(x.health.founder.score)}</td>
                  <td>
                    {x.owner ? "بله" : "خیر"}
                    <small>
                      {data.roles.find((r) => r.id === x.process.ownerRoleId)
                        ?.title ?? "بدون مالک"}
                    </small>
                  </td>
                  <td>{x.sop ? "بله" : "خیر"}</td>
                  <td>{number(x.health.adoption)}</td>
                  <td>{x.health.kpi.score === null ? "ناکافی" : "موجود"}</td>
                  <td>{x.risks[0]?.label ?? "ریسک مشخص نشده"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </Workspace>
  );
}
