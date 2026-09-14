"use client";
import Link from "next/link";
import { useMaps } from "@/components/process-map/provider";
import { useSystem } from "@/components/system/provider";
import { useAnalysis } from "./provider";
import {
  reviewCurrent,
  approvalCurrent,
  redesignReadiness,
} from "@/lib/system/analysis/redesign";
import { frictionScore } from "@/lib/system/analysis/rules";
import { Panel } from "@/components/system/ui";
import { faNumber as fa } from "@/lib/system/config";
export function AnalysisSummary({ id }: { id: string }) {
  const { data } = useSystem(),
    maps = useMaps(),
    analysis = useAnalysis(),
    a = maps.store?.maps.find((m) => m.processId === id),
    r = analysis.store?.records.find((r) => r.processId === id);
  return (
    <div className="sys-two">
      <Panel title="تحلیل فرآیند">
        <p>
          {analysis.error ||
            maps.error ||
            (!analysis.store || !maps.store
              ? "در حال بازیابی…"
              : a?.steps.length
                ? reviewCurrent(r, a, data)
                  ? "تحلیل نسخه فعلی مرور شده است."
                  : "تحلیل هنوز مرور نشده یا داده‌ها تغییر کرده‌اند."
                : "نقشه‌ای برای تحلیل وجود ندارد.")}
        </p>
        {a?.steps.length ? (
          <p>اصطکاک: {fa(Math.round(frictionScore(a, data).score))} از ۱۰۰</p>
        ) : null}
        <Link className="sys-button" href={`/system/processes/${id}/analysis`}>
          تحلیل فرآیند
        </Link>
      </Panel>
      <Panel title="نسخه آینده · TO-BE">
        <p>
          {!r?.toBe
            ? "ساخته نشده"
            : a && approvalCurrent(r, a, data)
              ? "تأییدشده"
              : redesignReadiness(r.toBe, data).ready
                ? "آماده تأیید"
                : "پیش‌نویس؛ نیازمند تکمیل"}
        </p>
        <Link className="sys-button" href={`/system/processes/${id}/to-be`}>
          طراحی نسخه TO-BE
        </Link>
        {r?.toBe && (
          <Link
            className="sys-text-link"
            href={`/system/processes/${id}/compare`}
          >
            مقایسه دو نسخه
          </Link>
        )}
      </Panel>
    </div>
  );
}
