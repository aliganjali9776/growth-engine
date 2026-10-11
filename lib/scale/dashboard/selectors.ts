import type { ScaleStore } from "../model";
import type { ScaleSources } from "../sources";
import { experimentData } from "../experiments/model";
import { tehranDay } from "../experiments/logic";
import { funnelData, completedPeriods, periodStages } from "../funnel/model";
import * as F from "../funnel/logic";
import { networkData, channelPeriods, loopPeriods } from "../network/model";
import * as N from "../network/logic";
import { readinessData } from "../readiness/model";
import {
  scaleReadiness,
  scenarioRequirements,
  type Assessment,
} from "../readiness/logic";

export interface DashboardContext {
  today: string;
  funnelId?: string;
  periodId?: string;
  channelPeriod?: string;
  scenario?: string;
}
const valid = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);
const avg = (a: (number | null)[]) => {
  const k = a.filter(valid);
  return k.length ? k.reduce((x, y) => x + y, 0) / k.length : null;
};
const percent = (n: number, d: number) =>
  d ? Math.round((n / d) * 100) : null;
const age = (date: string | undefined, today: string) =>
  date && Number.isFinite(Date.parse(date))
    ? Math.floor(
        (Date.parse(today.length === 10 ? today : tehranDay(new Date(today))) -
          Date.parse(date.length === 10 ? date : tehranDay(new Date(date)))) /
          86400000,
      )
    : null;
const latest = (dates: string[]) =>
  [...dates].filter(Boolean).sort().at(-1) ?? null;
export const movement = (v: number | null) =>
  v === null
    ? "insufficient"
    : v > 0
      ? "positive"
      : v < 0
        ? "negative"
        : "stable";
export const movementLabels: Record<string, string> = {
  insufficient: "داده ناکافی",
  positive: "رو به بهبود",
  negative: "رو به کاهش",
  stable: "بدون تغییر",
};
export const gateLabels: Record<string, string> = {
  ready: "آماده بررسی",
  prepare: "ابتدا آماده‌سازی",
  hold: "فعلاً صبر",
  insufficient: "داده ناکافی",
};

export function getExperimentPortfolio(s: ScaleStore, today: string) {
  const d = experimentData(s);
  return d.experiments.map((e) => {
    const measurements = d.measurements.filter((m) => m.experimentId === e.id),
      learnings = d.learnings.filter((l) => l.experimentId === e.id),
      decisions = d.decisions.filter((l) => l.experimentId === e.id);
    const last = latest(measurements.map((m) => m.measurementDate));
    const elapsed = age(last ?? e.startedAt ?? e.startDate, today),
      issues: string[] = [];
    if (e.status === "running" && elapsed !== null && elapsed > d.staleDays)
      issues.push("آزمایش جاری بدون سنجش تازه");
    if (
      e.status === "running" &&
      e.endDate &&
      e.endDate < today &&
      !measurements.length
    )
      issues.push("موعد گذشته، بدون داده");
    if (e.status === "completed" && !e.resultStatus)
      issues.push("تکمیل بدون نتیجه");
    if (e.status === "completed" && e.resultStatus && !learnings.length)
      issues.push("نتیجه بدون یادگیری");
    if (e.status === "completed" && e.resultStatus && !decisions.length)
      issues.push("نتیجه بدون تصمیم");
    return {
      experiment: e,
      measurements,
      learnings,
      decisions,
      issues,
      elapsed,
      duration:
        e.completedAt &&
        e.startedAt &&
        Date.parse(e.completedAt) >= Date.parse(e.startedAt)
          ? age(e.startedAt, e.completedAt)
          : null,
    };
  });
}
export function getGrowthLabSummary(s: ScaleStore, today: string) {
  return summarizeGrowthLab(s, today, getExperimentPortfolio(s, today));
}
export function summarizeGrowthLab(
  s: ScaleStore,
  today: string,
  portfolio: ReturnType<typeof getExperimentPortfolio>,
) {
  const completed = portfolio.filter(
      (x) => x.experiment.status === "completed",
    ),
    recent = completed.filter((x) => {
      const n = age(x.experiment.completedAt, today);
      return n !== null && n >= 0 && n <= 30;
    });
  const distribution = Object.fromEntries(
    ["win", "partial", "noEffect", "negative", "inconclusive"].map((k) => [
      k,
      completed.filter((x) => x.experiment.resultStatus === k).length,
    ]),
  );
  return {
    portfolio,
    completed: completed.length,
    running: portfolio.filter((x) => x.experiment.status === "running").length,
    ideas: s.ideas.filter((i) => i.status !== "archived").length,
    ready: s.ideas.filter((i) => i.status === "ready").length,
    decided: completed.filter((x) => x.decisions.length).length,
    distribution,
    recentCompleted: recent.length,
    recentLearnings: portfolio
      .flatMap((x) => x.learnings)
      .filter((l) => {
        const n = age(l.createdAt, today);
        return n !== null && n >= 0 && n <= 30;
      }),
    averageDuration: avg(recent.map((x) => x.duration)),
    positive: completed.filter((x) =>
      ["win", "partial"].includes(x.experiment.resultStatus ?? ""),
    ).length,
    learningCoverage: percent(
      completed.filter((x) => x.learnings.length && x.decisions.length).length,
      completed.length,
    ),
  };
}
export function getFunnelExecutiveSummary(
  s: ScaleStore,
  sources: ScaleSources,
  ctx: DashboardContext,
) {
  const d = funnelData(s),
    funnel =
      d.funnels.find((f) => f.id === ctx.funnelId) ??
      d.funnels.find((f) => f.active),
    periods = funnel
      ? completedPeriods(d, funnel.id).filter((p) => p.periodEnd <= ctx.today)
      : [],
    period = periods.find((p) => p.id === ctx.periodId) ?? periods.at(-1),
    prior = period
      ? periods
          .filter(
            (p) =>
              p.periodEnd < period.periodStart && p.cadence === period.cadence,
          )
          .at(-1)
      : undefined;
  const rows = period
      ? F.stageRows(
          d,
          period,
          prior,
          sources.roles.map((r) => r.id),
          ctx.today,
        )
      : [],
    model = period?.snapshot?.revenue ?? null;
  const constraint =
    F.calculateFunnelConstraintSignal(
      rows,
      model?.revenueStageId ?? "",
      model?.averageDealValue ?? null,
    ).find((x) => x.score !== null) ?? null;
  const history = periods.map((p) => ({
    id: p.id,
    label: p.label,
    end: p.periodEnd,
    rows: F.stageRows(d, p),
    revenue: F.revenueHistory(d, p),
  }));
  const selectedIndex = rows.findIndex(
    (r) => r.stage.id === constraint?.row.stage.id,
  );
  const conversionTrend = history.map((h) => {
    const i = h.rows.findIndex((r) => r.stage.id === constraint?.row.stage.id);
    const compatible =
      i > 0 &&
      selectedIndex > 0 &&
      h.rows[i - 1].stage.id === rows[selectedIndex - 1].stage.id &&
      h.rows[i].stage.metricUnit === rows[selectedIndex].stage.metricUnit;
    return { label: h.label, value: compatible ? h.rows[i].conversion : null };
  });
  return {
    funnel,
    period,
    prior,
    periods,
    rows,
    model,
    history,
    conversionTrend,
    constraint,
    health: F.healthSummary(
      rows,
      period,
      d.staleDays,
      sources.roles.map((r) => r.id),
      ctx.today,
    ),
  };
}
export function getRevenueExecutiveSummary(
  s: ScaleStore,
  sources: ScaleSources,
  ctx: DashboardContext,
  f = getFunnelExecutiveSummary(s, sources, ctx),
) {
  const model = f.model,
    stages = f.period ? periodStages(funnelData(s), f.period) : [],
    actual = model?.currentRevenue ?? null,
    volume =
      f.rows.find((r) => r.stage.id === model?.revenueStageId)?.volume ?? null,
    estimate = F.calculateEstimatedRevenue(
      volume,
      model?.averageDealValue ?? null,
    );
  const target = model?.targetRevenue ?? null,
    rates =
      ctx.scenario === "target"
        ? Object.fromEntries(stages.map((r) => [r.id, r.targetConversion]))
        : Object.fromEntries(f.rows.map((r) => [r.stage.id, r.conversion]));
  const saved = readinessData(s).scenarios.find((x) => x.id === ctx.scenario),
    savedPeriod = saved
      ? funnelData(s).periods.find(
          (p) => p.id === saved.funnelPeriodId && p.status === "completed",
        )
      : undefined;
  const scenarioStages = savedPeriod
      ? periodStages(funnelData(s), savedPeriod)
      : stages,
    scenarioRows = savedPeriod
      ? F.stageRows(funnelData(s), savedPeriod)
      : f.rows,
    scenarioRates = saved
      ? Object.fromEntries(
          scenarioRows.map((r) => [
            r.stage.id,
            saved.useTargetRates ? r.stage.targetConversion : r.conversion,
          ]),
        )
      : rates;
  const scenarioModel = savedPeriod ? savedPeriod.snapshot?.revenue : model;
  const savedRequirements = saved ? scenarioRequirements(s, saved) : null;
  const savedVolume =
    savedRequirements?.rows.find((r) => r.id === scenarioModel?.revenueStageId)
      ?.required ?? null;
  const scenarioTarget = saved
    ? F.calculateEstimatedRevenue(
        savedVolume,
        scenarioModel?.averageDealValue ?? null,
      )
    : target;
  const backsolve = F.backsolveRequiredVolumes(
    scenarioStages,
    scenarioModel?.revenueStageId ?? "",
    scenarioTarget,
    scenarioModel?.averageDealValue ?? null,
    scenarioRates,
  );
  return {
    actual,
    estimate,
    target,
    gap: F.calculateRevenueGap(actual ?? estimate, target),
    basis: actual !== null ? "درآمد ثبت‌شده" : "برآورد قیف",
    currency: model?.currency ?? "",
    scenarioCurrency: scenarioModel?.currency ?? "",
    deal: model?.averageDealValue ?? null,
    repeat: model?.repeatRate ?? null,
    expansion: model?.expansionRevenue ?? null,
    scenarioLabel: saved
      ? `${saved.name} · حجم خروجی مبنا × ${saved.factor}`
      : ctx.scenario === "target"
        ? "سناریوی نرخ‌های هدف"
        : "سناریوی نرخ‌های مشاهده‌شده",
    scenarioTarget,
    required: savedRequirements
      ? savedRequirements.rows
      : scenarioStages
          .filter((x) => x.id in backsolve)
          .map((x) => ({
            name: x.name,
            id: x.id,
            unit: x.metricUnit,
            required: backsolve[x.id],
          })),
  };
}
export function getChannelPortfolioSummary(
  s: ScaleStore,
  ctx: DashboardContext,
) {
  const d = networkData(s),
    dates = [
      ...new Set(
        d.channelPeriods
          .filter((p) => p.status === "completed" && p.periodEnd <= ctx.today)
          .map((p) => p.periodStart + "|" + p.periodEnd),
      ),
    ].sort((a, b) => a.split("|")[1].localeCompare(b.split("|")[1]));
  const period = dates.includes(ctx.channelPeriod ?? "")
      ? ctx.channelPeriod!
      : (dates.at(-1) ?? ""),
    canonical = N.channelPortfolioSummary(s, period);
  const rows = d.channels
    .filter((c) => c.active)
    .map((c) => {
      const ps = channelPeriods(d, c.id).filter(
          (p) => p.attribution === "primary" && p.periodEnd <= ctx.today,
        ),
        p = ps.find((p) => p.periodStart + "|" + p.periodEnd === period),
        previous = p
          ? ps.filter((x) => x.periodEnd < p.periodStart).at(-1)
          : undefined;
      return {
        channel: c,
        period: p,
        performance: N.channelPerformance(p),
        trend: N.channelTrend(p, previous),
        evidence: N.channelMaturityEvidence(s, c.id),
        readiness: N.channelScaleReadiness(s, c.id, null),
      };
    });
  return {
    ...canonical,
    period,
    dates,
    rows,
    active: rows.filter((r) => r.channel.status === "active").length,
    repeatable: rows.filter((r) =>
      ["repeatable", "predictable", "scalable"].includes(r.channel.maturity),
    ).length,
    decisions: [...d.decisions]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5),
  };
}
export function getChannelConcentrationSummary(
  s: ScaleStore,
  ctx: DashboardContext,
) {
  return getChannelPortfolioSummary(s, ctx).concentration;
}
export function getLoopPortfolioSummary(s: ScaleStore) {
  const d = networkData(s);
  return d.loops
    .filter((l) => l.status !== "archived")
    .map((loop) => ({
      loop,
      strength: N.loopStrength(s, loop),
      trend: N.loopTrend(d, loop.id),
      leakage: N.loopLeakageSignals(d, loop.id),
      nodes: d.nodes
        .filter((n) => n.loopId === loop.id && n.active)
        .sort((a, b) => a.order - b.order),
      periods: loopPeriods(d, loop.id),
      evidence: d.evidence.filter((e) => e.loopId === loop.id),
      links: d.links.filter((x) => x.loopId === loop.id),
    }));
}
export function getScaleReadinessTrend(s: ScaleStore, candidateId: string) {
  return readinessData(s)
    .snapshots.filter((x) => x.candidateId === candidateId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((x) => {
      const a = x.assessment as Assessment;
      return {
        id: x.id,
        date: x.createdAt,
        score: a.score,
        coverage: a.coverage,
        gate: a.gate,
        name: x.candidate.name,
        scenarioId: x.scenario?.id ?? "",
        factor: x.scenario?.factor ?? null,
        decision: x.decision,
      };
    });
}
export function getScaleCandidatePortfolio(
  s: ScaleStore,
  sources: ScaleSources,
  includeClosed = false,
) {
  const d = readinessData(s);
  return d.candidates
    .filter((c) => includeClosed || !["archived", "stopped"].includes(c.status))
    .map((candidate) => {
      const scenario =
          d.scenarios.filter((x) => x.candidateId === candidate.id).at(-1) ??
          null,
        assessment = scaleReadiness(s, candidate, sources, scenario),
        objective = sources.objectives.find(
          (o) => o.id === candidate.objectiveId,
        ),
        kr = sources.keyResults.find(
          (k) =>
            k.id === candidate.krId &&
            (!candidate.objectiveId || k.objectiveId === candidate.objectiveId),
        );
      return {
        candidate,
        scenario,
        assessment,
        decision: d.decisions
          .filter((x) => x.scaleCandidateId === candidate.id)
          .at(-1),
        trend: getScaleReadinessTrend(s, candidate.id),
        objective,
        kr,
        aligned: !!objective || !!kr,
      };
    });
}
export function getCapacityExecutiveSummary(
  s: ScaleStore,
  sources: ScaleSources,
  candidates = getScaleCandidatePortfolio(s, sources),
) {
  const ranks = { critical: 3, high: 2, medium: 1 };
  const risks = candidates
    .flatMap((c) =>
      c.assessment.risks.map((r) => ({ ...r, candidate: c.candidate })),
    )
    .sort(
      (a, b) =>
        ranks[b.severity] - ranks[a.severity] ||
        (b.gap ?? 0) / (b.currentCapacity || 1) -
          (a.gap ?? 0) / (a.currentCapacity || 1),
    );
  return {
    risks,
    primary: risks[0] ?? null,
    rows: candidates.flatMap((c) =>
      c.assessment.plan.map((p) => ({ ...p, candidate: c.candidate })),
    ),
    preparation: readinessData(s).preparation.filter((p) =>
      candidates.some((c) => c.candidate.id === p.candidateId),
    ),
    processes: sources.capacity.filter((p) =>
      candidates.some((c) => c.candidate.processIds.includes(p.id)),
    ),
  };
}
export function getConstraintSummary(s: ScaleStore) {
  const primary =
    s.constraints.find(
      (c) =>
        c.id === s.primaryConstraintId &&
        ["active", "monitoring"].includes(c.status),
    ) ?? null;
  return {
    primary,
    secondary: s.constraints.filter(
      (c) =>
        c.id !== primary?.id && ["active", "monitoring"].includes(c.status),
    ),
    ideas: s.ideas.filter((i) => i.constraintId === primary?.id),
    experiments: experimentData(s).experiments.filter(
      (e) => e.constraintId === primary?.id,
    ),
    links: funnelData(s).links.filter(
      (l) => l.kind === "constraint" && l.entityId === primary?.id,
    ),
  };
}
export function getScaleDataFreshness(s: ScaleStore, today: string) {
  const f = funnelData(s),
    n = networkData(s),
    e = experimentData(s),
    r = readinessData(s);
  return [
    {
      key: "funnel",
      label: "آخرین دوره قیف",
      date: latest(
        f.periods
          .filter((p) => p.status === "completed")
          .map((p) => p.periodEnd),
      ),
      days: f.staleDays,
    },
    {
      key: "channel",
      label: "آخرین دوره کانال",
      date: latest(
        n.channelPeriods
          .filter((p) => p.status === "completed")
          .map((p) => p.periodEnd),
      ),
      days: n.staleDays,
    },
    {
      key: "loop",
      label: "آخرین دوره حلقه",
      date: latest(
        n.loopPeriods
          .filter((p) => p.status === "completed")
          .map((p) => p.periodEnd),
      ),
      days: n.staleDays,
    },
    {
      key: "measurement",
      label: "آخرین سنجش آزمایش",
      date: latest(e.measurements.map((m) => m.measurementDate)),
      days: e.staleDays,
    },
    {
      key: "readiness",
      label: "آخرین ارزیابی آمادگی",
      date: latest(r.snapshots.map((x) => x.createdAt)),
      days: 45,
    },
  ].map((x) => ({
    ...x,
    age: age(x.date ?? undefined, today),
    stale: !x.date || (age(x.date, today) ?? Infinity) > x.days,
    future: (age(x.date ?? undefined, today) ?? 0) < 0,
  }));
}
export function getScaleDataCompleteness(s: ScaleStore, sources: ScaleSources) {
  const e = experimentData(s),
    f = funnelData(s),
    n = networkData(s),
    r = readinessData(s);
  const parts = [
    ["تشخیص", s.diagnostics.some((d) => !!d.evidence)],
    [
      "شواهد گلوگاه",
      s.constraints.some((c) => c.status === "active" && c.evidence.length > 0),
    ],
    ["ایده", s.ideas.length > 0],
    [
      "شواهد آزمایش",
      e.experiments.some((x) => x.status === "completed" && !!x.resultStatus),
    ],
    ["قیف", f.periods.some((p) => p.status === "completed")],
    ["کانال", n.channelPeriods.some((p) => p.status === "completed")],
    ["حلقه", n.loopPeriods.some((p) => p.status === "completed")],
    [
      "ظرفیت",
      r.areas.some((a) => a.currentCapacity !== null && a.currentLoad !== null),
    ],
    ["ورودی مالی", r.financial.some((x) => x.state !== "unknown")],
    [
      "پیوند سیستم",
      r.candidates.some((c) =>
        c.processIds.some((id) => sources.capacity.some((p) => p.id === id)),
      ),
    ],
  ] as [string, boolean][];
  return {
    parts,
    score: Math.round((parts.filter(([, v]) => v).length / parts.length) * 100),
  };
}
export function getScaleDataConfidence(
  s: ScaleStore,
  sources: ScaleSources,
  today: string,
) {
  const completeness = getScaleDataCompleteness(s, sources),
    freshness = getScaleDataFreshness(s, today),
    known = freshness.filter((x) => x.date && !x.future),
    fresh = known.filter((x) => !x.stale),
    depth = Math.max(
      0,
      ...networkData(s).channels.map(
        (c) => N.channelMaturityEvidence(s, c.id).positivePeriods,
      ),
    ),
    quality = experimentData(s).learnings.some((l) => !!l.evidence);
  return {
    state:
      completeness.score >= 80 &&
      fresh.length === freshness.length &&
      depth >= 3 &&
      quality
        ? "high"
        : completeness.score >= 50 && fresh.length >= 2
          ? "medium"
          : "low",
    completeness,
    freshness,
    depth,
    reason:
      "پوشش داده، تازگی، دوره‌های مستقل کانال و مستندبودن یادگیری؛ مستقل از عملکرد کسب‌وکار.",
  };
}
export function getScaleEvidence(s: ScaleStore) {
  const e = experimentData(s).experiments.filter(
      (x) =>
        x.status === "completed" &&
        ["win", "partial"].includes(x.resultStatus ?? ""),
    ),
    n = networkData(s),
    repeated = n.channels.filter(
      (c) =>
        c.active && N.channelMaturityEvidence(s, c.id).positivePeriods >= 3,
    ).length,
    loops = n.loops.filter(
      (l) =>
        l.status !== "archived" &&
        ["repeatable", "strong"].includes(N.loopStrength(s, l).state),
    ).length;
  const ed = experimentData(s),
    byId = new Map(ed.experiments.map((x) => [x.id, x]));
  const families = new Set(
    e
      .filter(
        (x) =>
          ed.measurements.some((m) => m.experimentId === x.id) &&
          ed.learnings.some(
            (l) => l.experimentId === x.id && l.evidence.trim(),
          ),
      )
      .map((x) => {
        const seen = new Set<string>();
        while (x.parentExperimentId && !seen.has(x.id)) {
          seen.add(x.id);
          const parent = byId.get(x.parentExperimentId);
          if (!parent) break;
          x = parent;
        }
        return x.id;
      }),
  );
  return {
    state:
      repeated >= 2 && loops && e.length
        ? "strong"
        : repeated || loops
          ? "repeatable"
          : families.size >= 2
            ? "emerging"
            : e.length ||
                n.channelPeriods.some(
                  (p) => p.status === "completed" && (p.customers ?? 0) > 0,
                )
              ? "early"
              : "insufficient",
    positiveExperiments: e.length,
    repeatedChannels: repeated,
    repeatableLoops: loops,
  };
}
export function getScaleMomentum(
  s: ScaleStore,
  sources: ScaleSources,
  ctx: DashboardContext,
  inputs = dashboardInputs(s, sources, ctx),
) {
  const f = inputs.funnel,
    ch = inputs.channels,
    c = inputs.candidates,
    signals: { label: string; delta: number }[] = [];
  const transition = f.constraint?.row.trend;
  if (valid(transition))
    signals.push({ label: "تبدیل مرحله گلوگاه قیف", delta: transition });
  const rh =
    f.prior && f.period
      ? f.history.filter((h) => h.id === f.prior!.id || h.id === f.period!.id)
      : [];
  if (
    rh.length === 2 &&
    rh[0].revenue.currency === rh[1].revenue.currency &&
    valid(rh[0].revenue.actual) &&
    valid(rh[1].revenue.actual)
  )
    signals.push({
      label: "درآمد ثبت‌شده",
      delta: rh[1].revenue.actual - rh[0].revenue.actual,
    });
  const ct = avg(ch.rows.map((r) => r.trend.qualifiedLeads));
  if (ct !== null)
    signals.push({ label: "تقاضای واجد شرایط کانال‌ها", delta: ct });
  const readinessChanges: number[] = [];
  for (const x of c) {
    const ts = x.trend.slice(-2);
    if (
      ts.length === 2 &&
      ts[0].scenarioId === ts[1].scenarioId &&
      ts[0].factor === ts[1].factor &&
      ts[0].coverage === ts[1].coverage &&
      valid(ts[0].score) &&
      valid(ts[1].score)
    )
      readinessChanges.push(ts[1].score - ts[0].score);
  }
  const readinessChange = avg(readinessChanges);
  if (readinessChange !== null)
    signals.push({
      label: "تغییر آمادگی کاندیدهای قابل مقایسه",
      delta: readinessChange,
    });
  const up = signals.filter((x) => x.delta > 0).length,
    down = signals.filter((x) => x.delta < 0).length;
  return {
    state:
      signals.length < 2
        ? "insufficient"
        : up > down
          ? "positive"
          : down > up
            ? "negative"
            : "stable",
    signals,
  };
}

// Disjoint lenses: composite readiness, revenue and loop evidence are shown
// separately because they reuse conversion, channel and capacity inputs.
export function getScaleHealth(
  s: ScaleStore,
  sources: ScaleSources,
  ctx: DashboardContext,
  inputs = dashboardInputs(s, sources, ctx),
) {
  const c = inputs.constraint,
    lab = inputs.lab,
    f = inputs.funnel,
    ch = inputs.channels,
    capacity = inputs.capacity;
  const uniquePlans = [
    ...new Map(
      capacity.rows.filter((p) => p.status !== "unknown").map((p) => [p.id, p]),
    ).values(),
  ];
  const components = [
    {
      key: "clarity",
      label: "وضوح گلوگاه",
      weight: 10,
      value: c.primary ? (c.primary.evidence.length ? 100 : 40) : null,
      basis: "گلوگاه معتبر و شواهد ثبت‌شده",
    },
    {
      key: "experiment",
      label: "شواهد آزمایش",
      weight: 20,
      value: percent(
        lab.positive,
        Object.values(lab.distribution).reduce((a, n) => a + n, 0),
      ),
      basis:
        "نتایج مثبت یا نسبی از آزمایش‌های تکمیل‌شده؛ حجم به‌تنهایی امتیاز نیست",
    },
    {
      key: "conversion",
      label: "عملکرد تبدیل قیف",
      weight: 25,
      value: avg(f.rows.slice(1).map((r) => r.health.score)),
      basis: "جزء تبدیل از مدل اصلی قیف؛ سلامت مرکب دوباره جمع نمی‌شود",
    },
    {
      key: "channel",
      label: "تکرار تقاضای کانال",
      weight: 15,
      value: avg(
        ch.rows
          .filter((r) => r.evidence.periods > 0)
          .map((r) => Math.min(100, (r.evidence.positivePeriods / 3) * 100)),
      ),
      basis: "دوره مستقل دارای مشتری؛ نه بلوغ اعلام‌شده مدیریت",
    },
    {
      key: "capacity",
      label: "ظرفیت عملیاتی",
      weight: 20,
      value: avg(
        uniquePlans.map((p) =>
          p.criticalRoleGap
            ? 20
            : p.status === "available"
              ? 90
              : p.status === "tight"
                ? 55
                : 20,
        ),
      ),
      basis: "حوزه‌های ظرفیت سناریو؛ هر شناسه یک بار",
    },
    {
      key: "learning",
      label: "انضباط یادگیری",
      weight: 10,
      value: lab.learningCoverage,
      basis: "نتیجه همراه با یادگیری و تصمیم، فارغ از مثبت یا منفی بودن",
    },
  ];
  const coverage = components
      .filter((x) => x.value !== null)
      .reduce((a, x) => a + x.weight, 0),
    score = coverage
      ? Math.round(
          components.reduce((a, x) => a + (x.value ?? 0) * x.weight, 0) /
            coverage,
        )
      : null;
  return {
    score,
    coverage,
    status:
      score === null
        ? "داده ناکافی"
        : coverage < 60
          ? "پوشش ناکافی برای قضاوت"
          : score < 40
            ? "بحرانی"
            : score < 60
              ? "ناپایدار"
              : score < 75
                ? "نیازمند آماده‌سازی"
                : score < 90
                  ? "سلامت مطلوب؛ ظرفیت جدا بررسی شود"
                  : "موتور رشد قوی",
    components: components.map((x) => ({
      ...x,
      contribution:
        x.value === null ? null : (x.value * x.weight) / (coverage || 1),
    })),
    note: "سلامت موتور جاری با آمادگی کاندید و آمادگی راه‌اندازی متفاوت است. درآمد، حلقه و امتیاز مرکب آمادگی جدا نمایش داده می‌شوند تا شواهد مشترک چندبار شمرده نشوند. امتیاز بالا تضمین رشد نیست.",
  };
}
export interface ScaleAttentionItem {
  id: string;
  category: string;
  title: string;
  evidence: string;
  href: string;
  severity: number;
  impact: number;
  relevance: number;
  revenue: number;
  strength: number;
  duration: number;
  capacity: number;
  alignment: number;
}
export function getScaleAttention(
  s: ScaleStore,
  sources: ScaleSources,
  ctx: DashboardContext,
  inputs = dashboardInputs(s, sources, ctx),
) {
  const out: ScaleAttentionItem[] = [],
    c = inputs.constraint,
    f = inputs.funnel,
    revenue = inputs.revenue,
    ch = inputs.channels,
    cs = inputs.candidates;
  const add = (
    id: string,
    category: string,
    title: string,
    evidence: string,
    href: string,
    severity: number,
    extra: Partial<ScaleAttentionItem> = {},
  ) =>
    out.push({
      id,
      category,
      title,
      evidence,
      href,
      severity,
      impact: 1,
      relevance: 0,
      revenue: 0,
      strength: 1,
      duration: 0,
      capacity: 0,
      alignment: 0,
      ...extra,
    });
  if (c.primary && ["critical", "high"].includes(c.primary.severity))
    add(
      "primary",
      "گلوگاه",
      c.primary.title,
      c.primary.evidence.map((e) => e.text).join("؛ ") || "شواهد نیازمند تکمیل",
      "/scale/constraints/" + c.primary.id,
      c.primary.severity === "critical" ? 3 : 2,
      { relevance: 2, strength: c.primary.confidence === "high" ? 2 : 1 },
    );
  if (f.rows.some((r) => r.trend !== null && r.trend < -5))
    add(
      "funnel",
      "قیف",
      "افت تبدیل قیف",
      "افت بیش از ۵ واحد درصد در مرحله قابل مقایسه",
      "/scale/funnel",
      2,
      { revenue: 1 },
    );
  if (
    revenue.gap !== null &&
    revenue.target &&
    revenue.gap / revenue.target > 0.25
  )
    add(
      "revenue",
      "درآمد",
      "شکاف قابل توجه با هدف درآمد",
      revenue.basis + "؛ شکاف بیش از یک‌چهارم هدف",
      "/scale/reports/revenue",
      2,
      { revenue: 2 },
    );
  for (const x of inputs.lab.portfolio)
    for (const [i, msg] of x.issues.entries())
      add(
        "exp" + x.experiment.id + i,
        "آزمایش",
        x.experiment.title,
        msg,
        "/scale/experiments/" + x.experiment.id,
        1,
        {
          duration: (x.elapsed ?? 0) > 30 ? 2 : 1,
          relevance: x.experiment.constraintId === c.primary?.id ? 2 : 0,
        },
      );
  const negativeGroups = new Map<string, number>();
  for (const e of experimentData(s).experiments.filter(
    (e) => e.status === "completed" && e.resultStatus === "negative",
  )) {
    const key = e.constraintId || e.ideaId;
    if (key) negativeGroups.set(key, (negativeGroups.get(key) ?? 0) + 1);
  }
  for (const [id, count] of negativeGroups)
    if (count >= 2)
      add(
        "negative" + id,
        "آزمایش",
        "بازنگری فرضیه رشد",
        `${count} نتیجه منفی مرتبط؛ یادگیری‌ها پیش از آزمایش بعدی مرور شوند`,
        "/scale/reports/learnings",
        2,
      );
  for (const idea of s.ideas.filter(
    (i) =>
      i.status === "ready" &&
      !experimentData(s).experiments.some((e) => e.ideaId === i.id),
  ))
    add(
      "idea" + idea.id,
      "ایده",
      idea.title,
      "آماده آزمایش اما آزمایشی متصل نیست",
      "/scale/ideas/" + idea.id,
      1,
    );
  if (ch.concentration.top !== null && ch.concentration.top >= 70)
    add(
      "concentration",
      "کانال",
      "تمرکز تقاضا روی یک کانال",
      "سهم ثبت‌شده کانال اول حداقل ۷۰٪ است؛ " +
        (ch.concentration.partial ? "پوشش ناقص" : "داده هم‌دوره"),
      "/scale/reports/concentration",
      2,
    );
  for (const x of ch.rows)
    if (x.channel.status === "scaling" && x.evidence.positivePeriods < 2)
      add(
        "ch" + x.channel.id,
        "کانال",
        x.channel.name,
        "توسعه با شواهد تکرار محدود",
        "/scale/channels/" + x.channel.id,
        2,
      );
  for (const x of inputs.loops)
    if (
      x.strength.state === "weak" ||
      x.leakage.some((l) => l.severity === "critical")
    )
      add(
        "loop" + x.loop.id,
        "حلقه",
        x.loop.name,
        "حلقه ضعیف یا نشتی بحرانی",
        "/scale/loops/" + x.loop.id,
        2,
      );
  for (const x of cs) {
    const href = "/scale/readiness/" + x.candidate.id;
    for (const [i, r] of x.assessment.risks.entries())
      add(
        x.candidate.id + i,
        "ظرفیت",
        r.area,
        r.evidence,
        href,
        r.severity === "critical" ? 3 : 2,
        { capacity: 2, impact: 2, alignment: x.aligned ? 1 : 0 },
      );
    if (x.assessment.preparation.blocked)
      add(
        "blocked" + x.candidate.id,
        "آماده‌سازی",
        x.candidate.name,
        "اقدام آماده‌سازی مسدود است",
        href,
        2,
      );
    if (x.assessment.next)
      add(
        "next" + x.candidate.id,
        "محدودیت بعدی",
        x.assessment.next.area,
        "پس از رفع محدودیت اول؛ " + x.assessment.next.evidence,
        href,
        1,
      );
    if (
      (x.candidate.status === "scaling" || x.decision?.decision === "scale") &&
      x.assessment.gate !== "ready"
    )
      add(
        "unsupported" + x.candidate.id,
        "تصمیم",
        x.candidate.name,
        "تصمیم توسعه با دروازه تحلیلی فعلی پشتیبانی نمی‌شود",
        href,
        3,
      );
    if (x.candidate.status === "scaling" && !x.aligned)
      add(
        "alignment" + x.candidate.id,
        "استراتژی",
        x.candidate.name,
        "تعهد توسعه بدون پیوند معتبر به هدف یا نتیجه کلیدی",
        href,
        2,
      );
  }
  if (getScaleDataFreshness(s, ctx.today).some((x) => x.stale))
    add(
      "fresh",
      "داده",
      "تازه‌سازی شواهد رشد",
      "بخشی از داده‌ها قدیمی یا ناموجود است",
      "/scale/reports",
      1,
    );
  const unique = out.filter(
    (x, i) =>
      out.findIndex((y) => y.href === x.href && y.title === x.title) === i,
  );
  return unique.sort(
    (a, b) =>
      b.severity - a.severity ||
      b.capacity - a.capacity ||
      b.impact - a.impact ||
      b.relevance - a.relevance ||
      b.revenue - a.revenue ||
      b.strength - a.strength ||
      b.duration - a.duration ||
      b.alignment - a.alignment ||
      a.id.localeCompare(b.id),
  );
}
function dashboardInputs(
  s: ScaleStore,
  sources: ScaleSources,
  ctx: DashboardContext,
) {
  const funnel = getFunnelExecutiveSummary(s, sources, ctx),
    candidates = getScaleCandidatePortfolio(s, sources);
  return {
    constraint: getConstraintSummary(s),
    funnel,
    candidates,
    capacity: getCapacityExecutiveSummary(s, sources, candidates),
    revenue: getRevenueExecutiveSummary(s, sources, ctx, funnel),
    lab: getGrowthLabSummary(s, ctx.today),
    channels: getChannelPortfolioSummary(s, ctx),
    loops: getLoopPortfolioSummary(s),
  };
}
export function getScaleDashboard(
  s: ScaleStore,
  sources: ScaleSources,
  ctx: DashboardContext,
) {
  const inputs = dashboardInputs(s, sources, ctx),
    { constraint, funnel, candidates, capacity, revenue } = inputs,
    health = getScaleHealth(s, sources, ctx, inputs),
    evidence = getScaleEvidence(s),
    momentum = getScaleMomentum(s, sources, ctx, inputs),
    attention = getScaleAttention(s, sources, ctx, inputs);
  return {
    constraint,
    health,
    evidence,
    momentum,
    attention,
    focus: attention[0] ?? null,
    funnel,
    revenue,
    candidates,
    capacity,
    lab: inputs.lab,
    channels: inputs.channels,
    loops: inputs.loops,
    confidence: getScaleDataConfidence(s, sources, ctx.today),
    summary: `${constraint.primary ? "گلوگاه اصلی: " + constraint.primary.title : "گلوگاه اصلی معتبر هنوز مشخص نشده است."} ${capacity.primary ? "پیش از افزایش حجم، " + capacity.primary.area + " بررسی شود." : "برای قضاوت درباره ظرفیت، شواهد سناریو را بررسی کنید."} ${attention[0] ? "تمرکز مدیریت: " + attention[0].title + "." : "ثبت شواهد قابل اتکا قدم بعدی است."}`,
  };
}
