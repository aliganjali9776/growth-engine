import type { PreparedAction } from "../preparation/types";
import type { PreparationContext } from "../preparation/context";
import type { AgentDomainCommand, ExecutionStorage } from "./types";
import { executable } from "./registry";
import { canonical } from "../actions";
import {
  createMeasurementItem,
  persistMeasurement,
} from "../../system/measurement/commands";
import { MEASUREMENT_KEY } from "../../system/measurement/persistence";
import type {
  ImprovementItem,
  ProcessKPI,
} from "../../system/measurement/model";
import {
  STRATEGY_KEY,
  saveObjective,
  type StrategyObjective,
  type StrategyStore,
} from "../../strategy/model";
import { persistStrategy } from "../../domain-services/strategy-persistence";
import { saveInitiative } from "../../strategy/initiatives/mutations";
import { saveKR } from "../../strategy/kr/mutations";
import type { KeyResult } from "../../strategy/kr/types";
import type { StrategicInitiative } from "../../strategy/initiatives/types";
import { SCALE_KEY, type ScaleStore, type GrowthIdea } from "../../scale/model";
import { saveIdea, persistScale } from "../../scale/persistence";
import { saveExperiment } from "../../scale/experiments/mutations";
import {
  experimentData,
  type GrowthExperiment,
} from "../../scale/experiments/model";
import {
  readinessData,
  type ScalePreparationItem,
} from "../../scale/readiness/model";
import { savePreparation } from "../../scale/readiness/mutations";
export function domainCommand(
  a: PreparedAction,
  at = new Date().toISOString(),
): AgentDomainCommand {
  const cap = executable(a.templateId);
  if (!cap) throw Error("ExecutionNotAllowed");
  return {
    commandId: "command:" + a.id,
    capabilityId: cap.capabilityId,
    domain: cap.domain,
    entityType: cap.entityType,
    operation: "create",
    payload: structuredClone(a.payload),
    sourceActionId: a.id,
    expectedState: structuredClone(a.expectedCurrentState),
    requestedAt: at,
  };
}
export function createdEntity(c: PreparationContext, a: PreparedAction) {
  const id = String(a.payload.id);
  switch (a.templateId) {
    case "Improvement":
      return c.measurement?.records
        .flatMap((r) => r.improvements)
        .find((x) => x.id === id);
    case "KPI":
      return c.measurement?.records
        .flatMap((r) => r.kpis)
        .find((x) => x.id === id);
    case "Objective":
      return c.strategy?.objectives.find((x) => x.id === id);
    case "KR":
      return c.strategy?.keyResults?.find((x) => x.id === id);
    case "Initiative":
      return c.strategy?.initiatives?.find((x) => x.id === id);
    case "GrowthIdea":
      return c.scale?.ideas.find((x) => x.id === id);
    case "Experiment":
      return (
        c.scale && experimentData(c.scale).experiments.find((x) => x.id === id)
      );
    case "ScalePreparation":
      return (
        c.scale && readinessData(c.scale).preparation.find((x) => x.id === id)
      );
  }
}
// Minimal result snapshot: retain approved business fields, not full histories/store copies.
export function resultSnapshot(
  a: PreparedAction,
  row: unknown,
): Record<string, unknown> {
  const value = row as Record<string, unknown>,
    keys = new Set([
      "id",
      "status",
      "lifecycle",
      ...Object.keys(a.payload).filter(
        (k) => !["history", "createdAt", "updatedAt"].includes(k),
      ),
    ]);
  return Object.fromEntries(
    [...keys]
      .filter((k) => Object.hasOwn(value, k))
      .map((k) => [k, structuredClone(value[k])]),
  );
}
export function matchesResult(a: PreparedAction, row: unknown) {
  if (!row) return false;
  const value = row as Record<string, unknown>;
  return Object.entries(a.payload)
    .filter(
      ([k]) =>
        !["createdAt", "updatedAt", "history", "lastUpdateAt"].includes(k),
    )
    .every(([k, v]) => canonical(value[k]) === canonical(v));
}
export function resultRef(a: PreparedAction) {
  const cap = executable(a.templateId)!;
  const id = String(a.payload.id),
    p = a.payload;
  const routes: Partial<Record<PreparedAction["templateId"], string>> = {
    Improvement: `/system/processes/${p.processId}/improvements?item=${id}`,
    KPI: `/system/processes/${p.processId}/kpis?kpi=${id}`,
    Objective: `/strategy/cycles/${p.cycleId}/objectives/${id}`,
    KR: `/strategy/key-results?kr=${id}`,
    Initiative: `/strategy/initiatives/${id}`,
    GrowthIdea: `/scale/ideas/${id}`,
    Experiment: `/scale/experiments/${id}`,
    ScalePreparation: `/scale/readiness/${p.candidateId}?preparation=${id}`,
  };
  return {
    domain: cap.domain,
    entityType: cap.entityType,
    entityId: id,
    label: a.title,
    route: routes[a.templateId],
  };
}
export function SystemAgentExecutionAdapter(
  a: PreparedAction,
  c: PreparationContext,
) {
  if (!c.system) throw Error("System unavailable");
  const next = createMeasurementItem(
    c.measurement ?? { version: 1, records: [] },
    c.system,
    a.templateId === "KPI" ? "kpis" : "improvements",
    structuredClone(a.payload) as unknown as ImprovementItem | ProcessKPI,
  );
  return { key: MEASUREMENT_KEY, next };
}
export function StrategyAgentExecutionAdapter(
  a: PreparedAction,
  c: PreparationContext,
) {
  if (!c.strategy) throw Error("Strategy unavailable");
  let next: StrategyStore;
  switch (a.templateId) {
    case "Initiative":
      next = saveInitiative(
        c.strategy,
        structuredClone(a.payload) as unknown as StrategicInitiative,
        c.sources.roles,
      );
      break;
    case "KR":
      next = saveKR(
        c.strategy,
        structuredClone(a.payload) as unknown as KeyResult,
      );
      break;
    case "Objective":
      next = saveObjective(
        c.strategy,
        structuredClone(a.payload) as unknown as StrategyObjective,
        c.sources.roles,
      );
      break;
    default:
      throw Error("ExecutionNotAllowed");
  }
  return { key: STRATEGY_KEY, next };
}
export function ScaleAgentExecutionAdapter(
  a: PreparedAction,
  c: PreparationContext,
) {
  if (!c.scale) throw Error("Scale unavailable");
  let next: ScaleStore;
  switch (a.templateId) {
    case "GrowthIdea":
      next = saveIdea(
        c.scale,
        structuredClone(a.payload) as unknown as GrowthIdea,
      );
      break;
    case "Experiment":
      next = saveExperiment(
        c.scale,
        structuredClone(a.payload) as unknown as GrowthExperiment,
      );
      break;
    case "ScalePreparation":
      next = savePreparation(
        c.scale,
        structuredClone(a.payload) as unknown as ScalePreparationItem,
      );
      break;
    default:
      throw Error("ExecutionNotAllowed");
  }
  return { key: SCALE_KEY, next };
}
export function simulateDomain(a: PreparedAction, c: PreparationContext) {
  switch (executable(a.templateId)?.domain) {
    case "System":
      return SystemAgentExecutionAdapter(a, c);
    case "Strategy":
      return StrategyAgentExecutionAdapter(a, c);
    case "Scale":
      return ScaleAgentExecutionAdapter(a, c);
    default:
      throw Error("ExecutionNotAllowed");
  }
}
export function commitDomain(
  storage: ExecutionStorage,
  simulation: ReturnType<typeof simulateDomain>,
  expected: string | null,
) {
  switch (simulation.key) {
    case MEASUREMENT_KEY:
      return persistMeasurement(
        storage,
        simulation.next as Parameters<typeof persistMeasurement>[1],
        expected,
      );
    case STRATEGY_KEY:
      return persistStrategy(
        storage,
        simulation.next as StrategyStore,
        expected,
      );
    case SCALE_KEY:
      return persistScale(storage, simulation.next as ScaleStore, expected);
    default:
      throw Error("ExecutionNotAllowed");
  }
}
