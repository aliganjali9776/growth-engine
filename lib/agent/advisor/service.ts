import {
  AdvisorError,
  type AdvisorRequest,
  type AdvisorProvider,
  type AgentAdvisorResponse,
} from "./types";
import { validateRequest, validateModelOutput, isObject } from "./validation";
import {
  READ_ONLY_MESSAGE,
  isMutationQuestion,
  isExternalQuestion,
} from "./policy";
import { emptyOutput } from "./prompt";
import { missingMetricMessage } from "./metrics";
export async function analyzeAdvisor(
  input: unknown,
  provider: AdvisorProvider | null,
  signal?: AbortSignal,
): Promise<AgentAdvisorResponse> {
  const request = validateRequest(input);
  if (isMutationQuestion(request.question)) {
    const out = emptyOutput(READ_ONLY_MESSAGE);
    out.warnings = [READ_ONLY_MESSAGE];
    return validateModelOutput(
      out,
      request,
      "policy",
      "read-only",
      undefined,
      false,
    );
  }
  if (isExternalQuestion(request.question)) {
    const out = emptyOutput(
      "اطلاعات بیرونی و جاری برای این پرسش در زمینه مشاور وجود ندارد. این مشاور فقط داده‌های داخلی کسب‌وکار را تحلیل می‌کند.",
    );
    out.dataGaps = [
      "برای این موضوع، شواهد داخلی مناسب وجود ندارد؛ جست‌وجوی وب در این نسخه فعال نیست.",
    ];
    return validateModelOutput(
      out,
      request,
      "policy",
      "scope-check",
      undefined,
      false,
    );
  }
  if (/cac|هزینه جذب مشتری/i.test(request.question)) {
    const measured = request.packet.evidence.filter(
      (e) =>
        isObject(e.value) &&
        typeof e.value.cac === "number" &&
        Number.isFinite(e.value.cac),
    );
    if (!measured.length) {
      const out = emptyOutput(
        "CAC در شواهد منتخب موجود نیست؛ داده کافی برای اعلام هزینه جذب مشتری وجود ندارد.",
      );
      out.dataGaps = [
        "برای محاسبه هزینه جذب مشتری، هزینه جذب و تعداد مشتریان منتسب به همان دوره و کانال باید اندازه‌گیری شوند؛ هدف درآمد جایگزین این داده نیست.",
      ];
      out.evidenceRefs = request.packet.evidence
        .filter((e) => e.sourceSelector?.includes("Channel"))
        .slice(0, 2)
        .map((e) => e.id);
      return validateModelOutput(
        out,
        request,
        "policy",
        "data-gap",
        undefined,
        false,
      );
    }
  }
  const gap = missingMetricMessage(request.question, request.packet.evidence);
  if (gap) {
    const out = emptyOutput(gap);
    out.dataGaps = [gap];
    return validateModelOutput(
      out,
      request,
      "policy",
      "data-gap",
      undefined,
      false,
    );
  }
  if (!provider)
    throw new AdvisorError("NoProvider", "مدل هوش مصنوعی متصل نیست.", 503);
  const output = await provider.analyze(request, signal);
  return validateModelOutput(output, request, provider.name, provider.model);
}
