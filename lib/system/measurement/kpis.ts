import type { ProcessKPI, KPIEntry, MeasurementRecord } from "./model";
import type { SystemData } from "../types";
export const clamp = (n: number) => Math.max(0, Math.min(100, n));
export function kpiIssues(k: ProcessKPI, system?: SystemData) {
  const issues: string[] = [];
  if (!k.name.trim() || !k.unit.trim()) issues.push("نام و واحد لازم است.");
  if (
    !k.ownerRoleId ||
    (system && !system.roles.some((r) => r.id === k.ownerRoleId))
  )
    issues.push("مالک شاخص معتبر نیست.");
  if (k.baselineValue === null || k.targetValue === null)
    issues.push("خط مبنا و هدف لازم است.");
  else {
    if (k.direction === "increase" && k.targetValue <= k.baselineValue)
      issues.push("هدف افزایشی باید بیشتر از خط مبنا باشد.");
    if (k.direction === "decrease" && k.targetValue >= k.baselineValue)
      issues.push("هدف کاهشی باید کمتر از خط مبنا باشد.");
    if (
      k.direction === "binary" &&
      (![0, 1].includes(k.targetValue) || ![0, 1].includes(k.baselineValue))
    )
      issues.push("خط مبنا و هدف بله/خیر باید صفر یا یک باشد.");
  }
  return issues;
}
export function kpiScore(k: ProcessKPI, value: number): number | null {
  if (kpiIssues(k).length || !Number.isFinite(value)) return null;
  const b = k.baselineValue!,
    t = k.targetValue!;
  if (k.direction === "binary")
    return [0, 1].includes(value) ? (value === t ? 100 : 0) : null;
  if (k.direction === "maintain") {
    const distance = Math.abs(value - t);
    return distance <= k.tolerance
      ? 100
      : k.tolerance === 0
        ? 0
        : clamp(100 * (1 - (distance - k.tolerance) / k.tolerance));
  }
  return clamp((100 * (value - b)) / (t - b));
}
export function history(k: ProcessKPI, entries: KPIEntry[]) {
  return entries
    .filter((e) => e.kpiId === k.id && e.processId === k.processId)
    .sort(
      (a, b) =>
        a.periodDate.localeCompare(b.periodDate) ||
        a.enteredAt.localeCompare(b.enteredAt) ||
        a.id.localeCompare(b.id),
    );
}
export function kpiState(k: ProcessKPI, entries: KPIEntry[]) {
  const ordered = history(k, entries),
    current = ordered.at(-1),
    previous = ordered.at(-2),
    score = current ? kpiScore(k, current.value) : null;
  let trend = "داده کافی نیست";
  if (current && previous) {
    const a = kpiScore(k, previous.value),
      b = score;
    if (a !== null && b !== null) {
      let delta = b - a;
      if (k.direction === "increase") delta = current.value - previous.value;
      if (k.direction === "decrease") delta = previous.value - current.value;
      if (k.direction === "maintain")
        delta =
          Math.max(0, Math.abs(previous.value - k.targetValue!) - k.tolerance) -
          Math.max(0, Math.abs(current.value - k.targetValue!) - k.tolerance);
      trend =
        Math.abs(delta) < 1e-9
          ? "ثابت"
          : delta > 0
            ? "رو به بهبود"
            : "رو به افت";
    }
  }
  return { ordered, current, previous, score, trend };
}
export const scoreLabel = (score: number | null) =>
  score === null
    ? "داده ناکافی"
    : score >= 100
      ? "هدف محقق شده"
      : score >= 80
        ? "نزدیک هدف"
        : score >= 60
          ? "در مسیر"
          : score >= 40
            ? "نیازمند اقدام"
            : "بحرانی";
export function weightedPerformance(r: MeasurementRecord, system?: SystemData) {
  const active = r.kpis.filter((k) => k.status === "active"),
    issues: string[] = [];
  if (!active.length) issues.push("شاخص فعال وجود ندارد.");
  const custom = active.some((k) => k.weight !== null);
  if (
    custom &&
    (active.some((k) => k.weight === null || k.weight <= 0) ||
      Math.abs(active.reduce((n, k) => n + (k.weight ?? 0), 0) - 100) > 0.001)
  )
    issues.push(
      "وزن همه شاخص‌های فعال باید مثبت و مجموع آن‌ها ۱۰۰ باشد؛ یا همه وزن‌ها خالی باشند.",
    );
  for (const k of active) {
    issues.push(...kpiIssues(k, system).map((x) => `${k.name}: ${x}`));
    if (kpiState(k, r.entries).score === null)
      issues.push(`${k.name}: اندازه‌گیری معتبر لازم است.`);
  }
  const score = issues.length
    ? null
    : active.reduce(
        (n, k) =>
          n +
          kpiState(k, r.entries).score! *
            (custom ? k.weight! / 100 : 1 / active.length),
        0,
      );
  return { score, issues, active, custom };
}
export function kpiGap(k: ProcessKPI, entries: KPIEntry[]) {
  const state = kpiState(k, entries);
  return state.score !== null && state.score < 60
    ? {
        title: `بهبود ${k.name}`,
        description: `مقدار فعلی ${state.current!.value} ${k.unit}؛ هدف ${k.targetValue} ${k.unit}.`,
        priority: state.score < 40 ? ("critical" as const) : ("high" as const),
        sourceKey: `kpi:${k.id}`,
        relatedKpiId: k.id,
      }
    : null;
}
