const { test } = require("node:test");
const a = require("node:assert/strict");
const m = require("../.test-build/strategy/model.js");
const c = require("../.test-build/strategy/kr/calculations.js");
const v = require("../.test-build/strategy/kr/validation.js");
const mutations = require("../.test-build/strategy/kr/mutations.js");
const reports = require("../.test-build/strategy/kr/report.js");
const { seedStrategy } = require("../.test-build/strategy/seed.js");
const { withSampleKRs } = require("../.test-build/strategy/kr/seed.js");
const roles = [{ id: "r1", title: "مدیر رشد" }],
  today = "2026-10-12";
const kr = (over = {}) => ({
  id: "k1",
  cycleId: "sample-1405",
  objectiveId: "sample-o1",
  code: "KR1",
  title: "افزایش مشتریان از ۱۰ به ۲۰",
  description: "",
  ownerRoleId: "r1",
  type: "increase",
  startValue: 10,
  targetValue: 20,
  currentValue: 15,
  unit: "مشتری",
  weight: 100,
  confidence: 7,
  startDate: "2026-09-12",
  deadline: "2026-11-11",
  lastUpdateAt: "2026-10-11T12:00:00Z",
  createdAt: "2026-09-12T00:00:00Z",
  updatedAt: "2026-10-11T12:00:00Z",
  notes: "",
  lifecycle: "active",
  milestones: [],
  ...over,
});
const store = (krs = [kr()]) => ({
  ...seedStrategy(roles),
  keyResults: krs,
  objectives: seedStrategy(roles).objectives.map((o) =>
    o.id === "sample-o1" ? { ...o, status: "active" } : o,
  ),
});
const milestone = (id, weight, completed) => ({
  id,
  keyResultId: "k1",
  title: id,
  weight,
  completed,
});
test("4B A increase includes decimals and negative baselines", () => {
  a.equal(c.calculateIncreaseProgress(1, 1.5, 1.25), 50);
  a.equal(c.calculateIncreaseProgress(-20, -10, -15), 50);
});
test("4B B decrease rewards improvement", () =>
  a.equal(c.calculateDecreaseProgress(12, 3, 7.5), 50));
test("4B C binary never invents intermediate achievement", () => {
  a.equal(c.calculateBinaryProgress(0), 0);
  a.equal(c.calculateBinaryProgress(1), 100);
  a.equal(c.calculateBinaryProgress(0.5), null);
  a.equal(c.calculateBinaryProgress(null), null);
});
test("4B D milestone sum and invalid weights", () => {
  const ms = [
    milestone("a", 20, true),
    milestone("b", 30, false),
    milestone("c", 50, true),
  ];
  a.equal(c.calculateMilestoneProgress(ms), 70);
  ms[0].weight = 25;
  a.equal(c.calculateMilestoneProgress(ms), null);
  a.equal(c.calculateMilestoneProgress([]), null);
});
test("4B E increase caps and regression floors", () => {
  a.equal(c.calculateIncreaseProgress(10, 20, 30), 100);
  a.equal(c.calculateIncreaseProgress(10, 20, 0), 0);
});
test("4B F decrease caps and regression floors", () => {
  a.equal(c.calculateDecreaseProgress(12, 3, 0), 100);
  a.equal(c.calculateDecreaseProgress(12, 3, 15), 0);
});
test("4B G equal targets, missing, invalid direction and extreme numbers are safe", () => {
  a.equal(c.calculateIncreaseProgress(2, 2, 2), null);
  a.equal(c.calculateDecreaseProgress(2, 2, 2), null);
  a.equal(c.calculateIncreaseProgress(5, 2, 3), null);
  a.equal(c.calculateDecreaseProgress(2, 5, 3), null);
  a.equal(c.calculateIncreaseProgress(null, 5, 2), null);
  for (const p of [
    c.calculateIncreaseProgress(-1e308, 1e308, 1e307),
    c.calculateIncreaseProgress(0, 1, Infinity),
  ])
    a.ok(p === null || Number.isFinite(p));
});
test("4B H custom weights total exactly 100", () =>
  a.equal(
    c.weightInfo([kr({ weight: 40 }), kr({ id: "k2", weight: 60 })], "custom")
      .valid,
    true,
  ));
test("4B I underallocated weights do not normalize", () => {
  const ks = [kr({ weight: 40 }), kr({ id: "k2", weight: 30 })];
  a.equal(c.weightInfo(ks, "custom").label, "وزن تخصیص‌نیافته");
  a.equal(c.calculateObjectiveProgress(ks, "custom"), null);
});
test("4B J overallocated weights do not normalize", () => {
  const ks = [kr({ weight: 70 }), kr({ id: "k2", weight: 50 })];
  a.equal(c.weightInfo(ks, "custom").label, "وزن بیش از حد");
  a.equal(c.calculateObjectiveProgress(ks, "custom"), null);
});
test("4B K weighted contributions and equal weighting", () => {
  const ks = [
    kr({ weight: 40, currentValue: 20 }),
    kr({ id: "k2", weight: 60, currentValue: 15 }),
  ];
  a.equal(c.calculateObjectiveProgress(ks, "custom"), 70);
  a.equal(c.calculateObjectiveProgress(ks, "equal"), 75);
  a.equal(c.calculateWeightedContribution(50, 60), 30);
});
test("4B L no KR means unknown progress and health", () => {
  a.equal(c.calculateObjectiveProgress([]), null);
  a.equal(
    c.calculateObjectiveHealth([], "equal", today, () => true).health,
    "insufficient",
  );
});
test("4B M confidence independently affects risk", () => {
  a.equal(c.calculateKRStatus(kr({ confidence: 3 }), today).status, "atRisk");
  a.equal(c.calculateKRStatus(kr({ confidence: 2 }), today).status, "offTrack");
  a.equal(c.calculateKRStatus(kr({ confidence: null }), today).status, null);
});
test("4B N fifteen point pacing gap means risk", () => {
  a.equal(c.calculateExpectedProgress("2026-09-12", "2026-11-11", today), 50);
  a.equal(
    c.calculateKRStatus(kr({ currentValue: 13.5 }), today).status,
    "atRisk",
  );
});
test("4B O severe gap and overdue are off track", () => {
  a.equal(
    c.calculateKRStatus(kr({ currentValue: 11 }), today).status,
    "offTrack",
  );
  a.equal(c.calculateKRStatus(kr(), "2026-11-12").status, "offTrack");
});
test("4B P achieved takes precedence without closing objective lifecycle", () => {
  const s = store([kr({ currentValue: 20, confidence: 1 })]);
  a.equal(c.calculateKRStatus(s.keyResults[0], today).status, "achieved");
  reports.measurementReport(s, roles, today);
  a.equal(s.objectives[0].status, "active");
});
test("4B Q tiny 5 percent red KR does not make objective red", () => {
  const ks = [
    kr({ weight: 95, currentValue: 17, confidence: 9 }),
    kr({ id: "k2", weight: 5, currentValue: 10, confidence: 1 }),
  ];
  a.equal(
    c.calculateObjectiveHealth(ks, "custom", today, () => true).health,
    "atRisk",
  );
  ks[0].weight = 80;
  ks[1].weight = 20;
  a.equal(
    c.calculateObjectiveHealth(ks, "custom", today, () => true).health,
    "offTrack",
  );
});
test("4B R missing measurement and owner affect completeness not invented failure", () => {
  const k = kr({ currentValue: null, ownerRoleId: "" }),
    s = store([k]);
  a.equal(c.calculateKRProgress(k), null);
  a.ok(v.calculateKRCompleteness(k, s, roles).score < 100);
  a.equal(
    reports.objectiveMeasurement(s, s.objectives[0], roles, today).health
      .health,
    "insufficient",
  );
});
test("4B S only observed value changes update lastUpdateAt", () => {
  const s = store(),
    now = "2026-10-12T12:00:00Z";
  let n = mutations.saveKR(s, { ...s.keyResults[0], currentValue: 16 }, now);
  a.equal(n.keyResults[0].lastUpdateAt, now);
  n = mutations.saveKR(s, { ...s.keyResults[0], notes: "context" }, now);
  a.equal(n.keyResults[0].lastUpdateAt, s.keyResults[0].lastUpdateAt);
});
test("4B T refresh preserves values confidence weights and milestone timestamps", () => {
  const s = store([
    kr({
      type: "milestone",
      startValue: null,
      targetValue: null,
      currentValue: null,
      milestones: [milestone("m1", 100, true)],
    }),
  ]);
  const n = mutations.saveKR(s, s.keyResults[0], "2026-10-12T12:00:00Z");
  a.deepEqual(m.parseStrategy(JSON.stringify(n)), n);
  a.ok(n.keyResults[0].milestones[0].completedAt);
});
test("4B U legacy 4A schema is read losslessly and never gets automatic KRs", () => {
  const old = seedStrategy(roles);
  a.equal(old.keyResults, undefined);
  a.deepEqual(m.parseStrategy(JSON.stringify(old)), old);
  const n = mutations.saveKR(old, kr());
  for (const key of [
    "cycles",
    "contexts",
    "priorities",
    "choices",
    "objectives",
  ])
    a.deepEqual(n[key], old[key]);
});
test("4B future start and same-day period are finite", () => {
  a.equal(c.calculateExpectedProgress("2027-01-01", "2027-02-01", today), 0);
  a.equal(c.calculateExpectedProgress(today, today, today), 100);
  a.equal(c.calculateExpectedProgress("", "", today), null);
  a.equal(
    c.calculateKRStatus(
      kr({ currentValue: 10, startDate: "2027-01-01", deadline: "2027-02-01" }),
      today,
    ).status,
    "notStarted",
  );
});
test("4B weighted confidence falls back to equal with invalid weights", () => {
  const ks = [
    kr({ weight: 75, confidence: 8 }),
    kr({ id: "k2", weight: 25, confidence: 4 }),
  ];
  a.equal(c.calculateObjectiveConfidence(ks, "custom"), 7);
  ks[1].weight = 5;
  a.equal(c.calculateObjectiveConfidence(ks, "custom"), 6);
  ks[1].confidence = null;
  a.equal(c.calculateObjectiveConfidence(ks, "custom"), 8);
});
test("4B zero-weight unknown does not contaminate otherwise achieved objective", () => {
  const ks = [
    kr({ weight: 100, currentValue: 20 }),
    kr({ id: "k2", weight: 0, currentValue: null, confidence: null }),
  ];
  a.equal(c.calculateObjectiveProgress(ks, "custom"), 100);
  a.equal(
    c.calculateObjectiveHealth(
      ks,
      "custom",
      today,
      (k) => k.currentValue !== null,
    ).health,
    "achieved",
  );
});
test("4B custom missing and all-zero weights remain invalid", () => {
  a.equal(c.weightInfo([kr({ weight: null })], "custom").valid, false);
  a.equal(c.calculateObjectiveProgress([kr({ weight: 0 })], "custom"), null);
});
test("4B quality identifies activities and invalid target", () => {
  const k = kr({ title: "راه‌اندازی کمپین فروش", targetValue: 10 });
  const q = v.validateKR(k, store([k]), roles);
  a.equal(q.label, "ناقص");
  a.ok(q.warnings.some((w) => w.includes("فعالیت")));
});
test("4B missing confidence prevents healthy classification", () => {
  const s = store([kr({ confidence: null })]);
  a.equal(
    reports.objectiveMeasurement(s, s.objectives[0], roles, today).health
      .health,
    "insufficient",
  );
});
test("4B cancelled KR excluded, archived cycle prevents mutation", () => {
  const s = store([kr({ lifecycle: "cancelled" })]);
  a.equal(c.calculateObjectiveProgress(s.keyResults), null);
  s.cycles[0].status = "archived";
  a.throws(() => mutations.saveKR(s, kr()));
  a.throws(() => mutations.setKRWeightMode(s, "sample-o1", "custom"));
});
test("4B stale values and attention ordered by severity", () => {
  const s = store([
    kr({
      currentValue: 10,
      confidence: 2,
      lastUpdateAt: "2026-09-12T00:00:00Z",
    }),
  ]);
  const r = reports.measurementReport(s, roles, today);
  a.ok(r.findings.some((f) => f.id === "stale-k1"));
  a.equal(r.findings[0].severity, 100);
  a.equal(c.calculateKRStatus(s.keyResults[0], today).stale, true);
});
test("4B aggregate excludes unknown active objective instead of making it zero", () => {
  const s = store();
  s.objectives[1].status = "active";
  const r = reports.measurementReport(s, roles, today);
  a.equal(r.progress, 50);
  a.equal(r.progressCoverage, 50);
});
test("4B milestone completion updates measurement and reverses completedAt", () => {
  const s = store([
    kr({
      type: "milestone",
      startValue: null,
      targetValue: null,
      currentValue: null,
      milestones: [milestone("m1", 100, false)],
    }),
  ]);
  const n = mutations.saveKR(
    s,
    { ...s.keyResults[0], milestones: [milestone("m1", 100, true)] },
    "2026-10-12T12:00:00Z",
  );
  a.equal(n.keyResults[0].lastUpdateAt, "2026-10-12T12:00:00Z");
  a.equal(c.calculateKRProgress(n.keyResults[0]), 100);
  const u = mutations.saveKR(n, {
    ...n.keyResults[0],
    milestones: [milestone("m1", 100, false)],
  });
  a.equal(u.keyResults[0].milestones[0].completedAt, undefined);
});
test("4B schema rejects corrupt KR IDs, references, numbers, dates, and duplicate codes", () => {
  for (const mutate of [
    (s) => (s.keyResults[0].currentValue = NaN),
    (s) => (s.keyResults[0].objectiveId = "missing"),
    (s) => (s.keyResults[0].confidence = 11),
    (s) => (s.keyResults[0].weight = -1),
    (s) => (s.keyResults[0].deadline = "2026-02-30"),
    (s) => s.keyResults.push({ ...s.keyResults[0], id: "k2" }),
    (s) => (s.keyResults[0].type = "unknown"),
  ]) {
    const s = store();
    mutate(s);
    a.throws(() => m.validateStrategy(s));
  }
});
test("4B fresh sample KRs align with existing sample, old sample stays untouched", () => {
  const old = seedStrategy(roles),
    s = withSampleKRs(old);
  a.equal(s.keyResults.length, 6);
  a.ok(m.validateStrategy(s));
  a.equal(old.keyResults, undefined);
  a.equal(
    c.weightInfo(
      s.keyResults.filter((k) => k.objectiveId === "sample-o1"),
      "custom",
    ).total,
    100,
  );
});
test("4B units do not alter calculations", () => {
  a.equal(
    c.calculateKRProgress(kr({ unit: "میلیارد تومان" })),
    c.calculateKRProgress(kr({ unit: "سفارشی" })),
  );
});
test("4B notes support context without overwriting derived status", () => {
  const s = store(),
    n = mutations.saveKR(s, {
      ...s.keyResults[0],
      notes: "رشد در پایان دوره متمرکز است.",
    });
  a.equal(
    c.calculateKRStatus(n.keyResults[0], today).status,
    c.calculateKRStatus(s.keyResults[0], today).status,
  );
  a.ok(!("progress" in n.keyResults[0]));
  a.ok(!("status" in n.keyResults[0]));
});

test("4B stale boundary uses Tehran calendar days", () => {
  const k = kr({ lastUpdateAt: "2026-10-04T22:00:00Z" });
  a.equal(c.calculateKRStatus(k, "2026-10-12").stale, false);
  a.equal(c.calculateKRStatus(k, "2026-10-13").stale, true);
});
test("4B editing uncompleted milestone structure does not pretend a value update", () => {
  const s = store([
    kr({
      type: "milestone",
      startValue: null,
      targetValue: null,
      currentValue: null,
      milestones: [milestone("m1", 100, false)],
    }),
  ]);
  const n = mutations.saveKR(
    s,
    {
      ...s.keyResults[0],
      milestones: [milestone("m1", 50, false), milestone("m2", 50, false)],
    },
    "2026-10-12T12:00:00Z",
  );
  a.equal(n.keyResults[0].lastUpdateAt, s.keyResults[0].lastUpdateAt);
});
