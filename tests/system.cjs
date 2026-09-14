const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createSystemSeed } = require("../.test-build/system/seed.js");
const { calculatePriority } = require("../.test-build/system/scoring.js");
const {
  parseSystem,
  validateSystem,
  SYSTEM_STORAGE_KEY,
} = require("../.test-build/system/persistence.js");
const {
  saveEntity,
  deleteEntity,
  changeStage,
  nextProcessCode,
} = require("../.test-build/system/actions.js");
const {
  ownerOf,
  effectiveFounder,
  founderBottlenecks,
  systemMetrics,
  ownershipCounts,
  departmentRiskCounts,
  missingOwners,
  selectProcesses,
  emptyFilters,
  organizationNodes,
} = require("../.test-build/system/selectors.js");
const { stageKeys } = require("../.test-build/system/config.js");
test("System priority: all 81 combinations, boundaries, and invalid inputs", () => {
  for (let a = 1; a <= 3; a++)
    for (let b = 1; b <= 3; b++)
      for (let c = 1; c <= 3; c++)
        for (let d = 1; d <= 3; d++) {
          const r = calculatePriority({
            impact: a,
            variation: b,
            dependency: c,
            frequency: d,
          });
          const sum = a + b + c + d;
          assert.equal(r.priorityScore, sum);
          assert.equal(
            r.priorityLevel,
            sum >= 10
              ? "critical"
              : sum >= 8
                ? "high"
                : sum >= 6
                  ? "medium"
                  : "low",
          );
        }
  for (const bad of [0, 4, 1.5, "2", NaN])
    assert.throws(() =>
      calculatePriority({
        impact: bad,
        variation: 1,
        dependency: 1,
        frequency: 1,
      }),
    );
});
test("System seed: relationships valid and 15 processes span all eight stages", () => {
  const d = validateSystem(createSystemSeed());
  assert.equal(d.processes.length, 15);
  assert.equal(d.departments.length, 6);
  assert.deepEqual(
    new Set(d.processes.map((p) => p.systemizationStage)),
    new Set(stageKeys),
  );
  assert.ok(d.processes.every((p) => ownerOf(d, p).role));
});
test("A/B/C: create department, role, person, process; resolve owner; restore", () => {
  let d = createSystemSeed();
  d = saveEntity(d, "departments", {
    id: "new-dep",
    name: "New Department",
    description: "",
    status: "active",
    parentDepartmentId: "d0",
  });
  d = saveEntity(d, "people", {
    id: "new-person",
    name: "New Person",
    jobTitle: "Lead",
    status: "active",
  });
  d = saveEntity(d, "roles", {
    id: "new-role",
    title: "New Role",
    departmentId: "new-dep",
    personId: "new-person",
    reportsToRoleId: "r0",
    purpose: "Lead",
    responsibilities: [],
    isKeyRole: true,
    isFounderRole: false,
  });
  d = saveEntity(d, "processes", {
    ...d.processes[0],
    id: "new-process",
    code: nextProcessCode(d),
    departmentId: "new-dep",
    ownerRoleId: "new-role",
  });
  const restored = parseSystem(JSON.stringify(d));
  assert.deepEqual(restored, JSON.parse(JSON.stringify(d)));
  const owner = ownerOf(restored, restored.processes.at(-1));
  assert.equal(owner.role.id, "new-role");
  assert.equal(owner.person.name, "New Person");
  const n = organizationNodes(restored).find((x) => x.entityId === "new-role");
  assert.equal(n.parentId, "role-r0");
  assert.ok(SYSTEM_STORAGE_KEY.includes("system"));
});
test("D: save recalculates priority instead of accepting cached values", () => {
  const d = createSystemSeed();
  const p = {
    ...d.processes[0],
    impact: 1,
    variation: 1,
    dependency: 1,
    frequency: 1,
    priorityScore: 12,
    priorityLevel: "critical",
  };
  const next = saveEntity(d, "processes", p);
  assert.equal(next.processes[0].priorityScore, 4);
  assert.equal(next.processes[0].priorityLevel, "low");
  assert.equal(d.processes[0].priorityScore, 10);
});
test("E: founder role makes dependency critical, including multiple processes", () => {
  let d = createSystemSeed();
  d.processes.slice(0, 3).forEach((p) => {
    p.ownerRoleId = "r0";
    p.founderDependency = "none";
  });
  d = validateSystem(d);
  assert.equal(effectiveFounder(d, d.processes[0]), "critical");
  assert.ok(founderBottlenecks(d).length >= 3);
  d.processes[0].status = "archived";
  assert.ok(!founderBottlenecks(d).some((p) => p.id === d.processes[0].id));
});
test("F: ownership concentration and department counts derive from active processes", () => {
  const d = createSystemSeed();
  const sales = ownershipCounts(d).find((x) => x.role.id === "r1");
  assert.equal(sales.total, 5);
  assert.equal(sales.critical, 4);
  assert.equal(departmentRiskCounts(d)[0].department.id, "d1");
  assert.equal(departmentRiskCounts(d)[0].critical, 4);
});
test("G: owner-less process appears in missing-owner filter and insight", () => {
  let d = createSystemSeed();
  d = saveEntity(d, "processes", { ...d.processes[0], ownerRoleId: "" });
  assert.equal(missingOwners(d).length, 1);
  assert.equal(
    selectProcesses(d, { ...emptyFilters, owner: "__missing" })[0].id,
    d.processes[0].id,
  );
});
test("Owner coverage excludes vacancies and inactive people", () => {
  const d = createSystemSeed();
  assert.equal(systemMetrics(d).ownerCoverage, 93);
  d.people[1].status = "archived";
  assert.equal(systemMetrics(d).ownerCoverage, 60);
  d.processes = [];
  assert.equal(systemMetrics(d).ownerCoverage, 0);
});
test("Persistence rejects malformed data, dangling links, enum names and duplicates", () => {
  assert.throws(() => parseSystem("{bad"));
  assert.throws(() => parseSystem('{"version":2}'));
  for (const mutate of [
    (d) => (d.roles[0].departmentId = "missing"),
    (d) => (d.roles[0].personId = "missing"),
    (d) => (d.processes[0].ownerRoleId = "missing"),
    (d) => (d.processes[0].systemizationStage = "toString"),
    (d) => (d.processes[0].founderDependency = "invalid"),
    (d) => (d.processes[0].frequency = 4),
    (d) => (d.processes[1].code = d.processes[0].code),
    (d) => d.roles.push({ ...d.roles[0] }),
    (d) => (d.people[0].name = ""),
    (d) => (d.departments[0].managerRoleId = "missing"),
  ]) {
    const d = createSystemSeed();
    mutate(d);
    assert.throws(() => parseSystem(JSON.stringify(d)));
  }
});
test("Cycles in role reporting and department parents are rejected", () => {
  let d = createSystemSeed();
  d.roles[0].reportsToRoleId = "r1";
  assert.throws(() => validateSystem(d));
  d = createSystemSeed();
  d.departments[0].parentDepartmentId = "d1";
  assert.throws(() => validateSystem(d));
});
test("Stage actions persist and affect pipeline counts without changing score", () => {
  const d = createSystemSeed();
  const before = systemMetrics(d).stages.find(
    (s) => s.stage === "improving",
  ).count;
  const next = changeStage(d, "p1", "improving");
  assert.equal(
    systemMetrics(next).stages.find((s) => s.stage === "improving").count,
    before + 1,
  );
  assert.equal(next.processes[0].priorityScore, d.processes[0].priorityScore);
  assert.equal(
    parseSystem(JSON.stringify(next)).processes[0].systemizationStage,
    "improving",
  );
  assert.throws(() => changeStage(d, "missing", "mapped"));
  assert.throws(() => changeStage(d, "p1", "unknown"));
});
test("Search, sorting, combined filters and founder insight filter", () => {
  const d = createSystemSeed();
  assert.equal(
    selectProcesses(d, { ...emptyFilters, search: "P006" })[0].id,
    "p6",
  );
  const rows = selectProcesses(d, {
    ...emptyFilters,
    department: "d1",
    priority: "critical",
  });
  assert.equal(rows.length, 4);
  assert.ok(rows.every((p) => p.departmentId === "d1"));
  assert.deepEqual(
    new Set(
      selectProcesses(d, { ...emptyFilters, bottleneck: true }).map(
        (p) => p.id,
      ),
    ),
    new Set(founderBottlenecks(d).map((p) => p.id)),
  );
  const sorted = selectProcesses(d, emptyFilters);
  assert.equal(sorted[0].priorityScore, 12);
});
test("Referenced records cannot be deleted; independent process can be deleted", () => {
  const d = createSystemSeed();
  assert.throws(() => deleteEntity(d, "roles", "r1"));
  assert.throws(() => deleteEntity(d, "people", "u0"));
  assert.throws(() => deleteEntity(d, "departments", "d1"));
  assert.equal(deleteEntity(d, "processes", "p1").processes.length, 14);
});
test("Archiving a department preserves relationships; empty data remains valid", () => {
  const d = createSystemSeed();
  const next = saveEntity(d, "departments", {
    ...d.departments[1],
    status: "archived",
  });
  assert.equal(next.processes.length, 15);
  assert.ok(ownerOf(next, next.processes[1]).role);
  assert.deepEqual(
    parseSystem(
      JSON.stringify({
        version: 1,
        departments: [],
        roles: [],
        people: [],
        processes: [],
      }),
    ).roles,
    [],
  );
});
