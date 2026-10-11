# BUILD 7C — server authorization

Implemented on the existing 7B project. The default grants are now real server checks; the SaaS executor remains deliberately disabled under request section 110. A successful execution golden flow is therefore **not claimed**.

## Completion report

1. **Architecture:** real Better Auth session → current active company → active user/membership → freshly resolved database grants → tenant scope → operation permission. Services are server-only; UI summaries are advisory.
2. **Catalog:** 55 canonical codes in `lib/server/permissions.ts`, including granular member actions, System structures/SOP/KPI/improvement, Strategy cycle/KR target, Scale decisions and Agent stages.
3. **Matrix:** `RBAC-MATRIX.md` lists all six default roles. Migration `0005_rbac_default_grants.sql` replaces only built-in grants, preserving custom roles and business records.
4. **Owner:** all grants; last active Owner cannot be demoted, suspended or removed. Agent approval/explicit execution gates still apply.
5. **Admin:** broad business and member administration; no organization archive or access-role management. Cannot assign/demote Owner. Role assignment also rejects any target grant above current actor permissions. Non-Owner self-role changes are denied.
6. **Consultant:** ordinary business creation/editing, organization/business-role structures and Advisor preparation; no default approval, execution, members or audit administration.
7. **Manager:** organization-wide ordinary operational creation/editing, reviews/check-ins and Agent preparation. Assigned-area restrictions are a future policy, not inferred from job title.
8. **Editor:** ordinary business creation/editing and reviews; no cycle management, existing KR target changes, structure edits, archive or approval.
9. **Viewer:** read-only business modules/access matrix. No Advisor ask or writes. Personal account operations and creating a separate owned company remain independent of a Viewer membership.
10. **Resolver:** `resolveOrganizationPermissions` delegates to the single canonical database context resolver; returns membership, roles, grants and active status. No cross-request permission cache.
11. **Guards:** `reauthorize`, `requireAllPermissions` and `requireAnyPermission` re-resolve current grants. `requirePermission(db, context, code)` freshly resolves server grants. Its deprecated two-argument overload is only a compatibility assertion for existing internal callers/tests; protected entry points use the database guard. Authenticated APIs validate real sessions before service calls.
12. **Pages:** trusted request path maps to module/member/access/audit view permission in the server template before workspace data is loaded. Safe Persian forbidden screen; filtered navigation.
13. **APIs/services:** inventory: `/api/auth/*`, `/api/saas`, `/api/advisor`, `/api/dev/saas`. Auth uses its existing restricted allowlist; SaaS has origin, session, selected-company and granular guards; Advisor GET/POST require view/ask. Development API remains disabled in normal SaaS. No additional business Server Actions exist.
14. **System:** canonical validated JSON differences enforce creation/removal/archive, department/people structure, business-role, process/map/analysis, SOP approval, KPI and improvement permissions.
15. **Strategy:** cycle/reset, objectives, KR edits/target changes, initiatives, weekly review/check-ins and Adapt collections are distinguished. Normalized objective creation also requires create/objective.edit.
16. **Scale:** constraints, experiments, funnel, channels/loops, readiness and final decisions are distinguished; Viewer mutations fail. Network edits currently require both channel.edit and loop.edit, conservatively.
17. **Agent reads:** workspace view, free-form ask, diagnoses and recommendation persistence have distinct checks. Conversations/workspace history are creator-private; new diagnoses are company-shared; authorization proposals are company artifacts.
18. **Prepare:** canonical `/api/saas` prepare operation requires agent.prepare plus the target-domain creation/edit grants. Proposals are review artifacts, not executable domain commands. Shared UI at `/advisor/authorized-actions`.
19. **Approve:** current agent.approve plus target module.approve and target creation/edit permissions; tenant-scoped action, revision, state version and binding checked; transactional audit.
20. **Execute:** fresh agent.execute and target grants, eight-action whitelist, explicit execute, matching nonexpired approval/revision/binding and current shared workspace version are checked. Capability then returns Disabled; no domain command or fake execution record is written.
21. **Target map:** `lib/saas/agent-action-permissions.ts`: Improvement→system.create+improvement.edit; KPI→system.create+kpi.edit; Objective→strategy.create+objective.edit; KR→strategy.create+kr.edit; Initiative→strategy.create+initiative.edit; GrowthIdea→scale.create+scale.edit; Experiment→scale.create+experiment.edit; PreparationItem→scale.create+readiness.edit.
22. **Approval actor:** server-derived approvedByUserId; independent of preparer. UI displays names through tenant-authorized joins.
23. **Execution actor:** existing PostgreSQL schema supports executedByUserId and approval bindings. No successful execution actor is recorded because execution is disabled.
24. **Escalation:** member mutations use separate change_role/suspend/remove checks; Owner assignment requires current Owner. Non-Owner self-role changes blocked; final-Owner protection remains transactional.
25. **Mid-session changes:** each protected write resolves current grants. Browser polls current company/permissions every ten seconds and locks/reloads if changed.
26. **Suspension:** active membership resolver denies immediately on server; browser locks when polling detects no active company.
27. **Switching:** same-session switch/write serialization remains; current company gets its own fresh permissions. Ali QA is Alpha Owner and Beta Viewer.
28. **Tenant boundary:** selected session company and request organization header must agree. Foreign action IDs return safe NotFound. Resource scope foundation supports AllOrganization, OwnRecords and AssignedResources; no department ACL is enabled.
29. **Audit:** immutable database audit foundation retained. Member role events contain old/new roles and target. SOP approval, KR target change, Scale decisions and Agent prepare/approve get server-actor events. Audit API requires audit.view; no update endpoint.
30. **Matrix UI:** `/settings/access`, Persian roles, operations, groups, risk and six grant columns. Read-only, keyboard-focusable horizontal scrolling.
31. **Security tests:** 40 isolated RBAC tests, plus authentication regressions and 38 real HTTP checks. Includes forged grants, target-domain revocation after approval, tenant attacks, last Owner, actors and module masking.
32. **Database:** actual PGlite PostgreSQL migrations/transactions/constraints used. No mocked repository authorization.
33. **Regressions:** combined 947 tests: 847 existing domain +31 database +29 auth +40 RBAC. 847 domain checks are recorded in `.build7c-regression-final.txt`; final integration evidence is in `.build7c-database-final.txt`, `.build7c-auth-tests.txt` and `.build7c-rbac-tests.txt`; build and type checks pass.
34. **Responsive/accessibility:** matrix inspected at 1440×1000, 820×1180 and 390×844. Semantic table headers/caption, labels, focus outline and navigation preserved. Viewer native fieldset disables business controls; this conservatively disables in-page filters too.
35. **Browser:** six role logins; Alpha/Beta role switch; direct forbidden members route; Consultant proposal prepared and Owner approved with separate identities; Viewer create button disabled. Mid-session downgrade refreshed and disabled creation; suspension closed company access. The QA membership was restored afterwards; evidence is in `.build7c-browser.json`. Browser console inspection found no errors/warnings during observed flows.
36. **Standalone PostgreSQL:** local psql/pg_ctl/Docker unavailable; external PostgreSQL smoke test not performed. Production PostgreSQL remains the configured architecture; embedded database is loopback development only.
37. **Dependencies:** no new package dependencies. Added test:rbac to test:all.
38. **Issues:** sandbox TypeScript runner reported uv_os_get_passwd ENOMEM; approved execution succeeded. Seed script initially used top-level await in CommonJS; fixed before running. New proposal fields initially lacked existing form classes; corrected during visual QA.
39. **Limitations:** no server executor, no successful execution/rollback QA, no department/field ACL, no custom-role builder. Existing browser preparation/approval-document writes are blocked in SaaS to prevent anonymous approval/actor spoofing; use the new canonical proposal page. This page intentionally stores conceptual proposals rather than complete validated eight-action domain payloads. Legacy local mode remains unchanged. Historical private diagnoses are retained in their old documents and are not automatically published to other members; newly saved diagnoses use shared scope. Resource-scope helpers are a foundation, not assigned-resource administration. Some granular legacy controls rely on server denial; Viewer filters are conservatively disabled with the native fieldset.
40. **7D:** migrate/validate executable domain commands and connect legacy Agent draft UI to canonical server proposals/approvals, implement idempotent execution with server-derived executedByUserId, capability/domain validation and audit, make read-only filtering granular, and add assignment policy/UI and an external PostgreSQL smoke run. No production deployment was done.

## Local verification

App: http://127.0.0.1:3000. Matrix: /settings/access. Canonical proposals: /advisor/authorized-actions.

Reserved QA users: `7c.owner`, `7c.admin`, `7c.consultant`, `7c.manager`, `7c.editor`, `7c.viewer` at `development.example.invalid`. Password matches the documented 7B development-only password. Separate QA companies; seed never overwrites existing credentials or unrelated memberships. Stop the app before opening the file-backed PGlite database from a CLI.

## Invariants

Client UI/roles/actor hints never authorize. Active membership, current grants and tenant scope are separate mandatory checks. Business roles never imply Access Roles. Agent grants never imply domain grants. Revoked permissions are rechecked at approval/execution. Audit actors come from server sessions. Owner never bypasses Agent gates. Execution stays disabled until a domain-valid server executor exists.
