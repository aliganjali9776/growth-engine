import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { and, eq } from "drizzle-orm";
import * as S from "../lib/server/db/schema";
import { createAuth } from "../lib/server/auth";
import { authenticatedSession, activeContext } from "../lib/server/session";
import { createSaaSHandlers } from "../lib/server/saas-api";
import * as C from "../lib/server/services/companies";
import {
  readTenantWorkspace,
  writeTenantWorkspace,
  emptyCompanyStores,
} from "../lib/server/services/workspace";
import { resolveOrganizationContext } from "../lib/server/context";
import { safeReturn } from "../lib/saas/navigation";
import { validateLocalExport, localStoreKeys } from "../lib/persistence/export";
import {
  bindWorkspaceStorage,
  lockWorkspaceStorage,
  businessStorage,
  createWorkspaceStorage,
} from "../lib/saas/workspace-storage";
const pg = new PGlite(),
  db = drizzle(pg, { schema: S });
const baseURL = "http://localhost:3000",
  auth = createAuth(db, {
    baseURL,
    secret: "isolated-integration-test-secret-1234567890",
  }),
  api = createSaaSHandlers(db, auth, baseURL);
type Identity = {
  id: string;
  email: string;
  cookie: string;
  sessionId: string;
  password: string;
};
let ali: Identity, sara: Identity, viewer: Identity;
let alpha: string, beta: string;
function headers(cookie = "", ip = "127.0.0.1") {
  return new Headers({
    cookie,
    origin: baseURL,
    "content-type": "application/json",
    "x-forwarded-for": ip,
  });
}
async function authRequest(
  path: string,
  body?: unknown,
  cookie = "",
  ip = "127.0.0.1",
) {
  return auth.handler(
    new Request(baseURL + "/api/auth/" + path, {
      method: body ? "POST" : "GET",
      headers: headers(cookie, ip),
      body: body ? JSON.stringify(body) : undefined,
    }),
  );
}
function cookieOf(response: Response) {
  return response.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}
async function signup(
  email: string,
  name: string,
  ip = "127.0.0.1",
): Promise<Identity> {
  const password = "Development-only-password-2026";
  const r = await authRequest(
    "sign-up/email",
    { email, name, password },
    "",
    ip,
  );
  assert.equal(r.status, 200, await r.clone().text());
  const result = await r.json(),
    cookie = cookieOf(r);
  const identity = await authenticatedSession(db, auth, headers(cookie));
  return {
    id: result.user.id,
    email: result.user.email,
    cookie,
    sessionId: identity.session.id,
    password,
  };
}
async function call(
  identity: Identity | null,
  body?: unknown,
  org?: string,
  operation = "context",
) {
  return api(
    new Request(baseURL + "/api/saas?operation=" + operation, {
      method: body ? "POST" : "GET",
      headers: new Headers({
        ...Object.fromEntries(headers(identity?.cookie)),
        ...(org ? { "x-organization-id": org } : {}),
      }),
      body: body ? JSON.stringify(body) : undefined,
    }),
  );
}
const company = (name: string) => ({
  operation: "createCompany",
  name,
  industry: "Services",
  businessModel: "service",
  teamSize: "1–5",
  country: "IR",
  currency: "IRR",
  timezone: "Asia/Tehran",
});
const errorCode = (code: string) => (e: any) => e.code === code;
before(async () => {
  await migrate(db, { migrationsFolder: "drizzle" });
});
after(async () => {
  await pg.close();
});
test("7B A/C signup creates a real identity and scrypt credential without plaintext", async () => {
  ali = await signup("ALI@auth.example.invalid", "Ali");
  assert.equal(ali.email, "ali@auth.example.invalid");
  const [record] = await db
    .select()
    .from(S.authAccounts)
    .where(eq(S.authAccounts.userId, ali.id));
  assert.notEqual(record.password, ali.password);
  assert.ok(record.password?.includes(":"));
  assert.equal(
    (await db.select().from(S.authEvents)).some(
      (e) => e.action === "AccountCreated",
    ),
    true,
  );
  assert.ok(
    !JSON.stringify(await db.select().from(S.authEvents)).includes(
      ali.password,
    ),
  );
});
test("7B B duplicate email does not create another user", async () => {
  const r = await authRequest("sign-up/email", {
    email: ali.email,
    name: "Duplicate",
    password: ali.password,
  });
  assert.equal(r.status, 422);
  assert.equal(
    (await db.select().from(S.users).where(eq(S.users.email, ali.email)))
      .length,
    1,
  );
});
test("7B D/E separate credential login succeeds and incorrect password is rejected", async () => {
  const good = await authRequest(
    "sign-in/email",
    { email: ali.email, password: ali.password, rememberMe: true },
    "",
    "127.0.0.2",
  );
  assert.equal(good.status, 200);
  assert.ok(cookieOf(good).includes("session_token"));
  const bad = await authRequest(
    "sign-in/email",
    { email: ali.email, password: "not-the-password" },
    "",
    "127.0.0.2",
  );
  assert.equal(bad.status, 401);
});
test("7B G session survives repeated server resolution; tampered and expired sessions fail", async () => {
  assert.equal(
    (await authenticatedSession(db, auth, headers(ali.cookie))).user.id,
    ali.id,
  );
  assert.equal(
    (await authenticatedSession(db, auth, headers(ali.cookie))).user.id,
    ali.id,
  );
  await assert.rejects(
    authenticatedSession(db, auth, headers(ali.cookie + "tampered")),
    errorCode("Forbidden"),
  );
  const another = await authRequest(
      "sign-in/email",
      { email: ali.email, password: ali.password },
      "",
      "127.0.0.3",
    ),
    cookie = cookieOf(another);
  const old = await authenticatedSession(db, auth, headers(cookie));
  await db
    .update(S.authSessions)
    .set({ expiresAt: new Date(0) })
    .where(eq(S.authSessions.id, old.session.id));
  await assert.rejects(
    authenticatedSession(db, auth, headers(cookie)),
    errorCode("Forbidden"),
  );
});
test("7B J no active companies points to onboarding; forged user identity is rejected", async () => {
  const r = await call(ali),
    body = await r.json();
  assert.equal(body.next, "/onboarding/company");
  assert.deepEqual(body.organizations, []);
  assert.equal(
    (await call(ali, { ...company("Forged"), userId: randomUUID() })).status,
    400,
  );
});
test("7B K company creation transaction creates Owner profile settings and current company", async () => {
  const r = await call(ali, company("Company Alpha"));
  assert.equal(r.status, 201, await r.clone().text());
  alpha = (await r.json()).organization.id;
  const c = await activeContext(db, auth, headers(ali.cookie));
  assert.equal(c.context.organizationId, alpha);
  assert.ok(c.context.permissions.includes("members.invite"));
  const view = await C.listOrganizations(db, ali.id);
  assert.deepEqual(view[0].roles, ["Owner"]);
  assert.equal(
    (
      await db
        .select()
        .from(S.organizationSettings)
        .where(eq(S.organizationSettings.organizationId, alpha))
    ).length,
    1,
  );
});
test("7B L/M two companies use unique hidden slugs and membership-checked session switch", async () => {
  const made = await call(ali, company("Company Alpha"));
  assert.equal(made.status, 201);
  beta = (await made.json()).organization.id;
  const orgs = await C.listOrganizations(db, ali.id);
  assert.equal(orgs.length, 2);
  assert.notEqual(orgs[0].slug, orgs[1].slug);
  assert.equal(
    (await call(ali, { operation: "switch", organizationId: alpha })).status,
    200,
  );
  assert.equal(
    (await activeContext(db, auth, headers(ali.cookie))).context.organizationId,
    alpha,
  );
  assert.equal(
    (await call(ali, { operation: "switch", organizationId: randomUUID() }))
      .status,
    403,
  );
});
test("7B N/Z workspace starts clean; shared data and private Agent context never cross tenants/users", async () => {
  const context = await resolveOrganizationContext(db, ali.id, alpha),
    a = await readTenantWorkspace(db, context);
  const b = await readTenantWorkspace(
    db,
    await resolveOrganizationContext(db, ali.id, beta),
  );
  assert.equal(
    JSON.parse(a.stores["growth-engine.system.v1"]!).processes.length,
    0,
  );
  assert.equal(
    JSON.parse(a.stores["growth-engine.strategy.v1"]!).objectives.length,
    0,
  );
  assert.equal(JSON.parse(a.stores["growth-engine.scale.v1"]!).ideas.length, 0);
  const stores = { ...a.stores };
  const draft = JSON.parse(stores[localStoreKeys[0]]!);
  draft.profile.industry = "Alpha-only evidence";
  stores[localStoreKeys[0]] = JSON.stringify(draft);
  await writeTenantWorkspace(db, context, { ...a, stores });
  assert.ok(!JSON.stringify(b.stores).includes("Alpha-only evidence"));
  await assert.rejects(
    writeTenantWorkspace(db, context, { ...a, stores }),
    errorCode("Conflict"),
  );
  await assert.rejects(
    writeTenantWorkspace(db, context, { ...a, organizationId: beta, stores }),
    errorCode("Forbidden"),
  );
  assert.equal(b.stores["growth-engine.agent.workspace.v1"], null);
});
let invite: { token: string; id: string };
test("7B O/P invitation creation stores only a hash, scopes role and supersedes pending invite", async () => {
  const ctx = await resolveOrganizationContext(db, ali.id, alpha);
  const old = await C.inviteMember(
    db,
    ctx,
    "sara@auth.example.invalid",
    "Manager",
  );
  invite = await C.inviteMember(
    db,
    ctx,
    "sara@auth.example.invalid",
    "Manager",
  );
  assert.equal(
    (
      await db.select().from(S.invitations).where(eq(S.invitations.id, old.id))
    )[0].status,
    "Revoked",
  );
  const [row] = await db
    .select()
    .from(S.invitations)
    .where(eq(S.invitations.id, invite.id));
  assert.notEqual(row.tokenHash, invite.token);
  assert.equal(row.tokenHash.length, 64);
  assert.ok(
    !JSON.stringify(await db.select().from(S.auditEvents)).includes(
      invite.token,
    ),
  );
});
test("7B Q invitation activates real second user and Manager role in one transaction", async () => {
  sara = await signup("sara@auth.example.invalid", "Sara", "127.0.0.4");
  const r = await call(sara, {
    operation: "acceptInvite",
    token: invite.token,
  });
  assert.equal(r.status, 200, await r.clone().text());
  const c = await activeContext(db, auth, headers(sara.cookie));
  assert.equal(c.context.organizationId, alpha);
  assert.deepEqual((await C.listOrganizations(db, sara.id))[0].roles, [
    "Manager",
  ]);
  assert.equal(
    (
      await db
        .select()
        .from(S.invitations)
        .where(eq(S.invitations.id, invite.id))
    )[0].status,
    "Accepted",
  );
  const workspace = await readTenantWorkspace(db, c.context);
  assert.ok(JSON.stringify(workspace.stores).includes("Alpha-only evidence"));
  assert.equal(workspace.stores["growth-engine.agent.workspace.v1"], null);
});
test("7B U accepted invitation cannot be reused and does not duplicate membership", async () => {
  await assert.rejects(
    C.acceptInvitation(db, sara.id, invite.token),
    errorCode("Conflict"),
  );
  assert.equal(
    (
      await db
        .select()
        .from(S.memberships)
        .where(
          and(
            eq(S.memberships.organizationId, alpha),
            eq(S.memberships.userId, sara.id),
          ),
        )
    ).length,
    1,
  );
});
test("7B V existing user accepts a second company with a different role", async () => {
  const ctx = await resolveOrganizationContext(db, ali.id, beta),
    invitation = await C.inviteMember(db, ctx, sara.email, "Consultant");
  await C.acceptInvitation(db, sara.id, invitation.token);
  assert.deepEqual(
    (await C.listOrganizations(db, sara.id)).map((o) => o.roles[0]).sort(),
    ["Consultant", "Manager"],
  );
});
test("7B R wrong-email account cannot claim another invitation", async () => {
  viewer = await signup("viewer@auth.example.invalid", "Viewer", "127.0.0.5");
  const invitation = await C.inviteMember(
    db,
    await resolveOrganizationContext(db, ali.id, beta),
    "someone@auth.example.invalid",
    "Viewer",
  );
  await assert.rejects(
    C.acceptInvitation(db, viewer.id, invitation.token),
    errorCode("Forbidden"),
  );
  assert.equal(
    (
      await db
        .select()
        .from(S.invitations)
        .where(eq(S.invitations.id, invitation.id))
    )[0].status,
    "Pending",
  );
});
test("7B S/T expired and revoked invitation tokens cannot activate a membership", async () => {
  const ctx = await resolveOrganizationContext(db, ali.id, beta),
    expired = await C.inviteMember(db, ctx, viewer.email, "Viewer");
  await db
    .update(S.invitations)
    .set({ expiresAt: new Date(0) })
    .where(eq(S.invitations.id, expired.id));
  await assert.rejects(
    C.acceptInvitation(db, viewer.id, expired.token),
    errorCode("Conflict"),
  );
  const revoked = await C.inviteMember(db, ctx, viewer.email, "Viewer");
  await C.revokeInvitation(db, ctx, revoked.id);
  await assert.rejects(
    C.acceptInvitation(db, viewer.id, revoked.token),
    errorCode("Conflict"),
  );
});
test("7B W final Owner demotion suspension and removal are denied without partial mutation", async () => {
  const ctx = await resolveOrganizationContext(db, ali.id, alpha),
    [m] = await db
      .select()
      .from(S.memberships)
      .where(eq(S.memberships.id, ctx.membershipId));
  for (const input of [
    { role: "Manager" },
    { status: "Suspended" },
    { status: "Removed" },
  ])
    await assert.rejects(
      C.changeMember(db, ctx, {
        membershipId: m.id,
        version: m.version,
        ...input,
      }),
      errorCode("Conflict"),
    );
  assert.equal(
    (await resolveOrganizationContext(db, ali.id, alpha)).membershipId,
    m.id,
  );
  assert.ok(
    (await C.listOrganizations(db, ali.id))
      .find((o) => o.id === alpha)
      ?.roles.includes("Owner"),
  );
});
test("7B membership role change suspend restore and remove retain records and reject stale versions", async () => {
  const owner = await resolveOrganizationContext(db, ali.id, alpha),
    s = await resolveOrganizationContext(db, sara.id, alpha),
    [m] = await db
      .select()
      .from(S.memberships)
      .where(eq(S.memberships.id, s.membershipId));
  const changed = await C.changeMember(db, owner, {
    membershipId: m.id,
    version: m.version,
    role: "Editor",
  });
  await assert.rejects(
    C.changeMember(db, owner, {
      membershipId: m.id,
      version: m.version,
      role: "Viewer",
    }),
    errorCode("Conflict"),
  );
  const suspended = await C.changeMember(db, owner, {
    membershipId: m.id,
    version: changed.version,
    status: "Suspended",
  });
  await assert.rejects(
    resolveOrganizationContext(db, sara.id, alpha),
    errorCode("Forbidden"),
  );
  assert.equal((await C.listOrganizations(db, sara.id)).length, 1);
  const restored = await C.changeMember(db, owner, {
    membershipId: m.id,
    version: suspended.version,
    status: "Active",
  });
  await resolveOrganizationContext(db, sara.id, alpha);
  await C.changeMember(db, owner, {
    membershipId: m.id,
    version: restored.version,
    status: "Removed",
  });
  await assert.rejects(
    resolveOrganizationContext(db, sara.id, alpha),
    errorCode("Forbidden"),
  );
  assert.ok(
    (await readTenantWorkspace(db, owner)).stores[localStoreKeys[0]]?.includes(
      "Alpha-only evidence",
    ),
  );
});
test("7B X/Y suspended/outsider contexts cannot access scoped API even with forged organization header", async () => {
  assert.equal(
    (await call(sara, { operation: "switch", organizationId: alpha })).status,
    403,
  );
  assert.equal((await call(viewer, undefined, beta, "workspace")).status, 409);
  assert.equal(
    (await call(viewer, { operation: "switch", organizationId: beta })).status,
    403,
  );
  assert.equal((await call(null)).status, 401);
  assert.equal((await call(ali, undefined, beta, "workspace")).status, 409);
});
test("7B Viewer sees company but cannot invite change roles or write a business draft", async () => {
  const invite = await C.inviteMember(
    db,
    await resolveOrganizationContext(db, ali.id, beta),
    viewer.email,
    "Viewer",
  );
  await C.acceptInvitation(db, viewer.id, invite.token);
  const c = await resolveOrganizationContext(db, viewer.id, beta),
    workspace = await readTenantWorkspace(db, c);
  await assert.rejects(
    C.inviteMember(db, c, "forged@auth.example.invalid", "Owner"),
    errorCode("Forbidden"),
  );
  const stores = { ...workspace.stores };
  const draft = JSON.parse(stores[localStoreKeys[0]]!);
  draft.profile.name = "Not allowed";
  stores[localStoreKeys[0]] = JSON.stringify(draft);
  await assert.rejects(
    writeTenantWorkspace(db, c, { ...workspace, stores }),
    errorCode("Forbidden"),
  );
});
test("7B malicious origin and client identity cannot authorize API mutations", async () => {
  const response = await api(
    new Request(baseURL + "/api/saas", {
      method: "POST",
      headers: {
        ...Object.fromEntries(headers(ali.cookie)),
        origin: "https://foreign.example",
      },
      body: JSON.stringify(company("Bad origin")),
    }),
  );
  assert.equal(response.status, 403);
  assert.equal(
    (
      await call(ali, {
        operation: "switch",
        organizationId: alpha,
        userId: viewer.id,
      })
    ).status,
    400,
  );
  const authResponse = await auth.handler(
    new Request(baseURL + "/api/auth/sign-out", {
      method: "POST",
      headers: {
        ...Object.fromEntries(headers(ali.cookie)),
        origin: "https://foreign.example",
      },
      body: "{}",
    }),
  );
  assert.equal(authResponse.status, 403);
});
test("7B AA BusinessRole is independent of login grants and name collisions do not link Person", async () => {
  const ctx = await resolveOrganizationContext(db, ali.id, beta),
    people = await db
      .select()
      .from(S.people)
      .where(eq(S.people.organizationId, beta));
  assert.equal(people.length, 0);
  const [person] = await db
    .insert(S.people)
    .values({
      organizationId: beta,
      name: "Ali",
      jobTitle: "Sales",
      status: "active",
    })
    .returning();
  assert.equal(person.userId, null);
  const [department] = await db
    .insert(S.departments)
    .values({ organizationId: beta, name: "Sales" })
    .returning();
  await db.insert(S.businessRoles).values({
    organizationId: beta,
    title: "Sales Director",
    departmentId: department.id,
    personId: person.id,
  });
  assert.deepEqual(
    (await C.listOrganizations(db, ali.id)).find((o) => o.id === beta)?.roles,
    ["Owner"],
  );
  assert.ok(ctx.permissions.includes("members.invite"));
});
test("7B F disabled and suspended User cannot create or use a session", async () => {
  for (const status of ["Disabled", "Suspended"]) {
    await db.update(S.users).set({ status }).where(eq(S.users.id, viewer.id));
    const r = await authRequest(
      "sign-in/email",
      { email: viewer.email, password: viewer.password },
      "",
      "127.0.0.6",
    );
    assert.equal(r.status, 401);
    await assert.rejects(
      authenticatedSession(db, auth, headers(viewer.cookie)),
      errorCode("Forbidden"),
    );
  }
  await db
    .update(S.users)
    .set({ status: "Active" })
    .where(eq(S.users.id, viewer.id));
});
test("7B profile edits use session user and validate timezone avatar URL and no email change", async () => {
  const r = await call(ali, {
    operation: "profile",
    name: "Ali Updated",
    locale: "fa-IR",
    timezone: "Asia/Tehran",
    avatarUrl: "",
  });
  assert.equal(r.status, 200);
  assert.equal(
    (await authenticatedSession(db, auth, headers(ali.cookie))).user.name,
    "Ali Updated",
  );
  assert.equal(
    (
      await call(ali, {
        operation: "profile",
        name: "Ali",
        locale: "fa-IR",
        timezone: "not-valid",
        avatarUrl: "",
      })
    ).status,
    400,
  );
});
test("7B password change requires current password revokes other sessions and updates hash", async () => {
  const other = await authRequest(
      "sign-in/email",
      { email: ali.email, password: ali.password },
      "",
      "127.0.0.7",
    ),
    otherCookie = cookieOf(other);
  const bad = await authRequest(
    "change-password",
    {
      currentPassword: "wrong",
      newPassword: "New-development-password-2026",
      revokeOtherSessions: true,
    },
    ali.cookie,
  );
  assert.equal(bad.status, 400);
  const r = await authRequest(
    "change-password",
    {
      currentPassword: ali.password,
      newPassword: "New-development-password-2026",
      revokeOtherSessions: true,
    },
    ali.cookie,
  );
  assert.equal(r.status, 200, await r.clone().text());
  await assert.rejects(
    authenticatedSession(db, auth, headers(otherCookie)),
    errorCode("Forbidden"),
  );
  const newSession = await authRequest(
    "sign-in/email",
    { email: ali.email, password: "New-development-password-2026" },
    "",
    "127.0.0.8",
  );
  assert.equal(newSession.status, 200);
});
test("7B H logout invalidates current session without deleting company records", async () => {
  const before = (await db.select().from(S.organizations)).length;
  const r = await authRequest("sign-out", {}, sara.cookie);
  assert.equal(r.status, 200);
  await assert.rejects(
    authenticatedSession(db, auth, headers(sara.cookie)),
    errorCode("Forbidden"),
  );
  assert.equal((await db.select().from(S.organizations)).length, before);
});
test("7B open redirects are constrained to internal locations", () => {
  for (const value of [
    "//foreign.example",
    "https://foreign.example",
    "/\\foreign",
    "/api/auth/sign-out",
    "/\nforeign",
    "/\t/foreign.example",
  ])
    assert.equal(safeReturn(value), "/");
  assert.equal(safeReturn("/strategy/key-results"), "/strategy/key-results");
  assert.equal(
    safeReturn("/login?returnTo=%2Finvite%2Ftest"),
    "/login?returnTo=%2Finvite%2Ftest",
  );
  assert.equal(safeReturn("/%2f%2fforeign.example"), "/");
});
test("7B clean company document validates against existing module parsers without samples", () => {
  const stores = emptyCompanyStores("New Company", "Services");
  const moduleVersions = Object.fromEntries(
    localStoreKeys.map((k) => [
      k,
      stores[k] ? (JSON.parse(stores[k]!).version ?? null) : null,
    ]),
  );
  assert.equal(
    validateLocalExport({
      schemaVersion: 1,
      source: "browser-local-v1",
      localWorkspaceId: "new",
      exportedAt: new Date().toISOString(),
      stores,
      moduleVersions,
    }).schemaVersion,
    1,
  );
});

test("7B credential rate protection rejects a ninth attempt from the same address", async () => {
  for (let attempt = 0; attempt < 8; attempt++) {
    const r = await authRequest(
      "sign-in/email",
      { email: ali.email, password: "Incorrect-password-2026" },
      "",
      "127.98.0.1",
    );
    assert.equal(r.status, 401);
  }
  const limited = await authRequest(
    "sign-in/email",
    { email: ali.email, password: "Incorrect-password-2026" },
    "",
    "127.98.0.1",
  );
  assert.equal(limited.status, 429);
  assert.ok((await db.select().from(S.authRateLimits)).length > 0);
});

test("7B HTTPS origin issues Secure HttpOnly SameSite cookies", async () => {
  const secureOrigin = "https://growth.example.invalid";
  const secureAuth = createAuth(db, {
    baseURL: secureOrigin,
    secret: "isolated-https-integration-secret-1234567890",
  });
  const r = await secureAuth.handler(
    new Request(secureOrigin + "/api/auth/sign-in/email", {
      method: "POST",
      headers: {
        origin: secureOrigin,
        "content-type": "application/json",
        "x-forwarded-for": "127.98.0.2",
      },
      body: JSON.stringify({
        email: ali.email,
        password: "New-development-password-2026",
      }),
    }),
  );
  assert.equal(r.status, 200);
  const cookie = r.headers.get("set-cookie") ?? "";
  assert.match(cookie, /; Secure/i);
  assert.match(cookie, /; HttpOnly/i);
  assert.match(cookie, /; SameSite=Lax/i);
  assert.throws(
    () =>
      createAuth(db, {
        baseURL: "http://public.example.invalid",
        secret: "isolated-test-secret-1234567890123456",
      }),
    /InvalidAuthOrigin/,
  );
});

test("7B closed company workspace cannot fall back to anonymous local data", async () => {
  const priorWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem() {
          throw Error("UnexpectedLegacyStorageAccess");
        },
      },
    },
  });
  const key = "growth-engine.system.v1";
  const storage = createWorkspaceStorage(
    {
      organizationId: alpha,
      sharedVersion: 1,
      privateVersion: 1,
      stores: { [key]: "company-only-data" },
    },
    () => {},
  );
  try {
    bindWorkspaceStorage(storage);
    assert.equal(businessStorage.getItem(key), "company-only-data");
    // Hydrating an identical value must not attempt a new server mutation.
    businessStorage.setItem(key, "company-only-data");
    await storage.flush();
    lockWorkspaceStorage();
    assert.equal(businessStorage.getItem(key), null);
    assert.equal(businessStorage.serverExecutionDisabled, true);
    assert.throws(
      () => businessStorage.setItem(key, "stale-user-edit"),
      /WorkspaceClosed/,
    );
  } finally {
    storage.dispose();
    bindWorkspaceStorage(null);
    if (priorWindow) Object.defineProperty(globalThis, "window", priorWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

test("Beta database failure blocks saves without accessing localStorage; explicit local mode still works", async () => {
  const names = ["window", "document", "fetch", "location"] as const;
  const descriptors = names.map(name => Object.getOwnPropertyDescriptor(globalThis, name));
  let localReads = 0, localWrites = 0;
  const notices: string[] = [];
  const key = "growth-engine.system.v1";
  const storage = createWorkspaceStorage({ organizationId: alpha, sharedVersion: 1, privateVersion: 1, stores: { [key]: "persisted-server-state" } }, status => notices.push(status));
  try {
    Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: { getItem() { localReads++; return "local-only"; }, setItem() { localWrites++; }, removeItem() { localWrites++; } } } });
    Object.defineProperty(globalThis, "document", { configurable: true, value: { documentElement: { dataset: { appMode: "saas" } } } });
    Object.defineProperty(globalThis, "location", { configurable: true, value: { origin: baseURL } });
    Object.defineProperty(globalThis, "fetch", { configurable: true, value: async () => new Response(JSON.stringify({ error: { code: "DatabaseUnavailable" } }), { status: 503 }) });
    bindWorkspaceStorage(storage);
    businessStorage.setItem(key, "temporary-page-edit");
    await assert.rejects(storage.flush!(), /WorkspaceSaveFailed/);
    assert.ok(notices.includes("error"));
    assert.throws(() => businessStorage.setItem(key, "second-edit"), /ذخیره متوقف/);
    bindWorkspaceStorage(null);
    assert.throws(() => businessStorage.getItem(key), /فضای شرکت آماده نیست/);
    assert.equal(localReads, 0); assert.equal(localWrites, 0);
    (globalThis as any).document.documentElement.dataset.appMode = "local";
    assert.equal(businessStorage.getItem(key), "local-only");
    businessStorage.setItem(key, "explicit-local-write");
    assert.equal(localReads, 1); assert.equal(localWrites, 1);
  } finally {
    storage.dispose(); bindWorkspaceStorage(null);
    names.forEach((name, index) => { if (descriptors[index]) Object.defineProperty(globalThis, name, descriptors[index]!); else Reflect.deleteProperty(globalThis, name); });
  }
});
