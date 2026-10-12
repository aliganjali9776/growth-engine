import { sessionRuntime } from "@/lib/server/session";
import { diagnosePlatformAdmin } from "@/lib/server/services/platform-admin-diagnostic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Temporary investigation endpoint. Never return identities, allowlists or errors.
export async function GET(request: Request) {
  const { diagnostic, status } = await diagnosePlatformAdmin(() => sessionRuntime(request.headers));
  return Response.json(diagnostic, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "Vary": "Cookie",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
