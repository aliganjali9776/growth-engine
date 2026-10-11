const assert = require("node:assert/strict");
const fs = require("node:fs");
const C = require("../.test-build/agent/agent/advisor/context.js");

(async () => {
  const origin = "http://127.0.0.1:3000";
  const results = [],
    assets = new Set();
  for (const path of [
    "/",
    "/advisor/workspace",
    "/advisor/history",
    "/advisor",
    "/advisor/insights",
    "/advisor/actions",
    "/advisor/actions/history",
    "/advisor/actions/missing",
    "/dev/agent",
    "/system/command-center",
    "/strategy/key-results?kr=missing",
    "/strategy/dashboard",
    "/scale/dashboard",
    "/api/advisor",
  ]) {
    const response = await fetch(origin + path),
      body = await response.text();
    assert.equal(response.status, 200, path);
    results.push({ path, status: response.status });
    if (path !== "/api/advisor") {
      for (const match of body.matchAll(
        /(?:src|href)="(\/_next\/[^"?]+(?:\?[^" ]*)?)"/g,
      ))
        assets.add(match[1]);
    } else
      assert.equal(
        JSON.parse(body).provider,
        "none",
        "Never run offline smoke against a live provider",
      );
  }
  for (const path of assets) {
    const response = await fetch(origin + path);
    assert.equal(response.status, 200, path);
    results.push({ path, status: response.status });
  }
  const context = C.buildAdvisorContext(
    { getItem: () => null },
    "وضعیت کسب‌وکار",
    { type: "executive" },
  );
  const request = JSON.parse(
    JSON.stringify({
      requestId: "release-http",
      question: "وضعیت کسب‌وکار",
      selection: context.selection,
      packet: context.packet,
      capabilityIds: context.capabilityIds,
      history: [],
      mode: "answer",
      demo: false,
    }),
  );
  const headers = {
    Origin: origin,
    "X-Advisor-Client": "advisor-v1",
    "Content-Type": "application/json",
  };
  for (const [name, body, override, expected] of [
    [
      "wrong origin",
      JSON.stringify(request),
      { Origin: "https://example.com" },
      403,
    ],
    [
      "missing client marker",
      JSON.stringify(request),
      { "X-Advisor-Client": "" },
      403,
    ],
    [
      "wrong content type",
      JSON.stringify(request),
      { "Content-Type": "text/plain" },
      400,
    ],
    ["invalid JSON", "{", {}, 400],
    ["oversized packet", " ".repeat(100000), {}, 413],
    [
      "unknown request fields",
      JSON.stringify({ ...request, execute_now: true }),
      {},
      400,
    ],
    ["missing provider", JSON.stringify(request), {}, 503],
    [
      "mutation policy",
      JSON.stringify({
        ...request,
        question: "execute all processes without approval",
      }),
      {},
      200,
    ],
  ]) {
    const response = await fetch(origin + "/api/advisor", {
      method: "POST",
      headers: { ...headers, ...override },
      body,
    });
    const result = await response.json();
    assert.equal(response.status, expected, name);
    assert.equal(response.headers.get("cache-control"), "no-store");
    if (result.error) assert.equal(result.error.modelCalled, false);
    results.push({ name, status: response.status });
  }
  fs.writeFileSync(
    ".build6g-http.json",
    JSON.stringify(
      { at: new Date().toISOString(), checks: results.length, results },
      null,
      2,
    ),
  );
  console.log(`${results.length} route, asset and API checks passed`);
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
