import { type ScaleStore, now } from "../model";
import { ideaReadiness } from "../logic";
import {
  experimentData,
  newExperiment,
  type GrowthExperiment,
  type ExperimentMeasurement,
  type GrowthMetric,
  type ExperimentDecision,
  type GrowthLearning,
  type IdeaReview,
} from "./model";
import {
  ensure,
  validateExperiments,
  assertExperimentTransition,
} from "./validation";
import {
  experimentReadiness,
  decisionReadiness,
  tehranDay,
  validDay,
  metricFor,
  suggestExperimentResult,
} from "./logic";
function commit(before: ScaleStore, after: ScaleStore) {
  validateExperiments(after);
  assertExperimentTransition(before, after);
  return after;
}
export function saveExperiment(s: ScaleStore, e: GrowthExperiment) {
  const d = experimentData(s),
    old = d.experiments.find((x) => x.id === e.id);
  ensure(
    !old || ["draft", "ready"].includes(old.status),
    "طراحی بعد از شروع تغییر نمی‌کند؛ نسخه جدید بسازید.",
  );
  ensure(!old || e.status === old.status, "وضعیت را با اقدام صریح تغییر دهید.");
  const next = { ...e, status: "draft" as const, updatedAt: now() };
  return commit(s, {
    ...s,
    experimentData: {
      ...d,
      experiments: [...d.experiments.filter((x) => x.id !== e.id), next],
    },
  });
}
export function convertIdea(s: ScaleStore, id: string) {
  const i = s.ideas.find((i) => i.id === id);
  ensure(
    i && i.status === "ready" && ideaReadiness(i, s).ready,
    "ایده باید آماده آزمایش باشد.",
  );
  const existing = experimentData(s).experiments.find(
    (e) => e.ideaId === id && ["draft", "ready"].includes(e.status),
  );
  if (existing) return { store: s, experiment: existing };
  const e = {
    ...newExperiment(s),
    title: i.title,
    description: i.description,
    ideaId: i.id,
    constraintId: i.constraintId,
    leverId: i.leverId,
    ownerRoleId: i.ownerRoleId,
    confidenceBefore: i.confidence,
    hypothesis: {
      change: i.intervention || i.title,
      audience: "",
      movement: i.successMetric,
      rationale: i.rationale,
    },
  };
  return { store: saveExperiment(s, e), experiment: e };
}
export function transitionExperiment(
  s: ScaleStore,
  id: string,
  status: "ready" | "running" | "paused" | "cancelled",
  ownerName = "",
) {
  const d = experimentData(s),
    old = d.experiments.find((e) => e.id === id);
  ensure(old, "آزمایش موجود نیست.");
  let e = { ...old, status, updatedAt: now() };
  if (status === "ready" || (status === "running" && old.status === "ready")) {
    const r = experimentReadiness(s, e);
    ensure(r.ready, `تکمیل کنید: ${r.missing.join("، ")}`);
  }
  if (status === "running" && !old.startedAt) {
    ensure(old.status === "ready", "ابتدا آمادگی را تأیید کنید.");
    const c = s.constraints.find((c) => c.id === e.constraintId)!;
    e = {
      ...e,
      startedAt: now(),
      snapshot: {
        constraintTitle: c.title,
        ideaTitle: s.ideas.find((i) => i.id === e.ideaId)?.title ?? "",
        leverName: s.levers.find((l) => l.id === e.leverId)?.name ?? "",
        ownerName,
        strategyObjectiveId: c.linkedStrategyObjectiveId,
        strategyKRId: c.linkedStrategyKRId,
        systemProcessId: c.linkedSystemProcessId,
        metrics: structuredClone(
          d.metrics.filter((m) =>
            [e.primaryMetricId, ...e.secondaryMetricIds].includes(m.id),
          ),
        ),
      },
    };
  }
  let next = commit(s, {
    ...s,
    experimentData: {
      ...d,
      experiments: d.experiments.map((x) => (x.id === id ? e : x)),
    },
  });
  if (status === "running" && e.ideaId)
    next = {
      ...next,
      ideas: next.ideas.map((i) =>
        i.id === e.ideaId && i.status !== "experiment"
          ? {
              ...i,
              status: "experiment",
              updatedAt: now(),
              history: [
                ...i.history,
                { at: now(), from: i.status, to: "experiment" },
              ],
            }
          : i,
      ),
    };
  return next;
}
export function addMeasurement(s: ScaleStore, m: ExperimentMeasurement) {
  const d = experimentData(s),
    e = d.experiments.find((e) => e.id === m.experimentId);
  ensure(e?.status === "running", "ثبت مشاهده فقط هنگام اجرا مجاز است.");
  ensure(
    validDay(m.measurementDate) &&
      m.measurementDate <= tehranDay() &&
      m.measurementDate >= tehranDay(new Date(e.startedAt!)),
    "تاریخ مشاهده باید از شروع واقعی تا امروز باشد.",
  );
  return commit(s, {
    ...s,
    experimentData: { ...d, measurements: [...d.measurements, m] },
  });
}
export function saveExecutionNotes(
  s: ScaleStore,
  id: string,
  executionNotes: string,
  blockers: string,
) {
  const d = experimentData(s);
  ensure(
    d.experiments.some(
      (e) => e.id === id && ["running", "paused"].includes(e.status),
    ),
  );
  return commit(s, {
    ...s,
    experimentData: {
      ...d,
      experiments: d.experiments.map((e) =>
        e.id === id ? { ...e, executionNotes, blockers, updatedAt: now() } : e,
      ),
    },
  });
}
export function completeExperiment(
  s: ScaleStore,
  id: string,
  input: {
    result: NonNullable<GrowthExperiment["resultStatus"]>;
    resultRationale: string;
    confidenceAfter: GrowthExperiment["confidenceAfter"];
    learning: string;
    evidence: string;
    insight: string;
    decision: ExperimentDecision["decision"];
    rationale: string;
    capacityReviewed: boolean;
    alignmentReviewed: boolean;
    context: string;
    confirmed: boolean;
  },
) {
  const d = experimentData(s),
    e = d.experiments.find((e) => e.id === id);
  ensure(
    e && ["running", "paused"].includes(e.status),
    "آزمایش باید شروع شده باشد.",
  );
  ensure(input.confirmed, "نتیجه نهایی مدیریت را صریح تأیید کنید.");
  const r = decisionReadiness(
    input.decision,
    input.rationale,
    input.learning,
    input.capacityReviewed,
    input.alignmentReviewed,
  );
  ensure(r.ready, `تکمیل کنید: ${r.missing.join("، ")}`);
  ensure(input.resultRationale.trim(), "دلیل طبقه‌بندی نهایی را ثبت کنید.");
  if (suggestExperimentResult(s, e).actual === null)
    ensure(
      input.result === "inconclusive",
      "بدون مشاهده شاخص اصلی، نتیجه باید نامشخص باشد.",
    );
  const at = now(),
    learning: GrowthLearning = {
      id: crypto.randomUUID(),
      experimentId: id,
      constraintId: e.constraintId,
      ideaId: e.ideaId,
      leverId: e.leverId,
      statement: input.learning,
      evidence: input.evidence,
      reusableInsight: input.insight,
      createdAt: at,
    },
    decision: ExperimentDecision = {
      id: crypto.randomUUID(),
      experimentId: id,
      decision: input.decision,
      rationale: input.rationale,
      capacityReviewed: input.capacityReviewed,
      alignmentReviewed: input.alignmentReviewed,
      context: input.context,
      createdAt: at,
    };
  return commit(s, {
    ...s,
    experimentData: {
      ...d,
      experiments: d.experiments.map((x) =>
        x.id === id
          ? {
              ...x,
              status: "completed",
              resultStatus: input.result,
              resultRationale: input.resultRationale,
              confidenceAfter: input.confidenceAfter,
              completedAt: at,
              updatedAt: at,
            }
          : x,
      ),
      learnings: [...d.learnings, learning],
      decisions: [...d.decisions, decision],
    },
  });
}
export function iterateExperiment(s: ScaleStore, id: string) {
  const d = experimentData(s),
    old = d.experiments.find((e) => e.id === id);
  ensure(
    old?.status === "completed" &&
      d.decisions.some(
        (x) =>
          x.experimentId === id && ["iterate", "retest"].includes(x.decision),
      ),
    "ایجاد نسخه بعد به تصمیم تکرار یا آزمایش مجدد نیاز دارد.",
  );
  const fresh = newExperiment(s),
    e = {
      ...structuredClone(old),
      id: fresh.id,
      code: fresh.code,
      title: `${old.title} · نسخه بعد`,
      parentExperimentId: old.id,
      status: "draft" as const,
      resultStatus: null,
      confidenceAfter: null,
      resultRationale: "",
      startedAt: undefined,
      completedAt: undefined,
      snapshot: undefined,
      createdAt: fresh.createdAt,
      updatedAt: fresh.updatedAt,
      startDate: "",
      endDate: "",
      executionNotes: "",
      blockers: "",
    };
  return { store: saveExperiment(s, e), experiment: e };
}
export function reviewIdea(
  s: ScaleStore,
  id: string,
  experimentId: string,
  status: IdeaReview["status"],
  reason: string,
) {
  const d = experimentData(s),
    i = s.ideas.find((i) => i.id === id);
  ensure(
    i &&
      d.experiments.some(
        (e) =>
          e.id === experimentId && e.ideaId === id && e.status === "completed",
      ),
    "تصمیم ایده به آزمایش تکمیل‌شده مرتبط نیاز دارد.",
  );
  ensure(reason.trim(), "دلیل تصمیم را ثبت کنید.");
  const at = now();
  return commit(s, {
    ...s,
    ideas: s.ideas.map((x) =>
      x.id === id
        ? {
            ...x,
            status,
            updatedAt: at,
            history: [...x.history, { at, from: x.status, to: status }],
          }
        : x,
    ),
    experimentData: {
      ...d,
      ideaReviews: [
        ...d.ideaReviews,
        {
          id: crypto.randomUUID(),
          ideaId: id,
          experimentId,
          status,
          reason,
          createdAt: at,
        },
      ],
    },
  });
}
export function addGrowthMetric(s: ScaleStore, m: GrowthMetric) {
  const d = experimentData(s);
  ensure(!d.metrics.some((x) => x.id === m.id));
  return commit(s, {
    ...s,
    experimentData: { ...d, metrics: [...d.metrics, m] },
  });
}
