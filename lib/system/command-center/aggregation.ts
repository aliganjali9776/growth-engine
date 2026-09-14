import type { SystemData, PriorityLevel, Process } from "../types";
import type { MeasurementStore } from "../measurement/model";
import { emptyMeasurement } from "../measurement/model";
import { independenceTest } from "../measurement/independence";
import { reliableRole, type ProcessEvidence } from "../measurement/health";
import { kpiState } from "../measurement/kpis";
import {
  standardization,
  standardizedCurrent,
  effectiveSOPStatus,
  sourceChanged,
  implementation,
} from "../standards/logic";
import { founderStep, operational, mapMetrics } from "../maps/logic";
import { stageKeys, stages } from "../config";
export const priorityWeights: Record<PriorityLevel, number> = {
  critical: 1.5,
  high: 1.25,
  medium: 1,
  low: 0.75,
};
export function weightedMean(
  values: { value: number | null; priority: PriorityLevel }[],
) {
  const known = values.filter((x) => x.value !== null),
    weight = known.reduce((n, x) => n + priorityWeights[x.priority], 0);
  return weight
    ? known.reduce((n, x) => n + x.value! * priorityWeights[x.priority], 0) /
        weight
    : null;
}
export function ownershipConcentration(
  system: SystemData,
  processes: Process[],
) {
  return system.roles
    .map((role) => {
      const owned = processes.filter((p) => p.ownerRoleId === role.id),
        critical = owned.filter((p) => p.priorityLevel === "critical").length,
        share = processes.length ? owned.length / processes.length : 0;
      return {
        role,
        count: owned.length,
        critical,
        share,
        overloaded:
          (owned.length >= 4 && share >= 0.25) ||
          (role.isFounderRole && critical >= 2),
        covered: reliableRole(system, role.id),
      };
    })
    .filter((x) => x.count)
    .sort(
      (a, b) =>
        Number(b.overloaded) - Number(a.overloaded) ||
        b.count - a.count ||
        a.role.id.localeCompare(b.role.id),
    );
}
export function maturityDistribution(processes: Process[]) {
  const rows = stageKeys.map((stage) => ({
    stage,
    label: stages[stage],
    count: processes.filter((p) => p.systemizationStage === stage).length,
    percent: processes.length
      ? (processes.filter((p) => p.systemizationStage === stage).length /
          processes.length) *
        100
      : 0,
  }));
  const largest = [...rows].sort((a, b) => b.count - a.count)[0];
  return {
    rows,
    insight: processes.length
      ? `بیشترین تجمع در مرحله «${largest.label}» است (${largest.count} فرآیند). پیش‌نیازهای مرحله بعد را بررسی کنید؛ این توزیع، مدت توقف را نشان نمی‌دهد.`
      : "فرآیند فعال برای نمایش مسیر وجود ندارد.",
  };
}
export function commandFacts(
  system: SystemData,
  store: MeasurementStore,
  evidence: (id: string) => ProcessEvidence,
  day: string,
) {
  const independence = independenceTest(system, store, evidence, day),
    rows = independence.rows.map((row) => {
      const e = evidence(row.process.id),
        record =
          store.records.find((r) => r.processId === row.process.id) ??
          emptyMeasurement(row.process.id),
        standard =
          e.standard && e.source
            ? standardization(e.standard, e.source)
            : undefined,
        sopStatus =
          e.standard && e.source
            ? effectiveSOPStatus(e.standard, e.source)
            : "draft",
        approved = sopStatus === "approved",
        confirmed =
          !!e.standard &&
          !!e.source &&
          standardizedCurrent(e.standard, e.source),
        dod = !!e.standard?.sop?.definitionOfDone.some((x) => x.trim()),
        checklist = standard?.components[2].value ?? 0,
        decision = standard?.components[3].value ?? 0,
        standardScore =
          (approved ? 30 : 0) +
          (confirmed ? 20 : 0) +
          (dod ? 15 : 0) +
          checklist * 20 +
          (e.standard?.sop ? decision : 0) * 15,
        adoption =
          e.standard && e.source
            ? implementation(e.standard, e.source)
            : undefined,
        map = row.health.founder.map,
        founderSteps =
          map?.steps.filter((s) => operational(s) && founderStep(system, s)) ??
          [],
        founderOwned = !!system.roles.find(
          (r) => r.id === row.process.ownerRoleId,
        )?.isFounderRole,
        founderDependent = founderOwned || founderSteps.length > 0,
        metrics = map ? mapMetrics(map, system) : undefined;
      return {
        ...row,
        record,
        e,
        standard,
        sopStatus,
        approved,
        confirmed,
        dod,
        checklist,
        decision,
        standardScore,
        adoption,
        founderOwned,
        founderSteps,
        founderDependent,
        metrics,
        mismatch:
          !!e.standard?.sop &&
          !!e.source &&
          sourceChanged(e.standard.sop, e.source),
        eligibleKPI: ["implemented", "measured", "improving"].includes(
          row.process.systemizationStage,
        ),
        kpis: record.kpis
          .filter((k) => k.status === "active")
          .map((k) => ({ k, ...kpiState(k, record.entries) })),
      };
    });
  return { rows, independence };
}
export type CommandRow = ReturnType<typeof commandFacts>["rows"][number];
export type ComponentKey =
  | "processHealth"
  | "standardization"
  | "adoption"
  | "kpi"
  | "independence"
  | "improvement"
  | "ownership";
export interface HealthComponent {
  key: ComponentKey;
  label: string;
  weight: number;
  value: number | null;
  known: number;
  total: number;
  note: string;
}
export const healthStatus = (n: number | null) =>
  n === null
    ? "داده کافی نیست"
    : n < 40
      ? "بحرانی"
      : n < 60
        ? "ناپایدار"
        : n < 75
          ? "در حال تثبیت"
          : n < 90
            ? "سیستماتیک"
            : "پایدار و مقیاس‌پذیر";
export function aggregateHealth(rows: CommandRow[], system: SystemData) {
  const n = rows.length,
    mean = (get: (x: CommandRow) => number | null) =>
      weightedMean(
        rows.map((x) => ({ value: get(x), priority: x.process.priorityLevel })),
      ),
    eligible = rows.filter((x) => x.eligibleKPI),
    kpiCoverage = eligible.length
      ? (eligible.filter((x) => x.kpis.length).length / eligible.length) * 100
      : null,
    kpiPerformance = weightedMean(
      eligible.map((x) => ({
        value: x.health.kpi.score,
        priority: x.process.priorityLevel,
      })),
    ),
    critical = rows.filter((x) => x.process.priorityLevel === "critical"),
    criticalBase = critical.length ? critical : rows,
    nonFounder = criticalBase.length
      ? (criticalBase.filter((x) => !x.founderOwned && x.owner).length /
          criticalBase.length) *
        100
      : 0,
    founderMean = mean((x) => x.health.founder.score),
    concentration = ownershipConcentration(
      system,
      rows.map((x) => x.process),
    ),
    overloaded = new Set(
      concentration.filter((x) => x.overloaded).map((x) => x.role.id),
    ),
    keyRoles = system.roles.filter((r) => r.isKeyRole),
    ownerCoverage = n ? (rows.filter((x) => x.owner).length / n) * 100 : 0,
    keyCoverage = keyRoles.length
      ? (keyRoles.filter((r) => reliableRole(system, r.id)).length /
          keyRoles.length) *
        100
      : 0,
    distributed = n
      ? (rows.filter((x) => x.owner && !overloaded.has(x.process.ownerRoleId))
          .length /
          n) *
        100
      : 0;
  const components: HealthComponent[] = [
    {
      key: "processHealth",
      label: "سلامت فرآیندها",
      weight: 0,
      value: mean((x) => x.health.score),
      known: rows.filter((x) => x.health.score !== null).length,
      total: n,
      note: "شاخص تشخیصی مستقل؛ در جمع سلامت سیستم دوباره وزن نمی‌گیرد. اولویت بحرانی ۱٫۵، بالا ۱٫۲۵، متوسط ۱ و پایین ۰٫۷۵ است.",
    },
    {
      key: "standardization",
      label: "آمادگی استاندارد",
      weight: 20,
      value: n ? mean((x) => x.standardScore) : null,
      known: rows.filter((x) => x.e.standard?.sop).length,
      total: n,
      note: "برای هر فرآیند: SOP معتبر ۳۰ + استانداردسازی تأییدشده ۲۰ + پایان صحیح ۱۵ + پوشش چک‌لیست ۲۰ + قواعد تصمیم ۱۵؛ نبود استاندارد، شکاف آمادگی واقعی است.",
    },
    {
      key: "adoption",
      label: "پذیرش",
      weight: 20,
      value: mean((x) => x.adoption?.score ?? null),
      known: rows.filter((x) => x.adoption).length,
      total: n,
      note: "میانگین وزنی امتیاز پذیرش برنامه‌های موجود؛ نبود برنامه، ناشناخته است.",
    },
    {
      key: "kpi",
      label: "دید و عملکرد KPI",
      weight: 22.5,
      value:
        kpiCoverage !== null && kpiPerformance !== null
          ? 0.4 * kpiCoverage + 0.6 * kpiPerformance
          : null,
      known: eligible.filter((x) => x.health.kpi.score !== null).length,
      total: eligible.length,
      note: "۴۰٪ پوشش شاخص فعال فرآیندهای پیاده‌سازی/اندازه‌گیری/بهبود + ۶۰٪ میانگین وزنی عملکرد موجود همان فرآیندها؛ بدون عملکرد معتبر امتیاز ترکیبی ساخته نمی‌شود.",
    },
    {
      key: "independence",
      label: "استقلال بنیان‌گذار",
      weight: 18.75,
      value: founderMean === null ? null : 0.8 * founderMean + 0.2 * nonFounder,
      known: rows.filter((x) => x.health.founder.score !== null).length,
      total: n,
      note: "۸۰٪ میانگین وزنی استقلال فرآیندها + ۲۰٪ مالکیت قابل اتکای غیر بنیان‌گذار در فرآیندهای بحرانی.",
    },
    {
      key: "improvement",
      label: "انضباط بهبود",
      weight: 13.75,
      value: mean((x) =>
        x.record.improvements.length || x.record.reviews.length
          ? x.health.discipline.score
          : null,
      ),
      known: rows.filter(
        (x) => x.record.improvements.length || x.record.reviews.length,
      ).length,
      total: n,
      note: "میانگین وزنی انضباط بهبود فرآیندهای دارای مرور یا اقدام؛ شامل تازگی مرور، مالک، موعد، تأخیر و تکمیل.",
    },
    {
      key: "ownership",
      label: "مالکیت و پوشش نقش",
      weight: 5,
      value: n
        ? 0.5 * ownerCoverage +
          0.2 * keyCoverage +
          0.2 * distributed +
          0.1 * nonFounder
        : null,
      known: rows.filter((x) => x.owner).length,
      total: n,
      note: "مالک قابل اتکا ۵۰٪ + پوشش نقش کلیدی ۲۰٪ + مالکیت بدون تمرکز زیاد ۲۰٪ + مالک غیر بنیان‌گذار فرآیند بحرانی ۱۰٪.",
    },
  ];
  const usedWeight = components
      .filter((c) => c.value !== null)
      .reduce((n, c) => n + c.weight, 0),
    score =
      n && usedWeight
        ? Math.round(
            components.reduce((n, c) => n + (c.value ?? 0) * c.weight, 0) /
              usedWeight,
          )
        : null;
  const checks = [
    { label: "فهرست فرآیندها", weight: 10, value: n ? 1 : 0 },
    { label: "مالکیت قابل اتکا", weight: 15, value: ownerCoverage / 100 },
    {
      label: "داده SOP",
      weight: 15,
      value: n
        ? rows.filter((x) => x.e.standard?.sop && x.e.source).length / n
        : 0,
    },
    {
      label: "برنامه پذیرش",
      weight: 15,
      value: n ? rows.filter((x) => x.adoption).length / n : 0,
    },
    {
      label: "اندازه‌گیری معتبر",
      weight: 25,
      value: eligible.length
        ? eligible.filter((x) => x.health.kpi.score !== null).length /
          eligible.length
        : 0,
    },
    {
      label: "مرور یا اقدام بهبود",
      weight: 10,
      value: n
        ? rows.filter(
            (x) => x.record.improvements.length || x.record.reviews.length,
          ).length / n
        : 0,
    },
    {
      label: "نقشه عملیاتی",
      weight: 10,
      value: n
        ? rows.filter((x) => x.health.founder.score !== null).length / n
        : 0,
    },
  ];
  return {
    score,
    status: healthStatus(score),
    components,
    usedWeight,
    partial: usedWeight < 100 || checks.some((x) => x.value < 1),
    completeness: Math.round(
      checks.reduce((n, x) => n + x.weight * x.value, 0),
    ),
    checks,
    kpiCoverage,
    kpiPerformance,
    concentration,
    ownerCoverage,
    keyCoverage,
  };
}
export function departmentHealth(rows: CommandRow[], system: SystemData) {
  return system.departments
    .filter((d) => d.status === "active")
    .map((department) => {
      const own = rows.filter((x) => x.process.departmentId === department.id),
        health = aggregateHealth(own, {
          ...system,
          roles: system.roles.filter((r) => r.departmentId === department.id),
        });
      return {
        department,
        health,
        count: own.length,
        critical: own.filter((x) => x.process.priorityLevel === "critical")
          .length,
        founder: own.filter((x) => x.founderDependent).length,
        open: own.reduce((n, x) => n + x.health.discipline.open.length, 0),
      };
    })
    .sort((a, b) => (a.health.score ?? -1) - (b.health.score ?? -1));
}
