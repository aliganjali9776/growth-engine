const { test } = require("node:test"),
  a = require("node:assert/strict");
const root = "../.test-build/scale/scale/",
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
test("5F A known weights normalize with explicit coverage", () => {
  const { s, refs } = fixture();
  constraint(s);
  const h = D.getScaleHealth(s, refs, ctx);
  a.equal(h.score, 100);
  a.equal(h.coverage, 10);
  a.equal(
    h.components.reduce((n, c) => n + c.weight, 0),
    100,
  );
});
test("5F B missing components stay null", () => {
  const { s, refs } = fixture(),
    h = D.getScaleHealth(s, refs, ctx);
  a.equal(h.score, null);
  a.ok(h.components.every((c) => c.value === null));
});
test("5F C health differs from candidate readiness", () => {
  const { s, refs } = fixture(),
    c = candidate(s);
  a.notEqual(
    D.getScaleHealth(s, refs, ctx).score,
    RL.scaleReadiness(s, c, refs, s.readinessData.scenarios[0]).score,
  );
});
test("5F D resolved primary is not current constraint", () => {
  const { s } = fixture();
  constraint(s).status = "resolved";
  a.equal(D.getConstraintSummary(s).primary, null);
});
test("5F E experiment distribution excludes incomplete", () => {
  const { s } = fixture();
  experiment(s, "win");
  experiment(s, "partial");
  experiment(s, "negative");
  const draft = experiment(s, "win");
  draft.status = "draft";
  const l = D.getGrowthLabSummary(s, ctx.today);
  a.equal(l.completed, 3);
  a.equal(l.distribution.win, 1);
});
test("5F F negative result retains learning value", () => {
  const { s } = fixture(),
    e = experiment(s, "negative");
  s.experimentData.learnings.push({
    id: "l",
    experimentId: e.id,
    statement: "Valuable",
    evidence: "Observed",
    createdAt: "2026-09-20",
  });
  s.experimentData.decisions.push({
    id: "d",
    experimentId: e.id,
    decision: "stop",
  });
  a.equal(D.getGrowthLabSummary(s, ctx.today).learningCoverage, 100);
  a.equal(D.getGrowthLabSummary(s, ctx.today).positive, 0);
});
test("5F G funnel health exactly canonical", () => {
  let { s, refs } = fixture();
  s = funnel(s);
  const x = D.getFunnelExecutiveSummary(s, refs, ctx);
  a.deepEqual(
    x.health,
    FL.healthSummary(x.rows, x.period, s.funnelData.staleDays, []),
  );
});
test("5F H scenario cannot alter actual revenue", () => {
  let { s, refs } = fixture();
  s = funnel(s);
  const current = D.getRevenueExecutiveSummary(s, refs, ctx),
    target = D.getRevenueExecutiveSummary(s, refs, {
      ...ctx,
      scenario: "target",
    });
  a.equal(current.actual, 1000);
  a.equal(target.actual, 1000);
  a.equal(current.estimate, 1000);
  a.equal(current.gap, 500);
});
test("5F I concentration is canonical same-period measure", () => {
  const { s } = fixture();
  channel(s, "a");
  channel(s, "b");
  a.deepEqual(
    D.getChannelConcentrationSummary(s, ctx),
    NL.channelPortfolioSummary(s, "2026-09-01|2026-09-30").concentration,
  );
});
test("5F J missing spend means unknown efficiency", () => {
  const { s } = fixture();
  channel(s);
  a.equal(
    D.getChannelPortfolioSummary(s, ctx).rows[0].performance.revenuePerSpend,
    null,
  );
});
test("5F K no loop history is unproven", () => {
  const { s } = fixture();
  s.networkData.loops.push({ ...N.newLoop(), name: "New loop" });
  a.equal(D.getLoopPortfolioSummary(s)[0].strength.state, "unproven");
});
test("5F L gate exactly matches readiness model", () => {
  const { s, refs } = fixture(),
    c = candidate(s);
  a.equal(
    D.getScaleCandidatePortfolio(s, refs)[0].assessment.gate,
    RL.scaleReadiness(s, c, refs, s.readinessData.scenarios[0]).gate,
  );
});
test("5F M historical readiness uses snapshot", () => {
  const { s, refs } = fixture(),
    c = candidate(s),
    assessment = RL.scaleReadiness(s, c, refs, s.readinessData.scenarios[0]);
  s.readinessData.snapshots.push({
    id: "h",
    candidateId: c.id,
    createdAt: "2026-09-01",
    candidate: structuredClone(c),
    scenario: s.readinessData.scenarios[0],
    assessment: structuredClone(assessment),
  });
  s.readinessData.areas[0].currentCapacity = 999;
  a.equal(D.getScaleReadinessTrend(s, c.id)[0].score, assessment.score);
});
test("5F N canonical primary breakpoint", () => {
  const { s, refs } = fixture();
  candidate(s);
  a.equal(D.getCapacityExecutiveSummary(s, refs).primary.area, "delivery");
});
test("5F O next constraint retained", () => {
  const { s, refs } = fixture();
  candidate(s);
  a.equal(
    D.getScaleCandidatePortfolio(s, refs)[0].assessment.next.area,
    "sales",
  );
});
test("5F P only linked founder process included", () => {
  const { s, refs } = fixture(),
    c = candidate(s);
  c.processIds = ["p"];
  refs.capacity = [
    {
      id: "p",
      title: "Closing",
      health: 80,
      independence: 20,
      standardization: 80,
      adoption: 80,
      kpi: 80,
      founderDependency: "high",
      ownerRoleId: "r",
      reasons: ["Founder"],
      risk: true,
    },
  ];
  a.ok(
    D.getCapacityExecutiveSummary(s, refs).risks.some((r) =>
      r.area.includes("بنیان"),
    ),
  );
});
test("5F Q absent strategy does not imply alignment", () => {
  const { s, refs } = fixture(),
    c = candidate(s);
  c.objectiveId = "missing";
  a.equal(D.getScaleCandidatePortfolio(s, refs)[0].aligned, false);
});
test("5F R absent external modules safe", () => {
  const { s, refs } = fixture();
  a.doesNotThrow(() => D.getScaleDashboard(s, refs, ctx));
});
test("5F S old funnel values unaffected by current stage edits", () => {
  let { s, refs } = fixture();
  s = funnel(s);
  const before = JSON.stringify(
    D.getFunnelExecutiveSummary(s, refs, ctx).history,
  );
  s.funnelData.stages[0].name = "Changed";
  s.funnelData.revenueModels.push({
    ...F.blankRevenue(s.funnelData.funnels[0].id),
    currentRevenue: 9999,
  });
  a.equal(
    JSON.stringify(D.getFunnelExecutiveSummary(s, refs, ctx).history),
    before,
  );
});
test("5F T headlines respond to data; no synthetic fixed values", () => {
  const { s, refs } = fixture();
  a.equal(D.getScaleDashboard(s, refs, ctx).lab.completed, 0);
  experiment(s);
  a.equal(D.getScaleDashboard(s, refs, ctx).lab.completed, 1);
});
test("5F U realistic and larger aggregation", () => {
  for (const multiplier of [1, 2]) {
    let { s, refs } = fixture();
    s = funnel(s);
    for (let i = 0; i < 20 * multiplier; i++) {
      s.constraints.push({ ...M.newConstraint(), id: "c" + i });
      channel(s, "ch" + i);
    }
    for (let i = 0; i < 100 * multiplier; i++) {
      s.ideas.push({ ...M.newIdea(), id: "i" + i });
      experiment(s, i % 2 ? "win" : "negative");
    }
    for (let i = 0; i < 20 * multiplier; i++) candidate(s);
    for (let i = 0; i < 15 * multiplier; i++)
      s.networkData.loops.push({ ...N.newLoop(), id: "l" + i, name: "Loop" });
    const base = [...s.networkData.channelPeriods];
    for (const p of base)
      for (let j = 0; j < 23; j++)
        s.networkData.channelPeriods.push({
          ...p,
          id: p.id + j,
          periodStart: `2024-${String((j % 12) + 1).padStart(2, "0")}-01`,
          periodEnd: `2024-${String((j % 12) + 1).padStart(2, "0")}-28`,
        });
    for (let i = 2; i < 20; i++)
      s.funnelData.periods.push({
        ...structuredClone(s.funnelData.periods[0]),
        id: "period" + i,
      });
    const start = performance.now(),
      d = D.getScaleDashboard(s, refs, ctx),
      elapsed = performance.now() - start;
    a.equal(d.candidates.length, 20 * multiplier);
    a.ok(elapsed < 3000, `aggregation ${elapsed}ms`);
    console.log(`5F ${multiplier}x aggregation ${Math.round(elapsed)}ms`);
  }
});
test("5F V selectors never mutate 5A–5E stores", () => {
  let { s, refs } = fixture();
  s = funnel(s);
  channel(s);
  candidate(s);
  const before = JSON.stringify(s);
  D.getScaleDashboard(s, refs, ctx);
  a.equal(JSON.stringify(s), before);
});
test("5F missing data serializes without NaN or Infinity", () => {
  const { s, refs } = fixture();
  const d = D.getScaleDashboard(s, refs, ctx);
  const walk = (x) => {
    if (typeof x === "number") a.ok(Number.isFinite(x));
    else if (x && typeof x === "object") Object.values(x).forEach(walk);
  };
  walk(d);
  a.equal(d.revenue.actual, null);
  a.equal(d.revenue.target, null);
  a.equal(d.momentum.state, "insufficient");
});
