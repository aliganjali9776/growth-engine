import { readScaleSources } from "../../scale/sources";
import { parseScale } from "../../scale/persistence";
import { SCALE_KEY } from "../../scale/model";
import { getScaleDashboard } from "../../scale/dashboard/selectors";
import { parseStrategy, STRATEGY_KEY } from "../../strategy/model";
import { tehranDay } from "../../scale/experiments/logic";
import {
  calculateKRStatus,
  calculateKRProgress,
} from "../../strategy/kr/calculations";
import {
  initiativeKRSignals,
  ownerInitiativeLoad,
} from "../../strategy/initiatives/report";
import { readSystemReport } from "../selectors";
import type { AgentEntityRef, AgentEvidence, Domain, Risk } from "../types";
import type { AgentSignal, SignalInput, SignalType, Confidence } from "./types";

import { fingerprint } from "./identity";
export { fingerprint } from "./identity";
import { diagnosisContextVersion } from "./freshness";
export function collectDiagnosisSignals(
  storage: Pick<Storage, "getItem">,
  at = new Date().toISOString(),
): SignalInput {
  const day = tehranDay(new Date(at)),
    cache = new Map<string, string | null>();
  const reader = {
    getItem(key: string) {
      if (!cache.has(key)) cache.set(key, storage.getItem(key));
      return cache.get(key) ?? null;
    },
  };
  const notices: string[] = [],
    availableKeys: string[] = [];
  function read<T>(key: string, parse: (raw: string) => T): T | null {
    try {
      const raw = reader.getItem(key);
      if (!raw) return null;
      const data = parse(raw);
      availableKeys.push(key);
      return data;
    } catch {
      notices.push("منبع محلی قابل خواندن نیست: " + key);
      return null;
    }
  }
  const st = read(STRATEGY_KEY, parseStrategy),
    sc = read(SCALE_KEY, parseScale);
  const sources = readScaleSources(reader),
    system = readSystemReport(reader, day);
  const systemKey = "growth-engine.system.v1";
  if (system) availableKeys.push(systemKey);
  const sd = sc ? getScaleDashboard(sc, sources, { today: day }) : null;
  const signals: AgentSignal[] = [],
    evidence: AgentEvidence[] = [],
    projections: unknown[] = [];
  const ref = (
    domain: Domain,
    entityType: string,
    entityId: string,
    label: string,
    route: string,
  ): AgentEntityRef => ({ domain, entityType, entityId, label, route });
  function add(
    type: SignalType,
    domain: Domain,
    sourceKey: string,
    family: string,
    key: string,
    title: string,
    value: unknown,
    refs: AgentEntityRef[],
    severity: Risk = "Medium",
    confidence: Confidence = "Medium",
    selector = family,
  ) {
    const fp = `${type}:${family}:${key}`,
      evId = "e-" + fingerprint([family, key, value]);
    const description =
      typeof value === "string" ? value : JSON.stringify(value);
    evidence.push({
      id: evId,
      domain,
      entityRef: refs[0],
      evidenceType:
        type === "Capacity" ? "Capacity" : type === "Risk" ? "Risk" : "Status",
      title,
      summary: description,
      value: structuredClone(value),
      route: refs[0]?.route,
      sourceSelector: selector,
      confidence,
      createdAt: at,
      timestamp: at,
    });
    signals.push({
      id: "s-" + fingerprint(fp),
      type,
      domain,
      title,
      description,
      severity,
      confidence,
      sourceKey,
      sourceFamily: family,
      entityRefs: refs,
      evidenceIds: [evId],
      detectedAt: at,
      lastSeenAt: at,
      fingerprint: fp,
      status: "Active",
    });
  }
  const processRefs = new Map(
    sources.processes.map((p) => [
      p.id,
      ref(
        "System",
        "process",
        p.id,
        p.name,
        "/system/processes/" + encodeURIComponent(p.id),
      ),
    ]),
  );
  const processRisk = new Map(sources.capacity.map((p) => [p.id, p]));
  const adoptionRisk = new Set(
    system?.risks
      .filter((r) => r.type === "adoption")
      .map((r) => r.processId) ?? [],
  );
  for (const p of sources.capacity) {
    projections.push(["process", p]);
    const r = processRefs.get(p.id)!;
    if (p.risk)
      add(
        "Risk",
        "System",
        systemKey,
        "process-health",
        p.id,
        p.title,
        { health: p.health, independence: p.independence, reasons: p.reasons },
        [r],
        "High",
        p.health === null ? "Low" : "Medium",
        "readScaleSources → processHealth",
      );
    if (["high", "critical"].includes(p.founderDependency))
      add(
        "Dependency",
        "System",
        systemKey,
        "founder",
        p.id,
        "وابستگی به بنیان‌گذار: " + p.title,
        p.founderDependency,
        [r],
        "High",
        "High",
        "readScaleSources",
      );
    const independence = sources.independence30.find(
      (x) => x.processId === p.id,
    );
    if (
      independence &&
      (!independence.ownerReliable ||
        !independence.sopApproved ||
        adoptionRisk.has(p.id))
    )
      add(
        "Execution",
        "System",
        systemKey,
        "process-readiness",
        p.id,
        "آمادگی اجرای فرآیند",
        {
          ownerReliable: independence.ownerReliable,
          sopApproved: independence.sopApproved,
          adoption: p.adoption,
        },
        [r],
        "Medium",
        "Medium",
        "independenceTest",
      );
  }
  const active = sources.activeCycle?.id;
  const krs = new Map(
    (st?.keyResults ?? [])
      .filter((k) => k.cycleId === active && k.lifecycle === "active")
      .map((k) => [k.id, k]),
  );
  const krRefs = new Map(
    [...krs.values()].map((k) => [
      k.id,
      ref(
        "Strategy",
        "KR",
        k.id,
        k.title,
        "/strategy/key-results?kr=" + encodeURIComponent(k.id),
      ),
    ]),
  );
  for (const k of krs.values()) {
    const pacing = calculateKRStatus(k, day);
    projections.push([
      "KR",
      k.id,
      k.updatedAt,
      k.currentValue,
      k.confidence,
      pacing,
    ]);
    const r = krRefs.get(k.id)!;
    if (pacing.stale || k.confidence == null)
      add(
        "DataQuality",
        "Strategy",
        STRATEGY_KEY,
        "KR-quality",
        k.id,
        "شواهد نتیجه کلیدی نیازمند تازه‌سازی است",
        {
          stale: pacing.stale,
          confidence: k.confidence,
          current: k.currentValue,
        },
        [r],
        "Medium",
        "Low",
        "calculateKRStatus",
      );
    else if (["offTrack", "atRisk"].includes(pacing.status ?? ""))
      add(
        "Performance",
        "Strategy",
        STRATEGY_KEY,
        "KR-progress",
        k.id,
        k.title,
        {
          status: pacing.status,
          progress: calculateKRProgress(k),
          current: k.currentValue,
          target: k.targetValue,
          overdue: pacing.overdue,
        },
        [r],
        pacing.status === "offTrack" ? "High" : "Medium",
        "Medium",
        "calculateKRStatus",
      );
  }
  const initiatives = (st?.initiatives ?? []).filter(
    (i) => i.cycleId === active,
  );
  for (const i of initiatives) {
    projections.push([
      "initiative",
      i.id,
      i.updatedAt,
      i.status,
      i.progress,
      i.blockedReason,
    ]);
    const k = krRefs.get(i.keyResultId),
      r = ref(
        "Strategy",
        "initiative",
        i.id,
        i.title,
        "/strategy/initiatives/" + encodeURIComponent(i.id),
      );
    if (st && k)
      for (const f of initiativeKRSignals(i, st, day).filter(
        (f) => f.id.startsWith("gap-") || f.id.startsWith("unchanged-"),
      ))
        add(
          "Contradiction",
          "Strategy",
          STRATEGY_KEY,
          "execution-result",
          i.id,
          f.text,
          {
            execution: i.progress,
            KR: calculateKRProgress(krs.get(i.keyResultId)!),
            finding: f.text,
          },
          [r, k],
          "High",
          "Medium",
          "initiativeKRSignals",
        );
  }
  const overloaded = new Set(
    ownerInitiativeLoad(initiatives)
      .filter((x) => x.overloaded)
      .map((x) => x.ownerRoleId),
  );
  for (const k of krs.values())
    if (overloaded.has(k.ownerRoleId))
      add(
        "Capacity",
        "Strategy",
        STRATEGY_KEY,
        "owner-load",
        k.id,
        "تمرکز اجرا روی مالک نتیجه کلیدی",
        { ownerRoleId: k.ownerRoleId },
        [krRefs.get(k.id)!],
        "High",
        "Medium",
        "ownerInitiativeLoad",
      );
  for (const c of sc?.constraints ?? []) {
    projections.push([
      "constraint",
      c.id,
      c.updatedAt,
      c.status,
      c.linkedStrategyKRId,
      c.linkedSystemProcessId,
    ]);
    if (!["active", "monitoring"].includes(c.status)) continue;
    const r = ref("Scale", "constraint", c.id, c.title, "/scale/constraints");
    const links = [
      r,
      krRefs.get(c.linkedStrategyKRId),
      processRefs.get(c.linkedSystemProcessId),
    ].filter((x): x is AgentEntityRef => !!x);
    add(
      "Risk",
      "Scale",
      SCALE_KEY,
      "constraint",
      c.id,
      c.title,
      c.status,
      links,
      "High",
      "Medium",
      "getConstraintSummary",
    );
    const fl = sc?.funnelData?.links.filter(
      (l) =>
        l.kind === "constraint" &&
        l.entityId === c.id &&
        l.stageId === sd?.funnel.constraint?.row.stage.id,
    );
    if (fl?.length && sd?.funnel.constraint)
      add(
        "Performance",
        "Scale",
        SCALE_KEY,
        "funnel",
        c.id,
        "گلوگاه قیف مرتبط",
        sd.funnel.constraint,
        links,
        "High",
        "Medium",
        "getFunnelExecutiveSummary",
      );
    for (const e of sd?.lab.portfolio.filter(
      (x) =>
        x.experiment.constraintId === c.id &&
        x.experiment.status === "completed",
    ) ?? []) {
      projections.push([
        "experiment",
        e.experiment.id,
        e.experiment.updatedAt,
        e.experiment.resultStatus,
        e.learnings.length,
        e.decisions.length,
      ]);
      const er = ref(
        "Scale",
        "experiment",
        e.experiment.id,
        e.experiment.title,
        "/scale/experiments/" + encodeURIComponent(e.experiment.id),
      );
      if (
        ["win", "partial"].includes(e.experiment.resultStatus ?? "") &&
        e.measurements.length &&
        e.learnings.length
      )
        add(
          "Opportunity",
          "Scale",
          SCALE_KEY,
          "experiment-result",
          e.experiment.id,
          "شواهد مثبت آزمایش",
          {
            result: e.experiment.resultStatus,
            learning: e.learnings.map((l) => l.statement),
          },
          [er, ...links],
          "Medium",
          "Medium",
          "getExperimentPortfolio",
        );
    }
  }
  // Historical repetition comes from frozen completed reviews, never today's mutable initiative copied into older weeks.
  const repeated = new Map<
    string,
    { reviews: Set<string>; text: string; entityId: string }
  >();
  const latestWeekly = [...(st?.strategyWeeklySnapshots ?? [])]
    .filter((s) => s.cycleId === active)
    .sort(
      (a, b) =>
        a.weekNumber - b.weekNumber || a.recordedAt.localeCompare(b.recordedAt),
    )
    .at(-1)?.reviewId;
  for (const snapshot of st?.strategyWeeklySnapshots ?? []) {
    if (snapshot.cycleId !== active) continue;
    projections.push([
      "weekly",
      snapshot.reviewId,
      snapshot.recordedAt,
      snapshot.blockers,
    ]);
    for (const blocker of snapshot.blockers) {
      if (blocker.source === "review") continue;
      const krId =
        blocker.source === "kr"
          ? blocker.entityId
          : snapshot.initiativeContext.find((i) => i.id === blocker.entityId)
              ?.keyResultId;
      if (!krId || !krRefs.has(krId)) continue;
      const normalized = blocker.text.trim().replace(/\s+/g, " "),
        id = krId + ":" + normalized;
      const item = repeated.get(id) ?? {
        reviews: new Set<string>(),
        text: normalized,
        entityId: krId,
      };
      item.reviews.add(snapshot.reviewId);
      repeated.set(id, item);
    }
  }
  for (const [id, b] of repeated)
    if (b.reviews.size >= 2 && latestWeekly && b.reviews.has(latestWeekly)) {
      const related =
        sc?.constraints.filter(
          (c) =>
            ["active", "monitoring"].includes(c.status) &&
            c.linkedStrategyKRId === b.entityId,
        ) ?? [];
      const refs = [
        krRefs.get(b.entityId)!,
        ...related.flatMap((c) =>
          processRefs.get(c.linkedSystemProcessId)
            ? [processRefs.get(c.linkedSystemProcessId)!]
            : [],
        ),
      ];
      add(
        "RepeatedIssue",
        "Strategy",
        STRATEGY_KEY,
        "repeated-blocker",
        id,
        "مانع در چند بازبینی ثبت‌شده تکرار شده است",
        { text: b.text, reviews: [...b.reviews] },
        refs,
        "High",
        "Medium",
        "strategyWeeklySnapshots.blockers",
      );
    }
  for (const c of sc?.constraints ?? []) {
    const negatives =
      sd?.lab.portfolio.filter(
        (x) =>
          x.experiment.constraintId === c.id &&
          x.experiment.status === "completed" &&
          ["negative", "noEffect"].includes(x.experiment.resultStatus ?? "") &&
          x.measurements.length &&
          x.learnings.length,
      ) ?? [];
    const leverCounts = new Map<string, number>();
    for (const x of negatives)
      if (x.experiment.leverId)
        leverCounts.set(
          x.experiment.leverId,
          (leverCounts.get(x.experiment.leverId) ?? 0) + 1,
        );
    const repeatedLevers = new Set(
      [...leverCounts].filter(([, count]) => count >= 2).map(([id]) => id),
    );
    const repeatedNegatives = negatives.filter((x) =>
      repeatedLevers.has(x.experiment.leverId),
    );
    if (
      repeatedNegatives.length >= 2 &&
      ["active", "monitoring"].includes(c.status)
    )
      add(
        "RepeatedIssue",
        "Scale",
        SCALE_KEY,
        "negative-experiments",
        c.id,
        "نتیجه غیرمثبت چند آزمایش برای یک محدودیت",
        {
          experiments: repeatedNegatives.map((x) => ({
            id: x.experiment.id,
            result: x.experiment.resultStatus,
          })),
        },
        [ref("Scale", "constraint", c.id, c.title, "/scale/constraints")],
        "Medium",
        "Medium",
        "getExperimentPortfolio",
      );
  }
  if (sd?.channels.resilience.state === "fragile" && sd.channels.scaling > 0) {
    const channel = sd.channels.rows.find(
      (x) => x.channel.id === sd.channels.concentration.channelId,
    );
    if (channel)
      add(
        "Risk",
        "Scale",
        SCALE_KEY,
        "channel-concentration",
        channel.channel.id,
        "تمرکز کانال هنگام توسعه نیازمند پایش است",
        {
          concentration: sd.channels.concentration,
          resilience: sd.channels.resilience,
        },
        [
          ref(
            "Scale",
            "channel",
            channel.channel.id,
            channel.channel.name,
            "/scale/channels/" + encodeURIComponent(channel.channel.id),
          ),
        ],
        "High",
        "Medium",
        "channelPortfolioSummary → channelResilience",
      );
  }
  for (const x of sd?.candidates ?? []) {
    const c = x.candidate,
      r = ref(
        "Scale",
        "candidate",
        c.id,
        c.name,
        "/scale/readiness/" + encodeURIComponent(c.id),
      );
    const links = [
      r,
      ...c.processIds.map((id) => processRefs.get(id)),
      krRefs.get(c.krId),
    ].filter((x): x is AgentEntityRef => !!x);
    const channel =
      x.candidate.sourceType === "channel"
        ? sd?.channels.rows.find((row) => row.channel.id === c.sourceId)
        : undefined;
    const loop =
      x.candidate.sourceType === "loop"
        ? sd?.loops.find((row) => row.loop.id === c.sourceId)
        : undefined;
    const delta = channel?.trend.qualifiedLeads ?? loop?.trend.delta ?? null;
    if (typeof delta === "number" && delta > 0)
      add(
        "Trend",
        "Scale",
        SCALE_KEY,
        "growth-volume",
        c.id,
        "افزایش حجم ثبت‌شده در منبع رشد",
        { delta, source: c.sourceType },
        links,
        "Medium",
        "Medium",
        channel ? "channelTrend" : "loopTrend",
      );
    projections.push([
      "candidate",
      c.id,
      c.updatedAt,
      c.status,
      x.scenario,
      x.assessment.score,
      x.assessment.coverage,
      x.assessment.gate,
      x.assessment.risks,
      x.aligned,
    ]);
    if (x.assessment.risks.length)
      add(
        "Capacity",
        "Scale",
        SCALE_KEY,
        "growth-capacity",
        c.id,
        "محدودیت ظرفیت رشد",
        x.assessment.risks,
        links,
        "High",
        x.assessment.confidence === "low" ? "Low" : "Medium",
        "scaleReadiness",
      );
    if (x.assessment.gate === "insufficient")
      add(
        "DataQuality",
        "Scale",
        SCALE_KEY,
        "candidate-quality",
        c.id,
        "داده آمادگی رشد ناکافی است",
        x.assessment.completeness,
        links,
        "Medium",
        "Low",
        "scaleReadiness",
      );
    if (c.status === "scaling" && !x.aligned)
      add(
        "Alignment",
        "Scale",
        SCALE_KEY,
        "growth-alignment",
        c.id,
        "تعهد رشد بدون پیوند معتبر استراتژیک",
        c.status,
        links,
        "High",
        "Medium",
        "getScaleCandidatePortfolio",
      );
    if (
      x.assessment.gate === "ready" &&
      x.aligned &&
      !x.assessment.risks.length
    )
      add(
        "Opportunity",
        "Scale",
        SCALE_KEY,
        "candidate-ready",
        c.id,
        "آمادگی رشد برای بررسی مدیریت",
        {
          gate: x.assessment.gate,
          coverage: x.assessment.coverage,
          previousScore: x.trend.at(-1)?.score ?? null,
          currentScore: x.assessment.score,
          loopStrength: loop?.strength.state ?? null,
        },
        links,
        "Medium",
        "Medium",
        "scaleReadiness",
      );
    if (c.status === "scaling" && x.assessment.gate !== "ready")
      add(
        "Contradiction",
        "Scale",
        SCALE_KEY,
        "growth-decision",
        c.id,
        "تعهد رشد با دروازه آمادگی سازگار نیست",
        { status: c.status, gate: x.assessment.gate },
        links,
        "High",
        "Medium",
        "getScaleAttention",
      );
  }
  if (
    sd?.funnel.period &&
    sd.funnel.prior &&
    sd.funnel.model &&
    sd.revenue.actual !== null
  ) {
    const previous = sd.funnel.prior.snapshot?.revenue;
    const improving = sd.funnel.rows.filter(
      (row) => row.trend !== null && row.trend > 0,
    );
    if (
      previous &&
      previous.currentRevenue !== null &&
      previous.currency === sd.funnel.model.currency &&
      sd.revenue.actual <= previous.currentRevenue &&
      improving.length
    )
      add(
        "Contradiction",
        "Scale",
        SCALE_KEY,
        "revenue-funnel",
        sd.funnel.funnel!.id,
        "بهبود تبدیل با رشد درآمد واقعی همراه نشده است",
        {
          actual: sd.revenue.actual,
          previousActual: previous.currentRevenue,
          currency: previous.currency,
          improvingStages: improving.map((row) => row.stage.name),
        },
        [
          ref(
            "Scale",
            "funnel",
            sd.funnel.funnel!.id,
            sd.funnel.funnel!.name,
            "/scale/funnel",
          ),
        ],
        "Medium",
        "Medium",
        "getFunnelExecutiveSummary → revenueHistory",
      );
  }
  projections.push([
    "funnel",
    sd?.funnel.period?.id,
    sd?.funnel.rows,
    sd?.revenue.actual,
    sd?.channels.rows.map((x) => [
      x.channel.id,
      x.channel.updatedAt,
      x.performance,
      x.trend,
    ]),
    sd?.loops.map((x) => [x.loop.id, x.strength, x.trend]),
    active,
  ]);
  return {
    signals,
    evidence,
    signature: diagnosisContextVersion(reader, at),
    availableKeys,
    notices: [...notices, ...sources.notices],
  };
}
