# Existing Advisor: OpenAI connection

October 7, 2026. Small integration through the existing BUILD 6B AgentModelProvider / AdvisorProvider abstraction; no BUILD 7D architecture change or deployment.

OPENAI_API_KEY is read only on the server. OPENAI_MODEL selects the model, defaulting to gpt-6-luna. A configured key automatically selects OpenAI unless the existing explicit provider switch overrides it. No key leaves the existing deterministic workspace analysis/evidence path available. GET /api/advisor provides authenticated, secret-free configured / missing_key / provider_error status; the error state reflects the most recent provider attempt, not a background ping.

The adapter uses POST https://api.openai.com/v1/responses, strict text.format JSON schema, store=false, a bounded output budget and no tools or web search. Context is the existing curated packet, capped at 20 evidence records / 32KB; server-side SaaS processing rebuilds it from the permission-filtered active organization's stores. Browser-supplied evidence and prior prose are not treated as server facts. No auth, memberships, raw audit logs, database dump, other organizations or API keys are sent. The model receives no mutation tools. SaaS Agent business execution remains disabled.

Existing output validation checks shapes, references, supported numerical claims and confidence. Unknown inline Evidence IDs are rejected too. Citation IDs do not count as numerical business claims. The workspace presents fact, interpretation, recommendation and data gap separately as labeled text. Notes/SOPs/comments remain untrusted data in the prompt.

Real smoke question: «الان مهم‌ترین مسئله این کسب‌وکار چیست و بر اساس چه شواهدی؟»

The configured key returned HTTP 200 / completed from gpt-6-luna. The independent synthetic smoke passed schema/evidence validation; its report records 17 input evidence items and six validated sources, without raw provider body or credentials: qa/advisor-openai-smoke.json. The real browser → server → OpenAI → validated response → workspace flow also succeeded in the approved TEST organization, with six expandable evidence cards and source links: qa/advisor-openai-real-browser.png. Earlier invalid responses were rejected before rendering; validation was not weakened to accept them. A routing shortcut that intercepted a question mentioning evidence now lets a connected free-form analysis reach the provider while retaining explicit evidence-only controls and no-key behavior.

Tests include valid response, missing metrics/data, unknown references (including inline references), timeout, network/provider errors, no-key provider selection and safe health status. Logs: .advisor-openai-final-regression.txt and .advisor-openai-build.txt. No migration, new Agent execution path or deployment was performed.

Final verification: **1,006 tests passed, zero failures** (849 business/Advisor, 31 database, 30 auth, 40 RBAC, 24 migration, 32 domain). Production build passed and the production app restarted locally in 295 ms. All 70 generated browser JavaScript/map assets were checked against the configured API key; none contained it. The key value was never printed or written to evidence files. Real smoke and reference validation passed; no blocking issue remains.
