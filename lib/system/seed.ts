import type {
  SystemData,
  Process,
  Rating,
  SystemizationStage,
  FounderDependency,
} from "./types";
import { calculatePriority } from "./scoring";
const departments = [
  "مدیریت",
  "فروش",
  "بازاریابی",
  "عملیات",
  "مالی",
  "منابع انسانی",
].map((name, i) => ({
  id: `d${i}`,
  name,
  description: `هماهنگی و توسعه قابلیت‌های ${name}`,
  status: "active" as const,
  parentDepartmentId: i ? "d0" : undefined,
  managerRoleId: `r${i}`,
}));
const names = [
  "آرمان نادری",
  "علی رضایی",
  "نگار احمدی",
  "مریم کریمی",
  "رضا محمدی",
];
const titles = [
  "مدیرعامل و بنیان‌گذار",
  "مدیر فروش",
  "مدیر بازاریابی",
  "مدیر عملیات",
  "مدیر مالی",
  "مسئول منابع انسانی",
  "کارشناس فروش",
];
const roles = titles.map((title, i) => ({
  id: `r${i}`,
  title,
  departmentId: `d${i === 6 ? 1 : i}`,
  reportsToRoleId: i ? (i === 6 ? "r1" : "r0") : undefined,
  purpose: `ایجاد عملکرد قابل اتکا در ${title}`,
  responsibilities: [
    "تعیین اولویت‌ها و معیار موفقیت",
    "مرور عملکرد و رفع موانع اجرا",
  ],
  personId: i < 5 ? `u${i}` : undefined,
  isKeyRole: i < 5,
  isFounderRole: i === 0,
}));
const people = names.map((name, i) => ({
  id: `u${i}`,
  name,
  jobTitle: titles[i],
  email: `member${i + 1}@example.com`,
  status: "active" as const,
}));
const rows: [
  string,
  number,
  string,
  Rating,
  Rating,
  Rating,
  Rating,
  SystemizationStage,
  FounderDependency,
][] = [
  ["جذب لید", 2, "جذب", 3, 2, 2, 3, "mapped", "low"],
  [
    "ارزیابی و Qualification لید",
    1,
    "فروش",
    3,
    3,
    2,
    3,
    "identified",
    "medium",
  ],
  ["جلسه کشف نیاز مشتری", 1, "فروش", 3, 2, 2, 3, "analyzed", "medium"],
  ["آماده‌سازی محتوای بازاریابی", 2, "جذب", 2, 2, 1, 3, "standardized", "none"],
  ["جلسه فروش", 1, "فروش", 3, 2, 3, 3, "mapped", "high"],
  [
    "تهیه پروپوزال، پیگیری و بستن قرارداد",
    1,
    "فروش",
    3,
    3,
    3,
    3,
    "identified",
    "high",
  ],
  ["آنبوردینگ مشتری", 3, "تحویل / عملیات", 3, 2, 2, 2, "redesigned", "low"],
  ["اجرای پروژه", 3, "تحویل / عملیات", 3, 3, 2, 3, "implemented", "medium"],
  ["دریافت مطالبات", 4, "مالی", 3, 1, 2, 2, "standardized", "low"],
  [
    "تمدید قرارداد و فروش تکمیلی",
    1,
    "فروش",
    2,
    2,
    2,
    2,
    "identified",
    "medium",
  ],
  ["جلسه مدیریت داخلی", 0, "مدیریت", 3, 2, 3, 3, "identified", "critical"],
  [
    "پاسخ‌گویی به درخواست پشتیبانی",
    3,
    "پشتیبانی",
    2,
    1,
    1,
    3,
    "measured",
    "none",
  ],
  ["بستن حساب‌های ماهانه", 4, "مالی", 2, 1, 1, 2, "improving", "none"],
  ["ثبت و بایگانی اسناد", 4, "مالی", 1, 1, 1, 1, "standardized", "none"],
  ["جذب و پذیرش همکار جدید", 5, "منابع انسانی", 2, 2, 2, 1, "mapped", "medium"],
];
const processes: Process[] = rows.map(
  (
    [
      name,
      d,
      valueChain,
      impact,
      variation,
      dependency,
      frequency,
      systemizationStage,
      founderDependency,
    ],
    i,
  ) => ({
    id: `p${i + 1}`,
    code: `P${String(i + 1).padStart(3, "0")}`,
    name,
    description: `فرآیند تکرارشونده ${name}؛ از دریافت ورودی تا تحویل خروجی و تأیید نتیجه.`,
    departmentId: `d${d}`,
    ownerRoleId: `r${d}`,
    valueChain,
    impact,
    variation,
    dependency,
    frequency,
    ...calculatePriority({ impact, variation, dependency, frequency }),
    founderDependency,
    systemizationStage,
    documentationStatus: [
      "standardized",
      "implemented",
      "measured",
      "improving",
    ].includes(systemizationStage)
      ? "complete"
      : systemizationStage === "identified"
        ? "none"
        : "partial",
    adoptionStatus: "not-started",
    status: "active",
    notes:
      i === 5
        ? "تأیید قیمت‌گذاری و تخفیف‌ها همچنان به بنیان‌گذار وابسته است."
        : "داده نمونه؛ مالک فرآیند باید وضعیت واقعی را تأیید کند.",
    createdAt: "2026-09-12T00:00:00.000Z",
    updatedAt: "2026-09-12T00:00:00.000Z",
  }),
);
export function createSystemSeed(): SystemData {
  return structuredClone({ version: 1, departments, roles, people, processes });
}
