import * as M from "./model";
import {
  validateReadiness,
  assertReadinessTransition,
} from "./readiness/validation";
import { validateNetwork, assertNetworkTransition } from "./network/validation";
import { validateFunnel, assertFunnelTransition } from "./funnel/validation";
import {
  validateExperiments,
  assertExperimentTransition,
} from "./experiments/validation";
import { experimentData } from "./experiments/model";
import { ideaReadiness, primaryConstraintValidation } from "./logic";
import { writeTogether } from "../system/storage-transaction";
const obj = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === "object" && !Array.isArray(x);
function assert(v: unknown, msg = "ساختار داده رشد معتبر نیست."): asserts v {
  if (!v) throw Error(msg);
}
const str = (x: unknown) => typeof x === "string" && x.length <= 10000;
const num = (x: unknown) =>
  x === null || (typeof x === "number" && Number.isFinite(x) && x >= 0);
const date = (x: unknown) =>
  typeof x === "string" && Number.isFinite(Date.parse(x));
const member = (x: unknown, o: object) =>
  typeof x === "string" && Object.hasOwn(o, x);
function texts(o: Record<string, unknown>, keys: string[]) {
  keys.forEach((k) => assert(str(o[k]), `فیلد ${k} معتبر نیست.`));
}
function rows(x: unknown): Record<string, unknown>[] {
  assert(Array.isArray(x) && x.length <= 10000);
  const ids = new Set();
  for (const r of x) {
    assert(obj(r) && str(r.id) && !!r.id && !ids.has(r.id));
    ids.add(r.id);
  }
  return x;
}
export function validateScale(value: unknown): M.ScaleStore {
  assert(
    obj(value) && value.version === 1 && typeof value.sample === "boolean",
  );
  const p = value.profile;
  assert(obj(p));
  texts(p, [
    "id",
    "growthGoal",
    "growthHorizon",
    "primaryGrowthMetric",
    "linkedStrategyKRId",
    "notes",
  ]);
  assert(member(p.businessModel, M.businessModels) || p.businessModel === "");
  assert(member(p.stage, M.stages) || p.stage === "");
  assert(
    num(p.currentRevenue) &&
      num(p.targetRevenue) &&
      date(p.createdAt) &&
      date(p.updatedAt),
  );
  assert(obj(value.metrics));
  for (const k of Object.keys(M.metricLabels)) {
    assert(num(value.metrics[k]));
    if (
      ["conversion", "retention", "founder"].includes(k) &&
      value.metrics[k] !== null
    )
      assert((value.metrics[k] as number) <= 100);
  }
  texts(value, ["metricPeriod", "metricUnit", "channelMix"]);
  assert(Array.isArray(value.diagnostics) && value.diagnostics.length === 10);
  const dims = new Set();
  for (const d of value.diagnostics) {
    assert(
      obj(d) && member(d.dimension, M.dimensions) && !dims.has(d.dimension),
    );
    dims.add(d.dimension);
    assert(
      member(d.status, M.diagnosticStatuses) &&
        member(d.benchmarkType, M.benchmarks),
    );
    texts(d, ["evidence", "managementObservation"]);
    assert(
      num(d.metricValue) &&
        typeof d.dataCompleteness === "number" &&
        Number.isFinite(d.dataCompleteness) &&
        d.dataCompleteness >= 0 &&
        d.dataCompleteness <= 100 &&
        date(d.updatedAt),
    );
    if (d.status !== "unknown")
      assert(
        !!(d.evidence as string).trim() ||
          !!(d.managementObservation as string).trim(),
        "برای قضاوت هر بُعد، شواهد یا مشاهده ثبت کنید.",
      );
  }
  const levers = rows(value.levers);
  for (const l of levers) {
    texts(l, ["name", "description"]);
    assert(
      !!(l.name as string).trim() &&
        member(l.category, M.categories) &&
        typeof l.active === "boolean" &&
        typeof l.custom === "boolean" &&
        date(l.createdAt),
    );
    assert(
      Array.isArray(l.applicableDimensions) &&
        l.applicableDimensions.every((d) => member(d, M.dimensions)),
    );
  }
  const constraints = rows(value.constraints);
  for (const c of constraints) {
    texts(c, [
      "title",
      "description",
      "impact",
      "ownerRoleId",
      "linkedStrategyObjectiveId",
      "linkedStrategyKRId",
      "linkedSystemProcessId",
      "symptom",
      "notes",
    ]);
    assert(
      !!(c.title as string).trim() &&
        member(c.dimension, M.dimensions) &&
        member(c.severity, M.severityLabels) &&
        member(c.confidence, M.levels) &&
        member(c.status, M.constraintStatuses) &&
        date(c.createdAt) &&
        date(c.updatedAt),
    );
    assert(c.resolvedAt === undefined || date(c.resolvedAt));
    assert(
      Array.isArray(c.evidence) &&
        c.evidence.length <= 100 &&
        c.evidence.every(
          (e) => obj(e) && member(e.type, M.evidenceTypes) && str(e.text),
        ),
    );
    assert(
      Array.isArray(c.leverIds) &&
        new Set(c.leverIds).size === c.leverIds.length &&
        c.leverIds.every((id) => levers.some((l) => l.id === id)),
    );
    if (c.status === "active")
      assert(!!c.ownerRoleId, "گلوگاه فعال به نقش مسئول نیاز دارد.");
  }
  assert(value.primaryConstraintId === null || str(value.primaryConstraintId));
  for (const i of rows(value.ideas)) {
    texts(i, [
      "title",
      "description",
      "constraintId",
      "leverId",
      "ownerRoleId",
      "rationale",
      "intervention",
      "estimatedCost",
      "evidence",
      "successMetric",
    ]);
    assert(
      !!(i.title as string).trim() &&
        member(i.source, M.ideaSources) &&
        member(i.status, M.ideaStatuses) &&
        date(i.createdAt) &&
        date(i.updatedAt),
    );
    assert(
      i.expectedImpact === "unknown" || member(i.expectedImpact, M.levels),
    );
    assert(i.confidence === null || member(i.confidence, M.levels));
    assert(i.effort === null || member(i.effort, M.levels));
    assert(!i.constraintId || constraints.some((c) => c.id === i.constraintId));
    assert(!i.leverId || levers.some((l) => l.id === i.leverId));
    assert(
      Array.isArray(i.history) &&
        i.history.every(
          (h) =>
            obj(h) && date(h.at) && str(h.from) && member(h.to, M.ideaStatuses),
        ),
    );
    if (i.status === "experiment")
      assert(
        experimentData(value as unknown as M.ScaleStore).experiments.some(
          (e) => e.ideaId === i.id && !!e.startedAt,
        ),
        "مرحله آزمایش به اجرای مرتبط نیاز دارد.",
      );
    if (i.status === "validated")
      assert(
        experimentData(value as unknown as M.ScaleStore).ideaReviews.some(
          (r) => r.ideaId === i.id && r.status === "validated",
        ),
        "تأیید ایده به تصمیم مستند نیاز دارد.",
      );
  }
  const s = value as unknown as M.ScaleStore;
  validateExperiments(s);
  validateFunnel(s);
  validateNetwork(s);
  validateReadiness(s);
  assert(
    primaryConstraintValidation(s),
    "گلوگاه اصلی باید یک گلوگاه فعال باشد.",
  );
  return s;
}
export function parseScale(raw: string) {
  return validateScale(JSON.parse(raw));
}
export function saveConstraint(
  s: M.ScaleStore,
  c: M.GrowthConstraint,
  primary = false,
) {
  const next = {
    ...s,
    constraints: [
      ...s.constraints.filter((x) => x.id !== c.id),
      {
        ...c,
        updatedAt: M.now(),
        resolvedAt:
          c.status === "resolved" ? (c.resolvedAt ?? M.now()) : undefined,
      },
    ],
    primaryConstraintId: primary
      ? c.id
      : s.primaryConstraintId === c.id && c.status !== "active"
        ? null
        : s.primaryConstraintId,
  };
  return validateScale(next);
}
export function saveIdea(s: M.ScaleStore, i: M.GrowthIdea) {
  const old = s.ideas.find((x) => x.id === i.id);
  if (["experiment", "validated"].includes(i.status))
    assert(
      old?.status === i.status,
      "تغییر این مرحله فقط از مسیر تصمیم آزمایش مجاز است.",
    );
  if (["prioritized", "ready"].includes(i.status)) {
    const r = ideaReadiness(i, s);
    assert(r.ready, `برای این مرحله تکمیل کنید: ${r.missing.join("، ")}`);
  }
  const at = M.now();
  const next = {
    ...i,
    updatedAt: at,
    createdAt: old?.createdAt ?? i.createdAt,
    history: old?.history ?? [],
  };
  if (!old || old.status !== i.status)
    next.history = [
      ...next.history,
      { at, from: old?.status ?? "", to: i.status },
    ];
  return validateScale({
    ...s,
    ideas: [...s.ideas.filter((x) => x.id !== i.id), next],
  });
}
export function persistScale(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
  s: M.ScaleStore,
  expected: string | null,
) {
  if (expected !== null) {
    const before = parseScale(expected);
    assertExperimentTransition(before, s);
    assertFunnelTransition(before, s);
    assertNetworkTransition(before, s);
    assertReadinessTransition(before, s);
  }
  const raw = JSON.stringify(validateScale(s));
  writeTogether(storage, [{ key: M.SCALE_KEY, expected, value: raw }]);
  return raw;
}
