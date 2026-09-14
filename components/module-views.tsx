import {
  Users,
  TrendingUp,
  Target,
  ShieldCheck,
  CircleAlert,
  CalendarDays,
} from "lucide-react";
import {
  AttentionCard,
  MetricCard,
  ProgressBar,
  SectionCard,
  StatusBadge,
} from "./ui";
import { fa, scores } from "@/lib/mock-data";

export function StrategyView() {
  return (
    <>
      <div className="metrics-grid">
        <MetricCard
          label="اهداف فصل"
          value="۳ هدف"
          detail="یک جهت‌گیری مشترک"
        />
        <MetricCard
          label="نتایج کلیدی"
          value="۸ نتیجه"
          detail="۵ نتیجه طبق برنامه"
        />
        <MetricCard
          label="پیشرفت استراتژی"
          value="۶۷٪"
          detail="۹٪ بهتر از ماه قبل"
          positive
        />
        <MetricCard
          label="ابتکارات استراتژیک"
          value="۴ ابتکار"
          detail="۲ ابتکار در حال اجرا"
        />
      </div>
      <SectionCard
        title="افزایش بهره‌وری موتور فروش"
        subtitle="هدف اول · مالک: سارا احمدی · فصل سوم ۱۴۰۵"
      >
        <div className="objective-banner">
          <Target size={25} />
          <span>
            رشد فروش از مسیر بهبود کیفیت تبدیل، نه صرفاً افزایش ورودی.
          </span>
          <StatusBadge tone="warning">نیازمند توجه</StatusBadge>
        </div>
        {[
          {
            title: "افزایش نرخ تبدیل از ۱۲٪ به ۱۸٪",
            value: 64,
            owner: "سارا احمدی",
          },
          {
            title: "افزایش فروش ماهانه به ۵ میلیارد تومان",
            value: 72,
            owner: "محمد رضایی",
          },
        ].map((k, i) => (
          <div className="kr-row" key={k.title}>
            <span className="kr-label">KR 0{i + 1}</span>
            <div>
              <h3>{k.title}</h3>
              <p>مالک: {k.owner}</p>
              <ProgressBar value={k.value} />
            </div>
            <strong>{fa(k.value)}٪</strong>
          </div>
        ))}
      </SectionCard>
      <div className="bottom-grid">
        <SectionCard title="ابتکارات استراتژیک">
          <div className="list-row">
            <span>بازطراحی مسیر پیگیری مشتری</span>
            <StatusBadge>در حال اجرا</StatusBadge>
          </div>
          <div className="list-row">
            <span>آموزش مذاکره به تیم فروش</span>
            <StatusBadge tone="success">طبق برنامه</StatusBadge>
          </div>
        </SectionCard>
        <SectionCard title="شاخص‌های راهبردی">
          <div className="list-row">
            <span>هزینه جذب مشتری</span>
            <strong>۴۸۰ هزار تومان</strong>
          </div>
          <div className="list-row">
            <span>نرخ حفظ مشتری</span>
            <strong>۸۶٪</strong>
          </div>
        </SectionCard>
      </div>
    </>
  );
}
export function ScaleView() {
  return (
    <>
      <div className="scale-banner">
        <div>
          <span className="eyebrow">REMOVE THE CONSTRAINT. UNLOCK GROWTH.</span>
          <h2>فرصت رشد هست؛ ظرفیت پاسخ‌گویی محدود است.</h2>
          <p>
            تمرکز پیشنهادی این فصل: رفع گلوگاه پیگیری فروش، پیش از افزایش بودجه
            جذب.
          </p>
        </div>
        <TrendingUp size={50} />
      </div>
      <div className="three-grid">
        {[
          { label: "رشد و فروش", value: "۱۲٪", detail: "نرخ تبدیل · هدف ۱۸٪" },
          {
            label: "بازاریابی",
            value: "۲۴۰",
            detail: "فرصت فروش واجد شرایط در ماه",
          },
          {
            label: "ظرفیت عملیات",
            value: "۸۵٪",
            detail: "استفاده از ظرفیت فعلی تیم",
          },
        ].map((c) => (
          <MetricCard key={c.label} {...c} />
        ))}
      </div>
      <div className="bottom-grid">
        <SectionCard
          title="گلوگاه‌های رشد"
          subtitle="چه چیزی قدم بعدی را محدود می‌کند؟"
        >
          <div className="constraint">
            <CircleAlert size={19} />
            <div>
              <h3>تأخیر در پیگیری فرصت‌های فروش</h3>
              <p>میانگین پاسخ‌گویی: ۱۸ ساعت · هدف: ۴ ساعت</p>
              <StatusBadge tone="warning">اولویت بالا</StatusBadge>
            </div>
          </div>
          <div className="constraint">
            <Users size={19} />
            <div>
              <h3>ظرفیت محدود تیم تحویل</h3>
              <p>تخصیص منابع پیش از افزایش تقاضا</p>
              <StatusBadge>در حال بررسی</StatusBadge>
            </div>
          </div>
        </SectionCard>
        <SectionCard
          title="ابتکارات رشد"
          subtitle="اقداماتی برای آزاد کردن ظرفیت"
        >
          <div className="initiative">
            <span>۰۱</span>
            <div>
              <h3>استانداردسازی پیگیری فروش</h3>
              <p>مالک: سارا احمدی · اثر: بهبود تبدیل</p>
              <ProgressBar value={40} />
            </div>
          </div>
          <div className="initiative">
            <span>۰۲</span>
            <div>
              <h3>توسعه شبکه همکاران اجرایی</h3>
              <p>مالک: مریم کریمی · اثر: افزایش ظرفیت</p>
              <ProgressBar value={25} />
            </div>
          </div>
        </SectionCard>
      </div>
    </>
  );
}
export function ExecutionView() {
  return (
    <>
      <div className="metrics-grid">
        <MetricCard
          label="هفته جاری"
          value="هفته هشتم"
          detail="۲۱ تا ۲۷ آذر ۱۴۰۵"
        />
        <MetricCard
          label="گزارش‌های ثبت‌شده"
          value="۶ از ۸"
          detail="۲ گزارش در انتظار تکمیل"
        />
        <MetricCard
          label="تعهدهای انجام‌شده"
          value="۷۱٪"
          detail="۵ اقدام از ۷ اقدام"
        />
        <MetricCard
          label="موانع باز"
          value="۱ مانع"
          detail="نیازمند تصمیم مدیریت"
        />
      </div>
      <SectionCard
        title="گزارش پیشرفت هفتگی"
        subtitle="Weekly Check-in · نمونه گزارش تیم فروش"
      >
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {[
                  "نتیجه کلیدی",
                  "مقدار قبلی",
                  "مقدار فعلی",
                  "پیشرفت",
                  "اطمینان",
                ].map((s) => (
                  <th key={s}>{s}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>فروش ماهانه</td>
                <td>۲٫۹ میلیارد</td>
                <td>۳٫۲ میلیارد</td>
                <td>
                  <ProgressBar value={64} />
                  ۶۴٪
                </td>
                <td>
                  <StatusBadge tone="warning">متوسط</StatusBadge>
                </td>
              </tr>
              <tr>
                <td>نرخ تبدیل فروش</td>
                <td>۱۱٪</td>
                <td>۱۲٪</td>
                <td>
                  <ProgressBar value={67} />
                  ۶۷٪
                </td>
                <td>
                  <StatusBadge tone="success">بالا</StatusBadge>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="checkin-notes">
          <div>
            <span>مانع این هفته</span>
            <p>تأخیر در تأیید پیشنهاد قیمت مشتریان کلیدی</p>
          </div>
          <div>
            <span>اقدام بعدی</span>
            <p>تعیین سقف اختیار تخفیف تیم فروش تا سه‌شنبه</p>
          </div>
        </div>
      </SectionCard>
      <SectionCard
        title="مرور هفتگی"
        subtitle="Weekly Review · سه‌شنبه، ۲۴ آذر · ساعت ۱۰:۰۰"
      >
        <div className="review-grid">
          <CalendarDays size={36} />
          <div>
            <h3>جلسه مرور تیم فروش</h3>
            <p>۱. مرور نتایج و فاصله با هدف</p>
            <p>۲. تصمیم درباره مانع قیمت‌گذاری</p>
            <p>۳. توافق روی تعهدهای هفته آینده</p>
          </div>
          <StatusBadge>۴ شرکت‌کننده</StatusBadge>
        </div>
      </SectionCard>
    </>
  );
}
export function DashboardView() {
  return (
    <>
      <div className="metrics-grid">
        <MetricCard
          label="سلامت کل کسب‌وکار"
          value="۷۲ / ۱۰۰"
          detail="۶ امتیاز رشد"
          positive
        />
        <MetricCard
          label="پیشرفت اهداف"
          value="۶۷٪"
          detail="زمان سپری‌شده فصل: ۶۲٪"
        />
        <MetricCard
          label="شاخص‌های در محدوده هدف"
          value="۸ از ۱۲"
          detail="۳ نیازمند توجه · ۱ بحرانی"
        />
        <MetricCard
          label="آمادگی رشد"
          value="۶۶٪"
          detail="ظرفیت اجرا نیازمند تقویت"
        />
      </div>
      <div className="bottom-grid">
        <SectionCard
          title="روند سلامت کسب‌وکار"
          subtitle="چهار ارزیابی اخیر · امتیاز از ۱۰۰"
        >
          <div className="trend-chart">
            {[
              { v: 58, l: "شهریور" },
              { v: 63, l: "مهر" },
              { v: 66, l: "آبان" },
              { v: 72, l: "آذر" },
            ].map((x) => (
              <div key={x.l}>
                <strong>{fa(x.v)}</strong>
                <div style={{ height: x.v * 1.7 }} />
                <span>{x.l}</span>
              </div>
            ))}
          </div>
          <p className="chart-caption">
            رشد پیوسته؛ ۱۴ امتیاز بهبود نسبت به شهریور
          </p>
        </SectionCard>
        <SectionCard
          title="تعادل سه رکن کسب‌وکار"
          subtitle="مقایسه وضعیت فعلی با هدف ۸۰ امتیاز"
        >
          {scores.map((s) => (
            <div className="health-row" key={s.label}>
              <div>
                <span>
                  {s.label === "سیستم"
                    ? "سلامت سیستم"
                    : s.label === "استراتژی"
                      ? "اجرای استراتژی"
                      : "آمادگی اسکیل"}
                </span>
                <strong>{fa(s.value)} / ۱۰۰</strong>
              </div>
              <ProgressBar value={s.value} />
              <small>
                {s.value >= 80
                  ? "در محدوده هدف"
                  : `${fa(80 - s.value)} امتیاز تا هدف`}
              </small>
            </div>
          ))}
        </SectionCard>
      </div>
      <AttentionCard />
    </>
  );
}
export function SettingsView() {
  return (
    <div className="bottom-grid">
      <SectionCard title="مشخصات سازمان" subtitle="اطلاعات نمایشی فضای کاری">
        <dl className="settings-list">
          <div>
            <dt>نام شرکت</dt>
            <dd>شرکت نمونه آریا</dd>
          </div>
          <div>
            <dt>زبان محیط</dt>
            <dd>فارسی</dd>
          </div>
          <div>
            <dt>چرخه مدیریت</dt>
            <dd>فصل سوم ۱۴۰۵</dd>
          </div>
          <div>
            <dt>منطقه زمانی</dt>
            <dd>تهران</dd>
          </div>
        </dl>
      </SectionCard>
      <SectionCard title="درباره این نسخه">
        <ShieldCheck size={36} className="gold" />
        <h3 className="mt-5">فضایی برای ارزیابی تجربه مدیریت</h3>
        <p className="muted mt-3">
          این نسخه با داده‌های نمونه نمایش داده می‌شود. تنظیمات و اطلاعات شرکت
          در این مرحله قابل ویرایش نیستند.
        </p>
        <span className="badge neutral mt-5">پیش‌نمایش تنظیمات</span>
      </SectionCard>
    </div>
  );
}
