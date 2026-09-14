import type {
  FounderDependency,
  PriorityLevel,
  SystemizationStage,
} from "./types";
export const stages: Record<SystemizationStage, string> = {
  identified: "شناسایی‌شده",
  mapped: "مدل‌سازی‌شده",
  analyzed: "تحلیل‌شده",
  redesigned: "بازطراحی‌شده",
  standardized: "استانداردشده",
  implemented: "پیاده‌سازی‌شده",
  measured: "اندازه‌گیری‌شده",
  improving: "در حال بهبود",
};
export const stageKeys = Object.keys(stages) as SystemizationStage[];
export const priorities: Record<PriorityLevel, string> = {
  critical: "بحرانی",
  high: "بالا",
  medium: "متوسط",
  low: "پایین",
};
export const founderLevels: Record<FounderDependency, string> = {
  none: "ندارد",
  low: "کم",
  medium: "متوسط",
  high: "زیاد",
  critical: "بحرانی",
};
export const valueChains = [
  "جذب",
  "فروش",
  "تحویل / عملیات",
  "پشتیبانی",
  "مالی",
  "مدیریت",
  "منابع انسانی",
];
export const documentation = {
  none: "بدون مستند",
  partial: "مستندسازی ناقص",
  complete: "مستند کامل",
};
export const faNumber = (n: number) => n.toLocaleString("fa-IR");
