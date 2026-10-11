import { defaultPermissions, findCapability } from "../capabilities";
import type { AgentPermission } from "../types";
import type { AdvisorIntent, AdvisorSelection, AdvisorHistory } from "./types";
export const READ_ONLY_MESSAGE =
  "در این نسخه، Agent فقط امکان تحلیل و پیشنهاد دارد و تغییری در داده‌ها اعمال نمی‌کند.";
export const advisorPermissions: readonly AgentPermission[] = Object.freeze(
  defaultPermissions
    .filter((p) => ["Observe", "Recommend"].includes(p.authority))
    .map((p) => Object.freeze({ ...p })),
);
export const advisorReadAllowed = (id: string) => {
  const c = findCapability(id);
  return (
    !!c &&
    c.enabled &&
    c.authorityLevel === "Observe" &&
    advisorPermissions.some((p) => p.capabilityId === id && p.allowed)
  );
};
export function normalize(text: string) {
  return text
    .normalize("NFKC")
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/‌/g, " ")
    .toLowerCase()
    .trim();
}
export function isMutationQuestion(question: string) {
  const q = normalize(question);
  return (
    /\b(delete|remove|update|create|execute|cancel|approve|set|archive)\b.{0,90}\b(kr|objective|experiment|sop|target|cycle|process|constraint|all)\b/i.test(
      q,
    ) ||
    /(?:^|\s)(حذف|تغییر|بساز|ایجاد|لغو|توقف|تأیید|تایید|آرشیو|اجرا)(?=\s|$).{0,90}(بده|کن|شود|همه|هدف|نتیجه کلیدی|آزمایش|فرآیند|گلوگاه)/.test(
      q,
    ) ||
    /(هدف|نتیجه کلیدی|آزمایش|فرآیند|گلوگاه).{0,90}(تغییر بده|حذف کن|بساز|لغو کن|متوقف کن|اجرا کن)/.test(
      q,
    )
  );
}
export const isExternalQuestion = (q: string) =>
  /bitcoin|بیت\s?کوین|weather|آب و هوا|قیمت دلار|اخبار امروز|write.*code|کد.*بنویس|recipe|دستور آشپزی/i.test(
    q,
  );
export const isFollowUp = (q: string) =>
  /^(چرا|چطور|توضیح بیشتر|بیشتر توضیح|why|how|ادامه)[؟?!.\s]*$/i.test(
    normalize(q),
  );
export function classifyIntent(
  question: string,
  selection: AdvisorSelection,
  history: AdvisorHistory[] = [],
): AdvisorIntent {
  const effective = isFollowUp(question)
      ? (history.filter((m) => m.role === "user").at(-1)?.content ?? question)
      : question,
    q = normalize(effective);
  if (/کمبود|داده.*کم|اطلاعات.*کم|داده.*ندار|cac|هزینه جذب/.test(q))
    return "DataGapQuestion";
  if (/بین|مقایسه|تناقض|system.*strategy|سیستم.*استراتژی/.test(q))
    return "Comparison";
  if (/ریسک|نگران|خطر/.test(q)) return "RiskAnalysis";
  if (/تمرکز|اولویت|اول.*اصلاح|اول.*انجام|این هفته/.test(q))
    return "PriorityQuestion";
  if (selection.type !== "executive") return "EntityExplanation";
  if (/فرآیند|سیستم|system|عملیات|بنیان گذار/.test(q)) return "SystemDiagnosis";
  if (/استراتژی|strategy|\bkr\b|نتیجه کلیدی|هدف/.test(q))
    return "StrategyDiagnosis";
  if (/scale|اسکیل|رشد|گلوگاه|آزمایش|experiment|قیف|فروش|closing/.test(q))
    return "ScaleDiagnosis";
  if (/مهم ترین|مسئله|خلاصه|وضعیت|کسب وکار|کسب و کار/.test(q))
    return "ExecutiveSummary";
  return "GeneralBusinessQuestion";
}
export function routeSelection(
  question: string,
  requested: AdvisorSelection,
  history: AdvisorHistory[] = [],
): AdvisorSelection {
  if (requested.type !== "executive") return requested;
  const q = normalize(
    isFollowUp(question)
      ? (history.filter((x) => x.role === "user").at(-1)?.content ?? question)
      : question,
  );
  if (/\bkr\b|نتیجه کلیدی/.test(q)) return { type: "kr" };
  if (/آزمایش|experiment/.test(q)) return { type: "experiment" };
  if (/فرآیند|process/.test(q)) return { type: "process" };
  if (/گلوگاه|constraint/.test(q)) return { type: "constraint" };
  return requested;
}
