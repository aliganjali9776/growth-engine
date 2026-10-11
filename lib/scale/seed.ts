import {
  type ScaleStore,
  type Dimension,
  type GrowthLever,
  newConstraint,
  newIdea,
  dimensions,
  metricLabels,
} from "./model";
const definitions: [string, string, GrowthLever["category"], Dimension[]][] = [
  ["content", "محتوای تخصصی", "acquisition", ["acquisition"]],
  ["paid", "جذب پولی", "acquisition", ["acquisition", "channel"]],
  ["partnership", "مشارکت تجاری", "partnership", ["acquisition", "channel"]],
  ["referral", "معرفی مشتریان", "referral", ["acquisition", "retention"]],
  ["outbound", "ارتباط هدفمند", "sales", ["acquisition"]],
  ["events", "رویداد تخصصی", "acquisition", ["acquisition"]],
  ["offer", "بازطراحی پیشنهاد", "offer", ["activation", "sales"]],
  ["pricing", "قیمت‌گذاری", "pricing", ["sales", "revenue"]],
  ["followup", "پیگیری فروش", "sales", ["sales", "salesCapacity"]],
  ["script", "گفت‌وگوی فروش", "conversion", ["sales"]],
  ["proof", "مطالعه موردی", "conversion", ["activation", "sales"]],
  ["speed", "سرعت پاسخ به لید", "conversion", ["activation", "salesCapacity"]],
  [
    "onboarding",
    "شروع همکاری مشتری",
    "experience",
    ["activation", "retention"],
  ],
  ["success", "موفقیت مشتری", "retention", ["retention"]],
  ["repeat", "خرید مجدد", "retention", ["retention"]],
  ["loyalty", "وفاداری", "retention", ["retention"]],
  ["quality", "کیفیت خدمت", "operations", ["delivery", "retention"]],
  ["upsell", "ارتقای خرید", "revenue", ["revenue"]],
  ["cross", "فروش مکمل", "revenue", ["revenue"]],
  ["mix", "ترکیب محصول", "product", ["revenue"]],
  ["contract", "اندازه قرارداد", "revenue", ["revenue"]],
  ["hiring", "جذب همکار", "capacity", ["team", "salesCapacity", "delivery"]],
  ["delegation", "تفویض اختیار", "capacity", ["founder", "team"]],
  [
    "automation",
    "خودکارسازی",
    "automation",
    ["salesCapacity", "delivery", "team"],
  ],
  ["process", "بازطراحی فرآیند", "operations", ["delivery", "founder"]],
];
export function seedScale(
  at = new Date().toISOString(),
  ownerRoleId = "",
): ScaleStore {
  const c = {
    ...newConstraint(),
    id: "sample-qualified",
    title: "تعداد لید واجد شرایط برای رسیدن به هدف درآمدی کافی نیست.",
    description:
      "نمونه آموزشی مشاوره؛ رابطه ظرفیت ورودی و قرارداد بررسی می‌شود.",
    dimension: "acquisition" as const,
    confidence: "high" as const,
    severity: "high" as const,
    status: ownerRoleId ? ("active" as const) : ("candidate" as const),
    ownerRoleId,
    impact: "کاهش امکان رسیدن به تعداد قرارداد هدف",
    evidence: [
      {
        type: "metric" as const,
        text: "نمونه: ۱۲ لید واجد شرایط در برابر نیاز داخلی ۲۰ لید برای ۵ قرارداد با فرض تبدیل ۲۵٪. این فرض معیار صنعت نیست.",
      },
    ],
    leverIds: ["content", "events", "referral", "partnership", "outbound"],
    createdAt: at,
    updatedAt: at,
  };
  return {
    version: 1,
    sample: true,
    profile: {
      id: "scale-profile",
      businessModel: "consulting",
      growthGoal: "افزایش درآمد ماهانه مشاوره",
      growthHorizon: "سه ماه آینده",
      currentRevenue: null,
      targetRevenue: null,
      primaryGrowthMetric: "قرارداد مشاوره",
      linkedStrategyKRId: "",
      stage: "repeatability",
      notes: "نمونه قابل ویرایش؛ عملکرد واقعی شرکت نیست.",
      createdAt: at,
      updatedAt: at,
    },
    metrics: Object.fromEntries(
      Object.keys(metricLabels).map((k) => [k, k === "qualified" ? 12 : null]),
    ) as ScaleStore["metrics"],
    metricPeriod: "ماه نمونه",
    metricUnit: "تومان",
    channelMix: "",
    diagnostics: (Object.keys(dimensions) as Dimension[]).map((d) => ({
      dimension: d,
      status:
        d === "acquisition"
          ? "candidate"
          : d === "delivery" || d === "sales"
            ? "watch"
            : "unknown",
      evidence:
        d === "acquisition"
          ? c.evidence[0].text
          : d === "delivery"
            ? "مشاهده نمونه: ظرفیت تحویل نیازمند پایش است."
            : d === "sales"
              ? "قضاوت نمونه: تبدیل فروش متوسط است."
              : "",
      metricValue: null,
      benchmarkType: "management",
      managementObservation: "",
      dataCompleteness: ["acquisition", "delivery", "sales"].includes(d)
        ? 50
        : 0,
      updatedAt: at,
    })),
    constraints: [c],
    primaryConstraintId: ownerRoleId ? c.id : null,
    levers: definitions.map(([id, name, category, applicableDimensions]) => ({
      id,
      name,
      category,
      applicableDimensions,
      description: "حوزه ممکن مداخله؛ مناسب بودن آن باید با شواهد بررسی شود.",
      active: true,
      custom: false,
      createdAt: at,
    })),
    ideas: [
      "گزارش تخصصی صنعت برای جذب مدیران",
      "رویداد اختصاصی مدیران عامل",
      "سیستم معرفی مشتریان فعلی",
      "ارتباط هدفمند با شرکت‌های منتخب",
    ].map((title, index) => ({
      ...newIdea(),
      id: `sample-idea-${index + 1}`,
      title,
      constraintId: c.id,
      leverId: ["content", "events", "referral", "outbound"][index],
      source: "founder",
      createdAt: at,
      updatedAt: at,
      history: [{ at, from: "", to: "inbox" }],
    })),
  };
}
