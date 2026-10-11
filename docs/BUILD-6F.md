# BUILD 6F — Unified Agent Workspace

Growth Engine by 1 Minute Manager · 2026-10-06

This build unifies existing Advisor, Diagnosis, Preparation and Execution layers. It adds no executable authority, background automation or integrations. The numbered report distinguishes implementation, automated tests and browser QA.

## 1. Workspace architecture

`components/advisor/workspace.tsx` composes the decision flow; `workspace-blocks.tsx` supplies reusable document-style blocks. `lib/agent/workspace.ts` supplies pure intent, relationships, evidence projection and input parsing. Business mutations remain in the canonical execution engine and domain adapters.

## 2. Primary routes

Primary `/advisor/workspace`; management history `/advisor/history`. Sidebar, executive and entity entry links use the workspace. Existing Advisor, Insights, Actions and execution-history routes remain available. Entity, session and action deep links are supported.

## 3. Executive mode

Default whole-business context shows current 3S evidence, risks, relevant diagnoses, up to three options, pending actions and recent results. Manual briefs reuse deterministic diagnosis; no background scan is introduced.

## 4. Entity mode

Processes, Objectives, KRs, constraints, experiments and scaling candidates have contextual entry. The KR list now honors its `kr` query, selects the matching cycle and offers a return to all KRs in that cycle.

## 5. Context switching

A confirmation changes subject and clears active artifacts/options while retaining messages. The session URL replaces the original entity query, preserving the switch on refresh. Question wording cannot silently change entity context. Unchecking the optional lock currently still requires explicit context switching.

## 6. Conversation UX

Persian RTL document-style responses, starter prompts, labelled composer, artifact refs and frozen evidence. Latest 30 messages render initially; earlier messages load in batches of 30. Session titles retain the original subject; the current breadcrumb/selector shows active context.

## 7. Intent routing

Deterministic Ask, Explain, Diagnose, Recommend, Prepare, ShowEvidence, EditDraft, ApproveIntent, RejectIntent, ExecuteIntent and GeneralQuestion. Ordinals resolve visible options only. Ambiguous or ordinal approval/rejection/execution requests cannot mutate the active draft by assumption.

## 8. Evidence panel

Business labels replace JSON, storage keys and opaque IDs. The collapsible panel separates key, historical and cross-module evidence and data gaps. Conversation snapshots preserve source IDs and bounded summaries; oversized values are omitted from projections while full diagnosis sources remain intact.

## 9. Diagnosis integration

Existing rules and lifecycle support manual briefs and review. Related diagnoses use recorded links. Stale diagnoses require refresh before recommendation. Correlation is not presented as proved causality.

## 10. Recommendation integration

Reviewed diagnoses use 6D generation. Explicit requests without a diagnosis persist conservative contextual recommendations from existing templates and actual links. Up to three options support review, prepare and dismiss, without claiming verified impact.

## 11. Draft integration

Existing templates, validators, revisions, evidence bindings and deduplication are reused inline. An executed draft opens its actual result. An explicit fresh-draft control is required to create a new variant instead of silently duplicating an executed action.

## 12. Missing-input flow

Data-gap blocks expose required inputs. Persian/Arabic numerals, labelled dates and unique choice labels can fill one unambiguous field. Multiple missing fields are not guessed; text uses its exact field label.

## 13. Inline editing

Canonical structured controls remain available. Text edits create revisions and publish the preparation refresh event so the embedded form updates immediately. Editing invalidates approval; executed records remain locked.

## 14. Approval flow

Natural-language approval opens a dialog only. Request approval and explicit approval remain separate controls with exact revision, risk and before/after preview. Missing, stale or dirty drafts cannot be approved. Rejection requires an explicit control and reason.

## 15. Execute-intent safety

Text execution requests run a read-only dry run and open confirmation. No natural-language command directly mutates business storage. Freshness, permission, approval binding and prerequisites remain centrally enforced.

## 16. Execution confirmation

The existing drawer presents one proposed record and approved fields. Only the explicit execution button calls the canonical engine with explicit confirmation. No bulk or background execution is added.

## 17. Execution results

Actual journal results link to conversation artifacts and canonical module routes. Created records are described in their initial state; successful creation is not described as achieving business outcomes. Result references reopen the matching action/result.

## 18. Rollback/recovery UX

Existing 6E recovery is embedded. An untouched, unlinked newly created GrowthIdea supports explicitly confirmed compensating archive. Original execution and compensation history remain. No deletion or whole-store restore is introduced; other rollback types remain unsupported.

## 19. Cross-module relationships

Only recorded IDs/links are traversed, bounded to two hops. Root targets are preferred over sibling entities. KR → constraint → process links can suggest existing templates without fuzzy relationship inference.

## 20. Session model

Title, timestamps, active context, diagnosis/recommendation/action IDs, selected option, workspace state, messages and artifact refs. Canonical actions and execution records remain in their original stores.

## 21. Session resume

Recent-session controls and session URLs restore conversation and active state. New sessions preserve prior sessions; refresh preserves explicit context switches. Artifact refs remain distinct from language interpretation.

## 22. History

Conversations, reviewed/monitoring diagnoses, rejected proposals, executions and compensations share type/domain/status filters and 25-row pagination. Detailed legacy action history remains available.

## 23. Decision trace

Expanded history shows recorded rationale, diagnosis ancestry when present, action and canonical result. Manual contextual requests are labelled manual origin, without fabricated diagnosis lineage.

## 24. Offline mode

Evidence, deterministic diagnosis/recommendation, editing, approval, dry run, explicit execution and supported recovery work without an API key. Free-form model explanation is clearly unavailable. Browser QA exercised this mode.

## 25. Provider failure behavior

Existing validated Advisor API transport is reused with bounded context and recent messages, not full stores. Explanation failure is recoverable and leaves deterministic controls usable. No live external-provider failure was induced in browser QA; provider validation/failure coverage remains in the regression suite.

## 26. Agent Orchestrator changes

Added pure workspace intent routing; existing permission and execution guards are unchanged. The whitelist remains exactly eight creates: Improvement, KPI, Objective, KR, Initiative, GrowthIdea, Experiment, ScalePreparation.

## 27. Persistence migration

Additive `growth-engine.agent.workspace.v1`. The available bounded 6B session is imported once; earlier domain and Agent keys are preserved. Compare-and-swap, validation, corruption and quota handling fail closed without replacing prior data.

## 28. Performance

Caps: 100 sessions, 1,000 messages per session, 24 evidence items per message and 12 MB serialized workspace. No automatic eviction; caps stop new writes and preserve history. Synthetic fixture: 100 sessions/1,000 total messages, 300 diagnoses, 500 projections and 200 contextual reads in 201 ms. Canonical-shaped reads of 500 drafts/300 diagnoses/200 journal records in 96 ms. These local test measurements are not production/browser load guarantees.

## 29. Accessibility

Semantic regions/headings, labels, skip link, visible focus and existing Radix modal handling. Explicit execution/rollback triggers restore focus. Full assistive-technology certification has not been performed.

## 30. Responsive UX

Desktop main column plus context panel; narrow layouts stack with collapsed context. Widths 1440, 1280, 820 and 390 were checked with no document horizontal overflow. Desktop/tablet/mobile screenshots accompany this report.

## 31. Tests/results

770 tests passed, zero failures: 24 workspace tests plus prior regression coverage. TypeScript and optimized production build passed. Coverage includes strict intent controls, actual canonical execution, stale sources, migration, corruption/quota/conflict handling, oversized conversation and canonical recommendation evidence, and performance. HTTP route/asset results are recorded in `.build6f-http.json`.

## 32. Browser QA

Localhost sample data only: Executive and revenue-KR entry; contextual question/options; explicit fresh Improvement draft; missing due input and inline edit; natural-language approval dialog and explicit approval; execution preview and explicit execution; actual System backlog record and return to restored session; context switch/refresh; offline GrowthIdea draft/edit with immediate refresh, approval, execution and compensating archive; stale execution disabled and text execution blocked; contextual recommendation persistence; manual diagnosis refresh/review followed by a successfully saved canonical recommendation; new-session URL/refresh and recent-session resume; history rollback filter and decision trace; four responsive widths. Not every automated fixture was repeated manually. An earlier tab retained one React hydration error; its cause was not established and independent final session opening did not reproduce it. Final fresh-tab console checks were clean. All 55 HTTP route/asset checks passed. Final read-only opening on 127.0.0.1 confirmed the original namespace remained distinct from localhost QA data.

## 33. Dependencies

No new dependencies. Existing Next.js/React/Radix/Lucide/Vazirmatn and domain libraries are reused. Security policy and registry settings were not changed.

## 34. Issues encountered

Fixed raw JSON presentation, KR deep-link cycle selection, sibling KR targeting, executed-draft wording/duplication flow, embedded refresh after text input, execution-result reference navigation, empty breadcrumb separators, new/resumed session URLs and oversized diagnosis evidence in messages and canonical recommendation snapshots. The existing evidence validator remains strict; review projections are bounded before validation. Full diagnosis originals remain intact. Approval guards correctly blocked incomplete input during investigation. Historical messages from before fixes are preserved unchanged.

## 35. Documentation

This 36-point report and updated `AGENT-ARCHITECTURE.md` describe the flow. Evidence files: `build-6f-desktop.png`, `build-6f-tablet.png`, `build-6f-mobile.png`, test/type/build logs and HTTP checks.

## 36. What remains for BUILD 6G

No next-build scope is assumed. Production server authorization, durable approval/journal persistence, transactions, multi-client coordination and measured real-provider quality require explicit future scope. Local storage remains prototype persistence, not a security boundary. No semantic memory, integrations, notifications, RAG or autonomous execution was added.

