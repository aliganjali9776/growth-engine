import { fingerprint } from "./identity";
import { tehranDay } from "../../scale/experiments/logic";
export const diagnosisSourceKeys = [
  "growth-engine.system.v1",
  "growth-engine.strategy.v1",
  "growth-engine.scale.v1",
  "growth-engine.process-maps.v1",
  "growth-engine.process-analysis.v1",
  "growth-engine.process-standards.v1",
  "growth-engine.process-measurement.v1",
];
// No selectors, rules, model calls or writes: only source revisions and relevant metric/link fields.
export function diagnosisContextVersion(
  storage: Pick<Storage, "getItem">,
  at = new Date().toISOString(),
) {
  function revision(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(revision);
    if (!value || typeof value !== "object") return value;
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) {
      if (v && typeof v === "object") out[key] = revision(v);
      else if (
        typeof v === "number" ||
        typeof v === "boolean" ||
        v === null ||
        /(?:Id|At)$/.test(key) ||
        /^(id|version|status|lifecycle|confidence|founderDependency|ownerRoleId|blockedReason|blocker|text|statement|resultStatus|periodStart|periodEnd|date|measurementDate|sourceType|type|unit|metricUnit|cadence|attribution|currency)$/.test(
          key,
        )
      )
        out[key] = v;
    }
    return out;
  }
  return fingerprint([
    tehranDay(new Date(at)),
    ...diagnosisSourceKeys.map((key) => {
      try {
        const raw = storage.getItem(key);
        return [key, raw ? revision(JSON.parse(raw)) : null];
      } catch {
        return [key, "unreadable"];
      }
    }),
  ]);
}
