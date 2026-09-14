import { createSOP, emptyRecord, type StandardRecord } from "./model";
import type { ProcessMap } from "../maps/model";
import type { SystemData } from "../types";
// Authored example, never AI generated. Unknown added steps stay blank for the team to document.
const instructions: Record<string, string> = {
  "proposal-1":
    "درخواست مشتری و مشخصات تماس را در CRM ثبت و مسئول پیگیری را تعیین کنید.",
  "proposal-2":
    "نیاز، بودجه و موعد تصمیم مشتری را در جلسه بررسی و صورت‌جلسه را ثبت کنید.",
  "proposal-3":
    "پیشنهاد را با قالب مصوب، دامنه کار و خروجی قابل تحویل تهیه کنید.",
  "proposal-4":
    "هزینه و حاشیه سود را کنترل و قیمت پیشنهادی را در فرم قیمت ثبت کنید.",
  "proposal-5":
    "درصد تخفیف را با حد اختیار مقایسه و مسیر تأیید مناسب را انتخاب کنید.",
  "proposal-6":
    "درخواست خارج از حد اختیار را با دلیل تجاری بررسی و نتیجه تأیید را ثبت کنید.",
  "proposal-7":
    "فایل نسخه نهایی را ارسال و تاریخ پیگیری بعدی را در CRM ثبت کنید.",
  "proposal-8":
    "در موعد ثبت‌شده با مشتری تماس بگیرید و نتیجه تماس و اقدام بعدی را ثبت کنید.",
  "proposal-9":
    "پاسخ مستند مشتری را بررسی؛ پذیرش را به قرارداد و اصلاح را به پیگیری هدایت کنید.",
  "proposal-10":
    "درخواست اصلاح را ثبت و دامنه و قیمت جدید را پیش از ارسال دوباره کنترل کنید.",
  "proposal-11":
    "نسخه نهایی قرارداد را برای امضا ارسال، دریافت امضا را بررسی و فایل را بایگانی کنید.",
};
export function exampleStandard(
  map: ProcessMap,
  sys: SystemData,
): StandardRecord {
  const r = emptyRecord(map.processId),
    s = createSOP(map, sys);
  s.purpose = "استانداردسازی تهیه، ارسال و پیگیری پروپوزال تا عقد قرارداد";
  s.scope =
    "از دریافت درخواست تأییدشده مشتری تا ثبت قرارداد امضاشده؛ نمونه آموزشی قابل ویرایش";
  s.trigger = "تأیید اولیه نیاز مشتری";
  s.inputs = ["درخواست مشتری", "صورت‌جلسه نیازسنجی"];
  s.outputs = ["قرارداد امضاشده و ثبت‌شده"];
  s.prerequisites = ["دسترسی به CRM و قالب مصوب پروپوزال"];
  s.qualityCriteria = ["قیمت و دامنه کار با نسخه تأییدشده یکسان باشد"];
  s.definitionOfDone = [
    "قیمت نهایی تأیید شده",
    "پروپوزال ارسال شده",
    "موعد پیگیری ثبت شده",
    "وضعیت CRM به‌روزرسانی شده",
  ];
  s.exceptions = ["در صورت تغییر دامنه، قیمت دوباره بررسی شود"];
  s.escalationRules = ["بیش از سه درخواست اصلاح به مدیر فروش ارجاع شود"];
  s.procedureSteps = s.procedureSteps.map((p) => ({
    ...p,
    instruction: instructions[p.stepId] ?? "",
    expectedOutput: "نتیجه مرحله و اقدام بعدی در پرونده مشتری ثبت شده",
    qualityCriteria: "اطلاعات کامل، قابل پیگیری و مطابق آخرین نسخه باشد",
    exceptionNote: "در صورت نبود اطلاعات کافی، به مدیر فروش ارجاع شود",
  }));
  r.sop = s;
  r.checklists = [
    {
      id: "sample-checklist",
      processId: r.processId,
      name: "کنترل اجرای پروپوزال",
      description: "نمونه آموزشی؛ پیش از استفاده واقعی مرور شود",
      trigger: "در هر اجرای فرآیند",
      ownerRoleId: s.processOwnerRoleId,
      status: "ready",
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      items: s.procedureSteps.map((p, i) => ({
        id: `check-${p.stepId}`,
        title: `نتیجه «${map.steps.find((x) => x.id === p.stepId)?.title}» ثبت شده`,
        required: true,
        order: i,
        relatedStepId: p.stepId,
        note: "",
      })),
    },
  ];
  r.rules = map.steps
    .filter((x) => x.type === "decision")
    .map((x) => ({
      id: `rule-${x.id}`,
      processId: r.processId,
      title: x.title,
      relatedStepId: x.id,
      condition:
        x.id === "proposal-5"
          ? "تخفیف تا ۱۰٪ است"
          : "پاسخ پذیرش مشتری مستند شده است",
      action:
        x.id === "proposal-5"
          ? "مدیر فروش تأیید می‌کند؛ بیش از ۱۰٪ به مدیرعامل ارجاع شود"
          : "در صورت پذیرش، قرارداد آماده شود؛ در غیر این صورت پیگیری ادامه یابد",
      ownerRoleId: x.ownerRoleId ?? s.processOwnerRoleId,
      escalationRoleId: x.id === "proposal-5" ? "r0" : s.processOwnerRoleId,
      priority: 1,
      status: "ready",
      notes: "قاعده نمونه؛ حدود اختیار باید توسط شرکت تأیید شود",
    }));
  r.assets = [
    {
      id: "proposal-template",
      processId: r.processId,
      name: "قالب پروپوزال",
      type: "template",
      description: "مرجع نمونه؛ فایل واقعی بارگذاری نشده است",
      relatedStepId: map.steps.some((s) => s.id === "proposal-3")
        ? "proposal-3"
        : "",
      reference: "پوشه داخلی فروش / قالب پروپوزال مصوب",
      version: "1.0",
      status: "ready",
    },
  ];
  r.plan.roles = [
    ...new Set(
      s.procedureSteps.map((p) => p.responsibleRoleId).filter(Boolean),
    ),
  ].map((roleId) => ({ roleId, trained: false, acknowledged: false }));
  return r;
}
