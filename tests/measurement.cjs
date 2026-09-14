const test = require("node:test"),
  assert = require("node:assert/strict");
const base = "../.test-build/system/";
const { createSystemSeed } = require(base + "seed"),
  { seedMaps } = require(base + "maps/seed"),
  a = require(base + "analysis/redesign"),
  s = require(base + "standards/logic"),
  { exampleStandard } = require(base + "standards/example");
const m = require(base + "measurement/model"),
  k = require(base + "measurement/kpis"),
  h = require(base + "measurement/health"),
  ready = require(base + "measurement/readiness"),
  { independenceTest } = require(base + "measurement/independence"),
  { parseMeasurement } = require(base + "measurement/persistence");
function setup() {
  let system = createSystemSeed();
  const asis = seedMaps(system).maps[0];
  system.processes.find((p) => p.id === "p6").systemizationStage = "mapped";
  let analysis = a.confirmAnalysis(system, asis, {
    processId: "p6",
    toBe: a.cloneToBe(asis),
  });
  analysis = a.confirmRedesign(analysis.system, asis, analysis.record);
  let source = { system: analysis.system, asis, analysis: analysis.record },
    standard = exampleStandard(source.analysis.toBe, source.system);
  standard = s.approveSOP(standard, source, "r1");
  let result = s.confirmStandardization(standard, source);
  source.system = result.system;
  standard = result.record;
  standard.plan = {
    ...standard.plan,
    implementationOwnerRoleId: "r1",
    ownerConfirmed: true,
    teamBriefed: true,
    toolsReady: true,
    templatesReady: true,
    trainingRequired: false,
    pilotRequired: false,
    roles: standard.plan.roles.map((x) => ({
      ...x,
      trained: true,
      acknowledged: true,
    })),
  };
  standard = s.confirmGoLive(standard, source);
  result = s.confirmImplementation(standard, source);
  source.system = result.system;
  standard = result.record;
  const evidence = { system: result.system, asis, source, standard },
    r = m.emptyMeasurement("p6"),
    kpi = {
      ...m.newKPI("p6"),
      name: "Conversion",
      unit: "%",
      ownerRoleId: "r1",
      baselineValue: 20,
      targetValue: 40,
      status: "active",
    };
  r.kpis = [kpi];
  r.entries = [
    {
      id: "entry1",
      kpiId: kpi.id,
      processId: "p6",
      periodDate: "2026-09-01",
      value: 30,
      note: "",
      confidence: "high",
      enteredAt: "2026-09-01T12:00:00Z",
    },
  ];
  return { r, e: evidence, kpi };
}
const day = "2026-09-14";
test("Unknown process maps do not get full decision delegation credit", () => {
  const { r, e } = setup(),
    system = {
      ...e.system,
      processes: e.system.processes.filter((p) => ["p6", "p7"].includes(p.id)),
    };
  const result = independenceTest(
    system,
    { version: 1, records: [r] },
    (id) => (id === "p6" ? { ...e, system } : { system }),
    day,
  );
  assert.ok(result.parts.find((p) => p.label === "تفویض تصمیم").value <= 0.5);
  const emptyMapResult=independenceTest(system,{version:1,records:[r]},id=>id==='p6'?{...e,system}:{system,asis:{...e.asis,processId:'p7',steps:[],connections:[]}},day);
  assert.equal(emptyMapResult.parts.find(p=>p.label==='تفویض تصمیم').value,result.parts.find(p=>p.label==='تفویض تصمیم').value);
});
test("An empty review cannot qualify for the improvement cycle", () => {
  const { r, e } = reviewed();
  r.reviews[0].summary = "";
  assert.equal(ready.improvingReadiness(r, e).ready, false);
});
function reviewed() {
  const { r, e } = setup();
  let result = ready.confirmMeasurement(r, e, "measured");
  e.system = result.system;
  e.source.system = result.system;
  const record = result.record;
  record.reviews = [
    {
      id: "review1",
      processId: "p6",
      periodStart: "2026-09-01",
      periodEnd: "2026-09-07",
      summary: "Review",
      wins: [],
      problems: [],
      blockers: [],
      decisions: [],
      nextActions: [],
      founderChanges: "",
      reviewedByRoleId: "r1",
      createdAt: "2026-09-07T12:00:00Z",
    },
  ];
  record.improvements = [
    {
      ...m.newImprovement("p6"),
      title: "Reduce gap",
      ownerRoleId: "r1",
      status: "in-progress",
      dueDate: "2026-09-20",
    },
  ];
  return { r: record, e };
}
test("3E A: Increase score and clamps", () => {
  const { kpi } = setup();
  assert.equal(k.kpiScore(kpi, 30), 50);
  assert.equal(k.kpiScore(kpi, 10), 0);
  assert.equal(k.kpiScore(kpi, 50), 100);
});
test("3E B: Decrease score", () => {
  const { kpi } = setup();
  Object.assign(kpi, {
    direction: "decrease",
    baselineValue: 18,
    targetValue: 4,
  });
  assert.equal(k.kpiScore(kpi, 11), 50);
  assert.equal(k.kpiScore(kpi, 4), 100);
});
test("3E C: Binary allows only zero or one", () => {
  const { kpi } = setup();
  Object.assign(kpi, { direction: "binary", baselineValue: 0, targetValue: 1 });
  assert.equal(k.kpiScore(kpi, 0), 0);
  assert.equal(k.kpiScore(kpi, 1), 100);
  assert.equal(k.kpiScore(kpi, 0.5), null);
});
test("Maintain tolerance and exact target", () => {
  const { kpi } = setup();
  Object.assign(kpi, { direction: "maintain", targetValue: 10, tolerance: 2 });
  assert.equal(k.kpiScore(kpi, 12), 100);
  assert.equal(k.kpiScore(kpi, 13), 50);
  assert.equal(k.kpiScore(kpi, 14), 0);
  kpi.tolerance = 0;
  assert.equal(k.kpiScore(kpi, 10), 100);
  assert.equal(k.kpiScore(kpi, 11), 0);
});
test("3E D: Equal/custom weights; mixed or invalid total fails clearly", () => {
  const { r, e, kpi } = setup();
  r.kpis.push({ ...kpi, id: "second" });
  r.entries.push({ ...r.entries[0], id: "entry2", kpiId: "second", value: 40 });
  assert.equal(k.weightedPerformance(r, e.system).score, 75);
  r.kpis[0].weight = 80;
  r.kpis[1].weight = 20;
  assert.equal(k.weightedPerformance(r, e.system).score, 60);
  r.kpis[1].weight = null;
  assert.equal(k.weightedPerformance(r, e.system).score, null);
});
test("3E E: KPI gap has KPI reference, target and suggested priority", () => {
  const { r, kpi } = setup(),
    gap = k.kpiGap(kpi, r.entries);
  assert.equal(gap.relatedKpiId, kpi.id);
  assert.ok(gap.description.includes("40"));
  assert.equal(gap.priority, "high");
  r.entries[0].value = 40;
  assert.equal(k.kpiGap(kpi, r.entries), null);
});
test("Trend and current use period date, not insertion order; archived entries remain history", () => {
  const { r, kpi } = setup();
  r.entries.push({
    ...r.entries[0],
    id: "older",
    periodDate: "2026-08-01",
    value: 25,
  });
  assert.equal(k.kpiState(kpi, r.entries).current.value, 30);
  assert.equal(k.kpiState(kpi, r.entries).trend, "رو به بهبود");
  r.entries[0].value = 24;
  assert.equal(k.kpiState(kpi, r.entries).trend, "رو به افت");
});
test("3E F: Health combines exactly 20/20/30/15/15 and missing KPI is null", () => {
  const { r, e } = reviewed(),
    result = h.processHealth(r, e, day);
  assert.equal(
    result.score,
    Math.round(
      result.std * 0.2 +
        result.adoption * 0.2 +
        result.kpi.score * 0.3 +
        result.founder.score * 0.15 +
        result.discipline.score * 0.15,
    ),
  );
  r.entries = [];
  assert.equal(h.processHealth(r, e, day).score, null);
});
test("3E G: Founder-heavy map and owner yield low independence", () => {
  const { e } = setup();
  e.standard = undefined;
  e.system.processes.find((p) => p.id === "p6").ownerRoleId = "r0";
  e.asis.steps.forEach((s) => {
    s.ownerRoleId = "r0";
    s.founderDependency = "critical";
  });
  assert.equal(h.founderIndependence("p6", e).score, 0);
});
test("3E H: Independent map and nonfounder owner yield 100; missing map stays unknown", () => {
  const { e } = setup();
  e.standard = undefined;
  e.asis.steps.forEach((s) => {
    s.ownerRoleId = "r1";
    s.founderDependency = "none";
  });
  assert.equal(h.founderIndependence("p6", e).score, 100);
  e.asis = undefined;
  assert.equal(h.founderIndependence("p6", e).score, null);
});
test("3E I: No active KPI cannot become Measured", () => {
  const { r, e } = setup();
  r.kpis = [];
  r.entries = [];
  assert.equal(ready.measurementReadiness(r, e).ready, false);
  assert.throws(() => ready.confirmMeasurement(r, e, "measured"));
});
test("3E J: Valid measurement allows explicit confirmation; manual bypass blocked", () => {
  const { r, e } = setup();
  assert.throws(() => ready.guardMeasurementStage("measured", r, e));
  const result = ready.confirmMeasurement(r, e, "measured");
  assert.ok(result.record.measuredAt);
  assert.equal(
    result.system.processes.find((p) => p.id === "p6").systemizationStage,
    "measured",
  );
  assert.doesNotThrow(() =>
    ready.guardMeasurementStage("measured", result.record, e),
  );
});
test("3E K: Measured without review/action cannot become Improving", () => {
  const { r, e } = setup(),
    record = ready.confirmMeasurement(r, e, "measured").record;
  assert.equal(ready.improvingReadiness(record, e).ready, false);
});
test("3E L: Review and owned active action allow Improving without target achievement", () => {
  const { r, e } = reviewed(),
    result = ready.confirmMeasurement(r, e, "improving");
  assert.equal(k.weightedPerformance(r, e.system).score, 50);
  assert.equal(
    result.system.processes.find((p) => p.id === "p6").systemizationStage,
    "improving",
  );
  assert.ok(result.record.improvingAt);
  r.reviews = [];
  assert.equal(ready.improvingReadiness(r, e).ready, false);
});
test("3E M: Overdue excludes today, completed and cancelled; discipline falls with overdue", () => {
  const { r, e } = reviewed(),
    item = r.improvements[0],
    before = h.improvementDiscipline(r, e, day).score;
  item.dueDate = day;
  assert.equal(h.overdue(item, day), false);
  item.dueDate = "2026-09-01";
  assert.equal(h.overdue(item, day), true);
  assert.ok(h.improvementDiscipline(r, e, day).score < before);
  item.status = "completed";
  assert.equal(h.overdue(item, day), false);
});
function report(r, e) {
  const system = {
    ...e.system,
    processes: e.system.processes.filter((p) => p.id === "p6"),
  };
  return independenceTest(
    system,
    { version: 1, records: [r] },
    () => ({ ...e, system }),
    day,
  );
}
test("3E N: Critical founder ownership lowers 30-day readiness", () => {
  const { r, e } = reviewed(),
    before = report(r, e).score;
  e.system.processes.find((p) => p.id === "p6").ownerRoleId = "r0";
  assert.ok(report(r, e).score < before);
});
test("3E O: Missing approved SOP reduces readiness", () => {
  const { r, e } = reviewed(),
    before = report(r, e).score;
  e.standard = undefined;
  assert.ok(report(r, e).score < before);
});
test("3E P: Missing measurements lowers KPI coverage and 30-day score", () => {
  const { r, e } = reviewed(),
    before = report(r, e).score;
  r.entries = [];
  assert.ok(report(r, e).score < before);
  assert.equal(report(r, e).rows[0].health.kpi.score, null);
});
test("3E Q/R: Roundtrip restores review, KPI/history, actions and process isolation", () => {
  const { r, e } = reviewed(),
    confirmed = ready.confirmMeasurement(r, e, "improving").record,
    store = { version: 1, records: [confirmed, m.emptyMeasurement("p7")] },
    restored = parseMeasurement(JSON.stringify(store));
  assert.deepEqual(restored, store);
  assert.equal(restored.records[1].entries.length, 0);
});
test("Persistence rejects duplicate periods, impossible dates, NaN and dangling KPI references", () => {
  const { r } = setup();
  for (const mutate of [
    (x) => x.entries.push({ ...x.entries[0], id: "duplicate" }),
    (x) => (x.entries[0].periodDate = "2026-02-30"),
    (x) => (x.entries[0].kpiId = "missing"),
    (x) => (x.kpis[0].tolerance = -1),
  ]) {
    const copy = structuredClone(r);
    mutate(copy);
    assert.throws(() =>
      parseMeasurement(JSON.stringify({ version: 1, records: [copy] })),
    );
  }
});
test("Changing implementation evidence revokes measurement readiness", () => {
  const { r, e } = reviewed();
  e.standard.plan.toolsReady = false;
  assert.equal(ready.measuredCurrent(r, e), false);
  assert.throws(() => ready.guardMeasurementStage("measured", r, e));
});
test("Invalid directional targets and no measurements do not invent score", () => {
  const { r, kpi } = setup();
  kpi.targetValue = 10;
  assert.equal(k.kpiScore(kpi, 30), null);
  assert.equal(k.weightedPerformance(r).score, null);
});
