const test = require("node:test");
const { updateFuture } = require("../.test-build/system/analysis/redesign.js");
const assert = require("node:assert/strict");
test("Moving future nodes keeps approval; changing content preserves a stale historical stamp", () => {
  const { sys, map } = setup();
  sys.processes.find((p) => p.id === map.processId).systemizationStage =
    "mapped";
  const reviewed = confirmAnalysis(sys, map, {
      processId: map.processId,
      toBe: cloneToBe(map),
    }),
    approved = confirmRedesign(reviewed.system, map, reviewed.record);
  const moved = structuredClone(approved.record.toBe);
  moved.steps[0].positionY += 100;
  assert.ok(updateFuture(approved.record, moved, sys).approval);
  moved.steps[1].waitTimeMinutes = 99;
  const changed = updateFuture(approved.record, moved, sys);
  assert.deepEqual(changed.approval, approved.record.approval);
  assert.equal(approvalCurrent(changed, map, sys), false);
});
const { createSystemSeed } = require("../.test-build/system/seed.js");
const { seedMaps } = require("../.test-build/system/maps/seed.js");
const { removeStep } = require("../.test-build/system/maps/model.js");
const {
  analyzeProcess,
  frictionScore,
  severity,
} = require("../.test-build/system/analysis/rules.js");
const {
  cloneToBe,
  compareMaps,
  redesignReadiness,
  confirmAnalysis,
  confirmRedesign,
  reviewCurrent,
  approvalCurrent,
  fingerprint,
} = require("../.test-build/system/analysis/redesign.js");
const {
  parseAnalysis,
  replaceRecord,
} = require("../.test-build/system/analysis/persistence.js");
const { parseMaps } = require("../.test-build/system/maps/persistence.js");
const {
  writeTogether,
} = require("../.test-build/system/storage-transaction.js");
function setup() {
  const sys = createSystemSeed(),
    map = seedMaps(sys).maps[0];
  return { sys, map };
}
test("Analysis A: highest waiting step ranks as bottleneck with explainable contributions", () => {
  const { sys, map } = setup(),
    a = analyzeProcess(map, sys);
  assert.equal(a.bottlenecks[0].step.id, "proposal-8");
  assert.ok(
    a.bottlenecks[0].parts.some((p) => p.label === "انتظار" && p.value === 1),
  );
});
test("Analysis B/F: founder operational step with wait is ranked and delegated", () => {
  const { sys, map } = setup(),
    a = analyzeProcess(map, sys);
  assert.ok(
    a.bottlenecks.some((b) => b.step.id === "proposal-6" && b.score >= 25),
  );
  assert.ok(
    a.findings.some(
      (f) => f.stepId === "proposal-6" && f.category === "delegate",
    ),
  );
  assert.equal(a.founder.wait, 240);
});
test("Analysis C: real owners yield handoffs and department transitions", () => {
  const { sys, map } = setup(),
    a = analyzeProcess(map, sys);
  assert.equal(a.metrics.handoffs, 6);
  assert.equal(a.handoffs.uniqueOwners, 3);
  assert.ok(a.handoffs.crossDepartment >= 2);
  assert.ok(a.handoffs.backAndForth >= 2);
});
test("Analysis D: rework >=50 produces findings, cycle traversal terminates", () => {
  const { sys, map } = setup(),
    a = analyzeProcess(map, sys);
  assert.ok(a.findings.some((f) => f.id === "proposal-10-rework"));
  assert.deepEqual(
    a.loops.sort(),
    ["proposal-8", "proposal-9", "proposal-10"].sort(),
  );
});
test("Analysis E: one outgoing decision branch is a conservative simplify candidate", () => {
  const { sys, map } = setup();
  map.connections = map.connections.filter(
    (e) =>
      !(e.sourceStepId === "proposal-5" && e.targetStepId === "proposal-7"),
  );
  assert.ok(
    analyzeProcess(map, sys).findings.some(
      (f) => f.id === "proposal-5-branch" && f.category === "simplify",
    ),
  );
});
test("Analysis G/H: cloning preserves identities and editing future does not mutate current", () => {
  const { map } = setup(),
    before = JSON.stringify(map),
    b = cloneToBe(map);
  assert.equal(b.variant, "to-be");
  assert.equal(b.steps[0].id, map.steps[0].id);
  b.steps[1].title = "new";
  b.connections[0].label = "new";
  assert.equal(JSON.stringify(map), before);
});
test("Analysis I: removed step and incident connections appear only in future diff", () => {
  const { sys, map } = setup(),
    b = removeStep(cloneToBe(map), "proposal-6"),
    c = compareMaps(map, b, sys);
  assert.equal(c.removed.length, 1);
  assert.equal(c.rows.find((r) => r.key === "steps").difference, -1);
  assert.equal(map.steps.length, 13);
});
test("Analysis J/K: owner reassignment removes detected founder dependency and waiting reductions compare correctly", () => {
  const { sys, map } = setup(),
    b = cloneToBe(map),
    s = b.steps.find((s) => s.id === "proposal-6");
  s.ownerRoleId = "r1";
  s.waitTimeMinutes = 0;
  const c = compareMaps(map, b, sys);
  assert.equal(c.rows.find((r) => r.key === "founder").difference, -1);
  assert.equal(c.rows.find((r) => r.key === "wait").difference, -240);
  assert.equal(c.rows.find((r) => r.key === "cycle").difference, -240);
});
test("Analysis L/M: valid design ready; missing time, owner, end or branch blocks readiness", () => {
  const { sys, map } = setup();
  assert.equal(redesignReadiness(cloneToBe(map), sys).ready, true);
  for (const mutate of [
    (b) => (b.steps.find((s) => s.type === "action").waitTimeMinutes = null),
    (b) => (b.steps.find((s) => s.type === "action").ownerRoleId = undefined),
    (b) => (b.steps = b.steps.filter((s) => s.type !== "end")),
    (b) =>
      (b.connections = b.connections.filter(
        (e) => e.sourceStepId !== "proposal-5",
      )),
  ]) {
    const b = cloneToBe(map);
    mutate(b);
    assert.equal(redesignReadiness(b, sys).ready, false);
  }
});
test("Analysis N/O/P: explicit review and approval advance stages and restore timestamps", () => {
  const { sys, map } = setup();
  sys.processes.find((p) => p.id === map.processId).systemizationStage =
    "mapped";
  const record = { processId: map.processId, toBe: cloneToBe(map) };
  const reviewed = confirmAnalysis(sys, map, record);
  assert.equal(
    reviewed.system.processes.find((p) => p.id === map.processId)
      .systemizationStage,
    "analyzed",
  );
  assert.equal(
    sys.processes.find((p) => p.id === map.processId).systemizationStage,
    "mapped",
  );
  const approved = confirmRedesign(reviewed.system, map, reviewed.record);
  assert.equal(
    approved.system.processes.find((p) => p.id === map.processId)
      .systemizationStage,
    "redesigned",
  );
  const restored = parseAnalysis(
    JSON.stringify({ version: 1, records: [approved.record] }),
  );
  assert.equal(
    approvalCurrent(restored.records[0], map, approved.system),
    true,
  );
  assert.ok(restored.records[0].approval.at);
});
test("Review and approval require correct stages and cannot skip confirmation", () => {
  const { sys, map } = setup(),
    r = { processId: map.processId, toBe: cloneToBe(map) };
  assert.throws(() => confirmAnalysis(sys, map, r));
  sys.processes.find((p) => p.id === map.processId).systemizationStage =
    "mapped";
  assert.throws(() => confirmRedesign(sys, map, r));
});
test("Editing content or organization invalidates prior confirmation, moving canvas does not", () => {
  const { sys, map } = setup();
  sys.processes.find((p) => p.id === map.processId).systemizationStage =
    "mapped";
  const reviewed = confirmAnalysis(sys, map, {
    processId: map.processId,
    toBe: cloneToBe(map),
  });
  assert.ok(reviewCurrent(reviewed.record, map, sys));
  const moved = structuredClone(map);
  moved.steps[0].positionX += 100;
  assert.equal(fingerprint(map, sys), fingerprint(moved, sys));
  moved.steps[1].waitTimeMinutes = 3;
  assert.equal(reviewCurrent(reviewed.record, moved, sys), false);
  sys.roles.find((r) => r.id === "r1").isFounderRole = true;
  assert.equal(reviewCurrent(reviewed.record, map, sys), false);
});
test("Zero baselines and incomplete data never fabricate percent savings", () => {
  const { sys, map } = setup();
  for (const s of map.steps) {
    s.workTimeMinutes = 0;
    s.waitTimeMinutes = 0;
  }
  const b = cloneToBe(map);
  b.steps[1].waitTimeMinutes = 60;
  const c = compareMaps(map, b, sys);
  assert.equal(c.rows.find((r) => r.key === "cycle").percent, null);
  assert.ok(c.warnings.length);
  b.steps[1].waitTimeMinutes = null;
  assert.ok(
    compareMaps(map, b, sys).warnings.some((w) => w.includes("ثبت‌نشده")),
  );
});
test("Friction components bounded, sum weights 100 and severity boundaries exact", () => {
  const { sys, map } = setup(),
    f = frictionScore(map, sys);
  assert.equal(
    f.components.reduce((n, c) => n + c.weight, 0),
    100,
  );
  assert.ok(f.score >= 0 && f.score <= 100);
  assert.ok(f.components.every((c) => c.value >= 0 && c.value <= 1));
  assert.deepEqual([0, 24, 25, 49, 50, 74, 75, 100].map(severity), [
    "کم",
    "کم",
    "متوسط",
    "متوسط",
    "زیاد",
    "زیاد",
    "بحرانی",
    "بحرانی",
  ]);
});
test("Automation requires recorded input/output and low rework; duplicate elimination is evidence based", () => {
  const { sys, map } = setup(),
    s = map.steps.find((s) => s.id === "proposal-3");
  sys.processes.find((p) => p.id === map.processId).frequency = 3;
  s.input = "request";
  s.output = "proposal";
  assert.ok(
    analyzeProcess(map, sys).findings.some(
      (f) => f.id === s.id + "-automation",
    ),
  );
  s.reworkProbability = 75;
  assert.ok(
    !analyzeProcess(map, sys).findings.some(
      (f) => f.id === s.id + "-automation",
    ),
  );
  map.steps.push({ ...s, id: "zz-duplicate" });
  assert.ok(
    analyzeProcess(map, sys).findings.some((f) => f.category === "eliminate"),
  );
});
test("Analysis persistence rejects wrong variants, cross-process maps and malformed stamps; old AS-IS loads", () => {
  const { map } = setup();
  assert.doesNotThrow(() =>
    parseMaps(JSON.stringify({ version: 1, maps: [map] })),
  );
  assert.throws(() =>
    parseAnalysis(
      JSON.stringify({
        version: 1,
        records: [{ processId: map.processId, toBe: map }],
      }),
    ),
  );
  assert.throws(() =>
    parseAnalysis(
      JSON.stringify({
        version: 1,
        records: [{ processId: "other", toBe: cloneToBe(map) }],
      }),
    ),
  );
  assert.throws(() =>
    parseAnalysis(
      JSON.stringify({
        version: 1,
        records: [
          {
            processId: map.processId,
            approval: { at: "bad", fingerprint: "x" },
          },
        ],
      }),
    ),
  );
});
test("Independent process records are preserved when one future map is updated", () => {
  const { map } = setup();
  let store = replaceRecord(
    { version: 1, records: [] },
    { processId: "p6", toBe: cloneToBe(map) },
  );
  store = replaceRecord(store, { processId: "p2" });
  assert.equal(store.records.length, 2);
  assert.equal(
    store.records.find((r) => r.processId === "p6").toBe.steps.length,
    13,
  );
});
test("Companion stage storage rolls back first write when second fails and rejects stale snapshots", () => {
  const values = new Map([
    ["system", "old"],
    ["analysis", "old-a"],
  ]);
  const storage = {
    getItem: (k) => values.get(k) ?? null,
    setItem: (k, v) => {
      if (k === "analysis" && v === "new-a") throw new Error("quota");
      values.set(k, v);
    },
    removeItem: (k) => values.delete(k),
  };
  assert.throws(() =>
    writeTogether(storage, [
      { key: "system", expected: "old", value: "new" },
      { key: "analysis", expected: "old-a", value: "new-a" },
    ]),
  );
  assert.equal(values.get("system"), "old");
  assert.throws(() =>
    writeTogether(storage, [
      { key: "system", expected: "stale", value: "new" },
    ]),
  );
});
