"use client";
import { useState } from "react";
import { useSystem } from "@/components/system/provider";
import { Drawer, Field, Badge } from "@/components/system/ui";
import { EditorActions } from "@/components/organization/editors";
import {
  saveEntity,
  deleteEntity,
  nextProcessCode,
} from "@/lib/system/actions";
import { calculatePriority } from "@/lib/system/scoring";
import {
  valueChains,
  founderLevels,
  stages,
  documentation,
  faNumber as fa,
} from "@/lib/system/config";
import { effectiveFounder } from "@/lib/system/selectors";
import type { Process, Rating } from "@/lib/system/types";
export function ProcessEditor({
  initial,
  onClose,
  onDeleted,
}: {
  initial?: Process;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const { data, commit } = useSystem();
  const [p, set] = useState<Process>(
    () =>
      initial ?? {
        id: crypto.randomUUID(),
        code: nextProcessCode(data),
        name: "",
        description: "",
        valueChain: valueChains[0],
        departmentId: "",
        ownerRoleId: "",
        frequency: 1,
        impact: 1,
        variation: 1,
        dependency: 1,
        priorityScore: 4,
        priorityLevel: "low",
        founderDependency: "none",
        status: "active",
        systemizationStage: "identified",
        documentationStatus: "none",
        adoptionStatus: "not-started",
        notes: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
  );
  const [error, setError] = useState("");
  const score = calculatePriority(p),
    role = data.roles.find((r) => r.id === p.ownerRoleId),
    person = data.people.find((u) => u.id === role?.personId);
  return (
    <Drawer
      open
      onClose={onClose}
      title={initial ? "ویرایش فرآیند" : "فرآیند جدید"}
      description="یک جریان تکرارشونده با ورودی و خروجی مشخص؛ نه یک کار موردی."
    >
      <form
        className="sys-form"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            commit(
              saveEntity(data, "processes", {
                ...p,
                name: p.name.trim(),
                code: p.code.trim(),
              }),
            );
            onClose();
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <div className="sys-form-grid">
          <Field label="کد فرآیند">
            <input
              required
              dir="ltr"
              maxLength={30}
              value={p.code}
              onChange={(e) => set({ ...p, code: e.target.value })}
            />
          </Field>
          <Field label="وضعیت فرآیند">
            <select
              value={p.status}
              onChange={(e) =>
                set({ ...p, status: e.target.value as Process["status"] })
              }
            >
              <option value="active">فعال</option>
              <option value="archived">بایگانی</option>
            </select>
          </Field>
        </div>
        <Field label="نام فرآیند">
          <input
            required
            maxLength={180}
            value={p.name}
            onChange={(e) => set({ ...p, name: e.target.value })}
          />
        </Field>
        <Field label="شرح فرآیند">
          <textarea
            maxLength={3000}
            value={p.description}
            onChange={(e) => set({ ...p, description: e.target.value })}
          />
        </Field>
        <div className="sys-form-grid">
          <Field label="زنجیره ارزش">
            <select
              value={p.valueChain}
              onChange={(e) => set({ ...p, valueChain: e.target.value })}
            >
              {valueChains.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Field>
          <Field label="واحد سازمانی">
            <select
              required
              value={p.departmentId}
              onChange={(e) => set({ ...p, departmentId: e.target.value })}
            >
              <option value="">انتخاب واحد</option>
              {data.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                  {d.status === "archived" ? " (بایگانی)" : ""}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="نقش مالک فرآیند">
          <select
            value={p.ownerRoleId}
            onChange={(e) => set({ ...p, ownerRoleId: e.target.value })}
          >
            <option value="">بدون مالک؛ نیازمند تعیین مسئولیت</option>
            {data.roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title} ·{" "}
                {data.departments.find((d) => d.id === r.departmentId)?.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="sys-owner-preview">
          <span>
            فرد مسئول:{" "}
            <b>{person?.name ?? (role ? "نقش خالی" : "هنوز تعیین نشده")}</b>
          </span>
          {person?.status === "archived" && (
            <small>فرد تخصیص‌یافته غیرفعال است.</small>
          )}
          <small>فرد از نقش انتخاب‌شده تعیین می‌شود.</small>
        </div>
        <fieldset className="sys-priority-inputs">
          <legend>عوامل اولویت سیستم‌سازی</legend>
          <p>
            ۱ کم · ۲ متوسط · ۳ زیاد. تکرار یعنی میزان تکرار فرآیند، نه مدت زمان
            اجرا.
          </p>
          <div className="sys-form-grid">
            {(
              [
                ["impact", "اثر"],
                ["variation", "تنوع / نوسان"],
                ["dependency", "وابستگی"],
                ["frequency", "تکرار"],
              ] as const
            ).map(([key, label]) => (
              <Field key={key} label={label}>
                <select
                  value={p[key]}
                  onChange={(e) =>
                    set({ ...p, [key]: Number(e.target.value) as Rating })
                  }
                >
                  <option value="1">۱ · کم</option>
                  <option value="2">۲ · متوسط</option>
                  <option value="3">۳ · زیاد</option>
                </select>
              </Field>
            ))}
          </div>
          <div className="sys-score-preview">
            <span>
              مجموع چهار عامل: <strong>{fa(score.priorityScore)} / ۱۲</strong>
            </span>
            <Badge level={score.priorityLevel} />
          </div>
        </fieldset>
        <Field label="وابستگی به بنیان‌گذار">
          <select
            value={p.founderDependency}
            onChange={(e) =>
              set({
                ...p,
                founderDependency: e.target
                  .value as Process["founderDependency"],
              })
            }
          >
            {Object.entries(founderLevels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        {role?.isFounderRole && (
          <p className="sys-hint">
            به دلیل مالکیت نقش بنیان‌گذار، وابستگی مؤثر:{" "}
            {founderLevels[effectiveFounder(data, p)]}
          </p>
        )}
        <Field label="مرحله سیستم‌سازی">
          <select
            value={p.systemizationStage}
            onChange={(e) =>
              set({
                ...p,
                systemizationStage: e.target
                  .value as Process["systemizationStage"],
              })
            }
          >
            {Object.entries(stages).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <p className="sys-hint">
          استانداردسازی، پیاده‌سازی، اندازه‌گیری و بهبود از صفحات مربوط و پس از
          تأیید پیش‌نیازها ثبت می‌شوند؛ تغییر دستی، جایگزین تأیید آمادگی نیست.
        </p>
        <Field label="وضعیت مستندسازی">
          <select
            value={p.documentationStatus}
            onChange={(e) =>
              set({
                ...p,
                documentationStatus: e.target
                  .value as Process["documentationStatus"],
              })
            }
          >
            {Object.entries(documentation).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="یادداشت / دلیل وابستگی">
          <textarea
            maxLength={4000}
            value={p.notes}
            onChange={(e) => set({ ...p, notes: e.target.value })}
          />
        </Field>
        <EditorActions
          error={error}
          onDelete={
            initial
              ? () => {
                  try {
                    commit(deleteEntity(data, "processes", p.id));
                    onClose();
                    onDeleted?.();
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }
              : undefined
          }
        />
      </form>
    </Drawer>
  );
}
