"use client";
import { useState } from "react";
import Link from "next/link";
import { Panel, Button, Field } from "@/components/system/ui";
import {
  newImprovement,
  today,
  improvementStatuses,
  improvementSources,
  type ImprovementItem,
} from "@/lib/system/measurement/model";
import {
  improvementDiscipline,
  overdue,
} from "@/lib/system/measurement/health";
import {
  improvingReadiness,
  improvingCurrent,
} from "@/lib/system/measurement/readiness";
import { useMeasurement } from "./provider";
import {
  Workspace,
  ScoreCard,
  StageConfirmation,
  ConfirmButton,
  number,
} from "./shared";
import { ImprovementEditor } from "./improvement-editor";
export function ImprovementsPage({ id }: { id: string }) {
  const c = useMeasurement(),
    r = c.record(id),
    e = c.evidence(id),
    d = improvementDiscipline(r, e, today()),
    ready = improvingReadiness(r, e),
    stage = e.system.processes.find((x) => x.id === id)?.systemizationStage,
    [editing, set] = useState<ImprovementItem | null>(null),
    [filter, setFilter] = useState("all");
  return (
    <Workspace
      id={id}
      title="دفتر بهبود فرآیند"
      eyebrow="IMPROVE · CONTINUOUS REVIEW"
    >
      <ScoreCard
        title="انضباط بهبود"
        score={d.score}
        label={`${number(d.open.length)} باز · ${number(d.overdue.length)} عقب‌افتاده · ${number(d.completed.length)} تکمیل‌شده`}
        parts={d.parts}
      >
        <p>
          بررسی اخیر، مالک، موعد، نسبت عدم تأخیر و تکمیل اقدامات؛ موفقیت KPI شرط
          ورود به بهبود نیست.
        </p>
      </ScoreCard>
      <Panel
        title="اقدامات بهبود"
        action={
          <Button onClick={() => set(newImprovement(id))}>اقدام جدید</Button>
        }
      >
        <Field label="فیلتر وضعیت اقدام">
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">همه</option>
            <option value="overdue">عقب‌افتاده</option>
            {Object.entries(improvementStatuses).map(([k, v]) => (
              <option value={k} key={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        {r.improvements
          .filter(
            (x) =>
              filter === "all" ||
              (filter === "overdue"
                ? overdue(x, today())
                : x.status === filter),
          )
          .map((x) => (
            <article className="measurement-review" key={x.id}>
              <div className="measurement-actions">
                <h3>{x.title}</h3>
                <span className={`sys-badge ${x.priority}`}>
                  {
                    {
                      critical: "بحرانی",
                      high: "زیاد",
                      medium: "متوسط",
                      low: "کم",
                    }[x.priority]
                  }
                </span>
              </div>
              <p>{x.description}</p>
              <p>
                {improvementStatuses[x.status]} · {improvementSources[x.source]}{" "}
                · مالک:{" "}
                {e.system.roles.find((y) => y.id === x.ownerRoleId)?.title ??
                  "تعیین نشده"}{" "}
                · موعد: {x.dueDate || "تعیین نشده"}
              </p>
              {overdue(x, today()) && (
                <p className="sys-alert">اقدام عقب‌افتاده است.</p>
              )}
              <p>
                اثر مورد انتظار: {x.expectedImpact || "ثبت نشده"}
                <br />
                اثر واقعی: {x.actualImpact || "ثبت نشده"}
              </p>
              {x.relatedKpiId && (
                <Link href={`/system/processes/${id}/kpis`}>
                  شاخص مرتبط:{" "}
                  {r.kpis.find((k) => k.id === x.relatedKpiId)?.name}
                </Link>
              )}
              <p>{x.notes}</p>
              {x.completedAt && (
                <small>
                  تکمیل: {new Date(x.completedAt).toLocaleString("fa-IR", { timeZone: "Asia/Tehran" })}
                </small>
              )}
              <div className="measurement-actions">
                <Button secondary onClick={() => set(x)}>
                  ویرایش اقدام
                </Button>
                <ConfirmButton
                  label="حذف اقدام"
                  onConfirm={() =>
                    c.save({
                      ...r,
                      improvements: r.improvements.filter((y) => y.id !== x.id),
                    })
                  }
                />
              </div>
            </article>
          ))}
        {!r.improvements.length && (
          <p>
            هنوز اقدامی ثبت نشده است. از شکاف KPI یا یافته تحلیل نیز می‌توانید
            اقدام بسازید.
          </p>
        )}
      </Panel>
      <Link href={`/system/processes/${id}/review`} className="sys-text-link">
        ثبت مرور هفتگی
      </Link>
      <StageConfirmation
        id={id}
        kind="improving"
        issues={ready.issues}
        current={improvingCurrent(r, e)}
        allowed={["measured", "improving"].includes(stage ?? "")}
      />
      {r.improvingAt && (
        <p>
          تأیید چرخه بهبود: {new Date(r.improvingAt).toLocaleString("fa-IR", { timeZone: "Asia/Tehran" })}
        </p>
      )}
      {editing && (
        <ImprovementEditor
          initial={editing}
          onClose={() => set(null)}
          onSave={(x) =>
            c.save({
              ...r,
              improvements: [...r.improvements.filter((y) => y.id !== x.id), x],
            })
          }
        />
      )}
    </Workspace>
  );
}
export function FindingImprovement({
  processId,
  stepId,
  findingId,
  title,
  reason,
  benefit,
}: {
  processId: string;
  stepId: string;
  findingId: string;
  title: string;
  reason: string;
  benefit: string;
}) {
  const c = useMeasurement(),
    r = c.record(processId),
    [editing, set] = useState<ImprovementItem | null>(null),
    sourceKey = `analysis:${findingId}`,
    exists = r.improvements.some(
      (x) => x.sourceKey === sourceKey && x.status !== "cancelled",
    );
  return (
    <>
      <Button
        secondary
        disabled={!c.store || exists}
        onClick={() =>
          set({
            ...newImprovement(processId),
            title,
            description: reason,
            expectedImpact: benefit,
            relatedStepId: stepId,
            source: "analysis",
            sourceKey,
            priority: "high",
          })
        }
      >
        {exists ? "اقدام این یافته ثبت شده" : "تبدیل به اقدام بهبود"}
      </Button>
      {editing && (
        <ImprovementEditor
          initial={editing}
          onClose={() => set(null)}
          onSave={(x) => c.save({ ...r, improvements: [...r.improvements, x] })}
        />
      )}
    </>
  );
}
