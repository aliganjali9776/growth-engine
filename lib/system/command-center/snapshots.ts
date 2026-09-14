import type { ComponentKey } from "./aggregation";
import type { CommandReport } from "./report";
export const SNAPSHOT_KEY = "growth-engine.system-health-history.v1";
export const componentKeys: ComponentKey[] = [
  "processHealth",
  "standardization",
  "adoption",
  "kpi",
  "independence",
  "improvement",
  "ownership",
];
export type SystemHealthSnapshot = {
  id: string;
  date: string;
  systemHealth: number;
  completeness: number;
  usedWeight: number;
  processCount: number;
  formulaVersion?: 1 | 2;
} & Record<ComponentKey, number | null>;
export interface SnapshotStore {
  version: 1;
  snapshots: SystemHealthSnapshot[];
}
const value = (x: unknown) =>
  typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= 100;
export function parseSnapshots(raw: string): SnapshotStore {
  const v = JSON.parse(raw);
  if (
    !v ||
    v.version !== 1 ||
    !Array.isArray(v.snapshots) ||
    new Set(v.snapshots.map((x: unknown) => (x as SystemHealthSnapshot)?.id))
      .size !== v.snapshots.length
  )
    throw new Error("تاریخچه سلامت معتبر نیست؛ داده قبلی حفظ شد.");
  for (const x of v.snapshots) {
    if (
      !x ||
      typeof x.id !== "string" ||
      !x.id ||
      typeof x.date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T/.test(x.date) ||
      !Number.isFinite(Date.parse(x.date)) ||
      new Date(x.date).toISOString() !== x.date ||
      !value(x.systemHealth) ||
      !value(x.completeness) ||
      !value(x.usedWeight) ||
      x.usedWeight === 0 ||
      !Number.isInteger(x.processCount) ||
      x.processCount <= 0 ||
      (x.formulaVersion !== undefined &&
        x.formulaVersion !== 1 &&
        x.formulaVersion !== 2) ||
      componentKeys.some((k) => x[k] !== null && !value(x[k]))
    )
      throw new Error("تاریخچه سلامت معتبر نیست؛ داده قبلی حفظ شد.");
  }
  return v;
}
export function createSnapshot(
  report: CommandReport,
  date = new Date().toISOString(),
): SystemHealthSnapshot {
  if (report.health.score === null || !report.rows.length)
    throw new Error("ابتدا داده کافی برای محاسبه سلامت ثبت کنید.");
  const components = Object.fromEntries(
    report.health.components.map((c) => [c.key, c.value]),
  ) as Record<ComponentKey, number | null>;
  return {
    id: crypto.randomUUID(),
    date,
    systemHealth: report.health.score,
    completeness: report.health.completeness,
    usedWeight: report.health.usedWeight,
    processCount: report.rows.length,
    formulaVersion: 2,
    ...components,
  };
}
export type Period = "all" | "30d" | "quarter";
export function inPeriod(date: string, period: Period, day: string) {
  const d = new Date(date).toLocaleDateString("en-CA", {
    timeZone: "Asia/Tehran",
  });
  if (d > day) return false;
  if (period === "all") return true;
  const start =
    period === "30d"
      ? new Date(Date.parse(day) - 29 * 86400000).toISOString().slice(0, 10)
      : `${day.slice(0, 4)}-${String(Math.floor((Number(day.slice(5, 7)) - 1) / 3) * 3 + 1).padStart(2, "0")}-01`;
  return d >= start;
}
export function snapshotTrend(snapshots: SystemHealthSnapshot[]) {
  const latest = [...snapshots]
    .sort((a, b) => a.date.localeCompare(b.date))
    .at(-1);
  const sorted = snapshots
      .filter((x) => (x.formulaVersion ?? 1) === (latest?.formulaVersion ?? 1))
      .sort((a, b) => a.date.localeCompare(b.date)),
    current = sorted.at(-1),
    previous = sorted.at(-2);
  if (!current || !previous) return null;
  const delta = current.systemHealth - previous.systemHealth;
  return {
    current,
    previous,
    delta,
    label: delta > 0 ? "رو به بهبود" : delta < 0 ? "رو به افت" : "ثابت",
    coverageChanged:
      current.completeness !== previous.completeness ||
      current.usedWeight !== previous.usedWeight ||
      current.processCount !== previous.processCount ||
      componentKeys.some(
        (k) => (current[k] === null) !== (previous[k] === null),
      ),
    changes: componentKeys.map((key) => ({
      key,
      before: previous[key],
      after: current[key],
      delta:
        previous[key] === null || current[key] === null
          ? null
          : current[key]! - previous[key]!,
    })),
  };
}
