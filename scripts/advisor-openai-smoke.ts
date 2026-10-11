import { loadEnvConfig } from "@next/env";
import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { localEnvelope } from "../lib/persistence/business-export";
import { buildAdvisorContext } from "../lib/agent/advisor/context";
import { providerStatus } from "../lib/agent/advisor/config.server";
import { OpenAIAgentModelProvider } from "../lib/agent/advisor/providers/openai.server";
import { analyzeAdvisor } from "../lib/agent/advisor/service";
async function main() {
  loadEnvConfig(process.cwd());
  const status = providerStatus();
  if (!process.env.OPENAI_API_KEY?.trim()) { console.log(JSON.stringify({ status: "missing_key", model: status.model })); return; }
  const fixture = JSON.parse(await readFile(".build7d-synthetic-backup.json", "utf8"));
  const stores = localEnvelope(fixture).stores;
  const question = "الان مهم‌ترین مسئله این کسب‌وکار چیست و بر اساس چه شواهدی؟";
  const c = buildAdvisorContext({ getItem: key => stores[key as keyof typeof stores] ?? null }, question, { type: "executive" });
  const diagnostics: Record<string, unknown> = { model: status.model, evidenceCount: c.packet.evidence.length };
  const transport: typeof fetch = async (url, options) => {
    const response = await fetch(url, options);
    diagnostics.httpStatus = response.status;
    const data = await response.clone().json().catch(() => ({})) as any;
    diagnostics.responseStatus = data.status ?? null;
    diagnostics.incompleteReason = data.incomplete_details?.reason ?? null;
    diagnostics.usage = data.usage ? { inputTokens: data.usage.input_tokens, outputTokens: data.usage.output_tokens } : null;
    // Never persist provider body, headers, messages, credentials or request content.
    return response;
  };
  try {
    const provider = new OpenAIAgentModelProvider(process.env.OPENAI_API_KEY, status.model!, transport);
    const response = await analyzeAdvisor({ requestId: randomUUID(), question, selection: c.selection, packet: c.packet, capabilityIds: c.capabilityIds, history: [], mode: "answer", demo: false }, provider);
    diagnostics.schemaValidated = response.schemaValidated;
    diagnostics.evidenceValidated = response.evidenceRefs.every(e => c.packet.evidence.some(source => source.id === e.id));
    diagnostics.validatedEvidenceCount = response.evidenceRefs.length;
    diagnostics.result = "passed";
  } catch (error) {
    diagnostics.result = "failed";
    diagnostics.errorCode = (error as { code?: string }).code ?? "ProviderError";
    diagnostics.validationLocations = (error as Error).stack?.match(/validation\.ts:\d+:\d+/g) ?? [];
  }
  await writeFile("docs/qa/advisor-openai-smoke.json", JSON.stringify(diagnostics, null, 2));
  console.log(JSON.stringify(diagnostics));
}
main().catch(() => { console.error("SmokeTestUnavailable"); process.exitCode = 1; });
