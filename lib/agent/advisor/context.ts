import { readBusinessContext, compactText } from "../context";
import { AgentOrchestrator } from "../orchestrator";
import { readScaleSources } from "../../scale/sources";
import { parseScale } from "../../scale/persistence";
import { SCALE_KEY } from "../../scale/model";
import { parseStrategy, STRATEGY_KEY, todayTehran } from "../../strategy/model";
import {
  calculateKRStatus,
  calculateKRProgress,
} from "../../strategy/kr/calculations";
import {
  getFunnelExecutiveSummary,
  getChannelPortfolioSummary,
} from "../../scale/dashboard/selectors";
import type {
  AgentEntityRef,
  AgentEvidence,
  AgentContextPacket,
  Domain,
} from "../types";
import {
  advisorPermissions,
  advisorReadAllowed,
  classifyIntent,
  routeSelection,
  isMutationQuestion,
} from "./policy";
import {
  AdvisorError,
  type AdvisorSelection,
  type AdvisorHistory,
} from "./types";
import { ADVISOR_LIMITS } from "./prompt";
import { validatePacket } from "./validation";
import { canonical } from "../actions";
import { fingerprint } from "../diagnosis/identity";
export function parseSelection(
  type: string | null,
  id: string | null,
): AdvisorSelection {
  if (!type) return { type: "executive" };
  if (
    ![
      "executive",
      "process",
      "objective",
      "kr",
      "constraint",
      "experiment",
    ].includes(type) ||
    (id && !/^[a-zA-Z0-9_-]{1,160}$/.test(id))
  )
    throw new AdvisorError("InvalidContext", "زمینه انتخاب‌شده معتبر نیست.");
  if (type !== "executive" && !id)
    throw new AdvisorError(
      "EntityNotFound",
      "شناسه موجودیت برای این زمینه لازم است.",
    );
  return { type: type as AdvisorSelection["type"], ...(id ? { id } : {}) };
}
export function contextFingerprint(packet: AgentContextPacket) {
  return canonical({
    topic: packet.topic,
    entities: packet.entities,
    evidence: packet.evidence.map((e) => ({
      domain: e.domain,
      entity: e.entityRef,
      type: e.evidenceType,
      title: e.title,
      value: e.value,
      summary: e.summary,
      status: e.status,
      timestamp: e.timestamp,
      selector: e.sourceSelector,
    })),
    history: packet.historySummary,
  });
}
export function buildAdvisorContext(
  storage: Pick<Storage, "getItem">,
  question: string,
  requested: AdvisorSelection,
  history: AdvisorHistory[] = [],
  generatedAt = new Date().toISOString(),
  preserveSelection = false,
) {
  const ctx = readBusinessContext(storage, generatedAt),
    orchestrator = new AgentOrchestrator(advisorPermissions),
    refs = readScaleSources(storage),
    day = todayTehran();
  function parse<T>(key: string, parser: (raw: string) => T): T | null {
    try {
      const raw = storage.getItem(key);
      return raw ? parser(raw) : null;
    } catch {
      return null;
    }
  }
  const sc = parse(SCALE_KEY, parseScale),
    st = parse(STRATEGY_KEY, parseStrategy),
    intent = classifyIntent(question, requested, history);
  let selection =
    preserveSelection || isMutationQuestion(question)
      ? requested
      : routeSelection(question, requested, history);
  const entityType = selection.type === "kr" ? "KR" : selection.type;
  if (selection.type !== "executive" && !selection.id) {
    const relevant = ctx.entities.filter(
      (e) => e.ref.entityType === entityType,
    );
    const q = question.toLowerCase();
    const named = relevant.filter(
      (e) => !!e.ref.label && q.includes(e.ref.label.toLowerCase()),
    );
    if (named.length === 1)
      selection = { ...selection, id: named[0].ref.entityId };
    else if (relevant.length === 1)
      selection = { ...selection, id: relevant[0].ref.entityId };
    else
      throw new AdvisorError(
        "EntityNotFound",
        "برای تحلیل دقیق، یک موجودیت را از انتخاب زمینه مشخص کنید.",
      );
  }
  const selected =
    selection.type === "executive"
      ? undefined
      : ctx.entities.find(
          (e) =>
            e.ref.entityType === entityType && e.ref.entityId === selection.id,
        );
  if (selection.type !== "executive" && !selected)
    throw new AdvisorError(
      "EntityNotFound",
      "موجودیت انتخاب‌شده در داده‌های فعلی پیدا نشد.",
    );
  const capabilities: string[] = [];
  function read(id: string, entityId?: string) {
    if (!advisorReadAllowed(id))
      throw new AdvisorError(
        "ReadOnly",
        "این قابلیت در مشاور فقط‌خواندنی مجاز نیست.",
      );
    const result = orchestrator.invoke(id, entityId ? { entityId } : {}, ctx);
    if (!result.success)
      throw new AdvisorError(
        result.error?.code === "EntityNotFound"
          ? "EntityNotFound"
          : "InvalidContext",
        result.error?.message ?? "خواندن زمینه ممکن نشد.",
      );
    if (!capabilities.includes(id)) capabilities.push(id);
    return result;
  }
  const ev: AgentEvidence[] = [],
    seen = new Set<string>();
  function add(
    domain: Domain,
    type: AgentEvidence["evidenceType"],
    title: string,
    value: unknown,
    sourceSelector: string,
    ref?: AgentEntityRef,
    timestamp?: string,
  ) {
    const key = domain + "|" + title + "|" + ref?.entityId;
    if (seen.has(key)) return;
    seen.add(key);
    ev.push({
      id: "ev-" + (ev.length + 1),
      domain,
      evidenceType: type,
      title: title.slice(0, 250),
      summary:
        typeof value === "object"
          ? JSON.stringify(value).slice(0, 600)
          : compactText(value),
      value: structuredClone(value),
      sourceSelector,
      entityRef: ref,
      route:
        ref?.route ??
        (domain === "System"
          ? "/system/command-center"
          : domain === "Strategy"
            ? "/strategy/dashboard"
            : "/scale/dashboard"),
      createdAt: generatedAt,
      ...(timestamp ? { timestamp } : {}),
      confidence: value === null ? "Low" : "Medium",
    });
  }
  function ref(type: string, id: string) {
    return ctx.entities.find(
      (e) => e.ref.entityType === type && e.ref.entityId === id,
    )?.ref;
  }
  const connected = new Set<string>();
  function process(id: string) {
    if (connected.has("p" + id)) return;
    connected.add("p" + id);
    const p = refs.capacity.find((p) => p.id === id),
      r = ref("process", id);
    if (!p || !r) return;
    read("system.getProcess", id);
    add(
      "System",
      "Process",
      p.title,
      {
        health: p.health,
        independence: p.independence,
        founderDependency: p.founderDependency,
        standardization: p.standardization,
        adoption: p.adoption,
        kpi: p.kpi,
        ownershipReliable:
          refs.independence30.find((x) => x.processId === id)?.ownerReliable ??
          null,
      },
      "readScaleSources.processHealth/independenceTest",
      r,
    );
  }
  function kr(id: string) {
    if (connected.has("k" + id)) return;
    connected.add("k" + id);
    const k = refs.keyResults.find((k) => k.id === id),
      r = ref("KR", id);
    if (!k || !r) return;
    read("strategy.getKR", id);
    const status = calculateKRStatus(k, day);
    add(
      "Strategy",
      "Status",
      k.title,
      {
        status: status.status,
        reason: compactText(status.reason),
        target: k.targetValue,
        baseline: k.startValue,
        current: k.currentValue,
        unit: k.unit,
        weight: k.weight,
        confidence: k.confidence,
        progress: calculateKRProgress(k),
        deadline: k.deadline,
        objectiveId: k.objectiveId,
      },
      "calculateKRStatus/calculateKRProgress",
      r,
      k.lastUpdateAt ?? k.updatedAt,
    );
    const checks = (st?.krCheckIns ?? [])
      .filter((x) => x.keyResultId === id)
      .slice(-3);
    if (checks.length)
      add(
        "Strategy",
        "Trend",
        "سه ثبت اخیر نتیجه کلیدی",
        checks.map((x) => ({
          value: x.currentValue,
          confidence: x.confidence,
          date: x.createdAt,
        })),
        "strategy.krCheckIns",
        r,
      );
  }
  function experiment(id: string) {
    if (connected.has("e" + id)) return;
    connected.add("e" + id);
    const e = sc?.experimentData?.experiments.find((e) => e.id === id),
      r = ref("experiment", id);
    if (!e || !r) return;
    read("scale.getExperiments");
    add(
      "Scale",
      "HistoricalRecord",
      e.title,
      {
        status: e.status,
        result: e.resultStatus,
        rationale: compactText(e.resultRationale),
        baseline: e.baselineValue,
        target: e.targetValue,
        minimumSuccess: e.minimumSuccessThreshold,
        constraintId: e.constraintId,
        metricId: e.primaryMetricId,
      },
      "experimentData.experiments",
      r,
      e.completedAt ?? e.updatedAt,
    );
    const measures = (sc?.experimentData?.measurements ?? [])
      .filter((m) => m.experimentId === id)
      .slice(-3);
    if (measures.length)
      add(
        "Scale",
        "Metric",
        "اندازه‌گیری‌های اخیر آزمایش",
        measures.map((m) => ({
          value: m.value,
          date: m.measurementDate,
          metricId: m.metricId,
        })),
        "experimentData.measurements",
        r,
      );
    const learn = (sc?.experimentData?.learnings ?? [])
      .filter((l) => l.experimentId === id)
      .slice(-2);
    if (learn.length)
      add(
        "Scale",
        "Learning",
        "یادگیری ثبت‌شده",
        learn.map((l) => ({
          statement: compactText(l.statement),
          evidence: compactText(l.evidence),
        })),
        "experimentData.learnings",
        r,
      );
  }
  function constraint(id: string, linked = true) {
    if (connected.has("c" + id)) return;
    connected.add("c" + id);
    const c = sc?.constraints.find((c) => c.id === id),
      r = ref("constraint", id);
    if (!c || !r) return;
    read("scale.getPrimaryConstraint");
    add(
      "Scale",
      "Constraint",
      c.title,
      {
        status: c.status,
        severity: c.severity,
        confidence: c.confidence,
        primary: sc?.primaryConstraintId === id,
        linkedKR: c.linkedStrategyKRId,
        linkedObjective: c.linkedStrategyObjectiveId,
        linkedProcess: c.linkedSystemProcessId,
      },
      "ScaleStore.constraints/getConstraintSummary",
      r,
      c.updatedAt,
    );
    if (linked) {
      if (c.linkedSystemProcessId) process(c.linkedSystemProcessId);
      if (c.linkedStrategyKRId) kr(c.linkedStrategyKRId);
      (sc?.experimentData?.experiments ?? [])
        .filter((e) => e.constraintId === id)
        .slice(-3)
        .forEach((e) => experiment(e.id));
    }
  }
  function funnel() {
    read("scale.getFunnelSummary");
    if (!sc) {
      add(
        "Scale",
        "Metric",
        "اندازه‌گیری قیف موجود نیست",
        null,
        "getFunnelExecutiveSummary",
      );
      return;
    }
    const f = getFunnelExecutiveSummary(sc, refs, { today: day });
    add(
      "Scale",
      "Status",
      "دوره منتخب قیف",
      f.period
        ? {
            name: f.funnel?.name ?? "",
            periodEnd: f.period.periodEnd,
            periodId: f.period.id,
          }
        : null,
      "getFunnelExecutiveSummary",
    );
    f.rows
      .filter((r) => r.stage.targetConversion != null || r.gap !== null)
      .slice(-4)
      .forEach((r) =>
        add(
          "Scale",
          "Metric",
          r.stage.name,
          {
            volume: r.volume,
            conversion: r.conversion,
            targetConversion: r.stage.targetConversion,
            periodEnd: f.period?.periodEnd ?? null,
          },
          "getFunnelExecutiveSummary.stageRows",
        ),
      );
  }
  if (selection.type === "kr") {
    kr(selection.id!);
    const k = refs.keyResults.find((k) => k.id === selection.id);
    sc?.constraints
      .filter(
        (c) =>
          c.linkedStrategyKRId === selection.id ||
          (!!k && c.linkedStrategyObjectiveId === k.objectiveId),
      )
      .slice(0, 2)
      .forEach((c) => constraint(c.id));
    if (
      sc?.funnelData?.links.some((l) =>
        ev.some((e) => e.entityRef?.entityId === l.entityId),
      )
    )
      funnel();
  } else if (selection.type === "objective") {
    read("strategy.getObjectives");
    const o = refs.objectives.find((o) => o.id === selection.id)!;
    add(
      "Strategy",
      "Status",
      o.title,
      { status: o.status, cycleId: o.cycleId, deadline: o.deadline },
      "StrategyStore.objectives",
      selected?.ref,
      o.updatedAt,
    );
    refs.keyResults
      .filter((k) => k.objectiveId === o.id)
      .slice(0, 4)
      .forEach((k) => kr(k.id));
    sc?.constraints
      .filter((c) => c.linkedStrategyObjectiveId === o.id)
      .slice(0, 2)
      .forEach((c) => constraint(c.id));
  } else if (selection.type === "process") {
    process(selection.id!);
    sc?.constraints
      .filter((c) => c.linkedSystemProcessId === selection.id)
      .slice(0, 2)
      .forEach((c) => constraint(c.id));
  } else if (selection.type === "constraint") {
    constraint(selection.id!);
    funnel();
  } else if (selection.type === "experiment") {
    experiment(selection.id!);
    const e = sc?.experimentData?.experiments.find(
      (e) => e.id === selection.id,
    );
    if (e?.constraintId) constraint(e.constraintId);
  } else {
    const module =
      intent === "SystemDiagnosis"
        ? "System"
        : intent === "StrategyDiagnosis"
          ? "Strategy"
          : intent === "ScaleDiagnosis"
            ? "Scale"
            : null;
    read(
      module ? module.toLowerCase() + ".getHealth" : "executive.get3SSummary",
    );
    const base = module
      ? ctx.evidence.filter((e) => e.domain === module)
      : ctx.evidence;
    // Round-robin avoids one large module crowding out the other two.
    const lists = ["System", "Strategy", "Scale"].map((d) =>
      base.filter((e) => e.domain === d),
    );
    for (let i = 0; i < 7; i++)
      for (const list of lists) {
        const e = list[i];
        if (e)
          add(
            e.domain,
            e.evidenceType,
            e.title,
            e.value ?? null,
            e.sourceSelector ?? "canonical selector",
            e.entityRef,
            e.timestamp,
          );
      }
    if (!module || module === "Scale") {
      funnel();
      read("scale.getCapacityRisks");
      const channels = sc
        ? getChannelPortfolioSummary(sc, { today: day })
        : null;
      channels?.rows.slice(0, 2).forEach((c) =>
        add(
          "Scale",
          "Metric",
          c.channel.name,
          {
            qualified: c.period?.qualifiedLeads ?? null,
            customers: c.period?.customers ?? null,
            cac: null,
            spendPerCustomer: c.performance.spendPerCustomer ?? null,
            maturity: c.channel.maturity,
          },
          "getChannelPortfolioSummary",
        ),
      );
    }
  }
  const bounded = ev
    .slice(0, ADVISOR_LIMITS.evidence)
    .map((e) => ({
      ...e,
      id:
        "ev-" +
        fingerprint([
          e.domain,
          e.entityRef,
          e.evidenceType,
          e.title,
          e.summary,
          e.value,
          e.sourceSelector,
          e.timestamp,
        ]),
    }));
  const refsInPacket = [
    ...(selected ? [selected.ref] : []),
    ...bounded.flatMap((e) => (e.entityRef ? [e.entityRef] : [])),
  ]
    .filter(
      (r, i, a) =>
        a.findIndex(
          (x) =>
            x.domain === r.domain &&
            x.entityType === r.entityType &&
            x.entityId === r.entityId,
        ) === i,
    )
    .slice(0, ADVISOR_LIMITS.entities);
  const topics: Record<string, string> = {
    executive:
      intent === "SystemDiagnosis" ||
      intent === "StrategyDiagnosis" ||
      intent === "ScaleDiagnosis"
        ? intent
        : "Executive3SContext",
    process: "SystemProcessContext",
    objective: "StrategyObjectiveContext",
    kr: "StrategyKRContext",
    constraint: "ScaleConstraintContext",
    experiment: "ScaleExperimentContext",
  };
  const packet: AgentContextPacket = {
    topic: topics[selection.type],
    entities: refsInPacket,
    evidence: bounded,
    metrics: bounded.filter((e) => e.evidenceType === "Metric"),
    risks: bounded.filter((e) => ["Risk", "Capacity"].includes(e.evidenceType)),
    historySummary: bounded
      .filter((e) =>
        ["HistoricalRecord", "Learning", "Trend"].includes(e.evidenceType),
      )
      .slice(-3)
      .map((e) => e.summary),
    generatedAt,
  };
  // Duplicate metric/risk projections can dominate bytes; shrink only by dropping least-relevant evidence.
  while (
    new TextEncoder().encode(JSON.stringify(packet)).length >
      ADVISOR_LIMITS.packetBytes &&
    packet.evidence.length > 3
  ) {
    packet.evidence.pop();
    packet.metrics = packet.evidence.filter((e) => e.evidenceType === "Metric");
    packet.risks = packet.evidence.filter((e) =>
      ["Risk", "Capacity"].includes(e.evidenceType),
    );
    packet.historySummary = packet.evidence
      .filter((e) =>
        ["HistoricalRecord", "Learning", "Trend"].includes(e.evidenceType),
      )
      .slice(-3)
      .map((e) => e.summary);
  }
  validatePacket(JSON.parse(JSON.stringify(packet)));
  return {
    packet,
    selection,
    intent,
    capabilityIds: capabilities,
    snapshot: ctx.snapshot,
    entities: ctx.entities.map((e) => e.ref),
    notices: ctx.notices,
    fingerprint: contextFingerprint(packet),
  };
}
