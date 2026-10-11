const { test } = require("node:test"),
  a = require("node:assert/strict");
const root = "../.test-build/scale/scale/";
const M = require(root + "experiments/model.js"),
  L = require(root + "experiments/logic.js"),
  U = require(root + "experiments/mutations.js"),
  V = require(root + "experiments/validation.js"),
  P = require(root + "persistence.js"),
  { seedScale } = require(root + "seed.js");
const seed = () => seedScale("2026-09-30T00:00:00.000Z", "r1");
function draft(metric = "qualified") {
  let s = seed(),
    e = {
      ...M.newExperiment(s),
      title: "Controlled test",
      constraintId: s.primaryConstraintId,
      leverId: "events",
      ownerRoleId: "r1",
      hypothesis: {
        change: "Change",
        audience: "Audience",
        movement: "More qualified leads",
        rationale: "Reason",
      },
      experimentDesign: {
        change: "One event",
        audience: "Owners",
        channel: "Event",
        sample: "20",
        comparison: "Prior month",
        notes: "",
      },
      primaryMetricId: metric,
      baselineValue: 10,
      targetValue: 20,
      minimumSuccessThreshold: 15,
      baselinePeriod: "One month",
      baselineSource: "CRM",
      successCriteria: "20 in one month",
      startDate: L.tehranDay(),
      endDate: L.tehranDay(),
    };
  if (metric === "cpl")
    Object.assign(e, {
      baselineValue: 100,
      targetValue: 50,
      minimumSuccessThreshold: 70,
    });
  if (metric === "accepted")
    Object.assign(e, {
      baselineValue: null,
      targetValue: null,
      minimumSuccessThreshold: null,
    });
  if (metric === "serviceLevel")
    Object.assign(e, {
      baselineValue: 10,
      targetValue: 10,
      minimumSuccessThreshold: null,
      tolerance: 2,
    });
  return { s: U.saveExperiment(s, e), e };
}
function run(metric) {
  let { s, e } = draft(metric);
  s = U.transitionExperiment(s, e.id, "ready");
  s = U.transitionExperiment(s, e.id, "running", "Owner");
  return { s, e: M.experimentData(s).experiments[0] };
}
function measure(s, e, value, extra = {}) {
  return U.addMeasurement(s, {
    id: crypto.randomUUID(),
    experimentId: e.id,
    metricId: e.primaryMetricId,
    measurementDate: L.tehranDay(),
    value,
    note: "Observation",
    source: "Manual",
    createdAt: new Date().toISOString(),
    ...extra,
  });
}
const input = (extra = {}) => ({
  result: "partial",
  resultRationale: "Observed outcome",
  confidenceAfter: "medium",
  learning: "Audience responds but follow-up capacity is limited",
  evidence: "17 qualified leads",
  insight: "Plan follow-up capacity",
  decision: "iterate",
  rationale: "Change the follow-up design",
  capacityReviewed: false,
  alignmentReviewed: false,
  context: "Context captured",
  confirmed: true,
  ...extra,
});
function completed(extra = {}) {
  let { s, e } = run();
  s = measure(s, e, 17);
  s = U.completeExperiment(s, e.id, input(extra));
  return { s, e: M.experimentData(s).experiments[0] };
}
test("5B A ready idea converts to linked draft", () => {
  let s = seed(),
    i = {
      ...s.ideas[0],
      status: "ready",
      rationale: "Reason",
      successMetric: "Qualified leads",
      expectedImpact: "high",
      confidence: "high",
      effort: "low",
    };
  s = P.saveIdea(s, i);
  const r = U.convertIdea(s, i.id);
  a.equal(r.experiment.status, "draft");
  a.equal(r.experiment.ideaId, i.id);
  a.equal(r.experiment.constraintId, i.constraintId);
  const repeated = U.convertIdea(r.store, i.id);
  a.equal(repeated.experiment.id, r.experiment.id);
  a.equal(
    repeated.store.experimentData.experiments.length,
    r.store.experimentData.experiments.length,
  );
});
test("5B B conversion leaves idea intact", () => {
  let s = seed(),
    i = {
      ...s.ideas[0],
      status: "ready",
      rationale: "Reason",
      successMetric: "Leads",
      expectedImpact: "high",
      confidence: "high",
      effort: "low",
    };
  s = P.saveIdea(s, i);
  const r = U.convertIdea(s, i.id);
  a.deepEqual(r.store.ideas, s.ideas);
});
for (const [label, patch] of [
  [
    "C",
    {
      hypothesis: { change: "", audience: "a", movement: "m", rationale: "r" },
    },
  ],
  ["D", { primaryMetricId: "" }],
  ["E", { baselineValue: null }],
  ["F", { successCriteria: "" }],
])
  test(`5B ${label} incomplete definition cannot become ready`, () => {
    let { s, e } = draft();
    s = U.saveExperiment(s, { ...e, ...patch });
    a.throws(() => U.transitionExperiment(s, e.id, "ready"));
  });
test("5B G explicit start records timestamp and snapshot", () => {
  const { s, e } = run();
  a.equal(e.status, "running");
  a.ok(e.startedAt);
  a.equal(e.snapshot.constraintTitle, s.constraints[0].title);
});
test("5B H measurements survive validated roundtrip", () => {
  let { s, e } = run();
  s = measure(s, e, 14);
  s = measure(s, e, 17);
  a.equal(
    M.experimentData(P.parseScale(JSON.stringify(s))).measurements.length,
    2,
  );
});
test("5B I increase direction", () => {
  let { s, e } = run();
  s = measure(s, e, 21);
  a.equal(L.suggestExperimentResult(s, e).status, "win");
});
test("5B J decrease direction", () => {
  let { s, e } = run("cpl");
  s = measure(s, e, 60);
  a.equal(L.suggestExperimentResult(s, e).status, "partial");
});
test("5B K binary interpretation and value guard", () => {
  let { s, e } = run("accepted");
  a.equal(L.experimentReadiness(s, e).ready, true);
  a.throws(() => measure(s, e, 2));
  s = measure(s, e, 1);
  a.equal(L.suggestExperimentResult(s, e).status, "win");
});
test("5B L above-target suggests win", () => {
  let { s, e } = run();
  s = measure(s, e, 30);
  a.equal(L.suggestExperimentResult(s, e).status, "win");
});
test("5B M between minimum/target suggests partial", () => {
  let { s, e } = run();
  s = measure(s, e, 17);
  a.equal(L.suggestExperimentResult(s, e).status, "partial");
});
test("5B N configured absolute tolerance prevents fake effect", () => {
  let { s, e } = draft();
  e = { ...e, tolerance: 1 };
  s = U.saveExperiment(s, e);
  s = U.transitionExperiment(
    U.transitionExperiment(s, e.id, "ready"),
    e.id,
    "running",
  );
  s = measure(s, e, 10.001);
  a.equal(L.suggestExperimentResult(s, e).status, "noEffect");
});
test("5B O movement against direction is negative", () => {
  let { s, e } = run("cpl");
  s = measure(s, e, 110);
  a.equal(L.suggestExperimentResult(s, e).status, "negative");
});
test("5B P insufficient measurement inconclusive", () => {
  const { s, e } = run();
  a.equal(L.suggestExperimentResult(s, e).status, "inconclusive");
  a.throws(() => U.completeExperiment(s, e.id, input({ result: "win" })));
});
test("5B Q suggestion cannot auto-confirm final outcome", () => {
  let { s, e } = run();
  s = measure(s, e, 30);
  a.equal(M.experimentData(s).experiments[0].resultStatus, null);
  a.throws(() => U.completeExperiment(s, e.id, input({ confirmed: false })));
});
test("5B R completed is not necessarily win", () => {
  const { e } = completed({ result: "partial" });
  a.equal(e.status, "completed");
  a.equal(e.resultStatus, "partial");
});
test("5B S learning persisted with source IDs", () => {
  const { s, e } = completed();
  a.equal(
    M.experimentData(P.parseScale(JSON.stringify(s))).learnings[0].experimentId,
    e.id,
  );
});
test("5B T decision persisted", () => {
  const { s } = completed();
  a.equal(
    M.experimentData(P.parseScale(JSON.stringify(s))).decisions[0].decision,
    "iterate",
  );
});
test("5B U iterate copies structure not result/history", () => {
  const { s, e } = completed(),
    r = U.iterateExperiment(s, e.id);
  a.equal(r.experiment.parentExperimentId, e.id);
  a.equal(r.experiment.resultStatus, null);
  a.equal(r.experiment.status, "draft");
  a.equal(r.experiment.startedAt, undefined);
  a.equal(r.experiment.startDate, "");
  a.deepEqual(
    M.experimentData(r.store).experiments.find((x) => x.id === e.id),
    e,
  );
  a.equal(L.measurementsFor(r.store, r.experiment).length, 0);
});
test("5B V win never auto-validates idea", () => {
  let { s, e } = draft();
  e = { ...e, ideaId: s.ideas[0].id };
  s = U.saveExperiment(s, e);
  s = U.transitionExperiment(
    U.transitionExperiment(s, e.id, "ready"),
    e.id,
    "running",
  );
  s = measure(s, e, 25);
  s = U.completeExperiment(s, e.id, input({ result: "win" }));
  a.equal(s.ideas[0].status, "experiment");
  s = U.reviewIdea(
    s,
    s.ideas[0].id,
    e.id,
    "validated",
    "Management accepts limited supporting evidence",
  );
  a.equal(s.ideas[0].status, "validated");
  P.validateScale(s);
});
test("5B W scale decision needs explicit capacity and alignment review", () => {
  let { s, e } = run();
  s = measure(s, e, 25);
  a.throws(() =>
    U.completeExperiment(s, e.id, input({ decision: "scale", result: "win" })),
  );
  s = U.completeExperiment(
    s,
    e.id,
    input({
      decision: "scale",
      result: "win",
      capacityReviewed: true,
      alignmentReviewed: true,
    }),
  );
  a.ok(
    L.experimentNeedsAttention(s, true).some((x) =>
      x.text.includes("ریسک ظرفیت"),
    ),
  );
});
test("5B X completed payload, measurements, learning and decision immutable", () => {
  const { s, e } = completed();
  for (const mutate of [
    (x) => (x.experimentData.experiments[0].baselineValue = 9),
    (x) => (x.experimentData.measurements[0].value = 99),
    (x) => (x.experimentData.learnings[0].statement = "rewrite"),
    (x) => (x.experimentData.decisions[0].decision = "stop"),
  ]) {
    const next = structuredClone(s);
    mutate(next);
    a.throws(() => V.assertExperimentTransition(s, next));
  }
  const changed = structuredClone(s);
  changed.constraints[0].title = "New live name";
  changed.levers.find((l) => l.id === e.leverId).name = "New lever";
  V.assertExperimentTransition(s, changed);
  a.equal(
    M.experimentData(changed).experiments[0].snapshot.constraintTitle,
    e.snapshot.constraintTitle,
  );
});
test("5B Y legacy 5A survives without fabricated experiments", () => {
  const s = seed(),
    copy = P.parseScale(JSON.stringify(s));
  a.deepEqual(copy, s);
  a.equal(copy.experimentData, undefined);
  a.equal(M.experimentData(copy).experiments.length, 0);
});
test("5B maintain interprets tolerance about target", () => {
  let { s, e } = run("serviceLevel");
  s = measure(s, e, 11);
  a.equal(L.suggestExperimentResult(s, e).status, "win");
});
test("5B historical metric direction stable despite library changes", () => {
  let { s, e } = completed();
  const before = L.suggestExperimentResult(s, e);
  s = structuredClone(s);
  s.experimentData.metrics.find((m) => m.id === e.primaryMetricId).direction =
    "decrease";
  a.deepEqual(L.suggestExperimentResult(s, e), before);
});
test("5B invalid reversed thresholds rejected", () => {
  const { s, e } = draft();
  a.throws(() => U.saveExperiment(s, { ...e, minimumSuccessThreshold: 25 }));
});
test("5B stopped/completed experiment rejects new measurement", () => {
  const { s, e } = completed();
  a.throws(() => measure(s, e, 19));
});
test("5B completed missing learning or decision rejected", () => {
  let { s } = completed();
  s = structuredClone(s);
  s.experimentData.learnings = [];
  a.throws(() => P.validateScale(s));
});
test("5B explicit execution guards draft to running and final design", () => {
  let { s, e } = draft();
  a.throws(() => U.transitionExperiment(s, e.id, "running"));
  ({ s, e } = run());
  a.throws(() => U.saveExperiment(s, { ...e, title: "Changed" }));
});
test("5B staleness is configurable and does not stop execution", () => {
  const { s, e } = run();
  const future = new Date();
  future.setDate(future.getDate() + 10);
  a.equal(L.experimentStaleness(s, e, L.tehranDay(future)), true);
  s.experimentData.staleDays = 14;
  a.equal(L.experimentStaleness(s, e, L.tehranDay(future)), false);
  a.equal(e.status, "running");
});
test("5B plain persistence cannot bypass closed history guard", () => {
  const { s } = completed(),
    raw = JSON.stringify(s),
    next = structuredClone(s);
  next.experimentData.measurements[0].value = 99;
  const db = {
    getItem: () => raw,
    setItem: () => a.fail("must not write"),
    removeItem: () => {},
  };
  a.throws(() => P.persistScale(db, next, raw));
});
