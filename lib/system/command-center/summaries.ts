import type { CommandRow } from "./aggregation";
import { inPeriod, type Period } from "./snapshots";
export function operationalSummaries(
  rows: CommandRow[],
  period: Period,
  day: string,
) {
  const actions = rows.flatMap((x) =>
      x.record.improvements.map((item) => ({
        item,
        process: x.process,
        system: x.e.system,
      })),
    ),
    open = actions.filter(
      (x) => !["completed", "cancelled"].includes(x.item.status),
    ),
    kpis = rows.flatMap((x) =>
      x.kpis.map((k) => ({ ...k, process: x.process })),
    );
  return {
    standard: {
      approved: rows.filter((x) => x.approved),
      needsReview: rows.filter((x) => x.sopStatus === "needs-review"),
      missingCritical: rows.filter(
        (x) => x.process.priorityLevel === "critical" && !x.approved,
      ),
      mismatch: rows.filter((x) => x.mismatch),
      dod: rows.filter((x) => x.dod),
      decisionGaps: rows.filter(
        (x) =>
          x.e.source?.analysis.toBe?.steps.some((s) => s.type === "decision") &&
          x.decision < 1,
      ),
    },
    adoption: {
      low: rows.filter((x) => x.adoption && x.adoption.score < 70),
      implementedLow: rows.filter(
        (x) => x.eligibleKPI && x.adoption && x.adoption.score < 70,
      ),
      training: rows.filter((x) => x.adoption && !x.adoption.trainingComplete),
      pilot: rows.filter((x) => x.adoption && !x.adoption.pilotComplete),
      liveLow: rows.filter(
        (x) =>
          x.e.standard?.plan.goLiveStatus === "live" &&
          x.adoption &&
          x.adoption.score < 70,
      ),
      acknowledgements: rows.reduce(
        (n, x) =>
          n +
          (x.e.standard
            ? x.e.standard.plan.roles.length - (x.adoption?.acks ?? 0)
            : 0),
        0,
      ),
      missing: rows.filter((x) => !x.adoption),
    },
    kpis: {
      critical: kpis.filter((x) => x.score !== null && x.score < 40),
      declining: kpis.filter((x) => x.trend === "رو به افت"),
      improving: kpis.filter((x) => x.trend === "رو به بهبود"),
      missing: rows.filter((x) => x.eligibleKPI && x.health.kpi.score === null),
    },
    improvements: {
      open,
      critical: open.filter((x) => x.item.priority === "critical"),
      overdue: open.filter((x) => x.item.dueDate && x.item.dueDate < day),
      completed: actions.filter(
        (x) =>
          x.item.status === "completed" &&
          x.item.completedAt &&
          inPeriod(x.item.completedAt, period, day),
      ),
      blocked: open.filter((x) => x.item.status === "blocked"),
      unowned: open.filter(
        (x) => !x.system.roles.some((r) => r.id === x.item.ownerRoleId),
      ),
    },
    founder: {
      dependent: rows.filter((x) => x.founderDependent),
      critical: rows.filter(
        (x) => x.founderDependent && x.process.priorityLevel === "critical",
      ),
      steps: rows.reduce((n, x) => n + x.founderSteps.length, 0),
      decisions: rows.reduce(
        (n, x) =>
          n + x.founderSteps.filter((s) => s.type === "decision").length,
        0,
      ),
      wait: rows.reduce(
        (n, x) =>
          n + x.founderSteps.reduce((v, s) => v + (s.waitTimeMinutes ?? 0), 0),
        0,
      ),
    },
  };
}
