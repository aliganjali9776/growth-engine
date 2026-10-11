# Growth Engine — BUILD 7B

Authentication, company onboarding, memberships, invitations and organization switching are implemented on the Build 7A PostgreSQL foundation. The normal application requires a real server session. Explicit `APP_MODE=local` preserves the older development/migration workspace and its browser data.

## Completion report

1. **Authentication technology.** Better Auth 1.7.7 with its maintained Drizzle adapter and PostgreSQL. The factory is server-only (`lib/server/auth.ts`), uses real database transactions and maps framework identity fields to the existing User model. The library was selected for credential hashing, session/cookie/CSRF handling, Drizzle support and future verification/reset support. References: [Drizzle adapter](https://better-auth.com/docs/adapters/drizzle), [email/password](https://better-auth.com/docs/authentication/email-password), [Next.js integration](https://better-auth.com/docs/integrations/next).

2. **Signup.** `/signup` creates a distinct User and credential Account, normalizes email, stores display name, creates a session and directs the user to onboarding or the invitation they followed. Duplicate signup cannot create another identity. Generic UI errors avoid presenting account existence as a lookup service. No terms agreement or external email is introduced.

3. **Login.** `/login` verifies email/password through Better Auth. Incorrect credentials and globally Disabled/Suspended users are denied. A user with no available companies sees onboarding; one company is entered automatically; multiple companies show `/organizations` with each company and access role. Safe internal return paths are retained.

4. **Logout.** POST sign-out revokes the database session and clears the framework cookie. The client clears/locks its company adapter and navigates to login. Failed draft persistence cannot prevent logout. Logout does not remove company records or historical actions.

5. **Password hashing.** Better Auth's salted scrypt credential hash is stored in `auth_accounts.password`; plaintext and reversible password encryption are not used. Password policy is 8–128 characters. Password managers, paste and autocomplete are supported. Logs/audit never contain passwords, password hashes or raw invitation/reset tokens.

6. **Session model.** `auth_sessions` belongs to a User and optionally references the active Organization. Framework tokens are protected by signed HttpOnly cookies; session rows expire after seven days with a one-day update interval. Cookie caching is disabled. Server resolution reads current User status and an unexpired database session rather than trusting a cookie's mere presence. API responses remove bearer session tokens from JSON. HTTPS cookies are Secure and SameSite=Lax; loopback HTTP development intentionally omits Secure.

7. **Protected routes.** Proxy provides an optimistic no-cookie redirect, while the server template resolves identity, active membership and company before returning tenant data. All organization API operations independently reauthorize. The historical fixed-actor development API is disabled in SaaS mode even when its development flag is set. Business pages are dynamic with no shared authenticated prerender. Auth and invitation pages are public. The SaaS shell uses full document navigation so Next's shared parent render cannot carry an old company/permission view to a new page.

8. **Organization onboarding.** `/onboarding/company` collects company name, industry, business model, team size, country, currency and timezone. Currency/timezone/name are validated server-side. Onboarding never asks the user to choose a slug or a privileged role.

9. **Company creation.** An authenticated Active user can create another company. Each receives its own Organization, settings, company profile, canonical access roles and workspace. Hidden normalized slugs include a random suffix, allowing duplicate display names. Nothing is copied from existing browser sample data.

10. **Owner bootstrap.** Build 7A's transactional `createOrganizationWithOwner` remains authoritative: Organization, initial Active Membership, six default roles/grants, Owner assignment, settings, profile and OrganizationCreated audit commit together. Build 7B selects the new company for the current session in the surrounding transaction.

11. **Active Organization.** `auth_sessions.active_organization_id` is authoritative selection. `user_preferences.last_organization_id` is only a remembered preference and must pass fresh membership/status checks before reuse. An organization ID in a request cannot grant access. Stale or suspended selections lead to a valid selector/onboarding.

12. **Organization selector.** `/organizations` lists only companies available to the current user, with role and current-company indication. Login uses zero/one/multiple-company routing; the selector also allows deliberate company choice and company creation.

13. **Organization switching.** The server verifies membership, updates the session and preference, and records OrganizationSwitched transactionally. The client flushes acknowledged drafts before switching, then performs a full navigation/remount. A stale tab sending its previous `x-organization-id` receives Conflict instead of writing to the newly selected company.

14. **Company settings.** `/settings/company` displays name, industry, business model, currency, timezone and status. Basic edits require `organization.update` and update both Organization and settings where applicable, with an audit event. Company creation prefills the assessment business name/industry once; later settings changes do not silently rewrite assessment answers.

15. **Members page.** `/settings/members` shows real names, normalized emails, access roles, membership status, dates and pending/accepted/expired/revoked invitations. Controls follow the authenticated company's grants; server checks remain authoritative. There are no HR sample records.

16. **Invitation model.** Existing tenant-scoped Invitations and InvitationRoles store organization, canonical email, creator, intended access role, SHA-256 token hash, status and expiry. Pending expiry is reflected when listing. Raw tokens are never returned in normal invitation lists or audit.

17. **Invite creation.** Owner/Admin with `members.invite` can create a link. A cryptographically random 32-byte token is returned once for copying. Delivery is deliberately a copy-link workflow; no email is claimed to have been sent. Reinviting revokes old pending invitations before issuing the replacement. Already-active membership is rejected.

18. **Invite acceptance.** `/invite/[token]` displays the company and invited address, preserves the invitation through signup/login and provides an explicit acceptance action. Acceptance locks the organization, rechecks status/expiry/email, creates or activates membership, assigns the scoped role, marks the invitation Accepted and writes audit in one transaction.

19. **Existing-user invitation.** An existing account accepts with the same canonical email and receives another membership. Its original memberships/roles remain unchanged. Existing Active membership does not get duplicate rows or unexpected role escalation.

20. **Invitation security.** Tokens have 256 bits of randomness, only hashes persist, and default expiry is seven days (`INVITATION_TTL_DAYS`, 1–30). Expired, revoked, accepted/reused or unknown tokens fail safely. Wrong-email accounts cannot accept. Suspended/Removed memberships cannot be revived by reusing an invitation. Invitation routes and API use no-referrer headers where supplied; no external invitation delivery/tracking is added.

21. **Access Roles.** Owner, Admin, Consultant, Manager, Editor and Viewer retain Build 7A defaults. An access role belongs to a specific company. This build enforces account, membership, company administration and coarse draft-write permissions; complete module/record RBAC remains Build 7C.

22. **Role assignment.** Owners/Admins manage permitted member roles using a membership version check. Only an Owner may grant or alter Owner access; Admin cannot elevate itself to Owner. Changes are scoped and audited. Custom roles are not introduced.

23. **Owner protection.** Organization-row locking serializes invitation and membership changes. The final Active Owner cannot be demoted, suspended or removed. The check counts Active users with Active Owner memberships. It runs before mutation inside the same transaction. Administrative direct SQL/global account deactivation remains an operational concern, not a new end-user feature.

24. **Membership suspend/remove.** Membership status changes preserve the row and historical authored records. Suspended/Removed members immediately fail server organization checks. Restore is explicit, permission checked and audited. User status is independent of membership status; suspending Alpha membership does not globally disable an account or another company's membership. Non-owner self-leave is deferred.

25. **User profile.** `/settings/profile` edits the authenticated user's display name, optional HTTPS avatar URL, locale and timezone. Client-supplied user IDs cannot select a target. Email change and automatic User↔System Person matching are intentionally unavailable.

26. **Password change/reset foundation.** Password change requires the current password, verifies confirmation in the UI and revokes other sessions through Better Auth. Auth Account/Verification tables provide framework-compatible reset foundations. Reset endpoints are not exposed without a configured email channel; there is no local reset bypass. PasswordChanged records contain only authenticated user ID, action, outcome and time.

27. **Tenant isolation.** Identity comes from the server cookie/session. Each request verifies User, Session, Organization, Membership and scoped role grants. API writes lock/recheck current session selection and reject a mismatched organization header. Tenant-scoped draft documents prevent normal SaaS screens from reading shared anonymous localStorage. JSON payload identity/permissions cannot authorize anything. Local data is preserved separately and never automatically migrated.

28. **Agent tenant isolation.** Agent/Advisor stores are private documents keyed by both company and current user. Shared 3S documents belong to the company. Switching or logout locks the old adapter and remounts providers; historical conversations/prepared context do not follow into another company/user. SaaS execution and rollback of legacy browser Agent commands are disabled until server execution migration exists. This build does not claim a browser JSON action is a trusted server execution.

29. **Audit events.** OrganizationCreated, OrganizationSwitched, OrganizationUpdated, MemberInvited, InvitationAccepted, InvitationRevoked, MemberRoleChanged, MemberSuspended, MemberRemoved, MemberRestored and WorkspaceDraftSaved use server AuditEvents with company and authenticated actor. Target membership/User is included when applicable. Global AccountCreated, rejected CredentialAttempt and PasswordChanged use `auth_security_events`. Existing append-only and execution audit protections remain. No credential/token payload is logged.

30. **Standalone PostgreSQL smoke test.** Not run on this workstation: Docker, psql and pg_ctl are unavailable. Integration and localhost QA use PGlite 0.5.8, the actual PostgreSQL engine compiled to WebAssembly, with all committed migrations and real transactions—not SQLite or a mocked repository. TCP PostgreSQL, independent concurrent processes, production roles/TLS/backups and deployment performance still require an external smoke test. `compose.yaml` and the node-postgres migration/seed path are ready for that test.

31. **Database integration tests.** 31 Build 7A tests plus 29 Build 7B authentication tests pass. The new suite covers required A–AB scenarios, wrong/disabled accounts, session tampering/expiry, transactions, invitation lifecycle, owner guards, version conflicts, forged context/origin, User/Person separation, profile/password change, draft and Agent tenant boundaries, rate limiting and HTTPS cookie attributes. The actual production-like HTTP server also passes 57 checks; authenticated deep routes use manual redirect handling so a login redirect cannot masquerade as HTTP success.

32. **Existing regression tests.** All 847 pre-SaaS tests and 31 Build 7A tests pass: 878 preserved regression tests. With 29 new auth tests there are 907 passing automated tests. Production build/type checking passes. Explicit local mode passes 13 representative business routes and 46 referenced assets with auth/SaaS endpoints disabled. No existing scoring/calculation rules were rewritten.

33. **Responsive/RTL.** Deep navy/gold/white/Vazirmatn SaaS screens use RTL content and LTR email/token/password fields. Desktop, 820×1180 tablet and 390×844 mobile inspection covers the shell and members screen, with one-column forms, a collapsible mobile navigation and a confined scrolling table. Auth layout adapts to mobile. Screenshots are under `docs/qa/build7b-*`.

34. **Accessibility.** Form controls have labels/autocomplete; native selects support keyboard interaction; loading controls are disabled; errors use alert and progress/success use status; main content has a skip link and programmatic focus target. Mobile navigation exposes expanded state, closes with Escape/overlay, and hidden navigation is removed from focus/visibility. Keyboard focus and screen layout are checked; this is not a claim of certified WCAG conformance or a full assistive-technology audit.

35. **Browser QA.** A new real browser account created Alpha and Beta, switched companies, logged out/in and invited a second account to Alpha. User B signed up through the preserved invite, accepted, logged in and saw only Alpha; its Agent workspace was clean. Owner changed B's role, suspended it, verified protected-route denial, restored it and received the final-owner removal error. Deep-route refresh, public invalid/expired-invitation UI, desktop/tablet/mobile, Escape and console/hydration checks are recorded below. Cross-Beta API denial and expired/revoked/reused invitation behavior also pass real database/HTTP tests. An expired invitation was created only by a guarded development fixture while the embedded app was stopped, then rejected by the public browser route; no expiry bypass or account feature was exposed.

36. **Dependencies added.** Runtime `better-auth` and `@better-auth/drizzle-adapter` 1.7.7. Existing Drizzle, pg and PGlite are reused. No mail provider, auth browser automation library or deployment service was installed. Dependency audit reports zero known vulnerabilities at verification time.

37. **Issues encountered.** The original signup hook queried outside the auth transaction, deadlocking the embedded engine; it now uses the transaction-scoped internal adapter. Separate Next bundles opened the same embedded directory; a process-global runtime fixes this and contains only DB/auth framework objects, never tenant/user data. The old disposable `.data/postgres-saas-dev` became unreadable and was preserved; QA moved to fresh `.data/postgres-saas-dev-fixed`, not a reset/deletion. An early HTTP check followed login redirects and was strengthened. Selector navigation reused empty parent permissions; all SaaS shell navigation now requests fresh server context. A proposed raw-header shortcut was rejected by automatic review; the implemented safe-return parser validates path and allows encoding only in query values. Build 7A/prior dirty files and legacy browser data were retained.

38. **Known limitations.** Local embedded database support is explicit, loopback-only and single-process; never open its directory concurrently from CLI/another server, and stop the app before migration/seed. It is not a production PostgreSQL deployment. Coarse company draft documents bridge existing UI stores; complete normalized domain CRUD/migration, full module RBAC, trusted server Agent execution/approvals, realtime conflict resolution, outbound email, verified email/change-email/reset, SSO/MFA, billing and production operational hardening are not delivered. Failed draft writes visibly stop the workspace; reload restores the acknowledged server version, so unacknowledged drafts can be lost. Company-wide draft CAS rejects concurrent stale writers rather than silently overwriting. Unconfigured production auth/database fails closed; there is no implicit local bypass.

39. **BUILD 7C.** Enforce every module/action and record permission, adapt UI controls to permission changes, complete normalized server persistence and explicit migration, define provider/Agent request and execution authorization, and extend revoked-access/concurrency/deployment checks. Add email verification/reset/delivery and production operational configuration as separately authorized work. Preserve access-role versus business-role separation and the last Owner invariant.

## Running and accounts

Normal standalone configuration belongs in ignored `.env.local`: `APP_MODE=saas`, `PERSISTENCE_MODE=database`, `DATABASE_URL`, `BETTER_AUTH_URL` (exact origin; HTTPS outside loopback), and a random `BETTER_AUTH_SECRET` of at least 32 characters. `SAAS_DEV_DATABASE=false` selects node-postgres. No secret or password should be put in a NEXT_PUBLIC variable or URL.

```powershell
npm.cmd run db:migrate
npm.cmd run build
npm.cmd run start
```

This workstation is explicitly configured for the local embedded engine:

```dotenv
APP_MODE=saas
PERSISTENCE_MODE=database
SAAS_DEV_DATABASE=true
DATABASE_DRIVER=pglite
DEV_DATABASE_PATH=.data/postgres-saas-dev-fixed
BETTER_AUTH_URL=http://127.0.0.1:3000
```

Set a random secret locally; it is not printed or committed. CLI commands do not automatically load Next's `.env.local`; provide the relevant database environment variables in the shell. Stop the app before accessing the embedded directory:

```powershell
$env:NODE_ENV='development'
$env:DATABASE_DRIVER='pglite'
$env:DEV_DATABASE_PATH='.data/postgres-saas-dev-fixed'
npm.cmd run db:migrate
npm.cmd run db:seed:saas
npm.cmd run db:health
```

Development-only seed password is `Development-only-password-2026`. Accounts use the reserved non-deliverable domain and are only seeded by the guarded development command:

| Account                              | Alpha access | Beta access |
| ------------------------------------ | ------------ | ----------- |
| `ali@development.example.invalid`    | Owner        | Consultant  |
| `sara@development.example.invalid`   | Manager      | Owner       |
| `viewer@development.example.invalid` | none         | Viewer      |

The seed does not replace existing credentials and does not add 3S sample records. Create your own account at [local signup](http://127.0.0.1:3000/signup). Sign in at [local login](http://127.0.0.1:3000/login).

Rate limit keys use the framework's client-IP handling. A deployed reverse proxy must strip spoofed forwarding headers and supply a trusted client IP; the local HTTP test supplies synthetic IPs only to isolate fixtures. Configure external origin, HTTPS, strong secret, trusted reverse proxy, least-privilege PostgreSQL and backups before any deployment. This build was not deployed.

## Architecture and evidence

112 tables after formal migrations `0000`–`0004`. `auth_sessions`, `auth_accounts`, `auth_verifications`, `auth_rate_limits`, `auth_security_events` and `tenant_workspace_documents` extend the 106-table Build 7A schema. The User is the global identity; Membership and AccessRole are per organization; a System Person/BusinessRole is separate and may be explicitly linked by User ID later.

Routes: `/login`, `/signup`, `/onboarding/company`, `/organizations`, `/settings/company`, `/settings/members`, `/settings/profile`, `/invite/[token]`, `/api/auth/[...all]`, `/api/saas`. Existing business routes keep their public URLs and use the active session organization. `/api/advisor` also requires an active company in SaaS mode.

Source boundaries: `lib/server/auth.ts`, `session.ts`, `saas-runtime.ts`, `saas-api.ts`; `services/companies.ts`, `services/workspace.ts`; `components/saas/pages.tsx`, `shell.tsx`, `saas.css`; `lib/saas/workspace-storage.ts`, `navigation.ts`, `roles.ts`. Full module persistence/export compatibility remains in existing parsers/domain services.

Automated evidence: `.build7b-tests.txt` (847 + 31 + original 26), `.build7b-auth-tests.txt` (expanded 29), `.build7b-build.txt`, `.build7b-http.json` (57), `.build7b-local-http.json` (13 routes + 46 assets), `.build7b-audit.json`. Run `npm.cmd run test:all` for the current combined 907 tests. HTTP fixtures: `node tests/saas-http.cjs` against SaaS port 3000; `node tests/local-mode-http.cjs` against explicit local port 3001. Fixtures create disposable development accounts/companies without emailing anyone.

Browser evidence and final observations are saved in `.build7b-browser.json` and `docs/qa/`.
