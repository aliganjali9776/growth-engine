# BUILD 6G — Agent v1 hardening and release review

Date: 2026-10-06. Scope: harden the existing 6A–6F implementation. No new product module, dependency, autonomous execution, executable capability, authentication system or integration.

## Findings and fixes

| Finding                                                                  | Correction                                                                                    | Evidence                                                |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Positional evidence IDs could collide across unrelated context snapshots | Stable source/entity/type/value/summary/timestamp identity; old historical snapshots retained | Stable/changed identity regression                      |
| Previous subject messages could enter another subject's provider request | Only same explicit context's six latest bounded messages                                      | Scoped-history regression                               |
| Async response could be saved after context/session change               | Capture request session, abort on change, verify current session before save                  | Request-match regression and abort guard                |
| Authorization could change after initial validation                      | Recheck permission and capability against fresh action immediately before commit              | Revoked permission/disabled capability fault tests      |
| Compensation did not require original actor/organization                 | Require both, plus existing permission/unchanged/unlinked checks                              | Wrong actor/linked result tests                         |
| Missing LTV/share/productivity could fall through to generic wording     | Explicit data-gap response; finite actual Metric evidence only                                | Missing/scenario/target tests                           |
| Duplicate message/artifact IDs caused ambiguous history                  | Reject duplicates without overwriting corrupt raw storage                                     | Duplicate/corrupt tests                                 |
| Missing canonical artifacts had active links                             | Disable unavailable references and label them                                                 | Code review and missing-action browser route            |
| Rejection history showed proposal rationale                              | Display actual rejected approval reason                                                       | History regression suite/code review                    |
| Shorthand execution/focus return needed hardening                        | Shorthand opens review only; restore stable composer focus                                    | Four shorthand tests and mobile Escape                  |
| Large preparation fixture exceeded 8 MB due to duplicated snapshots      | Compact encoding omits only exactly equal snapshots; decode before binding validation         | Compatibility/unknown codec/binding/large fixture tests |
| Fresh diagnosis-free contextual recommendations expired incorrectly      | Only require diagnosis when a diagnosis ID exists; source changes still expire recommendation | Browser discovery, regression, successful golden path   |

Preparation fixture bytes decreased from 10,864,215 to 7,729,256 UTF-8 bytes. Different snapshots remain intact. Browser localStorage quotas may be lower and use different accounting: this does not guarantee persistent capacity. Quota errors preserve previous data and block saves.

## Final architecture and execution invariants

Business OS Data → Canonical Selectors → Agent Context → Evidence → Signals → Patterns → Diagnosis → Recommendation → Draft → Approval → Explicit Execution → Domain Validation → Verification → Audit → Management History.

The LLM stays in bounded analysis/wording. It has no write adapter, approval authority, registry mutation or execution tools. Text intent selects explicit controls. Templates are deterministic. Only the central execution engine reaches canonical domain mutation services.

| Invariant                                      | Enforcement / limit                                                                                                   |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| LLM cannot mutate business state               | Strict provider schema contains no executable command; analysis/preparation tests compare domain storage before/after |
| Text cannot bypass explicit approval/execution | Intent returns UI controls without approval/journal mutation                                                          |
| Only whitelisted capabilities execute          | Eight create adapters; remaining templates and High/Critical operations blocked                                       |
| Approved revision equals executed revision     | Revision/payload/context/evidence binding; edits expire approval                                                      |
| Stale state blocks execution                   | Source/expected-state validation, dry run and fresh commit checks                                                     |
| Domain validation is authoritative             | Canonical services validate relations, owner and active cycle                                                         |
| Successful commands are idempotent             | Stable command/entity IDs; duplicates return original result; retry verifies before replay                            |
| Agent mutations have audit records             | Persist Executing journal before commit; append result/recovery audit; browser multi-key writes are not atomic        |
| Historical evidence remains preserved          | Frozen evidence/revision snapshots and completed journal bindings                                                     |
| Unknown is not a business fact                 | Gaps remain gaps; targets/scenarios do not qualify as observations                                                    |

These protect application paths. Browser persistence and local actor hooks do not authenticate users or secure manual developer-tool edits, same-origin compromise, storage loss or distributed concurrent writes.

## Whitelist and template audit

Exactly eight executable creates remain: `system.createImprovement`, `system.createKPI`, `strategy.createObjective`, `strategy.createKR`, `strategy.createInitiative`, `scale.createGrowthIdea`, `scale.createExperiment`, `scale.createPreparationItem`.

All sixteen templates were exercised against canonical capability mappings and validation. Other templates, owner/target changes, deletions/cancellations and high-risk mutations remain preparation-only. Low risk still requires explicit approval. Creating a record does not activate an experiment, complete operational work, or prove revenue/growth impact.

Only an unchanged, unlinked created GrowthIdea supports compensating archive by the original actor/organization with permission. Other rollback is explicitly unsupported. No destructive delete or whole-domain snapshot restore exists.

## Context privacy, injection and provider safety

Canonical selectors provide selected entities and recorded connections. Limits: 32 KB context, 20 evidence records, 10 entities, six same-context history messages, 48 KB incoming request. No full localStorage/unrelated conversation/audit dump is sent. Development-only logging records byte/character/evidence counts, never content or secrets. Production omits that metadata logging.

Stored injection fixtures cover SOP text, GrowthIdea text, experiment notes, Strategy notes, customer feedback and process descriptions. They remain untrusted evidence. Fabricated IDs, extra executable response fields and script-shaped output are rejected or rendered as text. Browser injection note on localhost did not grant authority; changing that source invalidated approval. Note was restored through the normal editor. No model was connected: this tests application authority, not empirical resistance of every live LLM to injection.

Provider remains server-only, fixed endpoint, bounded output/timeout and strict structured schema with sanitized errors. Same-origin, client marker, content type, size and schema checks are not authentication. Numeric checks cannot formally prove all generated prose correct or authenticate client-supplied facts.

| Failure              | Test evidence       | Behavior                                                         |
| -------------------- | ------------------- | ---------------------------------------------------------------- |
| Missing key/provider | Unit, HTTP, browser | Explicit offline status; local deterministic tools remain usable |
| Invalid key          | Transport double    | Sanitized failure, no domain writes                              |
| Timeout              | Transport double    | Bounded request and safe retry message                           |
| Rate limit           | Transport double    | Controlled failure, no business-write replay                     |
| Network failure      | Transport double    | Safe failure independent of local tools                          |
| Invalid JSON/schema  | Transport doubles   | Reject invalid output                                            |
| Empty/partial output | Transport doubles   | Reject incomplete result                                         |

**Real-provider smoke was not run:** no actual key configured; GET /api/advisor returned provider=none, connected=false. No credential was added or printed. HTTP smoke refuses to run against a live provider.

## Persistence, execution and recovery

Edits invalidate approval; rebuilding preserves user fields and rebinds context. Missing owners/constraints, inactive cycle, changed source and wrong revision block execution. Uncertain post-mutation results are reread using stable created IDs before any replay. Fault tests cover failure before mutation, a persistence operation that writes then throws, duplicate execution through two handles, corruption and codec compatibility.

Completed journal bindings are immutable through normal saves. Evidence remains frozen even if current source changes. Audit describes actual mutation rather than achieved business impact. Old 6A–6F keys remain readable and unchanged by reads. Preparation remains version 1 with optional compact encoding marker; unknown marker fails closed. Corrupt/conflicting/quota-limited saves preserve previous raw storage. No automatic domain reset or repair was added.

## Verification

- **847 tests passed / 0 failed / 0 skipped**, including **77 new tests** over the 770 baseline. Existing System, Strategy, Scale and earlier Agent suites remain included.
- TypeScript check passed.
- Next.js 16.3.5 production build passed, generating 47 static outputs plus dynamic routes.
- Production server starts at http://127.0.0.1:3000.
- `node tests/release-http.cjs`: **67 route, asset and API checks passed**. Includes missing action, offline response, disallowed origin, client marker, content type, invalid JSON, oversized request, unknown executable field and mutation policy. Expected 400/403/413/503 are intentional safety/offline responses.
- Logs: `.build6g-tests.txt`, `.build6g-types.txt`, `.build6g-build.txt`, `.build6g-http.json`.

### Browser checks actually performed in 6G

The canonical localhost Revenue KR opened its correct context. Source had current=0, target=1.2 billion and unknown confidence: a data-quality case, not justified OffTrack classification. Offline explanation used recorded values and linked process evidence. Contextual Improvement draft title/date edits produced revision 2. Approval alone did not create a System record. Dry run remained separate; explicit execution created and verified the result. The actual System improvements page displayed **بهبود پیگیری قرارداد · آزمون انتشار 6G**, ID `3025cdde-c1bc-46b5-a095-ac0ca45e675f`. Completed controls were disabled; automatic rollback was correctly unsupported.

Refresh resumed the session; management history linked the completed action and its deep link reopened the original result without replay. A second draft was completed at mobile size. Text approval opened a drawer but required explicit confirmation. “همینو بزن” opened execution confirmation without writing; Escape returned focus to the composer. Editing p6's note from a second localhost tab invalidated first-tab approval and disabled dry run/execute. Another text execution request could not open a runnable confirmation. Original note was restored through normal UI. The stale draft remains for review.

Widths 1440/1280/820/390 showed no horizontal document overflow (scroll widths 1425/1265/805/375); offline pill wraps on mobile. Keyboard/modal/focus, source-page/back/refresh/history/deep-link, missing-action, Insights, Actions and Dev views checked. Fresh production console checks returned no errors/warnings and no reproduced hydration error. One browser automation dispatch timed out; inspected state then successful retry showed no application error.

An additional full mobile flow created **آزمون بازگردانی محلی · انتشار 6G** through explicit approval/dry-run/execute, then explicitly compensated it by archive. The audit timeline retained request, validation, storage start, canonical verification and both compensation entries. Browser back/forward retained the session; console remained empty. Changing a locked subject required its explicit context-change confirmation.

Screenshots: `build-6g-final.png`, `build-6g-result.png`, `build-6g-tablet.png`, `build-6g-mobile.png`, `build-6g-mobile-result.png`.

This does **not** claim all 42 requested browser cases were individually forced in a browser. Provider/disk/quota/post-mutation failures, simultaneous execution, every adapter/template, diagnosis resolution/reopening, empty/corrupt storage and migration are tested through automated fixtures. No real screen-reader or formal contrast audit was run. Desktop Improvement create and mobile GrowthIdea create/compensation passed. 6E/6F browser evidence is historical, not newly rerun 6G evidence.

### Performance

Synthetic in-memory Storage: 100 sessions / 2,000 messages / 300 diagnoses / 500 recommendations / 750 drafts / 300 journals plus canonical domain fixtures. Real-shaped snapshots/IDs are cloned for load tests; these are not 300 distinct real transactions.

| Operation                        | Final measured ms |
| -------------------------------- | ----------------: |
| Workspace resume/read            |              6.26 |
| Preparation decode/read/validate |            170.16 |
| Journal read                     |             47.93 |
| Executive context                |             43.17 |
| KR context                       |             55.41 |
| Process context                  |             40.19 |
| Constraint context               |             41.61 |
| Fifteen diagnosis rules          |             29.09 |

Packets remain below 32 KB. Existing domain load regression also covers 500 experiments, 100 KRs, 75 channels, 50 loops and 75 candidates. Measurements are test-runtime timings, not browser-rendering or persistent-capacity guarantees. Linear preparation JSON validation may still block slow devices at extreme size. Browser quota remains a practical limit. No broad component rewrite was justified.

## Required 40-point release report

1. **Issues discovered:** Evidence collisions, history/async context privacy, commit authorization timing, rollback identity, missing metrics, ambiguous storage IDs, missing links, rejection rationale, focus/shorthand, duplicate snapshot size, false recommendation staleness.
2. **Issues fixed:** Findings table above; no authority or executable-scope expansion.
3. **Final architecture:** Canonical source to evidence/diagnosis/draft/approval/explicit execution/validation/verification/audit/history; model bounded to analysis.
4. **Invariants:** Ten application-path invariants above; local persistence is not production security.
5. **Capability/permission audit:** Code registry, enabled read boundaries, fresh execution permission, original actor/organization compensation.
6. **Whitelist audit:** Exactly eight creates; no high-risk updates, deletes, owner/target changes or autonomous writes.
7. **Context routing:** Explicit selected subject; drafts retain original target; ambiguous ordinal requires selection.
8. **Provider boundary:** Server-only secret, fixed transport, bounded schemas, no model tools/domain writes.
9. **Injection results:** Six source fixtures and hostile output/ID tests pass; localhost note gains no authority. Live model remains untested.
10. **Hallucination/gaps:** CAC/LTV/share/productivity gaps explicit; scenarios/targets not measured results; arbitrary prose not formally proven.
11. **Diagnosis:** Fifteen rules, logical dedupe, resolution/reopening and frozen history pass; absent evidence is not resolution.
12. **Recommendations:** Relevant source-version guards retained; diagnosis-free recommendations no longer expire without actual source change.
13. **Draft/templates:** Sixteen mappings/validators tested; unknown owner/entity not invented; user edits preserved.
14. **Approval:** Exact revision/binding, explicit decision, stale/edit expiry; approval alone never executes.
15. **Execution:** Fresh authorization, canonical adapters, journal before mutation and verification after.
16. **Stale protection:** Automated second-handle tests and actual two-tab source change block old approval.
17. **Revision binding:** Edit invalidation; compact decode restores identical bound snapshots.
18. **Idempotency:** Two-handle duplicates return original journal/result with one create; completed UI cannot rerun.
19. **Verification:** Actual domain reread before Succeeded; browser System record checked; business impact not assumed.
20. **Recovery/rollback:** Eligible GrowthIdea archive only; actor/unchanged/unlinked guards; uncertain result verified before replay; others unsupported. Actual mobile create/compensation and preserved timeline verified.
21. **Audit/history:** Completed bindings immutable through normal API; frozen evidence and actual rejection rationale retained.
22. **Workspace:** Integrated evidence/draft/review/result flow, wrapped offline status, unavailable artifact labels.
23. **Sessions/history:** Resume/deep links and bounded same-context history; duplicate IDs fail closed; legacy unscoped messages excluded from provider.
24. **Evidence:** Stable source-sensitive identity, canonical links, frozen snapshots and explicit missing values.
25. **Cross-module:** Recorded links and deterministic signals; co-occurrence not causality; Revenue KR linked process reviewed.
26. **Offline:** Local analysis/preparation/approval/execution remain usable; golden create passed without provider.
27. **Real-provider smoke:** Not run because no real key; doubles are not represented as live tests.
28. **Storage migration:** Old keys/formats preserved; additive compact marker; unknown/corrupt/quota/conflict fail closed.
29. **Concurrency:** CAS/reloads provide best-effort local detection; no atomic multi-key transactions/distributed locks.
30. **Accessibility:** Labels, explicit buttons and mobile Escape/focus checked; formal screen-reader/contrast certification not performed.
31. **RTL/responsive:** Four widths checked; no horizontal overflow; screenshots saved.
32. **Performance:** Required fixture passes, preparation below internal 8 MB cap; browser quota and linear validation limits disclosed.
33. **Tests:** 847/847 pass; 77 new regressions, no failures or skips.
34. **Build:** Next.js 16.3.5 build and TypeScript pass; production server running locally.
35. **Browser QA:** Golden create, offline gaps, explicit controls/focus, stale two-tab case, history/results/navigation/responsive checked. Fault cases covered by tests rather than browser corruption.
36. **Dependencies:** None added/upgraded; no security policy modified.
37. **Limitations:** Local actor, browser quota/loss/tampering, nondurable audit, best-effort concurrency, limited compensation, no live-provider smoke, formal accessibility untested, large-size main-thread cost.
38. **Agent v1 closure:** Scoped local prototype hardening milestone ready with disclosed limits; not production-security certification.
39. **Full 3S v1 closure:** System/Strategy/Scale/Agent regressions and release build pass; local v1 scope can close. Multiuser production readiness cannot close without backend authorization/persistence/transactions.
40. **Next phase:** Separate backend design with authenticated identity, server-authoritative approval/execution, durable audit, transaction/idempotency guarantees and quota-independent persistence, followed by real-provider/formal accessibility acceptance. None added in this build.
