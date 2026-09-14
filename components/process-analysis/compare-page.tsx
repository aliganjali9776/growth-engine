"use client";
import Link from "next/link";
import { useSystem } from "@/components/system/provider";
import { useMaps } from "@/components/process-map/provider";
import { useAnalysis } from "./provider";
import { compareMaps, redesignReadiness } from "@/lib/system/analysis/redesign";
import { faNumber as fa } from "@/lib/system/config";
import { Panel } from "@/components/system/ui";
import { ProcessNav, Confirmation } from "./shared";
import "./analysis.css";
export function ComparePage({ id }: { id: string }) {
  const { data } = useSystem(),
    maps = useMaps(),
    analysis = useAnalysis(),
    a = maps.store?.maps.find((m) => m.processId === id),
    b = analysis.store?.records.find((r) => r.processId === id)?.toBe;
  if (!a || !b)
    return (
      <Panel title="مقایسه AS-IS و TO-BE">
        <p>
          {maps.error ||
            analysis.error ||
            "برای مقایسه، هر دو نسخه نقشه لازم است."}
        </p>
        <Link href={`/system/processes/${id}/to-be`}>طراحی نسخه TO-BE</Link>
      </Panel>
    );
  const c = compareMaps(a, b, data),
    ready = redesignReadiness(b, data);
  return (
    <div className="analysis-workspace">
      <ProcessNav id={id} />
      <header className="analysis-heading">
        <span>BEFORE / AFTER · DESIGN IMPACT</span>
        <h1>مقایسه وضعیت فعلی و مطلوب</h1>
        <h2>{data.processes.find((p) => p.id === id)?.name}</h2>
        <p>
          تفاوت داده‌های دو نقشه؛ صرفه‌جویی تحقق‌یافته یا نتیجه اجرای واقعی
          نیست. کاهش همه معیارها الزاماً بهتر نیست.
        </p>
      </header>
      {c.warnings.map((w) => (
        <p className="sys-alert" key={w}>
          {w}
        </p>
      ))}
      <div className="compare-table-wrap">
        <table className="compare-table">
          <thead>
            <tr>
              <th>شاخص</th>
              <th>AS-IS</th>
              <th>TO-BE</th>
              <th>تغییر مطلق</th>
              <th>تغییر نسبی</th>
            </tr>
          </thead>
          <tbody>
            {c.rows.map((r) => (
              <tr key={r.key}>
                <th>
                  {r.label}
                  {["work", "wait", "cycle"].includes(r.key)
                    ? " (دقیقه)"
                    : r.key === "waitingRatio"
                      ? " (٪)"
                      : ""}
                </th>
                <td>{fa(Math.round(r.before * 10) / 10)}</td>
                <td>{fa(Math.round(r.after * 10) / 10)}</td>
                <td
                  className={
                    r.difference < 0
                      ? "delta-down"
                      : r.difference > 0
                        ? "delta-up"
                        : ""
                  }
                >
                  {r.difference > 0 ? "+" : ""}
                  {fa(Math.round(r.difference * 10) / 10)}
                  {r.key === "waitingRatio" ? " واحد درصد" : ""}
                </td>
                <td>
                  {r.percent === null
                    ? "مبنای صفر؛ قابل محاسبه نیست"
                    : `${r.percent > 0 ? "+" : ""}${fa(Math.round(r.percent))}٪`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Panel title="اثر طراحی جدید">
        <p>
          {fa(c.removed.length)} مرحله حذف‌شده · {fa(c.added.length)} مرحله
          اضافه‌شده · {fa(c.delegated)} مرحله با برچسب تفویض ·{" "}
          {fa(c.connectionChanges)} اتصال اضافه یا حذف‌شده.
        </p>
        <p>
          زمان‌ها جمع مراحل‌اند و مسیر جایگزین یا تکرار حلقه‌ها شبیه‌سازی
          نشده‌اند. مقایسه با AS-IS فعلی انجام می‌شود.
        </p>
      </Panel>
      <Panel title="خلاصه تفاوت‌ها">
        <ul className="comparison-changes">
          {c.removed.map((s) => (
            <li key={`r-${s.id}`}>
              {s.type === "decision" ? "تصمیم حذف‌شده" : "مرحله حذف‌شده"}:{" "}
              {s.title}
            </li>
          ))}
          {c.added.map((s) => (
            <li key={`a-${s.id}`}>مرحله اضافه‌شده: {s.title}</li>
          ))}
          {c.changes.map((x, i) => (
            <li key={i}>
              {x.step.title}: {x.text}
            </li>
          ))}
        </ul>
        {!c.removed.length && !c.added.length && !c.changes.length && (
          <p>تغییر عملیاتی در مرحله‌ها ثبت نشده است.</p>
        )}
      </Panel>
      <Panel
        title={
          ready.ready
            ? "نسخه TO-BE آماده تأیید است"
            : "نسخه TO-BE نیازمند تکمیل است"
        }
      >
        <ul>
          {ready.warnings.map((w, i) => (
            <li key={i}>{w.message}</li>
          ))}
        </ul>
        <p>آمادگی ساختاری، به معنی بهتر بودن طراحی یا اجرای آن نیست.</p>
      </Panel>
      <Confirmation asis={a} kind="approval" />
    </div>
  );
}
