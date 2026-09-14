"use client";
import { useSystem } from "@/components/system/provider";
import {
  mapMetrics,
  mapCompleteness,
  mapWarnings,
  formatMinutes,
} from "@/lib/system/maps/logic";
import type { ProcessMap } from "@/lib/system/maps/model";
import { faNumber as fa } from "@/lib/system/config";
export function ProcessMetricsBar({ map }: { map: ProcessMap }) {
  const { data } = useSystem(),
    m = mapMetrics(map, data);
  return (
    <>
      <div className="map-metrics" aria-label="خلاصه نقشه">
        {[
          ["مراحل", fa(m.steps)],
          ["زمان کار", formatMinutes(m.work)],
          ["زمان انتظار", formatMinutes(m.wait)],
          ["زمان کل", formatMinutes(m.cycle)],
          ["نرخ انتظار", `${fa(Math.round(m.waitingRatio))}٪`],
          ["تحویل‌ها", fa(m.handoffs)],
          ["وابسته به بنیان‌گذار", fa(m.founder)],
        ].map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <p className="map-caption">
        جمع زمان همه مراحل ثبت‌شده است؛ مسیرهای جایگزین و حلقه‌های بازکاری، زمان
        واقعی هر اجرای فرآیند نیستند. زمان ثبت‌نشده در جمع محاسبه نمی‌شود.
      </p>
    </>
  );
}
export function MapValidationPanel({
  map,
  onSelect,
}: {
  map: ProcessMap;
  onSelect: (id: string) => void;
}) {
  const { data } = useSystem(),
    c = mapCompleteness(map, data),
    warnings = mapWarnings(map, data),
    m = mapMetrics(map, data);
  return (
    <details className="map-validation">
      <summary>
        بررسی نقشه{" "}
        <span>
          {fa(warnings.length)} نکته · کامل‌بودن داده{" "}
          {fa(Math.round(c.completeness))}٪
        </span>
      </summary>
      <div className="map-validation-body">
        <div className="map-coverage">
          {[
            ["پوشش نقش مالک", c.owner],
            ["پوشش زمان کار و انتظار", c.time],
            ["اتصال از شروع تا پایان", c.connection],
          ].map(([label, n]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{fa(Math.round(Number(n)))}٪</strong>
              <progress max="100" value={n} />
            </div>
          ))}
        </div>
        <p className="map-caption">
          شاخص کامل‌بودن، میانگین سه پوشش بالاست؛ امتیاز سلامت فرآیند نیست.{" "}
          {fa(m.decisions)} تصمیم · {fa(m.highRework)} مرحله با احتمال بازکاری
          ۵۰٪ یا بیشتر
        </p>
        <ul>
          {warnings.map((w, i) => (
            <li key={`${w.code}-${i}`}>
              {w.stepId ? (
                <button onClick={() => onSelect(w.stepId!)}>{w.message}</button>
              ) : (
                w.message
              )}
            </li>
          ))}
        </ul>
        {!warnings.length && <p>هشدار ساختاری یا داده‌ای پیدا نشد.</p>}
      </div>
    </details>
  );
}
