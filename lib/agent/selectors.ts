import { parseSystem, SYSTEM_STORAGE_KEY } from "../system/persistence";
import { parseMaps, MAP_STORAGE_KEY } from "../system/maps/persistence";
import { parseAnalysis, ANALYSIS_KEY } from "../system/analysis/persistence";
import { parseStandards, STANDARDS_KEY } from "../system/standards/persistence";
import {
  parseMeasurement,
  MEASUREMENT_KEY,
} from "../system/measurement/persistence";
import { commandReport } from "../system/command-center/report";
export function readSystemReport(
  storage: Pick<Storage, "getItem">,
  day: string,
) {
  function read<T>(key: string, parse: (raw: string) => T): T | null {
    try {
      const raw = storage.getItem(key);
      return raw ? parse(raw) : null;
    } catch {
      return null;
    }
  }
  const system = read(SYSTEM_STORAGE_KEY, parseSystem);
  if (!system) return null;
  const maps = read(MAP_STORAGE_KEY, parseMaps),
    analysis = read(ANALYSIS_KEY, parseAnalysis),
    standards = read(STANDARDS_KEY, parseStandards),
    measurement = read(MEASUREMENT_KEY, parseMeasurement);
  return commandReport(
    system,
    measurement ?? { version: 1, records: [] },
    (id) => {
      const asis = maps?.maps.find((m) => m.processId === id),
        a = analysis?.records.find((a) => a.processId === id);
      return {
        system,
        asis,
        standard: standards?.records.find((s) => s.processId === id),
        source: asis && a ? { system, asis, analysis: a } : undefined,
      };
    },
    day,
  );
}
