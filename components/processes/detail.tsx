"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LockKeyhole, ArrowRight } from "lucide-react";
import { useSystem } from "@/components/system/provider";
import { PageTitle, Panel, Badge, Button, Empty } from "@/components/system/ui";
import {
  ownerOf,
  effectiveFounder,
  isSampleProcess,
} from "@/lib/system/selectors";
import {
  stages,
  stageKeys,
  founderLevels,
  documentation,
  faNumber as fa,
} from "@/lib/system/config";
import { ProcessEditor } from "./editor";
import { StageControl } from "./process-card";
import { ProcessMapSummary } from "@/components/process-map/summary";
import { AnalysisSummary } from "@/components/process-analysis/detail-summary";
import { StandardSummary } from "@/components/process-standards/summary";
import { MeasurementSummary } from "@/components/measurement/summary";
import { useStandards } from "@/components/process-standards/provider";
import { effectiveSOPStatus } from "@/lib/system/standards/logic";
import { sopStatuses } from "@/lib/system/standards/model";
export function ProcessDetail({ id }: { id: string }) {
  const { data } = useSystem();
  const standards = useStandards(),
    standard = standards.store?.records.find((r) => r.processId === id),
    source = standards.source(id);
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const p = data.processes.find((x) => x.id === id);
  if (!p)
    return (
      <Panel title="فرآیند پیدا نشد">
        <Empty>
          این فرآیند در داده‌های همین مرورگر وجود ندارد یا حذف شده است.
        </Empty>
        <Link href="/system/processes" className="sys-text-link">
          بازگشت به فرآیندها
        </Link>
      </Panel>
    );
  const { role, person } = ownerOf(data, p);
  return (
    <>
      <Link href="/system/processes" className="sys-text-link">
        <ArrowRight size={15} />
        فهرست فرآیندها
      </Link>
      <PageTitle
        title={p.name}
        description={`${p.code} · ${p.status === "active" ? "فرآیند فعال" : "فرآیند بایگانی‌شده"}`}
        onAdd={() => setEditing(true)}
        addLabel="ویرایش فرآیند"
      />
      <div className="sys-two">
        {isSampleProcess(p) && (
          <p className="sys-alert">
            داده نمونه قابل ویرایش؛ وضعیت‌ها و شواهد را پیش از استفاده مدیریتی
            با واقعیت شرکت تطبیق دهید.
          </p>
        )}
        <Panel
          title="شناسنامه فرآیند"
          action={<Badge level={p.priorityLevel} />}
        >
          <p className="sys-description">
            {p.description || "شرحی ثبت نشده است."}
          </p>
          <dl className="sys-details">
            {[
              ["کد فرآیند", p.code],
              [
                "واحد",
                data.departments.find((d) => d.id === p.departmentId)?.name,
              ],
              ["نقش مالک", role?.title ?? "بدون مالک"],
              ["فرد مسئول", person?.name ?? "بدون متصدی"],
              ["زنجیره ارزش", p.valueChain],
              ["مرحله", stages[p.systemizationStage]],
              [
                "دستورالعمل اجرایی",
                standard?.sop && source
                  ? sopStatuses[effectiveSOPStatus(standard, source)]
                  : "ثبت نشده",
              ],
              [
                "وابستگی مؤثر بنیان‌گذار",
                founderLevels[effectiveFounder(data, p)],
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          {role?.isFounderRole && (
            <p className="sys-hint">
              وابستگی بحرانی به دلیل مالکیت نقش بنیان‌گذار؛ سطح ثبت‌شده دستی:{" "}
              {founderLevels[p.founderDependency]}
            </p>
          )}
        </Panel>
        <Panel title="اولویت سیستم‌سازی" caption="اثر + تنوع + وابستگی + تکرار">
          <div className="sys-priority-number">
            <strong>{fa(p.priorityScore)}</strong>
            <span>از ۱۲</span>
          </div>
          <div className="sys-rating-grid">
            {[
              ["اثر", p.impact],
              ["تنوع", p.variation],
              ["وابستگی", p.dependency],
              ["تکرار", p.frequency],
            ].map(([label, n]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{fa(Number(n))}</strong>
              </div>
            ))}
          </div>
          <p className="sys-hint">
            ۴–۵ پایین · ۶–۷ متوسط · ۸–۹ بالا · ۱۰–۱۲ بحرانی
          </p>
        </Panel>
      </div>
      <Panel
        title="مسیر سیستم‌سازی"
        caption="مرحله فعلی بر اساس ثبت دستی تیم نمایش داده می‌شود."
      >
        <ol className="sys-journey">
          {stageKeys.map((s, i) => (
            <li
              key={s}
              className={
                i === stageKeys.indexOf(p.systemizationStage)
                  ? "current"
                  : i < stageKeys.indexOf(p.systemizationStage)
                    ? "past"
                    : ""
              }
              aria-current={s === p.systemizationStage ? "step" : undefined}
            >
              <span>{fa(i + 1)}</span>
              <strong>{stages[s]}</strong>
            </li>
          ))}
        </ol>
        <StageControl key={p.systemizationStage} process={p} />
      </Panel>
      <ProcessMapSummary id={id} />
      <AnalysisSummary id={id} />
      <StandardSummary id={id} />
      <MeasurementSummary id={id} />
      <Panel title="یادداشت‌های فرآیند">
        <p className="sys-notes">{p.notes || "هنوز یادداشتی ثبت نشده است."}</p>
      </Panel>
      {editing && (
        <ProcessEditor
          initial={p}
          onClose={() => setEditing(false)}
          onDeleted={() => router.push("/system/processes")}
        />
      )}
    </>
  );
}
