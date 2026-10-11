const assert = require("node:assert/strict");
const base = "http://127.0.0.1:3000";
const action = process.argv[2];
async function main() {
  const r = await fetch(base + "/api/auth/sign-in/email", {
    method: "POST",
    headers: {
      origin: base,
      "content-type": "application/json",
      "x-forwarded-for": "127.0.2.42",
    },
    body: JSON.stringify({
      email: "7c.owner@development.example.invalid",
      password: "Development-only-password-2026",
    }),
  });
  assert.equal(r.status, 200);
  const cookie = r.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  async function call(body, org) {
    const resp = await fetch(base + "/api/saas", {
      method: "POST",
      headers: {
        origin: base,
        "content-type": "application/json",
        cookie,
        ...(org ? { "x-organization-id": org } : {}),
      },
      body: JSON.stringify(body),
    });
    assert.equal(resp.status, 200, await resp.clone().text());
    return resp.json();
  }
  const ctx = await (
    await fetch(base + "/api/saas", { headers: { cookie } })
  ).json();
  const org = ctx.organizations.find(
    (o) => o.name === "آلفا · آزمون دسترسی",
  ).id;
  await call({ operation: "switch", organizationId: org });
  const members = await (
    await fetch(base + "/api/saas?operation=members", {
      headers: { cookie, "x-organization-id": org },
    })
  ).json();
  const m = members.members.find(
    (u) => u.email === "7c.manager@development.example.invalid",
  );
  assert.ok(m);
  await call(
    {
      operation: "changeMember",
      membershipId: m.id,
      version: m.version,
      ...(action === "suspend"
        ? { status: "Suspended" }
        : action === "restore"
          ? { role: "Manager", status: "Active" }
          : { role: "Viewer" }),
    },
    org,
  );
  console.log("Isolated Manager QA membership: " + action);
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
