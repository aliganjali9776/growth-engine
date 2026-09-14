import type { SystemData } from "../types";
import type { MeasurementStore } from "../measurement/model";
import type { ProcessEvidence } from "../measurement/health";
import {
  commandFacts,
  aggregateHealth,
  departmentHealth,
  maturityDistribution,
} from "./aggregation";
import {
  systemRisks,
  managementActions,
  managementFocus,
  executiveSummary,
} from "./risks";
export function commandReport(
  system: SystemData,
  store: MeasurementStore,
  evidence: (id: string) => ProcessEvidence,
  day: string,
) {
  const facts = commandFacts(system, store, evidence, day),
    health = aggregateHealth(facts.rows, system),
    risks = systemRisks(facts.rows, system, day),
    focus = facts.rows.length
      ? managementFocus(health.components)
      : {
          ...managementFocus(health.components),
          title: "ثبت اولین فرآیند و مالک آن",
          reason: "ابتدا ساختار سازمانی و فهرست فرآیندها را تکمیل کنید.",
        };
  return {
    ...facts,
    health,
    risks,
    focus,
    actions: managementActions(risks),
    summary: executiveSummary(
      health.score,
      health.status,
      health.completeness,
      risks,
      focus,
      facts.rows.length,
    ),
    departments: departmentHealth(facts.rows, system),
    maturity: maturityDistribution(facts.rows.map((x) => x.process)),
    day,
  };
}
export type CommandReport = ReturnType<typeof commandReport>;
