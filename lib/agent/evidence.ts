import type { AgentEvidence } from "./types";
import { safeValue, validateEvidence } from "./advisor/validation";

/** Bounded review projection; full source evidence and freshness IDs are retained separately. */
export function reviewEvidence(source: AgentEvidence): AgentEvidence {
  const e = structuredClone(source);
  e.summary = e.summary.slice(0, 600);
  e.title = e.title.slice(0, 250);
  if (e.value !== undefined && !safeValue(e.value)) delete e.value;
  if (e.previousValue !== undefined && !safeValue(e.previousValue))
    delete e.previousValue;
  validateEvidence(e);
  return e;
}
