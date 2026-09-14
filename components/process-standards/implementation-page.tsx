"use client";
import { useState } from "react";
import Link from "next/link";
import { Panel, Button, Field } from "@/components/system/ui";
import { useSystem } from "@/components/system/provider";
import { useStandards } from "./provider";
import { RoleField, ConfirmAction, ProgressPanel } from "./shared";
import { ProcessNav } from "@/components/process-analysis/shared";
import {
  implementation,
  implementedCurrent,
} from "@/lib/system/standards/logic";
import {
  trainingStatuses,
  pilotStatuses,
  type ImplementationPlan,
} from "@/lib/system/standards/model";
import "./standards.css";
function PlanEditor({
  initial,
  onSave,
}: {
  initial: ImplementationPlan;
  onSave: (p: ImplementationPlan) => void;
}) {
  const [p, set] = useState(initial),
    [error, setError] = useState(""),
    { data } = useSystem();
  const field = <K extends keyof ImplementationPlan>(
    k: K,
    v: ImplementationPlan[K],
  ) => set({ ...p, [k]: v });
  const toggle = (
    k:
      | "ownerConfirmed"
      | "teamBriefed"
      | "toolsReady"
      | "templatesRequired"
      | "templatesReady"
      | "trainingRequired"
      | "pilotRequired"
      | "pilotFeedbackReviewed",
    label: string,
  ) => (
    <label className="standard-toggle">
      <input
        type="checkbox"
        checked={p[k]}
        onChange={(e) => field(k, e.target.checked)}
      />
      {label}
    </label>
  );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        try {
          onSave({ ...p, updatedAt: new Date().toISOString() });
          setError("");
        } catch (e) {
          setError(e instanceof Error ? e.message : "ذخیره نشد");
        }
      }}
    >
      <Panel title="برنامه و مسئولیت اجرا">
        <div className="standard-grid">
          <RoleField
            label="مالک پیاده‌سازی"
            value={p.implementationOwnerRoleId}
            onChange={(v) => field("implementationOwnerRoleId", v)}
          />
          <Field label="تاریخ هدف شروع اجرا">
            <input
              type="date"
              value={p.targetGoLiveDate}
              onChange={(e) => field("targetGoLiveDate", e.target.value)}
            />
          </Field>
        </div>
        {toggle("ownerConfirmed", "مالک مسئولیت اجرا را تأیید کرده است")}
        {toggle("teamBriefed", "تیم توجیه شده است")}
        {toggle("toolsReady", "ابزارهای اجرا آماده‌اند")}
        {toggle("templatesRequired", "قالب و دارایی لازم است")}
        {toggle("templatesReady", "قالب‌های لازم آماده‌اند")}
      </Panel>
      <Panel title="آموزش و تأیید مطالعه SOP">
        {toggle("trainingRequired", "آموزش الزامی است")}
        <Field label="وضعیت آموزش">
          <select
            value={p.trainingStatus}
            onChange={(e) =>
              field(
                "trainingStatus",
                e.target.value as ImplementationPlan["trainingStatus"],
              )
            }
          >
            {Object.entries(trainingStatuses).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <p>نقش‌های مشمول را انتخاب کنید. تأیید مطالعه، ثبت دستی است.</p>
        {data.roles.map((role) => {
          const selected = p.roles.find((x) => x.roleId === role.id);
          return (
            <div className="standard-library-row" key={role.id}>
              <label>
                <input
                  type="checkbox"
                  checked={!!selected}
                  onChange={(e) =>
                    field(
                      "roles",
                      e.target.checked
                        ? [
                            ...p.roles,
                            {
                              roleId: role.id,
                              trained: false,
                              acknowledged: false,
                            },
                          ]
                        : p.roles.filter((x) => x.roleId !== role.id),
                    )
                  }
                />
                {role.title}
              </label>
              {selected && (
                <>
                  <label>
                    <input
                      type="checkbox"
                      checked={selected.trained}
                      onChange={(e) =>
                        field(
                          "roles",
                          p.roles.map((x) =>
                            x.roleId === role.id
                              ? { ...x, trained: e.target.checked }
                              : x,
                          ),
                        )
                      }
                    />
                    آموزش دیده
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={selected.acknowledged}
                      onChange={(e) =>
                        field(
                          "roles",
                          p.roles.map((x) =>
                            x.roleId === role.id
                              ? { ...x, acknowledged: e.target.checked }
                              : x,
                          ),
                        )
                      }
                    />
                    SOP مطالعه شده
                  </label>
                </>
              )}
            </div>
          );
        })}
      </Panel>
      <Panel title="اجرای آزمایشی — پایلوت">
        {toggle("pilotRequired", "پایلوت الزامی است")}
        <div className="standard-grid">
          <RoleField
            label="مالک پایلوت"
            value={p.pilotOwnerRoleId}
            onChange={(v) => field("pilotOwnerRoleId", v)}
          />
          <Field label="وضعیت پایلوت">
            <select
              value={p.pilotStatus}
              onChange={(e) =>
                field(
                  "pilotStatus",
                  e.target.value as ImplementationPlan["pilotStatus"],
                )
              }
            >
              {Object.entries(pilotStatuses).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="شروع پایلوت">
            <input
              type="date"
              value={p.pilotStartDate}
              onChange={(e) => field("pilotStartDate", e.target.value)}
            />
          </Field>
          <Field label="پایان پایلوت">
            <input
              type="date"
              min={p.pilotStartDate}
              value={p.pilotEndDate}
              onChange={(e) => field("pilotEndDate", e.target.value)}
            />
          </Field>
        </div>
        {(["pilotNotes", "pilotIssues", "pilotOutcome", "notes"] as const).map(
          (k, i) => (
            <Field
              key={k}
              label={
                [
                  "یادداشت پایلوت",
                  "مشکلات مشاهده‌شده",
                  "نتیجه پایلوت",
                  "یادداشت برنامه",
                ][i]
              }
            >
              <textarea
                value={p[k]}
                onChange={(e) => field(k, e.target.value)}
              />
            </Field>
          ),
        )}
        {toggle("pilotFeedbackReviewed", "بازخورد پایلوت بررسی شده است")}
      </Panel>
      <Button type="submit">ذخیره برنامه اجرا</Button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
export function ImplementationPage({ id }: { id: string }) {
  const c = useStandards(),
    src = c.source(id),
    r = c.store?.records.find((r) => r.processId === id);
  if (!r || !src)
    return (
      <Panel title="برنامه پیاده‌سازی">
        <p>{c.error || "ابتدا استاندارد اجرایی را ایجاد کنید."}</p>
        <Link href={`/system/processes/${id}/standardize`}>استانداردسازی</Link>
      </Panel>
    );
  const m = implementation(r, src);
  return (
    <div className="standards-workspace">
      <ProcessNav id={id} />
      <header className="standard-heading">
        <span>IMPLEMENTATION · ADOPTION</span>
        <h1>پیاده‌سازی و پذیرش</h1>
        <p>{m.interpretation}</p>
        <small role="status">{c.status}</small>
      </header>
      {c.error && <p role="alert">{c.error}</p>}
      <ProgressPanel
        score={m.score}
        components={m.components}
        label={m.status}
      />
      <p>
        شاخص داخلی بر اساس ثبت دستی آمادگی و تأییدهاست؛ اثبات استفاده واقعی یا
        پایدار نیست.
      </p>
      <PlanEditor
        key={r.plan.updatedAt}
        initial={r.plan}
        onSave={(plan) => c.save({ ...r, plan })}
      />
      <Panel title="آمادگی شروع اجرا">
        <p>
          وضعیت:{" "}
          {r.plan.goLiveStatus === "live"
            ? "Live"
            : r.plan.goLiveStatus === "paused"
              ? "متوقف"
              : m.goLiveReady
                ? "آماده شروع"
                : "آماده نیست"}
        </p>
        <ul>
          {m.risks.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
        <ConfirmAction
          id={id}
          action="live"
          label="تأیید شروع اجرا (Go-Live)"
          disabled={!m.goLiveReady || r.plan.goLiveStatus === "live"}
        />
        {r.plan.goLiveStatus === "live" && (
          <Button
            secondary
            onClick={() =>
              c.save({
                ...r,
                plan: {
                  ...r.plan,
                  goLiveStatus: "paused",
                  updatedAt: new Date().toISOString(),
                },
              })
            }
          >
            توقف اجرا
          </Button>
        )}
        <ConfirmAction
          id={id}
          action="implement"
          label="تأیید پیاده‌سازی"
          disabled={!m.ready || implementedCurrent(r, src)}
        />
        {implementedCurrent(r, src) && (
          <p>
            پیاده‌سازی تأیید شده ·{" "}
            {new Date(r.implementedAt!).toLocaleString("fa-IR", { timeZone: "Asia/Tehran" })}
          </p>
        )}
      </Panel>
    </div>
  );
}
