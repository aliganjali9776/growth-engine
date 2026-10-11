const assert = require("node:assert/strict");
const fs = require("node:fs");
const base = "http://127.0.0.1:3000";
const results = [];
async function run() {
  let serial = 0;
  const identities = {};
  async function check(name, actual, expected) {
    assert.equal(actual, expected, name);
    results.push({ name, status: actual });
  }
  async function request(path, cookie, body, org) {
    const r = await fetch(base + path, {
      method: body ? "POST" : "GET",
      headers: {
        origin: base,
        "content-type": "application/json",
        cookie: cookie ?? "",
        ...(org ? { "x-organization-id": org } : {}),
        "x-forwarded-for": "127.0.1." + ((++serial % 220) + 1),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    let json;
    try {
      json = await r.json();
    } catch {
      json = {};
    }
    return { r, json };
  }
  for (const role of [
    "Owner",
    "Admin",
    "Consultant",
    "Manager",
    "Editor",
    "Viewer",
  ]) {
    const { r } = await request("/api/auth/sign-in/email", "", {
      email: "7c." + role.toLowerCase() + "@development.example.invalid",
      password: "Development-only-password-2026",
    });
    await check(role + " login", r.status, 200);
    const cookie = r.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
    const { json } = await request("/api/saas", cookie);
    const org = json.organizations.find(
      (o) => o.name === "آلفا · آزمون دسترسی",
    ).id;
    await check(
      role + " switch",
      (
        await request("/api/saas", cookie, {
          operation: "switch",
          organizationId: org,
        })
      ).r.status,
      200,
    );
    identities[role] = { cookie, org };
    const ctx = (await request("/api/saas", cookie)).json;
    assert.equal(
      ctx.current.permissions.includes("agent.execute"),
      ["Owner", "Admin"].includes(role),
    );
    results.push({ name: role + " effective permissions", status: "pass" });
    await check(
      role + " member read",
      (await request("/api/saas?operation=members", cookie, null, org)).r
        .status,
      ["Owner", "Admin"].includes(role) ? 200 : 403,
    );
  }
  const owner = identities.Owner,
    consultant = identities.Consultant,
    viewer = identities.Viewer;
  for (const op of [
    "prepareAgentAction",
    "approveAgentAction",
    "executeAgentAction",
  ])
    await check(
      "Viewer " + op,
      (
        await request(
          "/api/saas",
          viewer.cookie,
          {
            operation: op,
            capabilityId: "strategy.createInitiative",
            title: "Denied",
            payload: {},
            actionId: "00000000-0000-4000-8000-000000000001",
            approvalId: "00000000-0000-4000-8000-000000000002",
            revision: 1,
            decision: "Approved",
            explicitExecute: true,
          },
          viewer.org,
        )
      ).r.status,
      403,
    );
  await check(
    "actor spoof rejected",
    (
      await request(
        "/api/saas",
        owner.cookie,
        {
          operation: "prepareAgentAction",
          actorUserId: "forged",
          capabilityId: "strategy.createInitiative",
          title: "Rejected",
          payload: {},
        },
        owner.org,
      )
    ).r.status,
    400,
  );
  await check(
    "org header spoof rejected",
    (
      await request(
        "/api/saas",
        owner.cookie,
        {
          operation: "prepareAgentAction",
          capabilityId: "strategy.createInitiative",
          title: "Rejected",
          payload: {},
        },
        "00000000-0000-4000-8000-000000000003",
      )
    ).r.status,
    409,
  );
  await check(
    "body organization spoof rejected",
    (
      await request(
        "/api/saas",
        owner.cookie,
        {
          operation: "prepareAgentAction",
          organizationId: "00000000-0000-4000-8000-000000000003",
          capabilityId: "strategy.createInitiative",
          title: "Rejected",
          payload: {},
        },
        owner.org,
      )
    ).r.status,
    403,
  );
  await check(
    "approval actor spoof rejected",
    (
      await request(
        "/api/saas",
        owner.cookie,
        { operation: "approveAgentAction", approvedByUserId: "forged" },
        owner.org,
      )
    ).r.status,
    400,
  );
  const prepared = await request(
    "/api/saas",
    consultant.cookie,
    {
      operation: "prepareAgentAction",
      capabilityId: "strategy.createInitiative",
      title: "HTTP RBAC proposal",
      payload: { title: "QA only" },
    },
    consultant.org,
  );
  await check("Consultant prepare", prepared.r.status, 201);
  const action = prepared.json;
  await check(
    "Consultant approval denied",
    (
      await request(
        "/api/saas",
        consultant.cookie,
        {
          operation: "approveAgentAction",
          actionId: action.id,
          revision: 1,
          decision: "Approved",
        },
        consultant.org,
      )
    ).r.status,
    403,
  );
  const approved = await request(
    "/api/saas",
    owner.cookie,
    {
      operation: "approveAgentAction",
      actionId: action.id,
      revision: 1,
      decision: "Approved",
    },
    owner.org,
  );
  await check("Owner approve", approved.r.status, 200);
  assert.notEqual(action.requestedByUserId, approved.json.approvedByUserId);
  results.push({ name: "separate server actors", status: "pass" });
  const execution = await request(
    "/api/saas",
    owner.cookie,
    {
      operation: "executeAgentAction",
      actionId: action.id,
      approvalId: approved.json.id,
      explicitExecute: true,
    },
    owner.org,
  );
  await check(
    "Owner execution remains deliberately disabled",
    execution.r.status,
    403,
  );
  assert.equal(execution.json.error.code, "Disabled");
  await check(
    "Viewer audit denied",
    (
      await request(
        "/api/saas?operation=audit",
        viewer.cookie,
        null,
        viewer.org,
      )
    ).r.status,
    403,
  );
  await check(
    "Owner audit read",
    (await request("/api/saas?operation=audit", owner.cookie, null, owner.org))
      .r.status,
    200,
  );
  fs.writeFileSync(
    ".build7c-http.json",
    JSON.stringify({ passed: results.length, results }, null, 2),
  );
  console.log(results.length + " HTTP RBAC checks passed");
}
run().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
