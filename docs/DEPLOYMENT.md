# Growth Engine Beta deployment

Deploy a Node.js 22 server/container with HTTPS and a persistent standard PostgreSQL database. No deployment or DNS changes were performed by this preparation work.

## A. Create PostgreSQL

Provision an empty database and an application user permitted to apply the committed migrations. Use the provider's TLS connection string and certificate instructions; do not disable certificate verification. Allow five pooled application connections per Node process (plus migration connections). Configure database-level backups and test recovery before real business onboarding. Full automated PostgreSQL business-backup restore remains deferred; downloaded business exports are not a full database restore format.

## B. Configure environment

Use `.env.example` as the inventory. Set `NODE_ENV=production`, `APP_MODE=saas`, `PERSISTENCE_MODE=database`, `DATABASE_DRIVER=postgresql`, `DATABASE_URL`, `BETTER_AUTH_URL=https://YOUR-DOMAIN` (origin only, no trailing slash), and a stable random `BETTER_AUTH_SECRET` of at least 32 characters. The canonical application URL variable is **BETTER_AUTH_URL**, not APP_URL. Set `AGENT_MODEL_PROVIDER=openai`, `OPENAI_API_KEY`, and optionally `OPENAI_MODEL` (default `gpt-6-luna`, subject to project access). Keep `SAAS_DEV_DATABASE`, `SAAS_DEV_API_ENABLED`, and `AGENT_ALLOW_MOCK_DEMO` false.

Store secrets in your host's secret manager; never use NEXT_PUBLIC_ variables for secrets. Do not copy the workstation's `.env.local` or `.data` directory into production. Export these variables to migration commands as well as the server. Startup rejects missing critical configuration and embedded development databases. Removing OpenAI configuration preserves deterministic analysis; explicitly selecting OpenAI without its key fails startup.

## C. Install and migrate

From the application root, using the configured production environment:

```sh
npm ci
npm run db:migrate
npm run db:status
npm run db:health
```

`db:status` verifies every committed migration hash and timestamp. Stop if any command fails. Never run `db:seed`, `db:seed:saas`, or `db:reset:dev` in production. For an existing database, take a PostgreSQL backup before applying migrations. Migration commands do not import localStorage or seed business data automatically.

## D. Build and start

```sh
npm run test:all
npm run typecheck
npm run build
npm start -- --port 3000
```

Start a supervised Node process using your hosting platform. Use `npm start`, which validates configuration before opening a listener; do not bypass its prestart check. It listens on available interfaces; place it behind the platform's HTTPS reverse proxy. Pass PORT or an explicit port as required. Keep the committed `drizzle/` directory and `scripts/` directory in the deployment artifact. Keep development dependencies installed: the build, migration CLI and start preflight use TypeScript tooling. Do not run `npm ci --omit=dev` for this deployment layout. No migrations or seeds run automatically at startup.

## E. Check health

```sh
curl --fail http://127.0.0.1:3000/api/health
curl --fail http://127.0.0.1:3000/api/health/ready
```

Liveness returns `{"status":"ok"}` without a database query. Readiness checks the database, organization schema, and applied migration count; it returns 503 with `{"status":"not_ready"}` on failure, without credentials or stack traces. Gate traffic on readiness, not liveness alone.

## F. Domain and HTTPS (manual)

Configure your domain, DNS, HTTPS certificate and reverse proxy on the host. Preserve the public host and HTTPS protocol, and use the same HTTPS origin in BETTER_AUTH_URL. Permit only intended application origins. The app uses Secure/HttpOnly/SameSite=Lax auth cookies for HTTPS. Generated invitation URLs use the configured origin. HTTP is allowed only for loopback QA. Verify both health endpoints again through the public URL.

## G. Smoke test (manual)

Create an isolated TEST organization using the normal UI. Sign in, select it, visit System, Strategy, Scale and Advisor, and confirm refresh plus logout/login preserves its data. Use two users to verify shared organization state and a Viewer to verify denied writes. Verify another organization is isolated. Ask Advisor “الان مهم‌ترین مسئله این کسب‌وکار چیست و بر اساس چه شواهدی؟” and inspect evidence links. Download and validate a business export. Verify `/dev/agent` and `/api/dev/saas` return 404. Keep SaaS Agent execution disabled. Confirm database failure yields a controlled error, never a localStorage fallback (use a disposable staging environment only).

## Current validation limitation

This workstation has an explicit PGlite development database, not a standalone PostgreSQL service. The hardened production server intentionally refuses that configuration. Prior Beta browser/shared-state/auth/OpenAI QA used embedded development PostgreSQL; it does not certify the new production deployment against standalone PostgreSQL. Complete the SaaS login/company/module smoke sequence above against your provisioned PostgreSQL before admitting users. No business data was migrated, cleared, or overwritten during readiness preparation.
