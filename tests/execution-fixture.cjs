const { test } = require("node:test"),
  a = require("node:assert/strict");
const root = "../.test-build/agent/";
const E = require(root + "agent/preparation/engine.js"),
  T = require(root + "agent/preparation/types.js"),
  C = require(root + "agent/preparation/context.js"),
  V = require(root + "agent/preparation/validation.js"),
  R = require(root + "agent/preparation/recommendations.js"),
  W = require(root + "agent/preparation/wording.js"),
  P = require(root + "preparation-storage.js");
const Sys = require("../.test-build/system/seed.js"),
  Strategy = require("../.test-build/strategy/seed.js"),
  Scale = require("../.test-build/scale/scale/seed.js"),
  RM = require(root + "scale/readiness/model.js"),
  EM = require(root + "scale/experiments/model.js"),
  D = require(root + "diagnosis-storage.js"),
  DT = require(root + "agent/diagnosis/types.js"),
  Caps = require(root + "agent/capabilities.js");
function fixture() {
  const map = new Map(),
    writes = [];
  const store = {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      
      writes.push(k);
      map.set(k, v);
    },
  };
  const system = Sys.createSystemSeed(),
    strategy = Strategy.seedStrategy(system.roles),
    scale = Scale.seedScale(new Date().toISOString(), system.roles[0].id),
    kr = {
      id: "kr-closing",
      cycleId: strategy.cycles[0].id,
      objectiveId: strategy.objectives[0].id,
      code: "KR-1",
      title: "افزایش قراردادهای موفق",
      description: "نتیجه پیگیری قرارداد",
      ownerRoleId: system.roles[0].id,
      type: "increase",
      startValue: 0,
      targetValue: 20,
      currentValue: 4,
      unit: "قرارداد",
      weight: null,
      confidence: 3,
      startDate: "2026-09-01",
      deadline: "2026-11-01",
      lastUpdateAt: new Date().toISOString(),
      notes: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lifecycle: "active",
      milestones: [],
    };
  strategy.keyResults = [kr];
  strategy.objectives[0].status = "active";
  scale.constraints[0].linkedSystemProcessId = "p6";
  scale.constraints[0].linkedStrategyKRId = kr.id;
  scale.constraints[0].linkedStrategyObjectiveId = kr.objectiveId;
  const candidate = {
    ...RM.newCandidate(),
    id: "candidate",
    name: "رشد کنترل‌شده قرارداد",
    ownerRoleId: system.roles[0].id,
    processIds: ["p6"],
    objectiveId: kr.objectiveId,
    krId: kr.id,
    manualEvidence: "شواهد ظرفیت",
  };
  scale.readinessData = { ...RM.emptyReadiness(), candidates: [candidate] };
  for (const [k, v] of [
    ["growth-engine.system.v1", system],
    ["growth-engine.strategy.v1", strategy],
    ["growth-engine.scale.v1", scale],
  ])
    map.set(k, JSON.stringify(v));
  let context = C.preparationContext(store);
  const refs = ["process", "KR", "constraint", "candidate"].map(
    (type) =>
      context.entities.find(
        (e) =>
          e.ref.entityType === type &&
          (type !== "process" || e.ref.entityId === "p6"),
      ).ref,
  );
  const diagnosis = {
    id: "diagnosis-closing",
    fingerprint: "closing",
    title: "افت تبدیل قرارداد همراه وابستگی بنیان‌گذار",
    summary:
      "نتیجه قرارداد خارج از مسیر است و پیگیری فروش به بنیان‌گذار متکی است؛ فرضیه نیازمند آزمون است.",
    category: "LeadershipDependency",
    severity: "High",
    confidence: "High",
    patternIds: [],
    evidenceIds: ["e"],
    affectedEntities: refs,
    impact: "CrossFunctional",
    managementQuestion: "چه مانعی پیش از افزایش جذب باید برداشته شود؟",
    status: "New",
    firstDetectedAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    needsRefresh: false,
    sourceFamilies: ["KR-progress", "funnel", "founder", "experiment-result"],
    recurrenceCount: 1,
    recommendations: [],
  };
  const diag = {
    ...DT.emptyDiagnosisState(),
    diagnoses: [diagnosis],
    evidence: [
      {
        id: "e",
        domain: "System",
        entityRef: refs[0],
        evidenceType: "Risk",
        title: "وابستگی فرآیند پیگیری",
        summary: "نیاز به روشن‌شدن دستورالعمل و مالک ثبت شده است.",
        createdAt: new Date().toISOString(),
        confidence: "High",
      },
    ],
    runs: [
      {
        id: "run",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        scope: "Executive3S",
        contextVersion: context.version,
        signalsFound: 4,
        patternsFound: 1,
        diagnosesCreated: 1,
        status: "Completed",
        mode: "DeterministicOnly",
      },
    ],
  };
  map.set(D.DIAGNOSIS_KEY, JSON.stringify(diag));
  context = C.preparationContext(store);
  a.equal(context.notices.length, 0);
  a.ok(context.strategy && context.scale && context.system);
  a.equal(context.diagnosisError, undefined);
  return {
    map,
    store,
    writes,
    context,
    state: T.emptyPreparation(),
    system,
    strategy,
    scale,
    diagnosis,
    kr,
    refs,
  };
}
function prep(f, id = "DecisionNote", extra = {}) {
  return E.prepareDraft(f.state, f.context, {
    templateId: id,
    diagnosisId: f.diagnosis.id,
    ...extra,
  });
}
function ready(f, id = "Improvement") {
  const p = prep(f, id);
  const edits = {};
  for (const field of p.fields) {
    if (field.kind === "role") edits[field.path] = f.system.roles[0].id;
    else if (field.kind === "date")
      edits[field.path] =
        field.path === "startDate" ? "2026-10-06" : "2026-10-30";
    else if (field.kind === "number" && p.payload[field.path] === null)
      edits[field.path] = field.path.includes("arget") ? 20 : 0;
    else if (field.path === "scope")
      edits.scope = "فرآیند پیگیری پیشنهاد تا قرارداد";
    else if (field.path === "successCriteria")
      edits.successCriteria = "ثبت مسئول و معیار پذیرش پیگیری";
  }
  if (Object.keys(edits).length) E.editDraft(f.state, f.context, p.id, edits);
  return p;
}
function changed(f, key, fn) {
  const value = JSON.parse(f.map.get(key));
  fn(value);
  f.map.set(key, JSON.stringify(value));
  return C.preparationContext(f.store);
}


module.exports={fixture,prep,ready,changed,E,P,C,T,Caps,EM};

