import type { StrategyStore, StrategyRole } from "../model";
import { objectiveMeasurement } from "../kr/report";
import { calculateKRProgress } from "../kr/calculations";
import {
  objectiveExecution,
  portfolioSummary,
  isInitiativeOverdue,
  initiativeCapacityWarnings,
  initiativeKRSignals,
} from "../initiatives/report";
import {
  getCycleWeek,
  weekPeriod,
  weeklyMomentum,
} from "../weekly/calculations";
import {
  detectStalledKRs,
  detectRepeatedBlockers,
  detectConfidenceDecline,
  completedHistory,
  cycleReviewReadiness,
  strategyChangeSummary,
} from "../adapt/report";
import { reviewDate } from "../adapt/definition";
import {
  dashboardRules as rules,
  healthLabels,
  type HealthComponent,
  type StrategyRisk,
  type ReportFilters,
} from "./types";
const mean = (xs: (number | null)[]) => {
  const known = xs.filter((x): x is number => x !== null && Number.isFinite(x));
  return known.length ? known.reduce((a, b) => a + b, 0) / known.length : null;
};
const ratio = (n: number, d: number) => (d ? (100 * n) / d : null);
const days = (a: string, b: string) =>
  Math.floor((Date.parse(b) - Date.parse(a)) / 86400000);
const objectiveLink = (cycleId: string, id: string) =>
  `/strategy/cycles/${cycleId}/objectives/${id}`;
export function getTrendEvents(store: StrategyStore, cycleId: string) {
  const cycle = store.cycles.find((c) => c.id === cycleId);
  if (!cycle) return [];
  const changes = (store.strategyChanges ?? [])
    .filter(
      (c) =>
        c.cycleId === cycleId &&
        (c.fieldChanged === "targetValue" ||
          c.entityType === "priority" ||
          (c.entityType === "initiative" && c.fieldChanged === "status")),
    )
    .map((c) => ({
      id: c.id,
      date: reviewDate(c.changedAt),
      label:
        c.fieldChanged === "targetValue"
          ? "تغییر هدف KR"
          : c.entityType === "priority"
            ? "تغییر اولویت"
            : "تغییر وضعیت اقدام",
      description: c.reason,
      destination: "/strategy/adapt/" + c.reviewId,
    }));
  const adapt = (store.adaptReviews ?? [])
    .filter((r) => r.cycleId === cycleId && r.status === "completed")
    .map((r) => ({
      id: r.id,
      date: reviewDate(r.completedAt ?? r.updatedAt),
      label: "مرور تطبیقی",
      description: r.progressSummary,
      destination: "/strategy/adapt/" + r.id,
    }));
  return [...changes, ...adapt]
    .map((e) => ({
      ...e,
      weekNumber: Math.floor(days(cycle.startDate, e.date) / 7) + 1,
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}
export function getDashboardSource(
  input: StrategyStore,
  roles: StrategyRole[],
  today: string,
  cycleId?: string,
) {
  const cycle = input.cycles.find(
    (c) =>
      c.id ===
      (cycleId ??
        input.cycles.find((c) => c.status === "active")?.id ??
        input.cycles[0]?.id),
  );
  if (!cycle) return null;
  const historical = ["completed", "archived"].includes(cycle.status),
    review = input.cycleReviews?.find(
      (r) => r.cycleId === cycle.id && r.status === "completed",
    ),
    snap = historical ? review?.snapshot : undefined,
    asOf = snap
      ? reviewDate(snap.recordedAt)
      : historical
        ? cycle.closedAt
          ? reviewDate(cycle.closedAt)
          : cycle.endDate
        : today;
  const frozenCycle = snap
    ? { ...snap.cycle, status: cycle.status, closedAt: cycle.closedAt }
    : cycle;
  const store: StrategyStore = {
    ...input,
    cycles: [frozenCycle],
    objectives:
      snap?.objectives ??
      input.objectives.filter((o) => o.cycleId === cycle.id),
    priorities:
      snap?.priorities ??
      input.priorities.filter((p) => p.cycleId === cycle.id),
    keyResults:
      snap?.keyResults ??
      input.keyResults?.filter((k) => k.cycleId === cycle.id),
    initiatives:
      snap?.initiatives ??
      input.initiatives?.filter((i) => i.cycleId === cycle.id),
    strategicAssumptions:
      snap?.assumptions ??
      input.strategicAssumptions?.filter((a) => a.cycleId === cycle.id),
    strategyLearnings:
      snap?.learnings ??
      input.strategyLearnings?.filter((l) => l.cycleId === cycle.id),
    krCheckIns:
      snap?.checkIns ?? input.krCheckIns?.filter((c) => c.cycleId === cycle.id),
  };
  return {
    store,
    roles: snap?.roles ?? roles,
    cycle: frozenCycle,
    asOf,
    historical,
    snapshot: snap,
    historySource: snap
      ? "تصویر نهایی مرور پایان دوره"
      : historical
        ? "رکوردهای دوره بسته؛ بدون تصویر نهایی"
        : "داده زنده همین دوره",
  };
}
export function getObjectiveDashboardRows(
  store: StrategyStore,
  roles: StrategyRole[],
  today: string,
) {
  return store.objectives
    .filter((o) => o.status !== "cancelled")
    .map((o) => {
      const measurement = objectiveMeasurement(store, o, roles, today),
        execution = objectiveExecution(store, o.id, today);
      return {
        ...measurement,
        execution,
        priority: store.priorities.find((p) => p.id === o.relatedPriorityId),
        owner: roles.find((r) => r.id === o.ownerRoleId),
        destination: objectiveLink(o.cycleId, o.id),
        trend: (store.objectiveWeeklySnapshots ?? [])
          .filter(
            (s) =>
              s.objectiveId === o.id &&
              store.weeklyReviews?.some(
                (r) => r.id === s.reviewId && r.status === "completed",
              ),
          )
          .sort((a, b) => a.weekNumber - b.weekNumber),
      };
    });
}
export function getAlignmentReport(
  store: StrategyStore,
  roles: StrategyRole[],
) {
  const ps = store.priorities.filter((p) => p.status === "selected"),
    os = store.objectives.filter((o) => o.status !== "cancelled"),
    ks = (store.keyResults ?? []).filter((k) => k.lifecycle === "active"),
    ins = (store.initiatives ?? []).filter((i) => i.status !== "cancelled"),
    owned = [...os, ...ks, ...ins];
  const parts = [
    {
      label: "پوشش اولویت‌ها",
      have: ps.filter((p) => os.some((o) => o.relatedPriorityId === p.id))
        .length,
      total: ps.length,
    },
    {
      label: "هدف ← اولویت",
      have: os.filter((o) =>
        store.priorities.some(
          (p) => p.id === o.relatedPriorityId && p.status === "selected",
        ),
      ).length,
      total: os.length,
    },
    {
      label: "KR ← هدف",
      have: ks.filter((k) => os.some((o) => o.id === k.objectiveId)).length,
      total: ks.length,
    },
    {
      label: "اقدام ← KR",
      have: ins.filter((i) =>
        ks.some(
          (k) => k.id === i.keyResultId && k.objectiveId === i.objectiveId,
        ),
      ).length,
      total: ins.length,
    },
    {
      label: "پوشش مالکیت",
      have: owned.filter((x) => roles.some((r) => r.id === x.ownerRoleId))
        .length,
      total: owned.length,
    },
  ];
  return {
    parts,
    score: mean(parts.map((p) => ratio(p.have, p.total))),
    priorityGaps: ps.filter(
      (p) => !os.some((o) => o.relatedPriorityId === p.id),
    ),
    objectiveGaps: os.filter((o) => !ks.some((k) => k.objectiveId === o.id)),
    objectivePriorityGaps: os.filter(
      (o) => !ps.some((p) => p.id === o.relatedPriorityId),
    ),
    krObjectiveGaps: ks.filter((k) => !os.some((o) => o.id === k.objectiveId)),
    initiativeGaps: ins.filter(
      (i) =>
        !ks.some(
          (k) => k.id === i.keyResultId && k.objectiveId === i.objectiveId,
        ),
    ),
    ownerGaps: owned.filter((x) => !roles.some((r) => r.id === x.ownerRoleId)),
    unassistedKRs: ks.filter(
      (k) =>
        calculateKRProgress(k) !== 100 &&
        k.confidence !== null &&
        k.confidence <= 3 &&
        !ins.some((i) => i.keyResultId === k.id),
    ),
  };
}
export function getReviewDiscipline(
  store: StrategyStore,
  cycleId: string,
  today: string,
) {
  const cycle = store.cycles.find((c) => c.id === cycleId)!,
    elapsed = Math.max(
      0,
      Math.min(
        days(cycle.startDate, today),
        days(cycle.startDate, cycle.endDate) + 1,
      ),
    ),
    dueWeeks =
      today > cycle.endDate ? Math.ceil(elapsed / 7) : Math.floor(elapsed / 7),
    weekly = (store.weeklyReviews ?? []).filter(
      (r) => r.cycleId === cycleId && r.status === "completed",
    ),
    dueCompleted = weekly.filter((r) => r.periodEnd < today).length,
    adapt = (store.adaptReviews ?? [])
      .filter((r) => r.cycleId === cycleId && r.status === "completed")
      .sort((a, b) => b.periodEnd.localeCompare(a.periodEnd)),
    dueAdapt = Math.floor(elapsed / rules.adaptDays),
    lastWeekly = weekly.slice().sort((a, b) => b.weekNumber - a.weekNumber)[0],
    lastAdapt = adapt[0],
    weeklyRate = dueWeeks
      ? Math.min(100, (100 * dueCompleted) / dueWeeks)
      : null,
    adaptRate = dueAdapt
      ? Math.min(100, (100 * adapt.length) / dueAdapt)
      : null;
  const final = store.cycleReviews?.find((r) => r.cycleId === cycleId);
  return {
    dueWeeks,
    completed: weekly.length,
    weeklyRate,
    averageQuality: mean(
      (store.strategyWeeklySnapshots ?? [])
        .filter((s) => weekly.some((r) => r.id === s.reviewId))
        .map((s) => s.quality),
    ),
    lastWeekly,
    lastAdapt,
    dueAdapt,
    adaptCompleted: adapt.length,
    adaptRate,
    adaptOverdue:
      dueAdapt > 0 &&
      (!lastAdapt || days(lastAdapt.periodEnd, today) > rules.adaptDays),
    weeklyOverdue: dueCompleted < dueWeeks,
    score: mean([weeklyRate, adaptRate]),
    cycleReadiness: final
      ? cycleReviewReadiness(store, final)
      : ["مرور پایان دوره هنوز آغاز نشده است."],
  };
}
export function getRecurringBlockers(
  store: StrategyStore,
  cycleId: string,
  today: string,
) {
  const history = completedHistory(store, cycleId, today),
    recurring = detectRepeatedBlockers(history),
    byKR = new Map<string, typeof history>();
  for (const row of history) {
    const group = byKR.get(row.keyResultId) ?? [];
    group.push(row);
    byKR.set(row.keyResultId, group);
  }
  const rows = [...byKR].flatMap(([id, list]) => {
    const sorted = list.sort((a, b) => b.weekNumber - a.weekNumber),
      last = sorted[0];
    if (!last.blocker.trim()) return [];
    const k = store.keyResults?.find((k) => k.id === id);
    if (
      !k ||
      k.lifecycle !== "active" ||
      !store.objectives.some(
        (o) => o.id === k.objectiveId && o.status === "active",
      )
    )
      return [];
    let count = 1;
    const norm = (s: string) =>
      s.trim().replace(/\s+/g, " ").replace(/ي/g, "ی").replace(/ك/g, "ک");
    for (let j = 1; j < sorted.length; j++) {
      if (
        sorted[j - 1].weekNumber !== sorted[j].weekNumber + 1 ||
        norm(sorted[j].blocker) !== norm(last.blocker)
      )
        break;
      count++;
    }
    return [
      {
        id: "kr-" + id,
        text: last.blocker,
        title: k.title,
        entityId: id,
        objectiveId: k.objectiveId,
        ownerRoleId: last.ownerRoleId,
        count,
        recurring: recurring.some((r) => r.keyResultId === id),
        status: "در آخرین ثبت؛ رفع آن تأیید نشده",
        date: last.periodEnd,
        destination: "/strategy/weekly-review/" + last.reviewId,
      },
    ];
  });
  for (const i of store.initiatives ?? [])
    if (i.status === "blocked" && i.blockedReason.trim())
      rows.push({
        id: "initiative-" + i.id,
        text: i.blockedReason,
        title: i.title,
        entityId: i.id,
        objectiveId: i.objectiveId,
        ownerRoleId: i.ownerRoleId,
        count: 1,
        recurring: false,
        status: "اقدام متوقف",
        date: reviewDate(i.updatedAt),
        destination: "/strategy/initiatives/" + i.id,
      });
  return rows.sort(
    (a, b) =>
      Number(b.recurring) - Number(a.recurring) ||
      b.count - a.count ||
      a.id.localeCompare(b.id),
  );
}
export function getConfidenceTrend(
  store: StrategyStore,
  cycleId: string,
  today: string,
) {
  const history = completedHistory(store, cycleId, today),
    declines = detectConfidenceDecline(history);
  return {
    declines: declines
      .map((id) => {
        const rows = history
          .filter((x) => x.keyResultId === id)
          .sort((a, b) => b.weekNumber - a.weekNumber)
          .slice(0, 3);
        return {
          id,
          from: rows.at(-1)!.confidence!,
          to: rows[0].confidence!,
          drop: rows.at(-1)!.confidence! - rows[0].confidence!,
          weeks: rows.map((x) => x.weekNumber),
        };
      })
      .sort((a, b) => b.drop - a.drop),
  };
}
export function getStrategyFreshness(
  store: StrategyStore,
  cycleId: string,
  today: string,
) {
  const cycle = store.cycles.find((c) => c.id === cycleId)!,
    week = getCycleWeek(cycle, today),
    period = week.weekNumber ? weekPeriod(cycle, week.weekNumber) : null,
    ks = (store.keyResults ?? []).filter(
      (k) =>
        k.lifecycle === "active" &&
        store.objectives.some(
          (o) => o.id === k.objectiveId && o.status === "active",
        ),
    );
  return {
    total: ks.length,
    updatedThisWeek: ks.filter(
      (k) =>
        k.lastUpdateAt &&
        reviewDate(k.lastUpdateAt) <= today &&
        period?.periodStart &&
        reviewDate(k.lastUpdateAt) >= period?.periodStart,
    ).length,
    stale: ks.filter(
      (k) =>
        !k.lastUpdateAt ||
        days(reviewDate(k.lastUpdateAt), today) > rules.staleDays,
    ),
    neverUpdated: ks.filter((k) => !k.lastUpdateAt).length,
    week,
  };
}
export function getStrategyCompleteness(
  store: StrategyStore,
  rows: ReturnType<typeof getObjectiveDashboardRows>,
  cycleId: string,
  today: string,
  roles: StrategyRole[] = [],
) {
  const ks = rows.flatMap((o) => o.rows),
    currentWeek = getCycleWeek(
      store.cycles.find((c) => c.id === cycleId)!,
      today,
    );
  const parts = [
    {
      label: "اهداف دارای KR",
      score: ratio(rows.filter((o) => o.krs.length).length, rows.length),
    },
    {
      label: "تعریف و داده KR",
      score: mean(ks.map((k) => k.completeness.score)),
    },
    {
      label: "مقدار قابل سنجش",
      score: ratio(ks.filter((k) => k.progress !== null).length, ks.length),
    },
    {
      label: "اطمینان ثبت‌شده",
      score: ratio(
        ks.filter((k) => k.kr.confidence !== null).length,
        ks.length,
      ),
    },
    {
      label: "ثبت در هفته جاری",
      score: ratio(
        ks.filter((k) =>
          store.krCheckIns?.some(
            (c) =>
              c.keyResultId === k.kr.id &&
              c.weekNumber === currentWeek.weekNumber,
          ),
        ).length,
        ks.length,
      ),
    },
    ...getAlignmentReport(store, roles)
      .parts.filter((p) => ["پوشش مالکیت", "اقدام ← KR"].includes(p.label))
      .map((p) => ({ label: p.label, score: ratio(p.have, p.total) })),
    {
      label: "سابقه مرور",
      score: (store.weeklyReviews ?? []).some(
        (r) => r.cycleId === cycleId && r.status === "completed",
      )
        ? 100
        : null,
    },
  ];
  return {
    parts,
    score: mean(parts.map((p) => p.score)),
    known: parts.filter((p) => p.score !== null).length,
    total: parts.length,
  };
}
export function getKRPerformanceSummary(
  rows: ReturnType<typeof getObjectiveDashboardRows>,
) {
  const active = rows.filter((o) => o.objective.status === "active"),
    ks = active.flatMap((o) => o.rows),
    counts = {
      achieved: 0,
      onTrack: 0,
      atRisk: 0,
      offTrack: 0,
      notStarted: 0,
      unknown: 0,
    };
  for (const r of ks) counts[r.pacing.status ?? "unknown"]++;
  return {
    total: ks.length,
    counts,
    averageProgress: mean(ks.map((k) => k.progress)),
    weightedProgress: mean(active.map((o) => o.progress)),
    knownObjectives: active.filter((o) => o.progress !== null).length,
    objectiveTotal: active.length,
  };
}
export function getInitiativeEffectivenessSummary(
  store: StrategyStore,
  today: string,
) {
  const ins = store.initiatives ?? [];
  return {
    ...portfolioSummary(ins, today),
    weak: ins.filter(
      (i) =>
        i.status !== "cancelled" &&
        ["weak", "ineffective"].includes(i.effectiveness),
    ).length,
    evaluated: ins.filter(
      (i) => i.status !== "cancelled" && i.effectiveness !== "notEvaluated",
    ).length,
    unevaluated: ins.filter(
      (i) => i.status !== "cancelled" && i.effectiveness === "notEvaluated",
    ).length,
  };
}
export function getExecutionResultAnalysis(
  rows: ReturnType<typeof getObjectiveDashboardRows>,
) {
  return rows.map((o) => ({
    id: o.objective.id,
    title: o.objective.title,
    result: o.progress,
    execution: o.execution.summary.execution,
    gap: o.execution.gap,
    interpretation: o.execution.text,
    destination: o.destination,
    quadrant:
      o.progress === null || o.execution.summary.execution === null
        ? "unknown"
        : `${o.progress >= 50 ? "high" : "low"}-${o.execution.summary.execution >= 50 ? "high" : "low"}`,
  }));
}
export function getStrategyRisks(
  store: StrategyStore,
  roles: StrategyRole[],
  today: string,
  rows: ReturnType<typeof getObjectiveDashboardRows>,
  cycleId: string,
) {
  const risks: StrategyRisk[] = [],
    confidence = getConfidenceTrend(store, cycleId, today),
    stalled = detectStalledKRs(completedHistory(store, cycleId, today)),
    blockers = getRecurringBlockers(store, cycleId, today),
    align = getAlignmentReport(store, roles),
    discipline = getReviewDiscipline(store, cycleId, today);
  function add(
    input: Omit<StrategyRisk, "rank" | "rankReasons">,
    weight = 0,
    deadline?: string,
    priority = 0,
  ) {
    const rankReasons = [
      `شدت ${input.severity === "critical" ? "بحرانی" : input.severity === "high" ? "بالا" : input.severity === "medium" ? "متوسط" : "پایین"}`,
    ];
    let rank = { critical: 400, high: 300, medium: 200, low: 100 }[
      input.severity
    ];
    if (weight >= rules.highWeight) {
      rank += 20;
      rankReasons.push("سهم KR حداقل ۲۰٪");
    }
    if (deadline && days(today, deadline) <= 7) {
      rank += 15;
      rankReasons.push("مهلت گذشته یا حداکثر هفت روز");
    }
    if (priority === 1) {
      rank += 10;
      rankReasons.push("اولویت استراتژیک اول");
    }
    if (input.type === "recurring") {
      rank += 25;
      rankReasons.push("تکرار در سه مرور متوالی");
    }
    const kr = store.keyResults?.find((k) => k.id === input.keyResultId);
    if (kr?.confidence != null && kr.confidence <= 3) {
      rank += 10;
      rankReasons.push("اطمینان مالک حداکثر ۳ از ۱۰");
    }
    if (input.type === "stalled") {
      rank += 15;
      rankReasons.push("دو فاصله هفتگی بدون حرکت");
    }
    risks.push({ ...input, rank, rankReasons });
  }
  for (const o of rows.filter((o) => o.objective.status === "active")) {
    if (o.health.health === "offTrack")
      add(
        {
          id: "objective-" + o.objective.id,
          type: "objective",
          severity: "high",
          title: o.objective.code + " · هدف خارج از مسیر",
          description: o.objective.title,
          objectiveId: o.objective.id,
          evidence: [o.health.reason],
          recommendedManagementAction:
            "KRهای دارای سهم بالا و اقدامات مرتبط را بازبینی کنید.",
          destination: o.destination,
        },
        0,
        o.objective.deadline,
        o.priority?.rank,
      );
    for (const x of o.rows) {
      const k = x.kr,
        destination = o.destination + "#kr-" + k.id,
        base = {
          objectiveId: o.objective.id,
          keyResultId: k.id,
          priorityId: o.priority?.id,
          destination,
          description: k.title,
          evidence: [x.pacing.reason],
          recommendedManagementAction:
            "مانع نتیجه و کفایت اقدام مرتبط را در مرور هفتگی بررسی کنید.",
        };
      if (x.pacing.status === "offTrack" || x.pacing.status === "atRisk")
        add(
          {
            ...base,
            id: "kr-" + k.id,
            type: "performance",
            severity:
              x.pacing.status === "offTrack"
                ? x.weight !== null && x.weight >= 20
                  ? "critical"
                  : "high"
                : "medium",
            title:
              k.code +
              (x.pacing.status === "offTrack"
                ? " · خارج از مسیر"
                : " · در معرض ریسک"),
          },
          x.weight ?? 0,
          k.deadline,
          o.priority?.rank,
        );
      if (x.pacing.stale)
        add({
          ...base,
          id: "stale-" + k.id,
          type: "freshness",
          severity: "medium",
          title: k.code + " · داده به‌روز نیست",
          evidence: [
            k.lastUpdateAt
              ? "آخرین ثبت: " + reviewDate(k.lastUpdateAt)
              : "هنوز اندازه‌گیری ثبت نشده",
          ],
          recommendedManagementAction: "مقدار و اطمینان هفته جاری را ثبت کنید.",
        });
      if (stalled.includes(k.id))
        add(
          {
            ...base,
            id: "stalled-" + k.id,
            type: "stalled",
            severity: "high",
            title: k.code + " · سه هفته بدون حرکت",
            evidence: ["سه ثبت متوالی پایدار با تعریف قابل مقایسه"],
            recommendedManagementAction:
              "فرضیه اثرگذاری و تخصیص منابع را در مرور تطبیقی بازبینی کنید.",
          },
          x.weight ?? 0,
          k.deadline,
          o.priority?.rank,
        );
      const decline = confidence.declines.find((c) => c.id === k.id);
      if (decline)
        add(
          {
            ...base,
            id: "confidence-" + k.id,
            type: "confidence",
            severity: "high",
            title: k.code + " · افت متوالی اطمینان",
            evidence: [`${decline.from} ← ${decline.to} طی سه مرور`],
            recommendedManagementAction:
              "دلیل کاهش اطمینان مالک نتیجه را روشن کنید.",
          },
          x.weight ?? 0,
          k.deadline,
          o.priority?.rank,
        );
    }
  }
  for (const b of blockers)
    add({
      id: "blocker-" + b.id,
      type: b.recurring ? "recurring" : "blocker",
      severity: b.recurring ? "high" : "medium",
      title: b.recurring ? "مانع تکراری" : "مانع ثبت‌شده",
      description: b.title,
      objectiveId: b.objectiveId,
      evidence: [b.text, `${b.count} ثبت متوالی`],
      recommendedManagementAction:
        "مسئول رفع مانع و تصمیم موردنیاز مدیریت را مشخص کنید.",
      destination: b.destination,
    });
  for (const o of rows) {
    if (
      o.execution.gap !== null &&
      o.execution.summary.execution! >= 70 &&
      o.progress !== null &&
      o.progress < 30
    )
      add({
        id: "gap-" + o.objective.id,
        type: "effectiveness",
        severity: "high",
        title: o.objective.code + " · اجرای بالا، نتیجه پایین",
        description: o.objective.title,
        objectiveId: o.objective.id,
        evidence: [
          `اجرا ${Math.round(o.execution.summary.execution!)}٪؛ نتیجه ${Math.round(o.progress)}٪`,
        ],
        recommendedManagementAction:
          "اثربخشی و فرضیه اقدامات را بازبینی کنید؛ اختلاف اثبات رابطه علت‌ومعلولی نیست.",
        destination: o.destination,
      });
  }
  for (const i of store.initiatives ?? []) {
    if (i.status === "cancelled") continue;
    const destination = "/strategy/initiatives/" + i.id,
      base = {
        initiativeId: i.id,
        objectiveId: i.objectiveId,
        keyResultId: i.keyResultId,
        description: i.title,
        destination,
        evidence: [
          i.actualImpact || i.blockedReason || "شواهد اثر هنوز ثبت نشده",
        ],
        recommendedManagementAction:
          "مالک اقدام، مانع و ارزیابی اثربخشی را بررسی کنید.",
      };
    if (i.status === "blocked" && ["critical", "high"].includes(i.priority))
      add(
        {
          ...base,
          id: "blocked-" + i.id,
          type: "execution",
          severity: i.priority === "critical" ? "critical" : "high",
          title: i.code + " · اقدام مهم متوقف",
        },
        0,
        i.dueDate,
      );
    if (isInitiativeOverdue(i, today))
      add(
        {
          ...base,
          id: "overdue-" + i.id,
          type: "execution",
          severity: "high",
          title: i.code + " · مهلت اقدام گذشته",
        },
        0,
        i.dueDate,
      );
    if (
      i.status === "completed" &&
      ["weak", "ineffective"].includes(i.effectiveness)
    )
      add({
        ...base,
        id: "ineffective-" + i.id,
        type: "effectiveness",
        severity: "high",
        title: i.code + " · تکمیل‌شده با اثر ضعیف",
      });
    if (i.status === "completed" && i.effectiveness === "notEvaluated")
      add({
        ...base,
        id: "unevaluated-" + i.id,
        type: "data",
        severity: "medium",
        title: i.code + " · اثر ارزیابی نشده",
      });
  }
  for (const p of align.priorityGaps)
    add(
      {
        id: "align-priority-" + p.id,
        type: "alignment",
        severity: "medium",
        title: "اولویت بدون هدف",
        description: p.title,
        priorityId: p.id,
        evidence: ["هیچ هدف فعال یا پیش‌نویسی به این اولویت متصل نیست."],
        recommendedManagementAction:
          "هدف مرتبط تعریف کنید یا اعتبار اولویت را بازبینی کنید.",
        destination: `/strategy/cycles/${cycleId}/priorities`,
      },
      0,
      undefined,
      p.rank,
    );
  for (const o of align.objectiveGaps)
    add({
      id: "align-objective-" + o.id,
      type: "alignment",
      severity: "medium",
      title: o.code + " · هدف بدون KR",
      description: o.title,
      objectiveId: o.id,
      evidence: ["شاهد قابل اندازه‌گیری ثبت نشده است."],
      recommendedManagementAction: "برای هدف نتیجه کلیدی تعریف کنید.",
      destination: objectiveLink(cycleId, o.id),
    });
  for (const i of align.initiativeGaps)
    add({
      id: "align-initiative-" + i.id,
      type: "alignment",
      severity: "high",
      title: "اقدام بدون نتیجه معتبر",
      description: i.title,
      initiativeId: i.id,
      objectiveId: i.objectiveId,
      evidence: ["ارتباط اقدام به KR فعال معتبر نیست."],
      recommendedManagementAction: "هم‌راستایی اقدام را اصلاح کنید.",
      destination: "/strategy/initiatives/" + i.id,
    });
  if (discipline.adaptOverdue)
    add({
      id: "adapt-overdue",
      type: "adaptation",
      severity: "medium",
      title: "مرور تطبیقی عقب افتاده",
      description: "ریتم مرور ماهانه این دوره کامل نیست.",
      evidence: ["بیش از ۳۰ روز بدون مرور ماهانه به‌روز"],
      recommendedManagementAction: "مرور تطبیقی را با شواهد موجود انجام دهید.",
      destination: `/strategy/cycles/${cycleId}/adapt`,
    });
  for (const item of initiativeCapacityWarnings(store.initiatives ?? [], roles))
    add({
      id: item.id,
      type: "capacity",
      severity: "medium",
      title: "ظرفیت اجرای هم‌زمان",
      description: item.text,
      evidence: [item.text],
      recommendedManagementAction:
        "بار کار و اولویت اقدامات هم‌زمان را با مالک مرور کنید.",
      destination: item.href,
    });
  for (const i of store.initiatives ?? [])
    if (i.status !== "cancelled")
      for (const finding of initiativeKRSignals(i, store, today))
        add({
          id: "signal-" + i.id + "-" + finding.id,
          type: "effectiveness",
          severity: "medium",
          title: "اثر اقدام نیازمند بررسی",
          description: i.title,
          initiativeId: i.id,
          objectiveId: i.objectiveId,
          keyResultId: i.keyResultId,
          evidence: [finding.text],
          recommendedManagementAction:
            "فرضیه اثرگذاری و حرکت نتیجه مرتبط را بررسی کنید.",
          destination: finding.href,
        });
  for (const o of align.objectivePriorityGaps)
    add({
      id: "priority-link-" + o.id,
      type: "alignment",
      severity: "medium",
      title: "هدف بدون اولویت منتخب",
      description: o.title,
      objectiveId: o.id,
      evidence: ["اولویت مرتبط منتخب یا معتبر نیست."],
      recommendedManagementAction:
        "رابطه هدف با اولویت منتخب دوره را بررسی کنید.",
      destination: objectiveLink(cycleId, o.id),
    });
  for (const k of align.krObjectiveGaps)
    add({
      id: "objective-link-" + k.id,
      type: "alignment",
      severity: "high",
      title: "نتیجه بدون هدف معتبر",
      description: k.title,
      keyResultId: k.id,
      evidence: ["هدف مرتبط حذف یا لغو شده است."],
      recommendedManagementAction: "پیوند نتیجه با هدف دوره را اصلاح کنید.",
      destination: "/strategy/key-results",
    });
  for (const item of align.ownerGaps)
    add({
      id: "owner-" + item.id,
      type: "alignment",
      severity: "medium",
      title: "مالک معتبر مشخص نیست",
      description: item.title,
      evidence: ["نقش مالک در داده موجود یافت نشد"],
      recommendedManagementAction: "مسئول پاسخ‌گو را مشخص کنید.",
      destination:
        "keyResultId" in item
          ? "/strategy/initiatives/" + item.id
          : "objectiveId" in item
            ? objectiveLink(cycleId, item.objectiveId) + "#kr-" + item.id
            : objectiveLink(cycleId, item.id),
    });
  if (discipline.weeklyOverdue)
    add({
      id: "weekly-overdue",
      type: "discipline",
      severity: "medium",
      title: "مرور هفتگی عقب افتاده",
      description: "بخشی از هفته‌های سپری‌شده مرور کامل ندارند.",
      evidence: [
        `${discipline.completed} مرور کامل از ${discipline.dueWeeks} هفته سررسیدشده`,
      ],
      recommendedManagementAction:
        "هفته‌های مرور نشده را با شواهد واقعی تکمیل کنید.",
      destination:
        "/strategy/weekly-review?cycle=" + encodeURIComponent(cycleId),
    });
  const changes = (store.strategyChanges ?? []).filter(
    (c) =>
      c.cycleId === cycleId &&
      reviewDate(c.changedAt) <= today &&
      days(reviewDate(c.changedAt), today) <= 30,
  );
  for (const c of changes.filter(
    (c) => c.entityType === "kr" && c.fieldChanged === "targetValue",
  ))
    add({
      id: "change-" + c.id,
      type: "change",
      severity: "low",
      title: "هدف KR اخیراً تغییر کرده",
      description: c.reason,
      keyResultId: c.entityId,
      evidence: [`${c.oldValue} ← ${c.newValue}`],
      recommendedManagementAction:
        "تغییر مبنای مقایسه را هنگام تفسیر روند در نظر بگیرید.",
      destination: "/strategy/adapt/" + c.reviewId,
    });
  if (changes.length >= 3)
    add({
      id: "changes-frequent",
      type: "change",
      severity: "low",
      title: "چند تغییر استراتژیک در ماه اخیر",
      description: "تعداد زیاد تغییر به‌تنهایی نشانه بدی نیست.",
      evidence: [`${changes.length} تغییر ثبت‌شده`],
      recommendedManagementAction: "منطق و پیوستگی تصمیم‌ها را مرور کنید.",
      destination: `/strategy/cycles/${cycleId}/adapt`,
    });
  return risks.sort((a, b) => b.rank - a.rank || a.id.localeCompare(b.id));
}
export function getStrategyHealth(
  rows: ReturnType<typeof getObjectiveDashboardRows>,
  store: StrategyStore,
  roles: StrategyRole[],
  today: string,
  cycleId: string,
  risks: StrategyRisk[],
) {
  const active = rows.filter((o) => o.objective.status === "active"),
    ks = active.flatMap((o) => o.rows),
    paceByObjective = active.map((o) => {
      if (
        !o.weights.valid ||
        o.rows.some(
          (r) =>
            r.weight! > 0 &&
            (r.progress === null || r.pacing.expected === null),
        )
      )
        return null;
      return o.rows.reduce(
        (sum, r) =>
          sum +
          ((r.weight ?? 0) / 100) *
            (r.weight === 0
              ? 0
              : Math.max(
                  0,
                  100 - Math.max(0, r.pacing.expected! - r.progress!),
                )),
        0,
      );
    }),
    confidence = mean(ks.map((k) => k.kr.confidence)),
    ins = (store.initiatives ?? []).filter((i) => i.status !== "cancelled"),
    evaluated = ins.filter((i) => i.effectiveness !== "notEvaluated"),
    effectValues = {
      effective: 100,
      promising: 75,
      weak: 35,
      ineffective: 0,
      notEvaluated: 0,
    },
    discipline = getReviewDiscipline(store, cycleId, today),
    alignment = getAlignmentReport(store, roles);
  const components: HealthComponent[] = [
    {
      id: "objective",
      label: "سلامت اهداف — شاهد توضیحی",
      weight: 0,
      score: null,
      contribution: null,
      availability: `${active.filter((o) => o.health.health !== "insufficient").length}/${active.length}`,
      reason:
        "از KR و اطمینان مشتق می‌شود؛ برای جلوگیری از شمارش دوباره وزن مستقل ندارد.",
    },
    {
      id: "pace",
      label: "عملکرد زمانی نتایج",
      weight: 35,
      score: mean(paceByObjective),
      contribution: null,
      availability: `${paceByObjective.filter((x) => x !== null).length}/${active.length} هدف`,
      reason:
        "۱۰۰ منهای عقب‌ماندگی مثبت از برنامه زمانی؛ وزن KR داخل هدف و وزن برابر اهداف. بدون اطمینان و بدون پیش‌بینی.",
    },
    {
      id: "confidence",
      label: "اطمینان",
      weight: 20,
      score: confidence === null ? null : confidence * 10,
      contribution: null,
      availability: `${ks.filter((k) => k.kr.confidence !== null).length}/${ks.length} KR`,
      reason: "میانگین اطمینان‌های ثبت‌شده ×۱۰؛ مقدار ناموجود صفر نیست.",
    },
    {
      id: "effectiveness",
      label: "اثربخشی اجرا",
      weight: 20,
      score: mean(evaluated.map((i) => effectValues[i.effectiveness])),
      contribution: null,
      availability: `${evaluated.length}/${ins.length} اقدام`,
      reason:
        "موثر ۱۰۰، امیدبخش ۷۵، کم‌اثر ۳۵، بی‌اثر صفر؛ ارزیابی‌نشده کنار گذاشته می‌شود.",
    },
    {
      id: "discipline",
      label: "انضباط مرور",
      weight: 15,
      score: discipline.score,
      contribution: null,
      availability: `${discipline.completed} هفتگی / ${discipline.adaptCompleted} تطبیقی`,
      reason:
        "میانگین پوشش مرورهای هفتگی سررسیدشده و دوره‌های ۳۰روزه؛ کیفیت مرور جدا نمایش داده می‌شود.",
    },
    {
      id: "alignment",
      label: "هم‌راستایی",
      weight: 10,
      score: alignment.score,
      contribution: null,
      availability: `${alignment.parts.filter((p) => p.total).length}/۵ گروه`,
      reason: "میانگین پوشش رابطه‌ها و مالکیت؛ KR محقق‌شده الزام اقدام ندارد.",
    },
  ];
  const coverage = components
      .filter((c) => c.score !== null)
      .reduce((n, c) => n + c.weight, 0),
    available =
      coverage >= rules.minimumHealthCoverage &&
      components.find((c) => c.id === "pace")?.score !== null,
    raw = available
      ? components.reduce((n, c) => n + (c.score ?? 0) * c.weight, 0) / coverage
      : null;
  for (const c of components)
    c.contribution =
      c.score === null || !coverage ? null : (c.score * c.weight) / coverage;
  let score = raw;
  const caps: string[] = [];
  if (score !== null) {
    if (risks.some((r) => r.severity === "critical")) {
      score = Math.min(score, 39);
      caps.push("ریسک بحرانی: سقف سلامت ۳۹");
    } else if (risks.some((r) => r.severity === "high")) {
      score = Math.min(score, 59);
      caps.push("ریسک مهم: سقف سلامت ۵۹");
    } else if (
      risks.some((r) => r.severity === "medium") ||
      coverage < 100 ||
      ks.some((k) => k.kr.confidence === null) ||
      active.some((o) => o.health.health === "insufficient")
    ) {
      score = Math.min(score, 74);
      caps.push("ریسک یا داده ناقص: سقف سلامت ۷۴");
    }
  }
  score = score === null ? null : Math.round(score);
  const status =
    score === null
      ? "insufficient"
      : score < 40
        ? "critical"
        : score < 60
          ? "offTrack"
          : score < 75
            ? "attention"
            : score < 90
              ? "onTrack"
              : "strong";
  return {
    version: rules.healthVersion,
    components,
    coverage,
    raw: raw === null ? null : Math.round(raw),
    score: score === null ? null : Math.round(score),
    status,
    label: healthLabels[status],
    caps,
  };
}
export function getStrategyDashboard(
  input: StrategyStore,
  roles: StrategyRole[],
  today: string,
  filters: ReportFilters = {},
) {
  const source = getDashboardSource(input, roles, today, filters.cycleId);
  if (!source) return null;
  const { store, cycle, asOf } = source,
    rows = getObjectiveDashboardRows(store, source.roles, asOf),
    performance = getKRPerformanceSummary(rows),
    risks = getStrategyRisks(store, source.roles, asOf, rows, cycle.id),
    health = getStrategyHealth(
      rows,
      store,
      source.roles,
      asOf,
      cycle.id,
      risks,
    ),
    weekly = (store.strategyWeeklySnapshots ?? [])
      .filter(
        (s) =>
          s.cycleId === cycle.id &&
          store.weeklyReviews?.some(
            (r) => r.id === s.reviewId && r.status === "completed",
          ),
      )
      .sort((a, b) => a.weekNumber - b.weekNumber),
    trend = weekly.filter(
      (s) =>
        s.weekNumber >=
        (weekly.at(-1)?.weekNumber ?? 0) - (filters.weeks ?? 13) + 1,
    ),
    momentum = weekly.length
      ? weeklyMomentum(weekly.at(-1)!, weekly.at(-2))
      : {
          label: "داده کافی نیست",
          reason:
            "با ثبت مرورهای هفتگی، روند عملکرد در این بخش نمایش داده می‌شود.",
        },
    confidence = source.snapshot
      ? source.snapshot.averageConfidence
      : mean(
          rows
            .filter((o) => o.objective.status === "active")
            .flatMap((o) => o.krs.map((k) => k.confidence)),
        ),
    focus = risks[0] ?? null,
    selectedRows = rows.filter(
      (o) =>
        (!filters.objectiveId || o.objective.id === filters.objectiveId) &&
        (!filters.priorityId ||
          o.objective.relatedPriorityId === filters.priorityId) &&
        (!filters.ownerRoleId ||
          o.objective.ownerRoleId === filters.ownerRoleId ||
          o.krs.some((k) => k.ownerRoleId === filters.ownerRoleId)),
    ),
    krRows = selectedRows
      .filter((o) => o.objective.status === "active")
      .flatMap((o) =>
        o.rows.map((k) => ({
          ...k,
          objective: o.objective,
          destination: o.destination + "#kr-" + k.kr.id,
        })),
      )
      .filter(
        (k) =>
          (!filters.ownerRoleId || k.kr.ownerRoleId === filters.ownerRoleId) &&
          (!filters.krStatus ||
            (k.pacing.status ?? "unknown") === filters.krStatus),
      )
      .sort(
        (a, b) =>
          ({
            offTrack: 0,
            atRisk: 1,
            unknown: 2,
            notStarted: 3,
            onTrack: 4,
            achieved: 5,
          })[a.pacing.status ?? "unknown"] -
            {
              offTrack: 0,
              atRisk: 1,
              unknown: 2,
              notStarted: 3,
              onTrack: 4,
              achieved: 5,
            }[b.pacing.status ?? "unknown"] ||
          (b.weight ?? 0) - (a.weight ?? 0),
      );
  const initiatives = (store.initiatives ?? []).filter(
    (i) =>
      (!filters.objectiveId || i.objectiveId === filters.objectiveId) &&
      (!filters.priorityId ||
        store.objectives.some(
          (o) =>
            o.id === i.objectiveId &&
            o.relatedPriorityId === filters.priorityId,
        )) &&
      (!filters.ownerRoleId || i.ownerRoleId === filters.ownerRoleId) &&
      (!filters.initiativeStatus || i.status === filters.initiativeStatus),
  );
  const changes = (store.strategyChanges ?? [])
      .filter((c) => c.cycleId === cycle.id)
      .sort((a, b) => b.changedAt.localeCompare(a.changedAt)),
    adapt = (store.adaptReviews ?? []).filter((r) => r.cycleId === cycle.id),
    decisions = [
      ...(store.strategyDecisions ?? [])
        .filter((d) =>
          store.weeklyReviews?.some(
            (r) => r.id === d.reviewId && r.cycleId === cycle.id,
          ),
        )
        .map((d) => ({
          ...d,
          destination: "/strategy/weekly-review/" + d.reviewId,
        })),
      ...adapt.flatMap((r) =>
        r.decisions.map((d) => ({
          ...d,
          destination: "/strategy/adapt/" + r.id,
        })),
      ),
    ].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    distribution = [
      { label: "کم · ۱–۳", min: 1, max: 3 },
      { label: "متوسط · ۴–۶", min: 4, max: 6 },
      { label: "خوب · ۷–۸", min: 7, max: 8 },
      { label: "بالا · ۹–۱۰", min: 9, max: 10 },
    ].map((b) => ({
      ...b,
      count: rows
        .filter((o) => o.objective.status === "active")
        .flatMap((o) => o.krs)
        .filter(
          (k) =>
            k.confidence !== null &&
            k.confidence >= b.min &&
            k.confidence <= b.max,
        ).length,
    }));
  const progress = source.snapshot
    ? source.snapshot.overallProgress
    : performance.weightedProgress;
  return {
    source,
    cycle,
    asOf,
    rows,
    selectedRows,
    krRows,
    initiatives,
    performance,
    progress,
    confidence,
    health,
    risks,
    focus,
    trend,
    trendEvents: getTrendEvents(store, cycle.id),
    allTrend: weekly,
    momentum,
    distribution,
    confidenceTrend: getConfidenceTrend(store, cycle.id, asOf),
    execution: getExecutionResultAnalysis(selectedRows),
    portfolio: getInitiativeEffectivenessSummary(store, asOf),
    blockers: getRecurringBlockers(store, cycle.id, asOf),
    alignment: getAlignmentReport(store, source.roles),
    discipline: getReviewDiscipline(store, cycle.id, asOf),
    completeness: getStrategyCompleteness(
      store,
      rows,
      cycle.id,
      asOf,
      source.roles,
    ),
    freshness: getStrategyFreshness(store, cycle.id, asOf),
    changes,
    changeSummary: strategyChangeSummary(store, cycle.id),
    decisions,
    adapt,
    learnings: store.strategyLearnings ?? [],
    assumptions: store.strategicAssumptions ?? [],
    daysRemaining: days(asOf, cycle.endDate),
    summary: `پیشرفت ${progress === null ? "نامشخص" : Math.round(progress) + "٪"} و سلامت استراتژی «${health.label}» است. ${confidence === null ? "اطمینان هنوز ثبت نشده است." : "اطمینان میانگین " + confidence.toFixed(1) + " از ۱۰ است."} ${focus ? focus.title + "؛ " + focus.recommendedManagementAction : "در داده موجود ریسک مدیریتی برجسته‌ای شناسایی نشده است؛ این تضمین موفقیت نیست."}`,
  };
}
export type StrategyDashboard = NonNullable<
  ReturnType<typeof getStrategyDashboard>
>;
