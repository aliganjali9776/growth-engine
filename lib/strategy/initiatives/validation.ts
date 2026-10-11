import type { StrategyStore, StrategyRole } from "../model";
import { validDate } from "../kr/calculations";
import {
  initiativeStatuses,
  initiativePriorities,
  effectivenessLabels,
  impactTypes,
  effortLabels,
  type StrategicInitiative,
} from "./types";
export function validateInitiative(
  i: StrategicInitiative,
  store: StrategyStore,
): string[] {
  const errors: string[] = [],
    cycle = store.cycles.find((c) => c.id === i.cycleId),
    objective = store.objectives.find((o) => o.id === i.objectiveId),
    kr = store.keyResults?.find((k) => k.id === i.keyResultId);
  if (!cycle) errors.push("دوره معتبر لازم است.");
  if (i.objectiveId && (!objective || objective.cycleId !== i.cycleId))
    errors.push("هدف متعلق به این دوره نیست.");
  if (
    i.keyResultId &&
    (!kr || kr.cycleId !== i.cycleId || kr.objectiveId !== i.objectiveId)
  )
    errors.push("ارتباط دوره، هدف و نتیجه کلیدی سازگار نیست.");
  if (i.status !== "proposed" && i.status !== "cancelled" && !kr)
    errors.push("این اقدام هنوز به نتیجه کلیدی مشخصی متصل نشده است.");
  if (i.status === "blocked" && !i.blockedReason.trim())
    errors.push("برای وضعیت متوقف‌شده، دلیل توقف لازم است.");
  if (!Number.isFinite(i.progress) || i.progress < 0 || i.progress > 100)
    errors.push("پیشرفت اجرا باید بین صفر و ۱۰۰ باشد.");
  if (["proposed", "planned"].includes(i.status) && i.progress !== 0)
    errors.push("برای ثبت پیشرفت ابتدا اقدام را به در حال اجرا منتقل کنید.");
  return errors;
}
export function initiativeQuality(
  i: StrategicInitiative,
  store: StrategyStore,
  roles: StrategyRole[],
) {
  const missing = validateInitiative(i, store),
    warnings: string[] = [];
  if (!i.keyResultId)
    missing.push("این اقدام هنوز به نتیجه کلیدی مشخصی متصل نشده است.");
  if (!roles.some((r) => r.id === i.ownerRoleId))
    missing.push("نقش مالک موجود یا مشخص نیست.");
  if (!i.hypothesis.trim()) missing.push("فرضیه اثرگذاری را بنویسید.");
  if (
    i.impactType === "unknown" ||
    (i.impactType === "numeric"
      ? i.expectedImpactValue === null || !i.expectedImpactUnit.trim()
      : !i.expectedImpact.trim())
  )
    missing.push("اثر مورد انتظار هنوز مشخص نشده است.");
  if (!validDate(i.startDate) || !validDate(i.dueDate))
    missing.push("تاریخ شروع و مهلت معتبر لازم است.");
  if (i.title.trim().length < 8)
    warnings.push("عنوان اقدام را روشن‌تر و مشخص‌تر بنویسید.");
  if (
    /^(افزایش|کاهش|رساندن|جذب)/.test(i.title.trim()) &&
    /[0-9۰-۹٠-٩]/.test(i.title)
  )
    warnings.push(
      "عنوان به نتیجه کلیدی شباهت دارد؛ کاری را بنویسید که برای تغییر نتیجه امتحان می‌کنید.",
    );
  const c = store.cycles.find((c) => c.id === i.cycleId);
  if (c && (i.startDate < c.startDate || i.dueDate > c.endDate))
    warnings.push("بازه اقدام خارج از دوره است؛ تناسب آن را بازبینی کنید.");
  const k = store.keyResults?.find((k) => k.id === i.keyResultId);
  if (
    store.objectives.find((o) => o.id === i.objectiveId)?.status === "cancelled"
  )
    warnings.push("هدف مرتبط لغوشده است.");
  if (k?.lifecycle === "cancelled")
    warnings.push("نتیجه کلیدی مرتبط لغوشده است.");
  if (
    i.status === "completed" &&
    (i.effectiveness === "notEvaluated" || !i.actualImpact.trim())
  )
    warnings.push(
      "اثر این اقدام هنوز ارزیابی نشده یا شاهد واقعی ثبت نشده است.",
    );
  return {
    missing: [...new Set(missing)],
    warnings,
    label: missing.length
      ? "ناقص"
      : warnings.length
        ? "نیازمند بازبینی"
        : "مناسب",
  };
}
export function validateInitiativeStorage(store: StrategyStore) {
  if (store.initiatives === undefined) return;
  const fail = () => {
    throw Error("داده اقدامات استراتژیک معتبر نیست؛ داده قبلی حفظ شد.");
  };
  if (!Array.isArray(store.initiatives) || store.initiatives.length > 10000)
    fail();
  const ids = new Set<string>(),
    codes = new Set<string>();
  for (const i of store.initiatives) {
    if (!i || typeof i !== "object") fail();
    for (const f of [
      "id",
      "cycleId",
      "objectiveId",
      "keyResultId",
      "code",
      "title",
      "description",
      "ownerRoleId",
      "hypothesis",
      "expectedImpact",
      "actualImpact",
      "expectedImpactUnit",
      "startDate",
      "dueDate",
      "blockedReason",
      "notes",
      "createdAt",
      "updatedAt",
    ] as const)
      if (typeof i[f] !== "string" || i[f].length > 10000) fail();
    if (!i.id.trim() || !i.title.trim() || !i.code.trim() || ids.has(i.id))
      fail();
    ids.add(i.id);
    const key = JSON.stringify([i.cycleId, i.code]);
    if (codes.has(key)) fail();
    codes.add(key);
    for (const [key, labels] of [
      ["status", initiativeStatuses],
      ["priority", initiativePriorities],
      ["effectiveness", effectivenessLabels],
      ["impactType", impactTypes],
      ["effort", effortLabels],
      ["impactLevel", effortLabels],
    ] as const)
      if (!Object.hasOwn(labels, i[key])) fail();
    if (
      i.expectedImpactValue !== null &&
      (typeof i.expectedImpactValue !== "number" ||
        !Number.isFinite(i.expectedImpactValue))
    )
      fail();
    if (
      (i.startDate && !validDate(i.startDate)) ||
      (i.dueDate && !validDate(i.dueDate)) ||
      (i.startDate && i.dueDate && i.startDate > i.dueDate)
    )
      fail();
    if (i.status === "completed" && i.progress !== 100) fail();
    for (const f of ["createdAt", "updatedAt"] as const)
      if (!Number.isFinite(Date.parse(i[f]))) fail();
    for (const f of ["startedAt", "completedAt", "baselineCapturedAt"] as const)
      if (
        i[f] !== undefined &&
        (typeof i[f] !== "string" || !Number.isFinite(Date.parse(i[f]!)))
      )
        fail();
    for (const f of ["krProgressAtStart", "krValueAtStart"] as const)
      if (
        i[f] !== undefined &&
        i[f] !== null &&
        (typeof i[f] !== "number" || !Number.isFinite(i[f]))
      )
        fail();
    if (
      i.krProgressAtStart != null &&
      (i.krProgressAtStart < 0 || i.krProgressAtStart > 100)
    )
      fail();
    if (
      i.baselineKeyResultId !== undefined &&
      (typeof i.baselineKeyResultId !== "string" ||
        i.baselineKeyResultId !== i.keyResultId)
    )
      fail();
    if (
      i.linkedSystemProcessId !== undefined &&
      typeof i.linkedSystemProcessId !== "string"
    )
      fail();
    if (validateInitiative(i, store).length) fail();
  }
}
