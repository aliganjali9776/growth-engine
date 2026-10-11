const { test } = require("node:test");
const assert = require("node:assert/strict");
const m = require("../.test-build/strategy/model.js");
const { seedStrategy } = require("../.test-build/strategy/seed.js");
const {
  strategyReport,
  objectiveQuality,
} = require("../.test-build/strategy/report.js");
const roles = [{ id: "r1", title: "مدیر رشد" }],
  seed = () => seedStrategy(roles),
  round = (s) => m.parseStrategy(JSON.stringify(s));
test("4A persistence writes only Strategy and rejects stale/quota failures", () => {
  const {
    writeTogether,
  } = require("../.test-build/system/storage-transaction.js");
  const values = new Map([["growth-engine.system.v1", "unchanged system"]]);
  const storage = {
    getItem: (k) => values.get(k) ?? null,
    setItem: (k, v) => values.set(k, v),
    removeItem: (k) => values.delete(k),
  };
  const raw = JSON.stringify(seed());
  writeTogether(storage, [{ key: m.STRATEGY_KEY, expected: null, value: raw }]);
  assert.deepEqual(m.parseStrategy(storage.getItem(m.STRATEGY_KEY)), seed());
  assert.equal(values.get("growth-engine.system.v1"), "unchanged system");
  assert.throws(() =>
    writeTogether(storage, [
      { key: m.STRATEGY_KEY, expected: null, value: "stale" },
    ]),
  );
  assert.throws(() =>
    writeTogether(
      {
        ...storage,
        setItem: () => {
          throw Error("QuotaExceededError");
        },
      },
      [
        {
          key: m.STRATEGY_KEY,
          expected: raw,
          value: JSON.stringify(m.emptyStrategy()),
        },
      ],
    ),
  );
  assert.equal(storage.getItem(m.STRATEGY_KEY), raw);
});
test("4A A: create valid cycle and reject inverted dates", () => {
  const s = seed(),
    c = { ...s.cycles[0], id: "new", status: "draft" };
  assert.equal(m.saveCycle(s, c).cycles.length, 2);
  assert.throws(() => m.saveCycle(s, { ...c, startDate: "2027-01-01" }));
});
test("4A B: second activation requires confirmation and preserves prior history", () => {
  const s = seed(),
    c = { ...s.cycles[0], id: "new" };
  assert.throws(() => m.saveCycle(s, c));
  const n = m.saveCycle(s, c, true);
  assert.equal(n.cycles.filter((c) => c.status === "active").length, 1);
  assert.equal(n.cycles[0].status, "review");
  assert.deepEqual(n.objectives, s.objectives);
});
test("4A C: all context fields survive persistence", () => {
  const s = seed();
  s.contexts[0].notes = "یادداشت مدیریت";
  assert.deepEqual(round(s).contexts, s.contexts);
});
test("4A D: three selected priorities have no focus-count warning", () => {
  const r = strategyReport(seed(), roles);
  assert.equal(r.selected.length, 3);
  assert.ok(!r.findings.some((f) => f.id === "focus"));
});
test("4A E: six selected priorities warn without blocking", () => {
  const s = seed();
  s.priorities.push(
    ...s.priorities.map((p) => ({ ...p, id: p.id + "x", rank: p.rank + 3 })),
  );
  assert.equal(round(s).priorities.length, 6);
  assert.ok(strategyReport(s, roles).findings.some((f) => f.id === "focus"));
});
test("4A F: ranking reorders deterministically and persists", () => {
  const s = seed(),
    n = m.reorderPriority(s, s.priorities[1].id, -1);
  assert.equal(
    round(n).priorities.find((p) => p.id === s.priorities[1].id).rank,
    1,
  );
  assert.equal(s.priorities[1].rank, 2);
});
test("4A G: focus and not-now are independent persisted choices", () => {
  const s = round(seed());
  assert.equal(s.choices.filter((c) => c.type === "notNow").length, 1);
  assert.equal(strategyReport({ ...s, choices: [] }, roles).parts[4].value, 0);
});
test("4A H: objective canonical priority link and active guard", () => {
  const s = seed(),
    o = { ...s.objectives[0], status: "active" };
  assert.equal(
    m.saveObjective(s, o, roles).objectives.find((x) => x.id === o.id)
      .relatedPriorityId,
    s.priorities[0].id,
  );
  assert.throws(() =>
    m.saveObjective(s, { ...o, relatedPriorityId: "" }, roles),
  );
});
test("4A I: missing owner warning for stale active records and activation guard", () => {
  const s = seed();
  s.objectives[0].status = "active";
  s.objectives[0].ownerRoleId = "gone";
  assert.ok(
    strategyReport(s, roles).findings.some((f) => f.id.startsWith("owner-")),
  );
  assert.throws(() => m.saveObjective(s, s.objectives[0], roles));
});
test("4A J: missing priority warns; draft remains editable", () => {
  const s = seed();
  s.objectives[0].relatedPriorityId = "";
  s.objectives[0].status = "active";
  assert.ok(
    strategyReport(s, roles).findings.some((f) => f.id.startsWith("align-")),
  );
  assert.ok(
    objectiveQuality(s.objectives[0], s.cycles[0], s, roles).warnings.some(
      (w) => w.includes("هیچ اولویت"),
    ),
  );
});
test("4A K: objective beyond cycle dates warns but does not destroy data", () => {
  const s = seed();
  s.objectives[0].deadline = "2027-01-01";
  assert.ok(
    strategyReport(round(s), roles).findings.some((f) =>
      f.id.startsWith("date-"),
    ),
  );
});
test("4A L: readiness is explicit eight-component 100 point setup measure", () => {
  const r = strategyReport(seed(), roles);
  assert.equal(r.score, 100);
  assert.equal(
    r.parts.reduce((a, p) => a + p.weight, 0),
    100,
  );
  assert.equal(r.parts.length, 8);
  const s = seed();
  s.objectives = [];
  assert.equal(strategyReport(s, roles).score, 70);
});
test("4A M: missing data creates no performance or fake progress", () => {
  const r = strategyReport(m.emptyStrategy(), []);
  assert.equal(r.score, 0);
  assert.equal(r.days, null);
  assert.ok(!("progress" in r));
  for (const o of seed().objectives) {
    assert.equal(o.progress, undefined);
    assert.equal(o.health, undefined);
  }
});
test("4A N: System role IDs resolve live without duplicated roles", () => {
  assert.equal(m.roleName("r1", roles), "مدیر رشد");
  assert.equal(
    m.roleName("r1", [{ id: "r1", title: "مدیر جدید" }]),
    "مدیر جدید",
  );
  assert.match(m.roleName("gone", roles), /موجود نیست/);
  assert.ok(!("roles" in seed()));
});
test("4A O: reload preserves all records and valid empty stores stay empty", () => {
  assert.deepEqual(round(seed()), seed());
  assert.deepEqual(round(m.emptyStrategy()), m.emptyStrategy());
});
test("4A P: archive retains context, priorities, objectives and closed timestamp", () => {
  const s = seed(),
    c = { ...s.cycles[0], status: "archived" };
  const n = round(m.saveCycle(s, c));
  assert.ok(n.cycles[0].closedAt);
  assert.deepEqual(n.objectives, s.objectives);
  assert.deepEqual(n.contexts, s.contexts);
  assert.equal(strategyReport(n, roles).cycle, undefined);
});
test("4A corrupt/version/duplicate/reference/date validation fails safely", () => {
  assert.throws(() => m.parseStrategy("{invalid"));
  for (const mutate of [
    (s) => (s.version = 2),
    (s) => s.cycles.push({ ...s.cycles[0] }),
    (s) => (s.objectives[0].relatedPriorityId = "missing"),
    (s) => (s.cycles[0].startDate = "2026-02-30"),
    (s) => (s.priorities[0].rank = NaN),
    (s) => (s.objectives[1].code = s.objectives[0].code),
  ]) {
    const s = seed();
    mutate(s);
    assert.throws(() => m.validateStrategy(s));
  }
});
test("4A cross-cycle priority links are rejected", () => {
  const s = seed();
  s.cycles.push({ ...s.cycles[0], id: "second", status: "draft" });
  s.objectives[0].cycleId = "second";
  assert.throws(() => round(s));
});
test("4A custom direction requires descriptive label", () => {
  const s = seed();
  s.priorities[0].direction = "custom";
  assert.throws(() => round(s));
  s.priorities[0].customDirection = "رهبری بازار تخصصی";
  assert.ok(round(s));
});
test("4A quality checks distinguish activity, number and meaningful outcome", () => {
  const s = seed(),
    o = s.objectives[0],
    c = s.cycles[0];
  assert.equal(
    objectiveQuality(
      { ...o, title: "ساخت یک موتور رشد قابل تکرار" },
      c,
      s,
      roles,
    ).label,
    "قوی",
  );
  assert.ok(
    objectiveQuality(
      { ...o, title: "استخدام فروشنده" },
      c,
      s,
      roles,
    ).warnings.some((w) => w.includes("فعالیت")),
  );
  assert.ok(
    objectiveQuality(
      { ...o, title: "افزایش فروش به ۳ میلیارد" },
      c,
      s,
      roles,
    ).warnings.some((w) => w.includes("عدد")),
  );
});
test("4A deleted role reduces readiness and selected priority changes alignment live", () => {
  const s = seed();
  assert.equal(strategyReport(s, []).score, 90);
  s.priorities[0].status = "deprioritized";
  assert.equal(strategyReport(s, roles).unaligned, 1);
});
test("4A more than five objectives warns and cancellation preserves history", () => {
  const s = seed();
  s.objectives.push(
    ...s.objectives.map((o) => ({ ...o, id: o.id + "x", code: o.code + "x" })),
  );
  assert.ok(strategyReport(s, roles).findings.some((f) => f.id === "count"));
  s.objectives.forEach((o) => (o.status = "cancelled"));
  assert.equal(strategyReport(round(s), roles).objectives.length, 0);
  assert.equal(s.objectives.length, 6);
});
test("4A duplicate ranking and absent not-now are visible findings", () => {
  const s = seed();
  s.priorities[1].rank = 1;
  s.choices = s.choices.filter((c) => c.type !== "notNow");
  const r = strategyReport(s, roles);
  assert.ok(r.findings.some((f) => f.id === "rank"));
  assert.ok(r.findings.some((f) => f.id === "notNow"));
});
test("4A days remaining uses injected date and never negative", () => {
  assert.equal(strategyReport(seed(), roles, undefined, "2026-11-20").days, 1);
  assert.equal(strategyReport(seed(), roles, undefined, "2027-01-01").days, 0);
});
