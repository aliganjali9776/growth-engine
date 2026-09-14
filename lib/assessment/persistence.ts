import { questions } from "./questions";
import { isComplete } from "./scoring";
import type {
  AssessmentAnswer,
  AssessmentDraft,
  CompanyProfile,
  Screen,
} from "./types";
export const STORAGE_KEY = "growth-engine.assessment.v2";
export const profileOptions = {
  model: [
    "خدماتی",
    "آموزشی",
    "تولیدی",
    "واردات / بازرگانی",
    "صادرات",
    "فروشگاهی / Retail",
    "SaaS / نرم‌افزار",
    "سایر",
  ],
  teamSize: ["1–5", "6–15", "16–30", "31–50", "51–100", "100+"],
  revenue: [
    "کمتر از ۱۰۰ میلیون تومان",
    "۱۰۰ تا ۵۰۰ میلیون تومان",
    "۵۰۰ میلیون تا ۱ میلیارد تومان",
    "۱ تا ۵ میلیارد تومان",
    "بیش از ۵ میلیارد تومان",
    "ترجیح می‌دهم اعلام نکنم",
  ],
  stage: ["شروع", "تثبیت", "رشد", "توسعه", "مقیاس‌پذیری"],
};
export function emptyDraft(): AssessmentDraft {
  return {
    version: 2,
    profile: {
      name: "",
      industry: "",
      model: "",
      teamSize: "",
      revenue: "",
      stage: "",
    },
    answers: {},
    screen: "intro",
    questionIndex: 0,
    completedAt: null,
  };
}
export function validProfile(profile: CompanyProfile) {
  return (
    profile.name.trim().length > 0 &&
    profile.industry.trim().length > 0 &&
    (Object.keys(profileOptions) as (keyof typeof profileOptions)[]).every(
      (key) => profileOptions[key].includes(profile[key]),
    )
  );
}
export function parseDraft(raw: string): AssessmentDraft {
  const value = JSON.parse(raw);
  if (!value || value.version !== 2)
    throw new Error("Unsupported saved assessment");
  const draft = emptyDraft();
  for (const key of Object.keys(draft.profile) as (keyof CompanyProfile)[]) {
    if (typeof value.profile?.[key] === "string")
      draft.profile[key] = value.profile[key].slice(0, 150);
  }
  for (const q of questions) {
    const a = value.answers?.[q.id];
    if (Number.isInteger(a) && a >= 1 && a <= 5)
      draft.answers[q.id] = a as AssessmentAnswer;
  }
  const screens: Screen[] = [
    "intro",
    "profile",
    "section",
    "question",
    "results",
    "roadmap",
  ];
  if (screens.includes(value.screen)) draft.screen = value.screen;
  draft.questionIndex = Number.isInteger(value.questionIndex)
    ? Math.max(0, Math.min(29, value.questionIndex))
    : 0;
  draft.completedAt =
    typeof value.completedAt === "string" &&
    !Number.isNaN(Date.parse(value.completedAt))
      ? value.completedAt
      : null;
  if (
    !validProfile(draft.profile) &&
    !["intro", "profile"].includes(draft.screen)
  )
    draft.screen = "profile";
  if (
    ["results", "roadmap"].includes(draft.screen) &&
    !isComplete(draft.answers)
  ) {
    draft.screen = validProfile(draft.profile) ? "question" : "profile";
    draft.questionIndex = questions.findIndex((q) => !draft.answers[q.id]);
    draft.completedAt = null;
  }
  return draft;
}
