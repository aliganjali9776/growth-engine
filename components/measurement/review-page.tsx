"use client";
import { useState } from "react";
import { Panel, Button, Drawer, Field } from "@/components/system/ui";
import { RoleField, LinesField } from "@/components/process-standards/shared";
import {
  today,
  reviewHasContent,
  type ProcessReview,
} from "@/lib/system/measurement/model";
import { processHealth } from "@/lib/system/measurement/health";
import { kpiState } from "@/lib/system/measurement/kpis";
import { useMeasurement } from "./provider";
import { Workspace, ConfirmButton, number } from "./shared";
export function ReviewPage({ id }: { id: string }) {
  const c = useMeasurement(),
    r = c.record(id),
    e = c.evidence(id),
    health = processHealth(r, e, today()),
    [editing, set] = useState<ProcessReview | null>(null);
  return (
    <Workspace
      id={id}
      title="مرور هفتگی فرآیند"
      eyebrow="WEEKLY REVIEW · DECISIONS"
    >
      <Panel title="داده‌های فعلی برای مرور">
        <p>
          عملکرد KPI: {number(health.kpi.score)} · استقلال بنیان‌گذار:{" "}
          {number(health.founder.score)} · اقدامات باز:{" "}
          {number(health.discipline.open.length)} · عقب‌افتاده:{" "}
          {number(health.discipline.overdue.length)}
        </p>
        <ul>
          {health.kpi.active.map((k) => (
            <li key={k.id}>
              {k.name}: {kpiState(k, r.entries).trend}
            </li>
          ))}
        </ul>
        <p>
          این خلاصه از داده‌های فعلی است؛ یادداشت‌های مرور زیر، ثبت تاریخی دستی
          تیم هستند.
        </p>
      </Panel>
      <Panel
        title="مرورهای ثبت‌شده"
        action={
          <Button
            onClick={() =>
              set({
                id: crypto.randomUUID(),
                processId: id,
                periodStart: today(),
                periodEnd: today(),
                summary: "",
                wins: [],
                problems: [],
                blockers: [],
                decisions: [],
                nextActions: [],
                founderChanges: "",
                reviewedByRoleId: "",
                createdAt: new Date().toISOString(),
              })
            }
          >
            مرور هفتگی جدید
          </Button>
        }
      >
        {[...r.reviews]
          .sort((a, b) => b.periodEnd.localeCompare(a.periodEnd))
          .map((x) => (
            <article className="measurement-review" key={x.id}>
              <h3>
                {x.periodStart} تا {x.periodEnd}
              </h3>
              <p>{x.summary}</p>
              {(
                [
                  "wins",
                  "problems",
                  "blockers",
                  "decisions",
                  "nextActions",
                ] as const
              ).map((k, i) => (
                <div key={k}>
                  <strong>
                    {
                      [
                        "بهبودها",
                        "افت‌ها و مسائل",
                        "موانع جدید",
                        "تصمیم‌های لازم",
                        "تمرکز هفته بعد",
                      ][i]
                    }
                  </strong>
                  <ul>
                    {x[k].filter(Boolean).map((v, j) => (
                      <li key={j}>{v}</li>
                    ))}
                  </ul>
                </div>
              ))}
              <p>
                تغییر وابستگی بنیان‌گذار: {x.founderChanges || "ثبت نشده"} ·
                مرورکننده:{" "}
                {e.system.roles.find((y) => y.id === x.reviewedByRoleId)
                  ?.title ?? "نامعتبر"}
              </p>
              <Button secondary onClick={() => set(x)}>
                ویرایش مرور
              </Button>
              <ConfirmButton
                label="حذف مرور"
                onConfirm={() =>
                  c.save({
                    ...r,
                    reviews: r.reviews.filter((y) => y.id !== x.id),
                  })
                }
              />
            </article>
          ))}
        {!r.reviews.length && <p>مروری ثبت نشده است.</p>}
      </Panel>
      {editing && (
        <ReviewEditor
          initial={editing}
          onClose={() => set(null)}
          onSave={(x) =>
            c.save({
              ...r,
              reviews: [...r.reviews.filter((y) => y.id !== x.id), x],
            })
          }
        />
      )}
    </Workspace>
  );
}
function ReviewEditor({
  initial,
  onSave,
  onClose,
}: {
  initial: ProcessReview;
  onSave: (x: ProcessReview) => void;
  onClose: () => void;
}) {
  const [x, set] = useState(initial),
    [error, setError] = useState(""),
    c = useMeasurement();
  return (
    <Drawer
      open
      onClose={onClose}
      title="مرور هفتگی"
      description="مشاهدات، تصمیم‌ها و تمرکز هفته بعد را خود تیم ثبت می‌کند."
    >
      <form
        className="sys-form"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            if (!reviewHasContent(x))
              throw new Error("خلاصه یا حداقل یک مشاهده و تصمیم را ثبت کنید.");
            if (
              !c
                .evidence(x.processId)
                .system.roles.some((r) => r.id === x.reviewedByRoleId)
            )
              throw new Error("نقش مرورکننده لازم است.");
            onSave(x);
            onClose();
          } catch (e) {
            setError(e instanceof Error ? e.message : "ذخیره نشد.");
          }
        }}
      >
        <Field label="شروع دوره مرور">
          <input
            required
            type="date"
            max={today()}
            value={x.periodStart}
            onChange={(e) => set({ ...x, periodStart: e.target.value })}
          />
        </Field>
        <Field label="پایان دوره مرور">
          <input
            required
            type="date"
            min={x.periodStart}
            max={today()}
            value={x.periodEnd}
            onChange={(e) => set({ ...x, periodEnd: e.target.value })}
          />
        </Field>
        <RoleField
          label="نقش مرورکننده"
          value={x.reviewedByRoleId}
          onChange={(v) => set({ ...x, reviewedByRoleId: v })}
        />
        <Field label="خلاصه مرور">
          <textarea
            value={x.summary}
            onChange={(e) => set({ ...x, summary: e.target.value })}
          />
        </Field>
        {(
          ["wins", "problems", "blockers", "decisions", "nextActions"] as const
        ).map((k, i) => (
          <LinesField
            key={k}
            label={
              [
                "چه چیزی بهتر شد؟",
                "چه چیزی افت کرد؟",
                "موانع جدید",
                "تصمیم‌های لازم",
                "تمرکز هفته بعد",
              ][i]
            }
            values={x[k]}
            onChange={(v) => set({ ...x, [k]: v })}
          />
        ))}
        <Field label="تغییر وابستگی بنیان‌گذار">
          <textarea
            value={x.founderChanges}
            onChange={(e) => set({ ...x, founderChanges: e.target.value })}
          />
        </Field>
        <Button type="submit">ذخیره مرور هفتگی</Button>
        {error && <p role="alert">{error}</p>}
      </form>
    </Drawer>
  );
}
