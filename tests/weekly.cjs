const { test } = require("node:test");
const a = require("node:assert/strict");
const model = require("../.test-build/strategy/model.js"),
  c = require("../.test-build/strategy/weekly/calculations.js"),
  m = require("../.test-build/strategy/weekly/mutations.js"),
  r = require("../.test-build/strategy/weekly/report.js");
const { seedStrategy } = require("../.test-build/strategy/seed.js"),
  { withSampleKRs } = require("../.test-build/strategy/kr/seed.js"),
  {
    withSampleInitiatives,
  } = require("../.test-build/strategy/initiatives/seed.js"),
  { saveKR } = require("../.test-build/strategy/kr/mutations.js");
const roles = [{ id: "r1", title: "مدیر رشد" }],
  today = "2026-09-22",
  now = "2026-09-22T10:00:00Z",
  cycleId = "sample-1405";
const base = () => {
  const s = withSampleInitiatives(withSampleKRs(seedStrategy(roles)), roles);
  s.objectives = s.objectives.map((o) => ({ ...o, status: "active" }));
  return s;
};
const start = (s = base(), week = 1) =>
  m.createWeeklyReview(s, cycleId, week, "review" + week, today, now);
const input = (over = {}) => ({
  keyResultId: "sample-kr3",
  currentValue: 55,
  confidence: 8,
  completedMilestoneIds: [],
  win: "۱۸ لید واجد شرایط",
  blocker: "",
  nextAction: "پیگیری لیدها",
  comment: "",
  ...over,
});
const check = (s = start(), over = {}, review = "review1") =>
  m.saveCheckIn(
    s,
    review,
    input(over),
    "check-" + review + (over.keyResultId ?? "sample-kr3"),
    today,
    now,
  );
const complete = (s, id = "review1") =>
  m.completeWeeklyReview(s, id, roles, true, today, now);
test("three-week stagnant signal requires consecutive observed weeks", () => {
  let s = start();
  s.initiatives[0].progress = 85;
  for (let week = 1; week <= 3; week++) {
    if (week > 1) s = start(s, week);
    s = check(s, { currentValue: 35 }, "review" + week);
    if (week < 3) s = complete(s, "review" + week);
  }
  const review = s.weeklyReviews.find((x) => x.weekNumber === 3);
  a.ok(
    r
      .weeklyReviewSignals(s, review, today)
      .signals.some((x) => x.includes("3 هفته پیاپی")),
  );
  const gap = {
    ...s,
    krCheckIns: s.krCheckIns.filter((x) => x.weekNumber !== 2),
  };
  a.equal(
    r
      .weeklyReviewSignals(gap, review, today)
      .signals.some((x) => x.includes("3 هفته پیاپی")),
    false,
  );
});
test("check-in identifier collision cannot overwrite a different KR", () => {
  const s = check();
  a.throws(() =>
    m.saveCheckIn(
      s,
      "review1",
      input({ keyResultId: "sample-kr2" }),
      s.krCheckIns[0].id,
      today,
      now,
    ),
  );
  a.equal(s.krCheckIns.length, 1);
});
test("A first check-in takes live previous value and snapshots current", () => {
  const s = check();
  a.equal(s.krCheckIns[0].previousValue, 35);
  a.equal(s.krCheckIns[0].currentValue, 55);
  a.ok(Math.abs(s.krCheckIns[0].progress - 55) < 1e-9);
});
test("B second week uses most recent earlier check-in, not ad-hoc current", () => {
  let s = start(complete(check()), 2);
  s = saveKR(
    s,
    { ...s.keyResults.find((k) => k.id === "sample-kr3"), currentValue: 60 },
    now,
  );
  s = check(s, { currentValue: 72 }, "review2");
  a.equal(s.krCheckIns[1].previousValue, 55);
  a.equal(s.krCheckIns[1].delta, 17);
});
test("C numeric increase direction includes regression", () => {
  a.equal(c.calculateMovementSignal("increase", 5, 9, 50, 90), "improved");
  a.equal(c.calculateMovementSignal("increase", 9, 5, 90, 50), "regressed");
  a.equal(c.calculateMovementSignal("increase", 5, 5, 50, 50), "stable");
});
test("D negative delta is improvement for decrease", () => {
  a.equal(c.calculateCheckInDelta(6, 10), -4);
  a.equal(c.calculateMovementSignal("decrease", 10, 6, 10, 50), "improved");
  a.equal(c.calculateMovementSignal("decrease", 6, 10, 50, 10), "regressed");
});
test("E confidence delta handles drops and absent baseline", () => {
  a.equal(c.calculateConfidenceDelta(5, 8), -3);
  a.equal(c.calculateConfidenceDelta(5, null), null);
});
test("F later live KR update leaves history byte-stable", () => {
  const s = check(),
    old = JSON.stringify(s.krCheckIns);
  const next = saveKR(
    s,
    {
      ...s.keyResults.find((k) => k.id === "sample-kr3"),
      currentValue: 90,
      confidence: 2,
    },
    now,
  );
  a.equal(JSON.stringify(next.krCheckIns), old);
});
test("G same-week edits reuse ID and original baseline", () => {
  let s = check();
  s = check(s, { currentValue: 60 });
  a.equal(s.krCheckIns.length, 1);
  a.equal(s.krCheckIns[0].id, "check-review1sample-kr3");
  a.equal(s.krCheckIns[0].previousValue, 35);
  a.equal(s.krCheckIns[0].delta, 25);
  a.throws(() => m.createWeeklyReview(s, cycleId, 1, "duplicate", today, now));
});
test("H check-in atomically updates live value confidence and timestamp even unchanged", () => {
  const s = check(undefined, { currentValue: 35, confidence: 4 }),
    k = s.keyResults.find((k) => k.id === "sample-kr3");
  a.equal(k.currentValue, 35);
  a.equal(k.confidence, 4);
  a.equal(k.lastUpdateAt, now);
  a.equal(s.krCheckIns.length, 1);
});
test("I completion counts only this week active KRs", () => {
  const s = check(),
    x = c.weeklyCheckInCompletion(
      c.activeWeeklyKRs(s, cycleId),
      s.krCheckIns,
      1,
    );
  a.equal(x.total, 6);
  a.equal(x.checkedIn, 1);
  a.equal(x.percent, 100 / 6);
  a.equal(
    c.weeklyCheckInCompletion(c.activeWeeklyKRs(s, cycleId), s.krCheckIns, 2)
      .checkedIn,
    0,
  );
});
test("J stale list identifies unreviewed values despite recent ad-hoc update", () => {
  const s = start(),
    d = r.weeklyReviewSignals(s, s.weeklyReviews[0], today);
  a.equal(d.completion.stale.length, 6);
  a.equal(d.ins.length, 0);
});
test("K risk and off track counts derive from review evidence", () => {
  let s = check(undefined, { confidence: 2, currentValue: 10 });
  s = check(s, { keyResultId: "sample-kr2", currentValue: 2, confidence: 3 });
  const p = r.createStrategySnapshot(s, s.weeklyReviews[0], roles, today, now);
  a.ok(p.krStatusCounts.offTrack >= 1);
  a.ok(p.krStatusCounts.atRisk >= 1);
});
test("L blocked initiative and text join review blockers", () => {
  const s = start();
  s.initiatives[0] = {
    ...s.initiatives[0],
    status: "blocked",
    blockedReason: "بودجه",
  };
  const d = r.aggregateBlockers(s, s.weeklyReviews[0]);
  a.ok(d.some((b) => b.source === "initiative" && b.text === "بودجه"));
});
test("M completed snapshots immutable after live changes and locked writes", () => {
  let s = complete(check()),
    before = JSON.stringify(s.strategyWeeklySnapshots);
  s = saveKR(
    s,
    { ...s.keyResults.find((k) => k.id === "sample-kr3"), currentValue: 99 },
    now,
  );
  a.equal(JSON.stringify(s.strategyWeeklySnapshots), before);
  a.throws(() => check(s));
  a.throws(() => m.saveReviewNotes(s, s.weeklyReviews[0], today, now));
});
test("N comparison selects explicit historical fields without fake prior", () => {
  let s = complete(check()),
    first = s.strategyWeeklySnapshots[0];
  s = complete(
    check(start(s, 2), { currentValue: 72, confidence: 6 }, "review2"),
    "review2",
  );
  const second = s.strategyWeeklySnapshots.find((x) => x.weekNumber === 2);
  a.equal(
    c.weeklyComparison(second, first)[1].delta,
    second.averageConfidence - first.averageConfidence,
  );
  a.ok(c.weeklyComparison(first).every((x) => x.delta === null));
});
test("O objective snapshots reflect weighted KR evidence and coverage", () => {
  const s = complete(check()),
    o = s.objectiveWeeklySnapshots.find((o) => o.objectiveId === "sample-o1");
  a.ok(Math.abs(o.progress - 42.15) < 0.00001);
  a.equal(o.checkedIn, 1);
  a.equal(o.total, 3);
});
test("P strategy snapshot persists complete context", () => {
  const s = complete(check()),
    restored = model.parseStrategy(JSON.stringify(s));
  a.deepEqual(
    restored.strategyWeeklySnapshots,
    JSON.parse(JSON.stringify(s.strategyWeeklySnapshots)),
  );
  a.equal(restored.strategyWeeklySnapshots[0].initiativeContext.length, 3);
});
test("Q review quality follows 40/20/15/10/15 formula", () => {
  const review = start().weeklyReviews[0],
    q = c.weeklyReviewQuality(
      50,
      ["k"],
      {
        ...review,
        reviewedRiskIds: [],
        blockersReviewed: false,
        nextWeekFocus: ["پیگیری"],
      },
      1,
      1,
      0,
    );
  a.equal(q.score, 45);
  a.equal(
    c.weeklyReviewQuality(100, [], { ...review, nextWeekFocus: ["x"] }, 0, 0, 1)
      .score,
    100,
  );
});
test("R reopen retains snapshot until explicit recompletion and advances revision", () => {
  let s = complete(check()),
    old = JSON.stringify(s.strategyWeeklySnapshots);
  s = m.reopenWeeklyReview(s, "review1", today, now);
  a.equal(JSON.stringify(s.strategyWeeklySnapshots), old);
  s = check(s, { currentValue: 70 });
  a.equal(JSON.stringify(s.strategyWeeklySnapshots), old);
  s = complete(s);
  a.equal(s.weeklyReviews[0].revision, 2);
  a.equal(s.strategyWeeklySnapshots.length, 1);
  a.notEqual(JSON.stringify(s.strategyWeeklySnapshots), old);
});
test("S inclusive week boundaries partial last week before and after", () => {
  const cycle = { startDate: "2026-01-01", endDate: "2026-01-15" };
  a.equal(c.getCycleWeek(cycle, "2025-12-31").weekNumber, null);
  a.equal(c.getCycleWeek(cycle, "2026-01-07").weekNumber, 1);
  a.equal(c.getCycleWeek(cycle, "2026-01-08").weekNumber, 2);
  a.equal(c.getCycleWeek(cycle, "2026-01-15").weekNumber, 3);
  a.equal(c.getCycleWeek(cycle, "2026-01-16").phase, "after");
  a.deepEqual(c.weekPeriod(cycle, 3), {
    weekNumber: 3,
    periodStart: "2026-01-15",
    periodEnd: "2026-01-15",
  });
  a.throws(() => c.weekPeriod(cycle, 0));
});
test("T old builds round trip unchanged without fabricated history", () => {
  for (const s of [
    seedStrategy(roles),
    withSampleKRs(seedStrategy(roles)),
    base(),
  ]) {
    a.deepEqual(
      model.parseStrategy(JSON.stringify(s)),
      JSON.parse(JSON.stringify(s)),
    );
    a.equal(s.krCheckIns, undefined);
  }
  const b = base(),
    s = start(b);
  for (const key of ["cycles", "objectives", "keyResults", "initiatives"])
    a.deepEqual(s[key], b[key]);
});
test("U all weekly collections survive reload", () => {
  let s = check();
  s = m.saveStrategyDecision(
    s,
    {
      id: "d1",
      reviewId: "review1",
      title: "ادامه انتشار",
      description: "برای دو هفته",
      ownerRoleId: "r1",
      relatedObjectiveId: "sample-o1",
      relatedKRId: "sample-kr3",
      relatedInitiativeId: "sample-i1",
      createdAt: now,
    },
    today,
  );
  s = complete(s);
  a.deepEqual(
    model.parseStrategy(JSON.stringify(s)),
    JSON.parse(JSON.stringify(s)),
  );
});
test("binary and milestone check-ins snapshot progress movement", () => {
  for (const type of ["binary", "milestone"]) {
    let s = base();
    s.keyResults = s.keyResults.map((k) =>
      k.id !== "sample-kr3"
        ? k
        : {
            ...k,
            type,
            startValue: type === "binary" ? 0 : null,
            targetValue: type === "binary" ? 1 : null,
            currentValue: type === "binary" ? 0 : null,
            milestones:
              type === "milestone"
                ? [
                    {
                      id: "m1",
                      keyResultId: k.id,
                      title: "پذیرش",
                      weight: 100,
                      completed: false,
                    },
                  ]
                : [],
          },
    );
    s = check(start(s), {
      currentValue: type === "binary" ? 1 : null,
      completedMilestoneIds: ["m1"],
    });
    a.equal(s.krCheckIns[0].progress, 100);
    a.equal(s.krCheckIns[0].movement, "improved");
  }
});
test("risk or blocker requires next action without partial KR update", () => {
  const s = start(),
    before = JSON.stringify(s);
  a.throws(() => check(s, { confidence: 1, nextAction: "" }));
  a.throws(() => check(s, { blocker: "مانع", nextAction: "" }));
  a.equal(JSON.stringify(s), before);
});
test("incomplete review requires explicit acknowledgement", () => {
  const s = start();
  a.throws(() =>
    m.completeWeeklyReview(s, "review1", roles, false, today, now),
  );
  a.equal(complete(s).weeklyReviews[0].incompleteAcknowledged, true);
});
test("future weeks, older reopening and multiple drafts blocked", () => {
  a.throws(() => start(base(), 99));
  a.throws(() => start(base(), 6));
  let s = start();
  a.throws(() => start(s, 2));
  s = start(complete(s), 2);
  a.throws(() => m.reopenWeeklyReview(s, "review1", today, now));
});
test("snapshot uses this weeks evidence after an ad-hoc live edit", () => {
  let s = check();
  s = saveKR(
    s,
    { ...s.keyResults.find((k) => k.id === "sample-kr3"), currentValue: 90 },
    now,
  );
  s = complete(s);
  a.equal(
    s.strategyWeeklySnapshots[0].krContext.find((k) => k.id === "sample-kr3")
      .currentValue,
    55,
  );
});
test("corrupt duplicates, confidence and snapshot shape are rejected", () => {
  const s = complete(check());
  for (const mutate of [
    (x) => x.krCheckIns.push({ ...x.krCheckIns[0], id: "dup" }),
    (x) => (x.krCheckIns[0].confidence = 20),
    (x) => (x.strategyWeeklySnapshots[0].krContext[0].milestones = null),
    (x) => (x.weeklyReviews[0].weekNumber = 0),
    (x) => (x.strategyWeeklySnapshots = []),
  ]) {
    const copy = structuredClone(s);
    mutate(copy);
    a.throws(() => model.validateStrategy(copy));
  }
});
test("momentum does not fabricate trend or hide inadequate coverage", () => {
  const s = complete(check()).strategyWeeklySnapshots[0];
  a.equal(c.weeklyMomentum(s).label, "داده کافی نیست");
  a.equal(c.weeklyMomentum(s, s).label, "داده کافی نیست");
});
test("duplicate blocker for same entity is collapsed; independent entities retained", () => {
  const s = start();
  s.weeklyReviews[0].blockers = ["مانع بودجه", "مانع بودجه"];
  a.equal(
    r
      .aggregateBlockers(s, s.weeklyReviews[0])
      .filter((b) => b.source === "review").length,
    1,
  );
});
test("decisions reject cross-objective links and do not execute changes", () => {
  const s = start(),
    before = JSON.stringify(s.initiatives);
  const d = {
    id: "d",
    reviewId: "review1",
    title: "تصمیم",
    description: "",
    ownerRoleId: "",
    relatedObjectiveId: "sample-o2",
    relatedKRId: "sample-kr3",
    relatedInitiativeId: "",
    createdAt: now,
  };
  a.throws(() => m.saveStrategyDecision(s, d, today));
  m.saveStrategyDecision(s, { ...d, relatedObjectiveId: "sample-o1" }, today);
  a.equal(JSON.stringify(s.initiatives), before);
});
