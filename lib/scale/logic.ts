import {
  type ScaleStore,
  type GrowthIdea,
  type GrowthConstraint,
  type Dimension,
  dimensions,
} from "./model";
const filled = (v: string) => !!v.trim();
export function constraintQuality(c: GrowthConstraint) {
  if (
    !filled(c.title) ||
    !filled(c.impact) ||
    (c.status === "active" && !c.ownerRoleId)
  )
    return "incomplete";
  return c.evidence.some((e) => filled(e.text)) ? "strong" : "needsEvidence";
}
export function primaryConstraintValidation(s: ScaleStore) {
  return (
    !s.primaryConstraintId ||
    s.constraints.some(
      (c) => c.id === s.primaryConstraintId && c.status === "active",
    )
  );
}
export function constraintCandidates(s: ScaleStore) {
  return s.diagnostics.filter(
    (d) =>
      d.status === "candidate" &&
      (filled(d.evidence) || filled(d.managementObservation)),
  );
}
export function constraintLeverSuggestions(s: ScaleStore, d: Dimension) {
  return s.levers.filter((l) => l.active && l.applicableDimensions.includes(d));
}
export function ideaPriority(i: GrowthIdea) {
  if (i.expectedImpact === "unknown" || !i.confidence || !i.effort)
    return { score: null, category: "نیازمند شواهد بیشتر" };
  const n = { low: 1, medium: 2, high: 3 },
    e = { low: 3, medium: 2, high: 1 };
  const score = n[i.expectedImpact] * n[i.confidence] * e[i.effort];
  return {
    score,
    category:
      score >= 18
        ? "کاندید بسیار قوی"
        : score >= 10
          ? "کاندید مناسب"
          : score >= 5
            ? "نیازمند شواهد بیشتر"
            : "اولویت پایین",
  };
}
export function ideaReadiness(i: GrowthIdea, s: ScaleStore) {
  const missing: string[] = [];
  if (
    !s.constraints.some(
      (c) =>
        c.id === i.constraintId && !["archived", "resolved"].includes(c.status),
    )
  )
    missing.push("گلوگاه باز");
  if (
    !s.levers.some((l) => l.id === i.leverId && l.active) &&
    !filled(i.intervention)
  )
    missing.push("اهرم یا منطق مداخله");
  if (!filled(i.rationale)) missing.push("منطق اثرگذاری");
  if (i.expectedImpact === "unknown") missing.push("اثر مورد انتظار");
  if (!i.confidence) missing.push("اطمینان");
  if (!i.effort) missing.push("تلاش");
  if (!filled(i.successMetric)) missing.push("مفهوم شاخص موفقیت");
  return { ready: missing.length === 0, missing };
}
export function ideaQuality(i: GrowthIdea, s: ScaleStore) {
  return ideaReadiness(i, s).ready
    ? "ساختار کامل برای بررسی آزمایش"
    : i.evidence.trim()
      ? "نیازمند تکمیل ساختار"
      : "نیازمند شواهد و تکمیل ساختار";
}
export function scaleDiagnosisCompleteness(
  s: ScaleStore,
  linkedGoalAvailable = false,
) {
  const p = s.constraints.find((c) => c.id === s.primaryConstraintId);
  const values = [
    { label: "مدل کسب‌وکار", value: !!s.profile.businessModel },
    {
      label: "هدف رشد",
      value: s.profile.linkedStrategyKRId
        ? linkedGoalAvailable
        : filled(s.profile.growthGoal),
    },
    {
      label: "حداقل یک شاخص ثبت‌شده",
      value: Object.values(s.metrics).some((v) => v !== null),
    },
    { label: "گلوگاه اصلی", value: !!p },
    {
      label: "شواهد گلوگاه اصلی",
      value: !!p?.evidence.some((e) => filled(e.text)),
    },
    { label: "اهرم گلوگاه اصلی", value: !!p?.leverIds.length },
  ];
  return {
    items: values,
    percent: Math.round(
      (values.filter((x) => x.value).length / values.length) * 100,
    ),
  };
}
export function scaleSetupReadiness(
  s: ScaleStore,
  capacityAvailable: boolean,
  linkedGoalAvailable = false,
) {
  const p = s.constraints.find((c) => c.id === s.primaryConstraintId);
  const data =
    s.diagnostics.filter((d) => d.status !== "unknown" && filled(d.evidence))
      .length / 10;
  const parts = [
    { label: "داده رشد", weight: 20, value: data },
    {
      label: "وضوح گلوگاه اصلی",
      weight: 25,
      value: p ? (constraintQuality(p) === "strong" ? 1 : 0.5) : 0,
    },
    {
      label: "وضوح هدف رشد",
      weight: 15,
      value: (
        s.profile.linkedStrategyKRId
          ? linkedGoalAvailable
          : filled(s.profile.growthGoal)
      )
        ? 1
        : 0,
    },
    {
      label: "پوشش اهرم",
      weight: 15,
      value: p?.leverIds.some((id) =>
        s.levers.some((l) => l.id === id && l.active),
      )
        ? 1
        : 0,
    },
    {
      label: "مسیر ایده",
      weight: 15,
      value: s.ideas.some(
        (i) =>
          i.constraintId === p?.id &&
          !["archived", "rejected"].includes(i.status),
      )
        ? 1
        : 0,
    },
    {
      label: "شواهد ظرفیت سیستم",
      weight: 10,
      value: capacityAvailable ? 1 : 0,
    },
  ];
  return {
    score: Math.round(parts.reduce((n, p) => n + p.weight * p.value, 0)),
    parts,
  };
}
export function scaleNeedsAttention(
  s: ScaleStore,
  capacityRisk = false,
  linkedGoalAvailable = false,
) {
  const messages: { text: string; href: string }[] = [];
  const add = (text: string, href: string) => messages.push({ text, href });
  if (
    !(s.profile.linkedStrategyKRId
      ? linkedGoalAvailable
      : filled(s.profile.growthGoal))
  )
    add("هدف رشد مشخص یا قابل دسترسی نیست.", "/scale/diagnosis");
  if (scaleDiagnosisCompleteness(s, linkedGoalAvailable).percent < 50)
    add("داده‌های تشخیص هنوز کافی نیست.", "/scale/diagnosis");
  const p = s.constraints.find((c) => c.id === s.primaryConstraintId);
  if (!p) add("گلوگاه اصلی رشد انتخاب نشده است.", "/scale/constraints");
  if (p && !p.leverIds.length)
    add("برای گلوگاه اصلی اهرمی مشخص نشده است.", `/scale/constraints/${p.id}`);
  if (
    p &&
    !s.ideas.some(
      (i) =>
        i.constraintId === p.id && !["rejected", "archived"].includes(i.status),
    )
  )
    add("گلوگاه اصلی هنوز ایده باز ندارد.", `/scale/constraints/${p.id}`);
  for (const c of s.constraints) {
    if (c.status === "active" && !c.evidence.some((e) => filled(e.text)))
      add(`گلوگاه فعال بدون شواهد: ${c.title}`, `/scale/constraints/${c.id}`);
    if (
      c.status === "active" &&
      c.severity === "critical" &&
      c.confidence === "low"
    )
      add(
        `محدودیت بحرانی با اطمینان کم: ${c.title}`,
        `/scale/constraints/${c.id}`,
      );
  }
  for (const i of s.ideas)
    if (i.status === "ready" && !ideaReadiness(i, s).ready)
      add(
        `آمادگی ایده نیازمند بازبینی است: ${i.title}`,
        `/scale/ideas/${i.id}`,
      );
  if (!s.profile.linkedStrategyKRId)
    add("هدف رشد به نتیجه کلیدی استراتژی متصل نشده است.", "/scale/diagnosis");
  if (capacityRisk)
    add(
      "ظرفیت عملیاتی ممکن است محدودکننده رشد باشد؛ شواهد سیستم را بررسی کنید.",
      "/system/independence",
    );
  return messages;
}
export function diagnosisSummary(s: ScaleStore) {
  const p = s.constraints.find((c) => c.id === s.primaryConstraintId);
  return p
    ? `مدیریت «${p.title}» را گلوگاه اصلی انتخاب کرده است. این انتخاب در بُعد ${dimensions[p.dimension]} ثبت شده و ادعای علت قطعی نیست؛ اهرم‌ها باید با شواهد آزمایش شوند.`
    : constraintCandidates(s).length
      ? "چند بُعد بر پایه شواهد و قضاوت ثبت‌شده کاندید گلوگاه هستند. انتخاب اصلی هنوز انجام نشده است."
      : "برای تشخیص گلوگاه، داده و مشاهده مدیریت را ثبت کنید. داده ناشناخته به معنای عملکرد ضعیف نیست.";
}
