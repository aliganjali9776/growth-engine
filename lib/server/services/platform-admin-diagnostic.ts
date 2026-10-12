import "server-only";
import type { Database } from "../db/types";
import { DataError } from "../db/errors";
import { platformAdminEnvPresent, requirePlatformAdmin } from "./platform-admin";

export async function diagnosePlatformAdmin(
  resolveSession: () => Promise<{ db: Database; user: { id: string; email: string } }>,
) {
  const diagnostic = {
    // This endpoint ships in the same build as the existing /admin route.
    routeExists: true,
    authenticated: false,
    sessionEmailPresent: false,
    platformAdminEnvPresent: platformAdminEnvPresent(),
    isPlatformAdmin: false,
  };
  let status = 200;
  try {
    const { db, user } = await resolveSession();
    diagnostic.authenticated = true;
    diagnostic.sessionEmailPresent = !!user.email?.trim();
    try {
      await requirePlatformAdmin(db, user.id);
      diagnostic.isPlatformAdmin = true;
    } catch (error) {
      if (!(error instanceof DataError && error.status === 403)) status = 503;
    }
  } catch (error) {
    if (!(error instanceof DataError && error.status === 401)) status = 503;
  }
  return { diagnostic, status };
}
