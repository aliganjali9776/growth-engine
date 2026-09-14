"use client";
import Link from "next/link";
import { Panel } from "@/components/system/ui";
import { useSystem } from "@/components/system/provider";
import { useMaps } from "./provider";
import {
  mapMetrics,
  mapCompleteness,
  formatMinutes,
} from "@/lib/system/maps/logic";
import { faNumber as fa } from "@/lib/system/config";
export function ProcessMapSummary({ id }: { id: string }) {
  const { store, error } = useMaps(),
    { data } = useSystem();
  const map = store?.maps.find((m) => m.processId === id),
    m = map && mapMetrics(map, data),
    c = map && mapCompleteness(map, data);
  return (
    <Panel
      title="نقشه فرآیند · AS-IS"
      caption="وضعیت فعلی انجام کار؛ مستقل از طراحی آینده"
    >
      <p>
        {error ||
          (!store
            ? "در حال بازیابی نقشه…"
            : map?.steps.length
              ? c?.ready
                ? "نقشه دارای ساختار لازم برای ثبت مدل‌سازی است."
                : "نقشه در حال تکمیل است."
              : "هنوز نقشه‌ای برای این فرآیند ثبت نشده است.")}
      </p>
      {m && c && (
        <dl className="sys-details">
          {[
            ["مراحل", fa(m.steps)],
            ["جمع زمان کار و انتظار", formatMinutes(m.cycle)],
            ["پوشش نقش مالک", `${fa(Math.round(c.owner))}٪`],
            ["مراحل وابسته به بنیان‌گذار", fa(m.founder)],
          ].map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      )}
      <Link className="sys-button" href={`/system/processes/${id}/map`}>
        {map?.steps.length ? "باز کردن سازنده فرآیند" : "طراحی فرآیند"}
      </Link>
    </Panel>
  );
}
