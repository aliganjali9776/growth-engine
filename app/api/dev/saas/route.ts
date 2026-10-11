import { getDatabase } from "@/lib/server/db/connection";
import { createDevHandlers } from "@/lib/server/dev-api";
import { appMode } from "@/lib/server/saas-runtime";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const handlers = createDevHandlers(getDatabase, {
  environment: process.env.NODE_ENV,
  enabled: appMode() === "local" && process.env.SAAS_DEV_API_ENABLED === "true",
  token: process.env.SAAS_DEV_TOKEN ?? "",
  actorUserId: process.env.SAAS_DEV_ACTOR_USER_ID ?? "",
});
export const GET = handlers.GET;
export const POST = handlers.POST;
