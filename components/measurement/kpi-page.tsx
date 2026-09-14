"use client";
import { useState } from "react";
import Link from "next/link";
import { Panel, Button } from "@/components/system/ui";
import {
  newKPI,
  newImprovement,
  today,
  directions,
  frequencies,
  type ProcessKPI,
  type KPIEntry,
  type ImprovementItem,
} from "@/lib/system/measurement/model";
import { kpiState, scoreLabel, kpiGap } from "@/lib/system/measurement/kpis";
import { processHealth } from "@/lib/system/measurement/health";
import {
  measurementReadiness,
  measuredCurrent,
} from "@/lib/system/measurement/readiness";
import { exampleKPIs } from "@/lib/system/measurement/example";
import { useMeasurement } from "./provider";
import {
  Workspace,
  ScoreCard,
  StageConfirmation,
  ConfirmButton,
  number,
} from "./shared";
import { KPIEditor } from "./kpi-editor";
import { KPIHistory, EntryEditor } from "./history";
import { ImprovementEditor } from "./improvement-editor";
export function KPIPage({ id }: { id: string }) {
  const c = useMeasurement(),
    r = c.record(id),
    e = c.evidence(id),
    health = processHealth(r, e, today()),
    ready = measurementReadiness(r, e),
    stage = e.system.processes.find((p) => p.id === id)?.systemizationStage,
    [editing, setEditing] = useState<ProcessKPI | null>(null),
    [entry, setEntry] = useState<KPIEntry | null>(null),
    [improvement, setImprovement] = useState<ImprovementItem | null>(null);
  return (
    <Workspace
      id={id}
      title="شاخص‌های عملکرد فرآیند"
      eyebrow="MEASURE · PERFORMANCE"
    >
      <div className="measurement-columns">
        <ScoreCard
          title="عملکرد وزنی KPI"
          score={health.kpi.score}
          label={scoreLabel(health.kpi.score)}
        >
          <ul>
            {health.kpi.issues.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </ScoreCard>
        <ScoreCard
          title="سلامت فرآیند"
          score={health.score}
          label={health.label}
          parts={health.parts}
        >
          <p>{health.interpretation}</p>
        </ScoreCard>
      </div>
      <Panel
        title="شاخص‌های فرآیند"
        action={
          <Button onClick={() => setEditing(newKPI(id))}>شاخص جدید</Button>
        }
      >
        <p>
          وزن خالی برای همه شاخص‌های فعال یعنی وزن برابر. مقدار فعلی از جدیدترین
          تاریخ دوره محاسبه می‌شود.
        </p>
        {id === "p6" && !r.kpis.length && (
          <ConfirmButton
            label="افزودن شاخص‌های نمونه آموزشی"
            description="چهار شاخص و تاریخچه آموزشی اضافه می‌شود؛ این داده‌ها عملکرد واقعی شرکت نیستند."
            onConfirm={() => c.save(exampleKPIs(r))}
          />
        )}
        <details>
          <summary>فرمول‌ها و تفسیر روند</summary>
          <p>
            افزایشی و کاهشی: ۱۰۰ × (مقدار فعلی − خط مبنا) ÷ (هدف − خط مبنا)،
            محدود به صفر تا صد. هدف باید در جهت شاخص باشد. حفظ سطح: داخل تلورانس
            ۱۰۰؛ بیرون آن، با هر یک تلورانس فاصله اضافی، ۱۰۰ امتیاز کم می‌شود.
            تلورانس صفر یعنی فقط مقدار دقیق هدف. بله/خیر: تطابق با هدف ۱۰۰ و
            خلاف آن صفر.
          </p>
          <p>
            روند از دو دوره آخر و جهت مطلوب محاسبه می‌شود؛ در حفظ سطح، فاصله
            خارج از تلورانس مقایسه می‌شود. این نمودار پیش‌بینی نیست.
          </p>
        </details>
      </Panel>
      {r.kpis.map((k) => {
        const s = kpiState(k, r.entries),
          gap = kpiGap(k, r.entries),
          duplicate = r.improvements.some(
            (x) => x.sourceKey === `kpi:${k.id}` && x.status !== "cancelled",
          );
        return (
          <Panel
            key={k.id}
            title={k.name}
            caption={`${directions[k.direction]} · ${frequencies[k.frequency]} · ${{ active: "فعال", draft: "پیش‌نویس", archived: "بایگانی" }[k.status]}`}
            action={
              <Button secondary onClick={() => setEditing(k)}>
                ویرایش شاخص
              </Button>
            }
          >
            <p>{k.description}</p>
            <div className="measurement-kpi-values">
              {[
                ["خط مبنا", k.baselineValue],
                ["هدف", k.targetValue],
                ["فعلی", s.current?.value],
                ["دوره قبل", s.previous?.value],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <span>{label}</span>
                  <strong>
                    {number(value as number | null)} <small>{k.unit}</small>
                  </strong>
                </div>
              ))}
            </div>
            <p>
              {scoreLabel(s.score)} · {number(s.score)} / ۱۰۰ · {s.trend} ·
              آخرین دوره: {s.current?.periodDate ?? "ثبت نشده"}
            </p>
            <div className="measurement-actions">
              <Button
                disabled={k.status === "archived"}
                onClick={() =>
                  setEntry({
                    id: crypto.randomUUID(),
                    kpiId: k.id,
                    processId: id,
                    periodDate: today(),
                    value: 0,
                    note: "",
                    confidence: "medium",
                    enteredAt: new Date().toISOString(),
                  })
                }
              >
                ثبت اندازه‌گیری
              </Button>
              {gap && k.status === "active" && (
                <Button
                  secondary
                  disabled={duplicate}
                  onClick={() =>
                    setImprovement({
                      ...newImprovement(id),
                      ...gap,
                      source: "kpi-gap",
                      ownerRoleId: k.ownerRoleId,
                    })
                  }
                >
                  {duplicate ? "اقدام شکاف قبلاً ثبت شده" : "ایجاد اقدام بهبود"}
                </Button>
              )}
            </div>
            <KPIHistory
              k={k}
              entries={r.entries}
              onEdit={setEntry}
              onDelete={(x) =>
                c.save({
                  ...r,
                  entries: r.entries.filter((y) => y.id !== x.id),
                })
              }
            />
            <ConfirmButton
              label="حذف شاخص"
              disabled={r.improvements.some((x) => x.relatedKpiId === k.id)}
              description="شاخص و تمام اندازه‌گیری‌های آن حذف می‌شوند. برای حفظ سابقه، به جای حذف از وضعیت بایگانی استفاده کنید."
              onConfirm={() =>
                c.save({
                  ...r,
                  kpis: r.kpis.filter((x) => x.id !== k.id),
                  entries: r.entries.filter((x) => x.kpiId !== k.id),
                })
              }
            />
            {r.improvements.some((x) => x.relatedKpiId === k.id) && <p>این شاخص به اقدام بهبود مرتبط است؛ برای حفظ سابقه، از «ویرایش شاخص» وضعیت آن را بایگانی کنید.</p>}
          </Panel>
        );
      })}
      <StageConfirmation
        id={id}
        kind="measured"
        issues={ready.issues}
        current={measuredCurrent(r, e)}
        allowed={["implemented", "measured", "improving"].includes(stage ?? "")}
      />
      {r.measuredAt && (
        <p>
          زمان تأیید اندازه‌گیری:{" "}
          {new Date(r.measuredAt).toLocaleString("fa-IR", { timeZone: "Asia/Tehran" })}
        </p>
      )}
      <Link className="sys-text-link" href={`/system/processes/${id}/review`}>
        مرور هفتگی و تصمیم‌های تیم
      </Link>
      {editing && (
        <KPIEditor
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={(k) =>
            c.save({ ...r, kpis: [...r.kpis.filter((x) => x.id !== k.id), k] })
          }
        />
      )}{" "}
      {entry && (
        <EntryEditor
          initial={entry}
          binary={
            r.kpis.find((k) => k.id === entry.kpiId)?.direction === "binary"
          }
          onClose={() => setEntry(null)}
          onSave={(x) =>
            c.save({
              ...r,
              entries: [...r.entries.filter((y) => y.id !== x.id), x],
            })
          }
        />
      )}{" "}
      {improvement && (
        <ImprovementEditor
          initial={improvement}
          onClose={() => setImprovement(null)}
          onSave={(x) => c.save({ ...r, improvements: [...r.improvements, x] })}
        />
      )}
    </Workspace>
  );
}
