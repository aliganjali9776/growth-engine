import type { StrategyStore, StrategyRole } from "../model";
import { krTypes, type KeyResult } from "./types";
import {
  calculateKRProgress,
  milestoneWeightsValid,
  validDate,
} from "./calculations";
export function validateKR(
  k: KeyResult,
  store: StrategyStore,
  roles: StrategyRole[],
  mode: "equal" | "custom" = "equal",
) {
  const objective = store.objectives.find(
    (o) => o.id === k.objectiveId && o.cycleId === k.cycleId,
  );
  const numeric = k.type === "increase" || k.type === "decrease";
  const validTarget =
    k.type === "increase"
      ? k.startValue !== null &&
        k.targetValue !== null &&
        k.targetValue > k.startValue
      : k.type === "decrease"
        ? k.startValue !== null &&
          k.targetValue !== null &&
          k.targetValue < k.startValue
        : k.type === "binary"
          ? k.startValue === 0 && k.targetValue === 1
          : milestoneWeightsValid(k.milestones);
  const checks = [
    { label: "مالک", ok: roles.some((r) => r.id === k.ownerRoleId) },
    { label: "نوع", ok: Object.hasOwn(krTypes, k.type) },
    {
      label: "مقدار شروع",
      ok: numeric
        ? k.startValue !== null
        : k.type === "binary"
          ? k.startValue === 0
          : true,
    },
    { label: "هدف معتبر", ok: validTarget },
    { label: "مقدار فعلی / مراحل", ok: calculateKRProgress(k) !== null },
    { label: "واحد", ok: !numeric || !!k.unit.trim() },
    {
      label: "وزن",
      ok:
        mode === "equal" ||
        (k.weight !== null &&
          Number.isFinite(k.weight) &&
          k.weight >= 0 &&
          k.weight <= 100),
    },
    {
      label: "تاریخ‌ها",
      ok:
        validDate(k.startDate) &&
        validDate(k.deadline) &&
        k.startDate <= k.deadline,
    },
    {
      label: "اطمینان",
      ok:
        k.confidence !== null &&
        Number.isInteger(k.confidence) &&
        k.confidence >= 1 &&
        k.confidence <= 10,
    },
  ];
  const missing = checks
    .filter((c) => !c.ok)
    .map((c) => `${c.label}: داده معتبر لازم است.`);
  if (!objective) missing.push("هدف مرتبط در این دوره موجود نیست.");
  const warnings: string[] = [];
  if (
    /^(راه‌اندازی|استخدام|برگزاری|خرید|ارسال|تهیه|انجام)/.test(k.title.trim())
  )
    warnings.push(
      "عنوان به ابتکار یا فعالیت شباهت دارد؛ شواهد تحقق تغییر را روشن کنید.",
    );
  if (k.title.trim().length < 8)
    warnings.push("عنوان برای توضیح شاهد قابل اندازه‌گیری کوتاه است.");
  if (
    objective &&
    (k.startDate < objective.startDate || k.deadline > objective.deadline)
  )
    warnings.push("بازه نتیجه کلیدی خارج از بازه هدف است.");
  const cycle = store.cycles.find((c) => c.id === k.cycleId);
  if (cycle && (k.startDate < cycle.startDate || k.deadline > cycle.endDate))
    warnings.push("بازه نتیجه کلیدی خارج از دوره است.");
  return {
    checks,
    missing,
    warnings,
    label: missing.length
      ? "ناقص"
      : warnings.length
        ? "نیازمند بازبینی"
        : "مناسب",
  };
}
export function calculateKRCompleteness(
  k: KeyResult,
  store: StrategyStore,
  roles: StrategyRole[],
  mode: "equal" | "custom" = "equal",
) {
  const v = validateKR(k, store, roles, mode);
  return {
    score: Math.round(
      (v.checks.filter((c) => c.ok).length / v.checks.length) * 100,
    ),
    ...v,
  };
}
export function validateKRStorage(store: StrategyStore) {
  if (store.keyResults === undefined) return;
  const fail = () => {
    throw Error("داده نتایج کلیدی معتبر نیست؛ نسخه قبلی حفظ شد.");
  };
  if (!Array.isArray(store.keyResults) || store.keyResults.length > 10000)
    fail();
  const ids = new Set<string>(),
    codes = new Set<string>(),
    milestoneIds = new Set<string>();
  for (const k of store.keyResults) {
    if (!k || typeof k !== "object") fail();
    for (const field of [
      "id",
      "cycleId",
      "objectiveId",
      "code",
      "title",
      "description",
      "ownerRoleId",
      "unit",
      "startDate",
      "deadline",
      "notes",
      "createdAt",
      "updatedAt",
    ] as const)
      if (typeof k[field] !== "string" || k[field].length > 10000) fail();
    if (!k.id.trim() || !k.title.trim() || !k.code.trim() || ids.has(k.id))
      fail();
    ids.add(k.id);
    const codeKey = JSON.stringify([k.cycleId, k.code]);
    if (codes.has(codeKey)) fail();
    codes.add(codeKey);
    if (
      !store.objectives.some(
        (o) => o.id === k.objectiveId && o.cycleId === k.cycleId,
      )
    )
      fail();
    if (
      !Object.hasOwn(krTypes, k.type) ||
      !["active", "cancelled"].includes(k.lifecycle)
    )
      fail();
    for (const f of [
      "startValue",
      "currentValue",
      "targetValue",
      "weight",
      "confidence",
    ] as const)
      if (k[f] !== null && (typeof k[f] !== "number" || !Number.isFinite(k[f])))
        fail();
    if (k.weight !== null && (k.weight < 0 || k.weight > 100)) fail();
    if (
      k.confidence !== null &&
      (!Number.isInteger(k.confidence) || k.confidence < 1 || k.confidence > 10)
    )
      fail();
    if (
      k.type === "binary" &&
      (k.startValue !== 0 ||
        k.targetValue !== 1 ||
        ![0, 1, null].includes(k.currentValue))
    )
      fail();
    if (
      (k.startDate && !validDate(k.startDate)) ||
      (k.deadline && !validDate(k.deadline)) ||
      (k.startDate && k.deadline && k.startDate > k.deadline)
    )
      fail();
    for (const f of ["createdAt", "updatedAt"] as const)
      if (!Number.isFinite(Date.parse(k[f]))) fail();
    if (
      k.lastUpdateAt !== undefined &&
      (typeof k.lastUpdateAt !== "string" ||
        !Number.isFinite(Date.parse(k.lastUpdateAt)))
    )
      fail();
    if (!Array.isArray(k.milestones) || k.milestones.length > 1000) fail();
    if (k.type !== "milestone" && k.milestones.length) fail();
    for (const m of k.milestones) {
      if (
        !m ||
        typeof m.id !== "string" ||
        !m.id.trim() ||
        milestoneIds.has(m.id) ||
        m.keyResultId !== k.id ||
        typeof m.title !== "string" ||
        !m.title.trim() ||
        m.title.length > 10000 ||
        typeof m.weight !== "number" ||
        !Number.isFinite(m.weight) ||
        m.weight < 0 ||
        m.weight > 100 ||
        typeof m.completed !== "boolean"
      )
        fail();
      milestoneIds.add(m.id);
      if (
        m.completedAt !== undefined &&
        (typeof m.completedAt !== "string" ||
          !Number.isFinite(Date.parse(m.completedAt)))
      )
        fail();
    }
  }
}
