import Link from "next/link";
import { ArrowLeft, ArrowUpLeft, Check, CircleDot } from "lucide-react";
import { activities, attention, fa, priorities, scores } from "@/lib/mock-data";
export function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return (
    <span className={`badge ${tone}`}>
      <i />
      {children}
    </span>
  );
}
export function ProgressBar({
  value,
  label = "پیشرفت",
}: {
  value: number;
  label?: string;
}) {
  return (
    <div
      className="progress"
      role="progressbar"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span style={{ width: `${value}%` }} />
    </div>
  );
}
export function PageHeader({
  title,
  description,
  eyebrow,
  children,
}: {
  title: string;
  description: string;
  eyebrow: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </header>
  );
}
export function SectionCard({
  title,
  subtitle,
  children,
  href,
  linkText = "مشاهده همه",
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  href?: string;
  linkText?: string;
  className?: string;
}) {
  return (
    <section className={`section-card ${className}`}>
      <div className="section-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {href && (
          <Link className="text-link" href={href}>
            {linkText}
            <ArrowLeft size={14} />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
export function MetricCard({
  label,
  value,
  detail,
  positive = false,
}: {
  label: string;
  value: string;
  detail: string;
  positive?: boolean;
}) {
  return (
    <div className="metric-card">
      <p>{label}</p>
      <strong>{value}</strong>
      <span className={positive ? "positive" : ""}>
        {positive && <ArrowUpLeft size={14} />} {detail}
      </span>
    </div>
  );
}
export function ScoreCard() {
  return (
    <section className="score-card">
      <div className="score-top">
        <div>
          <span className="eyebrow">BUSINESS HEALTH</span>
          <h2>سلامت کسب‌وکار شما</h2>
          <p>امتیاز یکپارچه مدل 3S</p>
        </div>
        <span className="score-label">در مسیر بهبود</span>
      </div>
      <div className="score-body">
        <div className="score-ring">
          <div>
            <strong>۷۲</strong>
            <span>از ۱۰۰</span>
          </div>
        </div>
        <div className="score-summary">
          <span className="score-change">
            <ArrowUpLeft size={17} /> ۶ امتیاز بهتر
          </span>
          <p>نسبت به ارزیابی قبلی</p>
          <p className="score-note">
            استراتژی روشن است؛
            <br />
            زیرساخت اجرا به توجه نیاز دارد.
          </p>
        </div>
      </div>
      <div className="score-components">
        {scores.map((s) => (
          <div key={s.label}>
            <div className="flex justify-between items-center">
              <span>{s.label}</span>
              <strong>{fa(s.value)}</strong>
            </div>
            <ProgressBar value={s.value} label={s.label} />
          </div>
        ))}
      </div>
      <Link href="/assessment" className="score-footer">
        مشاهده جزئیات ارزیابی <ArrowLeft size={16} />
      </Link>
    </section>
  );
}
export function PriorityCard() {
  return (
    <SectionCard
      title="اولویت‌های جاری"
      subtitle="سه تمرکز اصلی در این فصل"
      href="/strategy"
    >
      {priorities.map((p, i) => (
        <div className="priority-row" key={p.title}>
          <span className="row-number">{fa(i + 1).padStart(2, "۰")}</span>
          <div className="priority-content">
            <div className="flex justify-between gap-2 flex-wrap">
              <h3>{p.title}</h3>
              <StatusBadge tone={p.tone}>{p.status}</StatusBadge>
            </div>
            <div className="priority-meta">
              <span>
                <i className="mini-avatar">{p.initials}</i>
                {p.owner}
              </span>
              <span>{fa(p.progress)}٪</span>
            </div>
            <ProgressBar value={p.progress} label={p.title} />
          </div>
        </div>
      ))}
    </SectionCard>
  );
}
export function AttentionCard() {
  return (
    <SectionCard
      title="نیازمند توجه شما"
      subtitle="۳ موضوع برای تصمیم‌گیری مدیریت"
      href="/dashboard"
      linkText="بررسی وضعیت"
      className="attention-section"
    >
      <div className="attention-grid">
        {attention.map((a) => (
          <div className="attention-item" key={a.title}>
            <span className="attention-tag">
              <CircleDot size={13} />
              {a.tag}
            </span>
            <h3>{a.title}</h3>
            <div className="attention-value">
              <strong>{a.value}</strong>
              <span>{a.target}</span>
            </div>
            <p>{a.detail}</p>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
export function ActivityFeed() {
  return (
    <SectionCard title="آخرین پیشرفت‌ها" subtitle="قدم‌های کوچک، حرکت مداوم">
      <div className="activity-feed">
        {activities.map((a) => (
          <div className="activity" key={a.title}>
            <span className="activity-dot">
              <Check size={13} />
            </span>
            <div>
              <h3>{a.title}</h3>
              <p>{a.detail}</p>
            </div>
            <time>{a.time}</time>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
export function PreviewNote() {
  return (
    <div className="preview-note">
      <CircleDot size={15} />
      <span>
        پیش‌نمایش · اطلاعات نمونه است. امکانات اجرایی در مراحل بعدی اضافه
        می‌شوند.
      </span>
    </div>
  );
}
