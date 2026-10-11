import { ScaleStore, newConstraint } from "../model";
import * as F from "./model";
import { stageRows } from "./logic";
import { tehranDay } from "../experiments/logic";
import { validateFunnel, assertFunnelTransition } from "./validation";
const clone = (s: ScaleStore) => ({
  ...s,
  funnelData: structuredClone(F.funnelData(s)),
});
function checked(before: ScaleStore, next: ScaleStore) {
  validateFunnel(next);
  assertFunnelTransition(before, next);
  return next;
}
export function createFunnel(s: ScaleStore, name: string, template: string) {
  const t = F.templates[template];
  if (!t) throw Error("الگو معتبر نیست");
  const n = clone(s),
    at = F.timestamp(),
    id = F.uid();
  n.funnelData.funnels.forEach((f) => (f.active = false));
  n.funnelData.funnels.push({
    id,
    name,
    businessModel: t.model,
    description: "",
    active: true,
    currency: "تومان",
    createdAt: at,
    updatedAt: at,
  });
  t.stages.forEach(([name, type], i) =>
    n.funnelData.stages.push({ ...F.newStage(id, i), name, type }),
  );
  return checked(s, n);
}
export function saveStructure(
  s: ScaleStore,
  f: F.GrowthFunnel,
  stages: F.FunnelStage[],
) {
  const n = clone(s);
  if (f.active) n.funnelData.funnels.forEach((x) => (x.active = false));
  n.funnelData.funnels = n.funnelData.funnels.map((x) =>
    x.id === f.id ? { ...f, updatedAt: F.timestamp() } : x,
  );
  const old = n.funnelData.stages.filter((x) => x.funnelId === f.id);
  const retired = old
    .filter((x) => !stages.some((y) => y.id === x.id))
    .map((x) => ({ ...x, active: false }));
  n.funnelData.stages = [
    ...n.funnelData.stages.filter((x) => x.funnelId !== f.id),
    ...retired,
    ...stages.map((x, i) => ({
      ...x,
      funnelId: f.id,
      order: i,
      updatedAt: F.timestamp(),
    })),
  ];
  return checked(s, n);
}
export function saveRevenue(s: ScaleStore, r: F.GrowthRevenueModel) {
  const n = clone(s);
  n.funnelData.revenueModels = [
    ...n.funnelData.revenueModels.filter((x) => x.funnelId !== r.funnelId),
    { ...r, updatedAt: F.timestamp() },
  ];
  return checked(s, n);
}
export function savePeriod(
  s: ScaleStore,
  p: F.FunnelPeriod,
  measurements: F.FunnelStageMeasurement[],
) {
  const n = clone(s);
  if (n.funnelData.periods.find((x) => x.id === p.id)?.status === "completed")
    throw Error("دوره تکمیل‌شده قابل ویرایش نیست.");
  n.funnelData.periods = [
    ...n.funnelData.periods.filter((x) => x.id !== p.id),
    { ...p, updatedAt: F.timestamp() },
  ];
  n.funnelData.measurements = [
    ...n.funnelData.measurements.filter((x) => x.periodId !== p.id),
    ...measurements,
  ];
  return checked(s, n);
}
export function completePeriod(
  s: ScaleStore,
  id: string,
  target?: number | null,
) {
  const n = clone(s),
    p = n.funnelData.periods.find((x) => x.id === id);
  if (!p || p.status !== "draft") throw Error("پیش‌نویس دوره لازم است.");
  if (p.periodEnd > tehranDay()) throw Error("دوره آینده قابل تکمیل نیست.");
  const f = n.funnelData.funnels.find((x) => x.id === p.funnelId)!;
  const rev = n.funnelData.revenueModels.find((r) => r.funnelId === f.id);
  p.snapshot = {
    funnel: structuredClone(f),
    stages: structuredClone(F.periodStages(n.funnelData, p)),
    revenue: rev
      ? {
          ...rev,
          targetRevenue: rev.strategyKRId
            ? (target ?? null)
            : rev.targetRevenue,
        }
      : null,
  };
  p.status = "completed";
  p.completedAt = F.timestamp();
  p.updatedAt = p.completedAt;
  return checked(s, n);
}
export function linkFunnel(
  s: ScaleStore,
  kind: F.FunnelLink["kind"],
  entityId: string,
  stageId: string,
) {
  const n = clone(s);
  if (kind === "experiment") {
    const e = s.experimentData?.experiments.find((e) => e.id === entityId);
    if (e?.startedAt || e?.status === "cancelled")
      throw Error("پیوند آزمایش شروع‌شده ثابت است؛ نسخه جدید بسازید.");
  }
  n.funnelData.links = n.funnelData.links.filter(
    (l) => l.kind !== kind || l.entityId !== entityId,
  );
  if (stageId) {
    const st = n.funnelData.stages.find((st) => st.id === stageId && st.active);
    if (!st) throw Error("مرحله فعال لازم است");
    n.funnelData.links.push({
      id: F.uid(),
      kind,
      entityId,
      stageId,
      funnelId: st.funnelId,
      createdAt: F.timestamp(),
    });
  }
  return checked(s, n);
}
export function addFunnelEvidence(
  s: ScaleStore,
  periodId: string,
  stageId: string,
  constraintId: string,
) {
  const n = clone(s),
    p = n.funnelData.periods.find(
      (p) => p.id === periodId && p.status === "completed",
    );
  if (!p) throw Error("دوره تکمیل‌شده لازم است.");
  const rs = stageRows(n.funnelData, p),
    i = rs.findIndex((r) => r.stage.id === stageId);
  if (i < 1) throw Error("گذار معتبر لازم است.");
  const r = rs[i];
  if (!constraintId) {
    const c = newConstraint();
    c.title = `تبدیل ${rs[i - 1].stage.name} به ${r.stage.name}`;
    c.dimension = "sales";
    c.description = "کاندید بر اساس شواهد قیف؛ نیازمند بررسی مدیریت";
    n.constraints = [...s.constraints, c];
    constraintId = c.id;
  }
  n.funnelData.evidence.push({
    id: F.uid(),
    constraintId,
    periodId,
    stageId,
    stageName: r.stage.name,
    previousStageName: rs[i - 1].stage.name,
    actual: r.conversion,
    target: r.stage.targetConversion,
    gap: r.gap,
    createdAt: F.timestamp(),
  });
  n.funnelData.links = n.funnelData.links.filter(
    (l) => l.kind !== "constraint" || l.entityId !== constraintId,
  );
  n.funnelData.links.push({
    id: F.uid(),
    kind: "constraint",
    entityId: constraintId,
    stageId,
    funnelId: p.funnelId,
    createdAt: F.timestamp(),
  });
  return checked(s, n);
}
export function consultingSample(s: ScaleStore) {
  let n = createFunnel(s, "نمونه آموزشی مشاوره (فرضی)", "consulting");
  let d = F.funnelData(n),
    f = d.funnels.at(-1)!;
  n = saveStructure(
    n,
    f,
    d.stages
      .filter((st) => st.funnelId === f.id)
      .map((st, i) => ({
        ...st,
        targetConversion: [null, 40, 50, 50, 40, 40][i],
      })),
  );
  d = F.funnelData(n);
  const stages = d.stages.filter((st) => st.funnelId === f.id);
  n = saveRevenue(n, {
    ...F.blankRevenue(f.id),
    revenueStageId: stages[4].id,
    averageDealValue: 100000000,
    targetRevenue: 1500000000,
  });
  const at = F.timestamp(),
    today = new Date(),
    end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0)),
    start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  const p: F.FunnelPeriod = {
    id: F.uid(),
    funnelId: f.id,
    periodStart: start.toISOString().slice(0, 10),
    periodEnd: end.toISOString().slice(0, 10),
    label: "نمونه آموزشی؛ داده فرضی",
    cadence: "monthly",
    status: "draft",
    createdAt: at,
    updatedAt: at,
  };
  return savePeriod(
    n,
    p,
    stages.map((st, i) => ({
      id: F.uid(),
      periodId: p.id,
      funnelId: f.id,
      stageId: st.id,
      volume: [300, 120, 60, 30, 8, 3][i],
      revenueValue: null,
      note: "داده فرضی آموزشی؛ عملکرد واقعی شرکت نیست.",
      source: "نمونه Build 5C",
      createdAt: at,
      updatedAt: at,
    })),
  );
}
