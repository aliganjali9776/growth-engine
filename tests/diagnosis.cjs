const { test } = require("node:test"),
  a = require("node:assert/strict");
const T = require("../.test-build/agent/agent/diagnosis/types.js"),
  E = require("../.test-build/agent/agent/diagnosis/engine.js"),
  R = require("../.test-build/agent/agent/diagnosis/rules.js"),
  S = require("../.test-build/agent/agent/diagnosis/source.js"),
  P = require("../.test-build/agent/diagnosis-storage.js");
const at = "2026-10-05T12:00:00.000Z",
  later = "2026-10-06T12:00:00.000Z";
const refs = [
  {
    domain: "System",
    entityType: "process",
    entityId: "p",
    label: "بستن قرارداد",
    route: "/system/processes/p",
  },
  {
    domain: "Strategy",
    entityType: "KR",
    entityId: "k",
    label: "نتیجه قرارداد",
    route: "/strategy/key-results?kr=k",
  },
  {
    domain: "Scale",
    entityType: "constraint",
    entityId: "c",
    label: "تبدیل پیشنهاد به قرارداد",
    route: "/scale/constraints",
  },
];
function fixture(
  families = [
    "constraint",
    "KR-progress",
    "funnel",
    "founder",
    "experiment-result",
    "process-readiness",
  ],
) {
  const signals = families.map((family, i) => ({
    id: "s" + i,
    type: family === "experiment-result" ? "Opportunity" : "Risk",
    domain:
      family === "founder" || family === "process-readiness"
        ? "System"
        : family === "KR-progress"
          ? "Strategy"
          : "Scale",
    title: family,
    description: family,
    severity: "High",
    entityRefs: refs,
    evidenceIds: ["e" + i],
    detectedAt: at,
    lastSeenAt: at,
    fingerprint: family,
    status: "Active",
    sourceKey: "source",
    sourceFamily: family,
    confidence: "Medium",
  }));
  return {
    signals,
    evidence: signals.map((s, i) => ({
      id: "e" + i,
      domain: s.domain,
      entityRef: refs.find((r) => r.domain === s.domain),
      evidenceType: "Status",
      title: s.title,
      summary: s.description,
      value: s.description,
      createdAt: at,
    })),
    signature: "sig1",
    availableKeys: ["source"],
    notices: [],
  };
}
const run = (input = fixture(), state = T.emptyDiagnosisState(), time = at) =>
  E.runDiagnosis(state, input, time);
test("golden connected closing chain collapses into one primary issue with four independent sources", () => {
  const s = run();
  a.equal(s.diagnoses.length, 1);
  a.equal(s.priorities.length, 1);
  a.ok(s.diagnoses[0].sourceFamilies.length >= 4);
  a.match(s.diagnoses[0].managementQuestion, /استاندارد/);
  a.ok(s.patterns.length >= 3);
});
test("scan never mutates source input or previous state", () => {
  const input = fixture(),
    before = JSON.stringify(input),
    state = T.emptyDiagnosisState();
  run(input, state);
  a.equal(JSON.stringify(input), before);
  a.equal(state.runs.length, 0);
});
test("stable rerun updates same ID without duplicate diagnoses or evidence", () => {
  const s = run(),
    r = run(fixture(), s, later);
  a.equal(r.diagnoses[0].id, s.diagnoses[0].id);
  a.equal(r.diagnoses.length, s.diagnoses.length);
  a.equal(r.evidence.length, s.evidence.length);
  a.equal(r.history.length, s.history.length);
});
test("manual status reviewed survives rerun", () => {
  const s = run(),
    r = E.setDiagnosisStatus(s, s.diagnoses[0].id, "Reviewed", "review", later);
  a.equal(run(fixture(), r, later).diagnoses[0].status, "Reviewed");
});
test("monitoring workflow creates history", () => {
  const s = run(),
    r = E.setDiagnosisStatus(
      s,
      s.diagnoses[0].id,
      "Monitoring",
      "watch",
      later,
    );
  a.equal(r.history.at(-1).event, "Monitoring");
});
test("dismissed diagnosis stays dismissed on repeat", () => {
  const s = run(),
    r = E.setDiagnosisStatus(
      s,
      s.diagnoses[0].id,
      "Dismissed",
      "duplicate",
      later,
    );
  a.equal(run(fixture(), r, later).diagnoses[0].status, "Dismissed");
  a.equal(r.priorities.length, 0);
});
test("disappearing pattern resolves but keeps historical evidence", () => {
  const s = run(),
    r = run(fixture([]), s, later);
  a.equal(r.diagnoses[0].status, "Resolved");
  a.equal(r.evidence.length, s.evidence.length);
  a.equal(r.history.at(-1).event, "Resolved");
});
test("resolved recurrence reopens same ID", () => {
  const s = run(),
    resolved = run(fixture([]), s, later),
    r = run(fixture(), resolved, "2026-10-07T12:00:00.000Z");
  a.equal(r.diagnoses[0].id, s.diagnoses[0].id);
  a.equal(r.diagnoses[0].status, "New");
  a.equal(r.diagnoses[0].recurrenceCount, 1);
  a.equal(r.history.at(-1).event, "Reopened");
});
test("unavailable source does not falsely resolve existing issue", () => {
  const s = run(),
    input = fixture([]);
  input.availableKeys = [];
  const r = run(input, s, later);
  a.equal(r.diagnoses[0].status, "New");
  a.equal(r.diagnoses[0].needsRefresh, true);
  a.equal(r.priorities.length, 0);
});
test("new evidence freezes previous history", () => {
  const s = run(),
    old = structuredClone(s.history[0]),
    input = fixture();
  input.evidence[0].id = "changed";
  input.evidence[0].value = "new";
  input.signals[0].evidenceIds = ["changed"];
  const r = run(input, s, later);
  a.deepEqual(r.history[0], old);
  a.ok(r.evidence.some((e) => e.id === "e0"));
  a.ok(r.evidence.some((e) => e.id === "changed"));
});
test("quality-only stale KR becomes low-confidence data-quality issue", () => {
  const s = run(fixture(["KR-quality"]));
  a.equal(s.diagnoses[0].category, "DataQuality");
  a.equal(s.diagnoses[0].confidence, "Low");
  a.equal(s.diagnoses[0].recommendations[0].recommendationType, "CollectData");
});
test("ready candidate is opportunity and never an automatic action", () => {
  const s = run(fixture(["candidate-ready"]));
  a.equal(s.diagnoses[0].category, "Opportunity");
  a.equal(s.priorities.length, 0);
  a.deepEqual(s.diagnoses[0].recommendations[0].suggestedActions, []);
});
test("unlinked signals never combine merely because domains match", () => {
  const input = fixture(["constraint", "KR-progress", "funnel", "founder"]);
  input.signals.forEach(
    (s, i) => (s.entityRefs = [{ ...refs[0], entityId: "p" + i }]),
  );
  a.equal(run(input).diagnoses.length, 0);
});
test("duplicate metric family cannot inflate independent source count", () => {
  const input = fixture(["KR-quality", "KR-quality", "KR-quality"]);
  const s = run(input);
  a.equal(s.diagnoses[0].sourceFamilies.length, 1);
  a.equal(s.diagnoses[0].confidence, "Low");
});
test("executive priorities capped at three deterministically", () => {
  const input = fixture(["execution-result"]);
  for (let i = 1; i < 8; i++) {
    const s = {
      ...input.signals[0],
      id: "s" + i,
      fingerprint: "sig" + i,
      entityRefs: [{ ...refs[0], entityId: "p" + i }],
    };
    input.signals.push(s);
  }
  const s = run(input);
  a.equal(s.priorities.length, 3);
  a.deepEqual(E.rankDiagnoses(s.diagnoses, at), s.priorities);
});
test("empty input creates no fabricated problem", () => {
  const s = run(fixture([]));
  a.equal(s.diagnoses.length, 0);
  a.equal(s.runs[0].mode, "DeterministicOnly");
});
test("registry contains fifteen enabled rules with required domain declarations", () => {
  a.equal(R.diagnosisRules.length, 15);
  for (const r of R.diagnosisRules) {
    a.ok(r.requiredDomains.length);
    a.equal(typeof r.evaluate, "function");
    a.ok(r.confidenceLogic);
    a.ok(r.dedupKey);
  }
});
function storage() {
  const m = new Map();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => m.set(k, v),
    m,
  };
}
test("new storage writes only diagnosis key and roundtrips references", () => {
  const st = storage();
  st.setItem("growth-engine.agent.v1", "6A");
  st.setItem("growth-engine.advisor.v1", "6B");
  const s = run(),
    raw = P.saveDiagnosis(st, s, null);
  a.deepEqual(P.readDiagnosis(st).state, s);
  a.equal(st.getItem("growth-engine.agent.v1"), "6A");
  a.equal(st.getItem("growth-engine.advisor.v1"), "6B");
  a.equal(raw, st.getItem(P.DIAGNOSIS_KEY));
});
test("corrupt prior storage remains unchanged and write fails", () => {
  const st = storage();
  st.setItem(P.DIAGNOSIS_KEY, "{bad");
  a.ok(P.readDiagnosis(st).error);
  a.throws(() => P.saveDiagnosis(st, run(), "{bad"));
  a.equal(st.getItem(P.DIAGNOSIS_KEY), "{bad");
});
test("concurrent tab save rejected without overwriting", () => {
  const st = storage();
  P.saveDiagnosis(st, run(), null);
  a.throws(() => P.saveDiagnosis(st, run(), null));
});
test("dangling evidence rejected", () => {
  const st = storage(),
    s = run();
  s.diagnoses[0].evidenceIds = ["missing"];
  a.throws(() => P.saveDiagnosis(st, s, null));
  a.equal(st.getItem(P.DIAGNOSIS_KEY), null);
});
test("unsafe external evidence route rejected", () => {
  const st = storage(),
    s = run();
  s.evidence[0].route = "https://evil.example";
  a.throws(() => P.saveDiagnosis(st, s, null));
});
test("missing status target rejected", () =>
  a.throws(() =>
    E.setDiagnosisStatus(T.emptyDiagnosisState(), "missing", "Reviewed"),
  ));
test("source adapter reads empty stores without writing", () => {
  let writes = 0;
  const st = { getItem: () => null, setItem: () => writes++ };
  const input = S.collectDiagnosisSignals(st, at);
  a.equal(writes, 0);
  a.equal(input.signals.length, 0);
  a.equal(input.signature, S.collectDiagnosisSignals(st, at).signature);
});
test("corrupt business store is reported rather than written", () => {
  const input = S.collectDiagnosisSignals(
    { getItem: (k) => (k === "growth-engine.scale.v1" ? "{bad" : null) },
    at,
  );
  a.ok(input.notices.length);
  a.equal(input.signals.length, 0);
});
test("fingerprints change on relevant metric changes", () =>
  a.notEqual(S.fingerprint(["KR", 1]), S.fingerprint(["KR", 2])));
test("suppression does not remove frozen evidence", () => {
  const s = run(),
    r = E.setDiagnosisStatus(s, s.diagnoses[0].id, "Dismissed");
  a.deepEqual(r.evidence, s.evidence);
});
test("large signal fixture remains bounded and finishes under five seconds", () => {
  const input = fixture([]);
  for (let i = 0; i < 750; i++) {
    const f = fixture(["execution-result"]);
    f.signals[0].id = "s" + i;
    f.signals[0].fingerprint = "sig" + i;
    f.signals[0].entityRefs = [{ ...refs[0], entityId: "p" + i }];
    f.signals[0].evidenceIds = ["e" + i];
    f.evidence[0].id = "e" + i;
    input.signals.push(...f.signals);
    input.evidence.push(...f.evidence);
  }
  const start = performance.now(),
    s = run(input);
  a.ok(performance.now() - start < 5000);
  a.equal(s.diagnoses.length, 750);
  a.equal(s.priorities.length, 3);
});
const DA = require("../.test-build/agent/agent/diagnosis/advisor.js"),
  AS = require("../.test-build/agent/advisor-storage.js");
test("diagnosis brief persists through existing advisor validator", () => {
  const input = fixture(),
    state = run(input),
    response = DA.diagnosisAdvisorAnswer(state, input, at),
    st = storage(),
    session = AS.newAdvisorSession();
  session.messages = [
    {
      id: "m",
      sessionId: session.id,
      role: "advisor",
      content: response.answer,
      evidenceRefs: response.evidenceRefs,
      generatedAt: at,
      response,
    },
  ];
  AS.saveAdvisor(st, session, null);
  a.equal(AS.readAdvisor(st).error, undefined);
});
test("changed context produces stale warning instead of current problem claim", () => {
  const input = fixture(),
    state = run(input);
  input.signature = "changed";
  const response = DA.diagnosisAdvisorAnswer(state, input, at);
  a.equal(response.confidence, "Low");
  a.equal(response.observations.length, 0);
  a.equal(response.evidenceRefs.length, 0);
});
test("stale evidence replaces performance without declaring issue resolved", () => {
  const input = fixture(["execution-result"]),
    state = run(input),
    quality = fixture(["KR-quality"]);
  quality.signals[0].type = "DataQuality";
  quality.signals[0].id = "quality-signal";
  const next = run(quality, state, later);
  const old = next.diagnoses.find((d) => d.id === state.diagnoses[0].id);
  a.equal(old.status, "New");
  a.equal(old.needsRefresh, true);
});

const H = require("../.test-build/agent/agent/diagnosis/hybrid.js");
test("hybrid wording cannot alter severity, confidence, evidence, status or priorities", () => {
  const s = run(),
    d = s.diagnoses[0],
    w = {
      diagnosisTitle: "بررسی ظرفیت اجرا",
      diagnosisSummary: "الگو نیازمند بررسی است.",
      managementQuestion: "کدام شاهد باید بررسی شود؟",
      businessRationale: "فرآیند مرتبط نیازمند توجه است.",
    };
  const r = H.applyDiagnosisWording(s, d.id, w, "test-model", later);
  for (const key of [
    "severity",
    "confidence",
    "evidenceIds",
    "status",
    "affectedEntities",
  ])
    a.deepEqual(r.diagnoses[0][key], d[key]);
  a.deepEqual(r.priorities, s.priorities);
  a.equal(r.runs.at(-1).mode, "Hybrid");
});
test("hybrid rejects unsupported numbers and causal certainty", () => {
  const s = run(),
    id = s.diagnoses[0].id,
    w = {
      diagnosisTitle: "بررسی",
      diagnosisSummary: "درآمد 987654321",
      managementQuestion: "چه باید بررسی شود؟",
      businessRationale: "بررسی",
    };
  a.throws(() => H.applyDiagnosisWording(s, id, w, "test"));
  w.diagnosisSummary = "این علت قطعی است";
  a.throws(() => H.applyDiagnosisWording(s, id, w, "test"));
});
test("hybrid rejects extra action fields", () => {
  const s = run();
  a.throws(() =>
    H.applyDiagnosisWording(
      s,
      s.diagnoses[0].id,
      {
        diagnosisTitle: "x",
        diagnosisSummary: "x",
        managementQuestion: "x",
        businessRationale: "x",
        execute: true,
      },
      "test",
    ),
  );
});
test("source adapter benchmark: 50 processes, 100 KRs, 500 experiments, 75 channels, 50 loops, 75 candidates", () => {
  const sys = require("../.test-build/system/seed.js").createSystemSeed(),
    st = require("../.test-build/strategy/kr/seed.js").withSampleKRs(
      require("../.test-build/strategy/seed.js").seedStrategy(sys.roles),
    ),
    sc = require("../.test-build/scale/scale/seed.js").seedScale(
      at,
      sys.roles[0].id,
    ),
    EM = require("../.test-build/agent/scale/experiments/model.js"),
    NM = require("../.test-build/agent/scale/network/model.js"),
    RM = require("../.test-build/agent/scale/readiness/model.js");
  sys.processes = Array.from({ length: 50 }, (_, i) => ({
    ...sys.processes[0],
    id: "process-" + i,
    code: "P-" + i,
  }));
  st.keyResults = Array.from({ length: 100 }, (_, i) => ({
    ...st.keyResults[0],
    id: "kr-" + i,
    code: "KR-" + i,
  }));
  sc.experimentData = {
    ...EM.experimentData(sc),
    experiments: Array.from({ length: 500 }, (_, i) => ({
      ...EM.newExperiment(sc),
      id: "experiment-" + i,
      code: "EXP-" + i,
      title: "آزمایش",
      status: "draft",
    })),
  };
  sc.networkData = {
    ...NM.emptyNetwork(),
    channels: Array.from({ length: 75 }, (_, i) => ({
      ...NM.newChannel(),
      id: "channel-" + i,
      name: "کانال",
    })),
    loops: Array.from({ length: 50 }, (_, i) => ({
      ...NM.newLoop(),
      id: "loop-" + i,
      name: "حلقه",
    })),
  };
  sc.readinessData = {
    ...RM.emptyReadiness(),
    candidates: Array.from({ length: 75 }, (_, i) => ({
      ...RM.newCandidate(),
      id: "candidate-" + i,
      name: "کاندید",
    })),
  };
  const data = storage();
  for (const [key, v] of [
    ["system", sys],
    ["strategy", st],
    ["scale", sc],
  ])
    data.setItem("growth-engine." + key + ".v1", JSON.stringify(v));
  const before = JSON.stringify([...data.m]),
    start = performance.now(),
    input = S.collectDiagnosisSignals(data, at),
    state = run(input),
    ms = performance.now() - start;
  a.ok(ms < 5000);
  a.equal(JSON.stringify([...data.m]), before);
  a.equal(
    input.notices.some((n) => n.includes("قابل خواندن نیست")),
    false,
  );
  a.ok(state.runs.length);
  console.log(
    "6C source benchmark",
    JSON.stringify({
      ms: Math.round(ms),
      signals: input.signals.length,
      patterns: state.patterns.length,
      diagnoses: state.diagnoses.length,
    }),
  );
});
test("quality priority appears once in executive brief", () => {
  const input = fixture(["candidate-quality"]),
    state = run(input),
    response = DA.diagnosisAdvisorAnswer(state, input, at);
  a.equal(response.observations.length, 1);
  a.equal(response.brief.flatMap((s) => s.items).length, 1);
});
