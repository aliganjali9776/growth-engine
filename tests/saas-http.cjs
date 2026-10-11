const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs");
const base = "http://127.0.0.1:3000",
  suffix = randomUUID().slice(0, 8);
let count = 0;
const checked = (condition, message) => {
  assert.ok(condition, message);
  count++;
};
const password = "Development-only-password-2026";
async function auth(path, body, cookie = "", ip = "127.77.0.1") {
  return fetch(base + "/api/auth/" + path, {
    method: body ? "POST" : "GET",
    headers: {
      origin: base,
      "content-type": "application/json",
      cookie,
      "x-forwarded-for": ip,
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
}
function cookies(response) {
  return response.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}
async function signup(email, name, ip) {
  const r = await auth("sign-up/email", { email, name, password }, "", ip);
  checked(r.status === 200, "signup");
  const body = await r.json();
  checked(!("token" in body), "token is cookie-only");
  checked(r.headers.get("set-cookie").includes("HttpOnly"), "HttpOnly");
  checked(r.headers.get("set-cookie").includes("SameSite=Lax"), "SameSite");
  return { email, cookie: cookies(r), id: body.user.id };
}
async function api(user, body, org, operation = "context", origin = base) {
  return fetch(base + "/api/saas?operation=" + operation, {
    method: body ? "POST" : "GET",
    headers: {
      origin,
      "content-type": "application/json",
      cookie: user?.cookie ?? "",
      ...(org ? { "x-organization-id": org } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
}
const company = (name) => ({
  operation: "createCompany",
  name,
  industry: "خدمات",
  businessModel: "service",
  teamSize: "1–5",
  country: "ایران",
  currency: "IRR",
  timezone: "Asia/Tehran",
});
(async () => {
  for (const path of [
    "/system",
    "/strategy",
    "/scale",
    "/advisor",
    "/settings/members",
  ]) {
    const r = await fetch(base + path, { redirect: "manual" });
    checked(
      r.status === 307 && r.headers.get("location").includes("/login"),
      "protected " + path,
    );
  }
  for (const path of [
    "/login",
    "/signup",
    "/login?returnTo=%2Fstrategy",
    "/signup?returnTo=%2Finvite%2Ftest",
  ]) {
    const r = await fetch(base + path);
    checked(r.status === 200, "public " + path);
  }
  checked((await api(null)).status === 401, "unauthenticated API denied");
  const forgedPage = await fetch(base + "/system", {
    headers: { cookie: "better-auth.session_token=forged.signature" },
    redirect: "manual",
  });
  checked(
    forgedPage.status === 307 &&
      forgedPage.headers.get("location").includes("/login"),
    "cookie presence is not page authorization",
  );
  checked(
    (
      await auth("request-password-reset", {
        email: "nobody@development.example.invalid",
      })
    ).status === 404,
    "unconfigured reset is not exposed",
  );
  const a = await signup(
    "qa-owner-" + suffix + "@development.example.invalid",
    "مالک آزمون 7B",
    "127.77.0.1",
  );
  checked(
    (await (await api(a)).json()).next === "/onboarding/company",
    "onboarding",
  );
  const madeA = await api(a, company("آلفا آزمون " + suffix));
  checked(madeA.status === 201, "company Alpha");
  const alpha = (await madeA.json()).organization.id;
  const initial = await (await api(a, undefined, alpha, "workspace")).json();
  checked(
    JSON.parse(initial.stores["growth-engine.system.v1"]).processes.length ===
      0,
    "clean company",
  );
  const madeB = await api(a, company("بتا آزمون " + suffix));
  checked(madeB.status === 201, "company Beta");
  const beta = (await madeB.json()).organization.id;
  checked(
    (await api(a, { operation: "switch", organizationId: alpha })).status ===
      200,
    "switch Alpha",
  );
  checked(
    (await (await api(a)).json()).organizations.length === 2,
    "multiple memberships",
  );
  checked(
    (
      await fetch(base + "/system", {
        headers: { cookie: a.cookie },
        redirect: "manual",
      })
    ).status === 200,
    "authenticated deep route",
  );
  for (const path of [
    "/assessment",
    "/strategy",
    "/scale",
    "/advisor/workspace",
    "/settings/company",
    "/settings/members",
    "/settings/profile",
  ]) {
    const r = await fetch(base + path, {
      headers: { cookie: a.cookie },
      redirect: "manual",
    });
    checked(r.status === 200, "authenticated " + path);
  }
  checked(
    (await api(a, { operation: "invite", email: 42, role: "Manager" }, alpha))
      .status === 400,
    "invalid invite input is safe",
  );
  const email = "qa-member-" + suffix + "@development.example.invalid";
  const invited = await api(
    a,
    { operation: "invite", email, role: "Manager" },
    alpha,
  );
  checked(invited.status === 201, "invite");
  const invite = await invited.json();
  const invitePage = await fetch(base + "/invite/" + invite.token);
  checked(invitePage.status === 200, "public invitation");
  checked(
    (await invitePage.text()).includes('name="referrer" content="no-referrer"'),
    "invitation referrer privacy",
  );
  const b = await signup(email, "عضو آزمون 7B", "127.77.0.2");
  checked(
    (await api(b, { operation: "acceptInvite", token: invite.token }))
      .status === 200,
    "accept invitation",
  );
  checked(
    (await api(b, { operation: "acceptInvite", token: invite.token }))
      .status === 410,
    "single-use invitation",
  );
  checked(
    (await api(b, { operation: "switch", organizationId: beta })).status ===
      403,
    "cross-tenant denied",
  );
  const team = await (await api(a, undefined, alpha, "members")).json(),
    member = team.members.find((m) => m.userId === b.id),
    owner = team.members.find((m) => m.userId === a.id);
  checked(member.roles.includes("Manager"), "Manager display");
  const changed = await api(
    a,
    {
      operation: "changeMember",
      membershipId: member.id,
      version: member.version,
      role: "Editor",
    },
    alpha,
  );
  checked(changed.status === 200, "role change");
  const updated = await changed.json();
  const suspended = await api(
    a,
    {
      operation: "changeMember",
      membershipId: member.id,
      version: updated.version,
      status: "Suspended",
    },
    alpha,
  );
  checked(suspended.status === 200, "suspend");
  const suspendedRecord = await suspended.json();
  checked(
    (await api(b, undefined, alpha, "workspace")).status === 403,
    "suspended access denied",
  );
  checked(
    (
      await api(
        a,
        {
          operation: "changeMember",
          membershipId: member.id,
          version: suspendedRecord.version,
          status: "Active",
        },
        alpha,
      )
    ).status === 200,
    "restore",
  );
  for (const status of ["Suspended", "Removed"]) {
    checked(
      (
        await api(
          a,
          {
            operation: "changeMember",
            membershipId: owner.id,
            version: owner.version,
            status,
          },
          alpha,
        )
      ).status === 409,
      "last Owner " + status,
    );
  }
  checked(
    (
      await api(
        a,
        {
          operation: "changeMember",
          membershipId: owner.id,
          version: owner.version,
          role: "Manager",
        },
        alpha,
      )
    ).status === 409,
    "last Owner demotion",
  );
  checked(
    (await api(a, { operation: "switch", organizationId: beta, userId: b.id }))
      .status === 400,
    "client identity rejected",
  );
  checked(
    (
      await api(
        a,
        { operation: "switch", organizationId: beta },
        undefined,
        "context",
        "https://foreign.example",
      )
    ).status === 403,
    "CSRF",
  );
  const session = await auth("get-session", undefined, a.cookie);
  const sessionBody = await session.json();
  checked(
    session.status === 200 && !sessionBody.session.token,
    "session response sanitized",
  );
  const invalid = await fetch(base + "/invite/invalid");
  checked(
    invalid.status === 200 &&
      (await invalid.text()).includes("این دعوت در دسترس نیست"),
    "invalid invitation UI",
  );
  const logout = await auth("sign-out", {}, b.cookie);
  checked(logout.status === 200, "logout");
  checked((await api(b)).status === 401, "logged-out session denied");
  const login = await auth(
    "sign-in/email",
    { email: a.email, password, rememberMe: true },
    "",
    "127.77.0.3",
  );
  checked(login.status === 200, "login again");
  a.cookie = cookies(login);
  const ctx = await (await api(a)).json();
  checked(ctx.current.organization.id === alpha, "last company remembered");
  fs.writeFileSync(
    ".build7b-http.json",
    JSON.stringify(
      { passed: count, alphaId: alpha, betaId: beta, developmentOnly: true },
      null,
      2,
    ),
  );
  console.log(
    count + " production HTTP authentication and tenant checks passed",
  );
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
