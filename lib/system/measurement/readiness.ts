import type { MeasurementRecord } from "./model";
import { reviewHasContent } from "./model";
import type { ProcessEvidence } from "./health";
import { implementedCurrent } from "../standards/logic";
import { weightedPerformance } from "./kpis";
import { changeStage } from "../actions";
export function measurementReadiness(r: MeasurementRecord, e: ProcessEvidence) {
  const issues = [...weightedPerformance(r, e.system).issues];
  if (!e.standard || !e.source || !implementedCurrent(e.standard, e.source))
    issues.unshift("پیاده‌سازی معتبر نسخه جاری لازم است.");
  return { ready: issues.length === 0, issues };
}
export const measuredCurrent = (r: MeasurementRecord, e: ProcessEvidence) =>
  !!r.measuredAt && measurementReadiness(r, e).ready;
export function improvingReadiness(r: MeasurementRecord, e: ProcessEvidence) {
  const issues: string[] = [];
  if (!measuredCurrent(r, e))
    issues.push("اندازه‌گیری باید تأیید معتبر داشته باشد.");
  if (
    !r.reviews.some(
      (x) =>
        reviewHasContent(x) &&
        e.system.roles.some((y) => y.id === x.reviewedByRoleId),
    )
  )
    issues.push("حداقل یک مرور با نقش مسئول معتبر لازم است.");
  if (
    !r.improvements.some(
      (x) =>
        ["planned", "in-progress", "completed"].includes(x.status) &&
        !!x.title.trim() &&
        e.system.roles.some((y) => y.id === x.ownerRoleId),
    )
  )
    issues.push(
      "یک اقدام برنامه‌ریزی‌شده، در حال اجرا یا تکمیل‌شده با مالک معتبر لازم است.",
    );
  return { ready: issues.length === 0, issues };
}
export const improvingCurrent = (r: MeasurementRecord, e: ProcessEvidence) =>
  !!r.improvingAt && improvingReadiness(r, e).ready;
export function confirmMeasurement(
  r: MeasurementRecord,
  e: ProcessEvidence,
  kind: "measured" | "improving",
) {
  const p = e.system.processes.find((p) => p.id === r.processId),
    allowed =
      kind === "measured"
        ? ["implemented", "measured", "improving"]
        : ["measured", "improving"],
    result =
      kind === "measured"
        ? measurementReadiness(r, e)
        : improvingReadiness(r, e);
  if (!p || !allowed.includes(p.systemizationStage) || !result.ready)
    throw new Error(
      result.issues.join(" ") || "مرحله فعلی اجازه این انتقال را نمی‌دهد.",
    );
  return {
    record: {
      ...r,
      [kind === "measured" ? "measuredAt" : "improvingAt"]:
        new Date().toISOString(),
    },
    system:
      kind === "measured" && p.systemizationStage === "improving"
        ? e.system
        : changeStage(e.system, p.id, kind),
  };
}
export function guardMeasurementStage(
  stage: string,
  r: MeasurementRecord | undefined,
  e: ProcessEvidence,
) {
  if (stage === "measured" && (!r || !measuredCurrent(r, e)))
    throw new Error(
      "ابتدا شاخص، هدف، مالک و اندازه‌گیری معتبر را در صفحه KPI ثبت و مرحله اندازه‌گیری را تأیید کنید.",
    );
  if (stage === "improving" && (!r || !improvingCurrent(r, e)))
    throw new Error(
      "ابتدا مرور هفتگی و اقدام دارای مالک را ثبت و ورود به چرخه بهبود را تأیید کنید.",
    );
}
