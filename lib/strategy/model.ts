import type { KeyResult } from "./kr/types";
import type {
  KRCheckIn,
  StrategyWeeklyReview,
  StrategyDecision,
  ObjectiveWeeklySnapshot,
  StrategyWeeklySnapshot,
} from "./weekly/types";
import { validateWeeklyStorage } from "./weekly/validation";
import { validateAdaptStorage } from "./adapt/validation";
import { validateKRStorage } from "./kr/validation";
import type { StrategicInitiative } from "./initiatives/types";
import { validateInitiativeStorage } from "./initiatives/validation";
export const cycleStatuses = {
  draft: "پیش‌نویس",
  active: "فعال",
  review: "در حال بازبینی",
  completed: "تکمیل‌شده",
  archived: "آرشیو",
};
export const cycleTypes = {
  quarterly: "سه‌ماهه",
  fourMonth: "چهارماهه",
  halfYear: "شش‌ماهه",
  annual: "سالانه",
  custom: "سفارشی",
};
export const directions = {
  revenue: "رشد درآمد",
  profitability: "سودآوری",
  market: "توسعه بازار",
  geographic: "توسعه جغرافیایی",
  product: "توسعه محصول",
  customer: "رشد مشتریان",
  brand: "برند",
  efficiency: "بهره‌وری عملیاتی",
  capability: "سازمان و قابلیت‌ها",
  digital: "تحول دیجیتال",
  retention: "حفظ مشتری",
  channel: "توسعه کانال فروش",
  custom: "سفارشی",
};
export const priorityStatuses = {
  proposed: "پیشنهادی",
  selected: "منتخب",
  deprioritized: "خارج از تمرکز",
  completed: "تکمیل‌شده",
};
export const objectiveStatuses = {
  draft: "پیش‌نویس",
  active: "فعال",
  completed: "تکمیل‌شده",
  cancelled: "لغوشده",
};
export const contextLabels = {
  situation: "وضعیت فعلی",
  challenge: "چالش اصلی رشد",
  constraint: "محدودیت اصلی",
  opportunity: "فرصت استراتژیک",
  risk: "ریسک اصلی",
  desiredState: "وضعیت مطلوب پایان دوره",
  notes: "یادداشت‌ها",
};
export interface StrategyCycle {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  status: keyof typeof cycleStatuses;
  ownerRoleId: string;
  cycleType: keyof typeof cycleTypes;
  strategicTheme: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
}
export type StrategyContext = { cycleId: string } & Record<
  keyof typeof contextLabels,
  string
>;
export interface StrategicPriority {
  id: string;
  cycleId: string;
  title: string;
  description: string;
  direction: keyof typeof directions;
  customDirection: string;
  ownerRoleId: string;
  rank: number;
  rationale: string;
  successDefinition: string;
  status: keyof typeof priorityStatuses;
  createdAt: string;
  updatedAt: string;
}
export interface StrategicChoice {
  id: string;
  cycleId: string;
  type: "focus" | "notNow";
  statement: string;
  rationale: string;
  createdAt: string;
}
export interface StrategyObjective {
  krWeightMode?: "equal" | "custom";
  id: string;
  cycleId: string;
  code: string;
  title: string;
  description: string;
  ownerRoleId: string;
  relatedPriorityId: string;
  status: keyof typeof objectiveStatuses;
  progress?: number;
  health?: string;
  startDate: string;
  deadline: string;
  createdAt: string;
  updatedAt: string;
}
export interface StrategyStore {
  adaptReviews?: import("./adapt/types").StrategyAdaptReview[];
  cycleReviews?: import("./adapt/types").StrategyCycleReview[];
  strategyChanges?: import("./adapt/types").StrategyChangeRecord[];
  strategyLearnings?: import("./adapt/types").StrategyLearning[];
  strategicAssumptions?: import("./adapt/types").StrategicAssumption[];
  cycleResets?: import("./adapt/types").CycleResetRecord[];
  krCheckIns?: KRCheckIn[];
  weeklyReviews?: StrategyWeeklyReview[];
  strategyDecisions?: StrategyDecision[];
  objectiveWeeklySnapshots?: ObjectiveWeeklySnapshot[];
  strategyWeeklySnapshots?: StrategyWeeklySnapshot[];
  initiatives?: StrategicInitiative[];
  keyResults?: KeyResult[];
  version: 1;
  sample: boolean;
  cycles: StrategyCycle[];
  contexts: StrategyContext[];
  priorities: StrategicPriority[];
  choices: StrategicChoice[];
  objectives: StrategyObjective[];
}
export interface StrategyRole {
  personName?: string;
  id: string;
  title: string;
}
export const STRATEGY_KEY = "growth-engine.strategy.v1";
export function emptyStrategy(): StrategyStore {
  return {
    version: 1,
    sample: false,
    cycles: [],
    contexts: [],
    priorities: [],
    choices: [],
    objectives: [],
  };
}
export function emptyContext(cycleId: string): StrategyContext {
  return {
    cycleId,
    situation: "",
    challenge: "",
    constraint: "",
    opportunity: "",
    risk: "",
    desiredState: "",
    notes: "",
  };
}
export function roleName(id: string, roles: StrategyRole[]) {
  return (
    roles.find((r) => r.id === id)?.title ??
    (id ? "نقش در سیستم موجود نیست" : "مالک تعیین نشده")
  );
}
export function isoDateValid(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
export function todayTehran() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function dateLabel(value: string) {
  return isoDateValid(value)
    ? new Date(value + "T12:00:00Z").toLocaleDateString("fa-IR", {
        timeZone: "Asia/Tehran",
      })
    : "—";
}

// Structural validation is deliberately separate from management warnings. Incomplete
// drafts and stale System role references remain recoverable, not silently discarded.
export function validateStrategy(value: unknown): StrategyStore {
  const fail = () => {
    throw new Error("ساختار داده استراتژی معتبر نیست؛ نسخه قبلی حفظ شد.");
  };
  const obj = (v: unknown): Record<string, unknown> =>
    v && typeof v === "object" && !Array.isArray(v)
      ? (v as Record<string, unknown>)
      : fail();
  const text = (v: unknown, required = false) =>
    typeof v === "string" &&
    v.length <= 10000 &&
    (!required || v.trim().length > 0)
      ? v
      : fail();
  const enumeration = (v: unknown, labels: object) =>
    typeof v === "string" && Object.hasOwn(labels, v) ? v : fail();
  const timestamp = (v: unknown) =>
    typeof v === "string" && Number.isFinite(Date.parse(v)) ? v : fail();
  const date = (v: unknown) =>
    typeof v === "string" && isoDateValid(v) ? v : fail();
  const s = obj(value);
  if (s.version !== 1 || typeof s.sample !== "boolean") fail();
  const collections = [
    "cycles",
    "contexts",
    "priorities",
    "choices",
    "objectives",
  ] as const;
  for (const key of collections)
    if (!Array.isArray(s[key]) || (s[key] as unknown[]).length > 10000) fail();
  const cycles = s.cycles as unknown[],
    ids = new Set<string>();
  for (const raw of cycles) {
    const c = obj(raw),
      id = text(c.id, true);
    if (ids.has(id)) fail();
    ids.add(id);
    text(c.name, true);
    for (const k of ["description", "ownerRoleId", "strategicTheme"])
      text(c[k]);
    date(c.startDate);
    date(c.endDate);
    if (String(c.startDate) > String(c.endDate)) fail();
    enumeration(c.status, cycleStatuses);
    enumeration(c.cycleType, cycleTypes);
    timestamp(c.createdAt);
    timestamp(c.updatedAt);
    if (c.closedAt !== undefined) timestamp(c.closedAt);
  }
  if (cycles.filter((c) => obj(c).status === "active").length > 1) fail();
  for (const key of collections.filter((k) => k !== "cycles")) {
    const seen = new Set<string>();
    for (const raw of s[key] as unknown[]) {
      const v = obj(raw);
      if (!ids.has(text(v.cycleId, true))) fail();
      const id = text(key === "contexts" ? v.cycleId : v.id, true);
      if (seen.has(id)) fail();
      seen.add(id);
      if (key === "contexts") {
        for (const k of Object.keys(contextLabels)) text(v[k]);
        continue;
      }
      timestamp(v.createdAt);
      if (key === "choices") {
        enumeration(v.type, { focus: 1, notNow: 1 });
        text(v.statement, true);
        text(v.rationale);
        continue;
      }
      text(v.title, true);
      text(v.description);
      text(v.ownerRoleId);
      timestamp(v.updatedAt);
      if (key === "priorities") {
        enumeration(v.direction, directions);
        enumeration(v.status, priorityStatuses);
        for (const k of ["customDirection", "rationale", "successDefinition"])
          text(v[k]);
        if (v.direction === "custom") text(v.customDirection, true);
        if (
          !Number.isInteger(v.rank) ||
          Number(v.rank) < 1 ||
          Number(v.rank) > 10000
        )
          fail();
      }
      if (key === "objectives") {
        text(v.code, true);
        text(v.relatedPriorityId);
        enumeration(v.status, objectiveStatuses);
        date(v.startDate);
        date(v.deadline);
        if (String(v.startDate) > String(v.deadline)) fail();
        if (
          v.progress !== undefined &&
          (typeof v.progress !== "number" ||
            !Number.isFinite(v.progress) ||
            v.progress < 0 ||
            v.progress > 100)
        )
          fail();
        if (v.health !== undefined) text(v.health);
      }
    }
  }
  const result = value as StrategyStore;
  for (const o of result.objectives)
    if (
      o.relatedPriorityId &&
      !result.priorities.some(
        (p) => p.id === o.relatedPriorityId && p.cycleId === o.cycleId,
      )
    )
      fail();
  for (const c of result.cycles) {
    const codes = result.objectives
      .filter((o) => o.cycleId === c.id)
      .map((o) => o.code);
    if (new Set(codes).size !== codes.length) fail();
  }
  for (const o of result.objectives)
    if (
      o.krWeightMode !== undefined &&
      !["equal", "custom"].includes(o.krWeightMode)
    )
      fail();
  validateKRStorage(result);
  validateInitiativeStorage(result);
  validateWeeklyStorage(result);
  validateAdaptStorage(result);
  return result;
}
export function parseStrategy(raw: string) {
  return validateStrategy(JSON.parse(raw));
}
export function saveCycle(
  store: StrategyStore,
  cycle: StrategyCycle,
  confirmed = false,
): StrategyStore {
  const previous = store.cycles.find(
    (c) => c.status === "active" && c.id !== cycle.id,
  );
  if (cycle.status === "active" && previous && !confirmed)
    throw new Error(
      "برای فعال‌سازی، انتقال دوره فعال قبلی به بازبینی را تأیید کنید.",
    );
  const next = {
    ...cycle,
    closedAt: ["completed", "archived"].includes(cycle.status)
      ? (cycle.closedAt ?? cycle.updatedAt)
      : cycle.closedAt,
  };
  const cycles = store.cycles
    .filter((c) => c.id !== cycle.id)
    .map((c) =>
      cycle.status === "active" && c.status === "active"
        ? { ...c, status: "review" as const, updatedAt: cycle.updatedAt }
        : c,
    );
  const old = store.cycles.find((c) => c.id === cycle.id);
  const archiving = old?.status === "completed" && cycle.status === "archived";
  const review = store.cycleReviews?.find(
    (r) => r.cycleId === cycle.id && r.status === "completed",
  );
  if (archiving && !review)
    throw Error("برای آرشیو دوره، مرور پایان دوره لازم است.");
  return validateStrategy({
    ...store,
    cycles: [...cycles, next],
    ...(archiving
      ? {
          strategyChanges: [
            ...(store.strategyChanges ?? []),
            {
              id: crypto.randomUUID(),
              cycleId: cycle.id,
              entityType: "cycle" as const,
              entityId: cycle.id,
              fieldChanged: "status",
              oldValue: "completed",
              newValue: "archived",
              reason: "آرشیو دوره تکمیل‌شده از تنظیمات دوره",
              reviewId: review!.id,
              changedAt: cycle.updatedAt,
            },
          ],
        }
      : {}),
  });
}
export function reorderPriority(
  store: StrategyStore,
  id: string,
  delta: number,
): StrategyStore {
  const item = store.priorities.find((p) => p.id === id);
  if (!item) return store;
  const sorted = store.priorities
    .filter((p) => p.cycleId === item.cycleId)
    .sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id));
  const index = sorted.findIndex((p) => p.id === id),
    target = index + delta;
  if (target < 0 || target >= sorted.length) return store;
  [sorted[index], sorted[target]] = [sorted[target], sorted[index]];
  const now = new Date().toISOString();
  return {
    ...store,
    priorities: store.priorities.map((p) =>
      p.cycleId === item.cycleId
        ? {
            ...p,
            rank: sorted.findIndex((x) => x.id === p.id) + 1,
            updatedAt: now,
          }
        : p,
    ),
  };
}
export function saveObjective(
  store: StrategyStore,
  objective: StrategyObjective,
  roles: StrategyRole[],
): StrategyStore {
  if (
    objective.status === "active" &&
    (!roles.some((r) => r.id === objective.ownerRoleId) ||
      !store.priorities.some(
        (p) =>
          p.id === objective.relatedPriorityId &&
          p.cycleId === objective.cycleId &&
          p.status === "selected",
      ))
  )
    throw new Error(
      "برای فعال‌سازی هدف، مالک معتبر و اولویت منتخب لازم است. می‌توانید آن را پیش‌نویس ذخیره کنید.",
    );
  return validateStrategy({
    ...store,
    objectives: [
      ...store.objectives.filter((o) => o.id !== objective.id),
      objective,
    ],
  });
}
