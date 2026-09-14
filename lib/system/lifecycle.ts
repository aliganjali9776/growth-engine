import type { SystemData, SystemizationStage } from "./types";
import type { ProcessMap } from "./maps/model";
import type { AnalysisRecord } from "./analysis/redesign";
import { mapCompleteness } from "./maps/logic";
import { reviewCurrent, approvalCurrent } from "./analysis/redesign";

// Called at the shared write boundary, including edits made from inventory/pipeline.
export function guardEarlyStage(
  stage: SystemizationStage,
  system: SystemData,
  map: ProcessMap | undefined,
  analysis: AnalysisRecord | undefined,
) {
  if (stage === "mapped" && (!map || !mapCompleteness(map, system).ready))
    throw new Error(
      "ابتدا نقشه وضعیت فعلی را تکمیل کنید؛ ثبت مرحله مدل‌سازی به نقشه معتبر نیاز دارد.",
    );
  if (
    stage === "analyzed" &&
    (!map ||
      !mapCompleteness(map, system).ready ||
      !reviewCurrent(analysis, map, system))
  )
    throw new Error("ابتدا تحلیل نقشه فعلی را مرور و تأیید کنید.");
  if (
    stage === "redesigned" &&
    (!map || !approvalCurrent(analysis, map, system))
  )
    throw new Error("ابتدا طراحی وضعیت مطلوب را از صفحه طراحی تأیید کنید.");
}
