import type { ScaleStore, Level } from "../model";
export const statuses = {
  draft: "پیش‌نویس",
  ready: "آماده اجرا",
  running: "در حال اجرا",
  paused: "متوقف موقت",
  completed: "تکمیل‌شده",
  cancelled: "لغوشده",
};
export const results = {
  win: "موفق",
  partial: "موفقیت نسبی",
  noEffect: "بدون تغییر فراتر از آستانه",
  negative: "اثر منفی",
  inconclusive: "نتیجه نامشخص",
};
export const decisions = {
  scale: "مقیاس‌دهی",
  iterate: "تکرار با تغییر",
  retest: "آزمایش مجدد",
  monitor: "ادامه پایش",
  stop: "توقف",
  archive: "آرشیو",
};
export const experimentTypes = {
  channel: "آزمایش کانال",
  offer: "آزمایش پیشنهاد",
  pricing: "آزمایش قیمت",
  conversion: "آزمایش تبدیل",
  sales: "آزمایش فروش",
  retention: "آزمایش حفظ مشتری",
  referral: "آزمایش معرفی",
  product: "آزمایش محصول",
  capacity: "آزمایش فرآیند / ظرفیت",
  messaging: "آزمایش پیام",
  other: "سایر",
};
export const metricCategories = {
  acquisition: "جذب",
  activation: "فعال‌سازی",
  conversion: "تبدیل",
  sales: "فروش",
  retention: "حفظ مشتری",
  revenue: "درآمد",
  referral: "معرفی",
  capacity: "ظرفیت",
  efficiency: "بهره‌وری",
  custom: "سفارشی",
};
export const directions = {
  increase: "افزایشی",
  decrease: "کاهشی",
  maintain: "حفظ سطح",
  binary: "بله / خیر",
};
export const sourceTypes = {
  manual: "دستی",
  strategy: "نتیجه کلیدی استراتژی",
  system: "شاخص سیستم",
  custom: "سفارشی",
};
export interface GrowthMetric {
  id: string;
  name: string;
  category: keyof typeof metricCategories;
  unit: string;
  direction: keyof typeof directions;
  sourceType: keyof typeof sourceTypes;
  sourceId: string;
  custom: boolean;
  description: string;
}
export interface GrowthExperiment {
  id: string;
  code: string;
  title: string;
  description: string;
  ideaId: string;
  constraintId: string;
  leverId: string;
  ownerRoleId: string;
  type: keyof typeof experimentTypes;
  hypothesis: {
    change: string;
    audience: string;
    movement: string;
    rationale: string;
  };
  experimentDesign: {
    change: string;
    audience: string;
    channel: string;
    sample: string;
    comparison: string;
    notes: string;
  };
  primaryMetricId: string;
  secondaryMetricIds: string[];
  baselineValue: number | null;
  baselinePeriod: string;
  baselineSource: string;
  targetValue: number | null;
  minimumSuccessThreshold: number | null;
  tolerance: number;
  successCriteria: string;
  startDate: string;
  endDate: string;
  status: keyof typeof statuses;
  confidenceBefore: Level | null;
  confidenceAfter: Level | null;
  resultStatus: keyof typeof results | null;
  resultRationale: string;
  parentExperimentId: string;
  executionNotes: string;
  blockers: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  snapshot?: {
    constraintTitle: string;
    ideaTitle: string;
    leverName: string;
    ownerName: string;
    strategyObjectiveId: string;
    strategyKRId: string;
    systemProcessId: string;
    metrics: GrowthMetric[];
  };
}
export interface ExperimentMeasurement {
  id: string;
  experimentId: string;
  metricId: string;
  measurementDate: string;
  value: number;
  note: string;
  source: string;
  createdAt: string;
}
export interface GrowthLearning {
  id: string;
  experimentId: string;
  constraintId: string;
  ideaId: string;
  leverId: string;
  statement: string;
  evidence: string;
  reusableInsight: string;
  createdAt: string;
}
export interface ExperimentDecision {
  id: string;
  experimentId: string;
  decision: keyof typeof decisions;
  rationale: string;
  capacityReviewed: boolean;
  alignmentReviewed: boolean;
  context: string;
  createdAt: string;
}
export interface IdeaReview {
  id: string;
  ideaId: string;
  experimentId: string;
  status: "validated" | "rejected" | "review";
  reason: string;
  createdAt: string;
}
export interface ExperimentData {
  metrics: GrowthMetric[];
  experiments: GrowthExperiment[];
  measurements: ExperimentMeasurement[];
  learnings: GrowthLearning[];
  decisions: ExperimentDecision[];
  ideaReviews: IdeaReview[];
  staleDays: number;
}
export function metricLibrary(): GrowthMetric[] {
  return (
    [
      ["qualified", "لید واجد شرایط", "acquisition", "لید", "increase"],
      ["cpl", "هزینه هر لید", "acquisition", "تومان", "decrease"],
      ["leadMeeting", "تبدیل لید به جلسه", "conversion", "٪", "increase"],
      [
        "meetingProposal",
        "تبدیل جلسه به پیشنهاد",
        "conversion",
        "٪",
        "increase",
      ],
      [
        "proposalContract",
        "تبدیل پیشنهاد به قرارداد",
        "sales",
        "٪",
        "increase",
      ],
      ["repeat", "نرخ خرید مجدد", "retention", "٪", "increase"],
      ["deal", "میانگین قرارداد", "revenue", "تومان", "increase"],
      ["customerRevenue", "درآمد هر مشتری", "revenue", "تومان", "increase"],
      ["salesCycle", "زمان چرخه فروش", "sales", "روز", "decrease"],
      ["deliveryTime", "زمان تحویل", "capacity", "روز", "decrease"],
      ["founder", "درگیری بنیان‌گذار", "capacity", "٪", "decrease"],
      ["referral", "نرخ معرفی", "referral", "٪", "increase"],
      ["serviceLevel", "حفظ سطح خدمت", "efficiency", "امتیاز", "maintain"],
      ["accepted", "پذیرش نتیجه", "custom", "بله / خیر", "binary"],
    ] as [
      string,
      string,
      GrowthMetric["category"],
      string,
      GrowthMetric["direction"],
    ][]
  ).map(([id, name, category, unit, direction]) => ({
    id,
    name,
    category,
    unit,
    direction,
    sourceType: "manual",
    sourceId: "",
    custom: false,
    description: "مقدار فقط از مشاهده ثبت‌شده مدیریت می‌آید.",
  }));
}
export function experimentData(s: ScaleStore): ExperimentData {
  return (
    s.experimentData ?? {
      metrics: metricLibrary(),
      experiments: [],
      measurements: [],
      learnings: [],
      decisions: [],
      ideaReviews: [],
      staleDays: 7,
    }
  );
}
export function newExperiment(s: ScaleStore): GrowthExperiment {
  const at = new Date().toISOString(),
    data = experimentData(s);
  return {
    id: crypto.randomUUID(),
    code: `EXP-${Math.max(0, ...data.experiments.map((e) => Number(e.code.replace("EXP-", "")) || 0)) + 1}`,
    title: "",
    description: "",
    ideaId: "",
    constraintId: "",
    leverId: "",
    ownerRoleId: "",
    type: "other",
    hypothesis: { change: "", audience: "", movement: "", rationale: "" },
    experimentDesign: {
      change: "",
      audience: "",
      channel: "",
      sample: "",
      comparison: "",
      notes: "",
    },
    primaryMetricId: "",
    secondaryMetricIds: [],
    baselineValue: null,
    baselinePeriod: "",
    baselineSource: "",
    targetValue: null,
    minimumSuccessThreshold: null,
    tolerance: 0,
    successCriteria: "",
    startDate: "",
    endDate: "",
    status: "draft",
    confidenceBefore: null,
    confidenceAfter: null,
    resultStatus: null,
    resultRationale: "",
    parentExperimentId: "",
    executionNotes: "",
    blockers: "",
    createdAt: at,
    updatedAt: at,
  };
}
