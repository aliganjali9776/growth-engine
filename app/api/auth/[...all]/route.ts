import { getSaaSRuntime, appMode } from "@/lib/server/saas-runtime";
import { authenticatedSession } from "@/lib/server/session";
import { authEvents } from "@/lib/server/db/schema";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handler(request: Request) {
  if (appMode() !== "saas")
    return Response.json({ error: "Disabled" }, { status: 404 });
  try {
    const endpoint = new URL(request.url).pathname.slice("/api/auth/".length);
    const path = endpoint.split("/").pop();
    if (
      ![
        "sign-up/email",
        "sign-in/email",
        "get-session",
        "sign-out",
        "change-password",
        "revoke-other-sessions",
      ].includes(endpoint)
    )
      return Response.json({ error: "NotAvailable" }, { status: 404 });
    const r = await getSaaSRuntime();
    let identity;
    if (
      ["get-session", "change-password", "revoke-other-sessions"].includes(
        path ?? "",
      )
    ) {
      try {
        identity = await authenticatedSession(r.db, r.auth, request.headers);
      } catch {
        return Response.json({ error: "Unauthenticated" }, { status: 401 });
      }
    }
    const response = await r.auth.handler(request);
    if (path === "change-password" && response.ok && identity)
      await r.db.insert(authEvents).values({
        userId: identity.user.id,
        action: "PasswordChanged",
        outcome: "Succeeded",
      });
    if (path === "email" && !response.ok)
      await r.db
        .insert(authEvents)
        .values({ action: "CredentialAttempt", outcome: "Rejected" });
    if (response.headers.get("content-type")?.includes("application/json")) {
      const body = await response.clone().json();
      if (body && typeof body === "object") {
        delete body.token;
        if (body.session) delete body.session.token;
      }
      const safeHeaders = new Headers(response.headers);
      safeHeaders.set("Cache-Control", "no-store");
      safeHeaders.set("Referrer-Policy", "no-referrer");
      return Response.json(body, {
        status: response.status,
        headers: safeHeaders,
      });
    }
    return response;
  } catch {
    return Response.json(
      { error: "AuthenticationUnavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
export const GET = handler;
export const POST = handler;
