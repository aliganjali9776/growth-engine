"use client";
import { useState } from "react";
import { StorageRecovery } from "../system/recovery";
import { Panel, Button, Field } from "@/components/system/ui";
import { ConfirmButton, number } from "@/components/measurement/shared";
import {
  createSnapshot,
  inPeriod,
  snapshotTrend,
  SNAPSHOT_KEY,
  parseSnapshots,
  type Period,
} from "@/lib/system/command-center/snapshots";
import type { CommandReport } from "@/lib/system/command-center/report";
import type { useSnapshots } from "./use-snapshots";
export function PeriodFilter({
  value,
  onChange,
}: {
  value: Period;
  onChange: (v: Period) => void;
}) {
  return (
    <Field label="دوره روند و تکمیل اقدامات">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Period)}
      >
        <option value="all">همه</option>
        <option value="30d">۳۰ روز اخیر</option>
        <option value="quarter">فصل جاری میلادی</option>
      </select>
    </Field>
  );
}
export function SystemHealthTrend({
  report: r,
  history: h,
  period,
  disabled,
}: {
  report: CommandReport;
  history: ReturnType<typeof useSnapshots>;
  period: Period;
  disabled: boolean;
}) {
  const [status, setStatus] = useState(""),
    snapshots =
      h.store?.snapshots.filter((x) => inPeriod(x.date, period, r.day)) ?? [],
    trend = snapshotTrend(snapshots);
  return (
    <Panel
      title="روند سلامت سیستم"
      caption="فقط وضعیت‌هایی که به‌صورت دستی ثبت کرده‌اید؛ هیچ تاریخچه فرضی ساخته نمی‌شود."
    >
      <Button
        disabled={disabled || !h.store || r.health.score === null || !!h.error}
        onClick={() => {
          try {
            h.append(createSnapshot(r));
            setStatus("وضعیت فعلی ثبت شد.");
          } catch (e) {
            setStatus(e instanceof Error ? e.message : "ثبت نشد.");
          }
        }}
      >
        ثبت وضعیت امروز
      </Button>
      <p role="status">{status}</p>
      {h.error && (
        <p role="alert" className="sys-alert">
          {h.error}
        </p>
      )}
      {h.error && !h.store && (
        <StorageRecovery
          storageKey={SNAPSHOT_KEY}
          label="تاریخچه سلامت"
          validate={parseSnapshots}
        />
      )}
      <p>
        هر ثبت، مستقل و غیرقابل ویرایش است؛ چند ثبت در یک روز با زمان دقیق
        نگهداری می‌شوند.
      </p>
      {!trend ? (
        <p>
          برای نمایش روند، حداقل دو وضعیت با نسخه یکسان فرمول لازم است. ثبت‌های
          قدیمی حفظ می‌شوند و با فرمول جدید مقایسه نمی‌شوند.
        </p>
      ) : (
        <div className="command-trend">
          <strong>
            {number(trend.previous.systemHealth)} ←{" "}
            {number(trend.current.systemHealth)}
          </strong>
          <p>
            {trend.label} · تغییر {number(trend.delta)} امتیاز
          </p>
          {trend.coverageChanged && (
            <p className="sys-alert">
              پوشش داده یا ترکیب مؤلفه‌ها تغییر کرده است؛ تغییر امتیاز صرفاً به
              معنی تغییر عملکرد نیست.
            </p>
          )}
          <ul>
            {trend.changes
              .filter((x) => x.before !== x.after)
              .map((x) => (
                <li key={x.key}>
                  {r.health.components.find((c) => c.key === x.key)?.label}:{" "}
                  {number(x.before)} ← {number(x.after)}{" "}
                  {x.delta === null
                    ? "(پوشش داده تغییر کرده)"
                    : `(${number(x.delta)})`}
                </li>
              ))}
          </ul>
        </div>
      )}
      <div className="command-table">
        <table>
          <thead>
            <tr>
              <th>تاریخ و زمان ثبت</th>
              <th>سلامت</th>
              <th>نسخه فرمول</th>
              <th>کامل‌بودن داده</th>
              <th>وزن قابل محاسبه</th>
              <th>مدیریت</th>
            </tr>
          </thead>
          <tbody>
            {[...snapshots].reverse().map((x) => (
              <tr key={x.id}>
                <td>
                  {new Date(x.date).toLocaleString("fa-IR", {
                    timeZone: "Asia/Tehran",
                  })}
                </td>
                <td>{number(x.systemHealth)}</td>
                <td>{number(x.formulaVersion ?? 1)}</td>
                <td>{number(x.completeness)}٪</td>
                <td>{number(x.usedWeight)}٪</td>
                <td>
                  <ConfirmButton
                    label="حذف وضعیت ثبت‌شده"
                    description="این وضعیت تاریخی از همین مرورگر حذف می‌شود؛ داده عملیاتی تغییر نمی‌کند."
                    onConfirm={() => h.remove(x.id)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
