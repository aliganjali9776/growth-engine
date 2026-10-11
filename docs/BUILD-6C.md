# BUILD 6C — Manual cross-module diagnosis

Implemented on 2026-10-05. This is a local, read-only prototype. Analysis runs on request, with no scheduler or domain writes.

## Completion report

1. **Architecture:** canonical System/Strategy/Scale selectors → frozen evidence → signals → connected patterns → collapsed diagnoses → recommendations and executive priorities. `lib/agent/diagnosis` owns the new layer.
2. **Signal model:** identity, type, domain, description, severity, entity references, evidence references, first/last detection, fingerprint, source family/key and confidence. The contract supports twelve signal types; adapters emit the types supported by available evidence.
3. **Lifecycle:** present signals become Active; absent signals with readable sources become Resolved; missing sources or replacement quality gaps become Stale. Suppressed is a supported contract state, not an autonomous suppression policy.
4. **Patterns:** stable IDs, rule ID, explicit primary entity, signal/evidence/entity links, strength and detection dates. Repeated matches merge their references rather than overwrite them.
5. **Pattern types:** eleven types are defined, including execution/result mismatch, cross-module constraint, founder impact, resource overload, data quality, alignment and opportunities.
6. **Registry:** fifteen enabled rules expose descriptions, required domains, evaluation, severity/confidence explanations and dedup keys in `rules.ts` and `/dev/agent`.
7. **Initial rules:** linked KR/funnel/process chain; execution/result gap (including improving conversion without increasing measured revenue); growth/capacity; strategy/capacity; founder impact (including a measured volume increase); positive experiment/process readiness; KR data quality; readiness data quality; owner load/KR risk; growth alignment; scaling decision/readiness contradiction; ready candidate opportunity; repeated blocker/process risk; repeated negative experiments on the same recorded lever; scaling channel concentration. Domain thresholds come from existing selectors.
8. **Linking:** only explicit constraint → KR/process, candidate → KR/process, source channel/loop and frozen review relationships. Names are not used to infer relationships. Current strategic performance is scoped to the active cycle.
9. **Diagnosis model:** title, summary, category, severity, confidence, impact, linked patterns/evidence/entities, management question, lifecycle, timestamps, independent source families, recurrence count and recommendations.
10. **Confidence:** quality gaps and conflicting opportunity/constraint evidence lower confidence. High requires at least three distinct source families and two signal-producing domains. Repeated scans do not increase confidence. This is an ordinal heuristic, not a calibrated probability; copied metrics from one family are counted once.
11. **Severity:** combines registry severity and canonical source signal severity. Wording cannot change it. No monetary loss is invented.
12. **Impact:** Localized, CrossFunctional or Strategic from connected entity domains. Material is supported by the contract but currently not assigned by a separate magnitude model.
13. **Priority:** deterministic ordinal ordering by severity, confidence, reach, capacity, strategic connection, overdue evidence and repeated observation; maximum three. All factors are visible in the debug view. Repeated observation is scan persistence, not proof of continuous duration between scans.
14. **Collapse:** related risk patterns share one primary entity issue; quality and opportunity are separate lenses. No global collapse by owner or merely by domain. Fingerprints are deterministic non-cryptographic identifiers.
15. **Resolution/reopen:** absent patterns resolve only with usable source data. Historical evidence remains. Recurrence reopens the same diagnosis ID. Reviewed, Monitoring and Dismissed survive reruns; dismissed issues do not automatically reopen.
16. **Opportunity:** a canonical ready gate, valid strategic link and no readiness risk produce a conservative opportunity to review. Improvement score and linked loop strength are recorded where available. It never issues an automatic scale instruction.
17. **Data quality:** stale/missing KR confidence and insufficient readiness create low-confidence CollectData recommendations, rather than claims of proven performance decline.
18. **Hybrid:** optional, manual wording for the first executive priority through the existing 6B server provider and bounded evidence packet (six compact records, no full stores). The existing strict advisor output is projected into four allowed fields: diagnosisTitle, diagnosisSummary, managementQuestion, businessRationale. The apply layer rejects extra fields, unsupported numbers and explicit causal certainty. Canonical severity, confidence, links, statuses and ranking stay unchanged. This reuses the 6B transport schema rather than adding a new native four-field provider endpoint.
19. **Fallback:** missing real provider, network/validation/model failures preserve the deterministic run and show a visible fallback notice. No API key is required for the core engine.
20. **Advisor:** new detected-insights count and links. Executive current-problems questions read the latest diagnosis plus current evidence. Changed signatures produce a stale warning, not a fresh problem claim. Existing unrelated Q&A remains on the 6B provider path.
21. **Insights UI:** `/advisor/insights`; manual scan, last run, freshness warning, optional wording, top three, new issues, opportunities, monitoring/reviewed, quality and recently resolved sections; Persian empty state.
22. **Detail:** `/advisor/insights/[id]`; impact/confidence, management question, entity links, pattern → signal → evidence disclosures, recommendation, optional status reason and frozen history. Invalid IDs show a friendly fallback.
23. **Brief:** executive brief uses latest diagnoses when available, with an opportunity/quality section and current evidence. It works without a connected model; stale analysis is explicitly identified. Entity-specific briefs retain 6B behavior.
24. **Snapshots:** evidence IDs derive from source family, entity key and semantic value. Changed facts append a new immutable record. History events keep old evidence references and summaries. The signal graph shows the latest signal facts; history shows earlier facts.
25. **Persistence:** additive `growth-engine.agent.diagnosis.v1`; old 6A and 6B keys remain intact. Version validation, reference validation, internal routes, duplicate IDs, 4 MB bound and compare-before-write protect storage. Corrupt or oversized prior data is preserved; there is no destructive migration or silent history truncation.
26. **Read-only:** source adapter receives only getItem. Engine is pure and copies inputs. Only diagnosis artifacts and existing advisor conversation artifacts are saved. No capability Prepare/Execute, domain mutation, background scan, notifications, external search or new service was added. Freshness checks inspect relevant revisions/metric/link fields without running selectors or rules on focus/storage events.
27. **Performance:** tested 50 processes, 100 KRs, 500 experiments, 75 channels, 50 loops and 75 candidates; canonical source collection plus deterministic analysis completes below 0.5 seconds on this machine. A separate 750-signal fixture remains below the five-second guard. Canonical selectors retain their existing internal complexity; the new layer uses maps/sets and bounded wording packets.
28. **Tests:** 36 new tests, 666 total passing. Coverage includes connected closing-chain collapse, stale data quality, opportunities, dedup, immutable inputs/evidence, missing sources, resolve/reopen, all status workflows, concurrency/corrupt storage, dangling evidence, unsafe routes, advisor persistence, hybrid invariants and large fixtures. TypeScript and production build pass. The golden assertions test the normalized engine inputs; the large fixture separately exercises canonical source parsing/selection.
29. **Browser QA:** manual localhost scans, evidence/detail pages, Reviewed/Monitoring/Dismissed with reason, reload persistence, manual Resolved followed by recurring scan/Reopened, optional wording offline fallback, Advisor entry and executive brief, missing IDs, debug view, desktop/tablet/mobile and console checks. Business source edits for resolve/reopen were covered through immutable unit fixtures; existing browser business stores were deliberately not edited. Live provider wording was not exercised because a real provider is not configured.
30. **Dependencies:** none added.
31. **Issues:** fixed repeated-family fingerprint collisions before pattern evaluation, stale-quality replacement falsely resolving performance, preserving multiple matches at one primary entity, and enabling offline diagnosis questions/briefs in the Advisor. Model-not-connected is an expected configuration limitation, not an engine failure.
32. **Documentation:** this file and the appended pipeline in AGENT-ARCHITECTURE.md. Verification logs: `.build6c-tests.txt`, `.build6c-build.txt`, `.build6c-focused.txt`; browser/HTTP evidence recorded separately.
33. **BUILD 6D / follow-up:** retain this read-only foundation. Any later action workflow must use 6A permission/approval/audit boundaries. Calibrated confidence, richer strategic weights, durable backend/history storage, and independently confirmed real-provider wording remain future work. No autonomous or domain-write behavior is enabled by this build.

## Practical limitations

- This is a first deterministic registry, not a claim to have implemented every conceivable combination in the brief. Ready-candidate opportunities are conservative; standalone emerging-loop opportunities without a ready assessment are not emitted.
- Suppressed signals and Material impact are contract support only. There is no suppression editor or separately calibrated impact model.
- Local compare-before-write catches ordinary concurrent edits but is not a transactional database.
- Historical source timestamps are not always provided by canonical selectors. Evidence `createdAt`/`timestamp` records the observation time; source values and source selectors remain visible.
- Diagnostic artifacts are origin-specific, like existing local business stores. `localhost` and `127.0.0.1` do not share them.


## Final verification artifacts

- Final production server starts at `http://127.0.0.1:3000` (270 ms startup in this run).
- 46 HTTP route and asset checks passed; results in `.build6c-http.json`.
- Browser details in `.build6c-browser.json`. No console warnings/errors were observed in the inspected final pages.
- Desktop 1280×900: client/content 1265/1265; tablet 820×1180: 805/805; mobile 390×844: 375/375. No horizontal overflow. Viewport override reset after testing.
- Screenshots: `build-6c-desktop.jpg`, `build-6c-tablet.jpg`, `build-6c-mobile.jpg` (localhost acceptance dataset).
- Final 127.0.0.1 scan correctly identified stale KR evidence as low-confidence data-quality diagnoses. It did not assert proven business performance decline.
- Client production bundles contain no `OPENAI_API_KEY`, provider transport URL or OpenAI server-provider class.
