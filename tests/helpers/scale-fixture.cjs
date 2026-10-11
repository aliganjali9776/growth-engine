const { test } = require("node:test"),
  a = require("node:assert/strict");
const root = "../../.test-build/scale/scale/",
  D = require(root + "dashboard/selectors.js"),
  M = require(root + "model.js"),
  { seedScale } = require(root + "seed.js"),
  { readScaleSources } = require(root + "sources.js"),
  E = require(root + "experiments/model.js"),
  F = require(root + "funnel/model.js"),
  FL = require(root + "funnel/logic.js"),
  FU = require(root + "funnel/mutations.js"),
  N = require(root + "network/model.js"),
  NL = require(root + "network/logic.js"),
  R = require(root + "readiness/model.js"),
  RL = require(root + "readiness/logic.js");
const ctx = { today: "2026-10-04" };
function fixture() {
  const s = seedScale();
  s.constraints = [];
  s.primaryConstraintId = null;
  s.ideas = [];
  s.experimentData = E.experimentData(s);
  s.funnelData = F.emptyFunnelData();
  s.networkData = N.emptyNetwork();
  s.readinessData = R.emptyReadiness();
  return { s, refs: readScaleSources({ getItem: () => null }) };
}
function constraint(s) {
  const c = {
    ...M.newConstraint(),
    id: "c",
    title: "Constraint",
    status: "active",
    evidence: [{ type: "metric", text: "Observed" }],
  };
  s.constraints.push(c);
  s.primaryConstraintId = c.id;
  return c;
}
function experiment(s, result = "win") {
  const e = {
    ...E.newExperiment(s),
    id: "e" + s.experimentData.experiments.length,
    title: "Experiment",
    status: "completed",
    resultStatus: result,
    startedAt: "2026-09-01",
    completedAt: "2026-09-15",
  };
  s.experimentData.experiments.push(e);
  return e;
}
function funnel(s) {
  s = FU.createFunnel(s, "Observed", "consulting");
  const d = s.funnelData,
    f = d.funnels[0],
    st = d.stages.filter((x) => x.active);
  const rev = {
    ...F.blankRevenue(f.id),
    revenueStageId: st[4].id,
    averageDealValue: 100,
    currentRevenue: 1000,
    targetRevenue: 1500,
  };
  for (let i = 0; i < 2; i++) {
    const p = {
      id: "p" + i,
      funnelId: f.id,
      label: "Period " + i,
      cadence: "monthly",
      status: "completed",
      periodStart: `2026-0${8 + i}-01`,
      periodEnd: `2026-0${8 + i}-28`,
      createdAt: "2026-09-01",
      updatedAt: "2026-09-01",
      snapshot: {
        funnel: structuredClone(f),
        stages: structuredClone(st),
        revenue: structuredClone(rev),
      },
    };
    d.periods.push(p);
    d.measurements.push(
      ...st.map((x, j) => ({
        id: p.id + x.id,
        periodId: p.id,
        funnelId: f.id,
        stageId: x.id,
        volume: [300, 120, 60, 30, 10, 2][j],
        revenueValue: null,
        source: "Observed",
        note: "",
        createdAt: "2026-09-01",
        updatedAt: "2026-09-01",
      })),
    );
  }
  return s;
}
function channel(s, id = "ch") {
  const c = { ...N.newChannel(), id, name: id, active: true };
  s.networkData.channels.push(c);
  const p = {
    ...N.newChannelPeriod(id),
    id: id + "p",
    status: "completed",
    periodStart: "2026-09-01",
    periodEnd: "2026-09-30",
    qualifiedLeads: 20,
    customers: 2,
    revenue: 100,
    spend: null,
    snapshot: structuredClone(c),
  };
  s.networkData.channelPeriods.push(p);
  return c;
}
function candidate(s) {
  const c = {
    ...R.newCandidate(),
    id: "candidate" + s.readinessData.candidates.length,
    name: "Candidate",
    manualEvidence: "Observed",
    manualPositivePeriods: 3,
  };
  s.readinessData.candidates.push(c);
  const sc = { ...R.newScenario(c.id), id: "sc" + c.id };
  s.readinessData.scenarios.push(sc);
  for (const [type, capacity, load] of [
    ["sales", 80, 60],
    ["delivery", 12, 10],
  ])
    s.readinessData.areas.push({
      ...R.newArea(c.id),
      id: c.id + type,
      name: type,
      area: type,
      currentCapacity: capacity,
      currentLoad: load,
      source: "Observed",
    });
  return c;
}

module.exports = {
  fixture,
  constraint,
  experiment,
  funnel,
  channel,
  candidate,
  ctx,
};
