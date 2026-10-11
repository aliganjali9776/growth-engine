import "server-only";
import { betterAuth } from "better-auth/minimal";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { APIError } from "better-auth/api";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Database } from "./db/types";
import * as S from "./db/schema";
export function createAuth(
  db: Database,
  config: { baseURL: string; secret: string; secureCookies?: boolean },
) {
  if (config.secret.length < 32) throw Error("AuthSecretMissing");
  const origin = new URL(config.baseURL);
  if (
    origin.origin !== config.baseURL ||
    !["https:", "http:"].includes(origin.protocol) ||
    (origin.protocol === "http:" &&
      !["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname))
  )
    throw Error("InvalidAuthOrigin");
  return betterAuth({
    appName: "Growth Engine",
    baseURL: config.baseURL,
    secret: config.secret,
    trustedOrigins: [config.baseURL],
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: S.users,
        session: S.authSessions,
        account: S.authAccounts,
        verification: S.authVerifications,
        rateLimit: S.authRateLimits,
      },
      transaction: true,
    }),
    user: {
      fields: { image: "avatarUrl" },
      additionalFields: {
        status: { type: "string", defaultValue: "Active", input: false },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: false },
      additionalFields: {
        activeOrganizationId: { type: "string", required: false, input: false },
      },
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
    },
    account: { accountLinking: { enabled: false } },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 60,
      customRules: {
        "/sign-in/email": { window: 60, max: 8 },
        "/sign-up/email": { window: 60, max: 5 },
      },
    },
    advanced: {
      database: { generateId: () => randomUUID() },
      useSecureCookies:
        config.secureCookies ?? config.baseURL.startsWith("https:"),
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax" },
    },
    logger: { disabled: true },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => ({
            data: {
              ...user,
              email: user.email.trim().toLowerCase(),
              name: user.name.trim().slice(0, 160),
            },
          }),
          after: async (user) => {
            await db.insert(S.authEvents).values({
              userId: user.id,
              action: "AccountCreated",
              outcome: "Succeeded",
            });
          },
        },
      },
      session: {
        create: {
          before: async (session, context) => {
            // The transaction-scoped adapter can see the new signup user.
            const user = await context?.context.internalAdapter.findUserById(
              session.userId,
            );
            if ((user as { status?: string } | null)?.status !== "Active")
              throw new APIError("UNAUTHORIZED", {
                message: "Invalid credentials",
              });
            return { data: session };
          },
          after: async (session) => {
            await db
              .update(S.users)
              .set({ lastLoginAt: new Date() })
              .where(eq(S.users.id, session.userId));
            const [preference] = await db
              .select()
              .from(S.userPreferences)
              .where(eq(S.userPreferences.userId, session.userId));
            if (preference?.lastOrganizationId) {
              try {
                const { resolveOrganizationContext } =
                  await import("./context");
                await resolveOrganizationContext(
                  db,
                  session.userId,
                  preference.lastOrganizationId,
                );
                await db
                  .update(S.authSessions)
                  .set({ activeOrganizationId: preference.lastOrganizationId })
                  .where(eq(S.authSessions.id, session.id));
              } catch {
                /* A stale preference grants no access. */
              }
            }
          },
        },
      },
    },
  });
}
export type SaaSAuth = ReturnType<typeof createAuth>;
