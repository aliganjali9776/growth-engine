"use client";
import { useState } from "react";
import Link from "next/link";
import {
  applyStrategyChange,
  controlledFields,
  requiresControlledChange,
} from "@/lib/strategy/adapt/mutations";
import { Button, Field } from "@/components/system/ui";
import { EditorFrame, Owner, Options } from "./editors";
import { useStrategy } from "./provider";
import { krTypes, units, type KeyResult } from "@/lib/strategy/kr/types";
import { saveKR } from "@/lib/strategy/kr/mutations";
import { calculateKRCompleteness } from "@/lib/strategy/kr/validation";
import {
  calculateKRProgress,
  confidenceLabel,
} from "@/lib/strategy/kr/calculations";
const value = (n: number | null) => (n === null ? "" : String(n));
const numeric = (s: string) => (s.trim() === "" ? null : Number(s));
export function KREditor({
  initial,
  onClose,
  measurement = false,
}: {
  initial: KeyResult;
  onClose: () => void;
  measurement?: boolean;
}) {
  const { store, roles, commit } = useStrategy(),
    [k, set] = useState(initial),
    [tab, setTab] = useState(measurement ? 1 : 0);
  const [changeReview, setChangeReview] = useState(""),
    [changeReason, setChangeReason] = useState(""),
    [changeConfirmed, setChangeConfirmed] = useState(false);
  const existing = store.keyResults?.find((x) => x.id === k.id);
  const definitionPatch: Record<string, unknown> = {};
  if (existing)
    for (const field of controlledFields.kr) {
      const comparable = (record: KeyResult) =>
        field === "milestones"
          ? record.milestones.map((m) => [m.id, m.title, m.weight])
          : record[field];
      if (
        JSON.stringify(comparable(existing)) !== JSON.stringify(comparable(k))
      )
        definitionPatch[field] = k[field];
    }
  const changesDefinition =
    Object.keys(definitionPatch).length > 0 &&
    requiresControlledChange(store, k.cycleId);
  const objective = store.objectives.find((o) => o.id === k.objectiveId)!;
  const quality = calculateKRCompleteness(
    k,
    store,
    roles,
    objective.krWeightMode ?? "equal",
  );
  function setType(type: KeyResult["type"]) {
    set({
      ...k,
      type,
      milestones: [],
      currentValue: null,
      startValue: type === "binary" ? 0 : null,
      targetValue: type === "binary" ? 1 : null,
      unit:
        type === "binary" ? "بله / خیر" : type === "milestone" ? "٪" : k.unit,
    });
  }
  function numberField(
    label: string,
    key: "startValue" | "targetValue" | "currentValue" | "weight",
  ) {
    return (
      <Field label={label}>
        <input
          type="number"
          step="any"
          min={key === "weight" ? 0 : undefined}
          max={key === "weight" ? 100 : undefined}
          value={value(k[key])}
          onChange={(e) => set({ ...k, [key]: numeric(e.target.value) })}
        />
      </Field>
    );
  }
  return (
    <EditorFrame
      title={measurement ? "به‌روزرسانی نتیجه کلیدی" : "نتیجه کلیدی"}
      onClose={onClose}
      onSave={() => {
        if (!k.title.trim()) throw Error("عنوان نتیجه کلیدی را وارد کنید.");
        let next = store;
        if (changesDefinition) {
          if (existing?.type !== k.type)
            definitionPatch.currentValue = k.currentValue;
          next = applyStrategyChange(
            store,
            changeReview,
            "kr",
            k.id,
            definitionPatch,
            changeReason,
            changeConfirmed,
          );
        }
        commit(saveKR(next, k));
      }}
    >
      <p className="st-muted">
        {objective.code} · {objective.title}
      </p>
      {store.keyResults?.some((x) => x.id === k.id) && (
        <p>
          تغییر تعریف، هدف، مبنا، مالک و موعد به ثبت دلیل نیاز دارد.{" "}
          <Link href={`/strategy/cycles/${k.cycleId}/adapt`}>
            باز کردن مرور تطبیقی
          </Link>
        </p>
      )}
      {changesDefinition && (
        <div className="ad-card">
          <p>
            تعریف نتیجه تغییر کرده است. تغییر مبنا یا هدف، نسبت پیشرفت را تغییر
            می‌دهد؛ سوابق تکمیل‌شده حفظ می‌شوند.
          </p>
          <Field label="مرور مبدأ تغییر">
            <select
              value={changeReview}
              onChange={(e) => setChangeReview(e.target.value)}
            >
              <option value="">انتخاب مرور تطبیقی باز</option>
              {store.adaptReviews
                ?.filter((r) => r.cycleId === k.cycleId && r.status === "draft")
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.periodLabel}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="دلیل اصلاح تعریف">
            <textarea
              value={changeReason}
              onChange={(e) => setChangeReason(e.target.value)}
            />
          </Field>
          <label className="ad-check">
            <input
              type="checkbox"
              checked={changeConfirmed}
              onChange={(e) => setChangeConfirmed(e.target.checked)}
            />
            تغییر و اثر آن بر مبنای سنجش را تأیید می‌کنم
          </label>
        </div>
      )}
      <div
        className="kr-editor-tabs"
        role="group"
        aria-label="بخش‌های ویرایش نتیجه کلیدی"
      >
        {["تعریف نتیجه", "مقدار و وزن", "زمان و اطمینان"].map((title, i) => (
          <button
            type="button"
            aria-pressed={tab === i}
            key={title}
            onClick={() => setTab(i)}
          >
            {title}
          </button>
        ))}
      </div>
      {tab === 0 && (
        <>
          <p className="st-notice">
            نتیجه کلیدی، شاهد قابل اندازه‌گیری تحقق هدف است. فعالیت‌هایی مانند
            «راه‌اندازی کمپین» معمولاً ابتکار هستند.
          </p>
          <Field label="کد نتیجه">
            <input
              value={k.code}
              onChange={(e) => set({ ...k, code: e.target.value })}
            />
          </Field>
          <Field label="عنوان نتیجه کلیدی">
            <input
              value={k.title}
              onChange={(e) => set({ ...k, title: e.target.value })}
            />
          </Field>
          <Owner
            value={k.ownerRoleId}
            onChange={(ownerRoleId) => set({ ...k, ownerRoleId })}
          />
          <Field label="نوع نتیجه کلیدی">
            <select
              value={k.type}
              onChange={(e) => setType(e.target.value as KeyResult["type"])}
            >
              <Options items={krTypes} />
            </select>
          </Field>
          <small>
            تغییر نوع، مقادیر و مراحل فرم را پاک می‌کند؛ تا ذخیره، داده قبلی حفظ
            می‌شود.
          </small>
          <Field label="شرح شاهد اندازه‌گیری">
            <textarea
              value={k.description}
              onChange={(e) => set({ ...k, description: e.target.value })}
            />
          </Field>
        </>
      )}
      {tab === 1 && (
        <>
          {(k.type === "increase" || k.type === "decrease") && (
            <>
              <div className="st-form-grid">
                {numberField("مقدار شروع", "startValue")}
                {numberField("مقدار هدف", "targetValue")}
              </div>
              {numberField("مقدار فعلی", "currentValue")}
              <Field label="واحد">
                <input
                  list="kr-unit-options"
                  value={k.unit}
                  onChange={(e) => set({ ...k, unit: e.target.value })}
                />
                <datalist id="kr-unit-options">
                  {units.map((u) => (
                    <option key={u} value={u} />
                  ))}
                </datalist>
                <small>
                  می‌توانید واحد سفارشی بنویسید؛ واحد در فرمول اثری ندارد.
                </small>
              </Field>
            </>
          )}
          {k.type === "binary" && (
            <Field label="تحقق نتیجه">
              <select
                value={k.currentValue === null ? "" : k.currentValue}
                onChange={(e) =>
                  set({ ...k, currentValue: numeric(e.target.value) })
                }
              >
                <option value="">هنوز ثبت نشده</option>
                <option value="0">محقق نشده — ۰٪</option>
                <option value="1">محقق شده — ۱۰۰٪</option>
              </select>
            </Field>
          )}
          {k.type === "milestone" && (
            <section>
              <h3>مراحل قابل تأیید</h3>
              <p>
                مجموع وزن مراحل باید ۱۰۰٪ باشد؛ هر مرحله فقط کامل یا ناکامل است.
              </p>
              {k.milestones.map((m, i) => (
                <div key={m.id} className="kr-milestone-editor">
                  <Field label={`عنوان مرحله ${i + 1}`}>
                    <input
                      value={m.title}
                      onChange={(e) =>
                        set({
                          ...k,
                          milestones: k.milestones.map((x) =>
                            x.id === m.id ? { ...x, title: e.target.value } : x,
                          ),
                        })
                      }
                    />
                  </Field>
                  <Field label={`وزن مرحله ${i + 1}`}>
                    <input
                      type="number"
                      step="any"
                      min={0}
                      max={100}
                      value={m.weight}
                      onChange={(e) =>
                        set({
                          ...k,
                          milestones: k.milestones.map((x) =>
                            x.id === m.id
                              ? { ...x, weight: Number(e.target.value) }
                              : x,
                          ),
                        })
                      }
                    />
                  </Field>
                  <label>
                    <input
                      type="checkbox"
                      checked={m.completed}
                      onChange={(e) =>
                        set({
                          ...k,
                          milestones: k.milestones.map((x) =>
                            x.id === m.id
                              ? { ...x, completed: e.target.checked }
                              : x,
                          ),
                        })
                      }
                    />{" "}
                    مرحله {i + 1} تکمیل شد
                  </label>
                  <Button
                    secondary
                    onClick={() =>
                      set({
                        ...k,
                        milestones: k.milestones.filter((x) => x.id !== m.id),
                      })
                    }
                  >
                    حذف مرحله {i + 1}
                  </Button>
                </div>
              ))}
              <Button
                secondary
                onClick={() =>
                  set({
                    ...k,
                    milestones: [
                      ...k.milestones,
                      {
                        id: crypto.randomUUID(),
                        keyResultId: k.id,
                        title: "",
                        weight: 0,
                        completed: false,
                      },
                    ],
                  })
                }
              >
                افزودن مرحله
              </Button>
              <p>
                مجموع وزن مراحل:{" "}
                {k.milestones
                  .reduce((n, m) => n + m.weight, 0)
                  .toLocaleString("fa-IR")}
                ٪
              </p>
            </section>
          )}
          {numberField("وزن سفارشی نتیجه (درصد)", "weight")}
          <p className="st-muted">
            روش فعلی هدف:{" "}
            {objective.krWeightMode === "custom"
              ? "وزن سفارشی؛ مجموع نتایج فعال باید ۱۰۰٪ باشد."
              : "وزن برابر؛ وزن سفارشی واردشده تا تغییر روش هدف، در محاسبه استفاده نمی‌شود."}
          </p>
          <p>
            پیشرفت محاسبه‌شده:{" "}
            {calculateKRProgress(k) === null
              ? "داده کافی نیست"
              : calculateKRProgress(k)!.toLocaleString("fa-IR", {
                  maximumFractionDigits: 1,
                }) + "٪"}
          </p>
        </>
      )}
      {tab === 2 && (
        <>
          <div className="st-form-grid">
            <Field label="تاریخ شروع نتیجه">
              <input
                type="date"
                value={k.startDate}
                onInput={(e) => set({ ...k, startDate: e.currentTarget.value })}
              />
            </Field>
            <Field label="مهلت نتیجه">
              <input
                type="date"
                value={k.deadline}
                onInput={(e) => set({ ...k, deadline: e.currentTarget.value })}
              />
            </Field>
          </div>
          <Field label="اطمینان مدیریت (۱ تا ۱۰)">
            <select
              value={k.confidence ?? ""}
              onChange={(e) =>
                set({ ...k, confidence: numeric(e.target.value) })
              }
            >
              <option value="">ثبت نشده</option>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n} — {confidenceLabel(n)}
                </option>
              ))}
            </select>
          </Field>
          <small>
            ۱: تقریباً نامطمئن از تحقق؛ ۵: عدم قطعیت بالا؛ ۷: احتمال مناسب؛ ۱۰:
            اطمینان بسیار بالا. مستقل از درصد پیشرفت.
          </small>
          <Field label="یادداشت مدیریت">
            <textarea
              value={k.notes}
              onChange={(e) => set({ ...k, notes: e.target.value })}
            />
          </Field>
          <Field label="وضعیت ثبت">
            <select
              value={k.lifecycle}
              onChange={(e) =>
                set({
                  ...k,
                  lifecycle: e.target.value as KeyResult["lifecycle"],
                })
              }
            >
              <option value="active">فعال</option>
              <option value="cancelled">
                لغوشده — حفظ سابقه و خروج از محاسبات
              </option>
            </select>
          </Field>
        </>
      )}
      <details className="st-notice">
        <summary>
          کیفیت: {quality.label} · کامل بودن داده{" "}
          {quality.score.toLocaleString("fa-IR")}٪
        </summary>
        <ul>
          {[...quality.missing, ...quality.warnings].map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
        <small>
          بررسی قاعده‌محور؛ داده ناقص را می‌توان برای تکمیل بعدی ذخیره کرد.
        </small>
      </details>
    </EditorFrame>
  );
}
