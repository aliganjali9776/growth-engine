import { parseSystem, SYSTEM_STORAGE_KEY } from "../system/persistence";
import { parseStrategy, STRATEGY_KEY, cycleStatuses } from "../strategy/model";
import { parseDraft, STORAGE_KEY } from "../assessment/persistence";
import { calculateScores, isComplete } from "../assessment/scoring";
import { parseMaps, MAP_STORAGE_KEY } from "../system/maps/persistence";
import { parseAnalysis, ANALYSIS_KEY } from "../system/analysis/persistence";
import { parseStandards, STANDARDS_KEY } from "../system/standards/persistence";
import {
  parseMeasurement,
  MEASUREMENT_KEY,
} from "../system/measurement/persistence";
import { processHealth } from "../system/measurement/health";
import { independenceTest } from "../system/measurement/independence";
import { emptyMeasurement, today } from "../system/measurement/model";
export function readScaleSources(storage: Pick<Storage, "getItem">) {
  const notices: string[] = [];
  const sourceNames: Record<string, string> = {
    [SYSTEM_STORAGE_KEY]: "سازمان و فرآیندها",
    [STRATEGY_KEY]: "استراتژی",
    [STORAGE_KEY]: "ارزیابی",
    [MAP_STORAGE_KEY]: "نقشه فرآیند",
    [ANALYSIS_KEY]: "تحلیل فرآیند",
    [STANDARDS_KEY]: "استانداردهای فرآیند",
    [MEASUREMENT_KEY]: "سنجش سیستم",
  };
  function read<T>(key: string, parse: (raw: string) => T): T | null {
    try {
      const raw = storage.getItem(key);
      return raw === null ? null : parse(raw);
    } catch {
      notices.push(
        `منبع ${sourceNames[key] ?? "مرتبط"} قابل خواندن نیست؛ مقدار ناشناخته نمایش داده می‌شود.`,
      );
      return null;
    }
  }
  const system = read(SYSTEM_STORAGE_KEY, parseSystem),
    strategy = read(STRATEGY_KEY, parseStrategy),
    assessment = read(STORAGE_KEY, parseDraft);
  const maps = read(MAP_STORAGE_KEY, parseMaps),
    analysis = read(ANALYSIS_KEY, parseAnalysis),
    standards = read(STANDARDS_KEY, parseStandards),
    measurement = read(MEASUREMENT_KEY, parseMeasurement);
  const activeCycle =
    strategy?.cycles.find((c) => c.status === "active") ?? null;
  const objectives =
    strategy?.objectives.filter(
      (o) =>
        o.status !== "cancelled" &&
        strategy.cycles.some(
          (c) => c.id === o.cycleId && c.status !== "archived",
        ),
    ) ?? [];
  const keyResults = (strategy?.keyResults ?? []).filter(
    (k) =>
      k.lifecycle === "active" &&
      objectives.some((o) => o.id === k.objectiveId),
  );
  const processes =
    system?.processes.filter((p) => p.status === "active") ?? [];
  const capacity = processes.map((p) => {
    const asis = maps?.maps.find((m) => m.processId === p.id),
      a = analysis?.records.find((r) => r.processId === p.id),
      standard = standards?.records.find((r) => r.processId === p.id);
    const record = measurement?.records.find((r) => r.processId === p.id);
    const h =
      system && asis
        ? processHealth(
            record ?? emptyMeasurement(p.id),
            {
              system,
              asis,
              standard,
              source: a ? { system, asis, analysis: a } : undefined,
            },
            today(),
          )
        : null;
    const reasons: string[] = [];
    if (["high", "critical"].includes(p.founderDependency))
      reasons.push("وابستگی زیاد ثبت‌شده در شناسنامه فرآیند");
    if (h?.score !== null && h?.score !== undefined && h.score < 60)
      reasons.push("سلامت محاسبه‌شده کمتر از ۶۰");
    if (
      h?.founder.score !== null &&
      h?.founder.score !== undefined &&
      h.founder.score < 50
    )
      reasons.push("استقلال محاسبه‌شده کمتر از ۵۰");
    return {
      id: p.id,
      title: p.name,
      health: h?.score ?? null,
      independence: h?.founder.score ?? null,
      standardization: standard && h ? h.std : null,
      adoption: h?.adoption ?? null,
      kpi: h?.kpi.score ?? null,
      ownerRoleId: p.ownerRoleId,
      founderDependency: p.founderDependency,
      critical: p.priorityLevel === "critical",
      reasons,
      risk: reasons.length > 0,
    };
  });
  const independence30 = system
    ? independenceTest(
        system,
        measurement ?? { version: 1, records: [] },
        (id) => {
          const asis = maps?.maps.find((m) => m.processId === id),
            a = analysis?.records.find((r) => r.processId === id),
            standard = standards?.records.find((r) => r.processId === id);
          return {
            system,
            asis,
            standard,
            source: asis && a ? { system, asis, analysis: a } : undefined,
          };
        },
        today(),
      ).rows.map((r) => ({
        processId: r.process.id,
        ownerReliable: r.owner,
        sopApproved: r.sop,
        risks: r.risks.map((x) => x.label),
      }))
    : [];
  return {
    independence30,
    priorities: strategy?.priorities ?? [],
    notices,
    roles: system?.roles ?? [],
    processes,
    capacity,
    activeCycle,
    cycleLabels: Object.fromEntries(
      (strategy?.cycles ?? []).map((c) => [
        c.id,
        `${c.name} · ${cycleStatuses[c.status]}`,
      ]),
    ),
    objectives,
    keyResults,
    systemKPIs:
      measurement?.records.flatMap((r) =>
        r.kpis.filter((k) => k.status !== "archived"),
      ) ?? [],
    assessmentModel: assessment?.profile.model ?? "",
    assessmentScale:
      assessment?.completedAt && isComplete(assessment.answers)
        ? calculateScores(assessment.answers).scores.scale
        : null,
  };
}
export type ScaleSources = ReturnType<typeof readScaleSources>;
export function systemCapacitySignals(s: ScaleSources) {
  return s.capacity.filter((p) => p.risk);
}
