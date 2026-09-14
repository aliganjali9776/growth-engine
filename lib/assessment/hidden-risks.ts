import { questions } from "./questions";
import type { Answers, AssessmentDimension, HiddenRisk } from "./types";
export function generateHiddenRisks(answers: Answers): HiddenRisk[] {
  const risks: HiddenRisk[] = [];
  const add = (
    id: string,
    dimension: AssessmentDimension,
    title: string,
    explanation: string,
    ids: string[],
  ) =>
    risks.push({
      id,
      dimension,
      title,
      explanation,
      evidence: ids.map(
        (id) =>
          `${questions.find((q) => q.id === id)!.focus}: ${answers[id].toLocaleString("fa-IR")} از ۵`,
      ),
    });
  if (answers["system-2"] >= 3 && answers["system-6"] <= 2)
    add(
      "manager-dependency",
      "system",
      "فرآیند موجود، تصمیم‌گیری وابسته",
      "با رشد تیم، وابستگی به تصمیم‌های مدیرعامل می‌تواند سرعت اجرا را کاهش دهد؛ وجود فرآیند به‌تنهایی این وابستگی را رفع نمی‌کند.",
      ["system-2", "system-6"],
    );
  if (answers["system-3"] < 4)
    add(
      "sop-consistency",
      "system",
      "ریسک ناپایداری کیفیت اجرا",
      "افزایش تعداد نیروها بدون استانداردسازی دستورالعمل‌های اجرایی می‌تواند کیفیت اجرا را ناپایدار کند.",
      ["system-3"],
    );
  if (answers["strategy-1"] >= 3 && answers["strategy-7"] < 4)
    add(
      "review-gap",
      "strategy",
      "فاصله میان هدف و ریتم اجرا",
      "اهداف تا حدی مشخص هستند، اما نبود مرور منظم می‌تواند باعث فاصله گرفتن اجرا از اولویت‌های اصلی شود.",
      ["strategy-1", "strategy-7"],
    );
  if (answers["strategy-4"] < 4 || answers["strategy-5"] < 4)
    add(
      "measurement-gap",
      "strategy",
      "ریسک کنترل‌ناپذیری اهداف",
      "اهداف بدون شاخص‌های عددی کافی ممکن است در عمل قابل کنترل و پاسخ‌گویی نباشند.",
      ["strategy-4", "strategy-5"].filter((id) => answers[id] < 4),
    );
  if (answers["scale-2"] >= 4 && answers["scale-1"] <= 2)
    add(
      "acquisition-gap",
      "scale",
      "فروش قوی، جذب پیش‌بینی‌ناپذیر",
      "فروش فعلی قابل قبول است، اما رشد آینده بدون کانال جذب قابل پیش‌بینی ممکن است ناپایدار باشد.",
      ["scale-2", "scale-1"],
    );
  if (answers["scale-8"] < 4)
    add(
      "revenue-dependency",
      "scale",
      "تمرکز منابع درآمد",
      "وابستگی به تعداد محدودی مشتری، کانال یا فرد کلیدی می‌تواند ریسک رشد را افزایش دهد.",
      ["scale-8"],
    );
  for (const dimension of ["system", "strategy", "scale"] as const) {
    if (risks.some((r) => r.dimension === dimension)) continue;
    const weak = questions
      .filter((q) => q.dimension === dimension && answers[q.id] < 4)
      .sort((a, b) => answers[a.id] - answers[b.id] || b.weight - a.weight)[0];
    if (weak)
      add(
        `${dimension}-unresolved-gap`,
        dimension,
        `پیامد تداوم شکاف در ${weak.focus}`,
        weak.explanation,
        [weak.id],
      );
  }
  return risks;
}
