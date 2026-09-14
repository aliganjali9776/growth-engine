# Growth Engine — Build 3G

Persian, RTL-first executive workspace prototype for 1 Minute Manager.

## Build 3G: release-candidate hardening

This section supersedes older build descriptions where formulas or behavior changed. The existing architecture remains Next App Router with nested browser-local System, maps, analysis, standards and measurement providers. Domain logic lives in `lib/system`; React components render/edit those records. No new package, backend, authentication or Strategy capability was added.

Lifecycle: identified → mapped → analyzed → redesigned → standardized → implemented → measured → improving. The central System write boundary now checks early map/analysis/redesign readiness as well as standards/measurement readiness, including inventory and pipeline edits. Existing unchanged historical stages are retained. Content changes invalidate signatures rather than deleting historical redesign approval stamps. A process with linked map or execution history cannot be hard-deleted: archive it instead. Roles referenced in maps, standards, KPI, reviews or improvements cannot be deleted. KPI deletion is blocked when linked to improvement history and the UI explains archiving. Step deletion removes incident map edges; retained downstream documentation requires review against the changed source.

**System Health formula v2:** standard readiness 20%, adoption 20%, KPI visibility/performance 22.5%, founder independence 18.75%, improvement discipline 13.75%, ownership 5%. Process Health remains a displayed diagnostic with zero additional weight. These weights expand the old 25% Process Health contribution into its underlying 20/20/30/15/15 proportions, preserving the prior emphasis without counting a composite alongside its constituents. The six component definitions and process-priority weights remain as documented below. This is not numerically identical when old Process Health was unavailable or its standard score differed. Missing components are excluded and remaining weights normalized; completeness and partial-data labels remain essential. The 30-day test is a separate readiness model and is not interchangeable with System Health.

Process Health keeps its 20% standards / 20% adoption / 30% KPI / 15% independence / 15% discipline formula, but absent adoption is now unknown, like absent KPI or operational-map evidence. Absence of standard documentation and review/action readiness remains an explicitly zero readiness contribution. Founder-step classification now consistently includes any explicitly recorded dependency or a founder owner; the prior low/medium discrepancy could otherwise show 100 independence alongside a dependency marker. This may lower independence for existing low/medium dependencies. All map times remain minutes; formatting does not affect calculations. Stored dates remain ISO; timestamp displays explicitly use Tehran time, and date-only inputs retain calendar dates.

Snapshots keep their independent v1 storage schema, with an optional formulaVersion marker: missing means legacy formula 1; new records use 2. Old values remain untouched. Trends compare records of the same formula version and do not present a formula change as performance improvement.

Persistence keys actually used:

| Key | Contents |
| --- | --- |
| `growth-engine.assessment.v2` | Assessment draft and result |
| `growth-engine.system.v1` | Departments, roles, people and processes |
| `growth-engine.process-maps.v1` | AS-IS maps |
| `growth-engine.process-analysis.v1` | Analysis stamps and TO-BE |
| `growth-engine.process-standards.v1` | SOP, checklists, rules, assets and implementation plans |
| `growth-engine.process-measurement.v1` | KPI, measurements, reviews and improvements |
| `growth-engine.system-health-history.v1` | Manual health snapshots |

Independence and command-center reports are derived, not separate persisted copies. Valid empty arrays remain empty; missing keys initialize only the documented seed/empty stores. Restoring corrupt assessment JSON no longer overwrites it during mount. Failed System-store parsing blocks dependent work and exposes a raw-data backup plus schema-validated, single-section restore; stale writes and quota failures retain the original data. Recovery is not an automatic semantic repair or a full cross-store backup service. Keep related stores together when restoring older exports. There is no global destructive reset. Seed process records have a sample-origin notice in their detail page, including legacy seed IDs/timestamps; changing sample data does not turn it into independently verified business evidence.

UI hardening includes current-page process navigation, Persian owner/map/go-live wording, actual SOP status in process detail and overview, adoption averages that exclude absent plans, explicit unknown scores, helpful empty organization/command states, visible keyboard focus, Persian map control labels, Enter-to-edit and persisted arrow-key movement. Large maps can zoom out further and retain an accessible list of steps/connections.

Validation: 149 passing tests (135 prior tests adapted where intended semantics changed, plus 14 hardening/integration/performance cases). The required A–O cases are covered, with paired cases in some tests. Domain stress fixtures include 50/100 processes, 20 departments, 100 roles, 200 people, 105 map nodes, 210 improvements and 510+ KPI entries. On the local run, 100-process aggregation took about 37 ms; 100 inventory filter runs dropped from about 2,729 ms to 26 ms after eliminating repeated bottleneck calculations; 105-node layout/validation took about 3 ms. These are local measurements, not a production SLA.

The complete browser golden path was performed through forms on isolated `localhost`, without direct storage editing: assessment (30 answers, result 60), new department/role/person, new process P016, three-node AS-IS, mapped, analysis, independent TO-BE with wait reduced from 5 to 2 minutes, SOP/checklist approval, standardization, required training and pilot, go-live, implementation, KPI baseline 20/target 15/actual 17 minutes, measurement confirmation, weekly review, owned scheduled improvement and improving confirmation. Final process health 85, adoption 100, KPI 60 and independence 100 appeared in Command Center. The primary `127.0.0.1` user data was not edited. Recovery testing then used an explicit isolated fixture: corrupt System JSON showed a safe error, invalid replacement was rejected, valid replacement restored the report, and empty data remained empty after navigation/reload.

Local-prototype limits remain: no multi-user concurrency guarantee, server backup, audit ledger, permissions or real execution telemetry; stage stamps are current/historical validity indicators rather than a complete event log. Browser-local data can be lost outside the app. Large-data checks cover the stated fixture sizes, not unbounded maps. Accessibility work is practical testing, not certification. The root home/dashboard previews remain mock presentations outside System; System executive metrics derive from current local records.

## Build 3F: System Command Center

The primary System navigation destination is `/system/command-center`. The existing `/system` remains the operational overview and links to the command center. This build adds no dependencies or backend services.

- System Health combines process health (25%), standard readiness (15%), adoption (15%), KPI visibility/performance (15%), founder independence (15%), improvement discipline (10%), and ownership coverage (5%). Process aggregates use critical/high/medium/low weights 1.5/1.25/1/0.75. Unknown components are omitted and remaining weights normalized, with an explicit partial-data label. Status bands are below 40 critical, below 60 unstable, below 75 stabilizing, below 90 systematic, and 90+ stable/scalable.
- Standard readiness: approved current SOP 30, confirmed standardization 20, definition of done 15, checklist coverage 20, decision-rule coverage 15. Absent standard evidence represents a readiness gap. Adoption uses existing implementation-plan scores; an absent plan remains unknown.
- KPI: 40% active-KPI coverage among implemented/measured/improving processes plus 60% priority-weighted valid performance. If performance is unavailable, the combined component remains unknown. Founder independence: 80% priority-weighted existing process independence plus 20% reliable non-founder ownership of critical processes (all processes when none are critical).
- Ownership: 50% reliable process owners, 20% covered key roles, 20% ownership without concentration, 10% reliable non-founder critical ownership. Concentration flags a role with at least four processes and at least 25% share, or a founder role with at least two critical processes. A flag prompts capacity review; it does not assert actual workload.
- Data Completeness is separate: inventory 10%, reliable ownership 15%, SOP/source 15%, adoption plans 15%, valid eligible KPI measurements 25%, reviews/actions 10%, known operational maps 10%. Known component values can still have limited population coverage, shown beside their scores.
- Risks come from actual ownership, maps, SOP validity, adoption, KPI gaps, overdue improvements and process health. Stable IDs and severity/priority/impact ordering drive the initial six-item attention feed, full list, top five risks and deduplicated actions. Management focus selects the largest actionable weighted gap; executive prose is deterministic, not AI-generated.
- Department Health runs the same formula on each department's active processes and local roles. The eight-stage funnel counts existing active-process stages directly; its concentration insight does not claim elapsed bottleneck duration. Unknown process health is separate from low health in the matrix. The 30-day panel directly reuses the existing independence report calculation.
- `lib/system/command-center/` contains aggregation, risks, summaries, report selection, and snapshot rules. `components/command-center/` contains the hero, score explanation, attention feed, funnel, matrix, critical/department tables, operational summaries, period filter and history. Source-dependent report calculations are memoized.
- Manual immutable snapshots use the independent `growth-engine.system-health-history.v1` key, including precise timestamps, seven component values, score, completeness, available weight and process count. No history is seeded or automatically saved. At least two records are needed for a trend; coverage changes are flagged. Validation and optimistic storage writes preserve corrupt/stale data rather than overwriting it. Existing operational store keys are unchanged. Period filters affect only saved history and completed actions; current health and risks are not presented as historical reconstructions. Current quarter means Gregorian quarter; dates use Tehran time.

Validation: 135 passing domain tests, including 20 Build 3F tests covering A–R, empty data, corrupt history, period boundaries and real source edits. TypeScript and production build pass. Browser QA on the separate `localhost` sample origin verified health/breakdown, ranked links, funnel filtering, critical/department tables, ownership and operational summaries, the matching 30-day report, and two manual snapshots. A sample KPI edit changed total health from 70 to 73; the +3 trend and both records survived reload. Desktop 1440×1000, tablet 820×1180 and mobile 390×844 were visually checked, with no browser warning/error or hydration messages observed. The user's `127.0.0.1` data was not edited for these tests.

Resolved validation issues: an initial test compared function references inside two otherwise equal derived reports; it now compares their serializable business results. PowerShell introduced a UTF-8 BOM in package.json; saving plain UTF-8 and rebuilding the generated Next cache resolved the build error.

Before System Module Hardening: review weighting/thresholds with business owners, partial-data score interpretation, cross-tab conflict recovery, storage-quota and export/recovery flows, comprehensive keyboard/screen-reader coverage, and performance with large inventories. Local sample evidence and manually confirmed adoption are not proof of real operational performance. Historical snapshots cannot reconstruct past process details or explain unrecorded changes.

## Run locally

```sh
npm.cmd install
npm.cmd run dev
```

Open http://127.0.0.1:3000. Production validation: `npm.cmd run build`.

## Scope

The 3S assessment and System module are functional browser-local experiences. Assessment includes 30 questions, profile validation, weighted scoring and diagnostics. System includes organization and process management, a chart, inventory, lifecycle pipeline and derived insights. Home/dashboard, strategy, scale and execution remain sample previews. There is no authentication, database, API integration or notification backend. The company selector contains one sample organization. Shell dates are fixed scenario data; completed assessments record their actual completion date.

## Assessment architecture and rules

- `app/assessment/page.tsx`: dedicated assessment route.
- `components/assessment/experience.tsx`: flow state, guarded navigation, persistence, restart confirmation.
- `components/assessment/flow.tsx`: introduction, profile, progress, section introductions, question/score selector and navigation.
- `components/assessment/results.tsx`: executive report hierarchy, with reusable sections in `report-sections.tsx`, `consultation-cta.tsx`, and scoped `report.css`. The existing roadmap preview lives in `improvement-preview.tsx`.
- `lib/assessment/interpretation.ts`, `severity.ts`, `hidden-risks.ts`, `summary.ts`, `focus.ts`: score bands, finding severity, evidence-based risks, deterministic executive summary and recommended actions.
- `lib/assessment/types.ts`, `questions.ts`, `scoring.ts`, `diagnostics.ts`, `persistence.ts`: independently testable definitions and domain rules.
- `tests/assessment.cjs`: run `npm.cmd test`; pure TypeScript domain modules compile into ignored `.test-build` before Node's built-in tests execute.

Each dimension divides weighted answers by its weighted maximum (57.5), then multiplies by 100. Critical questions weigh 1.5, others 1. Scores are kept at full precision for averaging and classification; rounding is display-only. Answers of 1 produce a score of 20, as required by the specified formula. Overall status is capped at Developing if any dimension is below 40, but a Critical overall status is never raised. Tied dimensions resolve in System → Strategy → Scale order, visibly explained in the report. Weak answers rank before higher answers; critical questions win ties. High-scoring questions are described as maintenance/improvement opportunities, not fabricated severe problems.

Drafts use the versioned `growth-engine.assessment.v2` localStorage key. Restored data is validated. Incomplete drafts cannot render a report. Storage failures show an explicit warning and permit an in-memory session. Restart replaces only this assessment's profile, answers, position, and report date after confirmation. Company profile does not influence scores.

## Build 2.5 diagnostics

Score bands are below 40 critical, 40–59 unstable, 60–79 acceptable with improvement needed, 80–89 strong with optimization needed, and 90–100 very strong. Classification uses full precision.

Every answer becomes one finding: 1 or critical-weighted 2 is critical; other 2 or critical-weighted 3 needs action; other 3 and all 4 are improvement opportunities; 5 is a strength with a preservation/transfer note. Findings rank by severity, answer, then critical weight. All 30 remain available in categorized report sections, including high-scoring dimensions.

Every dimension includes interpretation, working capabilities, four finding groups, evidence-based risks or an honest no-risk note, focus and action. Risk rules cover manager dependency, SOP standardization, objective review, KPI/KR measurement, unpredictable acquisition and revenue concentration. A weakest-answer fallback covers other gaps below 4. All-5 answers produce strengths and maintenance guidance without fabricated risk.

The report follows overall health, executive summary, primary constraint, overview, three diagnostics, critical/action/improvement findings, risks, strengths, next move and consultation. The consultation button opens a local explanatory preview; it does not book, send data or call an API. Questions, numeric scoring, profile, navigation, persistence and shell are unchanged.

## QA

15 domain tests cover required A–E scenarios, weights, exact boundaries, precision, weak-answer ordering, tie handling, missing/invalid answers, profile validation and persistence recovery. Browser walkthrough completed all 30 questions, checked blocked empty submissions, backward navigation, midway refresh, capped status, report, improvement preview and restart/cancel. Desktop, tablet and mobile reviewed; no console or hydration errors observed.

Build 2.5 expands this to 24 passing domain tests, including high-score critical gaps, Strategy review around 75, Scale acquisition risk above 80, all-strong answers, critical findings across dimensions, the complete severity matrix, all-30 coverage, risk evidence and the 90 boundary. Browser QA completed four separate 30-answer profiles (mixed, high, medium, low) on an isolated localhost origin, preserving the user's existing 127.0.0.1 assessment. Desktop, tablet and mobile report layouts and the consultation preview were reviewed.

## Structure

- `app/page.tsx`: executive home.
- `app/[module]/page.tsx`: statically generated module destinations; unknown modules return 404.
- `components/app-shell.tsx`: replaceable Brand, AppSidebar, TopBar, and responsive shell.
- `components/ui.tsx`: reusable cards, progress bars, badges, headers, and activity feed.
- `components/module-views.tsx`: strategy, scale, execution, dashboard, and settings previews. Obsolete assessment and System previews were removed.
- `lib/mock-data.ts`: shared typed sample data and navigation definitions.
- `app/globals.css`: design tokens, components, and responsive rules with Tailwind CSS.

## Design

Navy `#132b40`, gold `#b59a62`, neutral canvas, restrained green/amber states. Vazirmatn fonts are served locally. No logo was present in `public/brand`; the replaceable Brand component uses a temporary geometric mark and text. Desktop is primary, with a right-hand drawer on mobile and horizontally scrollable data tables.

## Build 3A System

- Routes: `/system`, `/system/organization`, `/system/people`, `/system/processes`, `/system/processes/[id]`, `/system/pipeline`.
- Existing `lib/system` types, seed, scoring and selectors are reused. `actions.ts` validates immutable updates and protects referenced entities from deletion. `persistence.ts` validates fields, enums, identifiers, references and hierarchy cycles, and recomputes priority during restoration.
- `components/system/provider.tsx` shares state across System routes. Only `growth-engine.system.v1` is written; assessment retains `growth-engine.assessment.v2`. Invalid storage is not overwritten. Storage failure prevents a false successful save; stale tabs must refresh before editing. Data is local to this browser and origin, without server sync or backup. Seed data is persisted on the first edit.
- Department, role, person and process drawers support creation, editing and safe deletion; department/person/process status supports archiving. Person assignments are resolved through roles, avoiding duplicate ownership records.
- React Flow (`@xyflow/react`) provides role and department hierarchy, pan, zoom, fit view and node details. Radix Dialog provides accessible drawers. Both dependencies are recorded in the lockfile.
- Inventory supports search, combined filters, deterministic sorting, desktop table, mobile cards and eight-stage pipeline. Stage changes require an explicit save. Process details expose the lifecycle and locked future modules.
- Priority remains the existing sum of four 1–3 inputs. Insights derive founder dependency, owner concentration, active-person coverage, department critical counts and missing role owners from current records.
- `tests/system.cjs` adds 14 domain tests, including scenarios A–G, bringing `npm.cmd test` to 38 tests. TypeScript and production build pass. Browser QA exercised linked creation, owner resolution, refresh restoration, score recalculation, stage changes, chart controls, filtering and responsive layouts on an isolated localhost origin.

## Build 3B: AS-IS process mapping

- `/system/processes/[id]/map` is an editable React Flow workspace, reached from the process detail's active map section. The other future modules remain locked.
- The existing `ProcessStep` placeholder is extended with action/start/end/decision/handoff types, description, canonical role reference, nullable work/wait minutes, 0/25/50/75/100 rework probability, explicit founder dependency, positions and timestamps. Person assignment always resolves from the current role. Connections store source/target IDs, label and condition. Maps explicitly identify the AS-IS variant.
- `lib/system/maps` separates models, graph actions, metrics, validation, completeness, readiness, seed, layout and persistence from React. `components/process-map` separates canvas/nodes, step drawer, edge editor, metrics/validation, provider and process-detail summary.
- `growth-engine.process-maps.v1` stores maps by process ID separately from System and assessment. Restoration validates IDs, endpoints, numeric fields, enums, dates and map boundaries. Edits are stored immediately; storage failures do not report success, and stale tabs are blocked from overwriting another tab. Role deletion checks map ownership. Deleted-process maps remain preserved in local storage but have no accessible builder until that process exists again. No server sync or backup is provided.
- Dragging nodes persists positions. Connections can be drawn between handles or created through a keyboard-friendly form; clicking an edge edits its label/condition or deletes it. Deleting a step removes its incident connections. A text directory exposes nodes and edges without requiring precise canvas interaction.
- Auto-layout uses a deterministic layered graph algorithm with strongly connected components for rework loops. It supports right-to-left and top-to-bottom directions without another dependency. Layout places steps in distinct slots; manual positioning remains available.
- Live metrics include total work, wait, cycle, waiting ratio, decisions, high-rework steps (50%+), founder-dependent steps, and role handoffs. Explicit handoff steps count once when not already represented by an incoming detected handoff. Cycle time is the requested sum over all recorded steps, not a simulation of branches or repeated loop executions. Unknown times are excluded from totals and surfaced in coverage; zero is a recorded value.
- Structural warnings cover missing start/end, islands, disconnected steps, missing operational paths, insufficient decision branches, unlabeled branches, missing owners/times and founder dependencies. Completeness averages owner, time and directed start-to-end connection coverage; it is not a health score. Explicit Mapped registration requires at least three steps, one operational step, 80% valid-role coverage, all steps reachable from Start and able to reach End, and at least two branches per decision. It never automatically advances a process or regresses a later stage.
- P006 has a realistic 13-step proposal/contract example with decisions, CEO approval, waiting, role transfers and a negotiation loop. It remains editable and does not itself advance the process stage.
- No new dependency was needed. The existing React Flow and Radix Dialog packages are reused.
- `tests/process-maps.cjs` adds 16 tests covering scenarios A–L plus malformed data, cycles, layout and zero/unknown timing. All 54 tests pass, along with TypeScript and production build. Browser QA checked creation, form and drag connections, role/person resolution, immediate metrics, labels, decision warnings, node movement/restoration, independent maps, stage confirmation and deletion cleanup on an isolated localhost origin.

## Build 3C: analysis and redesign

- New routes: `/system/processes/[id]/analysis`, `/to-be`, `/compare`. Process detail activates analysis and future-design summaries; AS-IS and TO-BE share the same builder, node, edge and drawer components. The future workspace uses an explicit TO-BE label and green accent.
- `lib/system/analysis` contains graph traversal, deterministic rules, scores, clone/comparison, readiness, signatures and confirmation rules. No AI or external service participates. Findings link a step and evidence to eliminate, simplify, delegate or automate; these are review candidates, not automatic changes.
- Friction is the rounded weighted sum of six normalized components: waiting ratio 30%, founder-dependent operational-step share 20%, average operational rework probability 15%, handoffs per connection (capped at 1) 15%, decision branch complexity per operational step (capped at 1) 10%, and ownership/structure gaps 10%. The last component averages missing-role share, missing start-to-end path coverage and structurally invalid-step share. Bands are 0–24 low, 25–49 medium, 50–74 high, 75–100 critical. Missing time/structure makes the displayed result provisional. This is an internal index, not system health.
- Bottleneck score: 35% step wait / maximum wait, 20% detected founder dependency, 15% rework probability, 15% graph dependency, 10% step work / maximum work, 5% involvement in handoff. Graph dependency averages incoming count / 3 and unique reachable downstream count / other-step count, each capped at 1. Final scores are rounded; candidates at 25+ are sorted deterministically. Zero maxima use denominator 1. Scores and formulas are exposed in the UI.
- Waiting rules flag 60+ minutes or at least half the map's maximum wait. Founder operational steps suggest delegation. Rework at 50%+, graph cycles, fewer than two decision destinations and over three branches suggest simplification. Concentration means at least four steps and half of operational steps in one role. Elimination candidates require matching title/type/owner/input/output; users must assess whether duplication is necessary. Automation candidates require a high-frequency process, non-founder action owner, recorded input/output, 10+ work minutes and rework <=25%.
- TO-BE is a deep clone with stable step/edge IDs. AS-IS remains in `growth-engine.process-maps.v1`; future maps and review/approval timestamps live in `growth-engine.process-analysis.v1`. Existing System and assessment formats are retained. Both map variants are validated separately; the AS-IS parser still rejects TO-BE. Role deletion protects owners in both variants.
- Comparison uses current maps, displays absolute and relative changes, handles zero baselines without fabricated percentages, identifies added/removed steps and changed owners/times/rework/types, and warns about incomplete timing or regression. Time is the sum across recorded steps, not simulated execution duration. No realized benefit is claimed.
- Analysis confirmation moves Mapped to Analyzed. Redesign confirmation requires a current analysis review and a ready TO-BE, then moves Analyzed to Redesigned. Readiness requires meaningful connected Start-to-End structure, valid decision branches/labels, all operational owners, and complete work/wait data. No automatic progression occurs. Existing manual stage controls remain separate from review/approval evidence.
- Content signatures invalidate review/approval when map content or relevant role assignments change. Positions/timestamps alone do not invalidate approval. Cross-tab stale writes are rejected. Stage and confirmation writes use coordinated writes with rollback on synchronous storage failure; browser localStorage is not a crash-atomic database.
- `tests/process-analysis.cjs` covers scenarios A–P, score boundaries, conservative candidates, invalid persistence, stale confirmations and storage rollback. Browser QA on localhost created and edited TO-BE, reassigned founder ownership, reduced wait, removed/reconnected a step, confirmed stages, refreshed and compared both maps while preserving the user's 127.0.0.1 data. Desktop, tablet and mobile were inspected.
- No dependencies were added; React Flow and Radix Dialog are reused.

## Subsequent builds

Builds 3D and 3E below extend the confirmed redesign. Assessment scoring and diagnostic rules remain unchanged.
# BUILD 3D — Standardize, Implement, Adopt

Build 3D adds `/system/processes/[id]/standardize` and `/implementation` to the existing local application. Process details show SOP, reusable checklist, decision rule, asset, training, pilot, live and adoption summaries. System Overview derives compact coverage and readiness metrics from valid current confirmations, independently of legacy seed stage labels.

- Structured SOPs reference the approved TO-BE content revision and stable step IDs. They contain purpose, scope, owner, trigger, inputs, outputs, prerequisites, step instructions/responsibilities/outputs/quality/exception notes, escalation, Definition of Done, quality, version and explicit role approval.
- Reusable checklists support CRUD, ordered required/optional items and step references. Rules contain condition, action, owner, escalation role, priority and readiness. Assets store typed metadata, version and a reference string; no upload or execution history is added.
- Completeness = core fields 35 + procedure coverage 20 + checklist step coverage 15 + decision rule coverage 10 + Definition of Done 10 + ready assets 10. Labels: 0–39 incomplete, 40–69 completing, 70–89 review, 90–100 ready. Mandatory fields, valid references, a current approved source and explicit SOP approval gate standardization; a score alone never advances the stage.
- Implementation plans record owner, target date, tools/templates/team readiness, per-role training and manual SOP acknowledgement, configurable required training/pilot, pilot owner/dates/issues/outcome/feedback, and explicit Go-Live or pause. Missing critical prerequisites block Live.
- Manual adoption index = owner confirmation 15 + training 20 + pilot 20 + valid Live 20 + role acknowledgement fraction 15 + operational readiness 10. Training and pilot configured as not required receive their readiness allocation. This measures manually recorded readiness, not observed usage or business results.
- Explicit confirmations advance Redesigned → Standardized and Standardized → Implemented; the latter requires valid standardization, Live, no critical blockers and adoption ≥70. Central stage guards cover existing editors and pipeline controls. Build 3E extends those guards for measurement and improvement.
- TO-BE content edits increment its lightweight revision and invalidate source approval; position-only edits preserve it. SOPs become Needs Review when the source changes. Rebase preserves instructions by step ID, introduces blank instructions for new steps, and requires renewed approval. Library edits also invalidate previous content confirmations. Prior timestamps remain inspectable but are not counted as current evidence.
- The independent validated `growth-engine.process-standards.v1` store keeps SOPs, checklists, rules, assets and implementation plans together by process ID. Existing assessment, system, map and analysis keys are preserved. Cross-tab changes block stale writes. Stage changes coordinate the system and standards writes with rollback on synchronous failure; localStorage is not crash-atomic or cloud storage.
- The p6 example is explicitly loaded by the user and is authored educational content, with no runtime AI generation. No new dependency was added in Build 3D. KPI measurements, improvement and independence are added in Build 3E below; backend, authentication and real notifications remain out of scope.

Validation: 91 automated tests, including Build 3D scenarios A–O and malformed persistence, stale approval and manual stage guards; TypeScript and production build. Browser QA exercises authored SOP creation/editing, checklist reorder/add, rule and asset creation, approval, training/pilot blockers, Live, implementation confirmation, refresh recovery, source-change warning and reapproval/rebase, overview and pipeline. Test data uses the existing localhost sample origin, separate from 127.0.0.1 user data.

## Build 3E — Measure, Improve, Independence

Routes: `/system/processes/[id]/kpis`, `/review`, `/improvements`, and `/system/independence`. Process detail exposes measurement/history dates, KPI performance, health, open/overdue/completed actions, latest review and founder independence. System Overview adds coverage, means with observed-process counts, open critical improvements, overdue actions and the 30-day readiness score. Existing seed stage labels are retained; they are not evidence of confirmed readiness.

### KPI model, scoring and trend

`ProcessKPI` stores name, description, role owner, unit, direction, baseline, target, absolute tolerance, cadence, draft/active/archived status, optional weight and timestamps. `KPIEntry` stores process/KPI IDs, period date, finite numeric value, note, confidence and entry timestamp. Current and previous values are derived by period date, not insertion order. Each KPI has at most one entry per period date; entries can be edited or deleted with confirmation. KPI deletion also requires confirmation and removes its history; linked improvement records prevent deletion, so archiving preserves references.

- Increase/decrease: `clamp(100 * (current - baseline) / (target - baseline), 0, 100)`. Increase requires target > baseline; decrease requires target < baseline. Negative numeric baselines are supported. Missing baseline/target or impossible direction produces no score.
- Maintain: let `d = abs(current - target)`, tolerance `t >= 0`. Score is 100 inside tolerance. Outside, `clamp(100 * (1 - (d - t)/t), 0, 100)`; if t=0, only exact target scores 100, otherwise 0.
- Binary: values/target/baseline must be 0 or 1; current matching target scores 100, otherwise 0.
- Weighted performance uses active KPIs only. All empty weights mean equal weighting; custom weights require every active KPI to have a positive weight and total exactly 100 (tolerance 0.001). Invalid ownership, definitions, weights or missing measurements yield an explicit incomplete-data state, not a partial fabricated average.
- Status bands: <40 critical, <60 action needed, <80 on track, <100 near target, 100 achieved. Trend compares the two latest periods in the favorable direction. Maintain compares distance outside tolerance; binary compares scores. Fewer than two measurements yields insufficient trend data. The compact sparkline uses equal horizontal spacing per observation and explicitly states that spacing is not elapsed time.
- p6 has an explicitly confirmed educational sample loader: proposal time 18→4h, conversion 22→35%, timely follow-up 55→90%, founder-free contracts 30→80%, each with three weekly sample readings. It never inserts data automatically or claims these are actual company results.

### Health, reviews and improvement

Health = standard completeness 20% + manual adoption 20% + KPI performance 30% + founder independence 15% + improvement discipline 15%. Missing valid KPI performance or operational map produces `null` health, displayed as insufficient data. Missing standards/adoption contributes zero readiness. Bands: <40 critical, <60 unstable, <80 acceptable, <90 strong, 90+ systematic/stable, with an explicit internal-diagnostic disclaimer.

`ProcessReview` stores period range, summary, wins, problems, blockers, decisions, next focus, manually observed founder changes, reviewer role and timestamp. A qualifying review requires a valid reviewer and at least one nonblank observation/summary. The review page shows live KPI trends and open/overdue counts separately from historical manual review notes.

`ImprovementItem` stores source, stable source key, step/KPI references, owner, priority, state, due date, expected/actual impact, notes and completion timestamp. Sources cover analysis, KPI gap, review, founder dependency, pilot, adoption and manual. States cover backlog, planned, in progress, blocked, completed and cancelled. Non-completed/non-cancelled actions become overdue only after their due date. Reopening clears completion time. KPI gaps below 60 prefill a proposed action; Build 3C findings can also be converted, always through user saving. Existing non-cancelled source keys prevent repeat conversion.

Discipline = review within the last 14 days 25 + owned action fraction 25 + action due-date fraction 20 + non-overdue open-action fraction 20 + completed action fraction 10. Cancelled items are excluded; empty action sets receive no action points. Completed-only nonempty sets receive full timeliness credit. Date-sensitive results are derived on render with the Tehran calendar date; refresh updates a tab left open overnight.

### Founder and 30-day independence

Per-process founder independence = non-founder process owner 25 + independent operational-step fraction 35 + independent decision fraction 25 + independent wait fraction 15. A missing/invalid role, founder role, or high/critical founder dependency marks a step dependent. No decisions on a known map receive full decision credit; missing operational maps yield unknown independence. Missing wait times receive no wait credit. TO-BE is used only when its implementation confirmation is current; otherwise AS-IS is used. This is a structural diagnostic, not evidence of actual absence or measured escalation frequency.

30-day readiness = mean founder independence 25 + reliable non-founder critical ownership 15 + approved current SOP coverage 15 + adoption 15 + valid KPI coverage 10 + per-process delegated-decision fraction 10 + active non-founder key-role coverage 5 + critical-process health 5. Missing values receive zero readiness contribution, while unknown health remains visibly unknown. Decision coverage includes unknown-map processes as zero, preventing a single documented process from implying full system delegation. If no critical processes exist, ownership/health use all active processes. No active processes yields no overall score.

Bands: <40 heavily dependent, <60 low independence, <75 developing, <90 suitable operational independence, 90+ ready for independent operation; the report explicitly avoids a guarantee. Ranked risks include critical founder ownership, unreliable owners, vacant operational/key roles, founder decisions, missing SOP/maps/KPI, weak adoption and low health. It presents the largest weighted gap, top five rule-based actions, delegated decisions and a risk-sortable process table. Scores are derived rather than persisted.

### Progression, persistence and validation

Implemented → Measured requires current implementation evidence and at least one active KPI, with all active KPI definitions, owners, weights and measurements valid. The explicit confirmation writes `measuredAt`. Measured → Improving requires current measured readiness, a meaningful reviewed period and a planned/in-progress/completed action with a valid owner; target achievement is not required. It writes `improvingAt`. Existing editor/pipeline changes cannot bypass these confirmations. Changes that invalidate underlying standard/implementation or remove measurement/review/action prerequisites invalidate effective confirmation without erasing historical timestamps. Reapproval of TO-BE, standard and implementation is available at the later stages without moving the process backward automatically.

`lib/system/measurement/` separates model, KPI scoring/trend/weights, health/discipline/founder logic, independence risks and scoring, readiness and persistence. `components/measurement/` separates editors, history, cards, pages and provider. The validated independent `growth-engine.process-measurement.v1` key stores per-process KPI definitions/history, reviews, improvements and confirmation timestamps together, preserving every prior key. Stale-tab writes are blocked. Stage and companion writes use the existing coordinated rollback helper; this remains browser-local storage, not cloud sync or a crash-atomic database.

Automated validation: 115 passing tests total, including 24 Build 3E tests covering scenarios A–R, maintain/binary edge cases, trend ordering, missing data, custom weights, persistence/reference validation, stale implementation evidence, empty reviews and unknown-map delegation. TypeScript and optimized production build are checked. Browser QA uses localhost sample data, preserving 127.0.0.1 user data, and exercises KPI create/edit, multiple measurements/history edit/delete, trends, gaps, review, improvement, overdue, analysis conversion, confirmations, refresh, overview, pipeline guards, independence and responsive views.

No dependency installation was needed. Build 3F scope is not specified yet; final Command Center, Strategy/OKR, AI, backend/authentication, cloud sync, real CRM/ERP integrations, automation execution and notification services remain intentionally unimplemented.

Final Build 3G browser checks: the restored golden process retained its improving stage and approved SOP. Keyboard node movement (200 to 205 px) and mouse dragging persisted after reload. The 105-node map fit at approximately 0.0149 zoom. Desktop and mobile screenshots were checked; mobile 390px and tablet 820px had no document horizontal overflow. The tablet screenshot was clipped by the browser capture surface, so full tablet visual sign-off remains limited. Back/forward navigation returned to the expected routes. No application console warning/error was captured. All 19 checked page routes and 15 referenced Next assets returned HTTP 200. A browser-tool permission-review timeout succeeded on retry; separate Codex telemetry timeouts were not application console errors. Temporary large/corrupt/empty fixtures were restored and public/qa-hardening.html was removed. The fixture generator remains a manual development test utility, not a shipped product page.