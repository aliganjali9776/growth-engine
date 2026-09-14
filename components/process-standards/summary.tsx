"use client";
import Link from "next/link";
import { Panel } from "@/components/system/ui";
import { useSystem } from "@/components/system/provider";
import { useStandards } from "./provider";
import {
  standardization,
  implementation,
  standardizedCurrent,
  implementedCurrent,
  effectiveSOPStatus,
} from "@/lib/system/standards/logic";
import {
  sopStatuses,
  pilotStatuses,
  trainingStatuses,
  goLiveStatuses,
} from "@/lib/system/standards/model";
export function StandardSummary({ id }: { id: string }) {
  const c = useStandards(),
    r = c.store?.records.find((r) => r.processId === id),
    src = c.source(id);
  return (
    <Panel title="استاندارد و اجرای فرآیند">
      <div className="sys-details">
        {r && src ? (
          <>
            <p>
              SOP: {sopStatuses[effectiveSOPStatus(r, src)]} · کامل‌بودن{" "}
              {standardization(r, src).score}٪
            </p>
            <p>
              {r.checklists.length} چک‌لیست · {r.rules.length} قاعده ·{" "}
              {r.assets.length} دارایی
            </p>
            <p>
              آموزش: {trainingStatuses[r.plan.trainingStatus]} · پایلوت:{" "}
              {pilotStatuses[r.plan.pilotStatus]}
            </p>
            <p>
              شروع اجرا: {goLiveStatuses[r.plan.goLiveStatus]} · پذیرش دستی:{" "}
              {implementation(r, src).score}٪
            </p>
            <p>
              استاندارد معتبر: {standardizedCurrent(r, src) ? "بله" : "خیر"} ·
              اجرای تأییدشده معتبر: {implementedCurrent(r, src) ? "بله" : "خیر"}
            </p>
          </>
        ) : (
          <p>استاندارد اجرایی هنوز ثبت نشده است.</p>
        )}
      </div>
      <Link
        className="sys-text-link"
        href={`/system/processes/${id}/standardize`}
      >
        استانداردسازی و SOP
      </Link>{" "}
      ·{" "}
      <Link
        className="sys-text-link"
        href={`/system/processes/${id}/implementation`}
      >
        برنامه پیاده‌سازی
      </Link>
    </Panel>
  );
}
export function StandardsOverview() {
  const c = useStandards(),
    { data } = useSystem(),
    active = data.processes.filter((p) => p.status === "active"),
    rows = active.flatMap((p) => {
      const r = c.store?.records.find((r) => r.processId === p.id),
        src = c.source(p.id);
      return r && src
        ? [{ r, src, s: standardization(r, src), i: implementation(r, src) }]
        : [];
    }),
    total = active.length || 1;
  return (
    <Panel
      title="استانداردسازی و پذیرش"
      caption="تأییدها مربوط به نسخه جاری‌اند؛ میانگین پذیرش فقط از برنامه‌های موجود است."
    >
      <div className="sys-rating-grid">
        {[
          [
            "پوشش SOP",
            `${Math.round((rows.filter((x) => x.r.sop).length / total) * 100)}٪`,
          ],
          [
            "استاندارد معتبر",
            rows.filter((x) => standardizedCurrent(x.r, x.src)).length,
          ],
          [
            "پیاده‌سازی معتبر",
            rows.filter((x) => implementedCurrent(x.r, x.src)).length,
          ],
          [
            "میانگین کامل‌بودن",
            `${Math.round(rows.reduce((n, x) => n + x.s.score, 0) / total)}٪`,
          ],
          [
            "میانگین پذیرش دستی",
            rows.length ? `${Math.round(rows.reduce((n, x) => n + x.i.score, 0) / rows.length)}٪ (${rows.length} برنامه)` : 'داده کافی نیست',
          ],
          [
            "برنامه با آموزش ناتمام",
            rows.filter((x) => !x.i.trainingComplete).length,
          ],
        ].map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </Panel>
  );
}
