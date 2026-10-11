"use client";
import { useState } from "react";
import { Field } from "@/components/system/ui";
import { EditorFrame, Owner, Options } from "./editors";
import { useStrategy } from "./provider";
import {
  initiativeStatuses,
  initiativePriorities,
  effectivenessLabels,
  impactTypes,
  effortLabels,
  type StrategicInitiative,
} from "@/lib/strategy/initiatives/types";
import { saveInitiative } from "@/lib/strategy/initiatives/mutations";
import { initiativeQuality } from "@/lib/strategy/initiatives/validation";
export function InitiativeEditor({
  initial,
  onClose,
  execution = false,
}: {
  initial: StrategicInitiative;
  onClose: () => void;
  execution?: boolean;
}) {
  const { store, roles, commit } = useStrategy(),
    [i, set] = useState(initial),
    [tab, setTab] = useState(execution ? 2 : 0),
    quality = initiativeQuality(i, store, roles);
  return (
    <EditorFrame
      title={execution ? "به‌روزرسانی اجرا و اثر" : "اقدام استراتژیک"}
      onClose={onClose}
      onSave={() => commit(saveInitiative(store, i, roles))}
    >
      <div className="kr-editor-tabs" role="group" aria-label="بخش‌های اقدام">
        {["هم‌راستایی و فرضیه", "اثر مورد انتظار", "اجرا و ارزیابی"].map(
          (title, n) => (
            <button
              type="button"
              aria-pressed={tab === n}
              key={title}
              onClick={() => setTab(n)}
            >
              {title}
            </button>
          ),
        )}
      </div>
      {tab === 0 && (
        <>
          <p className="st-notice">
            اقدام، کاری است که برای حرکت‌دادن یک نتیجه امتحان می‌کنیم؛ پیشرفت
            اجرا به معنی تحقق نتیجه نیست.
          </p>
          <Field label="دوره اقدام">
            <select
              disabled={!!i.startedAt}
              value={i.cycleId}
              onChange={(e) => {
                const c = store.cycles.find((c) => c.id === e.target.value);
                set({
                  ...i,
                  cycleId: e.target.value,
                  objectiveId: "",
                  keyResultId: "",
                  startDate: c?.startDate ?? "",
                  dueDate: c?.endDate ?? "",
                });
              }}
            >
              <option value="">انتخاب دوره</option>
              {store.cycles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="هدف اقدام">
            <select
              disabled={!!i.startedAt}
              value={i.objectiveId}
              onChange={(e) =>
                set({ ...i, objectiveId: e.target.value, keyResultId: "" })
              }
            >
              <option value="">انتخاب هدف</option>
              {store.objectives
                .filter((o) => o.cycleId === i.cycleId)
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.code} · {o.title}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="نتیجه کلیدی اصلی">
            <select
              disabled={!!i.startedAt}
              value={i.keyResultId}
              onChange={(e) => {
                const k = store.keyResults?.find(
                  (k) => k.id === e.target.value,
                );
                set({
                  ...i,
                  keyResultId: e.target.value,
                  objectiveId: k?.objectiveId ?? i.objectiveId,
                });
              }}
            >
              <option value="">هنوز انتخاب نشده</option>
              {(store.keyResults ?? [])
                .filter(
                  (k) =>
                    k.cycleId === i.cycleId && k.objectiveId === i.objectiveId,
                )
                .map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.code} · {k.title}
                    {k.lifecycle === "cancelled" ? " (لغوشده)" : ""}
                  </option>
                ))}
            </select>
          </Field>
          {!i.keyResultId && (
            <p className="st-notice">
              این اقدام هنوز به نتیجه کلیدی مشخصی متصل نشده است. می‌توانید
              پیشنهاد ذخیره کنید؛ پیش از اجرا، KR تعریف و انتخاب کنید.
            </p>
          )}
          <Field label="کد اقدام">
            <input
              value={i.code}
              onChange={(e) => set({ ...i, code: e.target.value })}
            />
          </Field>
          <Field label="عنوان اقدام">
            <input
              required
              value={i.title}
              onChange={(e) => set({ ...i, title: e.target.value })}
            />
          </Field>
          <Field label="فرضیه اثرگذاری">
            <textarea
              rows={3}
              value={i.hypothesis}
              onChange={(e) => set({ ...i, hypothesis: e.target.value })}
              placeholder="اگر این کار را انجام دهیم، چرا انتظار داریم KR تغییر کند؟"
            />
          </Field>
          <Owner
            value={i.ownerRoleId}
            onChange={(ownerRoleId) => set({ ...i, ownerRoleId })}
          />
          <small>
            فرد فعلی نقش:{" "}
            {roles.find((r) => r.id === i.ownerRoleId)?.personName ??
              "تخصیص داده نشده"}
          </small>
          <Field label="اولویت اجرایی">
            <select
              value={i.priority}
              onChange={(e) =>
                set({
                  ...i,
                  priority: e.target.value as StrategicInitiative["priority"],
                })
              }
            >
              <Options items={initiativePriorities} />
            </select>
          </Field>
          <small>
            اهمیت این اقدام در اجرا؛ مستقل از رتبه اولویت استراتژیک.
          </small>
        </>
      )}
      {tab === 1 && (
        <>
          <Field label="نوع اثر مورد انتظار">
            <select
              value={i.impactType}
              onChange={(e) =>
                set({
                  ...i,
                  impactType: e.target
                    .value as StrategicInitiative["impactType"],
                })
              }
            >
              <Options items={impactTypes} />
            </select>
          </Field>
          {i.impactType === "numeric" && (
            <div className="st-form-grid">
              <Field label="مقدار اثر مورد انتظار">
                <input
                  type="number"
                  step="any"
                  value={i.expectedImpactValue ?? ""}
                  onChange={(e) =>
                    set({
                      ...i,
                      expectedImpactValue:
                        e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </Field>
              <Field label="واحد اثر مورد انتظار">
                <input
                  value={i.expectedImpactUnit}
                  onChange={(e) =>
                    set({ ...i, expectedImpactUnit: e.target.value })
                  }
                />
              </Field>
            </div>
          )}
          <Field label="شرح اثر مورد انتظار">
            <textarea
              value={i.expectedImpact}
              onChange={(e) => set({ ...i, expectedImpact: e.target.value })}
            />
          </Field>
          <div className="st-form-grid">
            <Field label="اندازه اثر تخمینی">
              <select
                value={i.impactLevel}
                onChange={(e) =>
                  set({
                    ...i,
                    impactLevel: e.target
                      .value as StrategicInitiative["impactLevel"],
                  })
                }
              >
                <Options items={effortLabels} />
              </select>
            </Field>
            <Field label="تلاش مورد نیاز">
              <select
                value={i.effort}
                onChange={(e) =>
                  set({
                    ...i,
                    effort: e.target.value as StrategicInitiative["effort"],
                  })
                }
              >
                <Options items={effortLabels} />
              </select>
            </Field>
          </div>
          <small>
            برآورد مدیریت برای مقایسه گزینه‌هاست؛ پیشنهاد خودکار یا تضمین نتیجه
            نیست.
          </small>
          <Field label="شرح اقدام">
            <textarea
              value={i.description}
              onChange={(e) => set({ ...i, description: e.target.value })}
            />
          </Field>
        </>
      )}
      {tab === 2 && (
        <>
          <Field label="وضعیت اقدام">
            <select
              value={i.status}
              onChange={(e) => {
                const status = e.target.value as StrategicInitiative["status"];
                set({
                  ...i,
                  status,
                  progress:
                    status === "completed"
                      ? 100
                      : ["proposed", "planned"].includes(status)
                        ? 0
                        : i.progress,
                });
              }}
            >
              <Options items={initiativeStatuses} />
            </select>
          </Field>
          <Field label="پیشرفت اجرا (درصد)">
            <input
              type="number"
              min={0}
              max={100}
              step="any"
              readOnly={i.status === "completed"}
              value={i.progress}
              onChange={(e) => set({ ...i, progress: Number(e.target.value) })}
            />
          </Field>
          <small>
            تکمیل اجرا، موفقیت تجاری را اثبات نمی‌کند و مقدار KR را تغییر
            نمی‌دهد.
          </small>
          <div className="st-form-grid">
            <Field label="تاریخ شروع اقدام">
              <input
                type="date"
                value={i.startDate}
                onInput={(e) => set({ ...i, startDate: e.currentTarget.value })}
              />
            </Field>
            <Field label="مهلت اقدام">
              <input
                type="date"
                value={i.dueDate}
                onInput={(e) => set({ ...i, dueDate: e.currentTarget.value })}
              />
            </Field>
          </div>
          {i.status === "blocked" && (
            <Field label="دلیل توقف">
              <textarea
                required
                value={i.blockedReason}
                onChange={(e) => set({ ...i, blockedReason: e.target.value })}
              />
            </Field>
          )}
          {i.status === "completed" && (
            <p className="st-notice">
              اجرا تکمیل شد؛ چه اثری مشاهده کردید؟ ارزیابی نشده هم قابل ذخیره
              است و برای پیگیری علامت می‌خورد.
            </p>
          )}
          <Field label="اثر واقعی مشاهده‌شده">
            <textarea
              value={i.actualImpact}
              onChange={(e) => set({ ...i, actualImpact: e.target.value })}
            />
          </Field>
          <Field label="اثربخشی">
            <select
              value={i.effectiveness}
              onChange={(e) =>
                set({
                  ...i,
                  effectiveness: e.target
                    .value as StrategicInitiative["effectiveness"],
                })
              }
            >
              <Options items={effectivenessLabels} />
            </select>
          </Field>
          <small>
            قضاوت دستی مدیریت، مستقل از درصد اجرا. یک اقدام ۱۰۰٪ تکمیل‌شده
            می‌تواند بی‌اثر باشد.
          </small>
          <Field label="یادداشت اقدام">
            <textarea
              value={i.notes}
              onChange={(e) => set({ ...i, notes: e.target.value })}
            />
          </Field>
        </>
      )}
      <details className="st-notice">
        <summary>کیفیت اقدام: {quality.label}</summary>
        <ul>
          {[...quality.missing, ...quality.warnings].map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
        <small>بررسی قاعده‌محور؛ بدون هوش مصنوعی</small>
      </details>
    </EditorFrame>
  );
}
