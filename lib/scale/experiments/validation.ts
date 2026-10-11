import type { ScaleStore } from "../model";
import {
  experimentData,
  statuses,
  results,
  decisions,
  experimentTypes,
  directions,
  sourceTypes,
  metricCategories,
  type ExperimentData,
  type GrowthExperiment,
} from "./model";
import { validDay, metricFor, experimentReadiness } from "./logic";
export function ensure(
  v: unknown,
  message = "ساختار آزمایش معتبر نیست.",
): asserts v {
  if (!v) throw Error(message);
}
const obj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const txt = (v: unknown) => typeof v === "string" && v.length <= 10000;
const member = (v: unknown, o: object) =>
  typeof v === "string" && Object.hasOwn(o, v);
const finite = (v: unknown) => typeof v === "number" && Number.isFinite(v);
const timestamp = (v: unknown) =>
  typeof v === "string" && Number.isFinite(Date.parse(v));
function rows(v: unknown) {
  ensure(Array.isArray(v) && v.length <= 20000);
  const ids = new Set();
  for (const x of v) {
    ensure(obj(x) && txt(x.id) && x.id && !ids.has(x.id));
    ids.add(x.id);
  }
  return v as Record<string, unknown>[];
}
function strings(v: Record<string, unknown>, keys: string[]) {
  for (const k of keys) ensure(txt(v[k]), `فیلد ${k} معتبر نیست.`);
}
function validateMetric(m: Record<string, unknown>) {
  strings(m, ["id", "name", "unit", "sourceId", "description"]);
  ensure(
    !!(m.name as string).trim() &&
      !!(m.unit as string).trim() &&
      member(m.direction, directions) &&
      member(m.category, metricCategories) &&
      member(m.sourceType, sourceTypes) &&
      typeof m.custom === "boolean",
  );
  if (["strategy", "system"].includes(m.sourceType as string))
    ensure(!!m.sourceId);
}
export function validateExperiments(s: ScaleStore) {
  if (s.experimentData === undefined) return;
  const raw = s.experimentData as unknown;
  ensure(obj(raw));
  const metrics = rows(raw.metrics),
    experiments = rows(raw.experiments),
    measurements = rows(raw.measurements),
    learnings = rows(raw.learnings),
    ds = rows(raw.decisions),
    reviews = rows(raw.ideaReviews);
  metrics.forEach(validateMetric);
  ensure(
    Number.isInteger(raw.staleDays) &&
      (raw.staleDays as number) >= 1 &&
      (raw.staleDays as number) <= 90,
  );
  const codes = new Set();
  for (const e of experiments) {
    strings(e, [
      "code",
      "title",
      "description",
      "ideaId",
      "constraintId",
      "leverId",
      "ownerRoleId",
      "primaryMetricId",
      "baselinePeriod",
      "baselineSource",
      "successCriteria",
      "startDate",
      "endDate",
      "resultRationale",
      "parentExperimentId",
      "executionNotes",
      "blockers",
    ]);
    ensure(
      e.title && (e.title as string).trim() && e.code && !codes.has(e.code),
    );
    codes.add(e.code);
    ensure(
      member(e.status, statuses) &&
        member(e.type, experimentTypes) &&
        timestamp(e.createdAt) &&
        timestamp(e.updatedAt),
    );
    ensure(e.resultStatus === null || member(e.resultStatus, results));
    for (const key of [
      "baselineValue",
      "targetValue",
      "minimumSuccessThreshold",
    ])
      ensure(e[key] === null || finite(e[key]));
    ensure(finite(e.tolerance) && (e.tolerance as number) >= 0);
    for (const key of ["confidenceBefore", "confidenceAfter"])
      ensure(
        e[key] === null || ["low", "medium", "high"].includes(e[key] as string),
      );
    ensure(obj(e.hypothesis) && obj(e.experimentDesign));
    strings(e.hypothesis, ["change", "audience", "movement", "rationale"]);
    strings(e.experimentDesign, [
      "change",
      "audience",
      "channel",
      "sample",
      "comparison",
      "notes",
    ]);
    ensure(!e.ideaId || s.ideas.some((i) => i.id === e.ideaId));
    ensure(
      !e.constraintId || s.constraints.some((c) => c.id === e.constraintId),
    );
    ensure(!e.leverId || s.levers.some((l) => l.id === e.leverId));
    ensure(
      !e.primaryMetricId || metrics.some((m) => m.id === e.primaryMetricId),
    );
    ensure(
      Array.isArray(e.secondaryMetricIds) &&
        new Set(e.secondaryMetricIds).size === e.secondaryMetricIds.length &&
        e.secondaryMetricIds.every(
          (id) => id !== e.primaryMetricId && metrics.some((m) => m.id === id),
        ),
    );
    ensure(
      !e.parentExperimentId ||
        experiments.some(
          (p) =>
            p.id === e.parentExperimentId &&
            p.status === "completed" &&
            p.id !== e.id,
        ),
    );
    ensure(!e.startDate || validDay(e.startDate as string));
    ensure(!e.endDate || validDay(e.endDate as string));
    ensure(
      !e.startDate ||
        !e.endDate ||
        (e.startDate as string) <= (e.endDate as string),
    );
    if (e.startedAt !== undefined) ensure(timestamp(e.startedAt));
    if (e.completedAt !== undefined) ensure(timestamp(e.completedAt));
    if (e.snapshot !== undefined) {
      ensure(obj(e.snapshot));
      strings(e.snapshot, [
        "constraintTitle",
        "ideaTitle",
        "leverName",
        "ownerName",
        "strategyObjectiveId",
        "strategyKRId",
        "systemProcessId",
      ]);
      rows(e.snapshot.metrics).forEach(validateMetric);
      ensure(
        (e.snapshot.metrics as { id: string }[]).some(
          (m) => m.id === e.primaryMetricId,
        ),
      );
    }
    const typed = e as unknown as GrowthExperiment,
      m = metricFor(s, typed);
    if (m?.direction === "binary")
      for (const k of [
        "baselineValue",
        "targetValue",
        "minimumSuccessThreshold",
      ])
        ensure(
          e[k] === null || e[k] === 0 || e[k] === 1,
          "شاخص دودویی فقط صفر یا یک می‌پذیرد.",
        );
    if (
      m &&
      ["increase", "decrease"].includes(m.direction) &&
      e.baselineValue !== null &&
      e.targetValue !== null
    ) {
      const sign = m.direction === "increase" ? 1 : -1;
      ensure(
        ((e.targetValue as number) - (e.baselineValue as number)) * sign >
          (e.tolerance as number),
        "هدف باید در جهت مطلوب و فراتر از آستانه تغییر باشد.",
      );
      if (e.minimumSuccessThreshold !== null)
        ensure(
          ((e.minimumSuccessThreshold as number) -
            (e.baselineValue as number)) *
            sign >
            (e.tolerance as number) &&
            ((e.targetValue as number) -
              (e.minimumSuccessThreshold as number)) *
              sign >=
              0,
          "حداقل موفقیت باید بین خط مبنا و هدف، فراتر از آستانه تغییر باشد.",
        );
    }
    if (["running", "paused", "completed"].includes(e.status as string))
      ensure(
        !!e.startedAt && !!e.snapshot,
        "آزمایش شروع‌شده باید شناسنامه ثابت داشته باشد.",
      );
    if (e.status === "completed")
      ensure(
        !!e.resultStatus &&
          !!e.completedAt &&
          learnings.filter((l) => l.experimentId === e.id).length === 1 &&
          ds.filter((d) => d.experimentId === e.id).length === 1,
        "تکمیل به نتیجه، یادگیری و تصمیم نیاز دارد.",
      );
    else
      ensure(
        e.resultStatus === null && !e.completedAt,
        "نتیجه نهایی فقط هنگام تکمیل ثبت می‌شود.",
      );
  }
  for (const e of experiments) {
    const visited = new Set([e.id]);
    let parent = e.parentExperimentId;
    while (parent) {
      ensure(!visited.has(parent), "زنجیره آزمایش چرخه دارد.");
      visited.add(parent);
      parent = experiments.find((x) => x.id === parent)?.parentExperimentId;
    }
  }
  for (const m of measurements) {
    strings(m, [
      "experimentId",
      "metricId",
      "measurementDate",
      "note",
      "source",
    ]);
    const e = experiments.find((e) => e.id === m.experimentId);
    ensure(
      e &&
        !!e.startedAt &&
        (m.metricId === e.primaryMetricId ||
          (e.secondaryMetricIds as unknown[]).includes(m.metricId)),
    );
    ensure(
      finite(m.value) &&
        validDay(m.measurementDate as string) &&
        timestamp(m.createdAt),
    );
    const metric = metricFor(
      s,
      e as unknown as GrowthExperiment,
      m.metricId as string,
    );
    if (metric?.direction === "binary") ensure(m.value === 0 || m.value === 1);
    if (metric?.unit === "٪")
      ensure((m.value as number) >= 0 && (m.value as number) <= 100);
  }
  for (const l of learnings) {
    strings(l, [
      "experimentId",
      "constraintId",
      "ideaId",
      "leverId",
      "statement",
      "evidence",
      "reusableInsight",
    ]);
    const e = experiments.find((e) => e.id === l.experimentId);
    ensure(
      e?.status === "completed" &&
        e.constraintId === l.constraintId &&
        e.ideaId === l.ideaId &&
        e.leverId === l.leverId &&
        !!(l.statement as string).trim() &&
        timestamp(l.createdAt),
    );
  }
  for (const d of ds) {
    strings(d, ["experimentId", "rationale", "context"]);
    ensure(
      experiments.some(
        (e) => e.id === d.experimentId && e.status === "completed",
      ) &&
        member(d.decision, decisions) &&
        !!(d.rationale as string).trim() &&
        timestamp(d.createdAt) &&
        typeof d.capacityReviewed === "boolean" &&
        typeof d.alignmentReviewed === "boolean",
    );
    if (d.decision === "scale")
      ensure(d.capacityReviewed && d.alignmentReviewed);
  }
  for (const r of reviews) {
    strings(r, ["ideaId", "experimentId", "reason"]);
    ensure(
      ["validated", "rejected", "review"].includes(r.status as string) &&
        !!(r.reason as string).trim() &&
        timestamp(r.createdAt) &&
        s.ideas.some((i) => i.id === r.ideaId) &&
        experiments.some(
          (e) =>
            e.id === r.experimentId &&
            e.ideaId === r.ideaId &&
            e.status === "completed",
        ),
    );
  }
}
const equal = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
export function assertExperimentTransition(
  before: ScaleStore,
  after: ScaleStore,
) {
  const a = experimentData(before),
    b = experimentData(after);
  for (const key of [
    "measurements",
    "learnings",
    "decisions",
    "ideaReviews",
  ] as const)
    for (const row of a[key])
      ensure(
        b[key].some((n) => n.id === row.id && equal(n, row)),
        "سوابق ثبت‌شده آزمایش قابل حذف یا بازنویسی نیستند.",
      );
  for (const e of a.experiments) {
    const next = b.experiments.find((x) => x.id === e.id);
    ensure(next, "آزمایش حذف نمی‌شود؛ از لغو استفاده کنید.");
    if (["completed", "cancelled"].includes(e.status))
      ensure(equal(e, next), "آزمایش بسته قابل بازنویسی نیست.");
    if (e.startedAt) {
      const mutable = [
        "status",
        "updatedAt",
        "executionNotes",
        "blockers",
        "confidenceAfter",
        "resultStatus",
        "resultRationale",
        "completedAt",
      ];
      for (const k of Object.keys(e) as (keyof GrowthExperiment)[])
        if (!mutable.includes(k))
          ensure(
            equal(e[k], next[k]),
            "طراحی و معیار آزمایش پس از شروع ثابت است.",
          );
    }
    const transitions: Record<string, string[]> = {
      draft: ["draft", "ready", "cancelled"],
      ready: ["ready", "draft", "running", "cancelled"],
      running: ["running", "paused", "completed", "cancelled"],
      paused: ["paused", "running", "completed", "cancelled"],
      completed: ["completed"],
      cancelled: ["cancelled"],
    };
    ensure(
      transitions[e.status].includes(next.status),
      "تغییر وضعیت آزمایش مجاز نیست.",
    );
    if (next.status === "ready" && e.status !== "ready")
      ensure(experimentReadiness(after, next).ready, "آزمایش هنوز آماده نیست.");
  }
  for (const e of b.experiments.filter(
    (e) => !a.experiments.some((x) => x.id === e.id),
  ))
    ensure(
      e.status === "draft" && !e.startedAt && !e.completedAt,
      "آزمایش جدید باید پیش‌نویس باشد.",
    );
  for (const m of b.measurements.filter(
    (m) => !a.measurements.some((x) => x.id === m.id),
  ))
    ensure(
      a.experiments.some(
        (e) => e.id === m.experimentId && e.status === "running",
      ),
      "اندازه‌گیری فقط هنگام اجرای آزمایش ثبت می‌شود.",
    );
}
