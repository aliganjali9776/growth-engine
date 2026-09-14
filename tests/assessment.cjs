const { test } = require("node:test");
const assert = require("node:assert/strict");
const { questions, dimensions } = require("../.test-build/questions.js");
const {
  calculateScores,
  classify,
  isComplete,
} = require("../.test-build/scoring.js");
const { diagnose } = require("../.test-build/diagnostics.js");
const {
  emptyDraft,
  parseDraft,
  validProfile,
} = require("../.test-build/persistence.js");
const answers = (system, strategy, scale) =>
  Object.fromEntries(
    questions.map((q) => [q.id, { system, strategy, scale }[q.dimension]]),
  );

test("2.5 A: high System score retains a critical individual finding", () => {
  const a = answers(5, 5, 5);
  a["system-6"] = 1;
  const r = diagnose(a);
  assert.ok(r.scores.system > 80);
  assert.equal(
    r.findings.find((f) => f.id === "system-6").severity,
    "critical",
  );
  assert.ok(
    r.dimensionDiagnostics
      .find((d) => d.dimension === "system")
      .findings.some((f) => f.severity === "critical"),
  );
  assert.ok(r.consultationCopy.includes("شکاف"));
});
test("2.5 B: Strategy near 75 with moderate critical Review requires action", () => {
  const a = answers(4, 4, 4);
  a["strategy-7"] = 3;
  a["strategy-10"] = 3;
  const r = diagnose(a);
  assert.ok(r.scores.strategy > 75 && r.scores.strategy < 76);
  assert.equal(classify(r.scores.strategy), "healthy");
  assert.equal(
    require("../.test-build/interpretation.js").healthLabels.healthy,
    "قابل قبول اما نیازمند بهبود",
  );
  assert.equal(
    r.findings.find((f) => f.id === "strategy-7").severity,
    "action",
  );
  assert.ok(r.hiddenRisks.some((r) => r.id === "review-gap"));
});
test("2.5 C: Scale above 80 still exposes weak acquisition", () => {
  const a = answers(5, 5, 5);
  a["scale-1"] = 2;
  const r = diagnose(a);
  assert.ok(r.scores.scale > 80);
  assert.ok(r.hiddenRisks.some((r) => r.id === "acquisition-gap"));
  assert.equal(r.findings.find((f) => f.id === "scale-1").severity, "critical");
});
test("2.5 D: very high scores give strengths with preservation actions and no invented risks", () => {
  const r = diagnose(answers(5, 5, 5));
  assert.equal(r.findings.length, 30);
  assert.ok(r.findings.every((f) => f.severity === "strength"));
  assert.equal(r.hiddenRisks.length, 0);
  assert.ok(
    r.dimensionDiagnostics.every(
      (d) =>
        d.action.length > 20 && d.riskNote.includes("ریسک مشخصی احراز نشد"),
    ),
  );
  assert.ok(!r.consultationCopy.includes("شکاف"));
  assert.equal(r.executiveSummary.length, 4);
});
test("2.5 E: critical findings span all affected dimensions", () => {
  const a = answers(4, 4, 4);
  a["system-1"] = 1;
  a["strategy-7"] = 2;
  a["scale-10"] = 1;
  const r = diagnose(a);
  assert.deepEqual(
    new Set(
      r.findings
        .filter((f) => f.severity === "critical")
        .map((f) => f.dimension),
    ),
    new Set(dimensions),
  );
});
test("2.5 severity matrix uses exact response and critical weight combinations", () => {
  const { classifySeverity } = require("../.test-build/severity.js");
  for (const [answer, plain, critical] of [
    [1, "critical", "critical"],
    [2, "action", "critical"],
    [3, "improvement", "action"],
    [4, "improvement", "improvement"],
    [5, "strength", "strength"],
  ]) {
    assert.equal(classifySeverity(answer, false), plain);
    assert.equal(classifySeverity(answer, true), critical);
  }
});
test("2.5 all 30 findings are represented once and every dimension is analyzed", () => {
  for (const values of [
    [1, 1, 1],
    [3, 3, 3],
    [4, 4, 4],
    [5, 5, 5],
    [2, 4, 5],
  ]) {
    const r = diagnose(answers(...values));
    assert.equal(r.findings.length, 30);
    assert.equal(new Set(r.findings.map((f) => f.id)).size, 30);
    assert.equal(r.dimensionDiagnostics.length, 3);
    assert.ok(
      r.dimensionDiagnostics.every(
        (d) =>
          d.findings.length === 10 &&
          d.working &&
          d.focus &&
          d.action &&
          d.interpretation,
      ),
    );
    assert.equal(r.executiveSummary.length, 4);
  }
});
test("2.5 hidden risks include actual supporting answers and threshold negatives", () => {
  const a = answers(4, 4, 4);
  a["system-6"] = 2;
  a["system-3"] = 3;
  a["strategy-5"] = 2;
  a["scale-8"] = 2;
  const r = diagnose(a);
  for (const id of [
    "manager-dependency",
    "sop-consistency",
    "measurement-gap",
    "revenue-dependency",
  ])
    assert.ok(r.hiddenRisks.some((r) => r.id === id && r.evidence.length > 0));
  assert.equal(diagnose(answers(4, 4, 4)).hiddenRisks.length, 0);
});
test("2.5 labels include the 90 boundary without changing numeric scoring", () => {
  assert.equal(classify(89.99), "strong");
  assert.equal(classify(90), "excellent");
  assert.equal(calculateScores(answers(4, 4, 4)).overall, 80);
});
test("exactly 30 questions; critical weights match all three specifications", () => {
  assert.equal(questions.length, 30);
  for (const d of dimensions) {
    const set = questions.filter((q) => q.dimension === d);
    assert.equal(set.length, 10);
    assert.equal(
      set.reduce((s, q) => s + q.weight, 0),
      11.5,
    );
    assert.deepEqual(
      set.filter((q) => q.weight === 1.5).map((q) => +q.id.split("-")[1]),
      { system: [2, 4, 6], strategy: [1, 4, 7], scale: [1, 2, 6] }[d],
    );
  }
});
test("A: weak System caps an otherwise healthy overall score", () => {
  const r = diagnose(answers(1, 4, 4));
  assert.equal(r.overall, 60);
  assert.equal(r.scores.system, 20);
  assert.equal(r.primaryConstraint, "system");
  assert.equal(r.status, "developing");
  assert.equal(r.capped, true);
  assert.ok(r.insights.some((s) => s.includes("تشدید")));
});
test("B: weak Strategy is the constraint and prompts direction before speed", () => {
  const r = diagnose(answers(4, 1, 4));
  assert.equal(r.primaryConstraint, "strategy");
  assert.equal(r.status, "developing");
  assert.ok(r.insights.some((s) => s.includes("مقصد")));
});
test("C: strong System/Strategy and weak Scale identifies growth engine constraint", () => {
  const r = diagnose(answers(5, 5, 1));
  assert.equal(r.primaryConstraint, "scale");
  assert.equal(r.status, "developing");
  assert.ok(r.insights.some((s) => s.includes("تکرارپذیر نشده")));
});
test("D: all high scores are strong; issue language reflects opportunities", () => {
  const r = diagnose(answers(5, 5, 5));
  assert.equal(r.overall, 100);
  assert.equal(r.status, "excellent");
  assert.equal(r.allStrong, true);
  assert.ok(r.issues.every((i) => i.severity === "strength"));
  assert.ok(r.insights.some((s) => s.includes("مقیاس‌پذیری پیشرفته")));
});
test("E: all medium answers produce exactly 60 and Healthy", () => {
  const r = diagnose(answers(3, 3, 3));
  assert.equal(r.overall, 60);
  assert.equal(r.status, "healthy");
  assert.equal(r.capped, false);
});
test("minimum valid answers produce 20, not zero; do not raise Critical to Developing", () => {
  const r = diagnose(answers(1, 1, 1));
  assert.equal(r.overall, 20);
  assert.equal(r.status, "critical");
  assert.equal(r.capped, false);
});
test("manual weighted calculation and no premature rounding", () => {
  const a = answers(3, 3, 3);
  a["system-2"] = 5;
  const r = calculateScores(a);
  assert.equal(r.scores.system, (37.5 / 57.5) * 100);
  assert.equal(r.overall, ((37.5 / 57.5) * 100 + 120) / 3);
});
test("all health boundaries are exact", () => {
  for (const [n, s] of [
    [0, "critical"],
    [39.99, "critical"],
    [40, "developing"],
    [59.99, "developing"],
    [60, "healthy"],
    [79.99, "healthy"],
    [80, "strong"],
    [90, "excellent"],
    [100, "excellent"],
  ])
    assert.equal(classify(n), s);
});
test("equal weakness prioritizes critical questions with deterministic ties", () => {
  const r = diagnose(answers(2, 2, 2));
  assert.deepEqual(
    r.issues.map((i) => i.id),
    ["system-2", "system-4", "system-6"],
  );
  assert.deepEqual(r.tiedDimensions, dimensions);
  assert.equal(r.primaryConstraint, "system");
});
test("weaker noncritical answer takes priority over stronger critical answer", () => {
  const a = answers(3, 3, 3);
  a["scale-10"] = 1;
  assert.equal(diagnose(a).issues[0].id, "scale-10");
});
test("missing, fractional, and out-of-range answers cannot complete", () => {
  for (const bad of [undefined, 0, 6, 2.5, "3"]) {
    const a = answers(3, 3, 3);
    a["system-1"] = bad;
    assert.equal(isComplete(a), false);
    assert.throws(() => calculateScores(a));
  }
});
const profile = {
  name: "آریا",
  industry: "فناوری",
  model: "خدماتی",
  teamSize: "6–15",
  revenue: "۱ تا ۵ میلیارد تومان",
  stage: "رشد",
};
test("draft survives persistence with profile, answer, and position intact", () => {
  const d = {
    ...emptyDraft(),
    profile,
    answers: { "system-1": 4 },
    screen: "question",
    questionIndex: 1,
  };
  assert.deepEqual(parseDraft(JSON.stringify(d)), d);
});
test("invalid saved data cannot bypass profile or incomplete result guard", () => {
  assert.throws(() => parseDraft("{bad"));
  assert.throws(() => parseDraft('{"version":1}'));
  const d = {
    ...emptyDraft(),
    profile,
    answers: { "system-1": 9 },
    screen: "results",
    questionIndex: 999,
  };
  const r = parseDraft(JSON.stringify(d));
  assert.equal(r.screen, "question");
  assert.equal(r.questionIndex, 0);
  assert.deepEqual(r.answers, {});
  assert.equal(
    parseDraft(JSON.stringify({ ...d, profile: {} })).screen,
    "profile",
  );
});
test("profile validation rejects blank values and invalid options; restart is empty", () => {
  assert.equal(validProfile(profile), true);
  assert.equal(validProfile({ ...profile, name: "  " }), false);
  assert.equal(validProfile({ ...profile, model: "invalid" }), false);
  assert.deepEqual(emptyDraft().answers, {});
  assert.equal(emptyDraft().screen, "intro");
});
