"use client";
import { useState } from "react";
import { Drawer, Field, Button } from "@/components/system/ui";
import {
  assetTypes,
  type DecisionRule,
  type Asset,
} from "@/lib/system/standards/model";
import type { ProcessMap } from "@/lib/system/maps/model";
import { RoleField } from "./shared";
function StepField({
  map,
  value,
  onChange,
}: {
  map: ProcessMap;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field label="مرحله مرتبط">
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">کل فرآیند</option>
        {map.steps.map((s) => (
          <option value={s.id} key={s.id}>
            {s.title}
          </option>
        ))}
      </select>
    </Field>
  );
}
export function RuleEditor({
  initial,
  map,
  onSave,
  onClose,
}: {
  initial: DecisionRule;
  map: ProcessMap;
  onSave: (r: DecisionRule) => void;
  onClose: () => void;
}) {
  const [r, setR] = useState(initial),
    [error, setError] = useState("");
  return (
    <Drawer
      open
      onClose={onClose}
      title="قاعده تصمیم و ارجاع"
      description="شرط، اقدام مجاز و مسیر ارجاع را مشخص کنید؛ قاعده به‌صورت خودکار اجرا نمی‌شود."
    >
      <form
        className="sys-form"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            onSave(r);
            onClose();
          } catch (e) {
            setError(e instanceof Error ? e.message : "ذخیره نشد.");
          }
        }}
      >
        {(["title", "condition", "action", "notes"] as const).map((key, i) => (
          <Field
            key={key}
            label={["عنوان قاعده", "شرط", "اقدام مجاز", "یادداشت قاعده"][i]}
          >
            <textarea
              value={r[key]}
              onChange={(e) => setR({ ...r, [key]: e.target.value })}
            />
          </Field>
        ))}
        <StepField
          map={map}
          value={r.relatedStepId}
          onChange={(relatedStepId) => setR({ ...r, relatedStepId })}
        />
        <RoleField
          label="مالک قاعده"
          value={r.ownerRoleId}
          onChange={(ownerRoleId) => setR({ ...r, ownerRoleId })}
        />
        <RoleField
          label="ارجاع به نقش"
          value={r.escalationRoleId}
          onChange={(escalationRoleId) => setR({ ...r, escalationRoleId })}
        />
        <Field label="اولویت قاعده">
          <select
            value={r.priority}
            onChange={(e) =>
              setR({ ...r, priority: Number(e.target.value) as 1 | 2 | 3 })
            }
          >
            <option value="1">بالا</option>
            <option value="2">متوسط</option>
            <option value="3">پایین</option>
          </select>
        </Field>
        <Field label="وضعیت قاعده">
          <select
            value={r.status}
            onChange={(e) =>
              setR({ ...r, status: e.target.value as DecisionRule["status"] })
            }
          >
            <option value="draft">پیش‌نویس</option>
            <option value="ready">آماده</option>
          </select>
        </Field>
        {error && <p role="alert">{error}</p>}
        <Button type="submit">ذخیره قاعده</Button>
      </form>
    </Drawer>
  );
}
export function AssetEditor({
  initial,
  map,
  onSave,
  onClose,
}: {
  initial: Asset;
  map: ProcessMap;
  onSave: (a: Asset) => void;
  onClose: () => void;
}) {
  const [a, setA] = useState(initial),
    [error, setError] = useState("");
  return (
    <Drawer
      open
      onClose={onClose}
      title="دارایی و قالب اجرایی"
      description="فقط مشخصات و نشانی مرجع ثبت می‌شود؛ فایل بارگذاری نمی‌شود."
    >
      <form
        className="sys-form"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            onSave(a);
            onClose();
          } catch (e) {
            setError(e instanceof Error ? e.message : "ذخیره نشد.");
          }
        }}
      >
        {(["name", "description", "reference", "version"] as const).map(
          (key, i) => (
            <Field
              key={key}
              label={
                [
                  "نام دارایی",
                  "شرح دارایی",
                  "نشانی یا مرجع داخلی",
                  "نسخه دارایی",
                ][i]
              }
            >
              <input
                value={a[key]}
                onChange={(e) => setA({ ...a, [key]: e.target.value })}
              />
            </Field>
          ),
        )}
        <Field label="نوع دارایی">
          <select
            value={a.type}
            onChange={(e) =>
              setA({ ...a, type: e.target.value as Asset["type"] })
            }
          >
            {Object.entries(assetTypes).map(([k, v]) => (
              <option value={k} key={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <StepField
          map={map}
          value={a.relatedStepId}
          onChange={(relatedStepId) => setA({ ...a, relatedStepId })}
        />
        <Field label="وضعیت دارایی">
          <select
            value={a.status}
            onChange={(e) =>
              setA({ ...a, status: e.target.value as Asset["status"] })
            }
          >
            <option value="draft">پیش‌نویس</option>
            <option value="ready">آماده</option>
          </select>
        </Field>
        {error && <p role="alert">{error}</p>}
        <Button type="submit">ذخیره دارایی</Button>
      </form>
    </Drawer>
  );
}
