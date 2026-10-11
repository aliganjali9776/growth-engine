const { test } = require("node:test"),
  a = require("node:assert/strict");
const model = require("../.test-build/strategy/model.js"),
  m = require("../.test-build/strategy/adapt/mutations.js"),
  r = require("../.test-build/strategy/adapt/report.js"),
  reset = require("../.test-build/strategy/adapt/reset.js").resetCycle,
  w = require("../.test-build/strategy/weekly/mutations.js");
const roles = [{ id: "r1", title: "مدیر رشد" }],
  now = "2026-09-22T10:00:00Z",
  today = "2026-09-22",
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
function adapt(s = base()) {
  const v = m.newAdaptReview(s, cid, "2026-08-23", "2026-09-22", now);
  v.reviewedByRoleId = "r1";
  v.progressSummary = "شواهد مرور شد";
  return m.saveAdaptReview(s, v, now);
}
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
        nextAction: "افزایش حمایت",
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
function completed(s = adapt()) {
  return m.completeAdaptReview(
    s,
    s.adaptReviews[0].id,
    roles,
    "موارد باز پیگیری می‌شوند",
    now,
  );
}
function learned(s = base()) {
  const v = m.newCycleReview(s, cid, now);
  v.reviewedByRoleId = "r1";
  v.executiveConclusion = "یادگیری ثبت شد";
  v.objectiveClassifications = Object.fromEntries(
    s.objectives.map((o) => [o.id, "partial"]),
  );
  v.krClassifications = Object.fromEntries(
    s.keyResults.map((k) => [k.id, "missed"]),
  );
  s = m.saveCycleReview(s, v, now);
  return m.completeCycleReview(
    s,
    v.id,
    roles,
    "موارد باز آگاهانه پذیرفته شد",
    now,
  );
}
const selection = () => ({
  priorityIds: [],
  objectiveIds: [],
  krIds: [],
  initiativeIds: [],
  learningIds: [],
  assumptionIds: [],
});
const nextCycle = () => ({
  ...base().cycles[0],
  id: "next-cycle",
  name: "دوره بعد",
  status: "draft",
  startDate: "2026-11-22",
  endDate: "2027-02-20",
});
test("4E A repeated blockers require same entity and three consecutive observations", () => {
  const rows = history().krCheckIns;
  a.equal(r.detectRepeatedBlockers(rows).length, 1);
  a.equal(
    r.detectRepeatedBlockers(rows.filter((x) => x.weekNumber !== 2)).length,
    0,
  );
  a.equal(
    r.detectRepeatedBlockers(
      rows.map((x, i) => (i === 1 ? { ...x, blocker: "مانع دیگر" } : x)),
    ).length,
    0,
  );
});
test("4E B stalled KRs use real stable weeks and exclude completed KRs", () => {
  const rows = history().krCheckIns;
  a.deepEqual(r.detectStalledKRs(rows), ["sample-kr3"]);
  a.equal(
    r.detectStalledKRs(rows.map((x) => ({ ...x, progress: 100 }))).length,
    0,
  );
  const changed = structuredClone(rows);
  changed[2].krSnapshot.targetValue = 200;
  a.equal(r.detectStalledKRs(changed).length, 0);
});
test("4E C confidence trend requires valid consecutive declines", () => {
  const rows = history().krCheckIns;
  a.equal(r.detectConfidenceDecline(rows).length, 1);
  a.equal(
    r.detectConfidenceDecline(rows.map((x) => ({ ...x, confidence: null })))
      .length,
    0,
  );
  a.equal(r.detectConfidenceDecline(rows.slice(1)).length, 0);
});
test("4E D risk signals use completed history only", () => {
  const s = history();
  a.ok(
    r
      .adaptReviewSignals(s, cid, roles, today)
      .some((x) => x.kind === "repeated"),
  );
  s.weeklyReviews[2].status = "draft";
  a.equal(
    r
      .adaptReviewSignals(s, cid, roles, today)
      .some((x) => x.kind === "repeated"),
    false,
  );
});
test("4E E recording initiative decision does not mutate initiative", () => {
  const s = adapt(),
    v = structuredClone(s.adaptReviews[0]);
  v.initiativeChanges = [
    {
      id: "d",
      initiativeId: s.initiatives[0].id,
      decision: "stop",
      rationale: "کم‌اثر",
      effectiveDate: today,
      ownerRoleId: "r1",
      newDueDate: "",
      createdAt: now,
    },
  ];
  const next = m.saveAdaptReview(s, v, now);
  a.deepEqual(next.initiatives, s.initiatives);
  a.throws(() => m.applyInitiativeDecision(next, v.id, "d", false, now));
});
test("4E F explicit initiative application creates old/new audit and cannot repeat", () => {
  let s = adapt(),
    v = s.adaptReviews[0];
  v.initiativeChanges = [
    {
      id: "d",
      initiativeId: s.initiatives[0].id,
      decision: "stop",
      rationale: "کم‌اثر",
      effectiveDate: today,
      ownerRoleId: "r1",
      newDueDate: "",
      createdAt: now,
    },
  ];
  const next = m.applyInitiativeDecision(s, v.id, "d", true, now);
  a.equal(next.initiatives[0].status, "cancelled");
  a.equal(next.strategyChanges[0].newValue, "cancelled");
  a.throws(() => m.applyInitiativeDecision(next, v.id, "d", true, now));
});
test("4E G KR target change requires reason and confirmation", () => {
  const s = adapt(),
    id = s.adaptReviews[0].id;
  for (const [reason, confirm] of [
    ["", true],
    ["اصلاح هدف", false],
  ])
    a.throws(() =>
      m.applyStrategyChange(
        s,
        id,
        "kr",
        "sample-kr3",
        { targetValue: 150 },
        reason,
        confirm,
        now,
      ),
    );
  const next = m.applyStrategyChange(
    s,
    id,
    "kr",
    "sample-kr3",
    { targetValue: 150 },
    "فرصت جدید",
    true,
    now,
  );
  a.equal(next.strategyChanges[0].oldValue, 100);
  a.equal(next.strategyChanges[0].newValue, 150);
  m.assertStrategyTransition(s, next);
});
test("4E H baseline change preserves all prior weekly snapshots", () => {
  const s = adapt(history()),
    next = m.applyStrategyChange(
      s,
      s.adaptReviews[0].id,
      "kr",
      "sample-kr3",
      { startValue: 10 },
      "اصلاح مبنا",
      true,
      now,
    );
  a.deepEqual(next.krCheckIns, s.krCheckIns);
  a.deepEqual(next.strategyWeeklySnapshots, s.strategyWeeklySnapshots);
});
test("4E I Objective deadline and J priority rank have source and reason", () => {
  let s = adapt();
  const id = s.adaptReviews[0].id,
    o = s.objectives[0],
    p = s.priorities[0];
  s = m.applyStrategyChange(
    s,
    id,
    "objective",
    o.id,
    { deadline: "2026-11-20" },
    "اصلاح دامنه",
    true,
    now,
  );
  s = m.applyStrategyChange(
    s,
    id,
    "priority",
    p.id,
    { rank: 7 },
    "تمرکز جدید",
    true,
    now,
  );
  a.equal(s.strategyChanges.length, 2);
  a.ok(s.strategyChanges.every((x) => x.reviewId === id && x.reason));
});
test("4E K quality requires risk review initiative rationale decisions resources and next focus", () => {
  const s = adapt(history()),
    v = s.adaptReviews[0],
    signals = r.adaptReviewSignals(s, cid, roles, today);
  a.ok(r.adaptReviewQuality(s, v, signals).score < 100);
  v.reviewedRiskIds = signals.map((x) => x.id);
  v.initiativeChanges = s.initiatives.map((i) => ({
    initiativeId: i.id,
    rationale: "بررسی شد",
  }));
  v.priorityChanges = s.priorities.map((p) => ({
    priorityId: p.id,
    rationale: "معتبر است",
  }));
  v.resourcesReviewed = true;
  v.nextFocus = ["تمرکز ماه بعد"];
  a.equal(r.adaptReviewQuality(s, v, signals).score, 100);
});
test("4E L monthly snapshot is immutable and detached from later measurements", () => {
  const s = completed(adapt(history())),
    next = structuredClone(s);
  next.keyResults[0].currentValue = 999;
  a.deepEqual(s.adaptReviews[0].snapshot, next.adaptReviews[0].snapshot);
  next.adaptReviews[0].progressSummary = "overwrite";
  a.throws(() => m.assertStrategyTransition(s, next));
  a.throws(() =>
    m.saveAdaptReview(s, { ...s.adaptReviews[0], status: "draft" }),
  );
});
test("4E M final outcome classification is mandatory even with override", () => {
  let s = base(),
    v = m.newCycleReview(s, cid, now);
  v.reviewedByRoleId = "r1";
  v.executiveConclusion = "نتیجه";
  s = m.saveCycleReview(s, v, now);
  a.throws(() => m.completeCycleReview(s, v.id, roles, "override", now));
  s = learned();
  a.equal(s.cycleReviews[0].snapshot.objectives.length, s.objectives.length);
});
test("4E N learning records and O assumption statuses persist independently", () => {
  const s = base();
  s.strategyLearnings = [
    {
      id: "l",
      cycleId: cid,
      category: "market",
      statement: "آموخته",
      evidence: "شاهد",
      relatedObjectiveId: "",
      relatedKRId: "",
      relatedInitiativeId: "",
      createdAt: now,
    },
  ];
  s.strategicAssumptions = [
    {
      id: "a",
      cycleId: cid,
      statement: "فرض",
      status: "weakening",
      evidence: "شاهد",
      relatedPriorityId: "",
      createdAt: now,
      updatedAt: now,
    },
  ];
  a.deepEqual(
    model.parseStrategy(JSON.stringify(s)),
    JSON.parse(JSON.stringify(s)),
  );
  a.equal(r.learningSummary(s, cid).lessons, 1);
});
test("4E P carry-forward makes new IDs, fresh baseline, no historical records", () => {
  const s = learned(history()),
    k = s.keyResults.find((k) => k.id === "sample-kr3"),
    o = s.objectives.find((o) => o.id === k.objectiveId);
  const chosen = {
    ...selection(),
    priorityIds: o.relatedPriorityId ? [o.relatedPriorityId] : [],
    objectiveIds: [o.id],
    krIds: [k.id],
  };
  const next = reset(s, cid, nextCycle(), chosen, { [k.id]: 200 }, true, now),
    copy = next.keyResults.find((x) => x.cycleId === "next-cycle");
  a.notEqual(copy.id, k.id);
  a.equal(copy.startValue, k.currentValue);
  a.equal(copy.targetValue, 200);
  a.equal(copy.confidence, null);
  a.deepEqual(next.krCheckIns, s.krCheckIns);
  a.deepEqual(next.weeklyReviews, s.weeklyReviews);
  a.deepEqual(
    next.cycles.find((c) => c.id === cid),
    s.cycles[0],
  );
});
test("4E Q new cycle requires explicit selection dependencies target and confirmation", () => {
  const s = learned();
  a.throws(() => reset(s, cid, nextCycle(), selection(), {}, false, now));
  a.throws(() =>
    reset(
      s,
      cid,
      nextCycle(),
      { ...selection(), krIds: ["sample-kr3"] },
      {},
      true,
      now,
    ),
  );
  const next = reset(s, cid, nextCycle(), selection(), {}, true, now);
  a.equal(next.cycles.at(-1).status, "draft");
  a.equal(next.keyResults.length, s.keyResults.length);
});
test("4E R closed cycles reject edits additions and reopen", () => {
  let s = learned();
  s.cycles[0].status = "review";
  s = m.closeCycle(s, cid, "تأیید پایان", true, now);
  const next = structuredClone(s);
  next.objectives[0].title = "ویرایش";
  a.throws(() => m.assertStrategyTransition(s, next));
  next.objectives = structuredClone(s.objectives);
  next.cycles[0].status = "active";
  a.throws(() => m.assertStrategyTransition(s, next));
});
test("4E S change summary counts auditable change types", () => {
  let s = adapt();
  s = m.applyStrategyChange(
    s,
    s.adaptReviews[0].id,
    "kr",
    "sample-kr3",
    { targetValue: 200 },
    "دلیل",
    true,
    now,
  );
  a.equal(r.strategyChangeSummary(s, cid).krTargets, 1);
});
test("4E T older stores are unchanged and new collections remain absent", () => {
  const s = base();
  a.deepEqual(
    model.parseStrategy(JSON.stringify(s)),
    JSON.parse(JSON.stringify(s)),
  );
  a.equal(s.adaptReviews, undefined);
});
test("4E U completed monthly and end-cycle records survive refresh", () => {
  const s = learned(completed(adapt(history())));
  a.deepEqual(
    model.parseStrategy(JSON.stringify(s)),
    JSON.parse(JSON.stringify(s)),
  );
});
test("4E legacy editing cannot bypass audited target or rank changes", () => {
  const s = base(),
    next = structuredClone(s);
  next.keyResults[0].targetValue = 900;
  a.throws(() => m.assertStrategyTransition(s, next));
  next.keyResults = structuredClone(s.keyResults);
  next.priorities[0].rank = 9;
  a.throws(() => m.assertStrategyTransition(s, next));
});
test("4E audit records are append-only and review periods cannot overlap", () => {
  let s = adapt();
  s = m.applyStrategyChange(
    s,
    s.adaptReviews[0].id,
    "kr",
    "sample-kr3",
    { targetValue: 200 },
    "دلیل",
    true,
    now,
  );
  a.throws(() => m.assertStrategyTransition(s, { ...s, strategyChanges: [] }));
  a.throws(() => m.newAdaptReview(s, cid, "2026-09-01", "2026-09-25", now));
});
test("4E changed definition starts a new comparable segment after audited change", () => {
  let s = adapt(history());
  s = m.applyStrategyChange(
    s,
    s.adaptReviews[0].id,
    "kr",
    "sample-kr3",
    { targetValue: 200 },
    "هدف جدید",
    true,
    now,
  );
  s = w.createWeeklyReview(s, cid, 4, "w4", today, now);
  s = w.saveCheckIn(
    s,
    "w4",
    {
      keyResultId: "sample-kr3",
      currentValue: 35,
      confidence: 5,
      completedMilestoneIds: [],
      win: "",
      blocker: "کمبود ظرفیت",
      nextAction: "پیگیری",
      comment: "",
    },
    "c4",
    today,
    now,
  );
  a.equal(s.krCheckIns.at(-1).previousProgress, 17.5);
  a.equal(s.krCheckIns.at(-1).delta, 0);
});

test("4E draft cycle permits initial setup without a future Adapt review", () => {
  const s = base();
  s.cycles[0].status = "draft";
  s.initiatives = [];
  const next = structuredClone(s);
  next.keyResults[0].targetValue = 400;
  m.assertStrategyTransition(s, next);
});
test("4E active cycle cannot downgrade to draft to evade change control", () => {
  const s = base(),
    next = structuredClone(s);
  next.cycles[0].status = "draft";
  a.throws(() => m.assertStrategyTransition(s, next));
});
test("4E priority rank swap audits both affected priorities", () => {
  const s = adapt(),
    p = s.priorities[0],
    peer = s.priorities[1],
    next = m.applyStrategyChange(
      s,
      s.adaptReviews[0].id,
      "priority",
      p.id,
      { rank: peer.rank },
      "تغییر تمرکز",
      true,
      now,
    );
  a.equal(next.priorities.find((x) => x.id === peer.id).rank, p.rank);
  a.equal(next.strategyChanges.length, 2);
  m.assertStrategyTransition(s, next);
});
test("4E cycle final learning is frozen and invalid classifications fail validation", () => {
  const s = learned(),
    next = structuredClone(s);
  next.cycleReviews[0].executiveConclusion = "تغییر";
  a.throws(() => m.assertStrategyTransition(s, next));
  next.cycleReviews[0].krClassifications["missing"] = "achieved";
  a.throws(() => model.validateStrategy(next));
});
test("4E carry-forward reads frozen final evidence instead of later live values", () => {
  const s = learned(),
    k = s.keyResults.find((k) => k.id === "sample-kr3"),
    o = s.objectives.find((o) => o.id === k.objectiveId),
    final = k.currentValue;
  k.currentValue = 99;
  const next = reset(
    s,
    cid,
    nextCycle(),
    {
      ...selection(),
      priorityIds: [o.relatedPriorityId],
      objectiveIds: [o.id],
      krIds: [k.id],
    },
    { [k.id]: 150 },
    true,
    now,
  );
  a.equal(
    next.keyResults.find((k) => k.cycleId === "next-cycle").startValue,
    final,
  );
});
test("4E Tehran date is consistent at midnight across review screens", () => {
  a.equal(
    require("../.test-build/strategy/adapt/definition.js").reviewDate(
      "2026-09-22T21:00:00Z",
    ),
    "2026-09-23",
  );
});
test("4E invalid calendar date and malformed snapshots are rejected", () => {
  const s = adapt();
  s.adaptReviews[0].periodStart = "2026-08-32";
  a.throws(() => model.validateStrategy(s));
  const c = completed();
  c.adaptReviews[0].snapshot.quality = NaN;
  a.throws(() => model.validateStrategy(c));
});
test("4E cancelled action is not carried into the next cycle", () => {
  const s = base();
  s.initiatives[0].status = "cancelled";
  const final = learned(s);
  a.throws(() =>
    reset(
      final,
      cid,
      nextCycle(),
      { ...selection(), initiativeIds: [s.initiatives[0].id] },
      {},
      true,
      now,
    ),
  );
});
