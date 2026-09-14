import type { HealthStatus } from "./types";
export const healthLabels: Record<HealthStatus, string> = {
  critical: "بحرانی",
  developing: "ناپایدار",
  healthy: "قابل قبول اما نیازمند بهبود",
  strong: "قوی اما قابل بهینه‌سازی",
  excellent: "بسیار قوی",
};
export function classify(score: number): HealthStatus {
  if (score < 40) return "critical";
  if (score < 60) return "developing";
  if (score < 80) return "healthy";
  if (score < 90) return "strong";
  return "excellent";
}
export const scoreInterpretations: Record<HealthStatus, string> = {
  critical:
    "پاسخ‌ها از شکاف‌های جدی در قابلیت اتکای این بخش حکایت دارند؛ تثبیت اجرا و کنترل مدیریتی باید در اولویت باشد.",
  developing:
    "برخی قابلیت‌ها شکل گرفته‌اند، اما اجرای آن‌ها هنوز ناپایدار است و به مالکیت روشن و پیگیری فعال نیاز دارد.",
  healthy:
    "زیرساخت پایه وجود دارد، اما چند بخش برای رشد پایدار به استانداردسازی و اصلاح نیاز دارند.",
  strong:
    "ساختار این بخش قوی است؛ با این حال، پاسخ‌های ضعیف‌تر باید مستقل از میانگین بررسی شوند تا در مقیاس بالاتر به محدودیت تبدیل نشوند.",
  excellent:
    "پاسخ‌ها نشان‌دهنده بلوغ بالای این بخش هستند؛ حفظ کیفیت، انتقال دانش و اعتبارسنجی در مقیاس بالاتر همچنان ضروری است.",
};
