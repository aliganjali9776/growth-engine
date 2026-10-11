import {
  emptyMeasurement,
  type ImprovementItem,
  type ProcessKPI,
  type MeasurementStore,
} from "./model";
import { MEASUREMENT_KEY, validateMeasurement } from "./persistence";
import { validateSystem } from "../persistence";
import type { SystemData } from "../types";
import { kpiIssues } from "./kpis";
import { writeTogether } from "../storage-transaction";
export function createMeasurementItem(
  store: MeasurementStore,
  system: SystemData,
  kind: "improvements" | "kpis",
  item: ImprovementItem | ProcessKPI,
) {
  validateSystem(system);
  if (!system.processes.some((p) => p.id === item.processId))
    throw Error("فرآیند معتبر لازم است.");
  if (
    store.records.some((r) =>
      [...r.kpis, ...r.improvements].some((x) => x.id === item.id),
    )
  )
    throw Error("شناسه رکورد تکراری است.");
  if (kind === "kpis") {
    const issues = kpiIssues(item as ProcessKPI, system);
    if (issues.length) throw Error(issues.join(" "));
  }
  const next = structuredClone(store),
    record =
      next.records.find((r) => r.processId === item.processId) ??
      emptyMeasurement(item.processId);
  if (!next.records.includes(record)) next.records.push(record);
  if (kind === "kpis") record.kpis.push(item as ProcessKPI);
  else record.improvements.push(item as ImprovementItem);
  return validateMeasurement(next);
}
export function persistMeasurement(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
  next: MeasurementStore,
  expected: string | null,
) {
  const raw = JSON.stringify(validateMeasurement(next));
  writeTogether(storage, [{ key: MEASUREMENT_KEY, expected, value: raw }]);
  return raw;
}
