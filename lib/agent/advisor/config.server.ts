import { MockAgentModelProvider } from "./providers/mock";
import { OpenAIAgentModelProvider } from "./providers/openai.server";
import { AdvisorError } from "./types";
import { AGENT_PROMPT_VERSION } from "./prompt";
let providerFailed = false;
export function recordProviderHealth(failed: boolean) { providerFailed = failed; }
function configuredProvider(env: NodeJS.ProcessEnv) {
  return env.AGENT_MODEL_PROVIDER ?? (env.OPENAI_API_KEY?.trim() ? "openai" : "none");
}
function configuredModel(env: NodeJS.ProcessEnv) {
  const model = env.OPENAI_MODEL?.trim() || "gpt-6-luna";
  return /^[a-zA-Z0-9._:-]{1,100}$/.test(model) ? model : "invalid-model";
}
export function providerStatus(env: NodeJS.ProcessEnv = process.env) {
  const provider = configuredProvider(env),
    key = !!env.OPENAI_API_KEY?.trim();
  return {
    provider:
      provider === "openai" ? "openai" : provider === "mock" ? "mock" : "none",
    model:
      provider === "openai"
        ? configuredModel(env)
        : provider === "mock"
          ? "deterministic-advisor-v1"
          : null,
    connected: provider === "mock" || (provider === "openai" && key),
    status: !key && provider !== "mock" ? "missing_key" : providerFailed ? "provider_error" : "configured",
    promptVersion: AGENT_PROMPT_VERSION,
    demoAllowed: env.AGENT_ALLOW_MOCK_DEMO === "true",
    message:
      provider === "openai" && !key
        ? "مدل هوش مصنوعی متصل نیست."
        : provider === "mock"
          ? "حالت آزمایشی؛ مدل زبانی واقعی متصل نیست."
          : provider !== "openai"
            ? "مدل هوش مصنوعی متصل نیست."
            : "اتصال سمت سرور پیکربندی شده است؛ دسترسی سرویس هنگام درخواست بررسی می‌شود.",
  };
}
export function createProvider(
  demo = false,
  env: NodeJS.ProcessEnv = process.env,
) {
  if (typeof window !== "undefined") throw Error("Server-only provider");
  if (demo) {
    if (env.AGENT_ALLOW_MOCK_DEMO !== "true")
      throw new AdvisorError(
        "NoProvider",
        "حالت آزمایشی در این محیط فعال نیست.",
        503,
      );
    return new MockAgentModelProvider();
  }
  if (configuredProvider(env) === "mock") return new MockAgentModelProvider();
  if (configuredProvider(env) === "openai")
    return new OpenAIAgentModelProvider(
      env.OPENAI_API_KEY ?? "",
      configuredModel(env),
    );
  return null;
}
