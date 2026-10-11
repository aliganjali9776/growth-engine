import type { AdvisorProvider, AdvisorRequest } from "../types";
import { AdvisorError } from "../types";
import type {
  AgentContextPacket,
  AgentObservation,
  AgentRecommendation,
  AgentProposedAction,
} from "../../types";
import { emptyOutput } from "../prompt";
import { classifyIntent } from "../policy";
import { hasUnknown } from "../validation";
const labels: Record<string, string> = {
  status: "وضعیت",
  health: "سلامت",
  independence: "استقلال",
  founderDependency: "وابستگی به بنیان‌گذار",
  target: "هدف",
  current: "مقدار فعلی",
  weight: "وزن",
  result: "نتیجه",
  baseline: "خط مبنا",
  minimumSuccess: "حداقل موفقیت",
  standardization: "استانداردسازی",
  adoption: "اجرای استاندارد",
  kpi: "شاخص عملکرد",
  ownershipReliable: "مالک معتبر",
  severity: "شدت",
  confidence: "اطمینان ثبت‌شده",
  primary: "گلوگاه اصلی",
  progress: "پیشرفت",
  volume: "حجم",
  conversion: "نرخ تبدیل",
  targetConversion: "هدف تبدیل",
  maturity: "بلوغ شواهد",
  qualified: "لید واجد شرایط",
  customers: "مشتری",
  cac: "هزینه جذب مشتری",
  spendPerCustomer: "هزینه ثبت‌شده به‌ازای مشتری",
};
const values: Record<string, string> = {
  active: "فعال",
  high: "زیاد",
  critical: "بحرانی",
  medium: "متوسط",
  low: "کم",
  unknown: "نامشخص",
  atRisk: "در معرض ریسک",
  offTrack: "خارج از مسیر",
  onTrack: "در مسیر",
  achieved: "محقق‌شده",
  partial: "موفقیت نسبی",
  win: "موفق",
  completed: "تکمیل‌شده",
  early: "شواهد اولیه",
  strong: "قوی",
  draft: "پیش‌نویس",
  candidate: "نامزد",
  true: "بله",
  false: "خیر",
};
function fact(value: unknown): string {
  if (value === null || value === undefined) return "داده ثبت نشده";
  if (typeof value !== "object") return values[String(value)] ?? String(value);
  if (Array.isArray(value)) return "رکوردهای مرتبط برای بازبینی موجود است.";
  const fields = Object.entries(value)
    .filter(([k]) => labels[k])
    .slice(0, 6);
  return fields.length
    ? fields.map(([k, v]) => labels[k] + ": " + fact(v)).join("؛ ")
    : "شواهد ثبت‌شده در منبع قابل بازبینی است.";
}
export class MockAgentModelProvider implements AdvisorProvider {
  readonly name = "mock";
  readonly model = "deterministic-advisor-v1";
  async generateObservations(
    _: AgentContextPacket,
  ): Promise<AgentObservation[]> {
    return [];
  }
  async generateRecommendations(
    _: AgentContextPacket,
  ): Promise<AgentRecommendation[]> {
    return [];
  }
  async prepareAction(_: AgentContextPacket): Promise<AgentProposedAction> {
    throw new AdvisorError(
      "ReadOnly",
      "نوشتن و تهیه اقدام در مشاور مجاز نیست.",
    );
  }
  async analyze(request: AdvisorRequest): Promise<unknown> {
    const ev = request.packet.evidence,
      priority = ev.filter((e) =>
        ["Capacity", "Constraint", "Risk", "Process", "Status"].includes(
          e.evidenceType,
        ),
      ),
      ordered = [...priority, ...ev.filter((e) => !priority.includes(e))].sort(
        (a, b) =>
          Number(/"founderDependency":"(?:high|critical)"/.test(b.summary)) -
          Number(/"founderDependency":"(?:high|critical)"/.test(a.summary)),
      );
    // Keep cited facts from all relevant modules when linked context exists.
    const chosen: typeof ev = [];
    for (const domain of ["Strategy", "Scale", "System"]) {
      const found = ordered.find((e) => e.domain === domain);
      if (found) chosen.push(found);
    }
    for (const e of ordered)
      if (chosen.length < 4 && !chosen.includes(e)) chosen.push(e);
    const output = emptyOutput(
      chosen.length
        ? "شواهد منتخب را کنار هم بررسی کنید؛ سلامت ثبت‌شده به‌تنهایی آمادگی رشد را تأیید نمی‌کند."
        : "داده کافی برای این نتیجه وجود ندارد.",
    );
    output.summary =
      "تحلیل آزمایشی بر اساس داده‌های فعلی؛ این پاسخ از مدل زبانی واقعی نیست.";
    output.observations = chosen.map((e) => ({
      text: `${e.title}: ${fact(e.value)}`,
      evidenceIds: [e.id],
    }));
    output.evidenceRefs = chosen.map((e) => e.id);
    const missing = ev.some(
      (e) => hasUnknown(e.value) || e.confidence === "Low",
    );
    if (!chosen.length || missing)
      output.dataGaps = [
        "شواهد اندازه‌گیری‌شده و تازه برای بخشی از زمینه موجود نیست؛ برای تفکیک علت از نشانه، مقدار واقعی، دوره سنجش و منبع را ثبت و بازبینی کنید.",
      ];
    if (chosen.length)
      output.recommendations = [
        {
          text: "پیشنهاد مدیریتی: پیش از افزایش حجم، شواهد ریسک و ظرفیت را با مالک مرتبط بازبینی کنید؛ این پیشنهاد جایگزین تصمیم تأییدشده نیست.",
          evidenceIds: chosen.slice(0, 2).map((e) => e.id),
        },
      ];
    output.warnings = [
      "حالت آزمایشیِ قطعی؛ هیچ فراخوانی خارجی یا تغییر داده انجام نشده است.",
    ];
    if (request.mode === "brief")
      output.brief = [
        "وضعیت کلی",
        "مهم‌ترین ریسک‌ها",
        "مهم‌ترین فرصت‌ها",
        "تمرکز مدیریتی",
        "تصمیم‌های معطل",
        "کمبود داده",
      ].map((title, i) => ({
        title,
        items: chosen.length
          ? [
              {
                text:
                  i === 5
                    ? "برای تصمیم دقیق‌تر، کامل‌بودن و تازگی شواهد بررسی شود."
                    : chosen[i % chosen.length].title +
                      " — " +
                      fact(chosen[i % chosen.length].value),
                evidenceIds: [chosen[i % chosen.length].id],
              },
            ]
          : [],
      }));
    if (
      classifyIntent(request.question, request.selection, request.history) ===
        "Comparison" &&
      chosen.length
    )
      output.comparison = [
        {
          option: "توسعه تقاضا",
          benefits:
            "در صورت اعتبارسنجی شواهد، امکان بررسی افزایش تقاضا وجود دارد.",
          risks:
            "بخش‌های نامعلوم و محدودیت ظرفیت باید پیش از تصمیم بررسی شوند.",
          evidenceIds: [chosen[0].id],
        },
        {
          option: "تقویت ظرفیت و فرآیند",
          benefits:
            "امکان بازبینی محدودیت‌های ثبت‌شده و واگذاری مسئولیت‌ها فراهم می‌شود.",
          risks: "اثر این گزینه بدون سنجش دوره‌ای قطعی نیست.",
          evidenceIds: [chosen.at(-1)!.id],
        },
      ];
    return output;
  }
}
