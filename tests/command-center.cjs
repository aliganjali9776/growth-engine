const test = require("node:test"),
  assert = require("node:assert/strict");
const { setup } = require("./helpers/command-fixture.cjs");
const base = "../.test-build/system/";
const a = require(base + "command-center/aggregation"),
  r = require(base + "command-center/risks"),
  s = require(base + "command-center/snapshots");
const { commandReport } = require(base + "command-center/report");
const { independenceTest } = require(base + "measurement/independence");
const { newImprovement } = require(base + "measurement/model");
const day = "2026-09-14";
function fixture() {
  const { e, r: record } = setup();
  const system = e.system;
  system.processes = system.processes.filter((p) => p.id === "p6");
  system.processes[0].priorityLevel = "critical";
  const store = { version: 1, records: [record] },
    evidence = () => e;
  return {
    e,
    record,
    system,
    store,
    evidence,
    report: () => commandReport(system, store, evidence, day),
  };
}
test("3G: process-health rollup is diagnostic and not counted twice", () => {
  const f = fixture(),
    rows = f.report().rows;
  const high = a.aggregateHealth(
    rows.map((x) => ({ ...x, health: { ...x.health, score: 100 } })),
    f.system,
  );
  const low = a.aggregateHealth(
    rows.map((x) => ({ ...x, health: { ...x.health, score: 0 } })),
    f.system,
  );
  assert.equal(low.score, high.score);
  assert.equal(low.components.find(c=>c.key==='processHealth').weight,0);
});
test("3F B: process priority changes weighted contribution", () => {
  assert.equal(
    a.weightedMean([
      { value: 0, priority: "critical" },
      { value: 100, priority: "low" },
    ]),
    100 / 3,
  );
  assert.deepEqual(a.priorityWeights, {
    critical: 1.5,
    high: 1.25,
    medium: 1,
    low: 0.75,
  });
});
test("3F C: missing KPI evidence is unknown, lowers completeness", () => {
  const f = fixture(),
    before = f.report();
  f.record.entries = [];
  const after = f.report();
  assert.equal(
    after.health.components.find((x) => x.key === "kpi").value,
    null,
  );
  assert.ok(after.health.completeness < before.health.completeness);
  assert.equal(
    a.weightedMean([
      { value: null, priority: "critical" },
      { value: 80, priority: "low" },
    ]),
    80,
  );
});
test("3F D: low adoption generates a source-linked risk", () => {
  const f = fixture();
  Object.assign(f.e.standard.plan, {
    trainingRequired: true,
    toolsReady: false,
    teamBriefed: false,
  });
  assert.ok(
    f
      .report()
      .risks.some(
        (x) => x.type === "adoption" && x.href.endsWith("/implementation"),
      ),
  );
});
test("3F E: critical founder ownership raises a critical risk", () => {
  const f = fixture();
  f.system.processes[0].ownerRoleId = f.system.roles.find(
    (x) => x.isFounderRole,
  ).id;
  assert.ok(
    f
      .report()
      .risks.some((x) => x.type === "founder" && x.severity === "critical"),
  );
});
test("3F F: absent approved SOP on critical process is explicit", () => {
  const f = fixture();
  f.e.standard = undefined;
  assert.ok(f.report().risks.some((x) => x.type === "sop"));
});
test("3F G: poor measured KPI produces critical gap", () => {
  const f = fixture();
  f.record.entries[0].value = 20;
  assert.ok(
    f
      .report()
      .risks.some((x) => x.type === "kpi-gap" && x.severity === "critical"),
  );
});
test("3F H: overdue critical improvement is ranked critical", () => {
  const f = fixture();
  f.record.improvements = [
    {
      ...newImprovement("p6"),
      title: "Late critical",
      priority: "critical",
      status: "in-progress",
      dueDate: "2026-09-01",
    },
  ];
  assert.ok(
    f
      .report()
      .risks.some((x) => x.type === "overdue" && x.severity === "critical"),
  );
});
test("3F I: department uses the same priority-weighted health formula", () => {
  const f = fixture(),
    first = f.report().rows[0],
    rows = [
      { ...first, health: { ...first.health, score: 0 } },
      {
        ...first,
        process: { ...first.process, id: "second", priorityLevel: "low" },
        health: { ...first.health, score: 100 },
      },
    ];
  const dept = a
    .departmentHealth(rows, f.system)
    .find((x) => x.department.id === first.process.departmentId);
  assert.equal(
    dept.health.components.find((x) => x.key === "processHealth").value,
    100 / 3,
  );
});
test("3F J: concentrated founder ownership is flagged", () => {
  const f = fixture(),
    role = f.system.roles.find((x) => x.isFounderRole),
    p = f.system.processes[0];
  const result = a.ownershipConcentration(f.system, [
    { ...p, id: "a", ownerRoleId: role.id },
    { ...p, id: "b", ownerRoleId: role.id },
  ]);
  assert.equal(result[0].overloaded, true);
  assert.equal(result[0].share, 1);
});
test("3F K: funnel counts derive directly from existing stages", () => {
  const f = fixture(),
    report = f.report();
  assert.equal(
    report.maturity.rows.reduce((n, x) => n + x.count, 0),
    1,
  );
  assert.equal(
    report.maturity.rows.find(
      (x) => x.stage === f.system.processes[0].systemizationStage,
    ).percent,
    100,
  );
});
test("3F L: 30-day result reuses existing independence calculation", () => {
  const f = fixture();
  assert.deepEqual(
    JSON.parse(JSON.stringify(f.report().independence)),
    JSON.parse(
      JSON.stringify(independenceTest(f.system, f.store, f.evidence, day)),
    ),
  );
});
test("3F M: management focus selects greatest actionable weighted gap", () => {
  const components = [
    { key: "processHealth", weight: 25, value: 0 },
    { key: "adoption", weight: 15, value: 0 },
    { key: "ownership", weight: 5, value: 0 },
  ];
  assert.equal(r.managementFocus(components).key, "adoption");
});
test("3F N: management actions are deterministic and link to risks", () => {
  const f = fixture(),
    report = f.report();
  assert.deepEqual(report.actions, r.managementActions(report.risks));
  assert.ok(report.actions.length <= 5);
  assert.ok(
    report.actions.every((x) =>
      report.risks.some((y) => y.id === x.id && y.href === x.href),
    ),
  );
  assert.ok(
    report.risks.every((x, i) => !i || report.risks[i - 1].rank >= x.rank),
  );
});
test("3F O: snapshot captures all actual component values by value", () => {
  const f = fixture(),
    report = f.report(),
    snapshot = s.createSnapshot(report, "2026-09-14T08:00:00.000Z");
  assert.equal(snapshot.systemHealth, report.health.score);
  for (const c of report.health.components)
    assert.equal(snapshot[c.key], c.value);
  report.health.components[0].value = 999;
  assert.notEqual(snapshot.processHealth, 999);
});
test("3F P: trend requires two manual records and reports changes", () => {
  const f = fixture(),
    one = s.createSnapshot(f.report(), "2026-09-14T08:00:00.000Z");
  assert.equal(s.snapshotTrend([one]), null);
  f.record.entries[0].value = 40;
  const two = s.createSnapshot(f.report(), "2026-09-14T08:01:00.000Z"),
    trend = s.snapshotTrend([two, one]);
  assert.ok(trend.delta > 0);
  assert.equal(trend.current.id, two.id);
  assert.equal(trend.coverageChanged, false);
  assert.ok(trend.changes.find((x) => x.key === "kpi").delta > 0);
});
test("3F Q: history round-trips and rejects corrupt or duplicate records", () => {
  const f = fixture(),
    snapshot = s.createSnapshot(f.report()),
    store = { version: 1, snapshots: [snapshot] };
  assert.deepEqual(s.parseSnapshots(JSON.stringify(store)), store);
  assert.throws(() =>
    s.parseSnapshots(
      JSON.stringify({ version: 1, snapshots: [snapshot, snapshot] }),
    ),
  );
  assert.throws(() =>
    s.parseSnapshots(
      JSON.stringify({
        version: 1,
        snapshots: [{ ...snapshot, systemHealth: 101 }],
      }),
    ),
  );
  assert.deepEqual(
    s.parseSnapshots('{"version":1,"snapshots":[]}').snapshots,
    [],
  );
});
test("3F R: live measurement edits alter KPI component and total", () => {
  const f = fixture(),
    before = f.report();
  assert.equal(before.health.kpiPerformance, 50);
  f.record.entries[0].value = 40;
  const after = f.report();
  assert.equal(after.health.kpiPerformance, 100);
  assert.ok(after.health.score > before.health.score);
});
test("3F periods use Tehran dates, inclusive 30-day and Gregorian quarter boundaries", () => {
  assert.equal(s.inPeriod("2026-08-16", "30d", day), true);
  assert.equal(s.inPeriod("2026-08-15", "30d", day), false);
  assert.equal(s.inPeriod("2026-07-01", "quarter", day), true);
  assert.equal(s.inPeriod("2026-06-30", "quarter", day), false);
  assert.equal(s.inPeriod("2026-09-15", "all", day), false);
});
test("3F empty system has no synthetic score or snapshot", () => {
  const f = fixture();
  f.system.processes = [];
  const report = f.report();
  assert.equal(report.health.score, null);
  assert.equal(report.health.completeness, 0);
  assert.throws(() => s.createSnapshot(report));
});
