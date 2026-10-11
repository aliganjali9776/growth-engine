import type { ScaleStore } from "../model";
import type { ScaleSources } from "../sources";
import { experimentData } from "../experiments/model";
import { funnelData, periodStages } from "../funnel/model";
import { backsolveRequiredVolumes, stageRows } from "../funnel/logic";
import {
  networkData,
  channelPeriods,
  loopPeriods,
  maturities,
} from "../network/model";
import {
  channelMaturityEvidence,
  channelPerformance,
  loopStrength,
} from "../network/logic";
import * as M from "./model";
const known = (v: number | null | undefined): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0;
const safe = (v: number) => (Number.isFinite(v) ? v : null);
const mean = (vs: (number | null)[]) => {
  const a = vs.filter(known);
  return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
};
export function capacityUtilization(
  load: number | null,
  capacity: number | null,
) {
  return known(load) && known(capacity) && capacity > 0
    ? safe((load / capacity) * 100)
    : null;
}
export function capacityGap(required: number | null, current: number | null) {
  return known(required) && known(current) ? safe(required - current) : null;
}
export function capacityStatus(
  load: number | null,
  capacity: number | null,
  thresholds = { tight: 70, overloaded: 90 },
): "unknown" | "available" | "tight" | "overloaded" {
  if (known(load) && load > 0 && capacity === 0) return "overloaded";
  const u = capacityUtilization(load, capacity);
  return u === null
    ? "unknown"
    : u > thresholds.overloaded
      ? "overloaded"
      : u >= thresholds.tight
        ? "tight"
        : "available";
}
export function scaleEvidenceStrength(s: ScaleStore, c: M.ScaleCandidate) {
  const n = networkData(s),
    ed = experimentData(s),
    fd = funnelData(s);
  let depth: number | null = null,
    positive = 0,
    detail = "شواهد قابل ارزیابی ثبت نشده است.";
  if (c.sourceType === "channel") {
    const ch = n.channels.find((x) => x.id === c.sourceId);
    if (ch) {
      const e = channelMaturityEvidence(s, ch.id);
      depth = e.periods;
      positive = e.positivePeriods;
      detail = `${e.positivePeriods} دوره مستقل مثبت؛ ${e.experiments} آزمایش تکمیل‌شده؛ بلوغ ${maturities[ch.maturity]}`;
    }
  }
  if (c.sourceType === "loop") {
    const l = n.loops.find((x) => x.id === c.sourceId);
    if (l) {
      const ps = loopPeriods(n, l.id),
        latest = ps.at(-1);
      let end = "";
      const usable = ps.filter((p) => {
        const ok =
          p.periodStart > end &&
          p.snapshot?.loop.primaryOutputMetricId ===
            latest?.snapshot?.loop.primaryOutputMetricId &&
          p.snapshot?.metricUnit === latest?.snapshot?.metricUnit &&
          p.snapshot?.metricName === latest?.snapshot?.metricName &&
          JSON.stringify(
            p.snapshot?.nodes.map((n) => [n.id, n.name, n.metricId]),
          ) ===
            JSON.stringify(
              latest?.snapshot?.nodes.map((n) => [n.id, n.name, n.metricId]),
            );
        if (ok) end = p.periodEnd;
        return ok;
      });
      depth = usable.length;
      positive = usable.filter((p) => (p.outputMetric ?? 0) > 0).length;
      const strengthLabels: Record<string, string> = {
        unproven: "اثبات‌نشده",
        weak: "ضعیف",
        emerging: "نوظهور",
        repeatable: "تکرارپذیر",
        strong: "قوی",
      };
      detail = `${positive} دوره مثبت؛ قدرت ${strengthLabels[loopStrength(s, l).state] ?? "نامشخص"}؛ شواهد ${n.evidence.filter((e) => e.loopId === l.id).length}`;
    }
  }
  if (c.sourceType === "experiment" || c.sourceType === "idea") {
    const target = ed.experiments.find((e) => e.id === c.sourceId);
    const root = (id: string) => {
      const seen = new Set<string>();
      let e = ed.experiments.find((x) => x.id === id);
      while (e?.parentExperimentId && !seen.has(e.id)) {
        seen.add(e.id);
        const parent = ed.experiments.find(
          (x) => x.id === e!.parentExperimentId,
        );
        if (!parent) break;
        e = parent;
      }
      return e?.id;
    };
    const es = ed.experiments.filter(
      (e) =>
        e.status === "completed" &&
        (c.sourceType === "idea"
          ? e.ideaId === c.sourceId
          : target && root(e.id) === root(target.id)),
    );
    depth = es.length;
    positive = es.filter(
      (e) => e.resultStatus === "win" || e.resultStatus === "partial",
    ).length;
    detail = `${positive} نتیجه مثبت از ${es.length} آزمایش مرتبط؛ تکرار در یک زنجیره الزاماً تأیید مستقل نیست.`;
  }
  if (c.sourceType === "funnel") {
    const ps = fd.periods
      .filter((p) => p.funnelId === c.sourceId && p.status === "completed")
      .sort((a, b) => a.periodEnd.localeCompare(b.periodEnd));
    let end = "";
    const usable = ps.filter((p) => {
      const ok = p.periodStart > end;
      if (ok) end = p.periodEnd;
      return ok;
    });
    depth = usable.length;
    positive = usable.filter((p) => {
      const rid = p.snapshot?.revenue?.revenueStageId;
      return (
        rid &&
        fd.measurements.some(
          (m) =>
            m.periodId === p.id && m.stageId === rid && (m.volume ?? 0) > 0,
        )
      );
    }).length;
    detail = `${positive} دوره مستقل با خروجی درآمدی مثبت؛ پایداری تبدیل باید بررسی شود.`;
  }
  if (
    c.sourceType === "management" &&
    c.manualEvidence.trim() &&
    c.manualPositivePeriods !== null
  ) {
    depth = c.manualPositivePeriods;
    positive = c.manualPositivePeriods;
    detail = `اظهار مدیریت: ${c.manualEvidence}`;
  }
  const value =
    depth === null || depth === 0
      ? null
      : ["experiment", "idea"].includes(c.sourceType) && positive > 0
        ? 40
        : positive >= 3
          ? 85
          : positive >= 2
            ? 65
            : positive === 1
              ? 40
              : 15;
  return {
    value,
    depth,
    positive,
    state:
      value === null
        ? "unknown"
        : value >= 80
          ? "strong"
          : value >= 60
            ? "adequate"
            : "early",
    detail,
  };
}
export function repeatabilityAssessment(
  s: ScaleStore,
  c: M.ScaleCandidate,
  e = scaleEvidenceStrength(s, c),
) {
  // Iterations in one experiment family do not establish independent demand.
  const independent = ["experiment", "idea"].includes(c.sourceType)
    ? Math.min(1, e.positive)
    : e.positive;
  return {
    state:
      independent >= 3 ? "repeatable" : independent > 0 ? "early" : "unproven",
    value:
      e.depth === null || !e.depth
        ? null
        : independent >= 3
          ? 80
          : independent >= 2
            ? 60
            : independent === 1
              ? 30
              : 10,
    detail:
      "تکرار در چند دوره یا آزمایش؛ پیش‌بینی‌پذیری از تعداد مشاهدات به‌تنهایی نتیجه نمی‌شود.",
  };
}
export function scenarioRequirements(
  s: ScaleStore,
  scenario: M.ScaleScenario | null,
) {
  const d = funnelData(s),
    p = d.periods.find(
      (p) =>
        p.id === scenario?.funnelPeriodId &&
        p.funnelId === scenario?.funnelId &&
        p.status === "completed",
    );
  if (!scenario || !p)
    return {
      rows: [] as {
        id: string;
        name: string;
        unit: string;
        current: number | null;
        required: number | null;
      }[],
      period: "",
      revenueTarget: null as number | null,
    };
  const stages = periodStages(d, p),
    rows = stageRows(d, p),
    output = rows.find((r) => r.stage.id === scenario.outputStageId),
    target =
      output?.volume != null ? safe(output.volume * scenario.factor) : null;
  const rates = Object.fromEntries(
    rows.map((r) => [
      r.stage.id,
      scenario.useTargetRates ? r.stage.targetConversion : r.conversion,
    ]),
  );
  const volumes = backsolveRequiredVolumes(
    stages,
    scenario.outputStageId,
    target,
    1,
    rates,
  );
  return {
    rows: rows
      .filter((r) => r.stage.id in volumes)
      .map((r) => ({
        id: r.stage.id,
        name: r.stage.name,
        unit: r.stage.metricUnit,
        current: r.volume,
        required: volumes[r.stage.id],
      })),
    period: `${p.periodStart} — ${p.periodEnd}`,
    revenueTarget: p.snapshot?.revenue?.targetRevenue ?? null,
  };
}
export function capacityPlan(
  s: ScaleStore,
  candidateId: string,
  scenario: M.ScaleScenario | null,
) {
  const d = M.readinessData(s),
    requirements = scenarioRequirements(s, scenario);
  return d.areas
    .filter((a) => a.candidateId === candidateId)
    .map((a) => {
      const mapped = requirements.rows.find((r) => r.id === a.funnelStageId);
      const required = a.funnelStageId
        ? scenario?.periodConfirmed && mapped?.unit === a.unit
          ? mapped.required
          : null
        : a.targetLoad !== null
          ? a.targetLoad
          : scenario && a.currentLoad !== null
            ? safe(a.currentLoad * scenario.factor)
            : null;
      return {
        ...a,
        required,
        gap: capacityGap(required, a.currentCapacity),
        utilization: capacityUtilization(a.currentLoad, a.currentCapacity),
        projectedUtilization: capacityUtilization(required, a.currentCapacity),
        status: capacityStatus(required, a.currentCapacity, d.thresholds),
        basis: a.funnelStageId
          ? "محاسبه معکوس قیف؛ نیازمند تأیید واحد و دوره"
          : a.targetLoad !== null
            ? "نیاز صریح مدیریت؛ مستقل از ضریب سناریو"
            : "فرض تغییر خطی بار با ضریب سناریو",
      };
    });
}
export type CapacityPlan = ReturnType<typeof capacityPlan>;
export function preparationProgress(items: M.ScalePreparationItem[]) {
  const completed = items.filter((p) => p.status === "completed").length;
  return {
    total: items.length,
    completed,
    remaining: items.length - completed,
    blocked: items.filter((p) => p.status === "blocked").length,
  };
}
export function identifyPrimaryBreakpoint(risks: M.ScaleCapacityRisk[]) {
  return (
    [...risks].sort(
      (a, b) =>
        ({ critical: 3, high: 2, medium: 1 })[b.severity] -
          { critical: 3, high: 2, medium: 1 }[a.severity] ||
        (b.gap !== null && b.currentCapacity !== null
          ? b.gap / Math.max(b.currentCapacity, 1)
          : 0) -
          (a.gap !== null && a.currentCapacity !== null
            ? a.gap / Math.max(a.currentCapacity, 1)
            : 0),
    )[0] ?? null
  );
}
export function identifyPotentialNextConstraint(risks: M.ScaleCapacityRisk[]) {
  const first = identifyPrimaryBreakpoint(risks);
  return identifyPrimaryBreakpoint(risks.filter((r) => r !== first));
}
export function readinessConfidence(
  coverage: number,
  depth: number | null,
  sourceCount: number,
): "high" | "medium" | "low" {
  return coverage >= 85 && (depth ?? 0) >= 3 && sourceCount >= 3
    ? "high"
    : coverage >= 55 && (depth ?? 0) >= 2
      ? "medium"
      : "low";
}
export function scaleGate(
  score: number | null,
  coverage: number,
  evidence: number | null,
  risks: M.ScaleCapacityRisk[],
  financial: number | null,
): "ready" | "prepare" | "hold" | "insufficient" {
  if (
    score === null ||
    coverage < 60 ||
    evidence === null ||
    financial === null
  )
    return "insufficient";
  if (risks.some((r) => r.severity === "critical" || r.severity === "high"))
    return "prepare";
  if (evidence < 60) return "hold";
  return score >= 75 && coverage >= 85 ? "ready" : "prepare";
}
export const gateLabels = {
  ready: "آماده بررسی تصمیم",
  prepare: "ابتدا آماده‌سازی",
  hold: "فعلاً صبر / آزمایش بیشتر",
  insufficient: "داده ناکافی",
};
export const confidenceLabels = { low: "پایین", medium: "متوسط", high: "بالا" };
export function growthCapacityMatrixPosition(
  evidence: number | null,
  capacity: number | null,
) {
  return evidence === null || capacity === null
    ? "unknown"
    : `${evidence >= 65 ? "high" : "low"}-${capacity >= 70 ? "high" : "low"}`;
}
export function scaleReadiness(
  s: ScaleStore,
  c: M.ScaleCandidate,
  sources: ScaleSources,
  scenario: M.ScaleScenario | null,
) {
  const d = M.readinessData(s),
    e = scaleEvidenceStrength(s, c),
    repeat = repeatabilityAssessment(s, c, e),
    plan = capacityPlan(s, c.id, scenario),
    linked = sources.capacity.filter((p) => c.processIds.includes(p.id)),
    finance = d.financial.filter((f) => f.candidateId === c.id),
    finValues = finance
      .filter((f) => f.state !== "unknown")
      .map(
        (f) =>
          ({ strong: 90, adequate: 75, watch: 45, constraint: 15, unknown: 0 })[
            f.state
          ],
      ),
    financial = finValues.length ? Math.min(...finValues) : null;
  const capacityValue = (areas: string[]) => {
    const rows = plan.filter((a) => areas.includes(a.area));
    if (!rows.length || rows.some((a) => a.status === "unknown")) return null;
    return Math.min(
      ...rows.map((a) =>
        a.criticalRoleGap
          ? 20
          : a.status === "overloaded"
            ? 20
            : a.status === "tight"
              ? 55
              : 90,
      ),
    );
  };
  const sales = capacityValue(["sales"]),
    delivery = capacityValue([
      "delivery",
      "inventory",
      "supplier",
      "logistics",
      "production",
      "machine",
      "shift",
      "materials",
      "warehouse",
      "quality",
      "consultant",
      "projects",
      "hours",
      "accounts",
      "fulfillment",
      "support",
      "shipping",
      "returns",
    ]),
    team = capacityValue(["team"]);
  const allProcessesKnown =
    c.processIds.length > 0 && linked.length === c.processIds.length;
  const process =
      allProcessesKnown &&
      linked.every(
        (p) =>
          p.standardization !== null && p.adoption !== null && p.kpi !== null,
      )
        ? mean(linked.map((p) => mean([p.standardization, p.adoption, p.kpi])))
        : null,
    founder = linked.some((p) =>
      ["high", "critical"].includes(p.founderDependency),
    )
      ? 20
      : allProcessesKnown && linked.every((p) => p.independence !== null)
        ? mean(linked.map((p) => p.independence))
        : null;
  let economics: number | null = null,
    econText =
      "هزینه و درآمد قابل‌مقایسه کافی نیست؛ سود یا CAC کامل محاسبه نمی‌شود.";
  if (c.sourceType === "channel") {
    const p = channelPeriods(networkData(s), c.sourceId).at(-1),
      m = channelPerformance(p);
    if (m.revenuePerSpend !== null) {
      economics = m.revenuePerSpend >= 1 ? 70 : 25;
      econText = `درآمد منتسب / هزینه ثبت‌شده: ${m.revenuePerSpend.toFixed(2)}؛ حاشیه سود نامشخص`;
    }
  }
  const req = scenarioRequirements(s, scenario),
    hasOwner = sources.roles.some((r) => r.id === c.ownerRoleId),
    completenessParts = {
      demand: e.value !== null,
      funnel: req.rows.some((r) => r.required !== null),
      capacity:
        plan.length > 0 &&
        plan.every(
          (a) =>
            a.currentCapacity !== null &&
            a.required !== null &&
            !!a.source.trim(),
        ),
      system: allProcessesKnown && linked.every((p) => p.health !== null),
      finance: financial !== null,
      owner: hasOwner,
      scenario: !!scenario,
    };
  const completeness = Math.round(
    (Object.values(completenessParts).filter(Boolean).length / 7) * 100,
  );
  const values: [string, string, number, number | null, string][] = [
    [
      "demand",
      "شواهد تقاضا",
      15,
      e.value === null ? null : e.positive > 0 ? 65 : 15,
      e.detail + "؛ وجود سیگنال تقاضا، بدون پاداش دوباره به تعداد دوره‌ها",
    ],
    ["repeatability", "تکرارپذیری", 15, repeat.value, repeat.detail],
    ["economics", "اقتصاد قیف", 10, economics, econText],
    [
      "sales",
      "ظرفیت فروش",
      10,
      sales,
      "بار موردنیاز در سناریو نسبت به ظرفیت ثبت‌شده",
    ],
    [
      "delivery",
      "ظرفیت تحویل / عملیات",
      15,
      delivery,
      "بدترین وضعیت ظرفیت مرتبط تحویل",
    ],
    ["team", "ظرفیت تیم", 10, team, "ظرفیت و شکاف نقش‌های بحرانی"],
    [
      "process",
      "آمادگی فرآیند",
      10,
      process,
      "فقط استاندارد، پذیرش و KPI فرآیندهای پیوندشده؛ سلامت کل برای جلوگیری از هم‌پوشانی دوباره جمع نمی‌شود.",
    ],
    [
      "founder",
      "استقلال بنیان‌گذار",
      5,
      founder,
      "استقلال و وابستگی شناسنامه فرآیندهای مرتبط",
    ],
    [
      "finance",
      "ظرفیت مالی",
      5,
      financial,
      "ضعیف‌ترین ارزیابی کیفی ثبت‌شده؛ نبود داده ناشناخته است.",
    ],
    [
      "data",
      "آمادگی اندازه‌گیری",
      5,
      e.depth ? (c.sourceType === "management" ? 50 : 75) : null,
      "قابلیت ردیابی به سابقه اندازه‌گیری؛ اظهار مدیریت محدودتر است. تعداد دوره‌ها فقط در تکرارپذیری امتیاز می‌گیرد.",
    ],
  ];
  const components: M.ReadinessComponent[] = values.map(
    ([key, label, weight, value, evidence]) => ({
      key,
      label,
      weight,
      value,
      evidence,
    }),
  );
  const coverage = components.reduce(
    (v, p) => v + (p.value === null ? 0 : p.weight),
    0,
  );
  const score = coverage
    ? Math.round(
        components.reduce((v, p) => v + (p.value ?? 0) * p.weight, 0) /
          coverage,
      )
    : null;
  const risks: M.ScaleCapacityRisk[] = plan
    .filter(
      (a) => (a.gap ?? 0) > 0 || a.status === "overloaded" || a.criticalRoleGap,
    )
    .map((a) => ({
      area: a.name,
      severity: (a.gap ?? 0) > 0 ? "critical" : "high",
      currentCapacity: a.currentCapacity,
      requiredCapacity: a.required,
      gap: a.gap,
      evidence: `${a.basis}؛ ${a.source}؛ واحد ${a.unit} / ${a.period}`,
      relatedProcessId: a.processId,
      ownerRoleId: a.ownerRoleId,
      recommendedPreparation: a.action || "ظرفیت یا بار این حوزه بازبینی شود.",
    }));
  for (const p of linked) {
    if (p.health !== null && p.health < 65)
      risks.push({
        area: `فرآیند: ${p.title}`,
        severity: "high",
        currentCapacity: null,
        requiredCapacity: null,
        gap: null,
        evidence: `سلامت ${p.health}؛ ${p.reasons.join("، ")}`,
        relatedProcessId: p.id,
        ownerRoleId: p.ownerRoleId ?? "",
        recommendedPreparation: "استاندارد، پذیرش و KPI فرآیند تقویت شود.",
      });
    if (
      ["high", "critical"].includes(p.founderDependency) ||
      (p.independence !== null && p.independence < 50)
    )
      risks.push({
        area: `بنیان‌گذار: ${p.title}`,
        severity: "high",
        currentCapacity: null,
        requiredCapacity: null,
        gap: null,
        evidence: `استقلال ${p.independence ?? "نامشخص"}؛ وابستگی ${{ none: "بدون وابستگی ثبت‌شده", low: "پایین", medium: "متوسط", high: "بالا", critical: "بحرانی" }[p.founderDependency]}؛ افزایش بار ممکن است وابستگی را تشدید کند.`,
        relatedProcessId: p.id,
        ownerRoleId: p.ownerRoleId ?? "",
        recommendedPreparation: "تفویض اختیار و اجرای مستقل آزموده شود.",
      });
  }
  if (financial !== null && financial < 50)
    risks.push({
      area: "ظرفیت مالی",
      severity: financial < 25 ? "critical" : "high",
      currentCapacity: null,
      requiredCapacity: null,
      gap: null,
      evidence: finance
        .map((f) => `${M.financeTypes[f.kind]}: ${f.evidence}`)
        .join("؛ "),
      relatedProcessId: "",
      ownerRoleId: c.ownerRoleId,
      recommendedPreparation: "سرمایه در گردش و تعهدات تأمین بررسی شود.",
    });
  const calculatedConfidence = readinessConfidence(
      coverage,
      e.depth,
      [e.value, sales, delivery, financial, process].filter((v) => v !== null)
        .length,
    ),
    confidence =
      c.sourceType === "management" && calculatedConfidence === "high"
        ? "medium"
        : calculatedConfidence,
    rawGate = scaleGate(score, coverage, e.value, risks, financial),
    gate =
      rawGate === "ready" &&
      (!hasOwner ||
        !scenario ||
        !completenessParts.system ||
        [sales, delivery, team, process, founder].some((v) => v === null))
        ? "insufficient"
        : rawGate,
    preparation = preparationProgress(
      d.preparation.filter((p) => p.candidateId === c.id),
    );
  return {
    score,
    coverage,
    components,
    completeness,
    completenessParts,
    confidence,
    gate,
    evidence: e,
    repeatability: repeat,
    plan,
    requirements: req,
    risks,
    primary: identifyPrimaryBreakpoint(risks),
    next: identifyPotentialNextConstraint(risks),
    preparation,
    matrix: growthCapacityMatrixPosition(
      e.value,
      [sales, delivery, team].every((v) => v !== null)
        ? mean([sales, delivery, team])
        : null,
    ),
    linkedProcesses: linked,
    financial,
    readinessLabel:
      score === null
        ? "نامشخص"
        : score < 40
          ? "آماده نیست"
          : score < 60
            ? "ابتدا آماده‌سازی"
            : score < 75
              ? "مشروط"
              : score < 90
                ? "آماده"
                : "آمادگی بالا",
  };
}
export type Assessment = ReturnType<typeof scaleReadiness>;
export function scaleNeedsAttention(a: Assessment, c: M.ScaleCandidate) {
  const out: string[] = [];
  if (a.financial === null) out.push("ظرفیت مالی نامشخص است.");
  if (a.evidence.value !== null && a.evidence.value >= 65 && a.risks.length)
    out.push("شواهد رشد مثبت است اما سازمان محدودیت ظرفیت دارد.");
  if (a.preparation.blocked) out.push("اقدام آماده‌سازی مسدود وجود دارد.");
  if (c.status === "scaling" && a.gate !== "ready")
    out.push("مقیاس‌دهی در جریان است اما دروازه تحلیلی آماده نیست.");
  if (a.next)
    out.push(`با رفع محدودیت اول، «${a.next.area}» ممکن است گلوگاه بعدی شود.`);
  return [...out, ...a.risks.map((r) => `${r.area}: ${r.evidence}`)];
}
