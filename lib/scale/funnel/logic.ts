import {
  FunnelData,
  FunnelStage,
  FunnelPeriod,
  GrowthRevenueModel,
  periodStages,
  completedPeriods,
} from "./model";
import { tehranDay } from "../experiments/logic";
const finite = (n: number | null | undefined): n is number =>
  typeof n === "number" && Number.isFinite(n) && n >= 0;
const safe = (n: number) => (Number.isFinite(n) ? n : null);
export const calculateConversion = (
  current: number | null,
  previous: number | null,
) =>
  finite(current) && finite(previous) && previous > 0
    ? safe((current / previous) * 100)
    : null;
export function calculateDropoff(
  previous: number | null,
  current: number | null,
) {
  return {
    volume:
      finite(previous) && finite(current) ? safe(previous - current) : null,
    percent:
      finite(previous) && finite(current) && previous > 0
        ? safe(((previous - current) / previous) * 100)
        : null,
  };
}
export const calculateConversionGap = (
  actual: number | null,
  target: number | null,
) => (finite(actual) && finite(target) ? safe(actual - target) : null);
export function funnelFreshness(
  p: FunnelPeriod | undefined,
  days: number,
  today = tehranDay(),
) {
  const age = p
    ? Math.floor((Date.parse(today) - Date.parse(p.periodEnd)) / 86400000)
    : null;
  return {
    age,
    stale: age === null || !Number.isFinite(age) || age < 0 || age > days,
  };
}
export function calculateStageHealth(
  actual: number | null,
  target: number | null,
  previous: number | null,
  owner: boolean,
  stale: boolean,
) {
  if (actual === null || !Number.isFinite(actual) || actual < 0 || actual > 100)
    return { status: "unknown", score: null, reason: "داده تبدیل کافی نیست" };
  if (target === null && previous === null)
    return {
      status: "unknown",
      score: null,
      reason: "هدف و سابقه مقایسه نداریم",
    };
  const ratio =
    target !== null && target > 0
      ? actual / target
      : previous !== null && previous > 0
        ? actual / previous
        : null;
  if (ratio === null)
    return { status: "unknown", score: null, reason: "مبنای مقایسه مثبت نیست" };
  return {
    status:
      ratio < 0.8 ? "risk" : ratio < 1 || !owner || stale ? "watch" : "healthy",
    score: Math.min(100, Math.max(0, ratio * 100)),
    reason:
      ratio < 1
        ? "پایین‌تر از مبنای داخلی"
        : stale
          ? "داده قدیمی"
          : !owner
            ? "مالک این مرحله مشخص نیست."
            : "در سطح مبنای داخلی",
  };
}
export function calculateFunnelHealth(parts: {
  conversion: number | null;
  trend: number | null;
  targets: number | null;
  freshness: number | null;
  owners: number | null;
}) {
  const weights = {
    conversion: 0.5,
    trend: 0.2,
    targets: 0.1,
    freshness: 0.1,
    owners: 0.1,
  };
  let sum = 0,
    coverage = 0;
  for (const k of Object.keys(weights) as (keyof typeof weights)[]) {
    if (parts[k] !== null) {
      sum += parts[k]! * weights[k];
      coverage += weights[k];
    }
  }
  return {
    score: parts.conversion === null ? null : Math.round(sum / coverage),
    coverage: Math.round(coverage * 100),
  };
}
export function calculateEstimatedRevenue(
  volume: number | null,
  deal: number | null,
) {
  return finite(volume) && finite(deal) ? safe(volume * deal) : null;
}
export const calculateRevenueGap = (
  current: number | null,
  target: number | null,
) => (finite(current) && finite(target) ? safe(target - current) : null);
export function backsolveRequiredVolumes(
  stages: FunnelStage[],
  revenueStageId: string,
  target: number | null,
  deal: number | null,
  rates: Record<string, number | null>,
) {
  const ceilVolume = (value: number) => {
    const nearest = Math.round(value);
    return nearest > 0 &&
      Math.abs(value - nearest) <=
        Number.EPSILON * Math.max(1, Math.abs(value)) * 8
      ? nearest
      : Math.ceil(value);
  };
  const result: Record<string, number | null> = {};
  const end = stages.findIndex((s) => s.id === revenueStageId);
  if (end < 0) return result;
  let need =
    finite(target) && finite(deal) && deal > 0
      ? safe(ceilVolume(target / deal))
      : null;
  for (let i = end; i >= 0; i--) {
    result[stages[i].id] = need;
    if (i > 0) {
      const rate = rates[stages[i].id];
      need =
        need !== null && finite(rate) && rate > 0 && rate <= 100
          ? safe(ceilVolume(need / (rate / 100)))
          : null;
    }
  }
  return result;
}
export function calculateScenario(
  stages: FunnelStage[],
  revenueStageId: string,
  top: number | null,
  rates: Record<string, number | null>,
  deal: number | null,
  repeat: number | null = 0,
) {
  const end = stages.findIndex((s) => s.id === revenueStageId);
  let output = finite(top) ? top : null;
  if (end < 0) return { output: null, revenue: null };
  for (let i = 1; i <= end; i++) {
    const r = rates[stages[i].id];
    if (!finite(r) || r > 100)
      throw Error("نرخ سناریو باید بین صفر و صد باشد.");
    output = output === null ? null : safe((output * r) / 100);
  }
  if (repeat !== null && (!finite(repeat) || repeat > 100))
    throw Error("نرخ تکرار معتبر نیست.");
  const base = calculateEstimatedRevenue(output, deal);
  return {
    output,
    revenue: base === null ? null : safe(base * (1 + (repeat ?? 0) / 100)),
  };
}
export function strategyRevenueTarget(
  model: GrowthRevenueModel,
  krs: { id: string; targetValue: number | null; unit?: string }[],
) {
  if (!model.strategyKRId) return model.targetRevenue;
  const kr = krs.find((k) => k.id === model.strategyKRId);
  if (
    !kr ||
    (kr.unit !== undefined &&
      kr.unit.trim().toLowerCase() !== model.currency.trim().toLowerCase())
  )
    return null;
  return kr.targetValue;
}
export function stageRows(
  d: FunnelData,
  p: FunnelPeriod,
  prior?: FunnelPeriod,
  owners?: string[],
  today = tehranDay(),
) {
  const stages = periodStages(d, p),
    old = prior ? periodStages(d, prior) : [];
  const volume = (period: FunnelPeriod | undefined, id: string) =>
    d.measurements.find((m) => m.periodId === period?.id && m.stageId === id)
      ?.volume ?? null;
  return stages.map((s, i) => {
    const v = volume(p, s.id),
      prev = i ? volume(p, stages[i - 1].id) : null;
    const oi = old.findIndex((x) => x.id === s.id),
      comparable =
        oi >= 0 &&
        (i === 0 ? oi === 0 : oi > 0 && old[oi - 1].id === stages[i - 1].id) &&
        old[oi]?.metricUnit === s.metricUnit;
    const ov = comparable ? volume(prior, s.id) : null,
      oc =
        comparable && oi > 0
          ? calculateConversion(ov, volume(prior, old[oi - 1].id))
          : null;
    const conversion = i ? calculateConversion(v, prev) : null;
    return {
      stage: s,
      volume: v,
      previousVolume: ov,
      volumeDelta: v !== null && ov !== null ? v - ov : null,
      conversion,
      previousConversion: oc,
      trend: conversion !== null && oc !== null ? conversion - oc : null,
      gap: calculateConversionGap(conversion, s.targetConversion),
      dropoff: i ? calculateDropoff(prev, v) : { volume: null, percent: null },
      health: calculateStageHealth(
        conversion,
        s.targetConversion,
        oc,
        !!s.ownerRoleId && (!owners || owners.includes(s.ownerRoleId)),
        funnelFreshness(p, d.staleDays, today).stale,
      ),
    };
  });
}
export type StageRow = ReturnType<typeof stageRows>[number];
export function calculateFunnelConstraintSignal(
  rows: StageRow[],
  revenueStageId: string,
  deal: number | null,
) {
  const end = rows.findIndex((r) => r.stage.id === revenueStageId);
  const maxDrop = Math.max(
    1,
    ...rows.map((r) => Math.max(0, r.dropoff.volume ?? 0)),
  );
  return rows
    .slice(1)
    .map((r, i) => {
      let downstream: number | null = end >= i + 1 ? 1 : null;
      for (let j = i + 2; j <= end; j++) {
        const c = rows[j].conversion;
        if (c === null || c > 100) {
          downstream = null;
          break;
        }
        if (downstream !== null) downstream *= c / 100;
      }
      const previous = rows[i].volume;
      const recover =
        previous !== null && r.gap !== null
          ? (Math.max(0, -r.gap) * previous) / 100
          : null;
      const impact =
        recover !== null && downstream !== null && deal !== null
          ? safe(recover * downstream * deal)
          : null;
      const gap =
        r.gap !== null &&
        r.stage.targetConversion !== null &&
        r.stage.targetConversion > 0
          ? Math.min(1, Math.max(0, -r.gap) / r.stage.targetConversion)
          : null;
      const drop =
        r.dropoff.volume === null
          ? null
          : Math.max(0, r.dropoff.volume) / maxDrop;
      const trend =
        r.trend === null ? null : Math.min(1, Math.max(0, -r.trend) / 20);
      return { row: r, gap, drop, trend, impact };
    })
    .map((x, _, all) => {
      const maxImpact = Math.max(1, ...all.map((a) => a.impact ?? 0));
      const factors: [
        [number | null, number],
        [number | null, number],
        [number | null, number],
        [number | null, number],
      ] = [
        [x.gap, 0.35],
        [x.drop, 0.3],
        [x.impact === null ? null : x.impact / maxImpact, 0.2],
        [x.trend, 0.15],
      ];
      const available = factors.filter(([v]) => v !== null);
      const score =
        x.row.conversion === null || x.row.conversion > 100
          ? null
          : Math.round(
              (100 * available.reduce((s, [v, w]) => s + v! * w, 0)) /
                available.reduce((s, [, w]) => s + w, 0),
            );
      return {
        ...x,
        score,
        category:
          score === null
            ? "unknown"
            : score >= 75
              ? "critical"
              : score >= 50
                ? "high"
                : score >= 25
                  ? "medium"
                  : "low",
      };
    })
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
}
export function funnelCompleteness(
  stages: FunnelStage[],
  rows: StageRow[],
  revenue: GrowthRevenueModel | null,
  owners?: string[],
) {
  return {
    definitions: stages.length >= 2,
    owners:
      stages.length > 0 &&
      stages.every(
        (s) => !!s.ownerRoleId && (!owners || owners.includes(s.ownerRoleId)),
      ),
    period: rows.length > 0 && rows.every((r) => r.volume !== null),
    targets:
      stages.length >= 2 &&
      stages.slice(1).every((s) => s.targetConversion !== null),
    revenue:
      !!revenue?.revenueStageId &&
      revenue.averageDealValue !== null &&
      revenue.averageDealValue > 0,
  };
}
export function funnelNeedsAttention(
  d: FunnelData,
  id: string,
  primaryLinked: boolean,
  experimentMissing: boolean,
  owners?: string[],
) {
  const ps = completedPeriods(d, id),
    p = ps.at(-1),
    rs = p ? stageRows(d, p, ps.at(-2), owners) : [],
    rev = d.revenueModels.find((r) => r.funnelId === id),
    messages: string[] = [];
  if (!p) messages.push("داده تکمیل‌شده قیف ثبت نشده است.");
  if (
    d.stages.some(
      (s) =>
        s.funnelId === id &&
        s.active &&
        (!s.ownerRoleId || (owners && !owners.includes(s.ownerRoleId))),
    )
  )
    messages.push("مالک این مرحله مشخص نیست.");
  if (rs.some((r) => r.gap !== null && r.gap < -10))
    messages.push("شکاف تبدیل بیش از ۱۰ واحد درصد وجود دارد.");
  if (rs.some((r) => r.trend !== null && r.trend < -5))
    messages.push("تبدیل نسبت به دوره قبل افت کرده است.");
  if (!primaryLinked) messages.push("گلوگاه اصلی شواهد مرتبط قیف ندارد.");
  if (experimentMissing)
    messages.push("آزمایش فعال به مرحله قابل‌اندازه‌گیری متصل نیست.");
  if (
    rev &&
    (rev.targetRevenue !== null || rev.strategyKRId) &&
    !rev.averageDealValue
  )
    messages.push("برای مدل‌سازی هدف درآمد، میانگین قرارداد لازم است.");
  if (funnelFreshness(p, d.staleDays).stale)
    messages.push("داده قیف قدیمی یا ناموجود است.");
  return messages;
}
export function healthSummary(
  rows: StageRow[],
  period: FunnelPeriod | undefined,
  staleDays: number,
  owners: string[],
  today = tehranDay(),
) {
  const valid = rows
      .slice(1)
      .map((r) => r.health.score)
      .filter((x): x is number => x !== null),
    trends = rows.filter((r) => r.trend !== null);
  return calculateFunnelHealth({
    conversion: valid.length
      ? valid.reduce((a, b) => a + b, 0) / valid.length
      : null,
    trend: trends.length
      ? (trends.filter((r) => r.trend! >= 0).length / trends.length) * 100
      : null,
    targets:
      rows.length > 1
        ? (rows.slice(1).filter((r) => r.stage.targetConversion !== null)
            .length /
            (rows.length - 1)) *
          100
        : null,
    freshness: period
      ? funnelFreshness(period, staleDays, today).stale
        ? 0
        : 100
      : null,
    owners: rows.length
      ? (rows.filter((r) => owners.includes(r.stage.ownerRoleId)).length /
          rows.length) *
        100
      : null,
  });
}
export function currentRates(stages: FunnelStage[], rows: StageRow[]) {
  return Object.fromEntries(
    stages.map((s, i) => {
      const j = rows.findIndex((r) => r.stage.id === s.id),
        same =
          i > 0 &&
          j > 0 &&
          stages[i - 1].id === rows[j - 1].stage.id &&
          s.metricUnit === rows[j].stage.metricUnit;
      return [s.id, same ? rows[j].conversion : null];
    }),
  );
}
export function revenueHistory(d: FunnelData, p: FunnelPeriod) {
  const rev = p.snapshot?.revenue;
  const volume = rev
    ? (d.measurements.find(
        (m) => m.periodId === p.id && m.stageId === rev.revenueStageId,
      )?.volume ?? null)
    : null;
  return {
    estimated: rev
      ? calculateEstimatedRevenue(volume, rev.averageDealValue)
      : null,
    actual: rev?.currentRevenue ?? null,
    currency: rev?.currency ?? "",
    target: rev?.targetRevenue ?? null,
  };
}
