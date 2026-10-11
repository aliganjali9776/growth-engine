import type { ScaleStore } from "../model";
export const channelCategories = {
  paid: "تبلیغات پولی",
  content: "محتوای ارگانیک",
  seo: "جست‌وجوی ارگانیک",
  outbound: "ارتباط هدفمند",
  referral: "معرفی مشتری",
  partnership: "مشارکت",
  events: "رویداد",
  community: "جامعه",
  media: "رسانه / روابط عمومی",
  marketplace: "بازارگاه",
  reseller: "نماینده / توزیع‌کننده",
  sales: "فروش مستقیم",
  affiliate: "همکاری در فروش",
  crm: "ایمیل / ارتباط با مشتری",
  social: "شبکه اجتماعی",
  offline: "آفلاین",
  custom: "سفارشی",
};
export const channelStatuses = {
  exploring: "در حال بررسی",
  testing: "در حال آزمایش",
  active: "فعال",
  scaling: "در حال توسعه",
  paused: "متوقف",
  retired: "کنارگذاشته‌شده",
};
export const maturities = {
  unproven: "اثبات‌نشده",
  early: "نشانه اولیه",
  repeatable: "تکرارپذیر",
  predictable: "قابل پیش‌بینی",
  scalable: "آماده مقیاس‌دهی",
};
export const channelDecisions = {
  explore: "بررسی",
  continue: "ادامه",
  invest: "افزایش سرمایه‌گذاری",
  optimize: "بهینه‌سازی",
  reduce: "کاهش",
  pause: "توقف موقت",
  retire: "کنارگذاری",
};
export const metricNames = {
  spend: "هزینه جذب ثبت‌شده",
  leads: "لید",
  qualifiedLeads: "لید واجد شرایط",
  opportunities: "فرصت فروش",
  customers: "مشتری",
  revenue: "درآمد منتسب‌شده",
  repeatCustomers: "مشتری تکراری",
  impressions: "نمایش",
  clicks: "کلیک",
};
export type ChannelValues = Record<keyof typeof metricNames, number | null>;
export interface GrowthChannel {
  id: string;
  name: string;
  category: keyof typeof channelCategories;
  description: string;
  ownerRoleId: string;
  status: keyof typeof channelStatuses;
  maturity: keyof typeof maturities;
  targetAudience: string;
  linkedLeverId: string;
  active: boolean;
  funnelStageId: string;
  strategyObjectiveId: string;
  strategyKRId: string;
  systemProcessId: string;
  createdAt: string;
  updatedAt: string;
}
export interface ChannelPeriodMeasurement extends ChannelValues {
  id: string;
  channelId: string;
  periodStart: string;
  periodEnd: string;
  cadence: "weekly" | "monthly" | "custom";
  attribution: "primary" | "assisted";
  currency: string;
  status: "draft" | "completed";
  customMetrics: { name: string; unit: string; value: number | null }[];
  note: string;
  source: string;
  contributedVolume: number | null;
  createdAt: string;
  completedAt?: string;
  snapshot?: GrowthChannel;
}
export interface ChannelDecision {
  id: string;
  channelId: string;
  decision: keyof typeof channelDecisions;
  reason: string;
  ownerRoleId: string;
  previousStatus: GrowthChannel["status"];
  previousMaturity: GrowthChannel["maturity"];
  status: GrowthChannel["status"];
  maturity: GrowthChannel["maturity"];
  capacityReviewed: boolean;
  economicsReviewed: boolean;
  sourceReview: string;
  createdAt: string;
  channelName: string;
}
export const loopTypes = {
  referral: "معرفی مشتری",
  content: "محتوا",
  product: "محصول / استفاده",
  partner: "شریک",
  marketplace: "بازارگاه",
  community: "جامعه",
  expansion: "گسترش فروش",
  repeat: "حفظ / تکرار",
  custom: "سفارشی",
};
export const loopStatuses = {
  concept: "مفهوم اولیه",
  testing: "در حال آزمایش",
  active: "فعال",
  strengthening: "در حال تقویت",
  weak: "ضعیف",
  paused: "متوقف",
  archived: "آرشیو",
};
export const evidenceLevels = {
  none: "بدون شواهد",
  early: "اولیه",
  repeated: "تکرارشده",
};
export interface GrowthLoop {
  id: string;
  name: string;
  description: string;
  type: keyof typeof loopTypes;
  status: keyof typeof loopStatuses;
  ownerRoleId: string;
  primaryOutputMetricId: string;
  loopCycleTime: number | null;
  evidenceLevel: keyof typeof evidenceLevels;
  hypothesis: string;
  input: string;
  valueCreated: string;
  output: string;
  reentry: string;
  dependency: string;
  createdAt: string;
  updatedAt: string;
}
export interface GrowthLoopNode {
  id: string;
  loopId: string;
  order: number;
  name: string;
  description: string;
  metricId: string;
  linkedFunnelStageId: string;
  linkedChannelId: string;
  ownerRoleId: string;
  active: boolean;
}
export const evidenceSources = {
  channel: "داده کانال",
  funnel: "داده قیف",
  experiment: "نتیجه آزمایش",
  observation: "مشاهده دستی",
  customer: "مشاهده مشتری",
  other: "سایر",
};
export interface LoopEvidence {
  id: string;
  loopId: string;
  type: keyof typeof evidenceSources;
  sourceId: string;
  text: string;
  createdAt: string;
}
export interface LoopLeakage {
  id: string;
  loopId: string;
  nodeId: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  resolved: boolean;
  createdAt: string;
}
export interface GrowthLoopPeriod {
  id: string;
  loopId: string;
  periodStart: string;
  periodEnd: string;
  status: "draft" | "completed";
  nodeMeasurements: { nodeId: string; value: number | null }[];
  outputMetric: number | null;
  inputVolume: number | null;
  cycleTime: number | null;
  note: string;
  createdAt: string;
  completedAt?: string;
  snapshot?: {
    loop: GrowthLoop;
    nodes: GrowthLoopNode[];
    metricName: string;
    metricUnit: string;
  };
}
export interface NetworkLink {
  id: string;
  kind: "constraint" | "idea" | "experiment" | "learning";
  entityId: string;
  channelId: string;
  loopId: string;
  nodeId: string;
  leakageId: string;
  createdAt: string;
}
export interface NetworkData {
  channels: GrowthChannel[];
  channelPeriods: ChannelPeriodMeasurement[];
  decisions: ChannelDecision[];
  loops: GrowthLoop[];
  nodes: GrowthLoopNode[];
  loopPeriods: GrowthLoopPeriod[];
  evidence: LoopEvidence[];
  leakage: LoopLeakage[];
  links: NetworkLink[];
  staleDays: number;
}
export const emptyNetwork = (): NetworkData => ({
  channels: [],
  channelPeriods: [],
  decisions: [],
  loops: [],
  nodes: [],
  loopPeriods: [],
  evidence: [],
  leakage: [],
  links: [],
  staleDays: 45,
});
export const networkData = (s: ScaleStore) => s.networkData ?? emptyNetwork();
export const id = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export const day = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export function newChannel(): GrowthChannel {
  const at = now();
  return {
    id: id(),
    name: "",
    category: "custom",
    description: "",
    ownerRoleId: "",
    status: "exploring",
    maturity: "unproven",
    targetAudience: "",
    linkedLeverId: "",
    active: true,
    funnelStageId: "",
    strategyObjectiveId: "",
    strategyKRId: "",
    systemProcessId: "",
    createdAt: at,
    updatedAt: at,
  };
}
export function newChannelPeriod(channelId: string): ChannelPeriodMeasurement {
  return {
    id: id(),
    channelId,
    periodStart: "",
    periodEnd: "",
    cadence: "monthly",
    attribution: "primary",
    currency: "تومان",
    status: "draft",
    spend: null,
    leads: null,
    qualifiedLeads: null,
    opportunities: null,
    customers: null,
    revenue: null,
    repeatCustomers: null,
    impressions: null,
    clicks: null,
    customMetrics: [],
    note: "",
    source: "",
    contributedVolume: null,
    createdAt: now(),
  };
}
export function newLoop(): GrowthLoop {
  const at = now();
  return {
    id: id(),
    name: "",
    description: "",
    type: "custom",
    status: "concept",
    ownerRoleId: "",
    primaryOutputMetricId: "",
    loopCycleTime: null,
    evidenceLevel: "none",
    hypothesis: "",
    input: "",
    valueCreated: "",
    output: "",
    reentry: "",
    dependency: "",
    createdAt: at,
    updatedAt: at,
  };
}
export function newNode(loopId: string, order: number): GrowthLoopNode {
  return {
    id: id(),
    loopId,
    order,
    name: "مرحله جدید",
    description: "",
    metricId: "",
    linkedFunnelStageId: "",
    linkedChannelId: "",
    ownerRoleId: "",
    active: true,
  };
}
export const channelPeriods = (d: NetworkData, cid: string) =>
  d.channelPeriods
    .filter((p) => p.channelId === cid && p.status === "completed")
    .sort(
      (a, b) =>
        a.periodEnd.localeCompare(b.periodEnd) ||
        a.createdAt.localeCompare(b.createdAt),
    );
export const loopPeriods = (d: NetworkData, lid: string) =>
  d.loopPeriods
    .filter((p) => p.loopId === lid && p.status === "completed")
    .sort(
      (a, b) =>
        a.periodEnd.localeCompare(b.periodEnd) ||
        a.createdAt.localeCompare(b.createdAt),
    );
