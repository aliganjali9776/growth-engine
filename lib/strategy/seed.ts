import {
  emptyContext,
  emptyStrategy,
  type StrategyRole,
  type StrategyStore,
} from "./model";
export function seedStrategy(roles: StrategyRole[]): StrategyStore {
  const now = "2026-09-21T09:00:00.000Z",
    id = "sample-1405",
    owner = roles[0]?.id ?? "";
  const titles = [
    "رشد درآمد",
    "تقویت برند شخصی",
    "حرفه‌ای‌سازی ساختار کسب‌وکار",
  ];
  return {
    ...emptyStrategy(),
    sample: true,
    cycles: [
      {
        id,
        name: "چرخه استراتژی شهریور تا آبان ۱۴۰۵",
        description: "نمونه قابل ویرایش، هم‌راستا با روش مدیریت دوره‌ای",
        startDate: "2026-08-23",
        endDate: "2026-11-21",
        status: "active",
        ownerRoleId: owner,
        cycleType: "quarterly",
        strategicTheme: "رشد قابل تکرار و ساخت کسب‌وکار حرفه‌ای",
        createdAt: now,
        updatedAt: now,
      },
    ],
    contexts: [
      {
        ...emptyContext(id),
        situation: "کسب‌وکار خدمات مشاوره در حال رشد است.",
        challenge: "وابستگی درآمد به تعداد محدود پروژه",
        constraint: "ظرفیت محدود جذب مستمر مشتری",
        opportunity: "توسعه فروش مشاوره و لیدهای واجد شرایط",
        risk: "تمرکز درآمد روی چند مشتری",
        desiredState: "فروش قابل تکرار در کنار ساختار حرفه‌ای‌تر",
      },
    ],
    priorities: titles.map((title, i) => ({
      id: `sample-p${i + 1}`,
      cycleId: id,
      title,
      description: "",
      direction: (["revenue", "brand", "capability"] as const)[i],
      customDirection: "",
      ownerRoleId: owner,
      rank: i + 1,
      rationale: [
        "کاهش وابستگی به پروژه‌های پراکنده",
        "افزایش اعتماد و تقاضای واجد شرایط",
        "ایجاد ظرفیت رشد مستقل از افراد",
      ][i],
      successDefinition: "تبدیل این جهت‌گیری به قابلیتی پایدار و قابل تکرار",
      status: "selected",
      createdAt: now,
      updatedAt: now,
    })),
    choices: [
      {
        id: "sample-focus",
        cycleId: id,
        type: "focus",
        statement: "تمرکز بر موتور فروش مشاوره B2B",
        rationale: "بیشترین تناسب با قابلیت فعلی تیم",
        createdAt: now,
      },
      {
        id: "sample-not-now",
        cycleId: id,
        type: "notNow",
        statement: "فعلاً ورود به بازار جغرافیایی جدید را دنبال نمی‌کنیم.",
        rationale: "ابتدا تثبیت کانال فعلی",
        createdAt: now,
      },
    ],
    objectives: titles.map((title, i) => ({
      id: `sample-o${i + 1}`,
      cycleId: id,
      code: `O${i + 1}`,
      title: i === 1 ? "تقویت برند شخصی بنیان‌گذاران" : title,
      description: "نمونه روش‌شناسی؛ عنوان را برای کسب‌وکار خود دقیق‌تر کنید.",
      ownerRoleId: owner,
      relatedPriorityId: `sample-p${i + 1}`,
      status: "draft",
      startDate: "2026-08-23",
      deadline: "2026-11-21",
      createdAt: now,
      updatedAt: now,
    })),
  };
}
