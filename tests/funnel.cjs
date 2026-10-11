const { test } = require("node:test"),
  a = require("node:assert/strict");
const root = "../.test-build/scale/scale/";
const F = require(root + "funnel/model.js"),
  L = require(root + "funnel/logic.js"),
  M = require(root + "funnel/mutations.js"),
  V = require(root + "funnel/validation.js"),
  P = require(root + "persistence.js"),
  E = require(root + "experiments/model.js"),
  EM = require(root + "experiments/mutations.js"),
  { seedScale } = require(root + "seed.js");
function setup() {
  let s = M.createFunnel(
    seedScale("2026-09-01T00:00:00.000Z", "r1"),
    "Consulting",
    "consulting",
  );
  let d = F.funnelData(s),
    f = d.funnels[0];
  s = M.saveStructure(
    s,
    f,
    d.stages.map((st, i) => ({
      ...st,
      ownerRoleId: "r1",
      targetConversion: [null, 40, 50, 50, 40, 40][i],
    })),
  );
  s = M.saveRevenue(s, {
    ...F.blankRevenue(f.id),
    revenueStageId: d.stages[4].id,
    averageDealValue: 100000000,
    targetRevenue: 1500000000,
  });
  return s;
}
function period(s, volumes = [300, 120, 60, 30, 8, 3], month = "08") {
  const d = F.funnelData(s),
    f = d.funnels[0],
    at = F.timestamp(),
    p = {
      id: F.uid(),
      funnelId: f.id,
      periodStart: `2026-${month}-01`,
      periodEnd: `2026-${month}-28`,
      label: month,
      cadence: "monthly",
      status: "draft",
      createdAt: at,
      updatedAt: at,
    };
  const ms = d.stages
    .filter((st) => st.active)
    .map((st, i) => ({
      id: F.uid(),
      periodId: p.id,
      funnelId: f.id,
      stageId: st.id,
      volume: volumes[i] ?? null,
      revenueValue: null,
      note: "",
      source: "manual",
      createdAt: at,
      updatedAt: at,
    }));
  return { s: M.savePeriod(s, p, ms), p };
}
function completed() {
  let { s, p } = period(setup());
  return M.completePeriod(s, p.id);
}
test("A custom funnel created without fabricated data", () => {
  const s = M.createFunnel(seedScale(), "Custom", "custom");
  a.equal(s.funnelData.stages.length, 0);
  a.equal(s.funnelData.measurements.length, 0);
});
test("B stages reorder with stable ids", () => {
  let s = setup(),
    d = s.funnelData;
  const ids = d.stages.map((x) => x.id).reverse();
  s = M.saveStructure(s, d.funnels[0], [...d.stages].reverse());
  a.deepEqual(
    s.funnelData.stages.filter((x) => x.active).map((x) => x.id),
    ids,
  );
  a.deepEqual(
    s.funnelData.stages.map((x) => x.order),
    [0, 1, 2, 3, 4, 5],
  );
});
test("C conversion correct", () => a.equal(L.calculateConversion(30, 60), 50));
test("D zero predecessor unknown", () =>
  a.equal(L.calculateConversion(2, 0), null));
test("E dropoff", () =>
  a.deepEqual(L.calculateDropoff(100, 60), { volume: 40, percent: 40 }));
test("F gap is percentage points", () =>
  a.equal(L.calculateConversionGap(22, 35), -13));
test("G missing target unknown", () =>
  a.equal(L.calculateConversionGap(22, null), null));
test("H impact constraint signal", () => {
  const s = completed(),
    d = s.funnelData,
    r = L.stageRows(d, d.periods[0]);
  const signal = L.calculateFunnelConstraintSignal(
    r,
    d.revenueModels[0].revenueStageId,
    100000000,
  );
  a.equal(signal[0].row.stage.type, "order");
  a.ok(signal[0].impact > 0);
});
test("I lowest conversion not automatically constraint", () => {
  const s = completed(),
    d = s.funnelData,
    r = L.stageRows(d, d.periods[0]);
  r[1].conversion = 2;
  r[1].gap = 0;
  r[1].stage.targetConversion = 2;
  a.equal(
    L.calculateFunnelConstraintSignal(
      r,
      d.revenueModels[0].revenueStageId,
      100000000,
    )[0].row.stage.type,
    "order",
  );
});
test("J unknown stage health", () =>
  a.equal(L.calculateStageHealth(null, 40, null, true, false).score, null));
test("K unknown component excluded not zero", () => {
  a.deepEqual(
    L.calculateFunnelHealth({
      conversion: 80,
      trend: null,
      targets: null,
      freshness: null,
      owners: null,
    }),
    { score: 80, coverage: 50 },
  );
  a.equal(
    L.calculateFunnelHealth({
      conversion: null,
      trend: 100,
      targets: 100,
      freshness: 100,
      owners: 100,
    }).score,
    null,
  );
});
test("L completed measurements frozen", () => {
  const s = completed(),
    n = structuredClone(s);
  n.funnelData.measurements[0].volume = 999;
  a.throws(() => V.assertFunnelTransition(s, n));
});
test("M later structure edit preserves snapshot", () => {
  let s = completed(),
    d = s.funnelData,
    old = JSON.stringify(d.periods[0]);
  s = M.saveStructure(
    s,
    d.funnels[0],
    d.stages.map((x) => ({ ...x, name: x.name + " edited" })),
  );
  a.equal(JSON.stringify(s.funnelData.periods[0]), old);
  a.notEqual(
    F.periodStages(s.funnelData, s.funnelData.periods[0])[0].name,
    s.funnelData.stages[0].name,
  );
});
test("N sample estimated revenue 800M", () =>
  a.equal(L.calculateEstimatedRevenue(8, 100000000), 800000000));
test("O required revenue output 15", () => {
  const s = setup(),
    d = s.funnelData,
    r = d.revenueModels[0];
  a.equal(
    L.backsolveRequiredVolumes(
      d.stages,
      r.revenueStageId,
      r.targetRevenue,
      r.averageDealValue,
      {},
    )[r.revenueStageId],
    15,
  );
});
test("P recursive backsolve", () => {
  const st = [{ id: "q" }, { id: "m" }, { id: "p" }, { id: "c" }];
  a.deepEqual(
    L.backsolveRequiredVolumes(st, "c", 1500, 100, { m: 40, p: 50, c: 30 }),
    { c: 15, p: 50, m: 100, q: 250 },
  );
});
test("Q target scenario decreases requirements", () => {
  const st = [{ id: "p" }, { id: "c" }];
  a.equal(L.backsolveRequiredVolumes(st, "c", 1500, 100, { c: 50 }).p, 30);
});
test("R invalid target >100 rejected", () => {
  let s = setup(),
    d = s.funnelData;
  a.throws(() =>
    M.saveStructure(
      s,
      d.funnels[0],
      d.stages.map((x) => ({ ...x, targetConversion: 101 })),
    ),
  );
  a.throws(() =>
    L.calculateScenario([{ id: "a" }, { id: "b" }], "b", 100, { b: 101 }, 2),
  );
});
test("S Strategy target read only, missing source unknown", () => {
  const r = { ...F.blankRevenue("f"), targetRevenue: 10, strategyKRId: "kr" },
    k = [{ id: "kr", targetValue: 1500 }],
    before = JSON.stringify(k);
  a.equal(L.strategyRevenueTarget(r, k), 1500);
  a.equal(JSON.stringify(k), before);
  a.equal(L.strategyRevenueTarget(r, []), null);
});
test("T experiment stage relation persists", () => {
  let s = setup();
  s = EM.saveExperiment(s, { ...E.newExperiment(s), title: "Experiment" });
  const id = s.experimentData.experiments[0].id;
  s = M.linkFunnel(s, "experiment", id, s.funnelData.stages[0].id);
  a.equal(P.parseScale(JSON.stringify(s)).funnelData.links[0].entityId, id);
});
test("U immutable funnel evidence and primary constraint preserved", () => {
  let s = completed(),
    primary = s.primaryConstraintId;
  s = M.addFunnelEvidence(
    s,
    s.funnelData.periods[0].id,
    s.funnelData.stages[4].id,
    primary,
  );
  a.equal(s.primaryConstraintId, primary);
  a.ok(P.parseScale(JSON.stringify(s)).funnelData.evidence[0].gap < 0);
});
test("V scenario does not change actual data", () => {
  let s = completed(),
    before = JSON.stringify(s),
    d = s.funnelData;
  const rates = Object.fromEntries(d.stages.map((st) => [st.id, 50]));
  L.calculateScenario(d.stages, d.stages[4].id, 100, rates, 200, 10);
  a.equal(JSON.stringify(s), before);
});
test("W refresh persistence", () => {
  const s = completed();
  a.deepEqual(P.parseScale(JSON.stringify(s)), s);
});
test("X previous builds survive optional extension", () => {
  let s = seedScale();
  s = EM.saveExperiment(s, { ...E.newExperiment(s), title: "Previous" });
  const prev = JSON.stringify(s.experimentData),
    ideas = JSON.stringify(s.ideas);
  let n = M.createFunnel(s, "New", "consulting");
  a.equal(JSON.stringify(n.experimentData), prev);
  a.equal(JSON.stringify(n.ideas), ideas);
  a.equal(P.parseScale(JSON.stringify(s)).funnelData, undefined);
});
test("missing volumes block completion", () => {
  const { s, p } = period(setup(), [1]);
  a.throws(() => M.completePeriod(s, p.id));
});
test("zero and missing backsolve rates remain unknown", () => {
  a.deepEqual(
    L.backsolveRequiredVolumes([{ id: "a" }, { id: "b" }], "b", 100, 10, {
      b: 0,
    }),
    { b: 10, a: null },
  );
});
test("overflow never produces Infinity", () => {
  a.equal(L.calculateEstimatedRevenue(Number.MAX_VALUE, 2), null);
  a.equal(L.calculateConversion(Number.MAX_VALUE, Number.MIN_VALUE), null);
});
test("removed stage retains history and rejects revenue stage removal", () => {
  let s = completed(),
    d = s.funnelData;
  a.throws(() =>
    M.saveStructure(
      s,
      d.funnels[0],
      d.stages.filter((st) => st.id !== d.revenueModels[0].revenueStageId),
    ),
  );
  s = M.saveStructure(s, d.funnels[0], d.stages.slice(1));
  a.equal(F.periodStages(s.funnelData, s.funnelData.periods[0]).length, 6);
  a.equal(
    s.funnelData.stages.find((x) => x.id === d.stages[0].id).active,
    false,
  );
});
test("different predecessor suppresses false conversion trend", () => {
  let s = completed(),
    d = s.funnelData;
  s = M.saveStructure(s, d.funnels[0], [
    d.stages[1],
    d.stages[0],
    ...d.stages.slice(2),
  ]);
  let next = period(s, [120, 300, 70, 40, 10, 4], "09");
  s = M.completePeriod(next.s, next.p.id);
  a.equal(
    L.stageRows(
      s.funnelData,
      s.funnelData.periods[1],
      s.funnelData.periods[0],
    )[2].trend,
    null,
  );
});
test("malformed extension rejected", () => {
  const s = setup();
  s.funnelData.measurements = "bad";
  a.throws(() => P.validateScale(s));
});
test("Strategy mismatched units cannot become revenue", () => {
  const r = { ...F.blankRevenue("f"), strategyKRId: "k", currency: "تومان" };
  a.equal(
    L.strategyRevenueTarget(r, [{ id: "k", unit: "لید", targetValue: 100 }]),
    null,
  );
  a.equal(
    L.strategyRevenueTarget(r, [
      { id: "k", unit: "تومان", targetValue: 1500000000 },
    ]),
    1500000000,
  );
});
test("invalid observed conversion is not healthy", () =>
  a.equal(L.calculateStageHealth(120, 40, 40, true, false).score, null));
