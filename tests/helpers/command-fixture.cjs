const test = require("node:test"),
  assert = require("node:assert/strict");
const base = "../../.test-build/system/";
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
module.exports = { setup };
