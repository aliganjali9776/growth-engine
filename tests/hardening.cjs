const test = require("node:test"),
  assert = require("node:assert/strict"),
  { performance } = require("node:perf_hooks");
const base = "../.test-build/system/",
  { setup } = require("./helpers/command-fixture.cjs"),
  large = require("./helpers/large-system.cjs");
const { commandReport } = require(base + "command-center/report"),
  { guardEarlyStage } = require(base + "lifecycle"),
  { ownerOf, selectProcesses, emptyFilters } = require(base + "selectors"),
  { stepOwner, founderStep, mapCompleteness } = require(base + "maps/logic"),
  { founderIndependence, processHealth } = require(base + "measurement/health"),
  { removeStep } = require(base + "maps/model"),
  { autoLayout } = require(base + "maps/layout"),
  { updateFuture, approvalCurrent } = require(base + "analysis/redesign"),
  { effectiveSOPStatus } = require(base + "standards/logic"),
  { parseSystem } = require(base + "persistence"),
  { parseMaps } = require(base + "maps/persistence"),
  { parseAnalysis } = require(base + "analysis/persistence"),
  { parseStandards } = require(base + "standards/persistence"),
  { parseMeasurement } = require(base + "measurement/persistence"),
  { parseSnapshots, createSnapshot, snapshotTrend } = require(
    base + "command-center/snapshots",
  );
const day = "2026-09-14";
function report(f) {
  return commandReport(
    f.e.system,
    { version: 1, records: [f.r] },
    (id) => (id === "p6" ? f.e : { system: f.e.system }),
    day,
  );
}
test("3G A/E: role-first reassignment and missing-role fallback", () => {
  const f = setup(),
    p = f.e.system.processes.find((p) => p.id === "p6"),
    role = f.e.system.roles.find((r) => r.id === p.ownerRoleId);
  role.personId = f.e.system.people[1].id;
  assert.equal(ownerOf(f.e.system, p).person.id, role.personId);
  assert.equal(
    stepOwner(f.e.system, { ownerRoleId: role.id }).person.id,
    role.personId,
  );
  assert.equal(f.e.standard.sop.processOwnerRoleId, p.ownerRoleId);
  assert.equal(f.r.kpis[0].ownerRoleId, p.ownerRoleId);
  assert.equal(
    ownerOf(f.e.system, { ...p, ownerRoleId: "missing" }).role,
    undefined,
  );
});
test("3G B: archived processes leave executive metrics", () => {
  const f = setup(),
    before = report(f);
  f.e.system.processes.find((p) => p.id === "p6").status = "archived";
  const after = report(f);
  assert.equal(after.rows.length, before.rows.length - 1);
  assert.ok(!after.risks.some((r) => r.processId === "p6"));
  assert.equal(
    after.maturity.rows.reduce((s, r) => s + r.count, 0),
    after.rows.length,
  );
});
test("3G C: redesign edit retains historical approval but invalidates SOP", () => {
  const f = setup(),
    old = f.e.source.analysis.approval,
    changed = structuredClone(f.e.source.analysis.toBe);
  changed.steps[1].title += " revised";
  f.e.source.analysis = updateFuture(f.e.source.analysis, changed, f.e.system);
  assert.deepEqual(f.e.source.analysis.approval, old);
  assert.equal(
    approvalCurrent(f.e.source.analysis, f.e.asis, f.e.system),
    false,
  );
  assert.equal(effectiveSOPStatus(f.e.standard, f.e.source), "needs-review");
});
test("3G D: every store rejects corrupt JSON and missing schema without mutation", () => {
  for (const parse of [
    parseSystem,
    parseMaps,
    parseAnalysis,
    parseStandards,
    parseMeasurement,
    parseSnapshots,
  ])
    for (const raw of ["{bad", "null", "{}", '{"version":1}'])
      assert.throws(() => parse(raw));
});
test("3G F: absent KPI/adoption remains unknown", () => {
  const f = setup(),
    before = report(f).health.completeness;
  f.r.entries = [];
  f.e.standard = undefined;
  const after = report(f);
  assert.ok(after.health.completeness < before);
  assert.equal(after.health.kpiPerformance, null);
  assert.equal(processHealth(f.r, f.e, day).adoption, null);
});
test("3G G: early stages cannot bypass readiness at central guard", () => {
  const f = setup();
  for (const stage of ["mapped", "analyzed", "redesigned"])
    assert.throws(() =>
      guardEarlyStage(stage, f.e.system, undefined, undefined),
    );
  assert.doesNotThrow(() =>
    guardEarlyStage("mapped", f.e.system, f.e.asis, undefined),
  );
  assert.doesNotThrow(() =>
    guardEarlyStage("redesigned", f.e.system, f.e.asis, f.e.source.analysis),
  );
});
test("3G H: step deletion removes incident edges without touching source", () => {
  const f = setup(),
    id = f.e.asis.steps[1].id,
    next = removeStep(f.e.asis, id);
  assert.ok(
    next.connections.every(
      (e) => e.sourceStepId !== id && e.targetStepId !== id,
    ),
  );
  assert.ok(f.e.asis.steps.some((s) => s.id === id));
});
test("3G I: orphaned improvement KPI reference is rejected", () => {
  const f = large(1);
  f.measurement.records[0].improvements[0].relatedKpiId = "missing";
  assert.throws(() => parseMeasurement(JSON.stringify(f.measurement)));
});
test("3G J/L: totals derive from sources and are bounded, no duplicate rollup weight", () => {
  const f = setup(),
    r = report(f);
  assert.equal(
    r.health.components.reduce((n, c) => n + c.weight, 0),
    100,
  );
  assert.equal(r.health.components[0].weight, 0);
  for (const x of [r.health, ...r.departments.map((d) => d.health)])
    assert.ok(
      x.score === null ||
        (Number.isFinite(x.score) && x.score >= 0 && x.score <= 100),
    );
});
test("3G M: explicit low dependency and founder role both reduce independence", () => {
  const f = setup();
  f.e.standard = undefined;
  const step = f.e.asis.steps.find((s) => s.type === "action");
  step.founderDependency = "low";
  assert.equal(founderStep(f.e.system, step), true);
  assert.equal(founderIndependence("p6", f.e).dependent(step), true);
  step.ownerRoleId = f.e.system.roles.find((r) => r.isFounderRole).id;
  step.founderDependency = "none";
  assert.equal(founderIndependence("p6", f.e).dependent(step), true);
  assert.ok(founderIndependence("p6", f.e).score < 100);
});
test("3G N/O: empty persisted system roundtrips without reseeding", () => {
  const empty = {
    version: 1,
    departments: [],
    roles: [],
    people: [],
    processes: [],
  };
  const restored = parseSystem(JSON.stringify(empty));
  assert.deepEqual(restored, empty);
  assert.equal(
    commandReport(
      restored,
      { version: 1, records: [] },
      () => ({ system: restored }),
      day,
    ).health.score,
    null,
  );
});
test("3G: incompatible snapshot formula versions never imply performance trend", () => {
  const f = setup(),
    newer = createSnapshot(report(f), "2026-09-14T01:00:00.000Z"),
    old = {
      ...newer,
      id: "old",
      formulaVersion: undefined,
      date: "2026-09-13T01:00:00.000Z",
    };
  assert.equal(snapshotTrend([old, newer]), null);
  assert.equal(
    parseSnapshots(JSON.stringify({ version: 1, snapshots: [old] })).snapshots
      .length,
    1,
  );
});
for (const count of [50, 100])
  test(`3G K: ${count} processes / 20 departments / 100 roles / 200 people / 105 nodes / 210 actions / 510 KPI entries`, () => {
    const f = large(count);
    parseSystem(JSON.stringify(f.system));
    parseMaps(JSON.stringify(f.maps));
    parseMeasurement(JSON.stringify(f.measurement));
    const start = performance.now(),
      r = commandReport(f.system, f.measurement, f.evidence, day),
      aggregateMs = performance.now() - start;
    const filterStart = performance.now();
    for (let i = 0; i < 100; i++)
      selectProcesses(f.system, {
        ...emptyFilters,
        sort: "department",
        bottleneck: true,
      });
    const filterMs = performance.now() - filterStart;
    const mapStart = performance.now(),
      layout = autoLayout(f.maps.maps[0], "RL");
    mapCompleteness(layout, f.system);
    const mapMs = performance.now() - mapStart;
    assert.equal(r.rows.length, count);
    assert.ok(Number.isFinite(r.health.score));
    assert.equal(layout.steps.length, 105);
    console.log(
      JSON.stringify({
        processes: count,
        aggregateMs: +aggregateMs.toFixed(2),
        filter100Ms: +filterMs.toFixed(2),
        layoutAndValidationMs: +mapMs.toFixed(2),
      }),
    );
  });
