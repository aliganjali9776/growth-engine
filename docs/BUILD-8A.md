# BUILD 8A — Platform administration and product access

## Security and migration decision

Product access is organization-backed and separate from membership RBAC. New customers start `assessment_only`; a user without an enabled organization has no premium access. An enabled organization grants eligibility to its active members, still subject to their existing RBAC permissions. Platform administration never grants organization membership or bypasses tenant context.

Migration `0008_platform_access.sql` explicitly assigns every pre-existing organization `full_access` to preserve current production/test customer behavior, records that preservation decision, then sets the database default for future organizations to `assessment_only`. It adds access requests (one pending request per organization), platform access audit records, and per-user/company assessment lead snapshots. Existing IDs, business records and scoring formulas are untouched. Run `npm run db:migrate:prod` from the trusted cloud shell using the existing deployment guide. Apply migrations before switching application code; no current production migration was performed by this build.

The existing 1,012 regression scenarios remain. Their newly constructed legacy customer fixtures explicitly receive full access; fresh-customer behavior is covered by the additional BUILD 8A suite rather than weakening old assertions.

## First Platform Admin

1. Create the intended operator's account through normal signup and secure its password. Do this **before** allowlisting the address: this Beta has no email verification provider, so an unclaimed allowlisted address is unsafe.
2. Configure server-only `PLATFORM_ADMIN_EMAILS` with the existing account's email (comma-separated for multiple operators). Restart/redeploy the server environment. Do not use NEXT_PUBLIC_ or hardcode personal emails.
3. Sign in normally and visit `/admin`. Every page and API rechecks the active database user against the server environment. Empty allowlist denies everyone. Removing an email or suspending the user removes platform eligibility on the next server request.

Organization Owner/Admin roles do not confer platform authority. Ordinary users receive 404 for admin pages and 403 from the dedicated admin API. Cross-tenant reads exist only in the explicitly authorized platform service and expose allowlisted fields, never authentication credentials, session records or environment secrets.

## Routes and flow

`/admin`, `/admin/users`, `/admin/organizations`, `/admin/organizations/[id]`, `/admin/assessments`, `/admin/assessments/[id]`, `/admin/access-requests`, `/admin/audit`; dedicated `/api/admin`.

Customers can sign in, manage their profile/company basics, complete Assessment and read its result. Premium navigation remains visible with locks. Its locked state explains activation and offers a non-destructive request. Repeated submissions reuse the pending organization request. Platform Admin reviews it, confirms approval/rejection (optional reason), and the server updates entitlement and audit together in a transaction. Direct grants and revocations also require confirmation and an expected previous tier; stale confirmations fail rather than overwriting a newer decision. No re-registration is needed. Every subsequent premium request re-resolves entitlement and RBAC; workspace polling refreshes open pages after permission changes. Revocation masks premium stores without deleting or overwriting them.

The assessment lead view contains user/email/company, server start/update timestamps, completion percentage/status/date, overall and three dimension scores, primary constraint, and a link to the existing read-only report. Scores are recomputed using the existing diagnostic functions; no admin answer/score editing endpoint exists. New lead snapshots are attributed to the authenticated saving user. Historical shared assessments with no reliable user attribution are labelled unknown; their owner is not guessed. The latest snapshot is retained per user/company. Missing activity/scores are displayed as unavailable rather than fabricated.

Dashboard shows the eight requested totals plus recent signups/completions. User, organization and assessment lists support search and tier/status filtering. Organization details show profile, owner/member roles, tier, assessments, canonical domain record counts, recent activity and requests. Access audit shows actor, target, before/after tier, timestamp and reason.

SaaS Agent execution stays disabled. No payments or changes to System/Strategy/Scale/scoring are introduced. Suspension remains governed by existing account/organization status checks; BUILD 8A does not invent an unsupported suspension lifecycle or a destructive account-management endpoint.

## Validation

Validated on 2026-10-12:

- `npm run test:all`: **1,039 passed, 0 failed** (all 1,012 previous scenarios plus 27 platform/access tests).
- `npm run typecheck`: passed. `npm run build`: passed, including dynamic admin routes. One existing Turbopack filesystem-tracing warning remains in the development PGlite path in `lib/server/saas-runtime.ts`; deployment bundle size should be checked by the host. BUILD 8A did not change that runtime path.
- Real browser: normal signup/company creation, default lock, all 30 assessment answers, report/refresh persistence (overall and each dimension 60), System/Strategy/Scale/Advisor locks, activation request, ordinary Owner admin-page 404, platform user/lead search/filter, read-only report, organization detail, confirmed approval, same customer's four unlocked modules without re-registration, confirmed revocation, preserved assessment report, and actor/before/after/reason/time audit all passed.
- Final customer module/report browser console check returned no warnings/errors. An initial root-template `notFound()` boundary error and admin-to-workspace client-navigation issue were found and fixed, then rechecked successfully. Browser tooling had intermittent timeouts under build load; those steps were resumed and verified.
- HTTP smoke: two synthetic organizations list only their own membership; foreign organization switching returns 403; mismatched tenant headers return the existing controlled 409 scope-conflict response without data. Ordinary Owner `/api/admin` returns 403; revoked business export returns 403; assessment workspace remains 200. Evidence: `docs/qa/build8a-http.json`.
- SQL preservation/default/audit migration checks, fresh-context entitlement checks, tenant isolation, stale-confirmation rejection, request deduplication, request-target rollback, secret-free admin projection and existing formula parity are covered by `tests/platform-admin.test.ts`.

Browser/HTTP testing used only `.data/build8a-qa-20261012` on port 3001 with synthetic users, separate from the current business database. Screenshots are in `docs/qa/build8a-*.png`; regression/build transcripts are `.build8a-regression.txt` and `.build8a-build.txt`. No localStorage clearing, production seed, real-customer entitlement change, or Neon migration was performed. Standalone Neon/PostgreSQL deployment validation still requires the documented cloud migration/deployment procedure; this workstation QA used PGlite's PostgreSQL engine.

## Files changed for BUILD 8A

- Schema/migration: `lib/server/db/schema.ts`, `drizzle/0008_platform_access.sql`, `drizzle/meta/_journal.json`.
- Server authority/admin: `lib/server/services/platform-admin.ts`, `lib/server/context.ts`, `lib/server/repositories/organization.ts`, `lib/server/saas-api.ts`, `lib/server/services/domain-state.ts`, `lib/server/services/workspace.ts`, `lib/server/services/workspace-permissions.ts`, `app/api/admin/route.ts`, `app/api/business-backup/route.ts`.
- UI: `app/admin/[[...section]]/page.tsx`, `app/template.tsx`, `components/admin/platform-admin.tsx`, `components/admin/platform-admin.css`, `components/saas/product-lock.tsx`, `components/saas/shell.tsx`, `components/assessment/flow.tsx` (correct SaaS storage notice only).
- Verification/fixtures: `tests/platform-admin.test.ts`, `tests/full-access-fixture.ts`, `tests/auth.test.ts`, `tests/saas.test.ts`, `tests/rbac.test.ts`, `tests/domain-records.test.ts`, `tests/data-migration.test.ts`, `lib/server/dev/seed.ts`, `lib/server/dev/saas-seed.ts`, `package.json`.
- Configuration/docs/evidence: `.env.example`, `docs/BUILD-8A.md`, `docs/DEPLOYMENT.md`, the QA artifacts listed above. Other pre-existing workspace files are outside this build.
