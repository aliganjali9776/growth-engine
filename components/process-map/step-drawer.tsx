"use client";
import { useState } from "react";
import { Drawer, Field, Button } from "@/components/system/ui";
import { useSystem } from "@/components/system/provider";
import { stepTypes, type ProcessStep } from "@/lib/system/maps/model";
import { stepOwner } from "@/lib/system/maps/logic";
import { founderLevels } from "@/lib/system/config";
export function StepDrawer({
  variant = "as-is",
  initial,
  isNew,
  onChange,
  onDelete,
  onClose,
}: {
  variant?: "as-is" | "to-be";
  initial: ProcessStep;
  isNew: boolean;
  onChange: (step: ProcessStep) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const { data } = useSystem();
  const [draft, setDraft] = useState(initial),
    [error, setError] = useState(""),
    [confirm, setConfirm] = useState(false);
  const { role, person } = stepOwner(data, draft);
  function change(patch: Partial<ProcessStep>) {
    const next = { ...draft, ...patch, updatedAt: new Date().toISOString() };
    setDraft(next);
    if (!isNew && next.title.trim()) {
      try {
        onChange(next);
        setError("");
      } catch {
        setError(
          "تغییر ذخیره نشد؛ وضعیت حافظه و پیام بالای صفحه را بررسی کنید.",
        );
      }
    }
  }
  function finish(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.title.trim()) {
      setError("عنوان مرحله را وارد کنید.");
      return;
    }
    try {
      onChange(draft);
      onClose();
    } catch {
      setError(
        "ذخیره ممکن نشد؛ پنل را باز نگه دارید و پیام حافظه را بررسی کنید.",
      );
    }
  }
  return (
    <Drawer
      open
      onClose={onClose}
      title={`${isNew ? "افزودن مرحله" : "جزئیات مرحله"}${variant === "to-be" ? " · TO-BE" : ""}`}
      description={
        isNew
          ? variant === "to-be"
            ? "مرحله‌ای از طراحی آینده انجام کار را ثبت کنید."
            : "مرحله‌ای از شیوه فعلی انجام کار را ثبت کنید."
          : "تغییرات معتبر بلافاصله روی نقشه و در این مرورگر ذخیره می‌شوند."
      }
    >
      <form className="sys-form" onSubmit={finish}>
        {variant === "to-be" && (
          <>
            <Field label="اقدام بهبود">
              <select
                value={draft.improvementAction ?? "none"}
                onChange={(e) =>
                  change({
                    improvementAction: e.target
                      .value as ProcessStep["improvementAction"],
                  })
                }
              >
                <option value="none">بدون برچسب</option>
                <option value="eliminate">حذف</option>
                <option value="simplify">ساده‌سازی</option>
                <option value="delegate">تفویض</option>
                <option value="automate">اتوماسیون</option>
              </select>
            </Field>
            <Field label="یادداشت بهبود">
              <textarea
                value={draft.improvementNote ?? ""}
                onChange={(e) => change({ improvementNote: e.target.value })}
              />
            </Field>
            <p className="map-caption">
              برچسب حذف، مرحله را حذف نمی‌کند؛ برای حذف واقعی از «حذف مرحله»
              استفاده کنید.
            </p>
          </>
        )}
        <Field label="عنوان مرحله">
          <input
            required
            value={draft.title}
            onChange={(e) => change({ title: e.target.value })}
          />
        </Field>
        <Field label="نوع مرحله">
          <select
            value={draft.type}
            onChange={(e) =>
              change({ type: e.target.value as ProcessStep["type"] })
            }
          >
            {Object.entries(stepTypes).map(([k, v]) => (
              <option value={k} key={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label="نقش مالک مرحله">
          <select
            value={draft.ownerRoleId ?? ""}
            onChange={(e) =>
              change({ ownerRoleId: e.target.value || undefined })
            }
          >
            <option value="">بدون مالک</option>
            {draft.ownerRoleId && !role && (
              <option value={draft.ownerRoleId}>
                نقش حذف‌شده؛ مالک جدید انتخاب کنید
              </option>
            )}
            {data.roles.map((r) => (
              <option value={r.id} key={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        </Field>
        <div className="sys-hint">
          فرد مسئول:{" "}
          {person
            ? `${person.name}${person.status === "archived" ? " (غیرفعال)" : ""}`
            : role
              ? "این نقش در حال حاضر بدون فرد است"
              : "ابتدا نقش مالک را انتخاب کنید"}
        </div>
        {role?.isFounderRole && (
          <p className="sys-alert">
            این مرحله مستقیماً به نقش بنیان‌گذار وابسته است. سطح دستی شما تغییر
            نمی‌کند؛ وابستگی نقش در شاخص‌ها لحاظ می‌شود.
          </p>
        )}
        <div className="sys-form-grid">
          {(["workTimeMinutes", "waitTimeMinutes"] as const).map((key) => (
            <Field
              key={key}
              label={
                key === "workTimeMinutes"
                  ? "زمان کار (دقیقه)"
                  : "زمان انتظار (دقیقه)"
              }
            >
              <input
                type="number"
                min="0"
                step="0.1"
                placeholder="ثبت نشده"
                value={draft[key] ?? ""}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "" || Number(value) >= 0)
                    change({ [key]: value === "" ? null : Number(value) });
                }}
              />
            </Field>
          ))}
        </div>
        <p className="map-caption">
          خالی یعنی ثبت نشده؛ صفر یعنی بدون زمان کار یا انتظار.
        </p>
        <Field label="وابستگی به بنیان‌گذار">
          <select
            value={draft.founderDependency}
            onChange={(e) =>
              change({
                founderDependency: e.target
                  .value as ProcessStep["founderDependency"],
              })
            }
          >
            {Object.entries(founderLevels).map(([k, v]) => (
              <option value={k} key={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <label className="sys-check">
          <input
            type="checkbox"
            checked={draft.handoff}
            onChange={(e) => change({ handoff: e.target.checked })}
          />
          این مرحله شامل تحویل مسئولیت است
        </label>
        <details className="map-advanced" open={!isNew}>
          <summary>توضیحات و داده‌های تکمیلی</summary>
          <Field label="توضیح">
            <textarea
              value={draft.description}
              onChange={(e) => change({ description: e.target.value })}
            />
          </Field>
          <Field label="ورودی">
            <textarea
              value={draft.input}
              onChange={(e) => change({ input: e.target.value })}
            />
          </Field>
          <Field label="خروجی">
            <textarea
              value={draft.output}
              onChange={(e) => change({ output: e.target.value })}
            />
          </Field>
          <Field label="احتمال بازکاری">
            <select
              value={draft.reworkProbability}
              onChange={(e) =>
                change({
                  reworkProbability: Number(
                    e.target.value,
                  ) as ProcessStep["reworkProbability"],
                })
              }
            >
              {[
                [0, "ندارد · ۰٪"],
                [25, "کم · ۲۵٪"],
                [50, "متوسط · ۵۰٪"],
                [75, "زیاد · ۷۵٪"],
                [100, "همیشه · ۱۰۰٪"],
              ].map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="یادداشت">
            <textarea
              value={draft.notes}
              onChange={(e) => change({ notes: e.target.value })}
            />
          </Field>
        </details>
        {error && (
          <p role="alert" className="sys-alert">
            {error}
          </p>
        )}
        <div className="sys-editor-actions">
          <Button type="submit">
            {isNew ? "افزودن به نقشه" : "ثبت و بستن"}
          </Button>
          {!isNew && (
            <Button secondary onClick={() => setConfirm(true)}>
              حذف مرحله
            </Button>
          )}
        </div>
        {confirm && (
          <div className="sys-alert">
            <p>مرحله و تمام اتصال‌های مربوط به آن حذف می‌شوند.</p>
            <Button
              onClick={() => {
                try {
                  onDelete();
                  onClose();
                } catch {
                  setError("حذف ذخیره نشد.");
                }
              }}
            >
              تأیید حذف مرحله
            </Button>
            <Button secondary onClick={() => setConfirm(false)}>
              انصراف
            </Button>
          </div>
        )}
      </form>
    </Drawer>
  );
}
