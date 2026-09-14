export const navigation = [
  { href: "/", label: "خانه", icon: "home" },
  { href: "/assessment", label: "ارزیابی 3S", icon: "assessment" },
  { href: "/system/command-center", label: "سیستم", icon: "system", step: "01" },
  { href: "/strategy", label: "استراتژی", icon: "strategy", step: "02" },
  { href: "/scale", label: "اسکیل", icon: "scale", step: "03" },
  { href: "/execution", label: "اجرا", icon: "execution" },
  { href: "/dashboard", label: "داشبورد مدیریتی", icon: "dashboard" },
];
export const scores = [
  { label: "سیستم", english: "SYSTEM", value: 68 },
  { label: "استراتژی", english: "STRATEGY", value: 81 },
  { label: "اسکیل", english: "SCALE", value: 66 },
];
export const priorities = [
  {
    title: "افزایش نرخ تبدیل فروش",
    owner: "سارا احمدی",
    initials: "س ا",
    status: "نیازمند توجه",
    progress: 64,
    tone: "warning",
  },
  {
    title: "تکمیل ساختار تیم فروش",
    owner: "محمد رضایی",
    initials: "م ر",
    status: "طبق برنامه",
    progress: 80,
    tone: "success",
  },
  {
    title: "کاهش زمان اجرای سفارش",
    owner: "مریم کریمی",
    initials: "م ک",
    status: "در حال اجرا",
    progress: 45,
    tone: "neutral",
  },
];
export const attention = [
  {
    title: "نرخ تبدیل فروش",
    detail: "فاصله با هدف فصل",
    value: "۱۲٪",
    target: "هدف: ۱۸٪",
    tag: "فروش",
  },
  {
    title: "فرآیند پیگیری مشتریان",
    detail: "مالک فرآیند باید مشخص شود",
    value: "نیازمند اصلاح",
    target: "۲ اقدام باز",
    tag: "سیستم",
  },
  {
    title: "نتیجه کلیدی فروش ماهانه",
    detail: "عقب‌تر از برنامه این هفته",
    value: "۶۴٪",
    target: "برنامه: ۷۵٪",
    tag: "استراتژی",
  },
];
export const activities = [
  {
    title: "دستورالعمل پاسخ‌گویی به لیدها تکمیل شد",
    detail: "سارا احمدی · سیستم",
    time: "۲ ساعت پیش",
  },
  {
    title: "پیشرفت فروش از ۵۸٪ به ۶۴٪ رسید",
    detail: "محمد رضایی · استراتژی",
    time: "۴ ساعت پیش",
  },
  {
    title: "گزارش پیشرفت هفته هشتم ثبت شد",
    detail: "مریم کریمی · اجرا",
    time: "دیروز",
  },
];
export const moduleInfo: Record<
  string,
  { title: string; eyebrow: string; description: string }
> = {
  assessment: {
    title: "ارزیابی 3S",
    eyebrow: "BUSINESS DIAGNOSTICS",
    description:
      "نقطه شروع یک مسیر روشن؛ تصویر مشترکی از بلوغ کسب‌وکار بسازید.",
  },
  system: {
    title: "سیستم؛ زیرساخت یک کسب‌وکار مستقل",
    eyebrow: "01 / SYSTEM",
    description:
      "ساختار، فرآیند و مسئولیت‌های روشن؛ برای عملکردی که به افراد وابسته نیست.",
  },
  strategy: {
    title: "استراتژی؛ تمرکز روی آنچه مهم است",
    eyebrow: "02 / STRATEGY",
    description: "از جهت‌گیری کلان تا نتایج قابل اندازه‌گیری؛ همه در یک مسیر.",
  },
  scale: {
    title: "اسکیل؛ آماده برای رشد پایدار",
    eyebrow: "03 / SCALE",
    description: "محدودیت‌های رشد را بشناسید و ظرفیت قدم بعدی را بسازید.",
  },
  execution: {
    title: "اجرا؛ ریتم پیشرفت تیم",
    eyebrow: "WEEKLY OPERATING RHYTHM",
    description: "یک هفته، چند تعهد روشن و گفت‌وگویی صادقانه درباره پیشرفت.",
  },
  dashboard: {
    title: "داشبورد مدیریتی",
    eyebrow: "EXECUTIVE INTELLIGENCE",
    description: "تصویر یکپارچه سلامت کسب‌وکار و روند تحقق اهداف فصل.",
  },
  settings: {
    title: "تنظیمات فضای کاری",
    eyebrow: "WORKSPACE",
    description: "پیش‌نمایش مشخصات سازمان و ترجیحات فضای مدیریت.",
  },
};
export const fa = (value: number) => value.toLocaleString("fa-IR");
