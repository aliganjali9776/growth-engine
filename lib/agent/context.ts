import { readScaleSources } from "../scale/sources";
import { parseScale } from "../scale/persistence";
import { SCALE_KEY } from "../scale/model";
import { getScaleDashboard } from "../scale/dashboard/selectors";
import { parseStrategy, STRATEGY_KEY, todayTehran } from "../strategy/model";
import { getStrategyDashboard } from "../strategy/dashboard/selectors";
import { calculateKRStatus } from "../strategy/kr/calculations";
import { readSystemReport } from "./selectors";
import type {
  AgentContextPacket,
  AgentEntityRef,
  AgentEvidence,
  BusinessContextSnapshot,
  Domain,
} from "./types";
export const compactText = (value: unknown) =>
  String(value ?? "نامشخص").slice(0, 400);
export interface EntitySnapshot {
  ref: AgentEntityRef;
  state: Record<string, unknown>;
}
export interface AgentReadContext {
  reads?: Record<string, unknown>;
  snapshot: BusinessContextSnapshot;
  evidence: AgentEvidence[];
  entities: EntitySnapshot[];
  notices: string[];
  signals: {
    strongGrowth: boolean;
    capacityRisk: boolean;
    linkedChain: string[];
    missingEvidence: boolean;
  };
}
export function readBusinessContext(
  storage: Pick<Storage, "getItem">,
  generatedAt = new Date().toISOString(),
): AgentReadContext {
  const sources = readScaleSources(storage),
    notices = [...sources.notices],
    day = todayTehran();
  let scale: ReturnType<typeof parseScale> | null = null,
    strategy: ReturnType<typeof parseStrategy> | null = null;
  for (const [key, parse, set] of [
    [
      SCALE_KEY,
      parseScale,
      (x: unknown) => {
        scale = x as ReturnType<typeof parseScale>;
      },
    ],
    [
      STRATEGY_KEY,
      parseStrategy,
      (x: unknown) => {
        strategy = x as ReturnType<typeof parseStrategy>;
      },
    ],
  ] as const) {
    try {
      const raw = storage.getItem(key);
      if (raw) set(parse(raw));
    } catch {
      notices.push("منبع محلی قابل خواندن نیست؛ داده ناشناخته است.");
    }
  }
  const sc = scale as ReturnType<typeof parseScale> | null,
    st = strategy as ReturnType<typeof parseStrategy> | null;
  const sd = sc ? getScaleDashboard(sc, sources, { today: day }) : null;
  const systemReport = readSystemReport(storage, day);
  // Do not substitute an old cycle for the active cycle in the agent's current context.
  const td =
    st && sources.activeCycle
      ? getStrategyDashboard(st, sources.roles, day, {
          cycleId: sources.activeCycle.id,
        })
      : null;
  const entities: EntitySnapshot[] = [];
  function entity(
    domain: Domain,
    entityType: string,
    id: string,
    label: string,
    route: string,
    state: Record<string, unknown>,
  ) {
    const ref = {
      domain,
      entityType,
      entityId: id,
      label: compactText(label),
      route,
    };
    entities.push({ ref, state });
    return ref;
  }
  sources.processes.forEach((p) =>
    entity(
      "System",
      "process",
      p.id,
      p.name,
      `/system/processes/${encodeURIComponent(p.id)}`,
      {
        ownerRoleId: p.ownerRoleId,
        founderDependency: p.founderDependency,
        status: p.status,
      },
    ),
  );
  sources.objectives.forEach((o) =>
    entity(
      "Strategy",
      "objective",
      o.id,
      o.title,
      `/strategy/cycles/${encodeURIComponent(o.cycleId)}/objectives/${encodeURIComponent(o.id)}`,
      { status: o.status, cycleId: o.cycleId },
    ),
  );
  sources.keyResults.forEach((k) =>
    entity(
      "Strategy",
      "KR",
      k.id,
      k.title,
      `/strategy/key-results?kr=${encodeURIComponent(k.id)}`,
      {
        targetValue: k.targetValue,
        startValue: k.startValue,
        currentValue: k.currentValue,
        lifecycle: k.lifecycle,
        updatedAt: k.updatedAt,
        objectiveId: k.objectiveId,
        type: k.type,
      },
    ),
  );
  sc?.constraints.forEach((c) =>
    entity("Scale", "constraint", c.id, c.title, "/scale/constraints", {
      status: c.status,
      primaryConstraintId: sc.primaryConstraintId,
      updatedAt: c.updatedAt,
    }),
  );
  sc?.experimentData?.experiments.forEach((e) =>
    entity(
      "Scale",
      "experiment",
      e.id,
      e.title,
      `/scale/experiments/${encodeURIComponent(e.id)}`,
      {
        status: e.status,
        updatedAt: e.updatedAt,
        constraintId: e.constraintId,
      },
    ),
  );
  sc?.readinessData?.candidates.forEach((c) =>
    entity(
      "Scale",
      "candidate",
      c.id,
      c.name,
      `/scale/readiness/${encodeURIComponent(c.id)}`,
      { status: c.status },
    ),
  );
  const evidence: AgentEvidence[] = [];
  function add(
    domain: Domain,
    key: string,
    title: string,
    value: unknown,
    route: string,
    sourceSelector: string,
    evidenceType: AgentEvidence["evidenceType"] = "Metric",
    ref?: AgentEntityRef,
  ) {
    evidence.push({
      id: `${generatedAt}:${domain}:${key}`,
      domain,
      title: compactText(title),
      summary: compactText(
        typeof value === "object" ? JSON.stringify(value) : value,
      ),
      value: structuredClone(value),
      sourceSelector,
      route,
      evidenceType,
      entityRef: ref,
      createdAt: generatedAt,
      confidence: value == null ? "Low" : "Medium",
    });
  }
  const knownHealth = sources.capacity
    .map((p) => p.health)
    .filter((n): n is number => n !== null);
  const snapshot: BusinessContextSnapshot = {
    generatedAt,
    System: {
      health: systemReport?.health.score ?? null,
      criticalProcesses: sources.capacity.filter((p) => p.critical).length,
      founderDependency: sources.capacity.filter((p) =>
        ["high", "critical"].includes(p.founderDependency),
      ).length,
      ownershipRisks: sources.independence30.filter((p) => !p.ownerReliable)
        .length,
    },
    Strategy: {
      activeCycleId: sources.activeCycle?.id ?? null,
      health: td?.health.score ?? null,
      objectives: td?.rows.length ?? 0,
      krRisks: td?.risks.length ?? 0,
      focus: td?.focus?.title ?? "دوره فعال وجود ندارد",
    },
    Scale: {
      health: sd?.health.score ?? null,
      primaryConstraint: sd?.constraint.primary?.title ?? "نامشخص",
      experiments: sc?.experimentData?.experiments.length ?? 0,
      candidates: sd?.candidates.length ?? 0,
      capacityRisks: sd?.capacity.risks.length ?? 0,
      funnel: sd?.funnel.funnel?.name ?? "نامشخص",
    },
  };
  add(
    "System",
    "health",
    "سلامت سیستم",
    snapshot.System.health,
    "/system/command-center",
    "commandReport → aggregateHealth",
  );
  sources.capacity
    .filter((p) => p.risk || p.critical)
    .slice(0, 5)
    .forEach((p) =>
      add(
        "System",
        p.id,
        p.title,
        {
          health: p.health,
          independence: p.independence,
          founderDependency: p.founderDependency,
          reasons: p.reasons.slice(0, 3),
        },
        `/system/processes/${encodeURIComponent(p.id)}`,
        "readScaleSources → processHealth",
        "Process",
        entities.find(
          (e) => e.ref.entityId === p.id && e.ref.domain === "System",
        )?.ref,
      ),
    );
  add(
    "Strategy",
    "health",
    sources.activeCycle ? "سلامت دوره فعال" : "دوره فعال موجود نیست",
    snapshot.Strategy.health,
    "/strategy/dashboard",
    "getStrategyDashboard",
  );
  (td?.risks ?? [])
    .slice(0, 5)
    .forEach((r) =>
      add(
        "Strategy",
        r.id,
        r.title,
        r.description,
        r.destination,
        "getStrategyRisks",
        "Risk",
        entities.find(
          (e) => e.ref.entityId === (r.keyResultId ?? r.objectiveId),
        )?.ref,
      ),
    );
  sources.keyResults
    .filter((k) =>
      ["offTrack", "atRisk"].includes(calculateKRStatus(k, day).status ?? ""),
    )
    .slice(0, 3)
    .forEach((k) =>
      add(
        "Strategy",
        k.id,
        k.title,
        {
          status: calculateKRStatus(k, day).status,
          target: k.targetValue,
          current: k.currentValue,
          weight: k.weight,
        },
        `/strategy/key-results?kr=${encodeURIComponent(k.id)}`,
        "calculateKRStatus",
        "Status",
        entities.find(
          (e) => e.ref.entityType === "KR" && e.ref.entityId === k.id,
        )?.ref,
      ),
    );
  add(
    "Scale",
    "health",
    "سلامت رشد",
    snapshot.Scale.health,
    "/scale/dashboard",
    "getScaleHealth",
  );
  if (sd?.constraint.primary)
    add(
      "Scale",
      "constraint",
      sd.constraint.primary.title,
      sd.constraint.primary.status,
      "/scale/constraints",
      "getConstraintSummary",
      "Constraint",
      entities.find(
        (e) =>
          e.ref.entityType === "constraint" &&
          e.ref.entityId === sd.constraint.primary?.id,
      )?.ref,
    );
  (sd?.capacity.risks ?? [])
    .slice(0, 3)
    .forEach((r, i) =>
      add(
        "Scale",
        `capacity-${i}`,
        r.area,
        { gap: r.gap, severity: r.severity },
        `/scale/readiness/${encodeURIComponent(r.candidate.id)}`,
        "getCapacityExecutiveSummary",
        "Capacity",
        entities.find(
          (e) =>
            e.ref.entityType === "candidate" &&
            e.ref.entityId === r.candidate.id,
        )?.ref,
      ),
    );
  (sc?.experimentData?.experiments ?? [])
    .filter((e) => e.status === "completed")
    .slice(-3)
    .forEach((e) =>
      add(
        "Scale",
        e.id,
        e.title,
        { result: e.resultStatus, rationale: compactText(e.resultRationale) },
        `/scale/experiments/${encodeURIComponent(e.id)}`,
        "experimentData",
        "HistoricalRecord",
        entities.find(
          (x) => x.ref.entityType === "experiment" && x.ref.entityId === e.id,
        )?.ref,
      ),
    );
  (sc?.experimentData?.learnings ?? [])
    .slice(-3)
    .forEach((l) =>
      add(
        "Scale",
        `learning-${l.id}`,
        "یادگیری ثبت‌شده",
        {
          statement: compactText(l.statement),
          evidence: compactText(l.evidence),
        },
        "/scale/learnings",
        "experimentData.learnings",
        "Learning",
      ),
    );
  add(
    "Scale",
    "funnel",
    "قیف منتخب",
    snapshot.Scale.funnel,
    "/scale/funnel",
    "getFunnelExecutiveSummary",
    "Status",
  );
  add(
    "Scale",
    "channels",
    "کانال‌های فعال",
    sd?.channels.active ?? null,
    "/scale/channels",
    "getChannelPortfolioSummary",
  );
  add(
    "Scale",
    "evidence",
    "بلوغ شواهد رشد",
    sd?.evidence.state ?? null,
    "/scale/reports",
    "getScaleEvidence",
    "Status",
  );
  let linkedChain: string[] = [];
  for (const c of sc?.constraints ?? []) {
    const k = sources.keyResults.find(
      (k) =>
        k.id === c.linkedStrategyKRId &&
        k.weight != null &&
        k.weight >= 20 &&
        calculateKRStatus(k, day).status === "offTrack",
    );
    const p = sources.capacity.find(
      (p) =>
        p.id === c.linkedSystemProcessId &&
        ["high", "critical"].includes(p.founderDependency),
    );
    const e = sc?.experimentData?.experiments.find(
      (e) =>
        e.constraintId === c.id &&
        e.status === "completed" &&
        ["win", "partial"].includes(e.resultStatus ?? ""),
    );
    if (k && p && e) {
      const refs = [k.id, c.id, e.id, p.id];
      for (const id of refs) {
        const ref = entities.find((x) => x.ref.entityId === id)?.ref;
        if (ref && !evidence.some((x) => x.entityRef?.entityId === id))
          add(
            ref.domain,
            `link-${id}`,
            ref.label ?? id,
            "پیوند ثبت‌شده میان موجودیت‌ها",
            ref.route ?? "/",
            "entity relationships",
            "Relationship",
            ref,
          );
      }
      linkedChain = evidence
        .filter((x) => refs.includes(x.entityRef?.entityId ?? ""))
        .map((x) => x.id);
      break;
    }
  }
  const reads: Record<string, unknown> = {
    ...Object.fromEntries(
      (systemReport?.rows ?? []).map((r) => [
        `system.getProcessKPIs:${r.process.id}`,
        r.kpis
          .slice(0, 5)
          .map((k) => ({ id: k.k.id, score: k.score, trend: k.trend })),
      ]),
    ),
    "system.getHealth": snapshot.System,
    "system.getCriticalProcesses": sources.capacity
      .filter((p) => p.critical)
      .slice(0, 5),
    "system.getFounderDependency": sources.capacity
      .filter((p) => ["high", "critical"].includes(p.founderDependency))
      .slice(0, 5),
    "strategy.getHealth": snapshot.Strategy,
    "strategy.getCurrentCycle": sources.activeCycle
      ? {
          id: sources.activeCycle.id,
          name: compactText(sources.activeCycle.name),
          status: sources.activeCycle.status,
        }
      : null,
    "strategy.getObjectives": sources.objectives
      .filter((o) => o.cycleId === sources.activeCycle?.id)
      .slice(0, 5)
      .map((o) => ({
        id: o.id,
        title: compactText(o.title),
        status: o.status,
      })),
    "strategy.getAtRiskKRs": sources.keyResults
      .filter(
        (k) =>
          k.cycleId === sources.activeCycle?.id &&
          ["offTrack", "atRisk"].includes(
            calculateKRStatus(k, day).status ?? "",
          ),
      )
      .slice(0, 5)
      .map((k) => ({
        id: k.id,
        title: compactText(k.title),
        status: calculateKRStatus(k, day).status,
        weight: k.weight,
      })),
    "strategy.getWeeklyTrend":
      td?.trend
        .slice(-3)
        .map((t) => ({
          weekNumber: t.weekNumber,
          date: t.date,
          progress: t.overallProgress,
          confidence: t.averageConfidence,
          mainRisk: compactText(t.mainRisk),
        })) ?? [],
    "strategy.getManagementAttention":
      td?.risks.slice(0, 3).map((r) => ({
        title: compactText(r.title),
        severity: r.severity,
        route: r.destination,
      })) ?? [],
    "scale.getHealth": snapshot.Scale,
    "scale.getPrimaryConstraint": sd?.constraint.primary
      ? {
          id: sd.constraint.primary.id,
          title: compactText(sd.constraint.primary.title),
          status: sd.constraint.primary.status,
        }
      : null,
    "scale.getExperiments":
      sc?.experimentData?.experiments.slice(-3).map((e) => ({
        id: e.id,
        title: compactText(e.title),
        status: e.status,
        result: e.resultStatus,
      })) ?? [],
    "scale.getFunnelSummary": {
      name: snapshot.Scale.funnel,
      period: sd?.funnel.period?.id ?? null,
    },
    "scale.getChannelSummary":
      sd?.channels.rows.slice(0, 3).map((r) => ({
        id: r.channel.id,
        name: compactText(r.channel.name),
        maturity: r.channel.maturity,
      })) ?? [],
    "scale.getScaleCandidates":
      sd?.candidates.slice(0, 3).map((c) => ({
        id: c.candidate.id,
        name: compactText(c.candidate.name),
        score: c.assessment.score,
        gate: c.assessment.gate,
      })) ?? [],
    "scale.getCapacityRisks":
      sd?.capacity.risks.slice(0, 3).map((r) => ({
        area: compactText(r.area),
        severity: r.severity,
        gap: r.gap,
      })) ?? [],
    "executive.get3SSummary": snapshot,
  };
  return {
    reads,
    snapshot,
    evidence,
    entities,
    notices,
    signals: {
      strongGrowth:
        !!sd && ["strong", "repeatable"].includes(sd.evidence.state),
      capacityRisk: !!sd?.capacity.risks.length,
      linkedChain,
      missingEvidence:
        !sd ||
        sd.evidence.state === "insufficient" ||
        sd.candidates.some((c) => c.assessment.gate === "insufficient"),
    },
  };
}
export function buildContextPacket(
  context: AgentReadContext,
  topic = "Executive3S",
  selected?: AgentEntityRef,
): AgentContextPacket {
  const ev = (
    selected
      ? context.evidence.filter(
          (e) =>
            e.entityRef?.domain === selected.domain &&
            e.entityRef.entityId === selected.entityId,
        )
      : context.evidence
  ).slice(0, 24);
  return {
    topic,
    entities: [
      ...(selected ? [selected] : []),
      ...ev.flatMap((e) => (e.entityRef ? [e.entityRef] : [])),
    ]
      .filter(
        (x, i, a) =>
          a.findIndex(
            (y) =>
              y.domain === x.domain &&
              y.entityType === x.entityType &&
              y.entityId === x.entityId,
          ) === i,
      )
      .slice(0, 12),
    metrics: ev.filter((e) => e.evidenceType === "Metric"),
    risks: ev.filter((e) => ["Risk", "Capacity"].includes(e.evidenceType)),
    evidence: structuredClone(ev),
    historySummary: ev
      .filter((e) => ["Learning", "HistoricalRecord"].includes(e.evidenceType))
      .slice(-3)
      .map((e) => e.summary),
    generatedAt: context.snapshot.generatedAt,
  };
}
