"use client";
import { FindingImprovement } from "@/components/measurement/improvements-page";
import Link from "next/link";
import { useSystem } from "@/components/system/provider";
import { useMaps } from "@/components/process-map/provider";
import { Panel, Badge } from "@/components/system/ui";
import { ProcessMetricsBar } from "@/components/process-map/metrics";
import { analyzeProcess, categories } from "@/lib/system/analysis/rules";
import { formatMinutes } from "@/lib/system/maps/logic";
import { faNumber as fa, stages } from "@/lib/system/config";
import { ProcessNav, Confirmation } from "./shared";
import "../process-map/map.css";
import "./analysis.css";
export function AnalysisPage({ id }: { id: string }) {
  const { data } = useSystem(),
    { store, error } = useMaps(),
    p = data.processes.find((p) => p.id === id),
    map = store?.maps.find((m) => m.processId === id);
  if (!p)
    return (
      <Panel title="فرآیند پیدا نشد">
        <Link href="/system/processes">فهرست فرآیندها</Link>
      </Panel>
    );
  if (!map?.steps.length)
    return (
      <Panel title="تحلیل فرآیند AS-IS">
        <p>
          {error ||
            (!store
              ? "در حال بازیابی…"
              : "ابتدا نقشه وضعیت فعلی را ایجاد کنید.")}
        </p>
        <Link href={`/system/processes/${id}/map`}>طراحی فرآیند</Link>
      </Panel>
    );
  const a = analyzeProcess(map, data);
  return (
    <div className="analysis-workspace">
      <ProcessNav id={id} />
      <header className="analysis-heading">
        <span>AS-IS · PROCESS ANALYSIS</span>
        <h1>تحلیل فرآیند AS-IS</h1>
        <h2>{p.name}</h2>
        <p>
          {p.code} · {stages[p.systemizationStage]} ·{" "}
          {data.roles.find((r) => r.id === p.ownerRoleId)?.title ?? "بدون مالک"}{" "}
          · {data.departments.find((d) => d.id === p.departmentId)?.name}
        </p>
        <Badge level={p.priorityLevel} />
      </header>
      <ProcessMetricsBar map={map} />
      <p className="map-caption">
        {fa(a.metrics.decisions)} تصمیم · {fa(a.metrics.highRework)} مرحله با
        بازکاری بالا. یافته‌ها کاندید بررسی‌اند؛ ضرورت حذف یا قابلیت واقعی
        اتوماسیون از روی نقشه اثبات نمی‌شود.
      </p>
      <section className="friction-panel">
        <div>
          <span>شاخص اصطکاک فرآیند</span>
          <strong>
            {fa(Math.round(a.friction.score))}
            <small>/ ۱۰۰</small>
          </strong>
          <b>{a.friction.level}</b>
          <p>
            بیشتر یعنی اصطکاک بیشتر. شاخص داخلی تشخیصی است؛ سلامت نهایی سیستم یا
            معیار علمی عمومی نیست.
          </p>
          {a.friction.provisional && (
            <p className="sys-alert">
              داده یا ساختار ناقص است؛ این امتیاز مقدماتی است.
            </p>
          )}
        </div>
        <div>
          {a.friction.components.map((c) => (
            <div className="friction-component" key={c.key}>
              <span>
                {c.label} · وزن {fa(c.weight)}٪
              </span>
              <b>{fa(Math.round(c.value * c.weight * 10) / 10)}</b>
              <progress max={c.weight} value={c.value * c.weight} />
              <small>{c.rule}</small>
            </div>
          ))}
        </div>
      </section>
      <Panel
        title="گلوگاه‌های محتمل"
        caption="رتبه‌بندی بر اساس زمان، نقش و وابستگی گراف؛ ظرفیت واقعی افراد اندازه‌گیری نشده است."
      >
        <details>
          <summary>فرمول امتیاز هر مرحله</summary>
          <p className="map-caption">
            ۳۵٪ انتظار / بیشترین انتظار + ۲۰٪ وابستگی بنیان‌گذار (۰ یا ۱) + ۱۵٪
            احتمال بازکاری + ۱۵٪ میانگین وابستگی ورودی و پایین‌دست + ۱۰٪ کار /
            بیشترین کار + ۵٪ درگیری در تحویل. ورودی بر ۳ و پایین‌دست بر تعداد
            سایر مراحل تقسیم می‌شود؛ هر مؤلفه بین ۰ و ۱ محدود است. امتیاز حداقل
            ۲۵ نمایش داده می‌شود.
          </p>
        </details>
        <div className="bottleneck-list">
          {a.bottlenecks.map((b, i) => (
            <article key={b.step.id}>
              <span className="analysis-rank">{fa(i + 1)}</span>
              <div>
                <strong>{b.step.title}</strong>
                <p>
                  {formatMinutes(b.step.waitTimeMinutes ?? 0)} انتظار ·{" "}
                  {formatMinutes(b.step.workTimeMinutes ?? 0)} کار ·{" "}
                  {fa(b.incoming)} ورودی · {fa(b.downstream)} مرحله پایین‌دست
                </p>
                <small>
                  {b.parts
                    .filter((p) => p.value > 0)
                    .map(
                      (p) =>
                        `${p.label}: ${fa(Math.round(p.value * p.weight))}`,
                    )
                    .join(" · ")}{" "}
                  · پیشنهاد: {categories[b.category]}
                </small>
              </div>
              <span className="analysis-score">
                {fa(Math.round(b.score))}
                <small>{b.severity}</small>
              </span>
            </article>
          ))}
        </div>
        {!a.bottlenecks.length && (
          <p>
            طبق آستانه فعلی کاندیدی پیدا نشد؛ این به معنی نبود همه مشکلات نیست.
          </p>
        )}
      </Panel>
      <div className="sys-two">
        <Panel
          title="انتظار کجا جمع شده است؟"
          caption={
            a.metrics.waitingRatio >= 50
              ? "حداقل نیمی از مجموع زمان ثبت‌شده صرف انتظار می‌شود."
              : "انتظار کمتر از نیمی از مجموع زمان ثبت‌شده است."
          }
        >
          {a.waiting.map((w) => (
            <div className="wait-row" key={w.step.id}>
              <strong>{w.step.title}</strong>
              <span>
                {formatMinutes(w.step.waitTimeMinutes!)} ·{" "}
                {fa(Math.round(w.waitShare))}٪ انتظار ·{" "}
                {fa(Math.round(w.cycleShare))}٪ زمان کل
              </span>
              <progress value={w.waitShare} max="100" />
            </div>
          ))}
        </Panel>
        <Panel title="وابستگی به بنیان‌گذار">
          <div className="founder-analysis">
            <strong>{fa(a.founder.steps.length)} مرحله</strong>
            <p>
              {formatMinutes(a.founder.wait)} انتظار در این مراحل ثبت شده است؛{" "}
              {fa(
                Math.round(
                  a.metrics.wait ? (100 * a.founder.wait) / a.metrics.wait : 0,
                ),
              )}
              ٪ از کل انتظار.
            </p>
            <p>
              {fa(a.founder.decisions)} تصمیم وابسته · حذف{" "}
              {fa(a.founder.blocking)} مرحله وابسته، همه مسیرهای موجود شروع تا
              پایان را قطع می‌کند.
            </p>
            <ul>
              {a.founder.steps.map((s) => (
                <li key={s.id}>{s.title}</li>
              ))}
            </ul>
          </div>
        </Panel>
      </div>
      <div className="sys-two">
        <Panel title="تحویل و تمرکز مالکیت">
          <p>
            {fa(a.metrics.steps)} مرحله، {fa(a.metrics.handoffs)} تحویل و{" "}
            {fa(a.handoffs.uniqueOwners)} نقش مالک.
          </p>
          <p>
            {fa(a.handoffs.crossDepartment)} اتصال بین واحدها ·{" "}
            {fa(a.handoffs.backAndForth)} اتصال عضو جفت رفت‌وبرگشت بین نقش‌ها.
            این تعداد از گراف است، نه تعداد وقوع در اجرا.
          </p>
          {a.metrics.handoffs >= Math.max(3, a.metrics.steps * 0.5) && (
            <p className="sys-alert">
              تراکم تحویل بالاست؛ ضرورت جابه‌جایی مسئولیت را مرور کنید.
            </p>
          )}
          {a.ownership.map((o) => (
            <div className="ownership-analysis" key={o.role.id}>
              <span>{o.role.title}</span>
              <b>
                {fa(o.steps.length)} مرحله ·{" "}
                {fa(
                  a.bottlenecks.filter(
                    (b) => b.step.ownerRoleId === o.role.id && b.score >= 50,
                  ).length,
                )}{" "}
                گلوگاه با امتیاز بالا
              </b>
            </div>
          ))}
        </Panel>
        <Panel title="تصمیم‌ها و بازکاری">
          <p>
            {fa(a.loops.length)} مرحله عضو حلقه جهت‌دار است؛ حلقه می‌تواند عمدی
            باشد.
          </p>
          {a.decisions.map((d) => (
            <div className="ownership-analysis" key={d.step.id}>
              <span>{d.step.title}</span>
              <small>
                {fa(d.branches)} شاخه ·{" "}
                {d.loop ? "دارای مسیر برگشت" : "بدون حلقه"} ·{" "}
                {d.founder ? "وابسته به بنیان‌گذار" : "نقش غیر بنیان‌گذار"} ·{" "}
                {formatMinutes(d.step.waitTimeMinutes ?? 0)} انتظار
              </small>
            </div>
          ))}
          {map.steps
            .filter((s) => s.reworkProbability >= 50)
            .map((s) => (
              <p key={s.id}>
                {s.title}: بازکاری {fa(s.reworkProbability)}٪
              </p>
            ))}
        </Panel>
      </div>
      <Panel
        title="فرصت‌های بهبود"
        caption="حذف · ساده‌سازی · تفویض · اتوماسیون؛ هیچ پیشنهاد به‌طور خودکار اعمال نمی‌شود."
      >
        <div className="opportunity-list">
          {a.findings.map((f) => (
            <article key={f.id}>
              <span className={`action-tag ${f.category}`}>
                {categories[f.category]}
              </span>
              <div>
                <h3>
                  {f.title} · {map.steps.find((s) => s.id === f.stepId)?.title}
                </h3>
                <p>{f.reason}</p>
                <small>
                  {f.metric} · اولویت {f.severity}
                </small>
                <p>فایده مورد انتظار: {f.benefit}</p>
                <FindingImprovement
                  processId={id}
                  stepId={f.stepId}
                  findingId={f.id}
                  title={`${f.title} · ${map.steps.find((s) => s.id === f.stepId)?.title ?? ""}`}
                  reason={f.reason}
                  benefit={f.benefit}
                />
              </div>
            </article>
          ))}
        </div>
        {!a.findings.length && <p>با قواعد فعلی فرصتی شناسایی نشد.</p>}
      </Panel>
      <Confirmation asis={map} kind="review" />
      <Link className="sys-button" href={`/system/processes/${id}/to-be`}>
        طراحی نسخه TO-BE
      </Link>
    </div>
  );
}
