import type { ScaleStore } from "../model";
import {
  experimentData,
  type GrowthExperiment,
  type GrowthMetric,
  type ExperimentMeasurement,
  type ExperimentDecision,
  results,
} from "./model";
const filled = (s: string) => !!s.trim();
export const validDay = (s: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  !Number.isNaN(Date.parse(s)) &&
  new Date(s + "T00:00:00Z").toISOString().slice(0, 10) === s;
export function tehranDay(at = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}
const days = (a: string, b: string) =>
  Math.floor((Date.parse(b) - Date.parse(a)) / 86400000);
export function metricFor(
  s: ScaleStore,
  e: GrowthExperiment,
  id = e.primaryMetricId,
) {
  return (
    e.snapshot?.metrics.find((m) => m.id === id) ??
    experimentData(s).metrics.find((m) => m.id === id)
  );
}
export function experimentReadiness(s: ScaleStore, e: GrowthExperiment) {
  const m = metricFor(s, e),
    c = s.constraints.find((c) => c.id === e.constraintId);
  const items = [
    {
      label: "گلوگاه باز",
      ready: !!c && !["resolved", "archived"].includes(c.status),
    },
    {
      label: "فرضیه با تغییر، مخاطب، حرکت و دلیل",
      ready: Object.values(e.hypothesis).every(filled),
    },
    { label: "نقش مسئول", ready: filled(e.ownerRoleId) },
    { label: "شاخص اصلی", ready: !!m },
    {
      label: "خط مبنا و دوره اندازه‌گیری",
      ready:
        !!m &&
        (m.direction === "binary" || e.baselineValue !== null) &&
        filled(e.baselinePeriod) &&
        filled(e.baselineSource),
    },
    {
      label: "معیار موفقیت و هدف",
      ready:
        filled(e.successCriteria) &&
        !!m &&
        (m.direction === "binary" || e.targetValue !== null),
    },
    {
      label: "طراحی و دامنه آزمایش",
      ready:
        filled(e.experimentDesign.change) &&
        filled(e.experimentDesign.audience),
    },
    {
      label: "تاریخ شروع و پایان معتبر",
      ready:
        validDay(e.startDate) &&
        validDay(e.endDate) &&
        e.startDate <= e.endDate,
    },
  ];
  return {
    ready: items.every((i) => i.ready),
    items,
    missing: items.filter((i) => !i.ready).map((i) => i.label),
  };
}
export function experimentQuality(s: ScaleStore, e: GrowthExperiment) {
  const r = experimentReadiness(s, e);
  const parts = [
    { label: "فرضیه", weight: 20, ready: r.items[1].ready },
    { label: "شاخص اصلی", weight: 15, ready: r.items[3].ready },
    { label: "خط مبنا", weight: 15, ready: r.items[4].ready },
    { label: "معیار موفقیت", weight: 20, ready: r.items[5].ready },
    { label: "طراحی", weight: 15, ready: r.items[6].ready },
    {
      label: "مسئول / تاریخ",
      weight: 10,
      ready: r.items[2].ready && r.items[7].ready,
    },
    {
      label: "شاخص محافظ یا زمینه مقایسه",
      weight: 5,
      ready:
        !!e.secondaryMetricIds.length || filled(e.experimentDesign.comparison),
    },
  ];
  return {
    parts,
    score: parts.reduce((n, p) => n + (p.ready ? p.weight : 0), 0),
  };
}
export function experimentProgressTime(e: GrowthExperiment, day = tehranDay()) {
  if (!validDay(e.startDate) || !validDay(e.endDate))
    return { elapsed: null, remaining: null };
  return {
    elapsed: e.startedAt
      ? Math.max(
          0,
          days(
            tehranDay(new Date(e.startedAt)),
            e.completedAt ? tehranDay(new Date(e.completedAt)) : day,
          ),
        )
      : 0,
    remaining: Math.max(0, days(day, e.endDate)),
  };
}
export function measurementsFor(
  s: ScaleStore,
  e: GrowthExperiment,
  id = e.primaryMetricId,
) {
  return experimentData(s)
    .measurements.filter((m) => m.experimentId === e.id && m.metricId === id)
    .sort(
      (a, b) =>
        a.measurementDate.localeCompare(b.measurementDate) ||
        a.createdAt.localeCompare(b.createdAt) ||
        a.id.localeCompare(b.id),
    );
}
export function measurementDelta(
  value: number,
  baseline: number | null,
  previous: number | null,
) {
  return {
    baseline: baseline === null ? null : value - baseline,
    previous: previous === null ? null : value - previous,
  };
}
export function directionAwareImprovement(
  m: GrowthMetric,
  actual: number,
  baseline: number,
  target: number | null,
) {
  return m.direction === "decrease"
    ? baseline - actual
    : m.direction === "maintain"
      ? Math.abs(baseline - (target ?? baseline)) -
        Math.abs(actual - (target ?? baseline))
      : m.direction === "binary"
        ? actual === 1
          ? 1
          : -1
        : actual - baseline;
}
export function suggestExperimentResult(
  s: ScaleStore,
  e: GrowthExperiment,
): { status: keyof typeof results; reason: string; actual: number | null } {
  const m = metricFor(s, e),
    history = measurementsFor(s, e),
    actual = history.at(-1)?.value ?? null;
  const out = (status: keyof typeof results, reason: string) => ({
    status,
    reason,
    actual,
  });
  if (!m || actual === null)
    return out("inconclusive", "مشاهده شاخص اصلی کافی نیست.");
  if (m.direction === "binary")
    return out(
      actual === 1 ? "win" : "negative",
      actual === 1 ? "پذیرش ثبت شده است." : "پذیرش ثبت نشده است.",
    );
  if (e.baselineValue === null || e.targetValue === null)
    return out("inconclusive", "خط مبنا یا هدف موجود نیست.");
  if (m.direction === "maintain")
    return out(
      Math.abs(actual - e.targetValue) <= e.tolerance ? "win" : "negative",
      "مقایسه با سطح هدف و تلورانس مطلق ثبت‌شده.",
    );
  const improvement = directionAwareImprovement(
    m,
    actual,
    e.baselineValue,
    e.targetValue,
  );
  if (Math.abs(improvement) <= e.tolerance)
    return out(
      "noEffect",
      "تغییر در محدوده آستانه مطلق ثبت‌شده است؛ ادعای معنی‌داری آماری نیست.",
    );
  if (improvement < 0)
    return out("negative", "حرکت مشاهده‌شده خلاف جهت مطلوب است.");
  const reached = (v: number) =>
    m.direction === "increase" ? actual >= v : actual <= v;
  if (reached(e.targetValue))
    return out("win", "هدف از پیش تعیین‌شده مشاهده شد.");
  if (e.minimumSuccessThreshold !== null && reached(e.minimumSuccessThreshold))
    return out("partial", "حداقل موفقیت مشاهده شد، اما هدف کامل نه.");
  return out(
    "inconclusive",
    "بهبود مشاهده شد ولی به حداقل موفقیت تعریف‌شده نرسید.",
  );
}
export function experimentStaleness(
  s: ScaleStore,
  e: GrowthExperiment,
  day = tehranDay(),
) {
  const d = experimentData(s),
    last =
      d.measurements
        .filter(
          (m) => m.experimentId === e.id && m.metricId === e.primaryMetricId,
        )
        .map((m) => m.measurementDate)
        .sort()
        .at(-1) ?? (e.startedAt ? tehranDay(new Date(e.startedAt)) : day);
  return e.status === "running" && days(last, day) > d.staleDays;
}
export function decisionReadiness(
  decision: ExperimentDecision["decision"],
  rationale: string,
  learning: string,
  capacityReviewed: boolean,
  alignmentReviewed: boolean,
) {
  const missing = [];
  if (!filled(learning)) missing.push("یادگیری");
  if (!filled(rationale)) missing.push("دلیل تصمیم");
  if (decision === "scale" && !capacityReviewed)
    missing.push("بررسی شواهد ظرفیت");
  if (decision === "scale" && !alignmentReviewed)
    missing.push("بررسی هم‌راستایی استراتژی");
  return { ready: !missing.length, missing };
}
export function scaleCapacitySignals(
  capacity: { id: string; title: string; risk: boolean; reasons: string[] }[],
  processId: string,
) {
  const related = processId
    ? capacity.filter((p) => p.id === processId)
    : capacity;
  return { known: related.length > 0, risks: related.filter((p) => p.risk) };
}
export function experimentPortfolioSummary(s: ScaleStore) {
  const d = experimentData(s),
    done = d.experiments.filter((e) => e.status === "completed"),
    durations = done
      .filter((e) => e.startedAt && e.completedAt)
      .map((e) =>
        Math.max(
          0,
          (Date.parse(e.completedAt!) - Date.parse(e.startedAt!)) / 86400000,
        ),
      );
  return {
    total: d.experiments.length,
    completed: done.length,
    learnings: d.learnings.length,
    averageDuration: durations.length
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : null,
    distribution: Object.fromEntries(
      Object.keys(results).map((r) => [
        r,
        done.filter((e) => e.resultStatus === r).length,
      ]),
    ),
  };
}
export function leverEvidenceSummary(s: ScaleStore, id: string) {
  const d = experimentData(s);
  return d.experiments.filter((e) => e.leverId === id);
}
export function constraintExperimentSummary(s: ScaleStore, id: string) {
  const d = experimentData(s),
    experiments = d.experiments.filter((e) => e.constraintId === id);
  return {
    experiments,
    learnings: d.learnings.filter((l) => l.constraintId === id),
    distribution: Object.fromEntries(
      Object.keys(results).map((r) => [
        r,
        experiments.filter(
          (e) => e.status === "completed" && e.resultStatus === r,
        ).length,
      ]),
    ),
  };
}
export function experimentNeedsAttention(
  s: ScaleStore,
  capacityRisk = false,
  day = tehranDay(),
) {
  const d = experimentData(s),
    items: { text: string; href: string }[] = [];
  const add = (e: GrowthExperiment, text: string) =>
    items.push({
      text: `${e.code}: ${text}`,
      href: `/scale/experiments/${e.id}`,
    });
  for (const e of d.experiments) {
    if (e.status === "ready") add(e, "آماده است؛ شروع هنوز تأیید نشده.");
    if (experimentStaleness(s, e, day))
      add(e, "آزمایش در حال اجراست اما داده جدید ثبت نشده است.");
    if (
      e.status === "running" &&
      days(day, e.endDate) <= 3 &&
      measurementsFor(s, e).length < 2
    )
      add(e, "پایان نزدیک یا گذشته است؛ کمتر از دو مشاهده دارید.");
    if (e.status === "completed") {
      if (!e.resultStatus) add(e, "نتیجه نهایی ثبت نشده.");
      if (!d.learnings.some((l) => l.experimentId === e.id))
        add(e, "یادگیری ثبت نشده.");
      if (!d.decisions.some((x) => x.experimentId === e.id))
        add(e, "تصمیم ثبت نشده.");
      if (e.resultStatus === "win" && capacityRisk)
        add(e, "نتیجه موفق با ریسک ظرفیت سیستم؛ پیش از گسترش بررسی کنید.");
    }
  }
  for (const lever of s.levers) {
    const negative = d.experiments.filter(
      (e) =>
        e.leverId === lever.id &&
        e.status === "completed" &&
        e.resultStatus === "negative",
    );
    if (negative.length >= 2)
      add(
        negative.at(-1)!,
        `چند نتیجه منفی برای اهرم ${lever.name} ثبت شده؛ رتبه قطعی اثربخشی نیست.`,
      );
  }
  for (const c of s.constraints.filter((c) => c.status === "active")) {
    const related = d.experiments.filter((e) => e.constraintId === c.id);
    if (
      related.length &&
      related.some((e) => days(tehranDay(new Date(e.createdAt)), day) > 30) &&
      !d.learnings.some(
        (l) =>
          l.constraintId === c.id &&
          days(tehranDay(new Date(l.createdAt)), day) <= 30,
      )
    )
      items.push({
        text: `${c.title}: آزمایش دارید اما در ۳۰ روز اخیر یادگیری ثبت نشده.`,
        href: `/scale/constraints/${c.id}`,
      });
  }
  return items;
}
