const { test } = require("node:test");
const a = require("node:assert/strict");
const {
  fixture,
  constraint,
  experiment,
  funnel,
  channel,
  candidate,
  ctx,
} = require("./helpers/scale-fixture.cjs");
const root = "../.test-build/scale/scale/";
const D = require(root + "dashboard/selectors.js"),
  R = require(root + "readiness/model.js"),
  RL = require(root + "readiness/logic.js"),
  RU = require(root + "readiness/mutations.js"),
  RV = require(root + "readiness/validation.js"),
  P = require(root + "persistence.js"),
  N = require(root + "network/model.js"),
  NU = require(root + "network/mutations.js"),
  NL = require(root + "network/logic.js"),
  F = require(root + "funnel/model.js"),
  FL = require(root + "funnel/logic.js"),
  FU = require(root + "funnel/mutations.js"),
  E = require(root + "experiments/model.js"),
  EL = require(root + "experiments/logic.js");
function setup() {
  let { s, refs } = fixture();
  const c = {
    ...R.newCandidate(),
    name: "Hardening QA",
    manualEvidence: "Observed",
    manualPositivePeriods: 3,
    ownerRoleId: "r",
  };
  refs.roles = [{ id: "r", title: "Operations" }];
  s = RU.saveCandidate(s, c);
  const sc = R.newScenario(c.id);
  s = RU.saveScenario(s, sc);
  return { s, c, sc, refs };
}
test("5G same Tehran day duration is zero across UTC midnight; reversed time is unknown", () => {
  const { s } = fixture();
  const e = experiment(s);
  e.startedAt = "2026-10-04T23:30:00Z";
  e.completedAt = "2026-10-05T00:10:00Z";
  a.equal(D.getExperimentPortfolio(s, "2026-10-05")[0].duration, 0);
  e.completedAt = "2026-10-04T22:00:00Z";
  a.equal(D.getExperimentPortfolio(s, "2026-10-05")[0].duration, null);
});
test("5G dates at Tehran midnight use local calendar day", () => {
  a.equal(EL.tehranDay(new Date("2026-10-03T21:00:00Z")), "2026-10-04");
  const { s } = fixture();
  s.experimentData.measurements.push({ measurementDate: "2026-10-05" });
  const f = D.getScaleDataFreshness(s, ctx.today).find(
    (x) => x.key === "measurement",
  );
  a.equal(f.future, true);
  a.equal(f.age, -1);
});
test("5G future completion is not recent activity", () => {
  const { s } = fixture();
  experiment(s).completedAt = "2026-10-05T12:00:00Z";
  a.equal(D.getGrowthLabSummary(s, ctx.today).recentCompleted, 0);
});
test("5G freshness includes completed loop periods and missing remains missing", () => {
  const { s } = fixture();
  a.equal(
    D.getScaleDataFreshness(s, ctx.today).find((x) => x.key === "loop").date,
    null,
  );
  s.networkData.loopPeriods.push({
    status: "completed",
    periodEnd: "2026-09-30",
  });
  a.equal(
    D.getScaleDataFreshness(s, ctx.today).find((x) => x.key === "loop").age,
    4,
  );
});
test("5G report result distribution and table share filtered portfolio", () => {
  const { s } = fixture();
  experiment(s, "win");
  experiment(s, "negative");
  experiment(s, "negative");
  const rows = D.getExperimentPortfolio(s, ctx.today).filter(
    (x) => x.experiment.resultStatus === "negative",
  );
  const lab = D.summarizeGrowthLab(s, ctx.today, rows);
  a.equal(lab.completed, rows.length);
  a.equal(lab.distribution.negative, 2);
  a.equal(lab.distribution.win, 0);
});
test("5G malformed missing result does not masquerade as failed performance", () => {
  const { s, refs } = fixture();
  experiment(s, null);
  a.equal(
    D.getScaleHealth(s, refs, ctx).components.find(
      (x) => x.key === "experiment",
    ).value,
    null,
  );
});
test("5G snapshot role corruption is rejected before UI rendering", () => {
  let { s, c, sc, refs } = setup();
  s = RU.recordAssessment(s, c.id, sc.id, refs);
  s.readinessData.snapshots[0].sourceContext.roles = {};
  a.throws(() => P.parseScale(JSON.stringify(s)));
});
test("5G snapshot malformed nested rows are rejected", () => {
  let { s, c, sc, refs } = setup();
  s = RU.recordAssessment(s, c.id, sc.id, refs);
  s.readinessData.snapshots[0].assessment.plan = [null];
  a.throws(() => P.parseScale(JSON.stringify(s)));
});
test("5G capacity cannot be reparented to another candidate", () => {
  let { s, c } = setup();
  s = RU.saveCandidate(s, { ...R.newCandidate(), id: "other", name: "Other" });
  const area = { ...R.newArea(c.id), name: "Sales" };
  s = RU.saveArea(s, area);
  a.throws(() => RU.saveArea(s, { ...area, candidateId: "other" }));
});
test("5G candidate source bypass rejected at persistence boundary", () => {
  const { s, c } = setup(),
    next = structuredClone(s);
  next.readinessData.candidates[0].sourceId = "changed";
  a.throws(() => RV.assertReadinessTransition(s, next));
});
test("5G manually jumping to ready needs assessment evidence", () => {
  const { s, c } = setup();
  a.throws(() => RU.saveCandidate(s, { ...c, status: "ready" }));
});
test("5G a stale ready snapshot cannot bypass changed capacity through generic persistence", () => {
  let { s, c, sc, refs } = setup();
  s = RU.recordAssessment(s, c.id, sc.id, refs);
  s.readinessData.snapshots[0].assessment.gate = "ready";
  s = RU.saveArea(s, {
    ...R.newArea(c.id),
    name: "Changed capacity",
    currentCapacity: 10,
    currentLoad: 20,
    source: "Observed",
  });
  const next = structuredClone(s);
  next.readinessData.candidates[0].status = "ready";
  a.throws(() => RV.assertReadinessTransition(s, next));
  a.throws(() => RU.saveCandidate(s, next.readinessData.candidates[0], refs));
});
test("5G archived candidate cannot silently reenter execution", () => {
  let { s, c } = setup();
  s = RU.saveCandidate(s, { ...c, status: "archived" });
  a.throws(() => RU.saveCandidate(s, { ...c, status: "assessing" }));
});
test("5G decision report retains stopped and archived candidate history", () => {
  let { s, c, sc, refs } = setup();
  s = RU.recordAssessment(s, c.id, sc.id, refs, {
    decision: "stop",
    rationale: "Insufficient repeatability",
    reviewedByRoleId: "r",
    reviewed: true,
  });
  a.equal(D.getScaleCandidatePortfolio(s, refs).length, 0);
  a.equal(
    D.getScaleCandidatePortfolio(s, refs, true)[0].decision.decision,
    "stop",
  );
});
test("5G missing one of two linked processes cannot silently improve readiness", () => {
  const { s, c, sc, refs } = setup();
  c.processIds = ["known", "missing"];
  refs.capacity = [
    {
      id: "known",
      health: 100,
      standardization: 100,
      adoption: 100,
      kpi: 100,
      independence: 100,
      founderDependency: "low",
      reasons: [],
    },
  ];
  const v = RL.scaleReadiness(s, c, refs, sc);
  a.equal(v.components.find((x) => x.key === "process").value, null);
  a.equal(v.completenessParts.system, false);
  a.notEqual(v.gate, "ready");
});
test("5G wrong-objective KR is not reported as valid alignment", () => {
  const { s, refs } = fixture();
  const c = candidate(s);
  c.objectiveId = "missing";
  c.krId = "kr";
  refs.keyResults = [{ id: "kr", objectiveId: "other" }];
  a.equal(D.getScaleCandidatePortfolio(s, refs)[0].aligned, false);
});
test("5G archived Strategy sources disappear from current choices without changing storage", () => {
  const { seedStrategy } = require("../.test-build/strategy/seed.js");
  const { withSampleKRs } = require("../.test-build/strategy/kr/seed.js");
  const { readScaleSources } = require(root + "sources.js");
  const strategy = withSampleKRs(seedStrategy([{ id: "r1", title: "Owner" }]));
  strategy.cycles.forEach((c) => {
    c.status = "archived";
    c.closedAt = "2026-09-30T00:00:00Z";
  });
  const raw = JSON.stringify(strategy);
  const refs = readScaleSources({
    getItem: (key) => (key === "growth-engine.strategy.v1" ? raw : null),
  });
  a.deepEqual(refs.notices, []);
  a.deepEqual(refs.objectives, []);
  a.deepEqual(refs.keyResults, []);
  a.equal(JSON.stringify(strategy), raw);
});
test("5G monetary Strategy target drives backsolve read-only and unavailable target stays unknown", () => {
  const { s, refs } = fixture();
  const f = funnel(s);
  const model = f.funnelData.periods.at(-1).snapshot.revenue;
  model.averageDealValue = 100000000;
  model.currency = "تومان";
  model.strategyKRId = "revenue-kr";
  refs.keyResults = [
    { id: "revenue-kr", targetValue: 1200000000, unit: "تومان" },
  ];
  const before = JSON.stringify(refs);
  model.targetRevenue = FL.strategyRevenueTarget(model, refs.keyResults);
  const view = D.getRevenueExecutiveSummary(f, refs, ctx);
  a.equal(view.target, 1200000000);
  a.equal(
    view.required.find((x) => x.id === model.revenueStageId).required,
    12,
  );
  a.equal(JSON.stringify(refs), before);
  refs.keyResults = [];
  a.equal(FL.strategyRevenueTarget(model, refs.keyResults), null);
  a.equal(D.getRevenueExecutiveSummary(f, refs, ctx).target, 1200000000);
});
test("5G demand and measurement quality do not reward repeated observations twice", () => {
  const { s, c, sc, refs } = setup();
  const first = RL.scaleReadiness(
      s,
      { ...c, manualPositivePeriods: 1 },
      refs,
      sc,
    ),
    third = RL.scaleReadiness(s, c, refs, sc);
  for (const key of ["demand", "data"])
    a.equal(
      first.components.find((x) => x.key === key).value,
      third.components.find((x) => x.key === key).value,
    );
  a.ok(
    first.components.find((x) => x.key === "repeatability").value <
      third.components.find((x) => x.key === "repeatability").value,
  );
});
test("5G repeated experiment lineage is not independent demand repeatability", () => {
  const { s } = fixture();
  const e = experiment(s);
  for (let i = 0; i < 8; i++) experiment(s).parentExperimentId = e.id;
  const c = { ...R.newCandidate(), sourceType: "experiment", sourceId: e.id };
  a.equal(RL.repeatabilityAssessment(s, c).state, "early");
});
test("5G history and explicit decision survive capacity improvement", () => {
  let { s, c, sc, refs } = setup();
  const area = {
    ...R.newArea(c.id),
    name: "Delivery",
    area: "delivery",
    currentCapacity: 10,
    currentLoad: 8,
    source: "Observation",
  };
  s = RU.saveArea(s, area);
  s = RU.recordAssessment(s, c.id, sc.id, refs, {
    decision: "prepare",
    rationale: "Add capacity",
    reviewedByRoleId: "r",
    reviewed: true,
  });
  const history = JSON.stringify([
    s.readinessData.snapshots,
    s.readinessData.decisions,
  ]);
  s = RU.saveArea(s, { ...area, currentCapacity: 100 });
  a.equal(
    JSON.stringify([s.readinessData.snapshots, s.readinessData.decisions]),
    history,
  );
});
test("5G channel metadata changes preserve historical attribution", () => {
  let { s } = fixture();
  const c = { ...N.newChannel(), name: "Original" };
  s = NU.saveChannel(s, c);
  const p = {
    ...N.newChannelPeriod(c.id),
    periodStart: "2026-09-01",
    periodEnd: "2026-09-30",
    source: "Manual",
    customers: 2,
  };
  s = NU.saveChannelPeriod(s, p);
  s = NU.completeChannelPeriod(s, p.id);
  const old = JSON.stringify(s.networkData.channelPeriods);
  s = NU.saveChannel(s, { ...c, name: "Renamed", description: "Changed" });
  a.equal(JSON.stringify(s.networkData.channelPeriods), old);
  a.equal(
    NL.channelPerformance(s.networkData.channelPeriods[0]).revenuePerSpend,
    null,
  );
});
test("5G funnel history and scenario remain independent of live structure", () => {
  let { s, refs } = fixture();
  s = funnel(s);
  const old = JSON.stringify(s.funnelData.periods);
  s.funnelData.stages.reverse().forEach((x, i) => {
    x.name = "New " + i;
    x.order = i;
  });
  const before = JSON.stringify(s);
  D.getRevenueExecutiveSummary(s, refs, { ...ctx, scenario: "target" });
  a.equal(JSON.stringify(s), before);
  a.equal(JSON.stringify(s.funnelData.periods), old);
  a.notEqual(
    D.getFunnelExecutiveSummary(s, refs, ctx).rows[0].stage.name,
    "New 0",
  );
});
test("5G documented revenue backsolve is 12 contracts 40 proposals 80 meetings", () => {
  const stages = [
    { id: "m", name: "Meetings", order: 0, active: true },
    { id: "p", name: "Proposals", order: 1, active: true },
    { id: "c", name: "Contracts", order: 2, active: true },
  ];
  const r = FL.backsolveRequiredVolumes(stages, "c", 1200000000, 100000000, {
    p: 50,
    c: 30,
  });
  a.deepEqual(r, { c: 12, p: 40, m: 80 });
});
test("5G empty and broken external references never fabricate health or trend", () => {
  const { s, refs } = fixture();
  const d = D.getScaleDashboard(s, refs, ctx);
  a.equal(d.health.score, null);
  a.equal(d.momentum.state, "insufficient");
  const c = candidate(s);
  c.sourceType = "channel";
  c.sourceId = "removed";
  c.processIds = ["removed"];
  a.doesNotThrow(() => D.getScaleDashboard(s, refs, ctx));
});
test("5G missing financial capacity remains null and gate is not a decision", () => {
  const { s, c, sc, refs } = setup(),
    before = JSON.stringify(s),
    r = RL.scaleReadiness(s, c, refs, sc);
  a.equal(r.financial, null);
  a.equal(r.gate, "insufficient");
  a.equal(s.readinessData.decisions.length, 0);
  a.equal(JSON.stringify(s), before);
});
test("5G persistence round trip preserves previous builds and snapshots", () => {
  let { s, c, sc, refs } = setup();
  s = RU.recordAssessment(s, c.id, sc.id, refs);
  const before = JSON.stringify(s);
  const parsed = P.parseScale(before);
  D.getScaleDashboard(parsed, refs, ctx);
  a.equal(JSON.stringify(parsed), before);
  a.throws(() => P.parseScale("{bad"));
});
test("5G invalid capacities and orphan internal relations rejected before save", () => {
  const { s, c } = setup();
  a.throws(() =>
    RU.saveArea(s, {
      ...R.newArea(c.id),
      name: "Invalid",
      currentCapacity: -1,
      source: "x",
    }),
  );
  const bad = structuredClone(s);
  bad.ideas.push({
    ...require(root + "model.js").newIdea(),
    title: "Orphan",
    constraintId: "missing",
  });
  a.throws(() => P.validateScale(bad));
});
function large(stress) {
  let { s, refs } = fixture();
  s = funnel(s);
  const counts = stress
    ? [50, 500, 500, 52, 75, 36, 50, 75, 100]
    : [20, 150, 150, 30, 30, 24, 20, 30, 50];
  const [nc, ni, ne, nf, nch, ncp, nl, ncand, na] = counts;
  const M = require(root + "model.js");
  s.constraints = Array.from({ length: nc }, (_, i) => ({
    ...M.newConstraint(),
    id: "constraint" + i,
    title: "Constraint " + i,
  }));
  s.ideas = Array.from({ length: ni }, (_, i) => ({
    ...M.newIdea(),
    id: "idea" + i,
    title: "Idea " + i,
    constraintId: s.constraints[i % nc].id,
  }));
  for (let i = 0; i < ne; i++) {
    const e = experiment(s, i % 3 ? "win" : "negative");
    e.ideaId = s.ideas[i % ni].id;
    e.constraintId = s.constraints[i % nc].id;
    s.experimentData.measurements.push({
      id: "measurement" + i,
      experimentId: e.id,
      metricId: "qualified",
      value: i,
      measurementDate: "2026-09-01",
      createdAt: "2026-09-01",
      source: "Observed",
      note: "",
    });
    s.experimentData.learnings.push({
      id: "learning" + i,
      experimentId: e.id,
      statement: "Observed finding",
      evidence: "Measured",
      createdAt: "2026-09-01",
    });
  }
  function dates(i) {
    const start = new Date(Date.UTC(2020, i, 1)),
      end = new Date(Date.UTC(2020, i + 1, 0));
    return {
      periodStart: start.toISOString().slice(0, 10),
      periodEnd: end.toISOString().slice(0, 10),
    };
  }
  const base = s.funnelData.periods[0],
    baseMs = s.funnelData.measurements.filter((x) => x.periodId === base.id);
  s.funnelData.periods = [];
  s.funnelData.measurements = [];
  for (let i = 0; i < nf; i++) {
    const p = {
      ...structuredClone(base),
      id: "period" + i,
      label: "Month " + i,
      ...dates(i),
    };
    s.funnelData.periods.push(p);
    s.funnelData.measurements.push(
      ...baseMs.map((x, j) => ({
        ...x,
        id: p.id + "m" + j,
        periodId: p.id,
        volume: x.volume + i,
      })),
    );
  }
  for (let i = 0; i < nch; i++) {
    const c = channel(s, "channel" + i),
      base = s.networkData.channelPeriods.pop();
    for (let j = 0; j < ncp; j++)
      s.networkData.channelPeriods.push({
        ...structuredClone(base),
        id: c.id + "p" + j,
        ...dates(j),
      });
  }
  for (let i = 0; i < nl; i++) {
    const loop = {
      ...N.newLoop(),
      id: "loop" + i,
      name: "Loop " + i,
      ownerRoleId: "r",
      primaryOutputMetricId: "qualified",
      reentry: "Satisfied customers refer another customer",
    };
    s.networkData.loops.push(loop);
    const nodes = Array.from({ length: 4 }, (_, j) => ({
      ...N.newNode(loop.id, j),
      id: loop.id + "node" + j,
      name: "Node " + j,
      metricId: "qualified",
    }));
    s.networkData.nodes.push(...nodes);
    for (let j = 0; j < ncp; j++)
      s.networkData.loopPeriods.push({
        id: loop.id + "period" + j,
        loopId: loop.id,
        ...dates(j),
        status: "completed",
        nodeMeasurements: nodes.map((n, k) => ({
          nodeId: n.id,
          value: 100 - k * 10 + j,
        })),
        outputMetric: 20 + j,
        inputVolume: 100 + j,
        cycleTime: 30,
        note: "Observed",
        createdAt: "2026-09-01",
        snapshot: {
          loop: structuredClone(loop),
          nodes: structuredClone(nodes),
          metricName: "Qualified",
          metricUnit: "lead",
        },
      });
  }
  for (let i = 0; i < ncand; i++) {
    const c = candidate(s);
    c.sourceType = "channel";
    c.sourceId = s.networkData.channels[i % nch].id;
  }
  s.readinessData.areas = Array.from({ length: na }, (_, i) => ({
    ...R.newArea(s.readinessData.candidates[i % ncand].id),
    id: "area" + i,
    name: "Area " + i,
    area: i % 2 ? "delivery" : "sales",
    currentCapacity: 100,
    currentLoad: 65,
    source: "Observed",
  }));
  return { s, refs, counts };
}
for (const stress of [false, true])
  test(
    "5G " +
      (stress ? "stress" : "realistic") +
      " complete selector workload remains deterministic and finite",
    () => {
      const { s, refs, counts } = large(stress),
        before = JSON.stringify(s),
        times = {};
      const calls = {
        getScaleDashboard: () => D.getScaleDashboard(s, refs, ctx),
        getScaleHealth: () => D.getScaleHealth(s, refs, ctx),
        getScaleEvidence: () => D.getScaleEvidence(s),
        getScaleMomentum: () => D.getScaleMomentum(s, refs, ctx),
        getScaleAttention: () => D.getScaleAttention(s, refs, ctx),
        getExperimentPortfolio: () => D.getExperimentPortfolio(s, ctx.today),
        getFunnelExecutiveSummary: () =>
          D.getFunnelExecutiveSummary(s, refs, ctx),
        getRevenueExecutiveSummary: () =>
          D.getRevenueExecutiveSummary(s, refs, ctx),
        getChannelPortfolioSummary: () => D.getChannelPortfolioSummary(s, ctx),
        getChannelConcentrationSummary: () =>
          D.getChannelConcentrationSummary(s, ctx),
        getLoopPortfolioSummary: () => D.getLoopPortfolioSummary(s),
        getScaleCandidatePortfolio: () => D.getScaleCandidatePortfolio(s, refs),
        getCapacityExecutiveSummary: () =>
          D.getCapacityExecutiveSummary(s, refs),
        getScaleReadinessTrend: () =>
          D.getScaleReadinessTrend(s, s.readinessData.candidates[0].id),
        getScaleDataCompleteness: () => D.getScaleDataCompleteness(s, refs),
        getScaleDataFreshness: () => D.getScaleDataFreshness(s, ctx.today),
        getScaleDataConfidence: () =>
          D.getScaleDataConfidence(s, refs, ctx.today),
      };
      function finite(x) {
        if (typeof x === "number") a.ok(Number.isFinite(x));
        else if (x && typeof x === "object") Object.values(x).forEach(finite);
      }
      for (const [name, call] of Object.entries(calls)) {
        const start = performance.now(),
          value = call();
        times[name] = Math.round((performance.now() - start) * 100) / 100;
        finite(value);
        a.deepEqual(call(), value);
      }
      a.equal(JSON.stringify(s), before);
      a.ok(times.getScaleDashboard < 5000);
      console.log("5G performance", JSON.stringify({ stress, counts, times }));
    },
  );
