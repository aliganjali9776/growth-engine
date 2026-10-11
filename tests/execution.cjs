const { test } = require("node:test"),
  assert = require("node:assert/strict");
const {
  fixture,
  prep,
  ready,
  E,
  P,
  C,
  Caps,
  EM,
} = require("./execution-fixture.cjs");
const X = require("../.test-build/agent/agent/execution/engine.js"),
  S = require("../.test-build/agent/execution-storage.js"),
  R = require("../.test-build/agent/agent/execution/registry.js");
function setup(type = "GrowthIdea") {
  const f = fixture();
  const a = ready(f, type);
  const edits = {};
  if (type === "GrowthIdea") edits.successMetric = "لید معرفی‌شده واجد شرایط";
  if (type === "Objective")
    edits.relatedPriorityId = f.strategy.priorities[0].id;
  if (type === "KR")
    Object.assign(edits, {
      confidence: 5,
      unit: "قرارداد",
      startValue: 0,
      targetValue: 20,
    });
  if (type === "Experiment")
    Object.assign(edits, {
      primaryMetricId: EM.experimentData(f.scale).metrics[0].id,
      baselineValue: 4,
      baselineSource: "ثبت آزمون واحد",
      baselinePeriod: "2026-10-01",
      targetValue: 20,
      "hypothesis.audience": "لیدهای معرفی‌شده",
      "hypothesis.movement": "افزایش لید",
      "experimentDesign.audience": "گروه محدود",
      successCriteria: "رسیدن به هدف با ثبت منبع",
    });
  if (type === "KPI")
    Object.assign(edits, {
      unit: "قرارداد",
      baselineValue: 0,
      targetValue: 20,
    });
  if (Object.keys(edits).length) E.editDraft(f.state, f.context, a.id, edits);
  assert.equal(a.validation.status, "Valid", JSON.stringify(a.validation));
  E.requestApproval(f.state, f.context, a.id);
  E.approveDraft(f.state, f.context, a.id);
  P.savePreparation(f.store, f.state, null);
  f.store.removeItem = (k) => f.map.delete(k);
  return { ...f, a };
}
function run(f) {
  const d = X.dryRunAction(f.store, f.a.id);
  return X.executeAction(f.store, f.a.id, {
    explicit: true,
    dryRunBinding: d.binding,
  });
}
function blocked(fn, code) {
  assert.throws(fn, (e) => e.code === code);
}
test("6E whitelist explicitly allows eight limited creations; every other template defaults disabled", () => {
  assert.equal(R.ExecutableCapabilityRegistry.length, 8);
  for (const id of [
    "OwnerChange",
    "SOPChange",
    "KRTargetChange",
    "CancelObjective",
    "ConstraintUpdate",
    "DecisionNote",
    "ActionPlan",
  ])
    assert.equal(R.executable(id), undefined);
});
for (const type of [
  "GrowthIdea",
  "Experiment",
  "Initiative",
  "Improvement",
  "KPI",
  "Objective",
  "KR",
  "ScalePreparation",
])
  test("6E canonical creation + verification: " + type, () => {
    const f = setup(type),
      before = new Map(f.map),
      d = X.dryRunAction(f.store, f.a.id);
    assert.deepEqual(f.map, before, "dry run changes no store");
    const r = X.executeAction(f.store, f.a.id, {
      explicit: true,
      dryRunBinding: d.binding,
    });
    assert.equal(r.status, "Succeeded");
    assert.equal(
      P.readPreparation(f.store).state.actions[0].status,
      "Executed",
    );
    assert.equal(r.entityRefs.length, 1);
    assert.ok(r.entityRefs[0].route.startsWith("/"));
    assert.equal(r.beforeSnapshot.exists, false);
    assert.equal(r.afterSnapshot.id, f.a.payload.id);
    assert.ok(
      S.readExecution(f.store).state.audit.some(
        (x) => x.event === "ExecutionSucceeded",
      ),
    );
    const expected =
      type === "Improvement" || type === "KPI"
        ? "growth-engine.process-measurement.v1"
        : r.domain === "Strategy"
          ? "growth-engine.strategy.v1"
          : "growth-engine.scale.v1";
    for (const [k, v] of before)
      if (![expected, P.PREPARATION_KEY, S.EXECUTION_KEY].includes(k))
        assert.equal(f.map.get(k), v, "unrelated store unchanged " + k);
    if (type === "Experiment") assert.equal(r.afterSnapshot.status, "draft");
    if (type === "Objective") assert.equal(r.afterSnapshot.status, "draft");
    if (type === "Initiative") assert.equal(r.afterSnapshot.status, "proposed");
    assert.equal(S.readExecution(f.store).error, undefined);
  });
test("6E unapproved/rejected actions cannot execute", () => {
  for (const status of ["Draft", "Rejected"]) {
    const f = setup();
    const s = P.readPreparation(f.store).state;
    s.actions[0].status = status;
    P.savePreparation(f.store, s, f.map.get(P.PREPARATION_KEY));
    blocked(() => X.dryRunAction(f.store, f.a.id), "ApprovalMissing");
  }
});
test("6E changed payload signature blocks execution and revokes approval", () => {
  const f = setup(),
    d = X.dryRunAction(f.store, f.a.id),
    s = JSON.parse(f.map.get(P.PREPARATION_KEY));
  s.actions[0].payload.title = "tampered";
  f.map.set(P.PREPARATION_KEY, JSON.stringify(s));
  blocked(
    () =>
      X.executeAction(f.store, f.a.id, {
        explicit: true,
        dryRunBinding: d.binding,
      }),
    "StorageConflict",
  );
  assert.equal(
    JSON.parse(f.map.get("growth-engine.scale.v1")).ideas.length,
    f.scale.ideas.length,
  );
});
test("6E direct validator detects approved revision tampering", () => {
  const f = setup();
  f.a.payload.title = "tampered";
  blocked(
    () =>
      X.validateExecutableAction(
        f.a,
        f.state,
        f.context,
        S.readExecution(f.store).state,
      ),
    "ApprovalInvalid",
  );
});
test("6E stale objective blocks initiative and invalidates approval", () => {
  const f = setup("Initiative"),
    d = X.dryRunAction(f.store, f.a.id);
  const s = JSON.parse(f.map.get("growth-engine.strategy.v1"));
  s.objectives[0].title += " changed";
  f.map.set("growth-engine.strategy.v1", JSON.stringify(s));
  blocked(
    () =>
      X.executeAction(f.store, f.a.id, {
        explicit: true,
        dryRunBinding: d.binding,
      }),
    "ActionStale",
  );
  assert.equal(
    JSON.parse(f.map.get("growth-engine.strategy.v1")).initiatives?.length ?? 0,
    0,
  );
  assert.equal(
    P.readPreparation(f.store).state.actions[0].status,
    "NeedsReview",
  );
  assert.equal(P.readPreparation(f.store).state.approvals[0].status, "Expired");
});
test("6E missing execute permission blocks a valid approved action", () => {
  const f = setup();
  blocked(
    () => X.dryRunAction(f.store, f.a.id, { ...X.localActor, permissions: [] }),
    "ExecutionNotAllowed",
  );
});
test("6E High/Critical capabilities never execute", () => {
  for (const type of ["KRTargetChange", "CancelObjective", "OwnerChange"]) {
    const f = fixture(),
      a = prep(f, type);
    f.store.removeItem = (k) => f.map.delete(k);
    P.savePreparation(f.store, f.state, null);
    blocked(() => X.dryRunAction(f.store, a.id), "ExecutionNotAllowed");
  }
});
test("6E missing approval and expired approval blocked", () => {
  const f = setup();
  f.state.approvals = [];
  blocked(
    () =>
      X.validateExecutableAction(
        f.a,
        f.state,
        f.context,
        S.readExecution(f.store).state,
      ),
    "ApprovalMissing",
  );
  const g = setup();
  g.state.approvals[0].expiresAt = "2020-01-01T00:00:00Z";
  blocked(
    () =>
      X.validateExecutableAction(
        g.a,
        g.state,
        g.context,
        S.readExecution(g.store).state,
      ),
    "ApprovalInvalid",
  );
});
test("6E double execution returns prior result, creates exactly one entity", () => {
  const f = setup(),
    r = run(f),
    again = X.executeAction(f.store, f.a.id, {
      explicit: true,
      dryRunBinding: "old",
    });
  assert.equal(again.id, r.id);
  assert.equal(
    JSON.parse(f.map.get("growth-engine.scale.v1")).ideas.filter(
      (x) => x.id === f.a.payload.id,
    ).length,
    1,
  );
});
test("6E approval alone and model execute_now flag cannot mutate anything", () => {
  const f = setup(),
    before = new Map(f.map);
  assert.deepEqual(f.map, before);
  blocked(
    () =>
      X.executeAction(f.store, f.a.id, {
        explicit: false,
        dryRunBinding: X.dryRunAction(f.store, f.a.id).binding,
      }),
    "ExecutionNotAllowed",
  );
  assert.deepEqual(f.map, before);
});
test("6E draft edits revoke approval, require approval for new revision", () => {
  const f = setup(),
    s = P.readPreparation(f.store).state;
  E.editDraft(s, C.preparationContext(f.store), f.a.id, {
    title: "ویرایش مدیر",
  });
  P.savePreparation(f.store, s, f.map.get(P.PREPARATION_KEY));
  blocked(() => X.dryRunAction(f.store, f.a.id), "ApprovalMissing");
});
test("6E post-write verification failure is never marked success; retry verifies prior entity without duplicate", () => {
  const f = setup(),
    d = X.dryRunAction(f.store, f.a.id);
  const set = f.store.setItem;
  let corruptOnce = true;
  f.store.setItem = (k, v) => {
    set(k, v);
    if (k === "growth-engine.scale.v1" && corruptOnce) {
      corruptOnce = false;
      const data = JSON.parse(v);
      data.ideas.find((x) => x.id === f.a.payload.id).title += " mismatch";
      f.map.set(k, JSON.stringify(data));
    }
  };
  blocked(
    () =>
      X.executeAction(f.store, f.a.id, {
        explicit: true,
        dryRunBinding: d.binding,
      }),
    "PostExecutionVerificationFailed",
  );
  assert.equal(S.readExecution(f.store).state.records[0].status, "Failed");
  blocked(
    () =>
      X.executeAction(f.store, f.a.id, {
        explicit: true,
        dryRunBinding: d.binding,
      }),
    "EntityConflict",
  );
  const data = JSON.parse(f.map.get("growth-engine.scale.v1"));
  data.ideas.find((x) => x.id === f.a.payload.id).title = f.a.payload.title;
  f.map.set("growth-engine.scale.v1", JSON.stringify(data));
  const r = X.executeAction(f.store, f.a.id, {
    explicit: true,
    dryRunBinding: d.binding,
  });
  assert.equal(r.status, "Succeeded");
  assert.equal(data.ideas.filter((x) => x.id === f.a.payload.id).length, 1);
});
test("6E quota before domain write leaves domain untouched", () => {
  const f = setup(),
    d = X.dryRunAction(f.store, f.a.id),
    before = f.map.get("growth-engine.scale.v1"),
    set = f.store.setItem;
  f.store.setItem = (k, v) => {
    if (k === S.EXECUTION_KEY) throw Error("quota");
    set(k, v);
  };
  assert.throws(() =>
    X.executeAction(f.store, f.a.id, {
      explicit: true,
      dryRunBinding: d.binding,
    }),
  );
  assert.equal(f.map.get("growth-engine.scale.v1"), before);
});
test("6E lock blocks reentrant execution", () => {
  const f = setup(),
    d = X.dryRunAction(f.store, f.a.id),
    set = f.store.setItem;
  let checked = false;
  f.store.setItem = (k, v) => {
    if (k === S.EXECUTION_KEY && !checked) {
      checked = true;
      blocked(
        () =>
          X.executeAction(f.store, f.a.id, {
            explicit: true,
            dryRunBinding: d.binding,
          }),
        "StorageConflict",
      );
    }
    set(k, v);
  };
  run(f);
  assert.ok(checked);
});
test("6E growth idea rollback archives only created idea and retains both audits", () => {
  const f = setup(),
    r = run(f),
    count = JSON.parse(f.map.get("growth-engine.scale.v1")).ideas.length;
  X.rollbackAction(f.store, r.id, { explicit: true });
  const s = JSON.parse(f.map.get("growth-engine.scale.v1"));
  assert.equal(s.ideas.length, count);
  assert.equal(s.ideas.find((x) => x.id === f.a.payload.id).status, "archived");
  const state = S.readExecution(f.store).state;
  assert.equal(state.records[0].status, "RolledBack");
  assert.ok(state.audit.some((x) => x.event === "ExecutionSucceeded"));
  assert.ok(state.audit.some((x) => x.event === "RollbackSucceeded"));
  assert.equal(state.rollbacks[0].rollbackType, "CompensatingAction");
});
test("6E rollback refuses edited idea and unsupported actions", () => {
  const f = setup(),
    r = run(f),
    s = JSON.parse(f.map.get("growth-engine.scale.v1"));
  s.ideas.find((x) => x.id === f.a.payload.id).title += " user changed";
  f.map.set("growth-engine.scale.v1", JSON.stringify(s));
  blocked(
    () => X.rollbackAction(f.store, r.id, { explicit: true }),
    "EntityConflict",
  );
  const g = setup("Improvement"),
    q = run(g);
  blocked(
    () => X.rollbackAction(g.store, q.id, { explicit: true }),
    "RollbackNotSupported",
  );
});
test("6E executed action is immutable to preparation editing/rebuild/archive/reject", () => {
  const f = setup();
  run(f);
  const s = P.readPreparation(f.store).state,
    c = C.preparationContext(f.store);
  for (const fn of [
    () => E.editDraft(s, c, f.a.id, { title: "edit" }),
    () => E.rebuildPreview(s, c, f.a.id),
    () => E.archiveDraft(s, f.a.id),
    () => E.rejectDraft(s, f.a.id, "reject"),
  ])
    assert.throws(fn);
});
test("6E corrupt execution storage is preserved and blocks domain writes", () => {
  const f = setup();
  f.map.set(S.EXECUTION_KEY, "broken");
  blocked(() => X.dryRunAction(f.store, f.a.id), "StorageConflict");
  assert.equal(f.map.get(S.EXECUTION_KEY), "broken");
});
test("6E 6A-6D prior keys survive execution", () => {
  const f = setup();
  for (const k of [
    "growth-engine.agent.v1",
    "growth-engine.agent.advisor.v1",
    "growth-engine.agent.diagnosis.v1",
  ])
    if (!f.map.has(k)) f.map.set(k, "legacy");
  const before = new Map(f.map);
  run(f);
  for (const k of [
    "growth-engine.agent.v1",
    "growth-engine.agent.advisor.v1",
    "growth-engine.agent.diagnosis.v1",
  ])
    assert.equal(f.map.get(k), before.get(k));
  assert.equal(
    P.readPreparation(f.store).state.revisions.length,
    f.state.revisions.length,
  );
});
test("6E malicious business text cannot call an executor or escalate initial status", () => {
  const f = setup("Experiment"),
    s = P.readPreparation(f.store).state;
  s.actions[0].payload.status = "running";
  s.approvals[0].binding = E.approvalBinding(s.actions[0], s);
  s.actions[0].validation.status = "Valid";
  f.map.set(P.PREPARATION_KEY, JSON.stringify(s));
  blocked(() => X.dryRunAction(f.store, f.a.id), "DomainValidationFailed");
  assert.equal(
    JSON.parse(f.map.get("growth-engine.scale.v1")).experimentData?.experiments
      ?.length ?? 0,
    0,
  );
});

test("6E dependency requires actual verified execution, not conceptual approval", () => {
  const f = fixture();
  f.store.removeItem = (k) => f.map.delete(k);
  const first = E.prepareDraft(f.state, f.context, {
    templateId: "GrowthIdea",
    targetEntityId: f.scale.constraints[0].id,
    origin: "Manual",
  });
  E.editDraft(f.state, f.context, first.id, { successMetric: "لید معرفی" });
  E.requestApproval(f.state, f.context, first.id);
  E.approveDraft(f.state, f.context, first.id);
  const second = E.prepareDraft(f.state, f.context, {
    templateId: "Improvement",
    targetEntityId: "p6",
    origin: "Manual",
  });
  E.editDraft(f.state, f.context, second.id, {
    ownerRoleId: f.system.roles[0].id,
    dueDate: "2026-10-30",
  });
  f.state.plans.push({
    id: "plan",
    title: "separate executions",
    objective: "controlled change",
    steps: [
      {
        id: "one",
        order: 1,
        domain: "Scale",
        title: "idea",
        templateId: "GrowthIdea",
        proposedActionId: first.id,
        dependencyIds: [],
        expectedOutcome: "idea record",
        completionCondition: "created",
      },
      {
        id: "two",
        order: 2,
        domain: "System",
        title: "improvement",
        templateId: "Improvement",
        proposedActionId: second.id,
        dependencyIds: ["dep"],
        expectedOutcome: "improvement",
        completionCondition: "created",
      },
    ],
    dependencies: [
      {
        id: "dep",
        fromStepId: "one",
        toStepId: "two",
        condition: "created",
        status: "Pending",
      },
    ],
    evidenceIds: first.evidenceIds,
    risks: [],
    status: "Draft",
    createdAt: new Date().toISOString(),
  });
  second.dependencyIds = ["dep"];
  E.requestApproval(f.state, f.context, second.id);
  E.approveDraft(f.state, f.context, second.id);
  P.savePreparation(f.store, f.state, null);
  blocked(() => X.dryRunAction(f.store, second.id), "DependencyBlocked");
  const d = X.dryRunAction(f.store, first.id);
  X.executeAction(f.store, first.id, {
    explicit: true,
    dryRunBinding: d.binding,
  });
  const next = X.dryRunAction(f.store, second.id);
  assert.equal(next.success, true);
  X.executeAction(f.store, second.id, {
    explicit: true,
    dryRunBinding: next.binding,
  });
  assert.equal(
    S.readExecution(f.store).state.records.filter(
      (r) => r.status === "Succeeded",
    ).length,
    2,
  );
});
test("6E execute validation failure appends audit without domain mutation", () => {
  const f = setup(),
    d = X.dryRunAction(f.store, f.a.id),
    before = f.map.get("growth-engine.scale.v1");
  blocked(
    () =>
      X.executeAction(
        f.store,
        f.a.id,
        { explicit: true, dryRunBinding: d.binding },
        { ...X.localActor, permissions: [] },
      ),
    "ExecutionNotAllowed",
  );
  assert.equal(f.map.get("growth-engine.scale.v1"), before);
  assert.ok(
    S.readExecution(f.store).state.audit.some(
      (x) => x.event === "ExecutionValidationFailed",
    ),
  );
});
test("6E write exception preserves canonical data and allows safe retry after verifying absence", () => {
  const f = setup(),
    d = X.dryRunAction(f.store, f.a.id),
    set = f.store.setItem,
    before = f.map.get("growth-engine.scale.v1");
  let once = true;
  f.store.setItem = (k, v) => {
    if (k === "growth-engine.scale.v1" && once) {
      once = false;
      throw Error("quota");
    }
    set(k, v);
  };
  blocked(
    () =>
      X.executeAction(f.store, f.a.id, {
        explicit: true,
        dryRunBinding: d.binding,
      }),
    "ExecutionFailed",
  );
  assert.equal(f.map.get("growth-engine.scale.v1"), before);
  assert.equal(S.readExecution(f.store).state.records[0].status, "Failed");
  assert.equal(
    X.executeAction(f.store, f.a.id, {
      explicit: true,
      dryRunBinding: d.binding,
    }).status,
    "Succeeded",
  );
});
test("6E source owner removal blocks stale execution with no fallback", () => {
  const f = setup("Improvement"),
    d = X.dryRunAction(f.store, f.a.id),
    sys = JSON.parse(f.map.get("growth-engine.system.v1"));
  sys.roles[0].personId = undefined;
  f.map.set("growth-engine.system.v1", JSON.stringify(sys));
  blocked(
    () =>
      X.executeAction(f.store, f.a.id, {
        explicit: true,
        dryRunBinding: d.binding,
      }),
    "ActionStale",
  );
  assert.equal(f.map.has("growth-engine.process-measurement.v1"), false);
});

test("6E disabled capability fails closed", () => {
  const f = setup(),
    find = Caps.findCapability;
  Caps.findCapability = (id) => {
    const cap = find(id);
    return id === "scale.createGrowthIdea" ? { ...cap, enabled: false } : cap;
  };
  try {
    blocked(() => X.dryRunAction(f.store, f.a.id), "CapabilityDisabled");
  } finally {
    Caps.findCapability = find;
  }
});
test("6E successful execution audit and snapshots cannot be silently edited or removed", () => {
  const f = setup();
  run(f);
  const r = S.readExecution(f.store),
    bad = structuredClone(r.state);
  bad.records[0].afterSnapshot.title = "tampered";
  assert.throws(() => S.saveExecution(f.store, bad, r.raw));
  const erased = structuredClone(r.state);
  erased.audit.shift();
  assert.throws(() => S.saveExecution(f.store, erased, r.raw));
});
test("6E interrupted journal after domain write recovers by verification without replay", () => {
  const f = setup(),
    d = X.dryRunAction(f.store, f.a.id),
    set = f.store.setItem;
  let journalCalls = 0;
  f.store.setItem = (k, v) => {
    if (k === S.EXECUTION_KEY && ++journalCalls > 1)
      throw Error("journal unavailable");
    set(k, v);
  };
  assert.throws(() =>
    X.executeAction(f.store, f.a.id, {
      explicit: true,
      dryRunBinding: d.binding,
    }),
  );
  assert.equal(S.readExecution(f.store).state.records[0].status, "Executing");
  f.store.setItem = set;
  const r = X.executeAction(f.store, f.a.id, {
    explicit: true,
    dryRunBinding: d.binding,
  });
  assert.equal(r.status, "Succeeded");
  assert.equal(
    JSON.parse(f.map.get("growth-engine.scale.v1")).ideas.filter(
      (x) => x.id === f.a.payload.id,
    ).length,
    1,
  );
});
test("6E interrupted rollback journal verifies archived state before retry", () => {
  const f = setup(),
    r = run(f),
    set = f.store.setItem;
  let calls = 0;
  f.store.setItem = (k, v) => {
    if (k === S.EXECUTION_KEY && ++calls > 1)
      throw Error("journal unavailable");
    set(k, v);
  };
  assert.throws(() => X.rollbackAction(f.store, r.id, { explicit: true }));
  assert.equal(
    JSON.parse(f.map.get("growth-engine.scale.v1")).ideas.find(
      (x) => x.id === f.a.payload.id,
    ).status,
    "archived",
  );
  f.store.setItem = set;
  assert.equal(
    X.rollbackAction(f.store, r.id, { explicit: true }).status,
    "RolledBack",
  );
});

test("6E concurrent unrelated scale change during rollback is preserved", () => {
  const f = setup(),
    r = run(f),
    set = f.store.setItem;
  let injected = false;
  f.store.setItem = (k, v) => {
    set(k, v);
    if (k === S.EXECUTION_KEY && !injected) {
      injected = true;
      const scale = JSON.parse(f.map.get("growth-engine.scale.v1"));
      scale.constraints[0].description += " user concurrent change";
      f.map.set("growth-engine.scale.v1", JSON.stringify(scale));
    }
  };
  blocked(
    () => X.rollbackAction(f.store, r.id, { explicit: true }),
    "ActionStale",
  );
  assert.match(
    JSON.parse(f.map.get("growth-engine.scale.v1")).constraints[0].description,
    /user concurrent change/,
  );
  assert.equal(
    JSON.parse(f.map.get("growth-engine.scale.v1")).ideas.find(
      (x) => x.id === f.a.payload.id,
    ).status,
    "inbox",
  );
});
