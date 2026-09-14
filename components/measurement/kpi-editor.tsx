"use client";
import { useState } from "react";
import { Drawer, Field, Button } from "@/components/system/ui";
import { RoleField } from "@/components/process-standards/shared";
import {
  directions,
  frequencies,
  type ProcessKPI,
} from "@/lib/system/measurement/model";
import { kpiIssues } from "@/lib/system/measurement/kpis";
import { useSystem } from "@/components/system/provider";
export function KPIEditor({
  initial,
  onSave,
  onClose,
}: {
  initial: ProcessKPI;
  onSave: (k: ProcessKPI) => void;
  onClose: () => void;
}) {
  const [k, set] = useState(initial),
    [error, setError] = useState(""),
    { data } = useSystem(),
    field = <K extends keyof ProcessKPI>(key: K, value: ProcessKPI[K]) =>
      set({ ...k, [key]: value });
  return (
    <Drawer
      open
      onClose={onClose}
      title="تعریف شاخص عملکرد"
      description="خط مبنا و هدف را تعریف کنید؛ مقدار فعلی از تاریخچه اندازه‌گیری محاسبه می‌شود."
    >
      <form
        className="sys-form"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            if (k.status === "active" && kpiIssues(k, data).length)
              throw new Error(kpiIssues(k, data).join(" "));
            onSave({ ...k, updatedAt: new Date().toISOString() });
            onClose();
          } catch (e) {
            setError(e instanceof Error ? e.message : "ذخیره نشد.");
          }
        }}
      >
        <Field label="نام شاخص">
          <input
            required
            value={k.name}
            onChange={(e) => field("name", e.target.value)}
          />
        </Field>
        <Field label="توضیح شاخص">
          <textarea
            value={k.description}
            onChange={(e) => field("description", e.target.value)}
          />
        </Field>
        <RoleField
          label="مالک شاخص"
          value={k.ownerRoleId}
          onChange={(v) => field("ownerRoleId", v)}
        />
        <Field label="واحد اندازه‌گیری">
          <input
            value={k.unit}
            onChange={(e) => field("unit", e.target.value)}
          />
        </Field>
        <Field label="جهت شاخص">
          <select
            value={k.direction}
            onChange={(e) =>
              field("direction", e.target.value as ProcessKPI["direction"])
            }
          >
            {Object.entries(directions).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        {(["baselineValue", "targetValue", "tolerance", "weight"] as const).map(
          (key, i) => (
            <Field
              key={key}
              label={
                [
                  "خط مبنا",
                  "هدف",
                  "تلورانس مطلق (حفظ سطح)",
                  "وزن (اختیاری؛ مجموع فعال‌ها ۱۰۰)",
                ][i]
              }
            >
              <input
                type="number"
                step="any"
                min={
                  key === "tolerance" ? 0 : key === "weight" ? 0.001 : undefined
                }
                max={key === "weight" ? 100 : undefined}
                value={k[key] ?? ""}
                onChange={(e) =>
                  field(
                    key,
                    e.target.value === ""
                      ? key === "tolerance"
                        ? 0
                        : null
                      : Number(e.target.value),
                  )
                }
              />
            </Field>
          ),
        )}
        <Field label="تناوب اندازه‌گیری">
          <select
            value={k.frequency}
            onChange={(e) =>
              field("frequency", e.target.value as ProcessKPI["frequency"])
            }
          >
            {Object.entries(frequencies).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="وضعیت شاخص">
          <select
            value={k.status}
            onChange={(e) =>
              field("status", e.target.value as ProcessKPI["status"])
            }
          >
            <option value="draft">پیش‌نویس</option>
            <option value="active">فعال</option>
            <option value="archived">بایگانی</option>
          </select>
        </Field>
        <Button type="submit">ذخیره شاخص</Button>
        {error && <p role="alert">{error}</p>}
      </form>
    </Drawer>
  );
}
