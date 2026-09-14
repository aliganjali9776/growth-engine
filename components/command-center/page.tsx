"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useSystem } from "@/components/system/provider";
import { useMeasurement } from "@/components/measurement/provider";
import { useMaps } from "@/components/process-map/provider";
import { useAnalysis } from "@/components/process-analysis/provider";
import { useStandards } from "@/components/process-standards/provider";
import { today } from "@/lib/system/measurement/model";
import { commandReport } from "@/lib/system/command-center/report";
import { operationalSummaries } from "@/lib/system/command-center/summaries";
import type { Period } from "@/lib/system/command-center/snapshots";
import { SystemHealthHero, SystemHealthBreakdown } from "./hero";
import { AttentionFeed } from "./attention";
import {
  MaturityFunnel,
  ProcessRiskMatrix,
  CriticalProcessTable,
  DepartmentHealthTable,
} from "./processes";
import {
  StandardizationSummary,
  AdoptionSummary,
  KPISummary,
  ImprovementSummary,
  OwnershipSummary,
} from "./summaries";
import { SystemHealthTrend, PeriodFilter } from "./trend";
import { useSnapshots } from "./use-snapshots";
import "./command-center.css";
export function CommandCenter() {
  const { data, error: systemError } = useSystem(),
    c = useMeasurement(),
    maps = useMaps(),
    analysis = useAnalysis(),
    standards = useStandards(),
    history = useSnapshots(),
    [period, setPeriod] = useState<Period>("all"),
    day = today(),
    ready = !!c.store && !!maps.store && !!analysis.store && !!standards.store,
    error =
      systemError || c.error || maps.error || analysis.error || standards.error;
  const report = useMemo(
    () => (ready ? commandReport(data, c.store!, c.evidence, day) : null),
    [data, c.store, maps.store, analysis.store, standards.store, day, ready],
  );
  const summaries = useMemo(
    () => (report ? operationalSummaries(report.rows, period, day) : null),
    [report, period, day],
  );
  if (!report || !summaries)
    return (
      <p role="status">
        {error || "در حال آماده‌سازی مرکز فرمان از داده‌های سیستم…"}
      </p>
    );
  return (
    <div className="command-center">
      {error && (
        <p role="alert" className="sys-alert">
          {error} — تا رفع خطای منبع، ثبت وضعیت غیرفعال است.
        </p>
      )}
      <SystemHealthHero report={report} />
      {!report.rows.length && (
        <p className="sys-alert">
          برای گزارش مدیریتی، ابتدا{" "}
          <Link href="/system/organization">واحدها و نقش‌ها</Link> و سپس{" "}
          <Link href="/system/processes">اولین فرآیند</Link> را ثبت کنید.
        </p>
      )}
      <SystemHealthBreakdown report={report} />
      <AttentionFeed report={report} />
      <MaturityFunnel report={report} />
      <details className="command-disclosure">
        <summary>ماتریس ریسک و فرآیندهای بحرانی</summary>
        <ProcessRiskMatrix report={report} />
        <h3>فرآیندهای بحرانی</h3>
        <CriticalProcessTable report={report} />
      </details>
      <details className="command-disclosure">
        <summary>سلامت واحدها</summary>
        <DepartmentHealthTable report={report} />
      </details>
      <details className="command-disclosure">
        <summary>استانداردها، پذیرش و عملکرد</summary>
        <StandardizationSummary
          summary={summaries.standard}
          total={report.rows.length}
        />
        <AdoptionSummary
          summary={summaries.adoption}
          average={
            report.health.components.find((x) => x.key === "adoption")!.value
          }
        />
        <KPISummary summary={summaries.kpis} report={report} />
      </details>
      <details className="command-disclosure">
        <summary>مالکیت و وابستگی بنیان‌گذار</summary>
        <OwnershipSummary report={report} founder={summaries.founder} />
      </details>
      <div className="command-period">
        <PeriodFilter value={period} onChange={setPeriod} />
        <p>
          این فیلتر فقط بر تاریخچه سلامت و اقدامات تکمیل‌شده اثر دارد؛ ریسک‌ها و
          امتیازهای بالا وضعیت فعلی‌اند.
        </p>
      </div>
      <details className="command-disclosure">
        <summary>اقدامات و انضباط بهبود</summary>
        <ImprovementSummary
          summary={summaries.improvements}
          score={
            report.health.components.find((x) => x.key === "improvement")!.value
          }
        />
      </details>
      <SystemHealthTrend
        report={report}
        history={history}
        period={period}
        disabled={!ready || !!error}
      />
    </div>
  );
}
