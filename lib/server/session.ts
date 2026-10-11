import "server-only";
import { eq } from "drizzle-orm";
import { DataError } from "./db/errors";
import { authSessions, users, userPreferences } from "./db/schema";
import { getSaaSRuntime } from "./saas-runtime";
import { resolveOrganizationContext } from "./context";
import type { Database } from "./db/types";
import type { SaaSAuth } from "./auth";
export async function authenticatedSession(
  db: Database,
  auth: SaaSAuth,
  headers: Headers,
) {
  const session = await auth.api.getSession({ headers });
  if (!session) throw new DataError("Forbidden", 401);
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id));
  if (user?.status !== "Active") throw new DataError("Forbidden", 401);
  const [record] = await db
    .select()
    .from(authSessions)
    .where(eq(authSessions.id, session.session.id));
  if (!record || record.expiresAt <= new Date())
    throw new DataError("Forbidden", 401);
  return { user, session: record };
}
export async function activeContext(
  db: Database,
  auth: SaaSAuth,
  headers: Headers,
) {
  const identity = await authenticatedSession(db, auth, headers);
  const id = identity.session.activeOrganizationId;
  if (!id) throw new DataError("NotFound", 409);
  const context = await resolveOrganizationContext(db, identity.user.id, id);
  return { ...identity, context };
}
export async function nextEntry(db: Database, userId: string) {
  const { listOrganizations } = await import("./services/companies");
  const orgs = await listOrganizations(db, userId);
  return orgs.length === 0
    ? "/onboarding/company"
    : orgs.length === 1
      ? "/organizations?enter=1"
      : "/organizations";
}
export async function sessionRuntime(headers: Headers) {
  const r = await getSaaSRuntime();
  return { ...r, ...(await authenticatedSession(r.db, r.auth, headers)) };
}
