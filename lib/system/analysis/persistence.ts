import type { AnalysisStore, AnalysisRecord } from "./redesign";
import { validateMaps } from "../maps/persistence";
export const ANALYSIS_KEY = "growth-engine.process-analysis.v1";
export function parseAnalysis(raw: string): AnalysisStore {
  const x = JSON.parse(raw);
  if (!x || x.version !== 1 || !Array.isArray(x.records))
    throw new Error("داده تحلیل معتبر نیست.");
  const ids = new Set();
  for (const r of x.records) {
    if (
      !r ||
      typeof r.processId !== "string" ||
      !r.processId ||
      ids.has(r.processId)
    )
      throw new Error("شناسه تحلیل معتبر نیست.");
    ids.add(r.processId);
    if (r.toBe) {
      if (r.toBe.processId !== r.processId)
        throw new Error("نقشه متعلق به فرآیند دیگری است.");
      validateMaps({ version: 1, maps: [r.toBe] }, "to-be");
    }
    for (const stamp of [r.review, r.approval])
      if (
        stamp !== undefined &&
        (!stamp ||
          typeof stamp.at !== "string" ||
          !Number.isFinite(Date.parse(stamp.at)) ||
          typeof stamp.fingerprint !== "string" ||
          !stamp.fingerprint)
      )
        throw new Error("تأیید ذخیره‌شده معتبر نیست.");
    if (r.approval && (!r.review || !r.toBe))
      throw new Error("تأیید بدون نقشه یا تحلیل معتبر نیست.");
  }
  return x;
}
export function replaceRecord(store: AnalysisStore, record: AnalysisRecord) {
  return parseAnalysis(
    JSON.stringify({
      ...store,
      records: [
        ...store.records.filter((r) => r.processId !== record.processId),
        record,
      ],
    }),
  );
}
