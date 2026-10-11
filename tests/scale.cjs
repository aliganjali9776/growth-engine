const { test } = require("node:test");
const a = require("node:assert/strict");
const m = require("../.test-build/scale/scale/model.js"),
  p = require("../.test-build/scale/scale/persistence.js"),
  l = require("../.test-build/scale/scale/logic.js"),
  { seedScale } = require("../.test-build/scale/scale/seed.js"),
  {
    readScaleSources,
    systemCapacitySignals,
  } = require("../.test-build/scale/scale/sources.js");
const { createSystemSeed } = require("../.test-build/system/seed.js");
const { seedStrategy } = require("../.test-build/strategy/seed.js");
const { withSampleKRs } = require("../.test-build/strategy/kr/seed.js");
const seed = () => seedScale("2026-09-30T08:00:00.000Z", "r1");
const storage = (entries = {}) => {
  const map = new Map(Object.entries(entries));
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
  };
};
const structured = (s) => ({
  ...m.newIdea(),
  title: "Test intervention",
  constraintId: s.constraints[0].id,
  leverId: "content",
  rationale: "Test evidence-based mechanism",
  successMetric: "Qualified leads compared with baseline",
  expectedImpact: "high",
  confidence: "high",
  effort: "low",
  status: "ready",
});
test("5A A profile persists without writing other keys", () => {
  const s = seed(),
    db = storage();
  s.profile.businessModel = "manufacturing";
  p.persistScale(db, s, null);
  a.equal(
    p.parseScale(db.getItem(m.SCALE_KEY)).profile.businessModel,
    "manufacturing",
  );
  a.equal(db.map.size, 1);
});
test("5A B unknown remains null and measured zero survives", () => {
  const s = seed();
  s.metrics.customers = 0;
  const x = p.parseScale(JSON.stringify(s));
  a.equal(x.metrics.retention, null);
  a.equal(x.metrics.customers, 0);
});
test("5A C diagnosis candidate becomes explicit candidate record", () => {
  const s = seed(),
    d = l.constraintCandidates(s)[0];
  const c = {
    ...m.newConstraint(),
    title: "Check acquisition",
    dimension: d.dimension,
  };
  const x = p.saveConstraint(s, c);
  a.equal(x.constraints.find((z) => z.id === c.id).status, "candidate");
});
test("5A D primary is single active ID; candidate cannot be primary", () => {
  const s = seed(),
    c = {
      ...m.newConstraint(),
      title: "Second",
      status: "active",
      ownerRoleId: "r1",
    };
  const x = p.saveConstraint(s, c, true);
  a.equal(x.primaryConstraintId, c.id);
  a.equal(x.constraints.filter((z) => z.status === "active").length, 2);
  a.throws(() => p.saveConstraint(s, { ...c, status: "candidate" }, true));
});
test("5A E strong requires evidence; active owner required", () => {
  const s = seed(),
    c = s.constraints[0];
  a.equal(l.constraintQuality(c), "strong");
  a.equal(l.constraintQuality({ ...c, evidence: [] }), "needsEvidence");
  a.throws(() => p.saveConstraint(s, { ...c, ownerRoleId: "" }));
});
test("5A F high severity never upgrades confidence", () => {
  const c = {
    ...seed().constraints[0],
    severity: "critical",
    confidence: "low",
  };
  a.equal(p.saveConstraint(seed(), c).constraints[0].confidence, "low");
});
test("5A G lever links validated and suggestions dimension-scoped", () => {
  const s = seed();
  a.ok(
    l.constraintLeverSuggestions(s, "retention").some((x) => x.id === "repeat"),
  );
  a.throws(() =>
    p.saveConstraint(s, { ...s.constraints[0], leverIds: ["missing"] }),
  );
});
test("5A H fast inbox only needs title and source", () => {
  const s = seed(),
    i = { ...m.newIdea(), title: "Fast capture", source: "customer" };
  a.equal(p.saveIdea(s, i).ideas.find((x) => x.id === i.id).status, "inbox");
});
test("5A I inbox has no constraint requirement", () => {
  const i = { ...m.newIdea(), title: "No constraint yet" };
  a.equal(p.saveIdea(seed(), i).ideas.at(-1).constraintId, "");
});
test("5A J readiness and prioritization reject missing structure", () => {
  const s = seed(),
    i = structured(s);
  for (const key of ["constraintId", "leverId", "rationale", "successMetric"])
    a.throws(() => p.saveIdea(s, { ...i, [key]: "" }));
  a.throws(() => p.saveIdea(s, { ...i, status: "prioritized", effort: null }));
  a.equal(l.ideaReadiness(i, s).ready, true);
});
test("5A K priority matrix has explained categories", () => {
  const i = structured(seed());
  a.deepEqual(l.ideaPriority(i), { score: 27, category: "کاندید بسیار قوی" });
  a.equal(l.ideaPriority({ ...i, confidence: null }).score, null);
  a.equal(
    l.ideaPriority({
      ...i,
      expectedImpact: "low",
      confidence: "low",
      effort: "high",
    }).score,
    1,
  );
});
test("5A L less effort improves priority", () => {
  const i = structured(seed());
  a.ok(
    l.ideaPriority(i).score > l.ideaPriority({ ...i, effort: "high" }).score,
  );
});
test("5A M correct constraint ID and no dangling internal links", () => {
  const s = seed(),
    i = structured(s);
  a.equal(p.saveIdea(s, i).ideas.at(-1).constraintId, s.constraints[0].id);
  a.throws(() => p.saveIdea(s, { ...i, constraintId: "missing" }));
});
test("5A N Strategy references loaded from source, not copied targets", () => {
  const strategy = withSampleKRs(seedStrategy([{ id: "r1", title: "Owner" }]));
  const db = storage({ "growth-engine.strategy.v1": JSON.stringify(strategy) });
  const src = readScaleSources(db);
  a.ok(src.keyResults.length);
  a.equal(src.keyResults[0].targetValue, strategy.keyResults[0].targetValue);
  a.equal(src.objectives[0].id, strategy.objectives[0].id);
});
test("5A O System capacity safely reuses existing evidence", () => {
  const system = createSystemSeed();
  const db = storage({ "growth-engine.system.v1": JSON.stringify(system) });
  const src = readScaleSources(db);
  a.equal(
    src.processes.length,
    system.processes.filter((x) => x.status === "active").length,
  );
  a.ok(src.capacity.every((x) => x.health === null));
  a.ok(systemCapacitySignals(src).every((x) => x.risk));
});
test("5A P missing and corrupt sources do not crash", () => {
  a.deepEqual(readScaleSources(storage()).keyResults, []);
  const src = readScaleSources(storage({ "growth-engine.strategy.v1": "{" }));
  a.equal(src.activeCycle, null);
  a.equal(src.notices.length, 1);
});
test("5A Q readiness is preparation not performance; unknown adds no credit", () => {
  const s = seed();
  s.profile.businessModel = "";
  s.profile.growthGoal = "";
  s.diagnostics = s.diagnostics.map((d) => ({
    ...d,
    status: "unknown",
    evidence: "",
    managementObservation: "",
  }));
  s.primaryConstraintId = null;
  s.ideas = [];
  a.equal(l.scaleSetupReadiness(s, false).score, 0);
  s.metrics = Object.fromEntries(Object.keys(s.metrics).map((k) => [k, null]));
  a.equal(l.scaleDiagnosisCompleteness(s).percent, 0);
});
test("5A R archived primary clears; existing ready idea becomes review-needed", () => {
  const s = seed(),
    x = p.saveIdea(s, structured(s)),
    y = p.saveConstraint(x, { ...s.constraints[0], status: "archived" });
  a.equal(y.primaryConstraintId, null);
  a.equal(y.constraints.filter((c) => c.status === "active").length, 0);
  a.equal(l.ideaReadiness(y.ideas.at(-1), y).ready, false);
  a.ok(l.scaleNeedsAttention(y).some((x) => x.text.includes("آمادگی ایده")));
});
test("5A S roundtrip restores all links and status history", () => {
  const s = p.saveIdea(seed(), structured(seed()));
  const restored = p.parseScale(JSON.stringify(s));
  a.deepEqual(restored, s);
  a.equal(restored.ideas.at(-1).history.length, 1);
});
test("5A T Scale mutations leave external stores byte-identical", () => {
  const db = storage({
    "growth-engine.system.v1": "system-original",
    "growth-engine.strategy.v1": "strategy-original",
    "growth-engine.assessment.v2": "assessment-original",
  });
  p.persistScale(db, seed(), null);
  for (const [key, expected] of [
    ["system", "system-original"],
    ["strategy", "strategy-original"],
  ])
    a.equal(db.getItem(`growth-engine.${key}.v1`), expected);
  a.equal(db.getItem("growth-engine.assessment.v2"), "assessment-original");
});
test("5A future experiment/validated transitions rejected", () => {
  const s = seed(),
    i = structured(s);
  for (const status of ["experiment", "validated"])
    a.throws(() => p.saveIdea(s, { ...i, status }));
});
test("5A corrupt, duplicate, infinite and negative input rejected", () => {
  a.throws(() => p.parseScale("{"));
  for (const v of [-1, Infinity, NaN]) {
    const s = seed();
    s.metrics.leads = v;
    a.throws(() => p.validateScale(s));
  }
  const s = seed();
  s.diagnostics[1] = s.diagnostics[0];
  a.throws(() => p.validateScale(s));
});
test("5A compare-and-swap rejects stale writer and preserves current data", () => {
  const db = storage();
  const old = p.persistScale(db, seed(), null);
  db.setItem(m.SCALE_KEY, "changed-elsewhere");
  a.throws(() => p.persistScale(db, seed(), old));
  a.equal(db.getItem(m.SCALE_KEY), "changed-elsewhere");
});
test("5A quota failure never replaces prior value", () => {
  const db = storage({ [m.SCALE_KEY]: "original" });
  db.setItem = () => {
    throw Error("quota");
  };
  a.throws(() => p.persistScale(db, seed(), "original"));
  a.equal(db.getItem(m.SCALE_KEY), "original");
});
test("5A large inbox produces no capacity warning solely due to its size", () => {
  const s = seed();
  s.ideas = Array.from({ length: 200 }, (_, n) => ({
    ...m.newIdea(),
    title: "Inbox " + n,
  }));
  a.ok(!l.scaleNeedsAttention(s).some((x) => x.text.includes("زیاد")));
});
