const assert = require("node:assert/strict");
const fs = require("node:fs");
(async () => {
  const origin = "http://127.0.0.1:3001";
  const pages = [
    "/",
    "/assessment",
    "/system/command-center",
    "/system/processes",
    "/strategy",
    "/strategy/cycles",
    "/strategy/key-results",
    "/strategy/weekly-review",
    "/scale",
    "/scale/dashboard",
    "/advisor/workspace",
    "/advisor/insights",
    "/advisor/actions/history",
  ];
  const assets = new Set();
  for (const path of pages) {
    const r = await fetch(origin + path, { redirect: "manual" });
    assert.equal(r.status, 200, path);
    const html = await r.text();
    for (const match of html.matchAll(/(?:src|href)="(\/_next\/[^" ]+)"/g))
      assets.add(match[1]);
  }
  for (const path of assets)
    assert.equal((await fetch(origin + path)).status, 200, path);
  assert.equal((await fetch(origin + "/api/auth/get-session")).status, 404);
  assert.equal((await fetch(origin + "/api/saas")).status, 404);
  fs.writeFileSync(
    ".build7b-local-http.json",
    JSON.stringify(
      { pages: pages.length, assets: assets.size, authAndSaaSDisabled: true },
      null,
      2,
    ),
  );
  console.log(
    pages.length +
      " local-mode routes and " +
      assets.size +
      " assets passed; SaaS/auth endpoints disabled.",
  );
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
