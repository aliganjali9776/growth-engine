# BUILD 7D Beta release acceptance

Decision: October 7, 2026, Asia/Tehran.

**BETA COMPLETE / PRODUCTION-HARDENING DEFERRED** under the user's expedited scope. Ready for Beta deployment on October 8, 2026, with production infrastructure configured below. This means release readiness; external deployment has not been provisioned or performed in this task.

## Authoritative storage

| Domain | SaaS source of truth | APP_MODE=local |
| --- | --- | --- |
| Assessment | assessment_domain_records and headers | Existing browser implementation |
| System | system_domain_records and headers | Existing browser implementation |
| Strategy | strategy_domain_records and headers | Existing browser implementation |
| Scale | scale_domain_records and headers | Existing browser implementation |
| Agent artifacts | agent_domain_records and headers, shared/private scoped | Existing local artifacts |
| Auth, organizations, memberships, RBAC | Scoped server tables | SaaS auth is not emulated locally |
| SaaS Agent authorization | Existing scoped proposal/approval tables | Existing local artifacts |

All five domain families use fixed repositories/domain services through the active SaaS adapter. Legacy database workspace payloads remain recovery archives; canonical writes update entity rows, not archives or localStorage. Coordination versions protect against stale writes. Private Agent context stays per user. SaaS Agent execution remains disabled; BUILD 7E was not started.

An unbound SaaS bridge throws a controlled error. Failed saves lock the bridge and report temporary/unconfirmed edits. There is no localStorage fallback. Explicit Local mode retains its browser-storage provider. User-selected local migration inspection does not clear or automatically migrate browser data.

## Release-critical evidence

- Full regression: **1,004 passed, zero failures**: 847 business, 31 database, 30 authentication/separation, 40 RBAC, 24 migration/export, 32 domain. `.build7d-beta-regression.txt`.
- Final production build passed: `.build7d-beta-final-build.txt`. Earlier `.build7d-beta-build.txt` also passed before the storage-label correction.
- Final built server restarted successfully in 231 ms at http://127.0.0.1:3000. The Owner's TEST Assessment page showed the corrected workspace-storage wording and settled to connected status with no console warnings/errors. `qa/build7d-beta-final-assessment.png`.
- Persistence: the approved TEST organization retained 15 processes and three objectives across actual reload, logout/login and application restart. Its file-backed database was independently reopened while the app was stopped. `qa/build7d-beta-persistence-smoke.json` records the state checksum. The only fixture insertion was a Viewer membership in the TEST organization for an existing synthetic QA identity. Existing real organizations' business records were untouched.
- Multi-user: actual Owner and distinct Viewer browser sessions read the same persisted TEST System state. Service smoke verified System/Strategy/Scale/Assessment state equality. Personal Agent sessions remain private. `qa/build7d-beta-system-owner.png`, `qa/build7d-beta-system-viewer.png`.
- Auth/RBAC: real logout/login succeeded. Viewer business mutation was denied without changing data, and the migration page displayed restricted access. Regressions check fresh reauthorization, revoked sessions, active-company guards and stale writes.
- Tenant isolation: isolated integration tests check business rows, private artifacts, exports and migration history across two organizations. The TEST smoke denied unauthorized organization scope. No business edits were made to real organizations for testing.
- Browser QA: System, Strategy, Scale, Assessment, Agent workspace and migration pages loaded without console warnings/errors. Viewer read-only and restricted-access notices rendered correctly. Local mode ran separately on port 3001 with its existing sample workspace and no console errors. Default-viewport screenshots were visually inspected. Final responsive override attempts retained the measured 1265px viewport, so this run does not claim new three-size responsive passes; earlier migration-page device-size evidence remains available.
- Database failure: a separate process on port 3002 used the production node-postgres driver against an unavailable local database port. Sign-in returned controlled **503 AuthenticationUnavailable**. The adapter regression separately injects a business-save 503 and asserts blocked saves/error notification, zero localStorage reads/writes, and working explicit Local-mode storage. The failure process was stopped and environment files were unchanged.
- Critical formula parity: canonical PostgreSQL round trips preserve all four KR-type inputs, yielding progress 25/25/100/25. System priority results match after conversion. Scale conversion/capacity checks preserve zero/null/numeric outputs. The complete business regression covers Assessment scoring, System health/independence, Strategy and Scale experiment/funnel/network/readiness calculations. This is the expedited critical check, not a claim of a comprehensive historical golden dataset.
- Local migration: real preview validated 75 references with zero errors; transactional import into the empty TEST company succeeded. Tests cover checksums, permissions, non-empty targets, references, late-failure rollback and unchanged source data. Re-import is blocked; localStorage was not cleared or automatically migrated.
- Export: authenticated HTTP attachment completed a real 64,041-byte JSON download. All 15 reconstructed stores equal the imported source. The export includes 98 allowlisted business tables, including all five canonical record tables and headers. Verification found zero foreign-organization rows and zero forbidden credential fields. Auth accounts/sessions, memberships/roles, invitations/tokens, staged archives and raw workspace documents are excluded. Nested API keys/environment secrets cause fail-closed export rejection, without silent stripping. `qa/build7d-downloaded-backup-verification.json`.

## Production PostgreSQL compatibility

docker, psql and pg_ctl were absent from PATH; `C:\Program Files\PostgreSQL` was absent. No standalone PostgreSQL success-path smoke is claimed. All seven formal PostgreSQL migrations/services passed in PGlite. The production pg Pool/drizzle node-postgres path and node-postgres migrator were reviewed, and the real driver's connection-failure behavior was exercised. This disclosed limitation does not alone block completion under the approved Beta scope.

Deploy with APP_MODE=saas, PERSISTENCE_MODE=database, SAAS_DEV_DATABASE=false, DATABASE_URL for a provisioned PostgreSQL database, BETTER_AUTH_URL matching the public HTTPS origin, and a strong server-only BETTER_AUTH_SECRET of at least 32 characters. Configure provider-required database TLS. Never publish the embedded development flag, synthetic QA accounts or test data. Supply secrets through the host's secret manager. Install/build, apply committed additive migrations using npm run db:migrate with the production PostgreSQL driver configuration, then start the production server. Do not run development seed/reset commands in production. Before inviting users, run health, sign-in, shared-state and two-tenant checks against the provisioned database.

## Beta disaster recovery and deferred work

**DEFERRED: Full-fidelity ServerOrganizationBackup → automated Restore preserving all server metadata. Full automated PostgreSQL business-backup restore.** The business JSON is an inspection/portability artifact; the local-package migration importer intentionally does not accept this SQL snapshot format. No lossy conversion or silent metadata dropping was implemented.

**PostgreSQL-level backup/restore is the Beta recovery mechanism.** Enable the provider's encrypted backups and point-in-time recovery before admitting users. Retain a pre-release database snapshot outside the application database. Database-level backups include authentication data and must be restricted to authorized operators; they are separate from credential-free business exports.

With version-compatible PostgreSQL tools, create a full custom-format pg_dump backup using securely supplied credentials and validate it with pg_restore --list. Restore with pg_restore --exit-on-error --single-transaction into a **new isolated empty recovery database**, never over the live database; alternatively use the provider's point-in-time restore. Verify schema/migrations, counts, tenant boundaries, histories and references, then sign-in and business-state smoke tests. Only after verification should an authorized operator switch the application connection. Retain the original database/snapshot until recovery is confirmed. No database restore was performed here.

Post-Beta hardening also includes standalone PostgreSQL success/load tests, the comprehensive historical golden fixture, finer pagination/fully relational nested histories, and broader device/network QA. These limitations are disclosed rather than claimed complete under the reduced scope.
