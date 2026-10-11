import type { ScaleStore, businessModels } from "../model";
export const stageTypes = {
  traffic: "بازدید",
  lead: "لید",
  qualified: "لید واجد شرایط",
  opportunity: "فرصت",
  meeting: "جلسه",
  proposal: "پیشنهاد",
  order: "سفارش / قرارداد",
  customer: "مشتری",
  delivery: "تحویل",
  repeat: "خرید مجدد",
  expansion: "گسترش",
  renewal: "تمدید",
  custom: "سفارشی",
};
export interface GrowthFunnel {
  id: string;
  name: string;
  businessModel: keyof typeof businessModels;
  description: string;
  active: boolean;
  currency: string;
  createdAt: string;
  updatedAt: string;
}
export interface FunnelStage {
  id: string;
  funnelId: string;
  name: string;
  description: string;
  order: number;
  type: keyof typeof stageTypes;
  ownerRoleId: string;
  metricUnit: string;
  targetConversion: number | null;
  targetVolume: number | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface GrowthRevenueModel {
  funnelId: string;
  revenueStageId: string;
  averageDealValue: number | null;
  targetRevenue: number | null;
  currentRevenue: number | null;
  repeatRate: number | null;
  expansionRevenue: number | null;
  currency: string;
  strategyKRId: string;
  updatedAt: string;
}
export interface FunnelPeriod {
  id: string;
  funnelId: string;
  periodStart: string;
  periodEnd: string;
  label: string;
  cadence: "weekly" | "monthly" | "custom";
  status: "draft" | "completed";
  createdAt: string;
  updatedAt: string;
  snapshot?: {
    funnel: GrowthFunnel;
    stages: FunnelStage[];
    revenue: GrowthRevenueModel | null;
  };
  completedAt?: string;
}
export interface FunnelStageMeasurement {
  id: string;
  periodId: string;
  funnelId: string;
  stageId: string;
  volume: number | null;
  revenueValue: number | null;
  note: string;
  source: string;
  createdAt: string;
  updatedAt: string;
}
export interface FunnelLink {
  id: string;
  kind: "constraint" | "idea" | "experiment";
  entityId: string;
  stageId: string;
  funnelId: string;
  createdAt: string;
}
export interface FunnelEvidence {
  id: string;
  constraintId: string;
  periodId: string;
  stageId: string;
  stageName: string;
  previousStageName: string;
  actual: number | null;
  target: number | null;
  gap: number | null;
  createdAt: string;
}
export interface FunnelData {
  funnels: GrowthFunnel[];
  stages: FunnelStage[];
  periods: FunnelPeriod[];
  measurements: FunnelStageMeasurement[];
  revenueModels: GrowthRevenueModel[];
  links: FunnelLink[];
  evidence: FunnelEvidence[];
  staleDays: number;
}
export const emptyFunnelData = (): FunnelData => ({
  funnels: [],
  stages: [],
  periods: [],
  measurements: [],
  revenueModels: [],
  links: [],
  evidence: [],
  staleDays: 45,
});
export const funnelData = (s: ScaleStore): FunnelData =>
  s.funnelData ?? emptyFunnelData();
export const templates: Record<
  string,
  {
    name: string;
    model: GrowthFunnel["businessModel"];
    stages: [string, FunnelStage["type"]][];
  }
> = {
  consulting: {
    name: "مشاوره",
    model: "consulting",
    stages: [
      ["لید", "lead"],
      ["لید واجد شرایط", "qualified"],
      ["جلسه", "meeting"],
      ["پیشنهاد", "proposal"],
      ["قرارداد", "order"],
      ["تمدید / ارتقا", "renewal"],
    ],
  },
  b2b: {
    name: "فروش سازمانی",
    model: "b2b",
    stages: [
      ["لید", "lead"],
      ["واجد شرایط", "qualified"],
      ["فرصت", "opportunity"],
      ["پیشنهاد", "proposal"],
      ["مذاکره", "custom"],
      ["فروش موفق", "order"],
      ["خرید مجدد", "repeat"],
    ],
  },
  ecommerce: {
    name: "تجارت الکترونیک",
    model: "ecommerce",
    stages: [
      ["بازدید", "traffic"],
      ["مشاهده محصول", "custom"],
      ["سبد خرید", "custom"],
      ["تسویه", "custom"],
      ["خرید", "order"],
      ["خرید مجدد", "repeat"],
    ],
  },
  distribution: {
    name: "واردات / توزیع",
    model: "distribution",
    stages: [
      ["لید / توزیع‌کننده", "lead"],
      ["استعلام", "custom"],
      ["پیش‌فاکتور", "proposal"],
      ["سفارش", "order"],
      ["تحویل", "delivery"],
      ["سفارش مجدد", "repeat"],
    ],
  },
  custom: { name: "شروع خالی", model: "custom", stages: [] },
};
export const uid = () => crypto.randomUUID();
export const timestamp = () => new Date().toISOString();
export function newStage(funnelId: string, order: number): FunnelStage {
  const at = timestamp();
  return {
    id: uid(),
    funnelId,
    name: "مرحله جدید",
    description: "",
    order,
    type: "custom",
    ownerRoleId: "",
    metricUnit: "تعداد",
    targetConversion: null,
    targetVolume: null,
    active: true,
    createdAt: at,
    updatedAt: at,
  };
}
export function blankRevenue(funnelId: string): GrowthRevenueModel {
  return {
    funnelId,
    revenueStageId: "",
    averageDealValue: null,
    targetRevenue: null,
    currentRevenue: null,
    repeatRate: null,
    expansionRevenue: null,
    currency: "تومان",
    strategyKRId: "",
    updatedAt: timestamp(),
  };
}
export function periodStages(d: FunnelData, p: FunnelPeriod) {
  return (
    p.snapshot?.stages ??
    d.stages
      .filter((s) => s.funnelId === p.funnelId && s.active)
      .sort((a, b) => a.order - b.order)
  );
}
export function completedPeriods(d: FunnelData, id: string) {
  return d.periods
    .filter((p) => p.funnelId === id && p.status === "completed")
    .sort(
      (a, b) =>
        a.periodEnd.localeCompare(b.periodEnd) ||
        a.createdAt.localeCompare(b.createdAt),
    );
}
