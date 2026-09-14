const test = require("node:test");
const assert = require("node:assert/strict");
const { createSystemSeed } = require("../.test-build/system/seed.js");
const {
  emptyMap,
  newStep,
  connect,
  removeStep,
} = require("../.test-build/system/maps/model.js");
const {
  mapMetrics,
  mapWarnings,
  mapCompleteness,
  stepOwner,
  founderStep,
  isHandoff,
} = require("../.test-build/system/maps/logic.js");
const {
  parseMaps,
  validateMaps,
  replaceMap,
} = require("../.test-build/system/maps/persistence.js");
const { autoLayout } = require("../.test-build/system/maps/layout.js");
const { seedMaps } = require("../.test-build/system/maps/seed.js");
function fixture() {
  const map = emptyMap("p1");
  map.steps = ["start", "action", "end"].map((type, i) => ({
    ...newStep("p1", `s${i}`),
    title: `Step ${i}`,
    type,
    ownerRoleId: type === "action" ? "r1" : undefined,
    workTimeMinutes: 0,
    waitTimeMinutes: 0,
  }));
  return connect(connect(map, edge("s0", "s1")), edge("s1", "s2"));
}
function edge(a, b) {
  return {
    id: `${a}-${b}`,
    processId: "p1",
    sourceStepId: a,
    targetStepId: b,
    label: "",
    condition: "",
    type: "sequence",
  };
}
test("Map A: creating steps and real connections, invalid and duplicate edges rejected", () => {
  const m = fixture();
  assert.equal(m.connections.length, 2);
  assert.throws(() => connect(m, edge("s0", "missing")));
  assert.throws(() => connect(m, edge("s0", "s0")));
  assert.throws(() => connect(m, edge("s0", "s1")));
});
test("Map B/C: role and person resolve from current organization, never cached", () => {
  const sys = createSystemSeed(),
    s = fixture().steps[1];
  assert.equal(stepOwner(sys, s).role.id, "r1");
  assert.ok(stepOwner(sys, s).person);
  sys.roles.find((r) => r.id === "r1").personId = undefined;
  assert.equal(stepOwner(sys, s).person, undefined);
});
test("Map D: work, wait, cycle and waiting ratio update and zero remains finite", () => {
  const m = fixture(),
    sys = createSystemSeed();
  assert.equal(mapMetrics(m, sys).waitingRatio, 0);
  m.steps[1].workTimeMinutes = 15;
  m.steps[1].waitTimeMinutes = 45;
  assert.deepEqual(
    [
      mapMetrics(m, sys).work,
      mapMetrics(m, sys).wait,
      mapMetrics(m, sys).cycle,
      mapMetrics(m, sys).waitingRatio,
    ],
    [15, 45, 60, 75],
  );
});
test("Map E: owner changes are handoffs; explicit handoffs are not double counted", () => {
  const m = fixture(),
    sys = createSystemSeed();
  m.steps[0].ownerRoleId = "r0";
  m.steps[1].handoff = true;
  assert.equal(isHandoff(m, m.connections[0]), true);
  assert.equal(mapMetrics(m, sys).handoffs, 1);
  m.steps[0].ownerRoleId = "r1";
  assert.equal(mapMetrics(m, sys).handoffs, 1);
  m.steps[1].handoff = false;
  assert.equal(mapMetrics(m, sys).handoffs, 0);
});
test("Map F: founder role is detected without mutating explicit dependency", () => {
  const m = fixture(),
    sys = createSystemSeed();
  m.steps[1].ownerRoleId = "r0";
  assert.equal(founderStep(sys, m.steps[1]), true);
  assert.equal(m.steps[1].founderDependency, "none");
  assert.equal(mapMetrics(m, sys).founder, 1);
});
test("Map G: decision with one branch warns and prevents mapped readiness", () => {
  const m = fixture();
  m.steps[1].type = "decision";
  assert.ok(
    mapWarnings(m, createSystemSeed()).some((w) => w.code === "decision"),
  );
  assert.equal(mapCompleteness(m, createSystemSeed()).ready, false);
});
test("Map H: isolated node and incoming/outgoing paths are identified", () => {
  const m = fixture();
  m.steps.push(newStep("p1", "island"));
  const warnings = mapWarnings(m, createSystemSeed());
  for (const code of ["islands", "disconnected", "incoming", "outgoing"])
    assert.ok(warnings.some((w) => w.code === code));
  assert.equal(mapCompleteness(m, createSystemSeed()).ready, false);
});
test("Map I/J: refresh keeps positions, labels, metadata and separates processes", () => {
  const a = fixture(),
    b = emptyMap("p2");
  a.steps[1].positionX = -45;
  a.connections[0].label = "approved";
  b.steps = [newStep("p2", "b")];
  const store = replaceMap(replaceMap({ version: 1, maps: [] }, a), b);
  const restored = parseMaps(JSON.stringify(store));
  assert.equal(restored.maps.length, 2);
  assert.equal(
    restored.maps.find((m) => m.processId === "p1").steps[1].positionX,
    -45,
  );
  assert.equal(
    restored.maps.find((m) => m.processId === "p2").steps[0].id,
    "b",
  );
  assert.deepEqual(restored, JSON.parse(JSON.stringify(store)));
});
test("Map K: meaningful directed map with at least 80% role coverage is ready, no stage mutation", () => {
  const sys = createSystemSeed(),
    m = fixture(),
    before = JSON.stringify(sys);
  assert.equal(mapCompleteness(m, sys).ready, true);
  m.steps[1].ownerRoleId = undefined;
  assert.equal(mapCompleteness(m, sys).ready, false);
  assert.equal(JSON.stringify(sys), before);
});
test("Map L: deleting a step removes all incident connections and preserves other nodes", () => {
  const m = removeStep(fixture(), "s1");
  assert.equal(m.connections.length, 0);
  assert.equal(m.steps.length, 2);
  assert.doesNotThrow(() => validateMaps({ version: 1, maps: [m] }));
});
test("Map persistence rejects malformed values and cross-process/dangling connections", () => {
  assert.throws(() => parseMaps("{"));
  for (const mutate of [
    (m) => (m.steps[0].workTimeMinutes = -1),
    (m) => (m.steps[0].positionX = Infinity),
    (m) => (m.steps[0].waitTimeMinutes = undefined),
    (m) => (m.steps[0].type = "constructor"),
    (m) => (m.steps[0].reworkProbability = 33),
    (m) => (m.steps[0].processId = "other"),
    (m) => (m.connections[0].targetStepId = "missing"),
    (m) => m.steps.push({ ...m.steps[0] }),
    (m) => m.connections.push({ ...m.connections[0], id: "dup" }),
    (m) => (m.variant = "to-be"),
  ]) {
    const m = fixture();
    mutate(m);
    assert.throws(() => validateMaps({ version: 1, maps: [m] }));
  }
});
test("Map completeness distinguishes absent timing from explicit zero", () => {
  const m = fixture(),
    sys = createSystemSeed();
  assert.equal(mapCompleteness(m, sys).time, 100);
  m.steps[1].waitTimeMinutes = null;
  assert.equal(mapCompleteness(m, sys).time, 0);
  assert.ok(mapWarnings(m, sys).some((w) => w.code === "time"));
});
test("Directed readiness rejects a reversed path despite weak connectivity", () => {
  const m = fixture();
  m.connections[1] = {
    ...m.connections[1],
    sourceStepId: "s2",
    targetStepId: "s1",
  };
  assert.equal(mapCompleteness(m, createSystemSeed()).ready, false);
});
test("Layout is deterministic, non-overlapping, preserves content and handles rework cycles", () => {
  const sys = createSystemSeed(),
    m = seedMaps(sys).maps[0];
  for (const dir of ["RL", "TB"]) {
    const a = autoLayout(m, dir),
      b = autoLayout(m, dir);
    assert.deepEqual(a, b);
    assert.equal(
      new Set(a.steps.map((s) => `${s.positionX},${s.positionY}`)).size,
      a.steps.length,
    );
    assert.deepEqual(a.connections, m.connections);
    assert.ok(
      a.steps.every(
        (s) => Number.isFinite(s.positionX) && Number.isFinite(s.positionY),
      ),
    );
  }
  assert.equal(autoLayout(emptyMap("p1")).steps.length, 0);
});
test("Realistic proposal seed has branches, waiting, founder insight, rework and handoffs", () => {
  const sys = createSystemSeed(),
    m = seedMaps(sys).maps[0],
    metrics = mapMetrics(m, sys);
  assert.ok(metrics.steps >= 10);
  assert.ok(metrics.decisions >= 2);
  assert.ok(metrics.founder >= 1);
  assert.ok(metrics.wait > metrics.work);
  assert.ok(metrics.handoffs > 0);
  assert.ok(metrics.highRework > 0);
  assert.equal(mapCompleteness(m, sys).ready, true);
  assert.doesNotThrow(() => validateMaps({ version: 1, maps: [m] }));
});
test("Missing organization reference is surfaced instead of assigning another owner", () => {
  const m = fixture(),
    sys = createSystemSeed();
  m.steps[1].ownerRoleId = "deleted";
  assert.equal(stepOwner(sys, m.steps[1]).role, undefined);
  assert.ok(mapWarnings(m, sys).some((w) => w.code === "owner"));
  assert.equal(mapCompleteness(m, sys).ready, false);
});
