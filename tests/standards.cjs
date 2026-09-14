const test = require("node:test"),
  assert = require("node:assert/strict");
const base = "../.test-build/system/";
const { createSystemSeed } = require(base + "seed");
const { seedMaps } = require(base + "maps/seed");
const a = require(base + "analysis/redesign"),
  l = require(base + "standards/logic");
const { exampleStandard } = require(base + "standards/example");
const { emptyRecord, createSOP, rebaseSOP } = require(base + "standards/model");
const { parseStandards, replaceStandard } = require(
  base + "standards/persistence",
);
const { guardStage } = require(base + "standards/guards");
function setup() {
  let system = createSystemSeed();
  const asis = seedMaps(system).maps[0];
  system.processes.find((p) => p.id === asis.processId).systemizationStage =
    "mapped";
  let result = a.confirmAnalysis(system, asis, {
    processId: asis.processId,
    toBe: a.cloneToBe(asis),
  });
  result = a.confirmRedesign(result.system, asis, result.record);
  const source = { asis, analysis: result.record, system: result.system };
  return { source, r: exampleStandard(result.record.toBe, result.system) };
}
function standardized() {
  let { source, r } = setup();
  r = l.approveSOP(r, source, "r1");
  const result = l.confirmStandardization(r, source);
  return { source: { ...source, system: result.system }, r: result.record };
}
function prepared() {
  let { source, r } = standardized();
  r.plan = {
    ...r.plan,
    implementationOwnerRoleId: "r1",
    ownerConfirmed: true,
    teamBriefed: true,
    toolsReady: true,
    templatesReady: true,
    trainingStatus: "completed",
    roles: r.plan.roles.map((x) => ({
      ...x,
      trained: true,
      acknowledged: true,
    })),
    pilotOwnerRoleId: "r1",
    pilotStartDate: "2026-09-01",
    pilotEndDate: "2026-09-02",
    pilotStatus: "completed",
    pilotOutcome: "Reviewed result",
    pilotFeedbackReviewed: true,
  };
  return { source, r };
}
test("Standards A: approved source creates structured draft without fabricated instructions", () => {
  const { source } = setup(),
    s = createSOP(source.analysis.toBe, source.system);
  assert.equal(s.status, "draft");
  assert.ok(s.procedureSteps.length);
  assert.ok(s.procedureSteps.every((p) => !p.instruction));
});
test("Standards B: missing purpose blocks approval", () => {
  const { source, r } = setup();
  r.sop.purpose = "";
  assert.equal(l.standardization(r, source).approvable, false);
  assert.throws(() => l.approveSOP(r, source, "r1"));
});
test("Standards C: missing procedure instruction lowers completeness", () => {
  const { source, r } = setup();
  r.sop.procedureSteps[0].instruction = "";
  assert.ok(l.standardization(r, source).score < 100);
  assert.equal(l.standardization(r, source).approvable, false);
});
test("Standards D: checklist reorder and required flags survive persistence", () => {
  const { r } = setup();
  r.checklists[0].items.reverse().forEach((x, i) => (x.order = i));
  const restored = parseStandards(JSON.stringify({ version: 1, records: [r] }));
  assert.deepEqual(restored.records[0].checklists, r.checklists);
});
test("Standards E: decision without ready rule blocks readiness", () => {
  const { source, r } = setup();
  r.rules = [];
  assert.equal(l.standardization(r, source).approvable, false);
});
test("Standards F: Definition of Done is mandatory", () => {
  const { source, r } = setup();
  r.sop.definitionOfDone = [];
  assert.equal(l.standardization(r, source).score, 90);
  assert.equal(l.standardization(r, source).approvable, false);
});
test("Standards G: complete draft still requires explicit approval", () => {
  const { source, r } = setup();
  assert.equal(l.standardization(r, source).score, 100);
  assert.equal(l.standardization(r, source).ready, false);
  assert.throws(() => l.confirmStandardization(r, source));
});
test("Standards H: explicit standardization advances stage and records valid signature", () => {
  const { source, r } = standardized();
  assert.equal(
    source.system.processes.find((p) => p.id === "p6").systemizationStage,
    "standardized",
  );
  assert.ok(l.standardizedCurrent(r, source));
  assert.doesNotThrow(() => guardStage("standardized", r, source));
});
test("Standards I: required incomplete training blocks live", () => {
  const { source, r } = prepared();
  r.plan.roles[0].trained = false;
  assert.equal(l.implementation(r, source).goLiveReady, false);
  assert.throws(() => l.confirmGoLive(r, source));
});
test("Standards J: required pilot needs valid dates, outcome and feedback", () => {
  const { source, r } = prepared();
  for (const patch of [
    { pilotFeedbackReviewed: false },
    { pilotOutcome: "" },
    { pilotEndDate: "2026-08-01" },
  ])
    assert.equal(
      l.implementation({ ...r, plan: { ...r.plan, ...patch } }, source)
        .pilotComplete,
      false,
    );
});
test("Standards K: owner, training, pilot, live, acknowledgement, operational weights sum to 100", () => {
  let { source, r } = prepared();
  assert.equal(l.implementation(r, source).score, 80);
  r = l.confirmGoLive(r, source);
  assert.equal(l.implementation(r, source).score, 100);
  r.plan.roles.forEach((x) => (x.acknowledged = false));
  assert.equal(l.implementation(r, source).score, 85);
});
test("Standards L: implementation requires live, advances stage and cannot be manually bypassed", () => {
  let { source, r } = prepared();
  assert.throws(() => guardStage("implemented", r, source));
  assert.throws(() => l.confirmImplementation(r, source));
  r = l.confirmGoLive(r, source);
  const result = l.confirmImplementation(r, source);
  source.system = result.system;
  assert.equal(
    source.system.processes.find((p) => p.id === "p6").systemizationStage,
    "implemented",
  );
  assert.ok(l.implementedCurrent(result.record, source));
  result.record.plan.toolsReady = false;
  assert.equal(l.implementedCurrent(result.record, source), false);
});
test("Standards M: TOBE content change invalidates approval; rebase preserves instructions", () => {
  const { source, r } = standardized(),
    map = structuredClone(source.analysis.toBe);
  map.steps[1].title += " revised";
  source.analysis = a.updateFuture(source.analysis, map, source.system);
  assert.equal(l.effectiveSOPStatus(r, source), "needs-review");
  assert.equal(l.standardizedCurrent(r, source), false);
  source.analysis = a.confirmRedesign(
    source.system,
    source.asis,
    source.analysis,
  ).record;
  const rebased = rebaseSOP(r.sop, source.analysis.toBe, source.system);
  assert.deepEqual(rebased.procedureSteps, r.sop.procedureSteps);
  assert.equal(rebased.basedOnToBeVersion, 2);
  assert.equal(rebased.approvedAt, undefined);
});
test("Standards N: full local roundtrip preserves confirmed implementation", () => {
  let { source, r } = prepared();
  r = l.confirmGoLive(r, source);
  r = l.confirmImplementation(r, source).record;
  const restored = parseStandards(JSON.stringify({ version: 1, records: [r] }));
  assert.ok(l.implementedCurrent(restored.records[0], source));
});
test("Standards O: separate processes remain isolated", () => {
  const { r } = setup();
  const store = replaceStandard(
    { version: 1, records: [r] },
    emptyRecord("p7"),
  );
  assert.equal(store.records.length, 2);
  assert.deepEqual(
    store.records.find((x) => x.processId === "p6"),
    r,
  );
  assert.equal(store.records.find((x) => x.processId === "p7").sop, undefined);
});
test("Standards persistence rejects malformed dates and duplicate checklist order", () => {
  const { r } = setup();
  r.plan.targetGoLiveDate = "2026-02-30";
  assert.throws(() =>
    parseStandards(JSON.stringify({ version: 1, records: [r] })),
  );
  r.plan.targetGoLiveDate = "";
  r.checklists[0].items[1].order = 0;
  assert.throws(() =>
    parseStandards(JSON.stringify({ version: 1, records: [r] })),
  );
});
test("Standards mutations invalidate SOP and stage signatures", () => {
  const { source, r } = standardized();
  r.assets[0].reference = "changed";
  assert.equal(l.effectiveSOPStatus(r, source), "needs-review");
  assert.throws(() => guardStage("standardized", r, source));
});
test("Returning approved SOP to draft revokes effective approval", () => {
  const { source, r } = standardized();
  r.sop.status = "draft";
  assert.equal(l.effectiveSOPStatus(r, source), "draft");
  assert.equal(l.standardizedCurrent(r, source), false);
});
