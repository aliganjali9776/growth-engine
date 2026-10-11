export const SCALE_KEY = "growth-engine.scale.v1";
export const businessModels = {
  service: "خدماتی",
  consulting: "مشاوره",
  ecommerce: "تجارت الکترونیک",
  retail: "خرده‌فروشی",
  b2b: "فروش سازمانی",
  saas: "اشتراکی / نرم‌افزار",
  manufacturing: "تولیدی",
  distribution: "واردات / توزیع",
  education: "آموزشی",
  marketplace: "بازارگاه",
  custom: "سفارشی",
};
export const dimensions = {
  acquisition: "جذب تقاضا",
  activation: "تبدیل اولیه",
  sales: "تبدیل فروش",
  retention: "حفظ / خرید مجدد",
  revenue: "گسترش درآمد مشتری",
  channel: "تمرکز کانال",
  salesCapacity: "ظرفیت فروش",
  delivery: "ظرفیت تحویل",
  team: "ظرفیت تیم",
  founder: "وابستگی به بنیان‌گذار",
};
export type Dimension = keyof typeof dimensions;
export const stages = {
  demand: "یافتن تقاضا",
  repeatability: "ساخت تکرارپذیری",
  predictability: "ساخت پیش‌بینی‌پذیری",
  scaling: "مقیاس‌دادن",
  optimizing: "بهینه‌سازی",
};
export const diagnosticStatuses = {
  strong: "قوی",
  watch: "نیازمند پایش",
  candidate: "کاندید گلوگاه",
  unknown: "داده کافی نیست",
};
export const benchmarks = {
  management: "قضاوت مدیریت",
  target: "هدف داخلی",
  history: "عملکرد تاریخی",
  trend: "روند شرکت",
};
export const levels = { high: "زیاد", medium: "متوسط", low: "کم" };
export const severityLabels = {
  critical: "بحرانی",
  high: "بالا",
  medium: "متوسط",
  low: "پایین",
};
export const constraintStatuses = {
  candidate: "کاندید",
  active: "فعال",
  monitoring: "تحت پایش",
  resolved: "حل‌شده",
  archived: "آرشیو",
};
export const evidenceTypes = {
  metric: "شاخص",
  observation: "مشاهده",
  system: "یافته سیستم",
  strategy: "یافته استراتژی",
  customer: "بازخورد مشتری",
  other: "سایر",
};
export const ideaSources = {
  customer: "بازخورد مشتری",
  sales: "تیم فروش",
  marketing: "تیم بازاریابی",
  founder: "بنیان‌گذار",
  employee: "همکار",
  competitor: "رقیب",
  data: "تحلیل داده",
  strategy: "مرور استراتژی",
  system: "مسئله سیستم",
  trend: "روند بازار",
  failedExperiment: "آزمایش ناموفق",
  other: "سایر",
};
export const ideaStatuses = {
  inbox: "ورودی",
  review: "در حال بررسی",
  prioritized: "اولویت‌بندی‌شده",
  ready: "آماده آزمایش",
  experiment: "در حال آزمایش",
  validated: "تأییدشده",
  rejected: "ردشده",
  archived: "آرشیو",
};
export const categories = {
  acquisition: "جذب",
  conversion: "تبدیل",
  retention: "حفظ مشتری",
  revenue: "درآمد",
  product: "محصول",
  sales: "فروش",
  channel: "کانال",
  offer: "پیشنهاد",
  pricing: "قیمت‌گذاری",
  experience: "تجربه مشتری",
  operations: "عملیات",
  automation: "خودکارسازی",
  partnership: "مشارکت",
  referral: "معرفی مشتری",
  capacity: "ظرفیت",
  custom: "سفارشی",
};
export const metricLabels = {
  leads: "لید ماهانه",
  qualified: "لید واجد شرایط",
  opportunities: "فرصت فروش",
  customers: "مشتری جدید",
  repeat: "مشتری تکراری",
  revenue: "درآمد ماهانه",
  averageValue: "میانگین سفارش / قرارداد",
  conversion: "نرخ تبدیل (%)",
  retention: "نرخ حفظ / تکرار (%)",
  salesCapacity: "ظرفیت فروش ماهانه",
  deliveryCapacity: "ظرفیت تحویل ماهانه",
  founder: "درگیری بنیان‌گذار (%)",
};
export type Level = keyof typeof levels;
export interface ScaleProfile {
  id: string;
  businessModel: keyof typeof businessModels | "";
  growthGoal: string;
  growthHorizon: string;
  currentRevenue: number | null;
  targetRevenue: number | null;
  primaryGrowthMetric: string;
  linkedStrategyKRId: string;
  stage: keyof typeof stages | "";
  notes: string;
  createdAt: string;
  updatedAt: string;
}
export interface GrowthDimensionDiagnostic {
  dimension: Dimension;
  status: keyof typeof diagnosticStatuses;
  evidence: string;
  metricValue: number | null;
  benchmarkType: keyof typeof benchmarks;
  managementObservation: string;
  dataCompleteness: number;
  updatedAt: string;
}
export interface Evidence {
  type: keyof typeof evidenceTypes;
  text: string;
}
export interface GrowthConstraint {
  id: string;
  title: string;
  description: string;
  dimension: Dimension;
  evidence: Evidence[];
  severity: keyof typeof severityLabels;
  impact: string;
  confidence: Level;
  status: keyof typeof constraintStatuses;
  ownerRoleId: string;
  linkedStrategyObjectiveId: string;
  linkedStrategyKRId: string;
  linkedSystemProcessId: string;
  leverIds: string[];
  symptom: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}
export interface GrowthLever {
  id: string;
  name: string;
  category: keyof typeof categories;
  description: string;
  applicableDimensions: Dimension[];
  active: boolean;
  custom: boolean;
  createdAt: string;
}
export interface GrowthIdea {
  id: string;
  title: string;
  description: string;
  source: keyof typeof ideaSources;
  constraintId: string;
  leverId: string;
  ownerRoleId: string;
  rationale: string;
  intervention: string;
  expectedImpact: Level | "unknown";
  confidence: Level | null;
  effort: Level | null;
  estimatedCost: string;
  evidence: string;
  successMetric: string;
  status: keyof typeof ideaStatuses;
  createdAt: string;
  updatedAt: string;
  history: { at: string; from: string; to: keyof typeof ideaStatuses }[];
}
export interface ScaleStore {
  networkData?: import("./network/model").NetworkData;
  readinessData?: import("./readiness/model").ReadinessData;
  funnelData?: import("./funnel/model").FunnelData;
  experimentData?: import("./experiments/model").ExperimentData;
  version: 1;
  sample: boolean;
  profile: ScaleProfile;
  metrics: Record<keyof typeof metricLabels, number | null>;
  metricPeriod: string;
  metricUnit: string;
  channelMix: string;
  diagnostics: GrowthDimensionDiagnostic[];
  constraints: GrowthConstraint[];
  primaryConstraintId: string | null;
  levers: GrowthLever[];
  ideas: GrowthIdea[];
}
export const now = () => new Date().toISOString();
export function newConstraint(): GrowthConstraint {
  const at = now();
  return {
    id: crypto.randomUUID(),
    title: "",
    description: "",
    dimension: "acquisition",
    evidence: [],
    severity: "medium",
    impact: "",
    confidence: "low",
    status: "candidate",
    ownerRoleId: "",
    linkedStrategyObjectiveId: "",
    linkedStrategyKRId: "",
    linkedSystemProcessId: "",
    leverIds: [],
    symptom: "",
    notes: "",
    createdAt: at,
    updatedAt: at,
  };
}
export function newIdea(): GrowthIdea {
  const at = now();
  return {
    id: crypto.randomUUID(),
    title: "",
    description: "",
    source: "other",
    constraintId: "",
    leverId: "",
    ownerRoleId: "",
    rationale: "",
    intervention: "",
    expectedImpact: "unknown",
    confidence: null,
    effort: null,
    estimatedCost: "",
    evidence: "",
    successMetric: "",
    status: "inbox",
    createdAt: at,
    updatedAt: at,
    history: [],
  };
}
