import type { SystemData } from "../types";
import { emptyMeasurement, type MeasurementStore } from "./model";
import { processHealth, reliableRole, type ProcessEvidence } from "./health";
import { effectiveSOPStatus } from "../standards/logic";
export function independenceTest(
  system: SystemData,
  store: MeasurementStore,
  evidence: (id: string) => ProcessEvidence,
  day: string,
) {
  const rows = system.processes
    .filter((p) => p.status === "active")
    .map((process) => {
      const e = evidence(process.id),
        r =
          store.records.find((r) => r.processId === process.id) ??
          emptyMeasurement(process.id),
        health = processHealth(r, e, day),
        sop =
          !!e.standard &&
          !!e.source &&
          effectiveSOPStatus(e.standard, e.source) === "approved",
        owner = reliableRole(system, process.ownerRoleId),
        founder = system.roles.find(
          (r) => r.id === process.ownerRoleId,
        )?.isFounderRole,
        decisions = health.founder.decisions,
        delegated = decisions.filter(
          (s) =>
            !health.founder.dependent(s) && reliableRole(system, s.ownerRoleId),
        );
      const risks: { label: string; action: string; severity: number }[] = [];
      const critical = process.priorityLevel === "critical";
      if (founder)
        risks.push({
          label: "مالکیت بنیان‌گذار",
          action:
            "مالکیت و حدود اختیار را به یک نقش غیر بنیان‌گذار واگذار کنید.",
          severity: critical ? 100 : 80,
        });
      if (!owner)
        risks.push({
          label: "مالک قابل اتکا ندارد",
          action: "برای نقش مالک، فرد فعال و مسئول مشخص کنید.",
          severity: critical ? 98 : 78,
        });
      if (
        health.founder.map?.steps.some(
          (s) =>
            s.type !== "start" &&
            s.type !== "end" &&
            !reliableRole(system, s.ownerRoleId),
        )
      )
        risks.push({
          label: "نقش عملیاتی بدون متصدی فعال",
          action: "برای نقش عملیاتی خالی، فرد فعال و آموزش‌دیده تعیین کنید.",
          severity: 82,
        });
      if (decisions.some((s) => health.founder.dependent(s)))
        risks.push({
          label: "تصمیم وابسته به بنیان‌گذار",
          action: "حد اختیار تصمیم و مسیر ارجاع به نقش جایگزین را مشخص کنید.",
          severity: 90,
        });
      if (!sop)
        risks.push({
          label: "SOP تأیید معتبر ندارد",
          action: "SOP مبتنی بر طراحی جاری را تکمیل و تأیید کنید.",
          severity: 75,
        });
      if (health.adoption === null || health.adoption < 70)
        risks.push({
          label: "پذیرش ضعیف",
          action: "آموزش نقش‌ها، پایلوت و آمادگی اجرا را تکمیل کنید.",
          severity: 70,
        });
      if (health.kpi.score === null)
        risks.push({
          label: "دید معتبر KPI ندارد",
          action: "شاخص فعال با هدف، مالک و حداقل یک اندازه‌گیری ثبت کنید.",
          severity: 65,
        });
      if (health.founder.score === null)
        risks.push({
          label: "نقشه عملیاتی کافی نیست",
          action: "نقشه عملیاتی و مالکیت مرحله‌ها را تکمیل کنید.",
          severity: 80,
        });
      if (health.score !== null && health.score < 60)
        risks.push({
          label: "سلامت پایین",
          action: "شکاف KPI و اقدامات عقب‌افتاده را در مرور هفتگی بررسی کنید.",
          severity: 85,
        });
      return {
        process,
        health,
        sop,
        owner,
        founder,
        decisions,
        delegated,
        risks: risks.sort((a, b) => b.severity - a.severity),
        risk: risks.length
          ? Math.max(...risks.map((x) => x.severity)) + (critical ? 10 : 0)
          : 0,
      };
    })
    .sort(
      (a, b) => b.risk - a.risk || a.process.code.localeCompare(b.process.code),
    );
  const critical = rows.filter((x) => x.process.priorityLevel === "critical"),
    ownershipRows = critical.length ? critical : rows,
    healthRows = critical.length ? critical : rows,
    total = rows.length,
    average = (values: number[]) =>
      values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0,
    keyRoles = system.roles.filter((r) => r.isKeyRole),
    decisions = rows.flatMap((x) => x.decisions),
    delegated = rows.flatMap((x) => x.delegated),
    parts = [
      {
        label: "استقلال بنیان‌گذار",
        weight: 25,
        value: average(rows.map((x) => (x.health.founder.score ?? 0) / 100)),
      },
      {
        label: "مالکیت فرآیندهای بحرانی",
        weight: 15,
        value: average(
          ownershipRows.map((x) => (x.owner && !x.founder ? 1 : 0)),
        ),
      },
      {
        label: "پوشش SOP تأییدشده",
        weight: 15,
        value: average(rows.map((x) => (x.sop ? 1 : 0))),
      },
      {
        label: "پذیرش",
        weight: 15,
        value: average(rows.map((x) => (x.health.adoption ?? 0) / 100)),
      },
      {
        label: "پوشش KPI معتبر",
        weight: 10,
        value: average(rows.map((x) => (x.health.kpi.score !== null ? 1 : 0))),
      },
      {
        label: "تفویض تصمیم",
        weight: 10,
        value: average(
          rows.map((x) =>
            x.health.founder.score === null
              ? 0
              : x.decisions.length
                ? x.delegated.length / x.decisions.length
                : 1,
          ),
        ),
      },
      {
        label: "پوشش نقش‌های کلیدی",
        weight: 5,
        value: average(
          keyRoles.map((r) =>
            reliableRole(system, r.id) && !r.isFounderRole ? 1 : 0,
          ),
        ),
      },
      {
        label: "سلامت فرآیندهای بحرانی",
        weight: 5,
        value: average(healthRows.map((x) => (x.health.score ?? 0) / 100)),
      },
    ];
  const score = total
      ? Math.round(parts.reduce((n, p) => n + p.weight * p.value, 0))
      : null,
    risks = rows
      .flatMap((x) =>
        x.risks.map((r) => ({
          ...r,
          process: x.process,
          rank: r.severity + (x.process.priorityLevel === "critical" ? 10 : 0),
        })),
      )
      .sort((a, b) => b.rank - a.rank),
    actions = risks.slice(0, 5),
    biggest = [...parts].sort(
      (a, b) => b.weight * (1 - b.value) - a.weight * (1 - a.value),
    )[0];
  return {
    score,
    parts,
    rows,
    risks,
    actions,
    biggest,
    delegated,
    label:
      score === null
        ? "داده‌ای وجود ندارد"
        : score >= 90
          ? "آماده اداره مستقل"
          : score >= 75
            ? "استقلال عملیاتی مناسب"
            : score >= 60
              ? "استقلال در حال شکل‌گیری"
              : score >= 40
                ? "استقلال پایین"
                : "بیزینس شدیداً وابسته به بنیان‌گذار",
    unknown: rows.filter((x) => x.health.score === null).length,
  };
}
