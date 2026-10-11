import { readScaleSources } from "../../scale/sources";
import { parseSystem, SYSTEM_STORAGE_KEY } from "../../system/persistence";
import { parseStrategy, STRATEGY_KEY } from "../../strategy/model";
import { parseScale } from "../../scale/persistence";
import { SCALE_KEY } from "../../scale/model";
import {
  parseMeasurement,
  MEASUREMENT_KEY,
} from "../../system/measurement/persistence";
import {
  parseStandards,
  STANDARDS_KEY,
} from "../../system/standards/persistence";
import { experimentData } from "../../scale/experiments/model";
import { readinessData } from "../../scale/readiness/model";
import { funnelData } from "../../scale/funnel/model";
import { networkData } from "../../scale/network/model";
import { readDiagnosis } from "../../diagnosis-storage";
import { diagnosisContextVersion } from "../diagnosis/freshness";
import { canonical } from "../actions";
import { fingerprint } from "../diagnosis/identity";
import type { AgentEntityRef } from "../types";
export type Reader = Pick<Storage, "getItem">;
export function preparationContext(reader: Reader) {
  const notices: string[] = [];
  function read<T>(key: string, parse: (raw: string) => T): T | null {
    try {
      const raw = reader.getItem(key);
      return raw ? parse(raw) : null;
    } catch {
      notices.push("منبع قابل خواندن نیست: " + key);
      return null;
    }
  }
  const system = read(SYSTEM_STORAGE_KEY, parseSystem),
    strategy = read(STRATEGY_KEY, parseStrategy),
    scale = read(SCALE_KEY, parseScale),
    measurement = read(MEASUREMENT_KEY, parseMeasurement),
    standards = read(STANDARDS_KEY, parseStandards);
  const sources = readScaleSources(reader),
    diagnosis = readDiagnosis(reader);
  const entities: { ref: AgentEntityRef; value: Record<string, unknown> }[] =
    [];
  function add(
    domain: AgentEntityRef["domain"],
    entityType: string,
    rows: unknown[],
    label: string,
    route: string,
  ) {
    for (const row of rows) {
      const v = row as Record<string, unknown>;
      entities.push({
        ref: {
          domain,
          entityType,
          entityId: String(v.id),
          label: String(v[label]),
          route: route + encodeURIComponent(String(v.id)),
        },
        value: v,
      });
    }
  }
  add(
    "System",
    "process",
    system?.processes ?? [],
    "name",
    "/system/processes/",
  );
  add(
    "System",
    "role",
    system?.roles ?? [],
    "title",
    "/system/organization?role=",
  );
  add("Strategy", "cycle", strategy?.cycles ?? [], "name", "/strategy/cycles/");
  add(
    "Strategy",
    "objective",
    strategy?.objectives ?? [],
    "title",
    "/strategy/objectives/",
  );
  add(
    "Strategy",
    "KR",
    strategy?.keyResults ?? [],
    "title",
    "/strategy/key-results?kr=",
  );
  add(
    "Strategy",
    "initiative",
    strategy?.initiatives ?? [],
    "title",
    "/strategy/initiatives/",
  );
  add(
    "Scale",
    "constraint",
    scale?.constraints ?? [],
    "title",
    "/scale/constraints/",
  );
  add(
    "Scale",
    "experiment",
    scale ? experimentData(scale).experiments : [],
    "title",
    "/scale/experiments/",
  );
  add(
    "Scale",
    "metric",
    scale ? experimentData(scale).metrics : [],
    "name",
    "/scale/experiments?metric=",
  );
  add(
    "Scale",
    "candidate",
    scale ? readinessData(scale).candidates : [],
    "name",
    "/scale/readiness/",
  );
  add(
    "Scale",
    "funnel",
    scale ? funnelData(scale).funnels : [],
    "name",
    "/scale/funnel?funnel=",
  );
  add(
    "Scale",
    "channel",
    scale ? networkData(scale).channels : [],
    "name",
    "/scale/channels?channel=",
  );
  add(
    "Scale",
    "loop",
    scale ? networkData(scale).loops : [],
    "name",
    "/scale/loops?loop=",
  );
  for (const entity of entities.filter((e) => e.ref.entityType === "objective"))
    entity.ref.route = `/strategy/cycles/${encodeURIComponent(String(entity.value.cycleId))}/objectives/${encodeURIComponent(entity.ref.entityId)}`;
  const version = diagnosisContextVersion(reader);
  return {
    system,
    strategy,
    scale,
    measurement,
    standards,
    sources,
    diagnosis: diagnosis.state,
    diagnosisError: diagnosis.error,
    entities,
    version,
    notices,
  };
}
export type PreparationContext = ReturnType<typeof preparationContext>;
export function findEntity(c: PreparationContext, type: string, id: string) {
  return c.entities.find(
    (e) => e.ref.entityType === type && e.ref.entityId === id,
  );
}
export function choices(c: PreparationContext, type: string) {
  return c.entities
    .filter(
      (e) =>
        e.ref.entityType === type &&
        !["archived", "cancelled", "resolved", "completed"].includes(
          String(e.value.status),
        ) &&
        e.value.lifecycle !== "cancelled",
    )
    .map((e) => ({ id: e.ref.entityId, label: e.ref.label ?? e.ref.entityId }));
}
export function sourceSnapshot(
  c: PreparationContext,
  refs: AgentEntityRef[],
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const r of refs) {
    const e = findEntity(c, r.entityType, r.entityId);
    result[`${r.domain}:${r.entityType}:${r.entityId}`] = e?.value ?? null;
    if (r.entityType === "process") {
      result[`measurement:${r.entityId}`] = fingerprint(
        c.measurement?.records.find((x) => x.processId === r.entityId) ?? null,
      );
      result[`standard:${r.entityId}`] = fingerprint(
        c.standards?.records.find((x) => x.processId === r.entityId) ?? null,
      );
    }
    if (r.entityType === "experiment")
      result[`experimentMeasurements:${r.entityId}`] = c.scale
        ? experimentData(c.scale).measurements.filter(
            (m) => m.experimentId === r.entityId,
          )
        : [];
    if (r.entityType === "constraint")
      result[`constraintExperiments:${r.entityId}`] = c.scale
        ? experimentData(c.scale)
            .experiments.filter((e) => e.constraintId === r.entityId)
            .map((e) => ({
              experiment: e,
              measurements: experimentData(c.scale!).measurements.filter(
                (m) => m.experimentId === e.id,
              ),
            }))
        : [];
    if (r.entityType === "role") {
      const role = c.system?.roles.find((x) => x.id === r.entityId);
      result[`person:${r.entityId}`] =
        c.system?.people.find((x) => x.id === role?.personId) ?? null;
    }
  }
  return JSON.parse(canonical(result));
}
