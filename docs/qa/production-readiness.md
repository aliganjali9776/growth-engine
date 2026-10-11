# Beta production-readiness evidence

Recorded during the current deployment-preparation task; finalized 2026-10-10 (Asia/Tehran). No deployment or DNS changes were made.

## Passed

- Full regression: **1,012 passed, zero failures** (849 business/Advisor, 31 database, 30 auth, 40 RBAC, 24 migration, 32 domain-record, 6 production configuration tests). Log: `.release-tests.txt`.
- TypeScript passed (`.release-typecheck.txt`). Production Next.js build passed (`.release-build.txt`).
- Hardened production build started on loopback with standard PostgreSQL configuration and development switches disabled. The test connection pointed to an intentionally unavailable, synthetic loopback PostgreSQL target; no existing business database was changed.
- Liveness `/api/health`: 200. Database readiness `/api/health/ready`: controlled 503 with only `not_ready`. Login API on unavailable DB: controlled 503 with only `AuthenticationUnavailable`. No fallback to embedded PostgreSQL or localStorage.
- `/dev/agent` and `/api/dev/saas`: 404 in production. Protected company/System/Strategy/Scale/Advisor pages redirect unauthenticated requests to login. Security headers present. Evidence: `production-http-smoke.json`.
- Browser: production login page rendered; attempted TEST-account login showed the generic unavailable-account message when PostgreSQL was unavailable. No console warnings/errors captured on this QA tab. Screenshot: `production-login-db-unavailable.png`.
- `npm start` preflight rejected missing PostgreSQL configuration and embedded development DB before starting Next, with exit code 1 and variable names only (`.release-invalid-env-preflight.txt`). Instrumentation provides an additional configuration guard for framework startup.
- Existing authentication configuration uses a canonical origin/trusted origin, stable server secret, HTTPS Secure cookies, HttpOnly/SameSite=Lax, server session checks and DB rate limiting. Existing integration tests cover authentication/session/RBAC behavior. Invitation links now come from server-configured BETTER_AUTH_URL rather than browser origin.
- Standard PostgreSQL connection pool is reused, with max 5 connections per process and 5-second connection timeout; there is no automatic embedded DB fallback. Production explicitly rejects PGlite, including loopback production runs. Local mode remains available explicitly.
- Real OpenAI Responses API: HTTP 200, model `gpt-6-luna`, schema and six evidence references validated using synthetic curated TEST context. Evidence: `advisor-openai-smoke.json`. First attempt was safely rejected by evidence/response validation; the single retry passed. Rejection preserved in `production-openai-first-attempt.json`. No validation rules were weakened. SaaS Agent execution remains disabled.
- Final browser bundle check: 70 JavaScript/map files scanned; the configured OpenAI API key was absent. Evidence: `production-bundle-secret-check.json`. The final production artifact also started successfully through the new prestart check.

## Remaining environment blocker

No standalone PostgreSQL service/tooling is available on this workstation. Consequently successful production login/logout/session, company selection, shared persisted module state and the complete browser → server → OpenAI flow on **this hardened production configuration** remain unverified. Prior Beta QA against explicitly selected embedded development PostgreSQL is historical evidence, not a substitute for this check. Provision PostgreSQL and execute the deployment smoke checklist before accepting real users.

No real production migration, seed, localStorage clearing or business-state import was performed. PostgreSQL compatibility is reviewed in code and migration/schema regression tests, but not certified against a standalone server here. `db:status` verifies all eight committed migration hashes/timestamps when run against the target database.

Full automated PostgreSQL business-backup restore remains deferred; Beta recovery uses PostgreSQL-level backup/restore. No billing, MFA, SSO, email provider, reports, Agent execution or new product UI was added.
