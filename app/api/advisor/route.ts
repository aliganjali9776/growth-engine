import { NextResponse } from "next/server";
import { appMode, getSaaSRuntime } from "@/lib/server/saas-runtime";
import { activeContext } from "@/lib/server/session";
import { reauthorize } from "@/lib/server/context";
import { safeDataError } from "@/lib/server/db/errors";
import {
  createProvider,
  providerStatus,
  recordProviderHealth,
} from "@/lib/agent/advisor/config.server";
import { analyzeAdvisor } from "@/lib/agent/advisor/service";
import { validateRequest } from "@/lib/agent/advisor/validation";
import { AdvisorError } from "@/lib/agent/advisor/types";
import { ADVISOR_LIMITS } from "@/lib/agent/advisor/prompt";
import { buildAdvisorContext } from "@/lib/agent/advisor/context";
import { readTenantWorkspace } from "@/lib/server/services/workspace";
import {
  isMutationQuestion,
  isExternalQuestion,
} from "@/lib/agent/advisor/policy";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const requests: number[] = [];
async function authorizeAdvisor(
  request: Request,
  permission: "agent.view" | "agent.ask",
) {
  if (appMode() !== "saas") return null;
  try {
    const r = await getSaaSRuntime();
    const { context } = await activeContext(r.db, r.auth, request.headers);
    await reauthorize(r.db, context, permission);
    return null;
  } catch (error) {
    const safe = safeDataError(error);
    return NextResponse.json(
      {
        error: {
          code: safe.code,
          message: "شما برای انجام این عملیات دسترسی لازم را ندارید.",
        },
      },
      { status: safe.status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
export async function GET(request: Request) {
  const denied = await authorizeAdvisor(request, "agent.view");
  if (denied) return denied;
  return NextResponse.json(providerStatus(), {
    headers: { "Cache-Control": "no-store" },
  });
}
export async function POST(request: Request) {
  const denied = await authorizeAdvisor(request, "agent.ask");
  if (denied) return denied;
  let modelCalled = false;
  try {
    const url = new URL(request.url),
      origin = request.headers.get("origin"),
      host = request.headers.get("host");
    let source: URL | null = null;
    try {
      source = origin ? new URL(origin) : null;
    } catch {
      /* invalid origin is rejected below */
    }
    if (
      !source ||
      source.origin !== origin ||
      source.host !== host ||
      source.protocol !== url.protocol ||
      request.headers.get("x-advisor-client") !== "advisor-v1"
    )
      throw new AdvisorError(
        "InvalidContext",
        "درخواست از مبدأ مجاز ارسال نشده است.",
        403,
      );
    if (!request.headers.get("content-type")?.startsWith("application/json"))
      throw new AdvisorError("InvalidContext", "نوع درخواست معتبر نیست.");
    const now = Date.now();
    while (requests.length && requests[0] < now - 60000) requests.shift();
    if (requests.length >= 12)
      throw new AdvisorError(
        "RateLimit",
        "تعداد درخواست‌ها زیاد است؛ یک دقیقه بعد دوباره تلاش کنید.",
        429,
      );
    const reader = request.body?.getReader();
    if (!reader) throw new AdvisorError("InvalidContext", "درخواست خالی است.");
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        bytes += next.value.length;
        if (bytes > ADVISOR_LIMITS.requestBytes) {
          await reader.cancel();
          throw new AdvisorError(
            "InvalidContext",
            "حجم زمینه بیشتر از حد مجاز است.",
            413,
          );
        }
        chunks.push(next.value);
      }
    } finally {
      reader.releaseLock();
    }
    const body = Buffer.concat(chunks).toString("utf8");
    let input: unknown;
    try {
      input = JSON.parse(body);
    } catch {
      throw new AdvisorError("InvalidContext", "ساختار درخواست معتبر نیست.");
    }
    let valid = validateRequest(input);
    if (appMode() === "saas") {
      // Business evidence is rebuilt from the authorized tenant, never the browser.
      const r = await getSaaSRuntime();
      const { context } = await activeContext(r.db, r.auth, request.headers);
      await reauthorize(r.db, context, "agent.ask");
      const workspace = await readTenantWorkspace(r.db, context);
      const curated = buildAdvisorContext({ getItem: key => workspace.stores[key] ?? null }, valid.question, valid.selection, [], undefined, true);
      valid = validateRequest({ ...valid, selection: curated.selection, packet: curated.packet, capabilityIds: curated.capabilityIds, history: [] });
    }
    if (process.env.NODE_ENV === "development") {
      console.info("[advisor] bounded request", {
        bytes,
        questionCharacters: valid.question.length,
        evidenceCount: valid.packet.evidence.length,
      });
    }
    requests.push(now);
    const provider =
      isMutationQuestion(valid.question) || isExternalQuestion(valid.question)
        ? null
        : createProvider(valid.demo);
    if (provider) {
      const analyze = provider.analyze.bind(provider);
      provider.analyze = (input, signal) => {
        modelCalled = true;
        return analyze(input, signal);
      };
    }
    const response = await analyzeAdvisor(valid, provider, request.signal);
    if (modelCalled) recordProviderHealth(false);
    return NextResponse.json(
      { response },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (modelCalled && !(error instanceof AdvisorError && error.code === "Cancelled")) recordProviderHealth(true);
    const safe =
      error instanceof AdvisorError
        ? error
        : new AdvisorError(
            "ProviderError",
            "تحلیل در حال حاضر ممکن نیست؛ دوباره تلاش کنید.",
            502,
          );
    return NextResponse.json(
      { error: { code: safe.code, message: safe.message, modelCalled } },
      { status: safe.status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
