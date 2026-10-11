"use client";
import { Field } from "@/components/system/ui";
import { useScale } from "./provider";
export const fa = (v: number | null | undefined) =>
  v == null
    ? "نامشخص"
    : v.toLocaleString("fa-IR", { maximumFractionDigits: 1 });
export function Options({ items }: { items: Record<string, string> }) {
  return Object.entries(items).map(([value, label]) => (
    <option key={value} value={value}>
      {label}
    </option>
  ));
}
export function Select({
  label,
  value,
  items,
  onChange,
  empty,
}: {
  label: string;
  value: string;
  items: Record<string, string>;
  onChange: (v: string) => void;
  empty?: string;
}) {
  return (
    <Field label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {empty !== undefined && <option value="">{empty}</option>}
        {value && !Object.hasOwn(items, value) && (
          <option value={value}>پیوند قبلی؛ منبع در دسترس نیست</option>
        )}
        <Options items={items} />
      </select>
    </Field>
  );
}
export function Text({
  label,
  value,
  onChange,
  area = false,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  area?: boolean;
  required?: boolean;
}) {
  return (
    <Field label={label}>
      {area ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          maxLength={10000}
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          maxLength={10000}
        />
      )}
    </Field>
  );
}
export function Owner({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const { sources } = useScale();
  return (
    <Select
      label="نقش مسئول"
      value={value}
      onChange={onChange}
      items={Object.fromEntries(sources.roles.map((r) => [r.id, r.title]))}
      empty="بدون نقش / ناشناخته"
    />
  );
}
export function Numeric({
  label,
  value,
  onChange,
  max,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  max?: number;
}) {
  return (
    <Field label={label}>
      <input
        type="number"
        min="0"
        max={max}
        step="any"
        value={value ?? ""}
        placeholder="نامشخص"
        onChange={(e) =>
          onChange(e.target.value === "" ? null : Number(e.target.value))
        }
      />
    </Field>
  );
}
