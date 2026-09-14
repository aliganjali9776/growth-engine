import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  Flag,
  Clock3,
  CircleAlert,
  ClipboardCheck,
} from "lucide-react";
import {
  ActivityFeed,
  AttentionCard,
  PageHeader,
  PriorityCard,
  ScoreCard,
  SectionCard,
} from "@/components/ui";
export default function Home() {
  return (
    <>
      <PageHeader
        eyebrow="YOUR BUSINESS, IN FOCUS"
        title="سلام علی، روز خوبی برای پیشرفت است."
        description="وضعیت کسب‌وکار امروز در یک نگاه؛ از تصویر کلان تا قدم بعدی."
      >
        <div className="header-date">
          <CalendarDays size={16} />
          دوشنبه، ۲۳ آذر ۱۴۰۵<span>هفته هشتم از فصل سوم</span>
        </div>
      </PageHeader>
      <div className="context-strip">
        <span>
          <i className="live-dot" />
          کسب‌وکار در مسیر بهبود است؛{" "}
          <strong>۳ موضوع به توجه شما نیاز دارد.</strong>
        </span>
        <span className="sample-label">داده‌های نمونه</span>
      </div>
      <div className="overview-grid">
        <ScoreCard />
        <PriorityCard />
      </div>
      <AttentionCard />
      <div className="bottom-grid">
        <SectionCard
          title="این هفته"
          subtitle="ریتم اجرا را حفظ کنید"
          href="/execution"
          linkText="مشاهده برنامه"
        >
          <div className="week-summary">
            {[
              { Icon: Flag, n: "۵", label: "اقدام مهم" },
              { Icon: CalendarDays, n: "۲", label: "جلسه مرور" },
              { Icon: ClipboardCheck, n: "۲", label: "گزارش در انتظار" },
              { Icon: CircleAlert, n: "۱", label: "مانع باز" },
            ].map((x) => (
              <div key={x.label}>
                <x.Icon size={17} />
                <strong>{x.n}</strong>
                <span>{x.label}</span>
              </div>
            ))}
          </div>
          <Link href="/execution" className="meeting">
            <span className="meeting-date">
              ۲۴<small>آذر</small>
            </span>
            <div>
              <h3>مرور هفتگی تیم فروش</h3>
              <p>
                <Clock3 size={12} /> فردا، ۱۰:۰۰ تا ۱۱:۰۰ · ۴ نفر
              </p>
            </div>
            <ArrowLeft size={16} />
          </Link>
        </SectionCard>
        <ActivityFeed />
      </div>
    </>
  );
}
