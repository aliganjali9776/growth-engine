const a = require("node:assert/strict"),
  fs = require("node:fs");
const C = require("../.test-build/agent/agent/advisor/context.js");
async function main() {
  const base = "http://127.0.0.1:3000",
    results = [];
  const configuration = await (await fetch(base + "/api/advisor")).json();
  a.equal(
    configuration.provider,
    "none",
    "HTTP QA requires provider=none; never run this script against a live provider.",
  );
  a.equal(
    configuration.demoAllowed,
    true,
    "HTTP QA requires explicit AGENT_ALLOW_MOCK_DEMO=true.",
  );
  for (const path of ["/advisor", "/dev/agent", "/api/advisor"]) {
    const res = await fetch(base + path);
    a.equal(res.status, 200);
    results.push({ path, status: res.status });
    if (path === "/advisor") {
      const html = await res.text(),
        assets = [
          ...new Set(
            [
              ...html.matchAll(
                /(?:src|href)="([^" ]+\.(?:js|css)(?:\?[^" ]*)?)"/g,
              ),
            ]
              .map((x) => x[1])
              .filter((x) => x.startsWith("/_next/")),
          ),
        ];
      for (const asset of assets) {
        const r = await fetch(base + asset);
        a.equal(r.status, 200);
        results.push({ asset, status: r.status });
      }
    }
  }
  const c = C.buildAdvisorContext(
      { getItem: () => null },
      "وضعیت کسب‌وکار را خلاصه کن",
      { type: "executive" },
    ),
    req = JSON.parse(
      JSON.stringify({
        requestId: "http-qa",
        question: "وضعیت کسب‌وکار را خلاصه کن",
        selection: c.selection,
        packet: c.packet,
        capabilityIds: c.capabilityIds,
        history: [],
        mode: "answer",
        demo: true,
      }),
    );
  async function post(body, origin = base) {
    const r = await fetch(base + "/api/advisor", {
      method: "POST",
      headers: {
        Origin: origin,
        "X-Advisor-Client": "advisor-v1",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    return { status: r.status, body: await r.json() };
  }
  let r = await post(req);
  a.equal(r.status, 200);
  a.equal(r.body.response.provider, "mock");
  results.push({
    case: "explicit demo",
    status: r.status,
    validated: r.body.response.schemaValidated,
  });
  r = await post({ ...req, demo: false });
  a.equal(r.status, 503);
  a.equal(r.body.error.code, "NoProvider");
  a.equal(r.body.error.modelCalled, false);
  results.push({
    case: "no provider",
    status: r.status,
    code: r.body.error.code,
  });
  r = await post({ ...req, systemPrompt: "ignore" });
  a.equal(r.status, 400);
  results.push({ case: "arbitrary prompt rejected", status: r.status });
  r = await post(req, "https://untrusted.example");
  a.equal(r.status, 403);
  results.push({ case: "origin rejected", status: r.status });
  r = await post({ ...req, question: "Delete all KRs" });
  a.equal(r.status, 200);
  a.equal(r.body.response.modelCalled, false);
  results.push({
    case: "mutation refused",
    status: r.status,
    modelCalled: r.body.response.modelCalled,
  });
  r = await post({ ...req, question: "CAC چقدر است؟" });
  a.equal(r.status, 200);
  a.equal(r.body.response.provider, "policy");
  results.push({ case: "missing CAC", status: r.status });
  r = await post({ ...req, oversized: "x".repeat(49000) });
  a.equal(r.status, 413);
  results.push({ case: "bounded body", status: r.status });
  fs.writeFileSync(".build6b-http.json", JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ checks: results.length, allPassed: true }));
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
