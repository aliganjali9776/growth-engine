const { test } = require("node:test"),
  a = require("node:assert/strict");
const d = require("../.test-build/strategy/dashboard/selectors.js");
const {
  objectiveMeasurement,
} = require("../.test-build/strategy/kr/report.js");
const w = require("../.test-build/strategy/weekly/mutations.js");
const m = require("../.test-build/strategy/adapt/mutations.js");
const roles = [{ id: "r1", title: "مدیر رشد" }],
  today = "2026-09-23",
  now = today + "T10:00:00Z",
  cid = "sample-1405";
function base() {
  const s =
    require("../.test-build/strategy/initiatives/seed.js").withSampleInitiatives(
      require("../.test-build/strategy/kr/seed.js").withSampleKRs(
        require("../.test-build/strategy/seed.js").seedStrategy(roles),
      ),
      roles,
    );
  s.objectives = s.objectives.map((o) => ({ ...o, status: "active" }));
  return s;
}
const dash = (s = base(), filters = {}) =>
  d.getStrategyDashboard(s, roles, today, filters);
function history() {
  let s = base();
  for (let week = 1; week <= 3; week++) {
    s = w.createWeeklyReview(s, cid, week, "w" + week, today, now);
    s = w.saveCheckIn(
      s,
      "w" + week,
      {
        keyResultId: "sample-kr3",
        currentValue: 35,
        confidence: 9 - week,
        completedMilestoneIds: [],
        win: "",
        blocker: "کمبود ظرفیت",
        nextAction: "رفع مانع",
        comment: "",
      },
      "c" + week,
      today,
      now,
    );
    s = w.completeWeeklyReview(s, "w" + week, roles, true, today, now);
  }
  return s;
}
test("4F A progress uses canonical weighted objective results", () => {
  const s = base(),
    x = dash(s),
    values = s.objectives
      .map((o) => objectiveMeasurement(s, o, roles, today).progress)
      .filter((v) => v !== null);
  a.equal(x.progress, values.reduce((n, v) => n + v, 0) / values.length);
});
test("4F B health explains weights, availability, contributions and risk caps", () => {
  const x = dash();
  a.equal(
    x.health.components.reduce((n, c) => n + c.weight, 0),
    100,
  );
  a.equal(x.health.components[0].weight, 0);
  a.equal(
    x.health.coverage,
    x.health.components
      .filter((c) => c.score !== null)
      .reduce((n, c) => n + c.weight, 0),
  );
  if (x.health.score !== null) {
    a.ok(x.health.score >= 0 && x.health.score <= 100);
    a.equal(
      x.health.raw,
      Math.round(
        x.health.components.reduce((n, c) => n + (c.contribution ?? 0), 0),
      ),
    );
  }
  for (const c of x.health.components) a.ok(c.reason && c.availability);
});
test("4F C missing confidence stays null and is not a zero score", () => {
  const s = base();
  s.keyResults.forEach((k) => (k.confidence = null));
  const x = dash(s);
  a.equal(x.confidence, null);
  a.equal(x.health.components.find((c) => c.id === "confidence").score, null);
  a.equal(
    x.distribution.reduce((n, b) => n + b.count, 0),
    0,
  );
});
test("4F D no history has no synthetic trend", () => {
  const x = dash();
  a.equal(x.trend.length, 0);
  a.match(x.momentum.label, /کافی/);
});
test("4F E high weight off-track KR vetoes positive health", () => {
  const s = base(),
    k = s.keyResults.find((k) => k.type === "increase");
  k.confidence = 1;
  k.currentValue = k.startValue;
  const x = dash(s);
  a.ok(
    x.risks.some((r) => r.keyResultId === k.id && r.severity === "critical"),
  );
  a.ok(x.health.score === null || x.health.score <= 39);
});
test("4F F confidence decline comes from completed consecutive reviews", () => {
  const x = dash(history());
  a.equal(x.confidenceTrend.declines[0].drop, 2);
  a.ok(x.risks.some((r) => r.type === "confidence"));
});
test("4F G recurring blocker ranks above comparable single blocker and resolved is removed", () => {
  const s = history(),
    x = dash(s),
    repeat = x.risks.find((r) => r.type === "recurring");
  a.ok(repeat);
  const single = dash(base()).risks.find((r) => r.type === "blocker");
  if (single) a.ok(repeat.rank > single.rank);
  s.krCheckIns.find((c) => c.weekNumber === 3).blocker = "";
  a.equal(
    dash(s).blockers.filter((b) => b.entityId === "sample-kr3").length,
    0,
  );
});
test("4F H high execution with low result is surfaced without causality", () => {
  const s = base();
  for (const k of s.keyResults) {
    k.type = "increase";
    k.startValue = 0;
    k.targetValue = 100;
    k.currentValue = 10;
  }
  for (const i of s.initiatives) {
    i.status = "completed";
    i.progress = 100;
  }
  const x = dash(s);
  a.ok(x.risks.some((r) => r.id.startsWith("gap-")));
  a.ok(x.execution.some((e) => e.gap >= 70));
});
test("4F I ineffective and unevaluated initiatives are distinct", () => {
  const s = base();
  s.initiatives[0].status = "completed";
  s.initiatives[0].effectiveness = "ineffective";
  const x = dash(s);
  a.ok(x.risks.some((r) => r.id === "ineffective-" + s.initiatives[0].id));
  s.initiatives[0].effectiveness = "notEvaluated";
  const y = dash(s);
  a.ok(!y.risks.some((r) => r.id === "ineffective-" + s.initiatives[0].id));
  a.ok(y.risks.some((r) => r.id === "unevaluated-" + s.initiatives[0].id));
});
test("4F J alignment exposes missing relationships and owners", () => {
  const s = base();
  s.initiatives[0].keyResultId = "missing";
  s.objectives[0].ownerRoleId = "missing";
  const x = dash(s);
  a.ok(x.alignment.initiativeGaps.length);
  a.ok(x.alignment.ownerGaps.length);
  a.ok(x.risks.some((r) => r.type === "alignment"));
});
test("4F K completeness changes with missing data independently of progress", () => {
  const s = base(),
    before = dash(s);
  s.keyResults.forEach((k) => (k.confidence = null));
  const after = dash(s);
  a.equal(after.progress, before.progress);
  a.notEqual(after.completeness.score, before.completeness.score);
  a.ok(after.completeness.parts.some((p) => p.label === "پوشش مالکیت"));
});
test("4F L freshness distinguishes never updated, stale and this week", () => {
  const s = base();
  s.keyResults.forEach((k) => (k.lastUpdateAt = now));
  a.equal(dash(s).freshness.stale.length, 0);
  a.equal(dash(s).freshness.updatedThisWeek, s.keyResults.length);
  s.keyResults[0].lastUpdateAt = "2026-08-23T10:00:00Z";
  delete s.keyResults[1].lastUpdateAt;
  const x = dash(s);
  a.equal(x.freshness.stale.length, 2);
  a.equal(x.freshness.neverUpdated, 1);
});
test("4F M historical core uses final frozen evidence and recorded date", () => {
  let s = history();
  let review = m.newCycleReview(s, cid, now);
  review.reviewedByRoleId = "r1";
  review.executiveConclusion = "ثبت نتیجه";
  review.objectiveClassifications = Object.fromEntries(
    s.objectives.map((o) => [o.id, "partial"]),
  );
  review.krClassifications = Object.fromEntries(
    s.keyResults.map((k) => [k.id, "partial"]),
  );
  s = m.saveCycleReview(s, review, now);
  s = m.completeCycleReview(s, review.id, roles, "پذیرش موارد باز", now);
  s.cycles[0].status = "review";
  s = m.closeCycle(s, cid, "پایان دوره", true, now);
  const before = dash(s);
  s.keyResults.forEach((k) => {
    k.currentValue = 999;
    k.confidence = 1;
  });
  s.objectives.forEach((o) => (o.title = "تغییر جاری"));
  s.cycles[0].endDate = "2028-01-01";
  const after = d.getStrategyDashboard(s, [], "2027-01-01");
  a.equal(after.progress, before.progress);
  a.equal(after.confidence, before.confidence);
  a.equal(after.health.score, before.health.score);
  a.deepEqual(after.rows, before.rows);
  a.equal(after.cycle.endDate, before.cycle.endDate);
  a.equal(after.asOf, today);
});
test("4F N trends use snapshots and never rewrite with live KR values", () => {
  const s = history(),
    before = dash(s).trend;
  s.keyResults.forEach((k) => (k.currentValue = 999));
  a.deepEqual(dash(s).trend, before);
  a.equal(before.length, 3);
});
test("4F trend ranges preserve missing weeks and events use dated audit records", () => {
  const s = history();
  s.strategyWeeklySnapshots[2].weekNumber = 20;
  s.strategyChanges = [
    {
      id: "target-event",
      cycleId: cid,
      entityId: s.keyResults[0].id,
      entityType: "kr",
      fieldChanged: "targetValue",
      oldValue: 100,
      newValue: 120,
      reason: "شاهد تغییر",
      reviewId: "review",
      changedAt: "2026-09-01T10:00:00Z",
    },
  ];
  const x = dash(s);
  a.deepEqual(
    x.trend.map((r) => r.weekNumber),
    [20],
  );
  a.equal(x.trendEvents[0].weekNumber, 2);
  a.equal(x.trendEvents[0].description, "شاهد تغییر");
});
test("4F O changes and audit reasons are retained", () => {
  const s = base();
  s.strategyChanges = [
    {
      id: "change",
      cycleId: cid,
      entityId: s.keyResults[0].id,
      entityType: "kr",
      fieldChanged: "targetValue",
      oldValue: 100,
      newValue: 120,
      reason: "بازنگری مبتنی بر شواهد",
      reviewId: "adapt",
      changedAt: now,
    },
  ];
  const x = dash(s);
  a.equal(x.changeSummary.krTargets, 1);
  a.equal(x.changes[0].reason, s.strategyChanges[0].reason);
  a.ok(x.risks.some((r) => r.type === "change"));
});
test("4F P summary reflects actual data and unknown states", () => {
  const x = dash();
  a.ok(x.summary.includes(Math.round(x.progress) + "٪"));
  a.ok(x.summary.includes(x.health.label));
});
test("4F Q primary focus deterministically selects the highest ranked evidence", () => {
  const x = dash(history());
  a.equal(x.focus.id, x.risks[0].id);
  a.ok(x.risks.every((r) => r.rank <= x.focus.rank));
  a.deepEqual(dash(history()).risks, x.risks);
  a.ok(
    x.risks.every(
      (r) => r.evidence.length && r.destination.startsWith("/strategy/"),
    ),
  );
});
test("4F R no hidden aggregate persistence or synthetic performance", () => {
  const s = base(),
    before = JSON.stringify(s);
  dash(s);
  a.equal(JSON.stringify(s), before);
  s.keyResults = [];
  s.initiatives = [];
  const x = dash(s);
  a.equal(x.progress, null);
  a.equal(x.confidence, null);
  a.equal(x.health.score, null);
  a.equal(x.trend.length, 0);
});
test("4F filters and cycles remain isolated", () => {
  const s = base(),
    x = dash(s, { objectiveId: s.objectives[0].id });
  a.ok(x.krRows.every((k) => k.objective.id === s.objectives[0].id));
  a.equal(dash(s, { cycleId: "missing" }), null);
  s.cycles.push({ ...s.cycles[0], id: "empty", status: "draft" });
  const empty = dash(s, { cycleId: "empty" });
  a.equal(empty.rows.length, 0);
  a.equal(empty.initiatives.length, 0);
  a.equal(empty.progress, null);
});
test("4F unknown confidence and unevaluated effectiveness never earn strong health", () => {
  const s = base();
  s.keyResults.forEach((k) => {
    k.confidence = null;
    k.currentValue = k.targetValue;
  });
  s.initiatives.forEach((i) => (i.effectiveness = "notEvaluated"));
  a.ok(!["strong", "onTrack"].includes(dash(s).health.status));
});
function large(objectives, krs, initiatives, weeks) {
  const seed = history(),
    s = base(),
    o = seed.objectives[0],
    k = seed.keyResults.find((k) => k.type === "increase"),
    i = seed.initiatives[0];
  s.cycles[0].startDate = "2026-01-01";
  s.cycles[0].endDate = "2026-12-31";
  s.objectives = Array.from({ length: objectives }, (_, j) => ({
    ...o,
    id: "o" + j,
    code: "O" + j,
    krWeightMode: "equal",
  }));
  s.keyResults = Array.from({ length: krs }, (_, j) => ({
    ...k,
    id: "k" + j,
    objectiveId: "o" + (j % objectives),
    weight: null,
    currentValue: j % 100,
    confidence: 7,
  }));
  s.initiatives = Array.from({ length: initiatives }, (_, j) => ({
    ...i,
    id: "i" + j,
    keyResultId: "k" + (j % krs),
    objectiveId: "o" + ((j % krs) % objectives),
  }));
  s.weeklyReviews = Array.from({ length: weeks }, (_, j) => ({
    ...seed.weeklyReviews[0],
    id: "w" + j,
    weekNumber: j + 1,
    periodStart: new Date(Date.UTC(2026, 0, 1 + j * 7))
      .toISOString()
      .slice(0, 10),
    periodEnd: new Date(Date.UTC(2026, 0, 7 + j * 7))
      .toISOString()
      .slice(0, 10),
  }));
  s.strategyWeeklySnapshots = s.weeklyReviews.map((r, j) => ({
    ...seed.strategyWeeklySnapshots[0],
    reviewId: r.id,
    weekNumber: j + 1,
    overallProgress: j * 2,
    averageConfidence: 7,
  }));
  s.krCheckIns = s.weeklyReviews.flatMap((r) =>
    s.keyResults.map((k) => ({
      ...seed.krCheckIns[0],
      id: r.id + k.id,
      reviewId: r.id,
      keyResultId: k.id,
      objectiveId: k.objectiveId,
      weekNumber: r.weekNumber,
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      confidence: 7,
      blocker: "",
      krSnapshot: k,
    })),
  );
  s.objectiveWeeklySnapshots = s.weeklyReviews.flatMap((r) =>
    s.objectives.map((o) => ({
      ...seed.objectiveWeeklySnapshots[0],
      reviewId: r.id,
      objectiveId: o.id,
      weekNumber: r.weekNumber,
    })),
  );
  return s;
}
for (const args of [
  [10, 40, 60, 13],
  [25, 100, 150, 26],
])
  test("4F S aggregation benchmark " + args.join("/"), () => {
    const s = large(...args),
      before = JSON.stringify(s),
      times = [];
    for (let n = 0; n < 5; n++) {
      const start = performance.now(),
        x = dash(s);
      times.push(performance.now() - start);
      a.equal(x.rows.length, args[0]);
      a.equal(x.krRows.length, args[1]);
      a.equal(x.initiatives.length, args[2]);
      a.equal(x.trend.length, 13);
      a.equal(x.allTrend.length, args[3]);
    }
    console.log(
      "4F benchmark " +
        args.join("/") +
        " ms: " +
        times.map((n) => n.toFixed(1)).join(", "),
    );
    a.ok(Math.max(...times) < 2000);
    a.equal(JSON.stringify(s), before);
  });

// Build 4G release integrity: regressions spanning the existing subsystems.
const core = require("../.test-build/strategy/model.js");
const km = require("../.test-build/strategy/kr/mutations.js");
const dates = require("../.test-build/strategy/adapt/definition.js");
const weeks = require("../.test-build/strategy/weekly/calculations.js");
function closedFixture() {
  let s = history();
  let r = m.newCycleReview(s, cid, now);
  r.reviewedByRoleId = "r1";
  r.executiveConclusion = "مرور نهایی آزمون";
  r.objectiveClassifications = Object.fromEntries(
    s.objectives.map((o) => [o.id, "partial"]),
  );
  r.krClassifications = Object.fromEntries(
    s.keyResults.map((k) => [k.id, "partial"]),
  );
  s = m.saveCycleReview(s, r, now);
  s = m.completeCycleReview(s, r.id, roles, "موارد باز پذیرفته شد", now);
  s.cycles[0].status = "review";
  return m.closeCycle(s, cid, "پایان آزمون", true, now);
}
test("4G A completed weekly artifacts survive live measurements and central guard rejects rewrites", () => {
  const s = history(),
    before = JSON.stringify([
      s.krCheckIns,
      s.strategyWeeklySnapshots,
      s.objectiveWeeklySnapshots,
    ]),
    k = s.keyResults.find((k) => k.id === "sample-kr3");
  const next = km.saveKR(s, { ...k, currentValue: 70, confidence: 2 }, now);
  m.assertStrategyTransition(s, next);
  a.equal(
    JSON.stringify([
      next.krCheckIns,
      next.strategyWeeklySnapshots,
      next.objectiveWeeklySnapshots,
    ]),
    before,
  );
  const damaged = structuredClone(next);
  damaged.strategyWeeklySnapshots[0].overallProgress = 99;
  a.throws(() => m.assertStrategyTransition(next, damaged), /ثابت/);
});
test("4G B dashboard and unfiltered report count the same eligible off-track KRs", () => {
  const s = base();
  s.keyResults.forEach((k) => {
    k.confidence = 1;
    k.currentValue = k.startValue;
  });
  s.objectives[0].status = "draft";
  const x = dash(s);
  a.equal(
    x.krRows.filter((r) => r.pacing.status === "offTrack").length,
    x.performance.counts.offTrack,
  );
  a.ok(x.krRows.every((r) => r.objective.status === "active"));
});
test("4G C changing report filters never changes cycle-wide executive headlines", () => {
  const s = base(),
    x = dash(s),
    y = dash(s, { objectiveId: s.objectives[0].id, krStatus: "offTrack" });
  for (const key of [
    "progress",
    "confidence",
    "health",
    "performance",
    "summary",
  ])
    a.deepEqual(x[key], y[key]);
});
test("4G D final cycle snapshot survives carry-forward without inheriting weekly history", () => {
  const s = closedFixture(),
    before = JSON.stringify(s),
    reset = require("../.test-build/strategy/adapt/reset.js").resetCycle;
  const kr = s.keyResults.find((k) => k.type === "increase"),
    objective = s.objectives.find((o) => o.id === kr.objectiveId);
  const selection = {
    priorityIds: objective.relatedPriorityId
      ? [objective.relatedPriorityId]
      : [],
    objectiveIds: [objective.id],
    krIds: [kr.id],
    initiativeIds: [],
    learningIds: [],
    assumptionIds: [],
  };
  const nextCycle = {
    ...s.cycles[0],
    id: "next-4g",
    name: "بعدی",
    status: "draft",
    startDate: "2026-12-01",
    endDate: "2027-02-28",
    closedAt: undefined,
  };
  const out = reset(
    s,
    cid,
    nextCycle,
    selection,
    { [kr.id]: kr.currentValue + 100 },
    true,
    now,
  );
  a.equal(JSON.stringify(s), before);
  const fresh = out.keyResults.find((k) => k.cycleId === "next-4g");
  a.ok(fresh);
  a.notEqual(fresh.id, kr.id);
  a.equal(fresh.startValue, kr.currentValue);
  a.equal(fresh.currentValue, kr.currentValue);
  a.equal(fresh.confidence, null);
  a.equal(fresh.lastUpdateAt, undefined);
  a.ok(!(out.krCheckIns ?? []).some((c) => c.cycleId === "next-4g"));
  a.deepEqual(
    dash(out, { cycleId: cid }).source.snapshot,
    dash(s).source.snapshot,
  );
});
test("4G E completed to archived preserves historical reporting and rejects other edits", () => {
  const s = closedFixture(),
    next = core.saveCycle(s, {
      ...s.cycles[0],
      status: "archived",
      updatedAt: now,
    });
  m.assertStrategyTransition(s, next);
  a.equal(dash(next).progress, dash(s).progress);
  a.equal(next.strategyChanges.at(-1).newValue, "archived");
  const bad = structuredClone(next);
  bad.objectives[0].title = "تغییر سابقه";
  a.throws(() => m.assertStrategyTransition(next, bad));
});
test("4G F missing confidence remains unknown after serialization and dashboard filtering", () => {
  const s = base();
  s.keyResults.forEach((k) => (k.confidence = null));
  const x = dash(core.parseStrategy(JSON.stringify(s)));
  a.equal(x.confidence, null);
  a.equal(x.health.components.find((c) => c.id === "confidence").score, null);
});
test("4G G unevaluated completion is not an ineffective outcome", () => {
  const s = base();
  s.initiatives = s.initiatives.map((i) => ({
    ...i,
    status: "completed",
    progress: 100,
    effectiveness: "notEvaluated",
  }));
  const x = dash(s);
  a.equal(x.portfolio.weak, 0);
  a.equal(x.portfolio.unevaluated, s.initiatives.length);
  a.equal(
    x.health.components.find((c) => c.id === "effectiveness").score,
    null,
  );
});
test("4G H stale observation affects freshness but not measured result", () => {
  const s = base(),
    before = dash(s);
  s.keyResults.forEach((k) => (k.lastUpdateAt = "2020-01-01T00:00:00Z"));
  const x = dash(s);
  a.equal(x.progress, before.progress);
  a.equal(x.performance.averageProgress, before.performance.averageProgress);
  a.equal(x.freshness.stale.length, x.performance.total);
});
test("4G I Tehran midnight and cycle boundary weeks are exact", () => {
  a.equal(dates.reviewDate("2026-09-23T21:00:00Z"), "2026-09-24");
  const c = { startDate: "2026-09-01", endDate: "2026-09-15" };
  a.equal(weeks.getCycleWeek(c, "2026-08-31").weekNumber, null);
  a.equal(weeks.getCycleWeek(c, "2026-09-01").weekNumber, 1);
  a.equal(weeks.getCycleWeek(c, "2026-09-07").weekNumber, 1);
  a.equal(weeks.getCycleWeek(c, "2026-09-08").weekNumber, 2);
  a.equal(weeks.getCycleWeek(c, "2026-09-15").weekNumber, 3);
  a.equal(weeks.getCycleWeek(c, "2026-09-16").weekNumber, null);
});
test("4G J malformed storage is rejected and dangling ownership has safe reporting", () => {
  a.throws(() => core.parseStrategy("{"));
  const s = base();
  s.keyResults[0].ownerRoleId = "missing";
  a.doesNotThrow(() => dash(s));
  a.ok(dash(s).alignment.ownerGaps.length);
  s.keyResults[0].objectiveId = "missing";
  a.doesNotThrow(() => dash(s));
  a.throws(() => core.parseStrategy(JSON.stringify(s)));
});
test("4G K critical weighted KR outranks informational audit changes", () => {
  const s = base();
  s.keyResults.forEach((k) => {
    k.confidence = 1;
    k.currentValue = k.startValue;
  });
  s.strategyChanges = [
    {
      id: "notice",
      cycleId: cid,
      entityId: s.keyResults[0].id,
      entityType: "kr",
      fieldChanged: "targetValue",
      oldValue: 100,
      newValue: 110,
      reason: "شاهد",
      reviewId: "review",
      changedAt: now,
    },
  ];
  const x = dash(s);
  a.equal(x.focus.severity, "critical");
  a.ok(x.focus.rank > x.risks.find((r) => r.id === "change-notice").rank);
});
test("4G L changing initiative execution never changes KR result", () => {
  const s = base(),
    before = dash(s).progress;
  s.initiatives.forEach((i) => {
    i.progress = 100;
    i.status = "completed";
  });
  a.equal(dash(s).progress, before);
});
test("4G M empty extension collections do not invent trend or trend events", () => {
  const s = base();
  delete s.weeklyReviews;
  delete s.krCheckIns;
  delete s.strategyWeeklySnapshots;
  const x = dash(core.parseStrategy(JSON.stringify(s)));
  a.equal(x.trend.length, 0);
  a.equal(x.trendEvents.length, 0);
  a.match(x.momentum.label, /کافی/);
});
test("4G N health and contributions stay finite with zero/missing data", () => {
  for (const empty of [false, true]) {
    const s = base();
    s.keyResults.forEach((k) => {
      k.startValue = 0;
      k.targetValue = 0;
      k.currentValue = empty ? null : 0;
      k.confidence = null;
    });
    const x = dash(s);
    a.ok(x.health.score === null || Number.isFinite(x.health.score));
    for (const c of x.health.components)
      a.ok(c.contribution === null || Number.isFinite(c.contribution));
  }
});
test("4G O large 50/250/400/52 reports and filters are deterministic", () => {
  const s = large(50, 250, 400, 52),
    runs = [];
  let result;
  for (let n = 0; n < 3; n++) {
    const t = performance.now(),
      x = dash(s);
    runs.push(performance.now() - t);
    if (result) a.deepEqual(x, result);
    result = x;
  }
  const t = performance.now(),
    filtered = dash(s, { objectiveId: "o1", krStatus: "offTrack", weeks: 26 });
  console.log(
    "4G 50/250/400/52 aggregation ms",
    runs.map((n) => n.toFixed(1)).join(", "),
    "filter ms",
    (performance.now() - t).toFixed(1),
  );
  a.equal(result.rows.length, 50);
  a.equal(result.performance.total, 250);
  a.equal(result.initiatives.length, 400);
  a.equal(result.allTrend.length, 52);
  a.equal(filtered.trend.length, 26);
  a.ok(runs.every((n) => n < 2000));
});
test("4G P cancelled Objective and KR do not leak into active KR reporting", () => {
  const s = base();
  s.objectives[0].status = "cancelled";
  s.keyResults.at(-1).lifecycle = "cancelled";
  const x = dash(s);
  a.ok(
    x.krRows.every(
      (r) => r.objective.status === "active" && r.kr.lifecycle === "active",
    ),
  );
  a.equal(x.performance.total, x.krRows.length);
});
test("4G Q old saved data round trips without reseeding or duplicate IDs", () => {
  let s = require("../.test-build/strategy/seed.js").seedStrategy(roles);
  const original = JSON.stringify(s);
  for (let i = 0; i < 3; i++) s = core.parseStrategy(JSON.stringify(s));
  a.equal(JSON.stringify(s), original);
  a.equal(s.keyResults, undefined);
  a.equal(new Set(s.objectives.map((o) => o.id)).size, s.objectives.length);
});
test("4G R audit old/new payload cannot be rewritten at commit", () => {
  const s = closedFixture(),
    next = structuredClone(s);
  next.strategyChanges[0].oldValue = "forged";
  a.throws(() => m.assertStrategyTransition(s, next), /سابقه تغییر/);
});
test("4G S entity drill-down includes the actual Objective and KR IDs", () => {
  const s = base(),
    x = dash(s);
  for (const r of x.krRows)
    a.equal(
      r.destination,
      `/strategy/cycles/${r.kr.cycleId}/objectives/${r.kr.objectiveId}#kr-${r.kr.id}`,
    );
});
test("4G T controlled reopen only unlocks the latest review and preserves snapshots", () => {
  const s = history();
  a.throws(() => w.reopenWeeklyReview(s, "w1", today, now));
  const next = w.reopenWeeklyReview(s, "w3", today, now);
  a.doesNotThrow(() => m.assertStrategyTransition(s, next));
  a.deepEqual(next.strategyWeeklySnapshots, s.strategyWeeklySnapshots);
  const bad = structuredClone(next);
  bad.krCheckIns.at(-1).confidence = 1;
  a.throws(() => m.assertStrategyTransition(s, bad), /ثابت/);
});

test("4G partial last week becomes due only after the cycle ends", () => {
  const s = base();
  s.cycles[0].startDate = "2026-09-01";
  s.cycles[0].endDate = "2026-09-15";
  a.equal(d.getReviewDiscipline(s, cid, "2026-08-31").dueWeeks, 0);
  a.equal(d.getReviewDiscipline(s, cid, "2026-09-07").dueWeeks, 0);
  a.equal(d.getReviewDiscipline(s, cid, "2026-09-08").dueWeeks, 1);
  a.equal(d.getReviewDiscipline(s, cid, "2026-09-15").dueWeeks, 2);
  a.equal(d.getReviewDiscipline(s, cid, "2026-09-16").dueWeeks, 3);
});
