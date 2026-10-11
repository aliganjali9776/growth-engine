# BUILD 6E — approval-based execution

Growth Engine by 1 Minute Manager. Completion report, 6 October 2026.

BUILD 6E adds explicit, limited domain execution to the existing 6D preparation flow. Approval does not execute. There is no autonomous, bulk, background, high-risk, destructive, or external execution. This remains a local browser prototype, not a production transaction or authorization service.

## 1. Execution architecture

`lib/agent/execution` contains contracts, an explicit registry, domain adapters and the central executor. `lib/execution-storage.ts` owns the additive journal. `components/advisor/execution.tsx` presents dry run, separate confirmation, verification results, recovery and history. The flow is Evidence → Signal → Pattern → Diagnosis → Recommendation → Draft → Approval → Execution → Verification → Audit.

## 2. Execution whitelist

| Draft template | Executable capability | Created object / initial behavior | Rollback |
| --- | --- | --- | --- |
| Improvement | system.createImprovement | System improvement, backlog | Unsupported |
| KPI | system.createKPI | System KPI, draft | Unsupported |
| Objective | strategy.createObjective | Objective, draft | Unsupported |
| KR | strategy.createKR | New KR in canonical active lifecycle; no existing target changes | Unsupported |
| Initiative | strategy.createInitiative | Proposed initiative, zero progress | Unsupported |
| GrowthIdea | scale.createGrowthIdea | Idea, inbox | Conditional compensating archive |
| Experiment | scale.createExperiment | Experiment, draft; never starts | Unsupported |
| ScalePreparation | scale.createPreparationItem | Canonical preparation item; no readiness completion | Unsupported |

## 3. Enabled executable actions

Only these eight creates are enabled. Valid user input, low/medium risk, current approval, permissions and domain prerequisites are still necessary. Four capabilities were added to the shared registry; registry membership alone never enables execution.

## 4. Disabled High/Critical actions

All High/Critical actions are excluded. SOP changes, ownership changes, existing KR target changes, cancellations, constraint updates, Strategy decisions, Executive Decision Notes and Action Plans remain preparation-only. Improvement updates were not enabled because the current prepared contract has no audited update semantics. No delete adapter exists.

## 5. Domain command contract

`AgentDomainCommand` carries commandId, capabilityId, domain, entityType, operation, approved payload, sourceActionId, expectedState and requestedAt. `AgentDomainCommandResult` defines success, entity reference, minimal before/after, warnings, errorCode and executedAt. The current in-process executor exposes the result through its richer execution record, rather than a remote command transport.

## 6. Domain adapters

System uses `createMeasurementItem` and `persistMeasurement`; Strategy uses existing `saveObjective`, `saveKR`, `saveInitiative` and shared `persistStrategy`; Scale uses existing `saveIdea`, `saveExperiment`, `savePreparation` and `persistScale`. The Agent does not write domain storage directly. Strategy and measurement providers share the same canonical persistence functions. A command writes one intended domain key; System measurement creates do not rewrite the System store.

## 7. Approval binding

Approval binds the canonical draft metadata, payload, entity references, expected state, evidence and revision. Existing 24-hour approval expiry remains. Execution requires the matching approved request and a separate explicit confirmation. Local actor and organization identifiers are recorded; this is a future authorization hook, not real authentication.

## 8. Revision protection

Editing revokes approval. Executed actions cannot be edited, rebuilt, rejected or reapproved in place. A new variant is required for a different command. Terminal records preserve the originally approved command, binding and snapshots.

## 9. Stale protection

Fresh canonical sources and exact expected-state bindings are checked before dry run and again immediately before commit. Changed ownership, deleted entities, changed baseline/target, invalid source or changed context blocks execution. Primary target metadata must match the approved payload. Strategy creates require an active cycle. Browser QA verified that changing a sample process note makes an approved improvement NeedsReview/Stale and disables dry run and execution.

## 10. Dry Run

Dry run validates, constructs the stable command and simulates canonical domain mutation without writing domain or journal storage. It exposes before/after expectations, result reference, warnings, revision and binding. Real execution requires a successful current dry-run binding.

## 11. Pre-execution validation

Whitelist, enabled capability, risk, action lifecycle, exact approval, revision, expiry, actor permission, freshness, entity references, active cycle, canonical validation, dependency completion and duplicate/collision checks all run centrally. Missing input remains unknown and cannot be invented by a model.

## 12. Domain validation reuse

Adapters use existing domain mutation rules and persistence validation. Existing Strategy adaptive-review restrictions were preserved: browser attempts to edit an objective with a KR directly were correctly rejected by the canonical guard. Execution does not override those guards.

## 13. Idempotency

Command identity is stable per prepared action; the draft UUID is the created business object ID. A successful replay returns the original execution result. An interrupted execution with an exact matching created entity can be verified explicitly without creating it again. An ID collision with different fields fails closed.

## 14. Execution lock

The executor uses a storage-scoped reentrancy lock; the UI uses same-origin `navigator.locks` where available. Raw-value compare-and-swap checks protect the journal and domain commit. These are best-effort browser conflict safeguards, not distributed locks or database transactions.

## 15. Growth Idea execution

Creates an inbox idea with approved owner, constraint, metric and fields through the Scale service. Browser golden flow verified the real idea detail page and zero linked experiments. A subsequent explicitly confirmed compensating archive was also verified on that canonical page.

## 16. Experiment execution

Creates only a draft, retaining approved metric, baseline, target, owner, dates, design and success criteria. It never starts an experiment or fabricates results. Browser golden flow verified the created draft, baseline 14, user-entered target 20 and linked constraint.

## 17. Initiative execution

Creates a proposed initiative with zero progress and approved Objective/KR links. It never starts delivery. Browser golden flow verified the canonical initiative and links. An active cycle, selected priority, objective and KR were created manually through canonical forms as isolated localhost QA fixtures; those setup actions are not Agent-executable capabilities.

## 18. System Improvement execution

Creates a backlog improvement attached to its actual process and owner. Browser golden flow verified the new item in process p6's improvement list while retaining the existing items.

## 19. Post-execution verification

The executor rereads the real canonical store and compares the created entity against approved business fields and initial state. Only a verified match becomes Succeeded. A verification problem records failure or leaves an interrupted journal for explicit recovery; it never announces success based solely on a write returning.

## 20. Execution records

The journal records action/approval IDs, revision/binding, command/capability/template, domain/risk, result entity references, before/after, actor/organization, timestamps, status, errors and rollback record linkage. Journal statuses include Pending, Executing, Succeeded, Failed, PartiallyRecovered and RolledBack; not every status is currently used by every create. The UI projects preparation status from authoritative journal results.

## 21. Before/After snapshots

Create-before is minimal nonexistence plus parent identity. After stores approved business fields, ID and initial status/lifecycle. Whole domain stores and full histories are not backed up into execution records. Existing single-key domain serialization necessarily persists the canonical store, but that is not an Agent backup or restore strategy.

## 22. Audit

Events cover requested, validation passed/failed, started, succeeded/failed, rollback requested/succeeded/failed. Audit is append-only; old events and execution records cannot be removed through journal persistence. Successful records are immutable except for the explicit Succeeded → RolledBack lifecycle transition.

## 23. Failure handling

Professional Persian error messages explain missing approval, stale source, permission, validation, collision, storage and verification failures. Technical detail is retained for developer inspection. Invalid or corrupt journal data stays untouched. Journal persistence is validated, size-bounded to 8 MB and list-bounded; quota/conflict errors preserve previous values.

## 24. Retry handling

No automatic retry. A separate confirmation permits an explicit recovery/retry for Failed/Executing records. The executor first checks whether the exact created result already exists. A matching original command is verified without replay; absence permits a validated retry. Changing the command after a failed attempt requires a new variant and approval, rather than repurposing the old command ID.

## 25. Rollback model

Rollback records distinguish NotSupported, CompensatingAction and RestoreSnapshot. RestoreSnapshot is a contract option, not an enabled whole-store restore. Original execution and audit are retained. Rollback has its own confirmation, permission, freshness checks, lock, journal and verification.

## 26. Supported rollback actions

Only a created GrowthIdea can be compensated by archiving it. It must still match its created snapshot, remain inbox and have no linked experiments. Edited or linked ideas cannot be rolled back. Other creates explicitly display unsupported rollback and recovery guidance. No object or audit history is deleted.

## 27. Recovery behavior

Journal Executing is saved before the business mutation. Immediately before commit, approval/source state and journal identity are reread. A crash after business commit can be recovered by verifying the exact result. An interrupted rollback after archive can similarly be finalized without repeating the archive. If preparation status saving fails after verified success, journal projection retains the truthful result. There is no atomic multi-key crash guarantee; server durability remains future work.

## 28. Action Plan dependency execution

Approval of a predecessor is insufficient. A dependent execution requires its predecessor's Succeeded record and a matching actual business entity. RolledBack or changed results do not satisfy it. Each step needs its own approval and execution; there is no Run All. Plans containing preparation-only decisions may remain blocked until a future executable adapter exists. A synthetic two-action test verifies actual dependency completion; no full multi-step plan was executed in browser QA.

## 29. Advisor Actions UI changes

Inbox separates ready execution, executed, failed/recovery and stale proposals. Detail retains approved preview and evidence, adds dry run, separate confirmation with full proposed fields, result links, snapshots, timeline and recovery. Executed fields are disabled. Cancel is initially focused and Escape closes the drawer. One keyboard observation returned focus to the document rather than the launch button after Escape; focus restoration should receive an additional accessibility refinement in 6F. It does not trigger mutation.

## 30. Execution history

`/advisor/actions/history` lists chronological result records with their actual canonical links, domain, timestamps and rollback support. Browser history showed three successful executions and one compensated GrowthIdea. Original success history remains after compensation.

## 31. Dev Agent updates

`/dev/agent` adds Execution debug: the eight-entry whitelist, command/binding/snapshots, result records, rollback records, errors, audit and counts. Existing 6A simulation, 6B Advisor, 6C diagnosis and 6D preparation sections remain. 6A's simulated Executed status remains explicitly separate from 6E's real journal.

## 32. Security boundaries

No model can approve, expand the whitelist or execute through wording generation. All current mutations require explicit UI confirmation and central checks. No external service, backend, authentication, high-risk adapter or background execution was added. Browser storage and client permissions are not a security boundary: a malicious client can bypass local code. Authenticated server authorization, durable approvals and transactional execution are required before production use. localhost and 127.0.0.1 have separate origin storage.

## 33. Domain mutation tests

`tests/execution.cjs` adds 37 tests: all eight creates, canonical results and initial states, zero-write dry run, approval/revision/expiry/permission/risk rejection, stale data, duplicate/collision, locking, actual dependencies, failure audit, domain-write failure, interrupted verification and rollback, immutable history, corrupt storage, legacy keys and preserving concurrent unrelated data. Fake storage failure injection checks recovery boundaries; these are not distributed-system proofs.

## 34. Regression tests/results

`npm.cmd test`: 746 passed, 0 failed, 0 skipped (709 previous + 37 execution tests). Production build compiled, passed TypeScript, generated all pages and completed. Evidence: `.build6e-tests.txt`, `.build6e-build.txt`. `node tests/execution-http.cjs`: 53 route/asset checks passed, including history and existing System/Strategy/Scale/Advisor routes; `.build6e-http.json` records the responses.

## 35. Browser QA

Production app tested on localhost:3000. Four golden flows were executed and verified on their real domain pages: System Improvement, GrowthIdea with compensation, Experiment draft and Initiative proposed. Executed action remained locked after reload/navigation; approval editing removed execution availability; a changed process source disabled the stale improvement; rejected preparation-only action exposed no execution. The confirmation drawer includes approved fields, why, risk, evidence and current revision; Escape canceled without mutation. History and developer debug were checked. Console warning/error capture was empty. History had no horizontal overflow at 1280×900, 820×1180 and 390×844; desktop and mobile screenshots were visually inspected. Evidence: `docs/build-6e-desktop.jpg`, `docs/build-6e-tablet.jpg`, `docs/build-6e-mobile.jpg`, `.build6e-browser.json`. Permission tampering, disabled capabilities, quota/interruption, concurrency and actual plan dependency failure are covered by automated tests, not all manually exercised in a browser. This is not a claim that every requested browser scenario was manually run.

QA mutations were confined to localhost sample data. The existing 127.0.0.1 workspace data was not modified by browser QA. The changed sample process note and isolated Strategy fixtures remain as QA evidence.

## 36. Dependencies

No packages were added. Existing Next.js 16.3.5, React, TypeScript, Radix Dialog and domain services were reused. npm.cmd was used; no system security policies were changed. The app remains running at http://127.0.0.1:3000.

## 37. Issues encountered

An existing storage regression test initially caught accepting Executed without an executionRecordId; the validator was corrected without relaxing the test. Strategy test rootDir restrictions required moving shared persistence into `lib/domain-services`. Confirmation preview was expanded to include the actual fields and evidence; stale approval messaging after success was cleared. Journal identity was added to the immediate precommit checks. Canonical objective editing restrictions correctly blocked a QA setup attempt, so freshness testing used a sample process note. Remaining prototype issues include document focus after Escape, some English enum/domain labels, and browser-only transaction/authorization limits described above.

## 38. Documentation

This report covers the requested 39 completion points. `docs/AGENT-ARCHITECTURE.md` now describes the 6E flow, adapters, explicit execution, verification, journal and rollback boundary. Earlier Build documents remain historical descriptions of their respective stages.

## 39. What remains for BUILD 6F

Authenticated server actors/organization isolation and server-side permission/approval verification; durable transactional command and audit persistence; cross-client idempotency and distributed concurrency; additional separately audited low-risk updates and typed inverse commands; broader safe compensation; review of preparation-only plan dependencies; expanded browser/accessibility coverage including launch-button focus restoration; storage history management; and provider integration only within the existing propose-only boundary. No 6F implementation is included here.
