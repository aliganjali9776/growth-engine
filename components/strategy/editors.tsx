"use client";
import { useState } from "react";
import Link from "next/link";
import { Button, Drawer, Field } from "@/components/system/ui";
import { useStrategy } from "./provider";
import {
  contextLabels,
  cycleStatuses,
  cycleTypes,
  directions,
  objectiveStatuses,
  priorityStatuses,
  saveCycle,
  saveObjective,
  type StrategyCycle,
  type StrategyContext,
  type StrategicChoice,
  type StrategicPriority,
  type StrategyObjective,
} from "@/lib/strategy/model";
import { objectiveQuality } from "@/lib/strategy/report";
export function Options({ items }: { items: Record<string, string> }) {
  return (
    <>
      {Object.entries(items).map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </>
  );
}
export function Owner({
  value,
  onChange,
  roleList,
}: {
  value: string;
  onChange: (v: string) => void;
  roleList?: import("@/lib/strategy/model").StrategyRole[];
}) {
  const { roles: liveRoles } = useStrategy();
  const roles = roleList ?? liveRoles;
  return (
    <Field label="نقش مالک">
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">انتخاب نقش از سیستم</option>
        {value && !roles.some((r) => r.id === value) && (
          <option value={value}>نقش قبلی موجود نیست</option>
        )}
        {roles.map((r) => (
          <option key={r.id} value={r.id}>
            {r.title}
          </option>
        ))}
      </select>
      {!roles.length && (
        <small>
          ابتدا یک نقش در بخش افراد و نقش‌های سیستم ایجاد کنید؛ پیش‌نویس بدون
          مالک قابل ذخیره است.
        </small>
      )}
    </Field>
  );
}
export function EditorFrame({
  title,
  onClose,
  onSave,
  children,
}: {
  title: string;
  onClose: () => void;
  onSave: () => void;
  children: React.ReactNode;
}) {
  const [error, setError] = useState("");
  return (
    <Drawer
      open
      onClose={onClose}
      title={title}
      description="پس از ذخیره، تغییرات در همین مرورگر نگهداری می‌شوند."
    >
      <form
        className="st-form"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            onSave();
            onClose();
          } catch (err) {
            setError(err instanceof Error ? err.message : "ذخیره انجام نشد.");
          }
        }}
      >
        {children}
        {error && (
          <p role="alert" className="st-notice">
            {error}
            <Link href="/strategy/adapt"> · مرور تطبیقی و ثبت تغییر</Link>
          </p>
        )}
        <div className="st-actions">
          <Button type="submit">ذخیره</Button>
          <Button secondary onClick={onClose}>
            انصراف
          </Button>
        </div>
      </form>
    </Drawer>
  );
}
export function CycleEditor({
  initial,
  onClose,
}: {
  initial: StrategyCycle;
  onClose: () => void;
}) {
  const { store, commit } = useStrategy();
  const [v, set] = useState(initial),
    [confirmed, confirm] = useState(false);
  const previous = store.cycles.find(
    (c) => c.id !== v.id && c.status === "active",
  );
  return (
    <EditorFrame
      title="ویرایش دوره استراتژیک"
      onClose={onClose}
      onSave={() =>
        commit(
          saveCycle(
            store,
            { ...v, updatedAt: new Date().toISOString() },
            confirmed,
          ),
        )
      }
    >
      <Field label="نام دوره">
        <input
          required
          maxLength={160}
          value={v.name}
          onChange={(e) => set({ ...v, name: e.target.value })}
        />
      </Field>
      <Field label="نوع دوره">
        <select
          value={v.cycleType}
          onChange={(e) =>
            set({
              ...v,
              cycleType: e.target.value as StrategyCycle["cycleType"],
            })
          }
        >
          <Options items={cycleTypes} />
        </select>
      </Field>
      <div className="st-form-grid">
        <Field label="تاریخ شروع">
          <input
            type="date"
            required
            value={v.startDate}
            onInput={(e) => set({ ...v, startDate: e.currentTarget.value })}
          />
        </Field>
        <Field label="تاریخ پایان">
          <input
            type="date"
            required
            min={v.startDate}
            value={v.endDate}
            onInput={(e) => set({ ...v, endDate: e.currentTarget.value })}
          />
        </Field>
      </div>
      <small>
        تاریخ‌ها به میلادی وارد و در صفحات به شمسی نمایش داده می‌شوند.
      </small>
      <Owner
        value={v.ownerRoleId}
        onChange={(ownerRoleId) => set({ ...v, ownerRoleId })}
      />
      <Field label="مضمون استراتژیک">
        <input
          value={v.strategicTheme}
          onChange={(e) => set({ ...v, strategicTheme: e.target.value })}
        />
      </Field>
      <Field label="شرح دوره">
        <textarea
          value={v.description}
          onChange={(e) => set({ ...v, description: e.target.value })}
        />
      </Field>
      <Field label="وضعیت دوره">
        <select
          value={v.status}
          onChange={(e) => {
            set({ ...v, status: e.target.value as StrategyCycle["status"] });
            confirm(false);
          }}
        >
          <Options items={cycleStatuses} />
        </select>
      </Field>
      {v.status === "active" && previous && (
        <label className="st-notice">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => confirm(e.target.checked)}
          />{" "}
          تأیید می‌کنم دوره «{previous.name}» به «در حال بازبینی» منتقل شود.
          تاریخچه حفظ خواهد شد.
        </label>
      )}
    </EditorFrame>
  );
}
export function ContextEditor({
  initial,
  onClose,
}: {
  initial: StrategyContext;
  onClose: () => void;
}) {
  const { store, commit } = useStrategy(),
    [v, set] = useState(initial);
  return (
    <EditorFrame
      title="زمینه تصمیم‌گیری استراتژی"
      onClose={onClose}
      onSave={() =>
        commit({
          ...store,
          contexts: [
            ...store.contexts.filter((c) => c.cycleId !== v.cycleId),
            v,
          ],
        })
      }
    >
      {Object.entries(contextLabels).map(([key, label]) => (
        <Field key={key} label={label}>
          <textarea
            maxLength={1500}
            rows={2}
            value={v[key as keyof typeof contextLabels]}
            onChange={(e) => set({ ...v, [key]: e.target.value })}
          />
        </Field>
      ))}
    </EditorFrame>
  );
}
export function PriorityEditor({
  initial,
  onClose,
}: {
  initial: StrategicPriority;
  onClose: () => void;
}) {
  const { store, commit } = useStrategy(),
    [v, set] = useState(initial);
  return (
    <EditorFrame
      title="اولویت استراتژیک"
      onClose={onClose}
      onSave={() =>
        commit({
          ...store,
          priorities: [
            ...store.priorities.filter((p) => p.id !== v.id),
            { ...v, updatedAt: new Date().toISOString() },
          ],
        })
      }
    >
      <Field label="عنوان اولویت">
        <input
          required
          value={v.title}
          onChange={(e) => set({ ...v, title: e.target.value })}
        />
      </Field>
      <Field label="جهت‌گیری">
        <select
          value={v.direction}
          onChange={(e) =>
            set({
              ...v,
              direction: e.target.value as StrategicPriority["direction"],
            })
          }
        >
          <Options items={directions} />
        </select>
      </Field>
      {v.direction === "custom" && (
        <Field label="جهت‌گیری سفارشی">
          <input
            required
            value={v.customDirection}
            onChange={(e) => set({ ...v, customDirection: e.target.value })}
          />
        </Field>
      )}
      <Owner
        value={v.ownerRoleId}
        onChange={(ownerRoleId) => set({ ...v, ownerRoleId })}
      />
      <Field label="رتبه">
        <input
          required
          type="number"
          min={1}
          max={10000}
          value={v.rank}
          onChange={(e) => set({ ...v, rank: Number(e.target.value) })}
        />
      </Field>
      <Field label="چرا اکنون؟">
        <textarea
          value={v.rationale}
          onChange={(e) => set({ ...v, rationale: e.target.value })}
        />
      </Field>
      {v.status === "selected" && !v.rationale.trim() && (
        <p className="st-notice">
          برای اولویت منتخب، دلیل انتخاب را روشن کنید.
        </p>
      )}
      <Field label="تعریف کیفی موفقیت">
        <textarea
          value={v.successDefinition}
          onChange={(e) => set({ ...v, successDefinition: e.target.value })}
        />
      </Field>
      <Field label="شرح اولویت">
        <textarea
          value={v.description}
          onChange={(e) => set({ ...v, description: e.target.value })}
        />
      </Field>
      <Field label="وضعیت اولویت">
        <select
          value={v.status}
          onChange={(e) =>
            set({ ...v, status: e.target.value as StrategicPriority["status"] })
          }
        >
          <Options items={priorityStatuses} />
        </select>
      </Field>
    </EditorFrame>
  );
}
export function ChoiceEditor({
  initial,
  onClose,
}: {
  initial: StrategicChoice;
  onClose: () => void;
}) {
  const { store, commit } = useStrategy(),
    [v, set] = useState(initial);
  return (
    <EditorFrame
      title="انتخاب استراتژیک"
      onClose={onClose}
      onSave={() =>
        commit({
          ...store,
          choices: [...store.choices.filter((c) => c.id !== v.id), v],
        })
      }
    >
      <p>این انتخاب مرز تمرکز دوره است؛ فهرست کارهای عقب‌افتاده نیست.</p>
      <Field label="نوع انتخاب">
        <select
          value={v.type}
          onChange={(e) =>
            set({ ...v, type: e.target.value as StrategicChoice["type"] })
          }
        >
          <option value="focus">روی این موضوع تمرکز می‌کنیم</option>
          <option value="notNow">فعلاً انجام نمی‌دهیم</option>
        </select>
      </Field>
      <Field label="بیانیه انتخاب">
        <textarea
          required
          value={v.statement}
          onChange={(e) => set({ ...v, statement: e.target.value })}
        />
      </Field>
      <Field label="دلیل انتخاب">
        <textarea
          value={v.rationale}
          onChange={(e) => set({ ...v, rationale: e.target.value })}
        />
      </Field>
    </EditorFrame>
  );
}
export function ObjectiveEditor({
  initial,
  cycle,
  onClose,
}: {
  initial: StrategyObjective;
  cycle: StrategyCycle;
  onClose: () => void;
}) {
  const { store, roles, commit } = useStrategy(),
    [v, set] = useState(initial);
  const quality = objectiveQuality(v, cycle, store, roles);
  return (
    <EditorFrame
      title="هدف کیفی دوره"
      onClose={onClose}
      onSave={() => {
        commit(
          saveObjective(
            store,
            { ...v, updatedAt: new Date().toISOString() },
            roles,
          ),
        );
      }}
    >
      <p className="st-notice">
        هدف، تغییر مطلوب است: «ساخت یک موتور رشد B2B قابل تکرار». «استخدام
        فروشنده» فعالیت و «فروش ۳ میلیارد» نتیجه کمی است.
      </p>
      <Field label="کد هدف">
        <input
          required
          value={v.code}
          onChange={(e) => set({ ...v, code: e.target.value })}
        />
      </Field>
      <Field label="عنوان هدف">
        <input
          required
          value={v.title}
          onChange={(e) => set({ ...v, title: e.target.value })}
        />
      </Field>
      <Field label="شرح تغییر مطلوب">
        <textarea
          value={v.description}
          onChange={(e) => set({ ...v, description: e.target.value })}
        />
      </Field>
      <Owner
        value={v.ownerRoleId}
        onChange={(ownerRoleId) => set({ ...v, ownerRoleId })}
      />
      <Field label="اولویت مرتبط">
        <select
          value={v.relatedPriorityId}
          onChange={(e) => set({ ...v, relatedPriorityId: e.target.value })}
        >
          <option value="">بدون اولویت</option>
          {store.priorities
            .filter((p) => p.cycleId === cycle.id)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} · {priorityStatuses[p.status]}
              </option>
            ))}
        </select>
      </Field>
      <div className="st-form-grid">
        <Field label="تاریخ شروع هدف">
          <input
            type="date"
            required
            value={v.startDate}
            onInput={(e) => set({ ...v, startDate: e.currentTarget.value })}
          />
        </Field>
        <Field label="مهلت هدف">
          <input
            type="date"
            required
            min={v.startDate}
            value={v.deadline}
            onInput={(e) => set({ ...v, deadline: e.currentTarget.value })}
          />
        </Field>
      </div>
      <Field label="وضعیت هدف">
        <select
          value={v.status}
          onChange={(e) =>
            set({ ...v, status: e.target.value as StrategyObjective["status"] })
          }
        >
          <Options items={objectiveStatuses} />
        </select>
      </Field>
      <section className="st-notice" aria-live="polite">
        <strong>بررسی قاعده‌محور: {quality.label}</strong>
        <ul>
          {quality.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
        <small>راهنمای ساده نگارشی است؛ ارزیابی هوش مصنوعی نیست.</small>
      </section>
    </EditorFrame>
  );
}
