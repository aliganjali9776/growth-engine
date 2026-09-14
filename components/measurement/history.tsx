"use client";
import { useState } from "react";
import { Drawer, Field, Button } from "@/components/system/ui";
import {
  today,
  type KPIEntry,
  type ProcessKPI,
} from "@/lib/system/measurement/model";
import { history } from "@/lib/system/measurement/kpis";
import { ConfirmButton, number } from "./shared";
export function EntryEditor({
  initial,
  onSave,
  onClose,
  binary,
}: {
  initial: KPIEntry;
  onSave: (x: KPIEntry) => void;
  onClose: () => void;
  binary: boolean;
}) {
  const [x, set] = useState(initial),
    [error, setError] = useState("");
  return (
    <Drawer
      open
      onClose={onClose}
      title="ثبت اندازه‌گیری"
      description="هر شاخص در هر تاریخ یک اندازه‌گیری دارد؛ برای اصلاح، همان ردیف را ویرایش کنید."
    >
      <form
        className="sys-form"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            onSave(x);
            onClose();
          } catch (e) {
            setError(e instanceof Error ? e.message : "ثبت نشد.");
          }
        }}
      >
        <Field label="تاریخ دوره">
          <input
            required
            type="date"
            max={today()}
            value={x.periodDate}
            onChange={(e) => set({ ...x, periodDate: e.target.value })}
          />
        </Field>
        <Field label="مقدار اندازه‌گیری">
          <input
            required
            type="number"
            step={binary ? "1" : "any"}
            min={binary ? 0 : undefined}
            max={binary ? 1 : undefined}
            value={x.value}
            onChange={(e) => set({ ...x, value: Number(e.target.value) })}
          />
        </Field>
        <Field label="اطمینان به داده">
          <select
            value={x.confidence}
            onChange={(e) =>
              set({
                ...x,
                confidence: e.target.value as KPIEntry["confidence"],
              })
            }
          >
            <option value="high">زیاد</option>
            <option value="medium">متوسط</option>
            <option value="low">کم</option>
          </select>
        </Field>
        <Field label="یادداشت اندازه‌گیری">
          <textarea
            value={x.note}
            onChange={(e) => set({ ...x, note: e.target.value })}
          />
        </Field>
        <Button type="submit">ذخیره اندازه‌گیری</Button>
        {error && <p role="alert">{error}</p>}
      </form>
    </Drawer>
  );
}
export function KPIHistory({
  k,
  entries,
  onEdit,
  onDelete,
}: {
  k: ProcessKPI;
  entries: KPIEntry[];
  onEdit: (x: KPIEntry) => void;
  onDelete: (x: KPIEntry) => void;
}) {
  const rows = history(k, entries);
  return (
    <details className="measurement-history">
      <summary>تاریخچه اندازه‌گیری · {number(rows.length)} مورد</summary>
      {rows.length >= 3 && (
        <KPITrend values={rows.map((x) => x.value)} name={k.name} />
      )}
      <div className="measurement-table">
        <table>
          <thead>
            <tr>
              <th>تاریخ</th>
              <th>مقدار</th>
              <th>یادداشت / اطمینان</th>
              <th>مدیریت</th>
            </tr>
          </thead>
          <tbody>
            {[...rows].reverse().map((x) => (
              <tr key={x.id}>
                <td dir="ltr">{x.periodDate}</td>
                <td>
                  {number(x.value)} {k.unit}
                </td>
                <td>
                  {x.note} ·{" "}
                  {{ high: "زیاد", medium: "متوسط", low: "کم" }[x.confidence]}
                </td>
                <td>
                  <Button secondary onClick={() => onEdit(x)}>
                    ویرایش اندازه‌گیری
                  </Button>
                  <ConfirmButton
                    label="حذف اندازه‌گیری"
                    description="این اندازه‌گیری دستی حذف می‌شود و مقدار فعلی و روند دوباره محاسبه خواهند شد."
                    onConfirm={() => onDelete(x)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && <p>هنوز اندازه‌گیری ثبت نشده است.</p>}
    </details>
  );
}
function KPITrend({ values, name }: { values: number[]; name: string }) {
  const min = Math.min(...values),
    max = Math.max(...values),
    points = values
      .map(
        (v, i) =>
          `${10 + (i * 280) / (values.length - 1)},${70 - ((v - min) / (max - min || 1)) * 60}`,
      )
      .join(" ");
  return (
    <figure className="measurement-trend">
      <svg
        viewBox="0 0 300 80"
        role="img"
        aria-label={`روند مقادیر ${name}؛ ${values.join("، ")}`}
      >
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        />
      </svg>
      <figcaption>
        از قدیمی به جدید · فاصله نقاط نشان‌دهنده فاصله زمانی نیست.
      </figcaption>
    </figure>
  );
}
