import type { AdvisorProvider, AdvisorRequest } from "../types";
import { AdvisorError } from "../types";
import type {
  AgentContextPacket,
  AgentObservation,
  AgentRecommendation,
  AgentProposedAction,
} from "../../types";
import {
  ADVISOR_LIMITS,
  ADVISOR_OUTPUT_SCHEMA,
  buildModelPayload,
} from "../prompt";
import { isObject } from "../validation";
export class OpenAIAgentModelProvider implements AdvisorProvider {
  readonly name = "openai";
  constructor(
    private apiKey: string,
    readonly model = "gpt-6-luna",
    private transport: typeof fetch = fetch,
    private timeoutMs = ADVISOR_LIMITS.timeoutMs,
  ) {
    if (typeof window !== "undefined") throw new Error("Server-only provider");
    if (!apiKey.trim())
      throw new AdvisorError("MissingKey", "مدل هوش مصنوعی متصل نیست.", 503);
    if (!/^[a-zA-Z0-9._:-]{1,100}$/.test(model))
      throw new AdvisorError("ProviderError", "تنظیم مدل معتبر نیست.", 503);
  }
  async generateObservations(
    _: AgentContextPacket,
  ): Promise<AgentObservation[]> {
    throw new AdvisorError(
      "ReadOnly",
      "از مسیر تحلیل معتبر مشاور استفاده کنید.",
    );
  }
  async generateRecommendations(
    _: AgentContextPacket,
  ): Promise<AgentRecommendation[]> {
    throw new AdvisorError(
      "ReadOnly",
      "از مسیر تحلیل معتبر مشاور استفاده کنید.",
    );
  }
  async prepareAction(_: AgentContextPacket): Promise<AgentProposedAction> {
    throw new AdvisorError("ReadOnly", "تهیه اقدام در مشاور مجاز نیست.");
  }
  async analyze(
    request: AdvisorRequest,
    signal?: AbortSignal,
  ): Promise<unknown> {
    const controller = new AbortController(),
      abort = () => controller.abort();
    if (signal?.aborted)
      throw new AdvisorError("Cancelled", "درخواست متوقف شد.", 499);
    signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const payload = buildModelPayload(request);
      const response = await this.transport(
        "https://api.openai.com/v1/responses",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + this.apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: this.model,
            ...payload,
            store: false,
            max_output_tokens: ADVISOR_LIMITS.outputTokens,
            ...(/^gpt-6/.test(this.model) ? { reasoning: { effort: "none" } } : {}),
            ...(/^gpt-4o/.test(this.model) ? { temperature: 0.2 } : {}),
            text: {
              format: {
                type: "json_schema",
                name: "growth_advisor",
                strict: true,
                schema: ADVISOR_OUTPUT_SCHEMA,
              },
            },
          }),
          signal: controller.signal,
        },
      );
      if (response.status === 429)
        throw new AdvisorError(
          "RateLimit",
          "سرویس مدل به محدودیت درخواست رسیده است؛ کمی بعد تلاش کنید.",
          429,
        );
      if (!response.ok)
        throw new AdvisorError(
          "ProviderError",
          "سرویس مدل در حال حاضر پاسخ قابل استفاده نمی‌دهد.",
          502,
        );
      const raw = await response.text();
      if (raw.length > 200000)
        throw new AdvisorError(
          "InvalidResponse",
          "پاسخ Agent قابل اعتبارسنجی نبود. دوباره تلاش کنید.",
          502,
        );
      let data: unknown;
      try {
        data = JSON.parse(raw);
      } catch {
        throw new AdvisorError(
          "InvalidResponse",
          "پاسخ Agent قابل اعتبارسنجی نبود. دوباره تلاش کنید.",
          502,
        );
      }
      if (
        !isObject(data) ||
        (data.status && data.status !== "completed") ||
        !Array.isArray(data.output)
      )
        throw new AdvisorError(
          "InvalidResponse",
          "پاسخ Agent قابل اعتبارسنجی نبود. دوباره تلاش کنید.",
          502,
        );
      const messages = data.output
          .filter(isObject)
          .filter((x) => x.type === "message"),
        texts = messages.flatMap((m) =>
          Array.isArray(m.content)
            ? m.content
                .filter(isObject)
                .filter(
                  (x) => x.type === "output_text" && typeof x.text === "string",
                )
                .map((x) => x.text as string)
            : [],
        );
      if (texts.length !== 1)
        throw new AdvisorError(
          "InvalidResponse",
          "پاسخ Agent قابل اعتبارسنجی نبود. دوباره تلاش کنید.",
          502,
        );
      try {
        return JSON.parse(texts[0]);
      } catch {
        throw new AdvisorError(
          "InvalidResponse",
          "پاسخ Agent قابل اعتبارسنجی نبود. دوباره تلاش کنید.",
          502,
        );
      }
    } catch (error) {
      if (error instanceof AdvisorError) throw error;
      if (controller.signal.aborted)
        throw new AdvisorError(
          signal?.aborted ? "Cancelled" : "Timeout",
          signal?.aborted
            ? "درخواست متوقف شد."
            : "پاسخ مدل بیش از زمان مجاز طول کشید؛ دوباره تلاش کنید.",
          signal?.aborted ? 499 : 504,
        );
      throw new AdvisorError(
        "NetworkError",
        "ارتباط با سرویس مدل برقرار نشد؛ دوباره تلاش کنید.",
        502,
      );
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    }
  }
}
