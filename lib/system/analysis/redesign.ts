import type { ProcessMap } from "../maps/model";
import type { SystemData } from "../types";
import {
  mapMetrics,
  mapCompleteness,
  mapWarnings,
  founderStep,
} from "../maps/logic";
import { changeStage } from "../actions";
export interface Stamp {
  at: string;
  fingerprint: string;
}
export interface AnalysisRecord {
  processId: string;
  toBe?: ProcessMap;
  review?: Stamp;
  approval?: Stamp;
}
export interface AnalysisStore {
  version: 1;
  records: AnalysisRecord[];
}
export function cloneToBe(map: ProcessMap): ProcessMap {
  if (map.variant !== "as-is" || !map.steps.length)
    throw new Error("ابتدا نقشه وضعیت فعلی را ایجاد کنید.");
  return {
    ...structuredClone(map),
    variant: "to-be",
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
// Content signature excludes viewport positions/timestamps but includes current organization assignments.
export function fingerprint(map: ProcessMap, sys: SystemData) {
  return JSON.stringify({
    processId: map.processId,
    variant: map.variant,
    steps: map.steps
      .map(({ positionX, positionY, createdAt, updatedAt, ...s }) => s)
      .sort((a, b) => a.id.localeCompare(b.id)),
    connections: [...map.connections].sort((a, b) => a.id.localeCompare(b.id)),
    roles: sys.roles
      .filter((r) => map.steps.some((s) => s.ownerRoleId === r.id))
      .map((r) => ({
        id: r.id,
        personId: r.personId,
        isFounderRole: r.isFounderRole,
        departmentId: r.departmentId,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  });
}
export function updateFuture(
  record: AnalysisRecord,
  map: ProcessMap,
  sys: SystemData,
): AnalysisRecord {
  if (map.variant !== "to-be" || record.processId !== map.processId)
    throw new Error("نسخه یا شناسه فرآیند ناسازگار است.");
  return {
    ...record,
    toBe: {
      ...map,
      version: record.toBe
        ? (record.toBe.version ?? 1) +
          (fingerprint(record.toBe, sys) === fingerprint(map, sys) ? 0 : 1)
        : 1,
      updatedAt: new Date().toISOString(),
    },
    // Preserve the historical stamp; approvalCurrent detects changed content.
    approval: record.approval,
  };
}
export function reviewCurrent(
  record: AnalysisRecord | undefined,
  map: ProcessMap,
  sys: SystemData,
) {
  return record?.review?.fingerprint === fingerprint(map, sys);
}
export function approvalCurrent(
  record: AnalysisRecord | undefined,
  asis: ProcessMap,
  sys: SystemData,
) {
  return (
    !!record?.toBe &&
    record.approval?.fingerprint ===
      fingerprint(asis, sys) + "\n" + fingerprint(record.toBe, sys)
  );
}
export function redesignReadiness(map: ProcessMap, sys: SystemData) {
  const c = mapCompleteness(map, sys),
    warnings = mapWarnings(map, sys).filter((w) => w.code !== "founder");
  return {
    ready:
      map.variant === "to-be" &&
      c.ready &&
      c.time === 100 &&
      warnings.length === 0,
    warnings,
    coverage: c,
  };
}
export function confirmAnalysis(
  sys: SystemData,
  asis: ProcessMap,
  record: AnalysisRecord,
): { system: SystemData; record: AnalysisRecord } {
  if (record.processId !== asis.processId || asis.variant !== "as-is")
    throw new Error("نسخه یا شناسه فرآیند ناسازگار است.");
  const p = sys.processes.find((p) => p.id === asis.processId);
  if (
    !p ||
    ![
      "mapped",
      "analyzed",
      "redesigned",
      "standardized",
      "implemented",
      "measured",
      "improving",
    ].includes(p.systemizationStage) ||
    !mapCompleteness(asis, sys).ready
  )
    throw new Error(
      "ابتدا نقشه معنادار را تکمیل و مرحله مدل‌سازی را ثبت کنید.",
    );
  return {
    system:
      p.systemizationStage === "mapped"
        ? changeStage(sys, p.id, "analyzed")
        : sys,
    record: {
      ...record,
      review: {
        at: new Date().toISOString(),
        fingerprint: fingerprint(asis, sys),
      },
      approval: record.approval,
    },
  };
}
export function confirmRedesign(
  sys: SystemData,
  asis: ProcessMap,
  record: AnalysisRecord,
) {
  if (
    record.processId !== asis.processId ||
    asis.variant !== "as-is" ||
    record.toBe?.processId !== asis.processId
  )
    throw new Error("نسخه یا شناسه فرآیند ناسازگار است.");
  const p = sys.processes.find((p) => p.id === asis.processId);
  if (
    !p ||
    ![
      "analyzed",
      "redesigned",
      "standardized",
      "implemented",
      "measured",
      "improving",
    ].includes(p.systemizationStage) ||
    !record.toBe ||
    !redesignReadiness(record.toBe, sys).ready ||
    !reviewCurrent(record, asis, sys)
  )
    throw new Error(
      "تحلیل معتبر و مرورشده، مرحله تحلیل و نسخه TO-BE آماده لازم است.",
    );
  return {
    system:
      p.systemizationStage === "analyzed"
        ? changeStage(sys, p.id, "redesigned")
        : sys,
    record: {
      ...record,
      approval: {
        at: new Date().toISOString(),
        fingerprint:
          fingerprint(asis, sys) + "\n" + fingerprint(record.toBe, sys),
      },
    },
  };
}
export function compareMaps(
  asis: ProcessMap,
  tobe: ProcessMap,
  sys: SystemData,
) {
  const a = mapMetrics(asis, sys),
    b = mapMetrics(tobe, sys),
    ca = mapCompleteness(asis, sys),
    cb = mapCompleteness(tobe, sys);
  const labels = {
    steps: "مراحل",
    work: "زمان کار",
    wait: "زمان انتظار",
    cycle: "زمان کل",
    waitingRatio: "نرخ انتظار",
    handoffs: "تحویل‌ها",
    founder: "وابسته به بنیان‌گذار",
    highRework: "بازکاری بالا",
    decisions: "تصمیم‌ها",
  };
  const rows = (Object.keys(labels) as (keyof typeof labels)[]).map((key) => ({
    key,
    label: labels[key],
    before: a[key],
    after: b[key],
    difference: b[key] - a[key],
    percent: a[key] === 0 ? null : (100 * (b[key] - a[key])) / a[key],
  }));
  const removed = asis.steps.filter(
      (s) => !tobe.steps.some((t) => t.id === s.id),
    ),
    added = tobe.steps.filter((s) => !asis.steps.some((t) => t.id === s.id));
  const changes = tobe.steps.flatMap((t) => {
    const s = asis.steps.find((s) => s.id === t.id);
    if (!s) return [];
    const result: string[] = [];
    if (s.ownerRoleId !== t.ownerRoleId) result.push("مالک تغییر کرده");
    if (s.waitTimeMinutes !== t.waitTimeMinutes)
      result.push(
        `انتظار: ${s.waitTimeMinutes ?? "ثبت نشده"} ← ${t.waitTimeMinutes ?? "ثبت نشده"} دقیقه`,
      );
    if (s.workTimeMinutes !== t.workTimeMinutes)
      result.push("زمان کار تغییر کرده");
    if (founderStep(sys, s) && !founderStep(sys, t))
      result.push("وابستگی بنیان‌گذار برطرف شده");
    if (s.reworkProbability !== t.reworkProbability)
      result.push(`بازکاری: ${s.reworkProbability}٪ ← ${t.reworkProbability}٪`);
    if (s.type !== t.type) result.push("نوع مرحله تغییر کرده");
    if (s.title !== t.title) result.push("عنوان تغییر کرده");
    return result.map((text) => ({ step: t, text }));
  });
  const warnings: string[] = [];
  if (cb.owner < ca.owner)
    warnings.push("پوشش مالکیت TO-BE از AS-IS کمتر است.");
  if (b.steps < a.steps && b.wait > a.wait)
    warnings.push("تعداد مراحل کم شده اما انتظار افزایش یافته است.");
  if (cb.time < 100 || ca.time < 100)
    warnings.push(
      "زمان‌های ثبت‌نشده وجود دارد؛ کاهش زمان را بهبود قطعی تلقی نکنید.",
    );
  if (b.cycle > a.cycle) warnings.push("جمع زمان طراحی جدید افزایش یافته است.");
  return {
    rows,
    removed,
    added,
    changes,
    warnings,
    delegated: tobe.steps.filter((s) => s.improvementAction === "delegate")
      .length,
    connectionChanges:
      asis.connections.filter(
        (e) => !tobe.connections.some((t) => t.id === e.id),
      ).length +
      tobe.connections.filter(
        (e) => !asis.connections.some((t) => t.id === e.id),
      ).length,
  };
}
