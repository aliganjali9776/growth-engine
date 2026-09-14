import {
  directions,
  frequencies,
  improvementSources,
  improvementStatuses,
  type MeasurementStore,
} from "./model";
export const MEASUREMENT_KEY = "growth-engine.process-measurement.v1";
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === "string";
const num = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);
const strings = (v: unknown) => Array.isArray(v) && v.every(text);
const fields = (v: Record<string, unknown>, keys: string[]) =>
  keys.every((k) => text(v[k]));
const stamp = (v: unknown) => text(v) && Number.isFinite(Date.parse(v));
export const validDay = (v: unknown): v is string =>
  text(v) &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  Number.isFinite(Date.parse(v)) &&
  new Date(v).toISOString().slice(0, 10) === v;
const unique = (v: unknown): v is Record<string, unknown>[] =>
  Array.isArray(v) &&
  v.every(object) &&
  v.every((x) => text(x.id) && !!x.id) &&
  new Set(v.map((x) => x.id)).size === v.length;
const member = (v: unknown, values: object) =>
  text(v) && Object.hasOwn(values, v);
export function parseMeasurement(raw: string) {
  return validateMeasurement(JSON.parse(raw));
}
export function validateMeasurement(v: unknown): MeasurementStore {
  const fail = (): never => {
    throw new Error(
      "اطلاعات اندازه‌گیری یا بهبود معتبر نیست؛ داده قبلی حفظ شد.",
    );
  };
  if (
    !object(v) ||
    v.version !== 1 ||
    !Array.isArray(v.records) ||
    !v.records.every(object) ||
    new Set(v.records.map((r) => r.processId)).size !== v.records.length
  )
    return fail();
  for (const r of v.records as Record<string, unknown>[]) {
    if (
      !text(r.processId) ||
      !r.processId ||
      !unique(r.kpis) ||
      !unique(r.entries) ||
      !unique(r.improvements) ||
      !unique(r.reviews) ||
      [r.measuredAt, r.improvingAt].some((x) => x !== undefined && !stamp(x))
    )
      fail();
    for (const k of r.kpis as Record<string, unknown>[]) {
      if (
        k.processId !== r.processId ||
        !fields(k, ["name", "description", "ownerRoleId", "unit"]) ||
        !member(k.direction, directions) ||
        !member(k.frequency, frequencies) ||
        !["draft", "active", "archived"].includes(k.status as string) ||
        ![k.baselineValue, k.targetValue].every((x) => x === null || num(x)) ||
        !num(k.tolerance) ||
        k.tolerance < 0 ||
        !(
          k.weight === null ||
          (num(k.weight) && k.weight > 0 && k.weight <= 100)
        ) ||
        !stamp(k.createdAt) ||
        !stamp(k.updatedAt)
      )
        fail();
    }
    const periods = new Set<string>();
    for (const e of r.entries as Record<string, unknown>[]) {
      const k = (r.kpis as Record<string, unknown>[]).find(
        (k) => k.id === e.kpiId,
      );
      if (
        e.processId !== r.processId ||
        !k ||
        !validDay(e.periodDate) ||
        !num(e.value) ||
        !text(e.note) ||
        !stamp(e.enteredAt) ||
        !["high", "medium", "low"].includes(e.confidence as string) ||
        (k.direction === "binary" && ![0, 1].includes(e.value as number))
      )
        fail();
      const key = `${e.kpiId}:${e.periodDate}`;
      if (periods.has(key)) fail();
      periods.add(key);
    }
    for (const x of r.improvements as Record<string, unknown>[]) {
      if (
        x.processId !== r.processId ||
        !fields(x, [
          "title",
          "description",
          "sourceKey",
          "relatedStepId",
          "relatedKpiId",
          "ownerRoleId",
          "dueDate",
          "expectedImpact",
          "actualImpact",
          "notes",
        ]) ||
        !member(x.source, improvementSources) ||
        !member(x.status, improvementStatuses) ||
        !["critical", "high", "medium", "low"].includes(x.priority as string) ||
        !stamp(x.createdAt) ||
        (x.completedAt !== undefined && !stamp(x.completedAt)) ||
        (x.dueDate !== "" && !validDay(x.dueDate)) ||
        (x.relatedKpiId !== "" &&
          !(r.kpis as Record<string, unknown>[]).some(
            (k) => k.id === x.relatedKpiId,
          ))
      )
        fail();
    }
    for (const x of r.reviews as Record<string, unknown>[]) {
      if (
        x.processId !== r.processId ||
        !fields(x, ["summary", "founderChanges", "reviewedByRoleId"]) ||
        !validDay(x.periodStart) ||
        !validDay(x.periodEnd) ||
        (x.periodStart as string) > (x.periodEnd as string) ||
        !["wins", "problems", "blockers", "decisions", "nextActions"].every(
          (k) => strings(x[k]),
        ) ||
        !stamp(x.createdAt)
      )
        fail();
    }
  }
  return v as unknown as MeasurementStore;
}
