# Production release checklist

- [ ] Provision standard PostgreSQL with verified TLS; configure DB-level backups/recovery.
- [ ] Configure production environment from `.env.example`; exclude workstation `.env.local` and `.data`.
- [ ] Set canonical HTTPS BETTER_AUTH_URL and stable strong BETTER_AUTH_SECRET.
- [ ] Configure OpenAI key/model server-side; verify model access and evidence-grounded response.
- [ ] Disable embedded DB, development API, and mock providers. Keep SaaS Agent execution disabled.
- [ ] Run `npm ci`, `npm run db:migrate`, `npm run db:status`, `npm run db:health`. Do not seed.
- [ ] Run `npm run test:all`, `npm run typecheck`, `npm run build`.
- [ ] Start supervised production process; both health endpoints return 200.
- [ ] Configure domain/HTTPS manually; inspect Secure/HttpOnly/SameSite cookies and invitation origin.
- [ ] Verify login/logout/session/company selection on actual production PostgreSQL.
- [ ] Visit System, Strategy, Scale, Advisor; verify refresh, restart, logout/login persistence.
- [ ] Verify two users share TEST state; Viewer cannot write; other organizations are isolated.
- [ ] Verify `/dev/agent` and `/api/dev/saas` return 404; no secrets in bundles/responses/logs.
- [ ] Verify controlled DB failure in disposable staging, with no browser storage fallback.
- [ ] Download business export; verify expected sections and no credentials.

Full automated PostgreSQL business-backup restore is deferred. Use PostgreSQL-level backup/restore for Beta disaster recovery. Do not add a lossy restore conversion.

Preparation evidence and unresolved environment limitations: see `docs/qa/production-readiness.md`. Items above are deployment acceptance steps, not a claim that the unconfigured remote environment has passed.
