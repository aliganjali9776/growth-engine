import { moduleForStore, type BusinessModule } from "./business-export";
export interface CanonicalRecord {
  collection: string; entityKey: string; position: number;
  payload: Record<string, any>; parentId: string | null;
  ownerRoleId: string | null; status: string | null;
}
export interface StoreRecords { metadata: Record<string, any> | null; records: CanonicalRecord[] }
const paths: Record<string, string[]> = {
  "growth-engine.system.v1": ["departments", "roles", "people", "processes"],
  "growth-engine.process-maps.v1": ["maps"],
  "growth-engine.process-analysis.v1": ["records"],
  "growth-engine.process-standards.v1": ["records"],
  "growth-engine.process-measurement.v1": ["records"],
  "growth-engine.system-health-history.v1": ["snapshots"],
  "growth-engine.strategy.v1": ["cycles", "contexts", "priorities", "choices", "objectives", "keyResults", "initiatives", "krCheckIns", "weeklyReviews", "strategyDecisions", "objectiveWeeklySnapshots", "strategyWeeklySnapshots", "adaptReviews", "cycleReviews", "strategyChanges", "strategyLearnings", "strategicAssumptions", "cycleResets"],
  "growth-engine.scale.v1": ["diagnostics", "constraints", "levers", "ideas", "experimentData.metrics", "experimentData.experiments", "experimentData.measurements", "experimentData.learnings", "experimentData.decisions", "experimentData.ideaReviews", "funnelData.funnels", "funnelData.stages", "funnelData.periods", "funnelData.measurements", "funnelData.revenueModels", "funnelData.links", "funnelData.evidence", "networkData.channels", "networkData.channelPeriods", "networkData.decisions", "networkData.loops", "networkData.nodes", "networkData.loopPeriods", "networkData.evidence", "networkData.leakage", "networkData.links", "readinessData.candidates", "readinessData.areas", "readinessData.scenarios", "readinessData.financial", "readinessData.investments", "readinessData.preparation", "readinessData.snapshots", "readinessData.decisions"],
  "growth-engine.agent.v1": ["evidence", "observations", "recommendations", "proposals", "approvals", "audit"],
  "growth-engine.agent.diagnosis.v1": ["evidence", "signals", "patterns", "diagnoses", "priorities", "runs", "history"],
  "growth-engine.agent.preparation.v1": ["evidence", "recommendations", "plans", "actions", "revisions", "approvals", "audit"],
  "growth-engine.agent.execution.v1": ["records", "rollbacks", "audit"],
  "growth-engine.agent.workspace.v1": ["sessions"],
};
function location(object: Record<string, any>, path: string) {
  const keys = path.split("."), last = keys.pop()!;
  let parent = object;
  for (const key of keys) { if (!parent[key] || typeof parent[key] !== "object") return null; parent = parent[key]; }
  return { parent, last };
}
function identity(row: Record<string, any>, position: number, collection: string) {
  if (collection === "maps") return `${row.processId}:${row.variant}`;
  if (collection === "objectiveWeeklySnapshots") return `${row.reviewId}:${row.objectiveId}`;
  if (collection === "strategyWeeklySnapshots") return `${row.reviewId}:${row.cycleId}`;
  return String(row.id ?? row.processId ?? row.cycleId ?? row.funnelId ?? row.dimension ?? `position:${position}`);
}
function record(collection: string, row: Record<string, any>, position: number): CanonicalRecord {
  return { collection, entityKey: identity(row, position, collection), position, payload: row,
    parentId: row.processId ?? row.cycleId ?? row.objectiveId ?? row.experimentId ?? row.sessionId ?? row.actionId ?? null,
    ownerRoleId: row.ownerRoleId ?? row.processOwnerRoleId ?? null, status: row.status ?? row.lifecycle ?? null };
}
export function splitDomainStore(storeKey: string, raw: string | null): StoreRecords {
  if (raw === null) return { metadata: null, records: [] };
  const metadata = JSON.parse(raw), records: CanonicalRecord[] = [];
  for (const path of paths[storeKey] ?? []) {
    const slot = location(metadata, path); if (!slot || !Array.isArray(slot.parent[slot.last])) continue;
    const rows = slot.parent[slot.last]; slot.parent[slot.last] = [];
    for (let i = 0; i < rows.length; i++) records.push(record(path, rows[i], i));
  }
  if (storeKey === "growth-engine.assessment.v2") {
    if (metadata.profile) records.push(record("profile", metadata.profile, 0)); metadata.profile = null;
    for (const [question, value] of Object.entries(metadata.answers ?? {})) records.push(record("answers", { id: question, value }, records.length));
    metadata.answers = {};
  }
  if (storeKey === "growth-engine.scale.v1") { if (metadata.profile) records.push(record("profile", metadata.profile, 0)); metadata.profile = null; }
  if (storeKey === "growth-engine.advisor.v1" && metadata.session) { records.push(record("session", metadata.session, 0)); metadata.session = null; }
  // A message is its own row: histories can be paged without fetching a session's text.
  for (const row of [...records]) if (["sessions", "session"].includes(row.collection) && Array.isArray(row.payload.messages)) {
    const messages = row.payload.messages; row.payload.messages = [];
    for (let i = 0; i < messages.length; i++) records.push({ ...record("messages", messages[i], i), entityKey: `${row.entityKey}:${messages[i].id ?? i}`, parentId: row.entityKey });
  }
  const seen = new Set<string>();
  for (const row of records) { const key = `${row.collection}:${row.entityKey}`; if (seen.has(key)) throw Error("DuplicateCanonicalRecord"); seen.add(key); }
  return { metadata, records };
}
export function joinDomainStore(storeKey: string, source: StoreRecords): string | null {
  if (source.metadata === null) return null;
  const metadata = structuredClone(source.metadata), rows = source.records.map(row => ({ ...row, payload: structuredClone(row.payload) })).sort((a,b) => a.position-b.position);
  for (const path of paths[storeKey] ?? []) { const slot = location(metadata, path); if (slot && Array.isArray(slot.parent[slot.last])) slot.parent[slot.last] = rows.filter(row => row.collection === path).map(row => row.payload); }
  if (["growth-engine.assessment.v2", "growth-engine.scale.v1"].includes(storeKey)) metadata.profile = rows.find(row => row.collection === "profile")?.payload ?? null;
  if (storeKey === "growth-engine.assessment.v2") metadata.answers = Object.fromEntries(rows.filter(row => row.collection === "answers").map(row => [row.payload.id, row.payload.value]));
  for (const row of rows.filter(row => ["sessions", "session"].includes(row.collection))) row.payload.messages = rows.filter(message => message.collection === "messages" && message.parentId === row.entityKey).map(message => message.payload);
  if (storeKey === "growth-engine.advisor.v1") metadata.session = rows.find(row => row.collection === "session")?.payload ?? null;
  return JSON.stringify(metadata);
}
export const storeModule: (key: string) => BusinessModule = moduleForStore;
