import type { SystemData } from "../types";
import type { ProcessMap } from "../maps/model";
import { operational, founderStep } from "../maps/logic";
import type { StandardRecord } from "../standards/model";
import {
  standardization,
  implementation,
  implementedCurrent,
  type StandardSource,
} from "../standards/logic";
import type { MeasurementRecord } from "./model";
import { reviewHasContent } from "./model";
import { weightedPerformance, clamp } from "./kpis";
export interface ProcessEvidence {
  system: SystemData;
  asis?: ProcessMap;
  standard?: StandardRecord;
  source?: StandardSource;
}
export const reliableRole = (sys: SystemData, id: string | undefined) => {
  const role = sys.roles.find((r) => r.id === id);
  return (
    !!role &&
    sys.people.some((p) => p.id === role.personId && p.status === "active")
  );
};
export const overdue = (
  x: MeasurementRecord["improvements"][number],
  day: string,
) =>
  !!x.dueDate &&
  x.dueDate < day &&
  !["completed", "cancelled"].includes(x.status);
export function operationalMap(e: ProcessEvidence) {
  return e.standard && e.source && implementedCurrent(e.standard, e.source)
    ? e.source.analysis.toBe
    : e.asis;
}
export function founderIndependence(processId: string, e: ProcessEvidence) {
  const map = operationalMap(e),
    process = e.system.processes.find((p) => p.id === processId),
    steps = map?.steps.filter(operational) ?? [],
    founder = (id: string | undefined) =>
      !id ||
      !e.system.roles.some((r) => r.id === id) ||
      !!e.system.roles.find((r) => r.id === id)?.isFounderRole,
    dependent = (s: (typeof steps)[number]) =>
      founder(s.ownerRoleId) || founderStep(e.system, s),
    decisions = steps.filter((s) => s.type === "decision"),
    wait = steps.reduce((n, s) => n + (s.waitTimeMinutes ?? 0), 0);
  const parts = [
    {
      label: "مالک فرآیند",
      weight: 25,
      value: process && !founder(process.ownerRoleId) ? 1 : 0,
    },
    {
      label: "مرحله‌های مستقل",
      weight: 35,
      value: steps.length
        ? steps.filter((s) => !dependent(s)).length / steps.length
        : 0,
    },
    {
      label: "تصمیم‌های مستقل",
      weight: 25,
      value: map
        ? decisions.length
          ? decisions.filter((s) => !dependent(s)).length / decisions.length
          : 1
        : 0,
    },
    {
      label: "انتظار مستقل",
      weight: 15,
      value: steps.length
        ? steps.some((s) => s.waitTimeMinutes === null)
          ? 0
          : wait
            ? 1 -
              steps
                .filter(dependent)
                .reduce((n, s) => n + (s.waitTimeMinutes ?? 0), 0) /
                wait
            : 1
        : 0,
    },
  ];
  const score =
    map && steps.length
      ? clamp(parts.reduce((n, p) => n + p.weight * p.value, 0))
      : null;
  return {
    score,
    parts,
    map,
    decisions,
    dependent,
    label:
      score === null
        ? "نقشه کافی نیست"
        : score >= 90
          ? "وابستگی ساختاری کم"
          : score >= 75
            ? "وابستگی محدود"
            : score >= 50
              ? "وابستگی متوسط"
              : score >= 25
                ? "وابستگی بالا"
                : "وابستگی بسیار بالا",
    basis:
      map?.variant === "to-be" ? "TO-BE با اجرای تأییدشده" : "AS-IS ثبت‌شده",
  };
}
export function improvementDiscipline(
  r: MeasurementRecord,
  e: ProcessEvidence,
  day: string,
) {
  const items = r.improvements.filter((x) => x.status !== "cancelled"),
    open = items.filter((x) => x.status !== "completed"),
    reviews = r.reviews
      .filter(
        (x) =>
          x.periodEnd <= day &&
          reviewHasContent(x) &&
          e.system.roles.some((y) => y.id === x.reviewedByRoleId),
      )
      .sort((a, b) => b.periodEnd.localeCompare(a.periodEnd)),
    latest = reviews[0],
    days = latest
      ? (Date.parse(day) - Date.parse(latest.periodEnd)) / 86400000
      : Infinity;
  const parts = [
    { label: "مرور در ۱۴ روز اخیر", weight: 25, value: days <= 14 ? 1 : 0 },
    {
      label: "مالک اقدامات",
      weight: 25,
      value: items.length
        ? items.filter((x) =>
            e.system.roles.some((y) => y.id === x.ownerRoleId),
          ).length / items.length
        : 0,
    },
    {
      label: "موعد اقدامات",
      weight: 20,
      value: items.length
        ? items.filter((x) => x.dueDate).length / items.length
        : 0,
    },
    {
      label: "انجام به‌موقع",
      weight: 20,
      value: items.length
        ? open.length
          ? 1 - open.filter((x) => overdue(x, day)).length / open.length
          : 1
        : 0,
    },
    {
      label: "اقدامات تکمیل‌شده",
      weight: 10,
      value: items.length
        ? items.filter((x) => x.status === "completed").length / items.length
        : 0,
    },
  ];
  return {
    score: parts.reduce((n, p) => n + p.weight * p.value, 0),
    parts,
    latest,
    open,
    overdue: open.filter((x) => overdue(x, day)),
    completed: items.filter((x) => x.status === "completed"),
  };
}
export function processHealth(
  r: MeasurementRecord,
  e: ProcessEvidence,
  day: string,
) {
  const kpi = weightedPerformance(r, e.system),
    founder = founderIndependence(r.processId, e),
    discipline = improvementDiscipline(r, e, day),
    std =
      e.standard && e.source ? standardization(e.standard, e.source).score : 0,
    adoption =
      e.standard && e.source
        ? implementation(e.standard, e.source).score
        : null;
  const parts = [
    { label: "کامل‌بودن استاندارد", weight: 20, value: std / 100 },
    {
      label: "پذیرش دستی",
      weight: 20,
      value: adoption === null ? null : adoption / 100,
    },
    {
      label: "عملکرد KPI",
      weight: 30,
      value: kpi.score === null ? null : kpi.score / 100,
    },
    {
      label: "استقلال بنیان‌گذار",
      weight: 15,
      value: founder.score === null ? null : founder.score / 100,
    },
    { label: "انضباط بهبود", weight: 15, value: discipline.score / 100 },
  ];
  const score = parts.some((p) => p.value === null)
    ? null
    : Math.round(parts.reduce((n, p) => n + p.weight * p.value!, 0));
  return {
    score,
    parts,
    kpi,
    founder,
    discipline,
    std,
    adoption,
    label:
      score === null
        ? "داده ناکافی"
        : score >= 90
          ? "سیستماتیک و پایدار"
          : score >= 80
            ? "قوی"
            : score >= 60
              ? "قابل قبول"
              : score >= 40
                ? "ناپایدار"
                : "بحرانی",
    interpretation:
      score === null
        ? "برای سلامت نهایی، اندازه‌گیری معتبر و نقشه عملیاتی لازم است؛ داده مفقود با عملکرد فرضی جایگزین نشده است."
        : "شاخص داخلی بر پایه اندازه‌گیری‌های دستی، مستندات و ساختار نقش‌هاست؛ کیفیت داده و پایداری واقعی اجرا را در مرور هفتگی بررسی کنید.",
  };
}
