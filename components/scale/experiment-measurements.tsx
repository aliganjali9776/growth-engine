"use client";
import { useState } from "react";
import { Button, Field, Panel } from "@/components/system/ui";
import { useScale } from "./provider";
import { Text, Select, Numeric, fa } from "./shared";
import {
  type GrowthExperiment,
  experimentData,
} from "@/lib/scale/experiments/model";
import {
  metricFor,
  measurementsFor,
  measurementDelta,
  tehranDay,
} from "@/lib/scale/experiments/logic";
import { addMeasurement } from "@/lib/scale/experiments/mutations";
export function Measurements({
  experiment: e,
}: {
  experiment: GrowthExperiment;
}) {
  const { store, commit } = useScale(),
    [metric, setMetric] = useState(e.primaryMetricId),
    [value, setValue] = useState<number | null>(null),
    [date, setDate] = useState(tehranDay()),
    [note, setNote] = useState(""),
    [source, setSource] = useState(""),
    [error, setError] = useState("");
  const rows = measurementsFor(store, e, metric),
    m = metricFor(store, e, metric),
    baseline = metric === e.primaryMetricId ? e.baselineValue : null;
  const values = [
      ...rows.map((r) => r.value),
      ...(baseline !== null ? [baseline] : []),
      ...(metric === e.primaryMetricId && e.targetValue !== null
        ? [e.targetValue]
        : []),
      ...(metric === e.primaryMetricId && e.minimumSuccessThreshold !== null
        ? [e.minimumSuccessThreshold]
        : []),
    ],
    min = Math.min(...values),
    max = Math.max(...values),
    y = (v: number) => 160 - (130 * (v - min)) / (max - min || 1);
  return (
    <Panel
      title="مشاهدات و روند"
      caption="مقادیر دوره‌ها باید هم‌واحد و هم‌اندازه باشند؛ این نمودار انتساب یا معنی‌داری آماری را اثبات نمی‌کند."
    >
      <Select
        label="نمایش شاخص مشاهده"
        value={metric}
        items={Object.fromEntries(
          [e.primaryMetricId, ...e.secondaryMetricIds].map((id) => [
            id,
            metricFor(store, e, id)?.name ?? "نامشخص",
          ]),
        )}
        onChange={setMetric}
      />
      {e.status === "running" && (
        <form
          onSubmit={(ev) => {
            ev.preventDefault();
            try {
              if (value === null) throw Error("مقدار مشاهده را ثبت کنید.");
              commit(
                addMeasurement(store, {
                  id: crypto.randomUUID(),
                  experimentId: e.id,
                  metricId: metric,
                  measurementDate: date,
                  value,
                  note,
                  source,
                  createdAt: new Date().toISOString(),
                }),
              );
              setValue(null);
              setNote("");
              setError("");
            } catch (x) {
              setError(x instanceof Error ? x.message : "ثبت نشد");
            }
          }}
        >
          <div className="scale-grid">
            <Field label="تاریخ مشاهده">
              <input
                type="date"
                value={date}
                onInput={(ev) => setDate(ev.currentTarget.value)}
                required
              />
            </Field>
            <Numeric
              label={`مقدار مشاهده (${m?.unit ?? ""})`}
              value={value}
              onChange={setValue}
            />
          </div>
          <Text
            label="یادداشت مشاهده / دوره پوشش"
            value={note}
            onChange={setNote}
          />
          <Text label="منبع مشاهده" value={source} onChange={setSource} />
          {error && <p role="alert">{error}</p>}
          <Button type="submit">ثبت مشاهده</Button>
        </form>
      )}
      {rows.length > 0 ? (
        <>
          <svg
            viewBox="0 0 600 190"
            role="img"
            aria-label="روند مشاهدات به ترتیب ثبت؛ جزئیات در جدول زیر"
            className="scale-trend"
          >
            {baseline !== null && (
              <line
                x1="25"
                x2="575"
                y1={y(baseline)}
                y2={y(baseline)}
                stroke="#8b9297"
                strokeDasharray="4"
              />
            )}
            {metric === e.primaryMetricId && e.targetValue !== null && (
              <line
                x1="25"
                x2="575"
                y1={y(e.targetValue)}
                y2={y(e.targetValue)}
                stroke="#b59a60"
                strokeDasharray="6"
              />
            )}
            {metric === e.primaryMetricId &&
              e.minimumSuccessThreshold !== null && (
                <line
                  x1="25"
                  x2="575"
                  y1={y(e.minimumSuccessThreshold)}
                  y2={y(e.minimumSuccessThreshold)}
                  stroke="#64998a"
                  strokeDasharray="2"
                />
              )}
            <polyline
              fill="none"
              stroke="#153247"
              strokeWidth="3"
              points={rows
                .map(
                  (r, i) =>
                    `${30 + (i * 540) / Math.max(1, rows.length - 1)},${y(r.value)}`,
                )
                .join(" ")}
            />
            {rows.map((r, i) => (
              <circle
                key={r.id}
                cx={30 + (i * 540) / Math.max(1, rows.length - 1)}
                cy={y(r.value)}
                r="4"
                fill="#153247"
              >
                <title>
                  {r.measurementDate}: {fa(r.value)}
                </title>
              </circle>
            ))}
          </svg>
          <p>
            خط خاکستری: مبنا {fa(baseline)} · طلایی: هدف{" "}
            {metric === e.primaryMetricId ? fa(e.targetValue) : "—"} · سبز:
            حداقل{" "}
            {metric === e.primaryMetricId ? fa(e.minimumSuccessThreshold) : "—"}
          </p>
          <div
            className="scale-table"
            tabIndex={0}
            role="region"
            aria-label="تاریخچه مشاهدات"
          >
            <table>
              <thead>
                <tr>
                  <th>تاریخ</th>
                  <th>مقدار</th>
                  <th>تغییر با مبنا</th>
                  <th>تغییر با قبلی</th>
                  <th>یادداشت / منبع</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const delta = measurementDelta(
                    r.value,
                    baseline,
                    rows[i - 1]?.value ?? null,
                  );
                  return (
                    <tr key={r.id}>
                      <td>{r.measurementDate}</td>
                      <td>{fa(r.value)}</td>
                      <td>{fa(delta.baseline)}</td>
                      <td>{fa(delta.previous)}</td>
                      <td>
                        {r.note} · {r.source || "دستی"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p>هنوز مشاهده‌ای ثبت نشده است.</p>
      )}
    </Panel>
  );
}
