# BUILD 5G — Scale hardening and 3S Core release readiness

Verified on 2026-10-05, Asia/Tehran. No new product module, dependency, backend, authentication, analytics or AI was added. Production entry: `http://127.0.0.1:3000/scale/dashboard`. Acceptance writes used the separate `localhost` origin and explicitly named artificial records.

## Architecture and 3S Core

**SYSTEM → operational repeatability:** roles, processes, maps, analysis, standards, adoption, measurement and founder independence. **STRATEGY → direction and priorities:** cycles, choices, objectives, key results, initiatives, review, adaptation and learning. **SCALE → discovery and multiplication of growth engines:** controlled experiments, funnel/channel/loop evidence, candidate readiness, capacity and explicit decisions.

The connection is Strategy direction → Scale opportunity/evidence → System capacity → management decision. Scale reads canonical sources through `lib/scale/sources.ts`; it never writes their stores or duplicates roles. The browser cross-module test created its monetary fixture through Strategy's existing UI, then consumed it through the read-only Scale adapter. Historical assessments retain source context. A relationship is traceable evidence, not automatic proof of alignment or readiness.

App Router pages under `app/scale` render client components using `ScaleProvider`. `lib/scale` contains models, validation, mutations and pure calculations. Experiment, funnel, network and readiness data extend the existing version-1 Scale store. Dashboard, twelve reports and executive view share `dashboard/selectors.ts`, with no second reporting store or competing formulas. Current aggregates are derived; completed-period and decision snapshots are intentional persisted facts.

## Lifecycle and data boundaries

| Domain | Workflow and safeguards |
| --- | --- |
| Diagnosis/constraint | Profile and ten diagnostic dimensions inform candidate constraints. Primary must reference an active constraint; archiving clears it. Incomplete evidence remains visible. |
| Idea | Inbox capture may be incomplete. Prioritization/readiness needs an eligible constraint, intervention/rationale, impact/confidence/effort and metric concept. Conversion requires readiness; repeated conversion reuses an existing draft/ready experiment. Validation stays explicit. |
| Experiment | Draft → ready → running, pause/resume or cancel, then confirmed completion with measurement, learning and decision. Started definitions/completed history are protected; iteration/retest retains lineage. |
| Funnel | Editable structure and revenue model feed draft periods. Completion freezes stages, model and measurements. Historical rename/reorder cannot rewrite captured definitions. |
| Channel | Status/maturity changes require documented management decisions and relevant evidence. This is not a forced linear wizard. Completed periods freeze attribution and metadata. |
| Loop | Active/strengthening requires structure, owner, metric, evidence and output re-entry. Periods freeze loop/nodes/metric. Incompatible redesign suppresses misleading comparisons. |
| Candidate | Review stages are separate from scaling/prepare/hold/stopped decisions. Archive cannot re-enter. Ready editing rechecks current external sources; stale ready snapshots cannot bypass changed capacity. Source identity and child ownership remain fixed. |

Internal orphan relations fail validation instead of being silently repaired. Missing external references become unknown/notices. The provider validates before committing, preserves malformed raw data, and detects changes in another tab against the expected serialized value.

## Final calculations

Experiment increase/decrease results use direction-aware movement against baseline, target and minimum success; maintain uses target distance/tolerance; binary uses 0/1. Suggestions require manager confirmation. Missing observations remain inconclusive. Negative results with learning/decision still count toward learning discipline. An iteration family does not establish independent demand repeatability.

Adjacent funnel conversion = downstream/upstream × 100 for known valid volumes and positive denominator. Canonical constraint ranking combines target gap, drop-off, comparable deterioration and normalized downstream revenue impact. Estimated base revenue = revenue-stage volume × deal value; actual revenue is separately recorded. Required output = ceil(target/deal), then upstream = ceil(required downstream / valid conversion), recursively. Zero/missing/>100% conversion stops upstream calculation. **1.2 billion / 100 million = 12 contracts; at 30%, 40 proposals; at 50%, 80 meetings.** Temporary scenarios never change actual data. Repeat/expansion remain separate assumptions rather than automatic additions.

Primary attribution and comparable periods determine qualified-demand concentration; partial coverage is disclosed. Null spend never becomes free acquisition or zero CAC. Three non-overlapping positive channel periods suggest repeatability; a single win only suggests an early signal. Predictable/scalable maturity remains a documented management judgment. Loop output/input is descriptive, not a viral coefficient. Three compatible positive periods may support repeatable/strong states; re-entry, leakage, design compatibility and dependency still matter.

**Scale Readiness:** `round(sum(value × weight) / sum(known weights))`. Coverage is the sum of known weights; null contributes neither zero nor full credit.

| Component | Weight | Basis |
| --- | ---: | --- |
| Demand | 15 | Positive signal 65; observed non-positive 15; unavailable null. No repeated depth bonus. |
| Repeatability | 15 | Independent positives: 0/1/2/3+ → 10/30/60/80; absent depth null. Idea/experiment chain capped at one independent positive. |
| Economics | 10 | Canonical linked funnel/revenue evidence. |
| Sales | 10 | Scenario load against sales capacity. |
| Delivery/operations | 15 | Weakest relevant delivery area. |
| Team | 10 | Capacity and critical-role gaps. |
| Process | 10 | Standardization/adoption/KPI of all selected known processes; total process health is not counted again. |
| Founder independence | 5 | Selected process independence and recorded dependency. |
| Finance | 5 | Weakest known qualitative evaluation: strong 90, adequate 75, watch 45, constraint 15. |
| Measurement | 5 | Traceable measured history 75; supported management assertion 50; absent history null. No repeat-count bonus. |

Capacity utilization = load/capacity × 100 for positive known capacity; gap = required − capacity. Mapped funnel demand needs matching units and explicit period confirmation. Otherwise requirement remains unknown. Without mapping/explicit target, current load × factor is a labeled linear assumption. Different units are never summed. Default tight/overloaded thresholds are 70%/>90%, operational heuristics. Available/tight/overloaded capacity contributes 90/55/20; critical-role gaps contribute 20.

Gate: insufficient for unknown score/evidence/finance or coverage <60; high/critical risk → prepare; evidence <60 → hold; otherwise ready needs score ≥75 and coverage ≥85. Ready additionally needs owner, scenario, all selected System processes known, and sales/delivery/team/process/founder inputs known. Confidence and seven-part completeness are separate. Prep completion alone changes no readiness score. Breakpoint ranking uses severity then relative gap; its successor is a possible next constraint, not a forecast.

**Scale Health:** the same normalized known-weight formula uses constraint clarity 10, confirmed positive/partial experiments 20, canonical funnel conversion 25, independent positive channel periods 15, operational capacity 20 and learning discipline 10. Missing result is not failure. Distinct capacity areas count once. Revenue, loop evidence and composite candidate readiness stay separate to avoid additional copies of shared evidence. The lenses are not claimed statistically independent. Coverage <60 prevents confident judgment. Score bands: <40 critical, <60 unstable, <75 preparation, <90 favorable health with capacity separately reviewed, ≥90 strong engine. Health never authorizes scaling.

## Release readiness report — 31 points

1. **Issues discovered:** missing loop freshness; UTC/Tehran date drift and negative duration; filtered counts differing from rows; missing-result bias; single-lineage evidence inflation; overlapping depth credit; candidate votes dominating momentum; partial System links appearing complete; weak nested snapshot checks; source/reparent/ready bypasses; closed decision history omitted; duplicate draft conversion; archived Strategy choices; English evidence enums; skip-link focus missing.
2. **Issues fixed:** those defects were corrected. Dashboard shares one calculation-input bundle; persistence parses the previous store once. Ready review checks current sources and matching capacity/history. No new product feature or service was introduced.
3. **Lifecycle audit:** capture/design/review/decision workflows retain meaningful prerequisite guards. Constraints, channels and review stages intentionally allow documented management changes without traversing every enum. Analytics do not silently advance execution status.
4. **Entity integrity:** internal orphan relations, invalid capacity, source replacement and child reparenting are rejected before save. External missing references remain safe unknowns. History is not silently cleaned up.
5. **Experiment integrity:** the full suite covers four metric directions, missing inputs, confirmation, learning, decision, immutable completion and lineage. Browser EXP-4 used baseline 10, measurements 14/17, partial result, learning and monitor decision. Positive family counts do not become independent demand.
6. **Funnel integrity:** stage rows, constraint and health calculations remain canonical. Two new monthly artificial periods were completed through UI; historical controls became disabled. Existing 5C snapshots survived.
7. **Revenue/scenario integrity:** actual remained null while estimates/scenarios were visible. UI and tests verified 12 contracts/40 proposals/80 meetings. The current model can read the monetary KR; completed periods retain captured targets. September remains 1.5 billion; the separately selected artificial May snapshot is 1.2 billion. This is disclosed historical context.
8. **Channel integrity:** new referral channel periods contained 40/50 leads, 20/25 qualified, 4/5 customers, 400/500 million attributed revenue and missing spend. CAC/efficiency stayed unknown. Experiment link was made before start because started design/link context is protected.
9. **Loop integrity:** six-node referral loop with explicit re-entry/evidence, output 5/input 20, 30-day cycle and request-referral leakage. Its state is early evidence, not scalable. Existing tests cover design compatibility, historical snapshots and idempotent leakage conversions.
10. **Readiness integrity:** demand presence, repeat depth and measurement traceability are distinct lenses. Missing finance/System evidence prevents ready. Browser manually selecting ready was rejected with a current-evidence message. Gate, review status, confidence, completeness and decision remain separate.
11. **Capacity integrity:** 2× required 132 monthly meetings against capacity 80: gap 52, utilization 165%. Monetary-target scenario required 80: gap 0, utilization 100%, still above the conservative threshold. Founder dependency and possible next constraint remained visible.
12. **Readiness formula:** the ten-component table and gate above are final. Missing values reduce coverage and add no credit. Historical 5E assessments retain their original numbers.
13. **Health formula:** the six-lens formula above is shared by dashboard and executive reporting. Favorable health is distinguished from candidate capacity and permission to scale.
14. **History:** completed experiments, periods, assessments, source context and decisions remain fixed. 5G assessments 1–3 kept score 50 and the original 2× context after prep completion, a later KR link and a separate 1.2× assessment. Prior 5E scores 48/48/60 survived.
15. **Traceability:** ranked management focus links to the underlying constraint, experiment, funnel, channel, loop or candidate. Shared selectors derive detail/headline data. Positive evidence requires measured observations and recorded learning, not only record count.
16. **Reporting:** all twelve focused reports plus executive opened. Partial-result filter produced two rows and two completed/decided records; negative produced zero rows/counts and unknown duration. Closed-candidate decision history/filter choices are retained. Selected-period revenue matched 1.2 billion and 12/40/80 while actual stayed unknown.
17. **Strategy:** current choices exclude cancelled objectives and archived-cycle objectives/KRs; wrong-parent KR alignment fails safely. The localhost monetary fixture was created in Strategy UI with zero weight, preserving existing custom weights. Tests cover units, missing target and archived-source behavior without adapter writes.
18. **System:** selected p6 exposed health 85, standardization/adoption 100, KPI 78 and independence 100 alongside recorded high founder dependency/role risks. Composite health does not erase those risks. Scale wrote no System data or duplicate roles.
19. **3S validation:** monetary KR → current target → frozen period → backsolve → linked candidate → capacity → System risk passed in browser. The 1.2× factor was explicitly entered from a 1-billion baseline to a 1.2-billion target; it is conditional mapping, not an automatic forecast. Separate 2× history stayed available.
20. **Persistence/recovery:** version-1 round trips preserve 5A–5F data. Malformed JSON/internal relations/nested snapshots fail validation with controlled provider messaging; raw data is preserved. An absent store starts the explicitly labeled educational in-memory seed. Clearing all browser storage removes user data; no backup/import guarantee exists. Concurrent-tab changes require refresh, not automatic merge.
21. **Persian/RTL:** existing RTL/Vazirmatn preserved; current maturity/strength/dependency enums translated. Freshness/duration and displayed snapshot timestamps use Tehran. Captured historical text is untouched even if an old string contains an English enum.
22. **Accessibility:** labels/native controls, keyboard actions, drawer Escape/focus return and skip-link focus were exercised. Dense tables become labeled records at small sizes. This is targeted semantic/keyboard QA, not assistive-technology certification.
23. **Visuals:** inspected 1440×1000, 1280×900, 768×1024 and 390×844. Document width matched viewport, with no page-wide horizontal overflow. Section navigation intentionally scrolls. Mobile stacks focus panels and report records; established design retained.
24. **Performance:** requested realistic counts 20/150/150/30 funnel periods/30 channels×24 periods/20 loops/30 candidates/50 areas, and stress 50/500/500/52/75×36/50/75/100 were tested. Loops additionally have four nodes and 24/36 periods each. All 17 selectors returned finite deterministic values without input mutation. Latest dashboard 55.26/213.68 ms; loop portfolio 1.78/13.15 ms; attention 35.24/102.09 ms. These are local selector timings, not browser-render SLAs. The shared dashboard remains large; a broad split was deferred because it offered no release-correctness benefit.
25. **Tests:** **550 passed, zero failed/skipped**, including 30 new 5G tests and strengthened conversion idempotency. Suite covers Assessment/System/Strategy/Scale. `tsc --noEmit` passed. Evidence: `.build5g-tests.txt`.
26. **Build:** Next.js 16.3.5 production compilation, TypeScript and generated pages passed; production start succeeded on port 3000. No registry reinstall/security-policy change was needed. Evidence: `.build5g-build.txt`.
27. **Browser QA:** main journey, thirteen report views, filters, four kinds of history, valid/missing deep links, nested refresh, Back/Forward, keyboard and responsive views checked. No captured console warnings/errors or hydration failures. HTTP verification: 29 Scale pages plus 58 referenced static assets returned 200 (`.build5g-http.json`). An early connection-refused page before server restart was resolved. A rapid history sequence briefly showed stale content; paced navigation/reload was rechecked successfully. No manual localStorage editing.
28. **Limits:** browser/local persistence; no server backup, multi-user collaboration, authentication, real-time sync, external analytics or AI/Agent layer. Attribution, comparability, units and management judgments are supplied manually. Scores/thresholds are transparent heuristics, not causal proof, advanced finance or forecasts. Acceptable boundaries for local v1.
29. **SCALE closure:** ready within the documented local single-browser scope and tested workflows; no unresolved blocking implementation failure found. Acceptance reused the existing saved profile/diagnosis, lever library and configured funnel, rather than recreating everything from an empty workspace. Prior 5A/5C acceptance covers those creation editors. Workspace evidence/completeness warnings are expected business-state warnings.
30. **3S Core closure:** ready as the local Core, supported by prior System/Strategy hardening reports, the complete passing suite and current read-only integration checks. This is not a hosted/multi-user production release claim.
31. **Before AI/Agents:** no local-Core code blocker remains in verified scope. The next separately authorized build should define read/write contracts, reviewable proposed actions and immutable-history safeguards. Backup/auth/sync become requirements only if that next build needs them; none was added here.

## Browser acceptance trail

| Requested steps | Evidence |
| --- | --- |
| 1–8 Profile → ready idea | Saved B2B/repeatability context reviewed; new primary constraint and existing referral lever used for the 5G idea; prioritized then ready. |
| 9–19 Experiment → decision | Structured hypothesis/design/metric, baseline 10/target 20/minimum 15, explicit start, 14/17 measurements, confirmed partial, learning and monitor decision. |
| 20–24 Funnel/history/revenue | Existing six-stage model retained; June/July artificial periods completed; temporary doubled-volume scenario checked; monetary KR configuration preserved previous history. |
| 25–27 Channel/history/link | New channel and two periods; linked before start to respect immutable experiment context, requiring dependency reordering of the requested sequence. |
| 28–30 Loop/period/leakage | Six-node referral loop, re-entry/evidence, completed period and request-referral leakage. |
| 31–40 Candidate/capacity/decision | Loop candidate with owner/objective/p6; 2× scenario, monthly meeting capacity, System review, assessment, prep creation/completion, unchanged reassessment and explicit prepare decision; later separate monetary-KR scenario. |
| 41–43 Dashboard/reports | Dashboard, twelve focused reports and executive view opened; filtered counts and selected-period revenue/capacity compared. |

Synthetic records remain labeled `پذیرش 5G` in localhost for review and are not real business results. `127.0.0.1` has separate browser storage. Screenshots: [dashboard](build-5g-dashboard.jpg), [cross-module candidate/history](build-5g-cross-module.jpg).
