import { parseDraft } from "../assessment/persistence";
import { parseSystem } from "../system/persistence";
import { parseMaps } from "../system/maps/persistence";
import { parseAnalysis } from "../system/analysis/persistence";
import { parseStandards } from "../system/standards/persistence";
import { parseMeasurement } from "../system/measurement/persistence";
import { parseSnapshots } from "../system/command-center/snapshots";
import { parseStrategy } from "../strategy/model";
import { parseScale } from "../scale/persistence";
import { parseAgent } from "../agent-storage";
import { readAdvisor } from "../advisor-storage";
import { readDiagnosis } from "../diagnosis-storage";
import { readPreparation } from "../preparation-storage";
import { readExecution } from "../execution-storage";
import { readWorkspace } from "../workspace-storage";
export const localStoreKeys = [
  "growth-engine.assessment.v2",
  "growth-engine.system.v1",
  "growth-engine.process-maps.v1",
  "growth-engine.process-analysis.v1",
  "growth-engine.process-standards.v1",
  "growth-engine.process-measurement.v1",
  "growth-engine.system-health-history.v1",
  "growth-engine.strategy.v1",
  "growth-engine.scale.v1",
  "growth-engine.agent.v1",
  "growth-engine.advisor.v1",
  "growth-engine.agent.diagnosis.v1",
  "growth-engine.agent.preparation.v1",
  "growth-engine.agent.execution.v1",
  "growth-engine.agent.workspace.v1",
] as const;
export interface LocalBusinessOSExport {
  schemaVersion: 1;
  exportedAt: string;
  source: "browser-local-v1";
  localWorkspaceId: string;
  organizationProfile: Record<string, unknown> | null;
  moduleVersions: Record<string, number | null>;
  stores: Record<(typeof localStoreKeys)[number], string | null>;
}
export function exportLocalWorkspace(
  storage: Pick<Storage, "getItem">,
  localWorkspaceId: string,
): LocalBusinessOSExport {
  if (!localWorkspaceId.trim() || localWorkspaceId.length > 160)
    throw Error("InvalidLocalWorkspace");
  const stores = Object.fromEntries(
    localStoreKeys.map((k) => [k, storage.getItem(k)]),
  ) as LocalBusinessOSExport["stores"];
  const versions: Record<string, number | null> = {};
  for (const key of localStoreKeys) {
    try {
      versions[key] = stores[key]
        ? (JSON.parse(stores[key]!).version ?? null)
        : null;
    } catch {
      versions[key] = null;
    }
  }
  let profile: Record<string, unknown> | null = null;
  try {
    profile = stores[localStoreKeys[0]]
      ? JSON.parse(stores[localStoreKeys[0]]!).profile
      : null;
  } catch {
    /* corrupt raw store is still included in backup */
  }
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    source: "browser-local-v1",
    localWorkspaceId,
    organizationProfile: profile,
    moduleVersions: versions,
    stores,
  };
}
export function validateLocalExport(value: unknown): LocalBusinessOSExport {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("InvalidExport");
  const e = value as LocalBusinessOSExport;
  if (
    e.schemaVersion !== 1 ||
    e.source !== "browser-local-v1" ||
    typeof e.localWorkspaceId !== "string" ||
    !e.localWorkspaceId.trim() ||
    e.localWorkspaceId.length > 160 ||
    typeof e.exportedAt !== "string" ||
    !Number.isFinite(Date.parse(e.exportedAt)) ||
    !e.stores ||
    !e.moduleVersions
  )
    throw Error("InvalidExport");
  if (
    Object.keys(e.stores).length !== localStoreKeys.length ||
    Object.keys(e.stores).some(
      (k) => !localStoreKeys.includes(k as (typeof localStoreKeys)[number]),
    )
  )
    throw Error("InvalidExport");
  const reader = {
    getItem: (key: string) =>
      e.stores[key as (typeof localStoreKeys)[number]] ?? null,
  };
  const parsers = [
    parseDraft,
    parseSystem,
    parseMaps,
    parseAnalysis,
    parseStandards,
    parseMeasurement,
    parseSnapshots,
    parseStrategy,
    parseScale,
    parseAgent,
  ];
  for (let i = 0; i < localStoreKeys.length; i++) {
    const raw = e.stores[localStoreKeys[i]];
    if (raw !== null && (typeof raw !== "string" || !raw.trim()))
      throw Error("InvalidExport");
    if (raw && i < parsers.length) parsers[i](raw);
  }
  for (const read of [
    readAdvisor,
    readDiagnosis,
    readPreparation,
    readExecution,
    readWorkspace,
  ]) {
    const result = read(reader);
    if (result.error) throw Error("InvalidExport");
  }
  for (const key of localStoreKeys) {
    const expected = e.stores[key]
      ? (JSON.parse(e.stores[key]!).version ?? null)
      : null;
    if (e.moduleVersions[key] !== expected) throw Error("InvalidExportVersion");
  }
  // Return only the allowlisted envelope. No arbitrary caller fields reach the DB archive.
  const assessment = e.stores[localStoreKeys[0]];
  return {
    schemaVersion: 1,
    exportedAt: e.exportedAt,
    source: e.source,
    localWorkspaceId: e.localWorkspaceId,
    organizationProfile: assessment
      ? { ...parseDraft(assessment).profile }
      : null,
    moduleVersions: Object.fromEntries(
      localStoreKeys.map((key) => [key, e.moduleVersions[key]]),
    ),
    stores: { ...e.stores },
  };
}
