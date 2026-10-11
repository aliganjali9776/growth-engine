import type {
  KeyResult,
  KRMilestone,
  KRStatus,
  ObjectiveHealth,
} from "./types";
const finite = (n: unknown): n is number =>
  typeof n === "number" && Number.isFinite(n);
const clamp = (n: number) => Math.max(0, Math.min(100, n));
const tehranDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tehran",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
export function calculateIncreaseProgress(
  start: number | null,
  target: number | null,
  current: number | null,
): number | null {
  if (!finite(start) || !finite(target) || !finite(current) || target <= start)
    return null;
  const n = ((current - start) / (target - start)) * 100;
  return finite(n) ? clamp(n) : null;
}
export function calculateDecreaseProgress(
  start: number | null,
  target: number | null,
  current: number | null,
): number | null {
  if (!finite(start) || !finite(target) || !finite(current) || target >= start)
    return null;
  const n = ((start - current) / (start - target)) * 100;
  return finite(n) ? clamp(n) : null;
}
export function calculateBinaryProgress(current: number | null): number | null {
  return current === 0 ? 0 : current === 1 ? 100 : null;
}
export function milestoneWeightsValid(m: KRMilestone[]) {
  return (
    m.length > 0 &&
    m.every(
      (x) =>
        finite(x.weight) && x.weight >= 0 && x.weight <= 100 && x.title.trim(),
    ) &&
    Math.abs(m.reduce((n, x) => n + x.weight, 0) - 100) < 0.000001
  );
}
export function calculateMilestoneProgress(m: KRMilestone[]): number | null {
  return milestoneWeightsValid(m)
    ? clamp(m.reduce((n, x) => n + (x.completed ? x.weight : 0), 0))
    : null;
}
export function calculateKRProgress(k: KeyResult): number | null {
  switch (k.type) {
    case "increase":
      return calculateIncreaseProgress(
        k.startValue,
        k.targetValue,
        k.currentValue,
      );
    case "decrease":
      return calculateDecreaseProgress(
        k.startValue,
        k.targetValue,
        k.currentValue,
      );
    case "binary":
      return calculateBinaryProgress(k.currentValue);
    case "milestone":
      return calculateMilestoneProgress(k.milestones);
    default:
      return null;
  }
}
export function validDate(d: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(d) &&
    finite(Date.parse(d)) &&
    new Date(d).toISOString().slice(0, 10) === d
  );
}
export function calculateExpectedProgress(
  start: string,
  deadline: string,
  today: string,
): number | null {
  if (
    !validDate(start) ||
    !validDate(deadline) ||
    !validDate(today) ||
    deadline < start
  )
    return null;
  if (deadline === start) return today < start ? 0 : 100;
  return clamp(
    ((Date.parse(today) - Date.parse(start)) /
      (Date.parse(deadline) - Date.parse(start))) *
      100,
  );
}
export function confidenceLabel(n: number | null) {
  return n === null
    ? "ثبت نشده"
    : n <= 3
      ? "پایین"
      : n <= 6
        ? "متوسط"
        : n <= 8
          ? "خوب"
          : "بالا";
}
export function calculateKRStatus(
  k: KeyResult,
  today: string,
): {
  status: KRStatus | null;
  reason: string;
  expected: number | null;
  overdue: boolean;
  stale: boolean;
} {
  const progress = calculateKRProgress(k),
    expected = calculateExpectedProgress(k.startDate, k.deadline, today);
  const overdue =
    validDate(k.deadline) && today > k.deadline && progress !== 100;
  const updatedDay =
    k.lastUpdateAt && Number.isFinite(Date.parse(k.lastUpdateAt))
      ? tehranDateFormatter.format(new Date(k.lastUpdateAt))
      : null;
  const stale =
    k.lifecycle === "active" &&
    validDate(k.startDate) &&
    today >= k.startDate &&
    progress !== 100 &&
    (!updatedDay || Date.parse(today) - Date.parse(updatedDay) > 7 * 86400000);
  if (progress === null || expected === null)
    return {
      status: null,
      reason: "داده اندازه‌گیری یا تاریخ کافی و معتبر نیست.",
      expected,
      overdue,
      stale,
    };
  const n = (v: number) => Math.round(v).toLocaleString("fa-IR");
  const evidence = `پیشرفت واقعی ${n(progress)}٪؛ پیشرفت مورد انتظار زمانی ${n(expected)}٪؛ اطمینان ${k.confidence === null ? "ثبت نشده" : n(k.confidence) + "/۱۰"}.`;
  let status: KRStatus | null, why: string;
  // Ordered rules: achieved; unknown confidence; overdue/extreme confidence/35pp gap;
  // low confidence/15pp gap; early zero; otherwise on track. Not a forecast.
  if (progress >= 100) {
    status = "achieved";
    why = "هدف اندازه‌گیری محقق شده است.";
  } else if (k.confidence === null) {
    status = null;
    why = "برای ارزیابی مسیر، قضاوت اطمینان مدیریت ثبت نشده است.";
  } else if (overdue || k.confidence <= 2 || expected - progress >= 35) {
    status = "offTrack";
    why = overdue
      ? "مهلت گذشته و نتیجه محقق نشده است."
      : k.confidence <= 2
        ? "اطمینان مدیریت ۲ یا کمتر است."
        : "عقب‌ماندگی زمانی حداقل ۳۵ واحد درصد است.";
  } else if (k.confidence <= 3 || expected - progress >= 15) {
    status = "atRisk";
    why =
      k.confidence <= 3
        ? "اطمینان مدیریت پایین است."
        : "عقب‌ماندگی زمانی حداقل ۱۵ واحد درصد است.";
  } else if (progress === 0 && expected <= 10) {
    status = "notStarted";
    why = "هنوز در ابتدای بازه هستیم و پیشرفتی ثبت نشده است.";
  } else {
    status = "onTrack";
    why = "فاصله زمانی کمتر از ۱۵ واحد درصد و اطمینان بالاتر از ۳ است.";
  }
  return { status, expected, overdue, stale, reason: evidence + " " + why };
}
export function weightInfo(
  krs: KeyResult[],
  mode: "equal" | "custom" = "equal",
) {
  const active = krs.filter((k) => k.lifecycle === "active"),
    sum = active.reduce((n, k) => n + (k.weight ?? 0), 0),
    missing = active.some((k) => k.weight === null);
  const valid =
    active.length > 0 &&
    (mode === "equal" || (!missing && Math.abs(sum - 100) < 0.000001));
  return {
    mode,
    valid,
    total: mode === "equal" ? (active.length ? 100 : 0) : sum,
    missing,
    label: !active.length
      ? "بدون نتیجه کلیدی"
      : mode === "equal"
        ? "وزن برابر"
        : missing
          ? "وزن ثبت‌نشده"
          : Math.abs(sum - 100) < 0.000001
            ? "معتبر"
            : sum < 100
              ? "وزن تخصیص‌نیافته"
              : "وزن بیش از حد",
    weights: active.map((k) => ({
      id: k.id,
      weight: mode === "equal" ? 100 / active.length : (k.weight ?? 0),
    })),
  };
}
export function calculateWeightedContribution(
  progress: number | null,
  weight: number | null,
): number | null {
  return progress !== null &&
    finite(progress) &&
    finite(weight) &&
    weight >= 0 &&
    weight <= 100
    ? (progress * weight) / 100
    : null;
}
export function calculateObjectiveProgress(
  krs: KeyResult[],
  mode: "equal" | "custom" = "equal",
): number | null {
  const w = weightInfo(krs, mode);
  if (!w.valid) return null;
  let total = 0;
  for (const entry of w.weights) {
    if (entry.weight === 0) continue;
    const p = calculateKRProgress(krs.find((k) => k.id === entry.id)!);
    if (p === null) return null;
    total += (p * entry.weight) / 100;
  }
  return finite(total) ? clamp(total) : null;
}
export function calculateObjectiveConfidence(
  krs: KeyResult[],
  mode: "equal" | "custom" = "equal",
): number | null {
  const active = krs.filter((k) => k.lifecycle === "active"),
    known = active.filter((k) => k.confidence !== null);
  if (!known.length) return null;
  const w = weightInfo(active, mode);
  if (!w.valid)
    return known.reduce((n, k) => n + k.confidence!, 0) / known.length;
  let numerator = 0,
    denominator = 0;
  for (const k of known) {
    const weight = w.weights.find((x) => x.id === k.id)!.weight;
    numerator += k.confidence! * weight;
    denominator += weight;
  }
  return denominator ? numerator / denominator : null;
}
export function calculateObjectiveHealth(
  krs: KeyResult[],
  mode: "equal" | "custom",
  today: string,
  complete: (k: KeyResult) => boolean,
): { health: ObjectiveHealth; reason: string } {
  const w = weightInfo(krs, mode),
    progress = calculateObjectiveProgress(krs, mode);
  if (
    !w.valid ||
    progress === null ||
    w.weights.some(
      (x) => x.weight > 0 && !complete(krs.find((k) => k.id === x.id)!),
    )
  )
    return {
      health: "insufficient",
      reason:
        "نتیجه کلیدی، وزن معتبر یا داده کامل برای نتایج دارای سهم موجود نیست.",
    };
  if (progress >= 100)
    return {
      health: "achieved",
      reason:
        "پیشرفت وزنی نتایج دارای سهم به ۱۰۰٪ رسیده است؛ وضعیت چرخه عمر هدف خودکار تغییر نمی‌کند.",
    };
  let off = 0,
    risk = 0;
  for (const x of w.weights) {
    const status = calculateKRStatus(
      krs.find((k) => k.id === x.id)!,
      today,
    ).status;
    if (status === "offTrack") off += x.weight;
    else if (status === "atRisk") risk += x.weight;
  }
  const confidence = calculateObjectiveConfidence(krs, mode);
  if (off >= 20 || (confidence !== null && confidence <= 2))
    return {
      health: "offTrack",
      reason:
        "حداقل ۲۰٪ وزن نتایج خارج از مسیر است، یا اطمینان وزنی حداکثر ۲ است.",
    };
  if (off > 0 || risk >= 20 || (confidence !== null && confidence <= 3))
    return {
      health: "atRisk",
      reason:
        "نتیجه خارج از مسیر با سهم کوچک، حداقل ۲۰٪ وزن در معرض ریسک، یا اطمینان وزنی پایین وجود دارد.",
    };
  return {
    health: "healthy",
    reason:
      "داده نتایج دارای سهم کامل است و آستانه‌های ریسک وزنی فعال نیستند؛ نتایج کوچک‌تر همچنان جداگانه نمایش داده می‌شوند.",
  };
}
