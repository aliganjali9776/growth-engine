"use client";
import { useState } from "react";
import { Field, Button } from "@/components/system/ui";
import { useSystem } from "@/components/system/provider";
import { useStandards } from "./provider";
export function RoleField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const { data } = useSystem();
  return (
    <Field label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">انتخاب نقش</option>
        {value && !data.roles.some((r) => r.id === value) && (
          <option value={value}>نقش حذف‌شده</option>
        )}
        {data.roles.map((r) => (
          <option value={r.id} key={r.id}>
            {r.title}
          </option>
        ))}
      </select>
    </Field>
  );
}
export function LinesField({
  label,
  values,
  onChange,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <Field label={label}>
      <textarea
        value={values.join("\n")}
        placeholder="هر مورد در یک خط"
        onChange={(e) => onChange(e.target.value.split("\n"))}
      />
    </Field>
  );
}
export function ConfirmAction({
  id,
  action,
  label,
  disabled,
  roleId,
}: {
  id: string;
  action: "sop" | "standardize" | "live" | "implement";
  label: string;
  disabled?: boolean;
  roleId?: string;
}) {
  const { confirm } = useStandards(),
    [open, setOpen] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="standard-confirm">
      <Button disabled={disabled} onClick={() => setOpen(true)}>
        {label}
      </Button>
      {open && (
        <div className="sys-alert">
          <p>
            «{label}» برای همین نسخه ثبت شود؟ این تأیید به‌صورت دستی در همین
            مرورگر ثبت می‌شود.
          </p>
          <Button
            onClick={() => {
              try {
                confirm(id, action, roleId);
                setOpen(false);
                setError("");
              } catch (e) {
                setError(e instanceof Error ? e.message : "ثبت انجام نشد.");
              }
            }}
          >
            تأیید و ثبت
          </Button>
          <Button secondary onClick={() => setOpen(false)}>
            انصراف
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="sys-alert">
          {error}
        </p>
      )}
    </div>
  );
}
export function ProgressPanel({
  score,
  components,
  label,
}: {
  score: number;
  label: string;
  components: { label: string; weight: number; value: number }[];
}) {
  return (
    <section className="standard-progress">
      <div>
        <span>{label}</span>
        <strong>{score.toLocaleString("fa-IR")}٪</strong>
        <small>شاخص داخلی بر پایه اطلاعات ثبت‌شده</small>
      </div>
      <div>
        {components.map((c) => (
          <div key={c.label}>
            <span>
              {c.label} · وزن {c.weight.toLocaleString("fa-IR")}٪
            </span>
            <b>{Math.round(c.value * c.weight).toLocaleString("fa-IR")}</b>
            <progress value={c.value} max="1" />
          </div>
        ))}
      </div>
    </section>
  );
}
