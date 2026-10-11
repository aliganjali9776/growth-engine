# BUILD 6A — Agent architecture

Date: 2026-10-05. Growth Engine by 1 Minute Manager. Existing 3S Core preserved. All execution is dry-run.

## Completion report

1. **Architecture:** deterministic provider-independent core under `lib/agent`, separate browser storage adapter and `/dev/agent` lab.
2. **Models:** typed context, business snapshot, capability, permission, evidence, entity ref, observation, recommendation, proposal, approval, execution result, audit, packet, controlled tool/result and future provider interface.
3. **Authority:** Observe / Recommend / Prepare / Execute; execute always needs explicit approval.
4. **Registry:** 42 code-defined capabilities with domain, authority, risk, schema metadata, permissions, enabled flag and approval policy.
5. **Read capabilities:** 20 registered reads use compact canonical source projections. Selected Process/KR reads return a bounded entity snapshot; missing entities give controlled errors. Weekly trend is a compact period projection.
6. **Prepare capabilities:** ten draft stubs return context drafts without domain writes; they do not pretend to generate complete production forms.
7. **Write contracts:** eleven action-specific mock payload contracts; no real mutation adapter. Creation contracts use an existing entity as the mock context anchor and need complete live schemas before activation.
8. **Permissions:** per-capability exact authority allowlist; rechecked at execution. Disabled or unknown capabilities cannot run.
9. **Approval:** AlwaysRequired for every write, explicit approval/rejection, 24-hour expiry, exact proposal/evidence binding, five rejection choices.
10. **Evidence:** System/Strategy/Scale source labels, routes, typed values and entity refs; actual entity evidence added to action preview.
11. **Snapshots:** copied and persisted at artifact creation; source changes cannot rewrite prior evidence.
12. **Recommendations:** three deterministic rules, priority, rationale, confidence, source citations and suggested prepare capabilities.
13. **Observations:** factual canonical signals stored separately from recommendations, with audit events.
14. **Cross-module context:** only explicit KR → constraint → experiment → process links trigger the cross-module rule; absent links are not invented.
15. **Packets:** Executive / Process / Objective / KR / Constraint / Experiment use a shared typed envelope and selected-entity filtering; no full domain-store copies.
16. **Orchestrator:** capability lookup, permission validation, read/draft dispatch and bounded deterministic recommendations.
17. **Executor:** centralized approval, contract/payload, fresh entity, expected-state and idempotence checks; controlled error envelopes.
18. **Dry-run:** no live write adapter; success explicitly means simulation and no domain change.
19. **Staleness:** older 500→700 proposal is blocked when current target becomes 600; UI conflict simulation changes only an isolated read projection.
20. **Idempotence:** simulated, rejected, expired or failed proposals cannot be re-executed; tested after JSON restoration.
21. **Audit:** observation, recommendation, prepared action, approval request/approve/reject, simulated execution and controlled failures, with time/refs/result.
22. **Developer page:** nine required sections; navy/gold, Vazirmatn, RTL; explicit development label, no chat or floating Agent.
23. **Demos:** live-data recommendation, prepare stub, numeric KR preview, request/reject/approve, dry-run, conflict and duplicate prevention. Rules without matching data show no invented recommendation.
24. **Persistence:** `growth-engine.agent.v1`; independent validation, size/list bounds, compare-and-swap, malformed-data preservation and explicit reset.
25. **Safety:** no LLM/API/backend/credentials/autonomous writes; domain text is data, error messages omit stacks, all sensitive writes remain approval-only.
26. **Tests:** see final validation results below. Agent tests cover registry/unknown/disabled, wrong input/domain/entity, insufficient permission, approval/expiry/rejection, stale/duplicate, evidence freezing, exact bindings including undefined optional fields, audit, corrupt storage and unchanged domain stores.
27. **Performance:** 5,004 mock entities/evidence verify bounded packet assembly; a separate 500-process canonical source benchmark exercises actual parsers/System selectors. Sizes and timings are printed in `.build6a-agent-tests.txt` / full-suite output. This is a local benchmark, not a production latency guarantee.
28. **Browser QA:** final results recorded below after production verification; no business edits are required.
29. **Dependencies:** none added. Existing Next/React/Radix/styles reused.
30. **Issues:** browser uncovered a binding mismatch after undefined fields were omitted by JSON; fixed canonical serialization and added regression coverage. Initial browser tab attach timed out; recovered through the selected browser's documented new-tab API. New domain source projections were typechecked against real interfaces.
31. **Documentation:** this report plus `docs/AGENT-ARCHITECTURE.md`, which includes the flow and live-adapter boundary.
32. **Remaining for 6B:** any model/provider integration, chat, richer structured preparation, complete domain write schemas and real adapters, authenticated authorization/server persistence, multi-user concurrency and external tools remain absent. None is enabled implicitly by 6A.

## Validation results

- Full test suite: **586 passed, 0 failed**; includes **36 Agent tests**. `.build6a-tests.txt` contains the output.
- TypeScript: passed. Next 16.3.5 production build: passed, including the new static `/dev/agent` route. Output: `.build6a-build.txt`.
- Production server: `http://127.0.0.1:3000`; lab at `/dev/agent`. Browser acceptance artifacts were created only in the separate Agent key on `localhost`.
- HTTP checks: `/dev/agent`, System command center, Strategy dashboard and Scale dashboard all 200; 18 observed Next assets all 200. `.build6a-http.json`.
- Browser: all nine sections/42 registry entries/permission matrix, three-domain live evidence, live missing-evidence recommendation, proposal preview, reject, approval, successful dry-run, duplicate block, isolated stale conflict, audit and reload persistence verified. Real selected KR target remained **100**, not 700 or 600.
- Keyboard: Tab moves between controls; Escape closes approval drawer and returns focus to its opener.
- Mobile 390×844 and tablet 820×1180: visually checked; document scroll width equals client width (375/375 and 805/805 respectively). Tables scroll locally. Desktop checked at the normal browser size.
- Console warnings/errors: none observed during final acceptance flow; no hydration errors observed. This is not an exhaustive check of every existing route or every browser.
- Actual-source 500-process benchmark: **206.87 ms**, Executive packet **6,506 bytes**. Packet assembly with 5,004 entities/evidence: Executive **10,339 bytes**, KR **582**, Process **578**, Constraint **914**; 0.72–1.07 ms locally. Evidence/refs/history remain capped.
- Screenshots: `docs/build-6a-action.jpg` (approval/execution audit), `docs/build-6a-mobile.jpg` (mobile overview).
- Rule A/B demonstrations were exercised with isolated unit fixtures; the current localhost data matched Rule C. No business records were fabricated or edited to force other recommendations. Corrupt-storage recovery, expiry, unavailable entities/permissions and exact stale 500→600 checks were tested with isolated storage/context fixtures.

