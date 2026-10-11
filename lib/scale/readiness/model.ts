import type { ScaleStore } from "../model";
export const sourceTypes = {
  experiment: "آزمایش موفق",
  idea: "ایده اعتبارسنجی‌شده",
  channel: "کانال",
  loop: "حلقه رشد",
  funnel: "فرصت قیف",
  management: "مدیریت",
};
export const candidateStatuses = {
  candidate: "کاندید",
  assessing: "در حال ارزیابی",
  ready: "آماده مقیاس‌دهی",
  prepare: "نیازمند آماده‌سازی",
  hold: "فعلاً متوقف",
  scaling: "در حال مقیاس‌دهی",
  stopped: "متوقف‌شده",
  archived: "آرشیو",
};
export const financialStates = {
  unknown: "نامشخص",
  strong: "قوی",
  adequate: "کافی",
  watch: "نیازمند پایش",
  constraint: "محدودیت",
};
export const financeTypes = {
  workingCapital: "سرمایه در گردش",
  marketing: "بودجه بازاریابی",
  hiring: "بودجه جذب نیرو",
  inventory: "نیاز موجودی",
  payment: "چرخه پرداخت",
  cash: "فشار چرخه نقد",
  other: "سایر",
};
export const areaTypes = {
  sales: "فروش",
  delivery: "تحویل / عملیات",
  team: "تیم",
  founder: "بنیان‌گذار",
  process: "فرآیند",
  finance: "مالی",
  inventory: "موجودی",
  supplier: "تأمین‌کننده",
  logistics: "لجستیک",
  production: "تولید",
  machine: "ماشین",
  shift: "شیفت",
  materials: "مواد اولیه",
  warehouse: "انبار",
  quality: "کنترل کیفیت",
  consultant: "مشاور",
  projects: "پروژه",
  hours: "ساعت خدمت",
  accounts: "مدیر حساب",
  fulfillment: "پردازش سفارش",
  support: "پشتیبانی",
  shipping: "ارسال",
  returns: "مرجوعی",
  custom: "سفارشی",
};
export const decisions = {
  scale: "مقیاس‌دهی اکنون",
  prepare: "آماده‌سازی سپس مقیاس‌دهی",
  experiment: "آزمایش بیشتر",
  hold: "فعلاً صبر",
  stop: "توقف",
};
export const preparationCategories = {
  people: "نیرو",
  process: "فرآیند",
  technology: "فناوری",
  capacity: "ظرفیت",
  finance: "مالی",
  inventory: "موجودی",
  sales: "فروش",
  delivery: "تحویل",
  data: "داده",
  other: "سایر",
};
export const preparationStatuses = {
  todo: "شروع نشده",
  doing: "در حال انجام",
  completed: "تکمیل‌شده",
  blocked: "مسدود",
};
export const investmentTypes = {
  budget: "بودجه",
  people: "نیرو",
  technology: "فناوری",
  inventory: "موجودی",
  equipment: "تجهیزات",
  attention: "توجه مدیریت",
};
export interface ScaleCandidate {
  id: string;
  name: string;
  sourceType: keyof typeof sourceTypes;
  sourceId: string;
  description: string;
  ownerRoleId: string;
  status: keyof typeof candidateStatuses;
  processIds: string[];
  objectiveId: string;
  krId: string;
  manualEvidence: string;
  manualPositivePeriods: number | null;
  createdAt: string;
  updatedAt: string;
}
export interface CapacityArea {
  id: string;
  candidateId: string;
  name: string;
  area: keyof typeof areaTypes;
  currentCapacity: number | null;
  currentLoad: number | null;
  targetLoad: number | null;
  unit: string;
  period: string;
  ownerRoleId: string;
  processId: string;
  funnelStageId: string;
  source: string;
  notes: string;
  action: string;
  criticalRoleGap: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface ScaleScenario {
  id: string;
  candidateId: string;
  name: string;
  factor: number;
  funnelId: string;
  funnelPeriodId: string;
  outputStageId: string;
  useTargetRates: boolean;
  periodConfirmed: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
}
export interface FinancialCapacity {
  id: string;
  candidateId: string;
  kind: keyof typeof financeTypes;
  state: keyof typeof financialStates;
  evidence: string;
  updatedAt: string;
}
export interface ScaleInvestment {
  id: string;
  candidateId: string;
  kind: keyof typeof investmentTypes;
  amount: number | null;
  unit: string;
  description: string;
}
export interface ScalePreparationItem {
  id: string;
  candidateId: string;
  title: string;
  category: keyof typeof preparationCategories;
  ownerRoleId: string;
  dueDate: string;
  status: keyof typeof preparationStatuses;
  relatedSystemProcessId: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}
export interface ScaleCapacityRisk {
  area: string;
  severity: "critical" | "high" | "medium";
  currentCapacity: number | null;
  requiredCapacity: number | null;
  gap: number | null;
  evidence: string;
  relatedProcessId: string;
  ownerRoleId: string;
  recommendedPreparation: string;
}
export interface ReadinessComponent {
  key: string;
  label: string;
  weight: number;
  value: number | null;
  evidence: string;
}
export interface ScaleReadinessSnapshot {
  id: string;
  candidateId: string;
  createdAt: string;
  assessment: unknown;
  candidate: ScaleCandidate;
  scenario: ScaleScenario | null;
  areas: CapacityArea[];
  financial: FinancialCapacity[];
  investments: ScaleInvestment[];
  preparation: ScalePreparationItem[];
  sourceContext: unknown;
  decision: keyof typeof decisions | null;
}
export interface ScaleDecision {
  id: string;
  scaleCandidateId: string;
  decision: keyof typeof decisions;
  rationale: string;
  reviewedByRoleId: string;
  scenarioId: string;
  createdAt: string;
  snapshotId: string;
}
export interface ReadinessData {
  candidates: ScaleCandidate[];
  areas: CapacityArea[];
  scenarios: ScaleScenario[];
  financial: FinancialCapacity[];
  investments: ScaleInvestment[];
  preparation: ScalePreparationItem[];
  snapshots: ScaleReadinessSnapshot[];
  decisions: ScaleDecision[];
  thresholds: { tight: number; overloaded: number };
}
export const emptyReadiness = (): ReadinessData => ({
  candidates: [],
  areas: [],
  scenarios: [],
  financial: [],
  investments: [],
  preparation: [],
  snapshots: [],
  decisions: [],
  thresholds: { tight: 70, overloaded: 90 },
});
export const readinessData = (s: ScaleStore) =>
  s.readinessData ?? emptyReadiness();
export const id = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export const newCandidate = (): ScaleCandidate => ({
  id: id(),
  name: "",
  sourceType: "management",
  sourceId: "",
  description: "",
  ownerRoleId: "",
  status: "candidate",
  processIds: [],
  objectiveId: "",
  krId: "",
  manualEvidence: "",
  manualPositivePeriods: null,
  createdAt: now(),
  updatedAt: now(),
});
export const newArea = (candidateId: string): CapacityArea => ({
  id: id(),
  candidateId,
  name: "",
  area: "sales",
  currentCapacity: null,
  currentLoad: null,
  targetLoad: null,
  unit: "جلسه",
  period: "ماه",
  ownerRoleId: "",
  processId: "",
  funnelStageId: "",
  source: "",
  notes: "",
  action: "",
  criticalRoleGap: false,
  createdAt: now(),
  updatedAt: now(),
});
export const newScenario = (candidateId: string): ScaleScenario => ({
  id: id(),
  candidateId,
  name: "سناریوی دو برابر",
  factor: 2,
  funnelId: "",
  funnelPeriodId: "",
  outputStageId: "",
  useTargetRates: false,
  periodConfirmed: false,
  notes: "",
  createdAt: now(),
  updatedAt: now(),
});
export const newPreparation = (candidateId: string): ScalePreparationItem => ({
  id: id(),
  candidateId,
  title: "",
  category: "capacity",
  ownerRoleId: "",
  dueDate: "",
  status: "todo",
  relatedSystemProcessId: "",
  notes: "",
  createdAt: now(),
  updatedAt: now(),
});
