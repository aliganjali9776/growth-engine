import type { ScaleStore } from "../model";
import { experimentData } from "../experiments/model";
import * as N from "./model";
const ratio = (
  a: number | null | undefined,
  b: number | null | undefined,
  factor = 1,
) =>
  a != null && b != null && b > 0 && Number.isFinite((a / b) * factor)
    ? (a / b) * factor
    : null;
export function channelPerformance(p: N.ChannelPeriodMeasurement | undefined) {
  return {
    qualification: ratio(p?.qualifiedLeads, p?.leads, 100),
    conversion: ratio(p?.customers, p?.leads, 100),
    qualifiedConversion: ratio(p?.customers, p?.qualifiedLeads, 100),
    repeat: ratio(p?.repeatCustomers, p?.customers, 100),
    cpl: ratio(p?.spend, p?.leads),
    cpql: ratio(p?.spend, p?.qualifiedLeads),
    spendPerCustomer: ratio(p?.spend, p?.customers),
    revenuePerSpend: ratio(p?.revenue, p?.spend),
    customersPerSpend: ratio(p?.customers, p?.spend),
    qualifiedPerSpend: ratio(p?.qualifiedLeads, p?.spend),
  };
}
export function channelTrend(
  current: N.ChannelPeriodMeasurement | undefined,
  previous: N.ChannelPeriodMeasurement | undefined,
) {
  const keys = [
    "leads",
    "qualifiedLeads",
    "customers",
    "revenue",
    "spend",
  ] as const;
  const compatible =
    !!current &&
    !!previous &&
    current.attribution === previous.attribution &&
    current.cadence === previous.cadence &&
    current.periodStart > previous.periodEnd;
  return {
    ...Object.fromEntries(
      keys.map((k) => [
        k,
        compatible &&
        current[k] !== null &&
        previous[k] !== null &&
        (!["spend", "revenue"].includes(k) ||
          current.currency === previous.currency)
          ? current[k]! - previous[k]!
          : null,
      ]),
    ),
    conversion:
      compatible &&
      channelPerformance(current).conversion !== null &&
      channelPerformance(previous).conversion !== null
        ? channelPerformance(current).conversion! -
          channelPerformance(previous).conversion!
        : null,
  } as Record<(typeof keys)[number] | "conversion", number | null>;
}
export function channelQuality(
  p: N.ChannelPeriodMeasurement | undefined,
  previous?: N.ChannelPeriodMeasurement,
) {
  const m = channelPerformance(p),
    t = channelTrend(p, previous);
  if (!p || p.qualifiedLeads === null || p.customers === null)
    return {
      state: "insufficient",
      reason: "لید واجد شرایط و مشتری باید معلوم باشند.",
    };
  if (p.qualifiedLeads > 0 && p.customers === 0)
    return {
      state: "weak",
      reason: "تقاضای واجد شرایط بدون مشتری ثبت شده است.",
    };
  if (
    (t.qualifiedLeads !== null && t.qualifiedLeads < 0) ||
    (t.conversion !== null && t.conversion < 0)
  )
    return {
      state: "watch",
      reason: "افت نسبت به سابقه داخلی؛ علت را بررسی کنید.",
    };
  if (
    p.qualifiedLeads > 0 &&
    p.customers > 0 &&
    p.revenue !== null &&
    p.revenue > 0 &&
    m.repeat !== null &&
    m.repeat > 0 &&
    previous &&
    previous.customers !== null &&
    previous.customers > 0
  )
    return {
      state: "strong",
      reason: "تقاضا، تبدیل، درآمد و تکرار با سابقه مثبت ثبت شده‌اند.",
    };
  return p.customers > 0
    ? {
        state: "promising",
        reason: "مشتری ایجاد شده؛ شواهد بیشتر برای تکرارپذیری لازم است.",
      }
    : { state: "watch", reason: "خروجی مثبت کافی ثبت نشده است." };
}
export function channelMaturityEvidence(s: ScaleStore, cid: string) {
  const d = N.networkData(s),
    ps = N.channelPeriods(d, cid).filter((p) => p.attribution === "primary"),
    exp = experimentData(s).experiments.filter(
      (e) =>
        e.status === "completed" &&
        d.links.some(
          (l) =>
            l.kind === "experiment" &&
            l.entityId === e.id &&
            l.channelId === cid,
        ),
    ),
    positive = ps
      .filter(
        (p) =>
          p.customers !== null &&
          p.customers > 0 &&
          p.cadence === ps.at(-1)?.cadence,
      )
      .reduce<N.ChannelPeriodMeasurement[]>((out, p) => {
        if (!out.length || p.periodStart > out.at(-1)!.periodEnd) out.push(p);
        return out;
      }, []),
    wins = exp.filter(
      (e) => e.resultStatus === "win" || e.resultStatus === "partial",
    );
  return {
    periods: ps.length,
    positivePeriods: positive.length,
    experiments: exp.length,
    positiveExperiments: wins.length,
    suggested:
      positive.length >= 3
        ? "repeatable"
        : positive.length || wins.length
          ? "early"
          : "unproven",
    reason:
      "بلوغ یک تصمیم توصیفی مدیریت است؛ درآمد یا یک Win به‌تنهایی مقیاس‌پذیری را اثبات نمی‌کند.",
  };
}
export function channelConcentration(periods: N.ChannelPeriodMeasurement[]) {
  const primary = periods.filter((p) => p.attribution === "primary"),
    dates = new Set(primary.map((p) => p.periodStart + "|" + p.periodEnd)),
    known = primary.filter((p) => p.qualifiedLeads !== null),
    total = known.reduce((sum, p) => sum + p.qualifiedLeads!, 0);
  if (
    dates.size !== 1 ||
    !known.length ||
    total <= 0 ||
    !Number.isFinite(total)
  )
    return {
      top: null,
      top2: null,
      channelId: null,
      coverage: known.length,
      total: primary.length,
      partial: true,
    };
  const ranked = [...known].sort(
    (a, b) => b.qualifiedLeads! - a.qualifiedLeads!,
  );
  return {
    top: (ranked[0].qualifiedLeads! / total) * 100,
    top2:
      (ranked.slice(0, 2).reduce((v, p) => v + p.qualifiedLeads!, 0) / total) *
      100,
    channelId: ranked[0].channelId,
    coverage: known.length,
    total: primary.length,
    partial: known.length !== primary.length,
  };
}
export function channelResilience(
  d: N.NetworkData,
  ps: N.ChannelPeriodMeasurement[],
) {
  const c = channelConcentration(ps),
    meaningful = ps.filter(
      (p) => p.attribution === "primary" && (p.qualifiedLeads ?? 0) > 0,
    ),
    owners = new Set(
      meaningful.map((p) => p.snapshot?.ownerRoleId).filter(Boolean),
    ),
    repeatable = meaningful.filter(
      (p) =>
        N.channelPeriods(d, p.channelId)
          .filter(
            (x) =>
              x.attribution === "primary" &&
              x.cadence === p.cadence &&
              x.periodEnd <= p.periodEnd &&
              (x.customers ?? 0) > 0,
          )
          .reduce<N.ChannelPeriodMeasurement[]>((out, x) => {
            if (!out.length || x.periodStart > out.at(-1)!.periodEnd)
              out.push(x);
            return out;
          }, []).length >= 3,
    ).length,
    paid = meaningful.filter((p) => p.snapshot?.category === "paid").length;
  if (c.top === null || c.partial)
    return {
      state: "unknown",
      reason: "داده هم‌دوره کافی برای قضاوت تاب‌آوری نیست.",
    };
  if (c.top >= 70 || meaningful.length < 2 || paid === meaningful.length)
    return {
      state: "fragile",
      reason: "تمرکز یا اتکای محدود؛ ضعف عملکرد قطعی نیست.",
    };
  if (
    meaningful.length >= 3 &&
    c.top < 50 &&
    repeatable >= 3 &&
    owners.size >= 2
  )
    return {
      state: "strong",
      reason:
        "چند مسیر با سابقه تکرار و مالکیت توزیع‌شده؛ همچنان نیازمند پایش.",
    };
  return {
    state: meaningful.length >= 3 && c.top < 60 ? "balanced" : "developing",
    reason: "برآورد محتاطانه از تنوع، سابقه و مالکیت کانال‌ها.",
  };
}
export function channelScaleReadiness(
  s: ScaleStore,
  cid: string,
  capacity: boolean | null,
) {
  const d = N.networkData(s),
    c = d.channels.find((c) => c.id === cid),
    ps = N.channelPeriods(d, cid),
    p = ps.at(-1),
    e = channelMaturityEvidence(s, cid),
    m = channelPerformance(p);
  const parts = {
    evidence: e.experiments || ps.length ? true : null,
    repeatability: ps.length >= 2 ? e.positivePeriods >= 2 : null,
    economics: m.revenuePerSpend === null ? null : m.revenuePerSpend >= 1,
    funnel:
      c?.funnelStageId && p?.contributedVolume != null
        ? p.contributedVolume > 0
        : null,
    capacity,
  };
  const weights = {
    evidence: 25,
    repeatability: 25,
    economics: 20,
    funnel: 15,
    capacity: 15,
  };
  let known = 0,
    earned = 0;
  for (const k of Object.keys(parts) as (keyof typeof parts)[]) {
    if (parts[k] !== null) {
      known += weights[k];
      if (parts[k]) earned += weights[k];
    }
  }
  return {
    parts,
    coverage: known,
    score: known ? Math.round((earned / known) * 100) : null,
  };
}
export function channelNeedsAttention(
  s: ScaleStore,
  c: N.GrowthChannel,
  ownerIds: string[],
) {
  const d = N.networkData(s),
    ps = N.channelPeriods(d, c.id),
    p = ps.at(-1),
    t = channelTrend(p, ps.at(-2)),
    e = channelMaturityEvidence(s, c.id),
    out: string[] = [];
  if (!ownerIds.includes(c.ownerRoleId)) out.push("کانال بدون مالک معتبر است.");
  if (
    ["active", "scaling"].includes(c.status) &&
    (!p ||
      Date.parse(N.day()) - Date.parse(p.periodEnd) > d.staleDays * 86400000)
  )
    out.push("کانال فعال شواهد دوره‌ای تازه ندارد.");
  if (c.status === "scaling" && e.positivePeriods < 2)
    out.push("کانال در حال توسعه، شواهد تکرار کافی ندارد.");
  if (p?.spend != null && p.spend > 0 && p.qualifiedLeads === 0)
    out.push("هزینه جذب ثبت شده اما تقاضای واجد شرایط صفر است.");
  if (
    p &&
    p.spend !== null &&
    ps.at(-2)?.spend != null &&
    p.spend > ps.at(-2)!.spend! &&
    t.qualifiedLeads !== null &&
    t.qualifiedLeads <= 0
  )
    out.push("هزینه افزایش یافته اما تقاضای واجد شرایط رشد نکرده است.");
  if (t.conversion !== null && t.conversion < 0)
    out.push("نرخ تبدیل نسبت به دوره قبل افت کرده است.");
  return out;
}
export function loopReadiness(
  s: ScaleStore,
  l: N.GrowthLoop,
  ownerIds?: string[],
) {
  const d = N.networkData(s),
    nodes = d.nodes.filter((n) => n.loopId === l.id && n.active),
    parts = {
      structure: nodes.length >= 2,
      owner: !!l.ownerRoleId && (!ownerIds || ownerIds.includes(l.ownerRoleId)),
      metric: experimentData(s).metrics.some(
        (m) => m.id === l.primaryOutputMetricId,
      ),
      evidence:
        d.evidence.some((e) => e.loopId === l.id) ||
        N.loopPeriods(d, l.id).some((p) => p.outputMetric !== null),
      reentry: !!l.reentry.trim(),
    };
  return { parts, ready: Object.values(parts).every(Boolean) };
}
export function loopTrend(d: N.NetworkData, lid: string) {
  const ps = N.loopPeriods(d, lid),
    p = ps.at(-1),
    prev = ps.at(-2),
    same =
      p &&
      prev &&
      p.periodStart > prev.periodEnd &&
      p.snapshot?.metricName === prev.snapshot?.metricName &&
      p.snapshot?.metricUnit === prev.snapshot?.metricUnit &&
      JSON.stringify(
        p.snapshot?.nodes.map((n) => [n.id, n.name, n.metricId]),
      ) ===
        JSON.stringify(
          prev.snapshot?.nodes.map((n) => [n.id, n.name, n.metricId]),
        ) &&
      p.snapshot?.loop.primaryOutputMetricId ===
        prev.snapshot?.loop.primaryOutputMetricId;
  return {
    current: p?.outputMetric ?? null,
    previous: same ? prev.outputMetric : null,
    delta:
      same && p.outputMetric !== null && prev.outputMetric !== null
        ? p.outputMetric - prev.outputMetric
        : null,
    rate: ratio(p?.outputMetric, p?.inputVolume, 100),
    cycleTime: p?.cycleTime ?? null,
  };
}
export function loopLeakageSignals(d: N.NetworkData, lid: string) {
  return d.leakage
    .filter((l) => l.loopId === lid && !l.resolved)
    .sort(
      (a, b) =>
        ["critical", "high", "medium", "low"].indexOf(a.severity) -
        ["critical", "high", "medium", "low"].indexOf(b.severity),
    );
}
export function loopStrength(s: ScaleStore, l: N.GrowthLoop) {
  const d = N.networkData(s),
    ps = N.loopPeriods(d, l.id),
    t = loopTrend(d, l.id),
    leaks = loopLeakageSignals(d, l.id);
  if (
    !loopReadiness(s, l).parts.evidence ||
    !ps.some((p) => p.outputMetric !== null)
  )
    return {
      state: "unproven",
      reason: "شواهد خروجی اندازه‌گیری‌شده کافی نیست.",
    };
  if (
    t.current === 0 ||
    (t.delta !== null && t.delta < 0) ||
    leaks.some((x) => x.severity === "critical")
  )
    return {
      state: "weak",
      reason: "افت خروجی یا نشتی بحرانی نیازمند بررسی است.",
    };
  const recent = ps.slice(-3),
    positive = recent.filter(
      (p) => p.outputMetric !== null && p.outputMetric > 0,
    );
  if (
    positive.length >= 3 &&
    recent.every(
      (p, i) =>
        p.snapshot?.loop.primaryOutputMetricId === l.primaryOutputMetricId &&
        p.snapshot?.metricName === ps.at(-1)?.snapshot?.metricName &&
        p.snapshot?.metricUnit === ps.at(-1)?.snapshot?.metricUnit &&
        (!i || p.periodStart > recent[i - 1].periodEnd) &&
        JSON.stringify(
          p.snapshot?.nodes.map((n) => [n.id, n.name, n.metricId]),
        ) ===
          JSON.stringify(
            ps.at(-1)?.snapshot?.nodes.map((n) => [n.id, n.name, n.metricId]),
          ),
    ) &&
    loopReadiness(s, l).ready
  )
    return {
      state:
        !leaks.length && !l.dependency.trim() && t.cycleTime !== null
          ? "strong"
          : "repeatable",
      reason:
        "سه دوره خروجی مثبت ثبت شده؛ استقلال و علت اثر همچنان نیازمند قضاوت است.",
    };
  return {
    state: "emerging",
    reason: "نشانه مثبت اولیه؛ تکرارپذیری هنوز تثبیت نشده است.",
  };
}
export function loopNeedsAttention(
  s: ScaleStore,
  l: N.GrowthLoop,
  ownerIds: string[],
) {
  const d = N.networkData(s),
    r = loopReadiness(s, l, ownerIds),
    out: string[] = [];
  if (!r.parts.owner) out.push("حلقه مالک معتبر ندارد.");
  if (!r.parts.evidence) out.push("حلقه شواهد ندارد.");
  if (["active", "strengthening"].includes(l.status) && !r.ready)
    out.push("آمادگی حلقه فعال ناقص است.");
  if (
    ["active", "strengthening"].includes(l.status) &&
    (loopTrend(d, l.id).delta ?? 0) < 0
  )
    out.push("خروجی حلقه فعال افت کرده است.");
  if (
    loopStrength(s, l).state === "weak" &&
    !d.links.some((x) => x.loopId === l.id && x.kind === "experiment")
  )
    out.push("حلقه ضعیف آزمایش مرتبط ندارد.");
  if (loopLeakageSignals(d, l.id).some((x) => x.severity === "critical"))
    out.push("نشتی بحرانی حلقه بررسی شود.");
  return out;
}
export function channelPortfolioSummary(s: ScaleStore, period: string) {
  const d = N.networkData(s),
    ps = d.channelPeriods.filter(
      (p) =>
        p.status === "completed" &&
        p.periodStart + "|" + p.periodEnd === period,
    ),
    concentration = channelConcentration(ps);
  const missing = d.channels.filter(
    (c) =>
      c.active &&
      !ps.some((p) => p.channelId === c.id && p.attribution === "primary"),
  ).length;
  concentration.partial = concentration.partial || missing > 0;
  return {
    periods: ps,
    concentration,
    resilience: missing
      ? {
          state: "unknown",
          reason: "برای بخشی از کانال‌ها داده هم‌دوره نداریم.",
        }
      : channelResilience(d, ps),
    scaling: d.channels.filter((c) => c.status === "scaling").length,
    recentDecision: d.decisions.at(-1),
  };
}
export function loopPortfolioSummary(s: ScaleStore) {
  const d = N.networkData(s);
  return {
    active: d.loops.filter((l) =>
      ["active", "strengthening"].includes(l.status),
    ).length,
    emerging: d.loops.filter((l) => loopStrength(s, l).state === "emerging"),
    weak: d.loops.filter((l) => loopStrength(s, l).state === "weak"),
  };
}
export function loopNodeRates(p: N.GrowthLoopPeriod) {
  const nodes = p.snapshot?.nodes ?? [];
  return nodes.map((n, i) => ({
    nodeId: n.id,
    name: n.name,
    value: p.nodeMeasurements.find((m) => m.nodeId === n.id)?.value ?? null,
    rate:
      i > 0
        ? ratio(
            p.nodeMeasurements.find((m) => m.nodeId === n.id)?.value,
            p.nodeMeasurements.find((m) => m.nodeId === nodes[i - 1].id)?.value,
            100,
          )
        : null,
  }));
}
export function channelCompleteness(
  s: ScaleStore,
  c: N.GrowthChannel,
  owners: string[],
) {
  const d = N.networkData(s),
    p = N.channelPeriods(d, c.id).at(-1),
    e = channelMaturityEvidence(s, c.id);
  return {
    owner: owners.includes(c.ownerRoleId),
    period: !!p,
    funnel: !!c.funnelStageId,
    evidence: !!p?.source || e.experiments > 0,
    experiments: e.experiments > 0,
    economics:
      c.category === "paid" ? p?.spend != null && p?.revenue != null : null,
  };
}
