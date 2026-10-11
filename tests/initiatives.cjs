const { test } = require("node:test");
const a = require("node:assert/strict");
const m = require("../.test-build/strategy/model.js");
const { seedStrategy } = require("../.test-build/strategy/seed.js");
const { withSampleKRs } = require("../.test-build/strategy/kr/seed.js");
const {
  withSampleInitiatives,
} = require("../.test-build/strategy/initiatives/seed.js");
const {
  saveInitiative,
} = require("../.test-build/strategy/initiatives/mutations.js");
const v = require("../.test-build/strategy/initiatives/validation.js");
const r = require("../.test-build/strategy/initiatives/report.js");
const {
  calculateKRProgress,
} = require("../.test-build/strategy/kr/calculations.js");
const roles = [{ id: "r1", title: "مدیر رشد", personName: "آزمایش" }],
  today = "2026-10-12",
  now = "2026-10-12T10:00:00Z";
const base = () => withSampleKRs(seedStrategy(roles));
const item = (over = {}) => ({
  ...withSampleInitiatives(base(), roles).initiatives[0],
  id: "i1",
  code: "I1",
  status: "proposed",
  progress: 0,
  ownerRoleId: "r1",
  startedAt: undefined,
  completedAt: undefined,
  krProgressAtStart: undefined,
  krValueAtStart: undefined,
  baselineCapturedAt: undefined,
  baselineKeyResultId: undefined,
  ...over,
});
const save = (s, i) => saveInitiative(s, i, roles, now);
const findings = (i, s = base()) =>
  r.initiativeNeedsAttention([i], s, roles, today);
test("A derive objective from primary KR and preserve cycle alignment", () => {
  const s = save(base(), item({ objectiveId: "" }));
  a.equal(s.initiatives[0].objectiveId, "sample-o1");
  a.deepEqual(v.validateInitiative(s.initiatives[0], s), []);
});
test("B inconsistent objective cannot execute", () =>
  a.throws(() =>
    save(base(), item({ status: "inProgress", objectiveId: "sample-o2" })),
  ));
test("C unlinked proposal allowed but planned or execution prohibited", () => {
  a.equal(
    save(base(), item({ keyResultId: "", objectiveId: "" })).initiatives[0]
      .status,
    "proposed",
  );
  for (const status of ["planned", "inProgress", "blocked", "completed"])
    a.throws(() =>
      save(base(), item({ keyResultId: "", objectiveId: "", status })),
    );
});
test("D missing hypothesis blocks start and produces quality finding", () => {
  a.throws(() => save(base(), item({ status: "inProgress", hypothesis: " " })));
  a.ok(
    v.initiativeQuality(item({ hypothesis: "" }), base(), roles).missing.length,
  );
});
test("E blocked needs nonblank reason; unblocking preserves last blocker", () => {
  a.throws(() => save(base(), item({ status: "blocked", blockedReason: " " })));
  let s = save(
    base(),
    item({ status: "blocked", blockedReason: "بودجه تایید نشده" }),
  );
  s = save(s, { ...s.initiatives[0], status: "inProgress" });
  a.equal(s.initiatives[0].blockedReason, "بودجه تایید نشده");
});
test("F overdue excludes proposals and terminal records; due soon inclusive", () => {
  for (const status of ["planned", "inProgress", "blocked"])
    a.equal(
      r.isInitiativeOverdue(item({ status, dueDate: "2026-10-11" }), today),
      true,
    );
  for (const status of ["proposed", "completed", "cancelled"])
    a.equal(
      r.isInitiativeOverdue(item({ status, dueDate: "2026-10-11" }), today),
      false,
    );
  a.equal(
    r.initiativeDeadlineRisk(
      item({ status: "planned", dueDate: "2026-10-19" }),
      today,
    ).dueSoon,
    true,
  );
  a.equal(
    r.initiativeDeadlineRisk(item({ status: "planned", dueDate: today }), today)
      .overdue,
    false,
  );
});
test("G high priority and low execution triggers attention", () =>
  a.ok(
    findings(
      item({ status: "inProgress", progress: 10, priority: "high" }),
    ).some((f) => f.id.startsWith("priority-progress")),
  ));
test("H completion forces 100 but permits unevaluated actual impact", () => {
  const s = save(base(), item({ status: "completed", progress: 20 })),
    i = s.initiatives[0];
  a.equal(i.progress, 100);
  a.equal(i.effectiveness, "notEvaluated");
  a.ok(i.completedAt);
  a.ok(findings(i, s).some((f) => f.id.startsWith("evaluation")));
});
test("I initiative execution never changes KR or objective records", () => {
  const b = base(),
    s = save(b, item({ status: "completed" }));
  a.deepEqual(s.keyResults, b.keyResults);
  a.deepEqual(s.objectives, b.objectives);
});
test("J changed KR does not alter initiative execution", () => {
  const s = save(base(), item({ status: "inProgress", progress: 40 }));
  const changed = {
    ...s,
    keyResults: s.keyResults.map((k) => ({
      ...k,
      currentValue: k.targetValue,
    })),
  };
  a.equal(changed.initiatives[0].progress, 40);
});
test("K execution result gap is descriptive and null with absent measures", () => {
  a.deepEqual(r.executionResultGap(82, 35).gap, 47);
  a.equal(r.executionResultGap(82, 35).needsReview, true);
  a.equal(r.executionResultGap(82, null).gap, null);
  const s = base();
  s.keyResults = s.keyResults.map((k) => ({
    ...k,
    currentValue: k.startValue,
  }));
  a.ok(
    r
      .initiativeKRSignals(
        item({ status: "inProgress", progress: 80 }),
        s,
        today,
      )
      .some((f) => f.id.startsWith("gap")),
  );
});
test("L role overload only above three concurrent initiatives", () => {
  const items = Array.from({ length: 4 }, (_, n) =>
    item({ id: "i" + n, status: "inProgress" }),
  );
  a.equal(r.ownerInitiativeLoad(items)[0].overloaded, true);
  a.equal(r.ownerInitiativeLoad(items.slice(1))[0].overloaded, false);
});
test("M capacity warns at cycle/objective/owner and never blocks saving", () => {
  let s = base();
  for (let n = 0; n < 6; n++)
    s = save(s, item({ id: "i" + n, code: "I" + n, status: "inProgress" }));
  const f = r.initiativeCapacityWarnings(s.initiatives, roles);
  a.ok(f.some((x) => x.id === "capacity-cycle"));
  a.ok(f.some((x) => x.id.startsWith("capacity-objective")));
  a.ok(f.some((x) => x.id.startsWith("capacity-owner")));
});
test("N objective execution mean excludes proposals planned cancelled", () => {
  const s = {
    ...base(),
    initiatives: [
      item({ status: "inProgress", progress: 80 }),
      item({ status: "blocked", progress: 40 }),
      item({ status: "completed", progress: 100 }),
      item({ status: "planned" }),
      item({ status: "cancelled", progress: 90 }),
    ],
  };
  a.equal(
    r.objectiveExecution(s, "sample-o1", today).summary.execution,
    220 / 3,
  );
});
test("O cancelled excluded from WIP, effectiveness and execution", () => {
  const s = r.portfolioSummary(
    [item({ status: "cancelled", progress: 90, effectiveness: "effective" })],
    today,
  );
  a.equal(s.active, 0);
  a.equal(s.effective, 0);
  a.equal(s.execution, null);
});
test("P persistence round trip preserves execution impact blocker and hypothesis", () => {
  const s = save(
    base(),
    item({
      status: "blocked",
      progress: 40,
      blockedReason: "بودجه",
      actualImpact: "۱۸ لید",
      effectiveness: "promising",
    }),
  );
  a.deepEqual(
    m.parseStrategy(JSON.stringify(s)),
    JSON.parse(JSON.stringify(s)),
  );
});
test("Q old 4A/4B records stay unchanged and no sample injected on parse", () => {
  for (const s of [seedStrategy(roles), base()]) {
    a.deepEqual(m.parseStrategy(JSON.stringify(s)), s);
    a.equal(m.parseStrategy(JSON.stringify(s)).initiatives, undefined);
  }
  const b = base(),
    s = save(b, item());
  const { initiatives, ...rest } = s;
  a.deepEqual(rest, b);
});
test("R inconsistent stored links rejected including cross-cycle and absent KR", () => {
  for (const over of [
    { objectiveId: "sample-o2" },
    { cycleId: "missing" },
    { keyResultId: "missing" },
  ])
    a.throws(() =>
      m.validateStrategy({ ...base(), initiatives: [item(over)] }),
    );
});
test("baseline captured once, unchanged KR completion flagged, relinking prohibited", () => {
  let s = save(base(), item({ status: "inProgress", progress: 40 }));
  const first = s.initiatives[0],
    kr = s.keyResults.find((k) => k.id === first.keyResultId);
  a.equal(first.krProgressAtStart, calculateKRProgress(kr));
  s = save(s, { ...first, status: "completed" });
  a.equal(s.initiatives[0].baselineCapturedAt, first.baselineCapturedAt);
  a.ok(
    r
      .initiativeKRSignals(s.initiatives[0], s, today)
      .some((f) => f.id.startsWith("unchanged")),
  );
  a.throws(() => save(s, { ...s.initiatives[0], keyResultId: "sample-kr2" }));
});
test("no invented KR history when baseline unavailable", () => {
  a.equal(
    r
      .initiativeKRSignals(
        item({ status: "completed", progress: 100 }),
        base(),
        today,
      )
      .some((f) => f.id.startsWith("unchanged")),
    false,
  );
});
test("achieved KR with ongoing initiative suggests management review", () => {
  const s = base();
  s.keyResults = s.keyResults.map((k) => ({
    ...k,
    currentValue: k.targetValue,
  }));
  a.ok(
    r
      .initiativeKRSignals(item({ status: "inProgress" }), s, today)
      .some((f) => f.id.startsWith("achieved")),
  );
});
test("invalid progress, dates, duplicate code, nonfinite values rejected", () => {
  for (const over of [
    { progress: 101, status: "inProgress" },
    { progress: NaN },
    { dueDate: "2026-02-30" },
    { expectedImpactValue: Infinity },
    { krProgressAtStart: 101 },
  ])
    a.throws(() =>
      m.validateStrategy({ ...base(), initiatives: [item(over)] }),
    );
  a.throws(() =>
    m.validateStrategy({
      ...base(),
      initiatives: [item(), item({ id: "i2" })],
    }),
  );
});
test("closed cycles reject initiative writes", () => {
  const s = base();
  s.cycles = s.cycles.map((c) => ({ ...c, status: "archived" }));
  a.throws(() => save(s, item()));
});
test("removed role remains readable but requires reassignment to continue", () => {
  const s = save(base(), item({ status: "inProgress" }));
  a.doesNotThrow(() => m.parseStrategy(JSON.stringify(s)));
  a.ok(v.initiativeQuality(s.initiatives[0], s, []).missing.length);
  a.throws(() => saveInitiative(s, s.initiatives[0], [], now));
});
test("manual effectiveness remains independent of completion and no person duplication", () => {
  const s = save(
    base(),
    item({ status: "inProgress", progress: 10, effectiveness: "effective" }),
  );
  a.equal(s.initiatives[0].effectiveness, "effective");
  a.equal(s.initiatives[0].personName, undefined);
});
test("sample initiatives valid and isolated from foundation input", () => {
  const s = base(),
    before = JSON.stringify(s),
    seed = withSampleInitiatives(s, roles);
  a.doesNotThrow(() => m.validateStrategy(seed));
  a.equal(seed.initiatives.length, 3);
  a.equal(JSON.stringify(s), before);
});
