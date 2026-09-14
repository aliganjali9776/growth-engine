"use client";
import { useState } from "react";
import { Drawer, Field, Button } from "@/components/system/ui";
import { RoleField } from "@/components/process-standards/shared";
import {
  improvementSources,
  improvementStatuses,
  type ImprovementItem,
} from "@/lib/system/measurement/model";
import { useMeasurement } from "./provider";
export function ImprovementEditor({
  initial,
  onSave,
  onClose,
}: {
  initial: ImprovementItem;
  onSave: (x: ImprovementItem) => void;
  onClose: () => void;
}) {
  const [x, set] = useState(initial),
    [error, setError] = useState(""),
    c = useMeasurement(),
    e = c.evidence(x.processId),
    record = c.record(x.processId),
    map = e.source?.analysis.toBe ?? e.asis,
    field = <K extends keyof ImprovementItem>(k: K, v: ImprovementItem[K]) =>
      set({ ...x, [k]: v });
  return (
    <Drawer
      open
      onClose={onClose}
      title="اقدام بهبود"
      description="پیشنهادها فقط پس از ذخیره شما به اقدام تبدیل می‌شوند؛ نتیجه مورد انتظار از نتیجه واقعی جداست."
    >
      <form
        className="sys-form"
        onSubmit={(event) => {
          event.preventDefault();
          try {
            if (
              ["planned", "in-progress", "completed"].includes(x.status) &&
              !e.system.roles.some((r) => r.id === x.ownerRoleId)
            )
              throw new Error(
                "برای اقدام فعال یا تکمیل‌شده مالک معتبر لازم است.",
              );
            if (
              x.sourceKey &&
              record.improvements.some(
                (y) =>
                  y.id !== x.id &&
                  y.sourceKey === x.sourceKey &&
                  y.status !== "cancelled",
              )
            )
              throw new Error(
                "این پیشنهاد قبلاً به اقدام تبدیل شده است؛ همان اقدام را ویرایش کنید.",
              );
            onSave({
              ...x,
              completedAt:
                x.status === "completed"
                  ? (x.completedAt ?? new Date().toISOString())
                  : undefined,
            });
            onClose();
          } catch (e) {
            setError(e instanceof Error ? e.message : "ذخیره نشد.");
          }
        }}
      >
        {(
          [
            "title",
            "description",
            "expectedImpact",
            "actualImpact",
            "notes",
          ] as const
        ).map((k, i) => (
          <Field
            key={k}
            label={
              [
                "عنوان اقدام",
                "شرح اقدام",
                "اثر مورد انتظار",
                "اثر واقعی مشاهده‌شده",
                "یادداشت اقدام",
              ][i]
            }
          >
            {k === "title" ? (
              <input
                required
                value={x[k]}
                onChange={(e) => field(k, e.target.value)}
              />
            ) : (
              <textarea
                value={x[k]}
                onChange={(e) => field(k, e.target.value)}
              />
            )}
          </Field>
        ))}
        <RoleField
          label="مالک اقدام"
          value={x.ownerRoleId}
          onChange={(v) => field("ownerRoleId", v)}
        />
        <Field label="منبع اقدام">
          <select
            value={x.source}
            onChange={(e) =>
              field("source", e.target.value as ImprovementItem["source"])
            }
          >
            {Object.entries(improvementSources).map(([k, v]) => (
              <option value={k} key={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label="مرحله مرتبط">
          <select
            value={x.relatedStepId}
            onChange={(e) => field("relatedStepId", e.target.value)}
          >
            <option value="">کل فرآیند</option>
            {x.relatedStepId &&
              !map?.steps.some((s) => s.id === x.relatedStepId) && (
                <option value={x.relatedStepId}>
                  مرحله منبع قدیمی / حذف‌شده
                </option>
              )}
            {map?.steps.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="شاخص مرتبط">
          <select
            value={x.relatedKpiId}
            onChange={(e) => field("relatedKpiId", e.target.value)}
          >
            <option value="">بدون شاخص</option>
            {record.kpis.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="اولویت اقدام">
          <select
            value={x.priority}
            onChange={(e) =>
              field("priority", e.target.value as ImprovementItem["priority"])
            }
          >
            {Object.entries({
              critical: "بحرانی",
              high: "زیاد",
              medium: "متوسط",
              low: "کم",
            }).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label="وضعیت اقدام">
          <select
            value={x.status}
            onChange={(e) =>
              field("status", e.target.value as ImprovementItem["status"])
            }
          >
            {Object.entries(improvementStatuses).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label="موعد اقدام">
          <input
            type="date"
            value={x.dueDate}
            onChange={(e) => field("dueDate", e.target.value)}
          />
        </Field>
        <Button type="submit">ذخیره اقدام بهبود</Button>
        {error && <p role="alert">{error}</p>}
      </form>
    </Drawer>
  );
}
