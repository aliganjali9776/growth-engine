export { ImprovementPreview } from "./improvement-preview";
import { ArrowRight, CircleAlert, Compass, ShieldCheck } from "lucide-react";
import { dimensionMeta } from "@/lib/assessment/questions";
import {
  healthLabels,
  scoreInterpretations,
} from "@/lib/assessment/interpretation";
import type { AssessmentResult, CompanyProfile } from "@/lib/assessment/types";
import { fa } from "@/lib/mock-data";
import { ConsultationCTA } from "./consultation-cta";
import {
  DimensionDiagnosticSection,
  ExecutiveSummary,
  FindingsCategory,
  HiddenRiskCard,
  RecommendedActionCard,
} from "./report-sections";
import "./report.css";
export function AssessmentResults({
  result,
  profile,
  completedAt,
  onRoadmap,
  onReview,
}: {
  result: AssessmentResult;
  profile: CompanyProfile;
  completedAt: string | null;
  onRoadmap: () => void;
  onReview: () => void;
}) {
  const critical = result.findings.filter((f) => f.severity === "critical");
  const actions = result.findings.filter((f) => f.severity === "action");
  return (
    <div className="report-v25">
      <header className="report-header">
        <div>
          <div className="eyebrow">3S EXECUTIVE DIAGNOSTIC</div>
          <h1>گزارش سلامت و ظرفیت رشد کسب‌وکار</h1>
          <p>
            {profile.name} · {profile.industry} · مرحله {profile.stage}
          </p>
        </div>
        <span>
          <ShieldCheck size={16} />
          بر مبنای ۳۰ پاسخ شما
          {completedAt && (
            <small>{new Date(completedAt).toLocaleDateString("fa-IR")}</small>
          )}
        </span>
      </header>
      <section className="overall-report">
        <div className="overall-score">
          <div>
            <span className="eyebrow">01 / OVERALL BUSINESS HEALTH</span>
            <h2>سلامت کلی کسب‌وکار</h2>
            <span className={`health-status ${result.status}`}>
              {healthLabels[result.status]}
            </span>
          </div>
          <div className="diagnostic-number">
            <strong>{fa(Math.round(result.overall))}</strong>
            <span>از ۱۰۰</span>
          </div>
          <p>
            {result.capped
              ? "امتیاز یک محور زیر ۴۰ است؛ به همین دلیل وضعیت کلی حداکثر «ناپایدار» نمایش داده می‌شود. میانگین عددی تغییر نکرده است."
              : scoreInterpretations[result.status]}
          </p>
        </div>
        <div className="overall-findings">
          <span className="eyebrow">BEYOND THE AVERAGE</span>
          <h2>امتیاز بالا، جای بررسی شکاف‌ها را نمی‌گیرد.</h2>
          <p>
            هر پاسخ مستقل بررسی شده است؛ ضعف یک قابلیت ممکن است در میانگین پنهان
            بماند.
          </p>
          <div>
            <span>
              <strong>{fa(critical.length)}</strong>مسئله بحرانی
            </span>
            <span>
              <strong>{fa(actions.length)}</strong>نیازمند اقدام
            </span>
            <span>
              <strong>
                {fa(
                  result.findings.filter((f) => f.severity === "improvement")
                    .length,
                )}
              </strong>
              فرصت بهبود
            </span>
            <span>
              <strong>
                {fa(
                  result.findings.filter((f) => f.severity === "strength")
                    .length,
                )}
              </strong>
              نقطه قوت
            </span>
          </div>
        </div>
      </section>
      <ExecutiveSummary result={result} />
      <section className="primary-constraint">
        <div className="report-section-title">
          <span className="report-section-number">۰۳</span>
          <div>
            <h2>
              مانع اصلی رشد: {dimensionMeta[result.primaryConstraint].label}
            </h2>
            <p>کم‌امتیازترین محور؛ جهت شروع بررسی مدیریت</p>
          </div>
          <Compass size={23} />
        </div>
        <p>
          {
            result.dimensionDiagnostics.find(
              (d) => d.dimension === result.primaryConstraint,
            )!.interpretation
          }
        </p>
        {critical.length > 0 && (
          <p className="constraint-warning">
            <CircleAlert size={15} />
            یافته‌های بحرانی در هر محور باید مستقل از این اولویت نسبی بررسی
            شوند.
          </p>
        )}
        {result.tiedDimensions.length > 1 && (
          <small>
            امتیاز برابر در{" "}
            {result.tiedDimensions
              .map((d) => dimensionMeta[d].label)
              .join("، ")}
            ؛ ترتیب تمرکز بر مبنای سیستم ← استراتژی ← اسکیل است.
          </small>
        )}
      </section>
      <section className="diagnostic-overview">
        <div className="report-section-title">
          <span className="report-section-number">۰۴</span>
          <div>
            <h2>نمای تشخیصی سه محور</h2>
            <p>برای مشاهده تشخیص کامل، محور موردنظر را انتخاب کنید.</p>
          </div>
        </div>
        <div className="overview-dimensions">
          {result.dimensionDiagnostics.map((d) => (
            <a key={d.dimension} href={`#diagnostic-${d.dimension}`}>
              <span className="eyebrow">
                {dimensionMeta[d.dimension].english}
              </span>
              <div>
                <h3>{dimensionMeta[d.dimension].label}</h3>
                <strong>
                  {fa(Math.round(d.score))}
                  <small> / ۱۰۰</small>
                </strong>
              </div>
              <span className={`health-status ${d.status}`}>
                {healthLabels[d.status]}
              </span>
              <div className={`diagnostic-bar ${d.status}`}>
                <span style={{ width: `${d.score}%` }} />
              </div>
              <p>
                {fa(d.findings.filter((f) => f.severity === "critical").length)}{" "}
                بحرانی ·{" "}
                {fa(d.findings.filter((f) => f.severity === "action").length)}{" "}
                نیازمند اقدام
              </p>
            </a>
          ))}
        </div>
      </section>
      {result.dimensionDiagnostics.map((d, i) => (
        <DimensionDiagnosticSection
          key={d.dimension}
          diagnostic={d}
          index={i}
        />
      ))}
      <FindingsCategory
        number="۰۸"
        severity="critical"
        findings={result.findings}
      />
      <FindingsCategory
        number="۰۹"
        severity="action"
        findings={result.findings}
      />
      <FindingsCategory
        number="۱۰"
        severity="improvement"
        findings={result.findings}
      />
      <section className="all-hidden-risks">
        <div className="report-section-title">
          <span className="report-section-number">۱۱</span>
          <div>
            <h2>ریسک‌های پنهان و مدیریتی</h2>
            <p>پیامدهای احتمالی بر اساس ترکیب پاسخ‌ها؛ نه پیش‌بینی قطعی</p>
          </div>
        </div>
        {result.dimensionDiagnostics.map((d) => (
          <div key={d.dimension}>
            <h3 className="risk-dimension-title">
              {dimensionMeta[d.dimension].label}
            </h3>
            {d.risks.length ? (
              d.risks.map((r) => <HiddenRiskCard key={r.id} risk={r} />)
            ) : (
              <p className="no-findings">{d.riskNote}</p>
            )}
          </div>
        ))}
      </section>
      <FindingsCategory
        number="۱۲"
        severity="strength"
        findings={result.findings}
      />
      <section className="next-management-move">
        <div className="report-section-title">
          <span className="report-section-number">۱۳</span>
          <div>
            <h2>حرکت بعدی مدیریت</h2>
            <p>
              ابتدا شکاف‌های جدی را بررسی کنید؛ سپس بهینه‌سازی و توسعه را
              اولویت‌بندی کنید.
            </p>
          </div>
        </div>
        {critical.length > 0 && (
          <p className="critical-next-note">
            پیش از افزایش فشار رشد، {fa(critical.length)} مسئله بحرانی را با
            مالک مربوط بررسی و دامنه اثر آن‌ها را مشخص کنید.
          </p>
        )}
        <RecommendedActionCard
          focus={result.recommendation.title}
          action={result.recommendation.description}
        />
      </section>
      <ConsultationCTA copy={result.consultationCopy} onRoadmap={onRoadmap} />
      <footer className="report-footer">
        <button className="assessment-secondary" onClick={onReview}>
          <ArrowRight size={16} />
          مرور و اصلاح پاسخ‌ها
        </button>
        <p>
          گزارش مبتنی بر خودارزیابی و قواعد مشخص است؛ تأیید شواهد اجرایی به
          بررسی جداگانه نیاز دارد.
          <br />
          امتیازها فقط برای نمایش گرد شده‌اند؛ وضعیت بر مبنای امتیاز دقیق تعیین
          می‌شود. فرمول و وزن پرسش‌ها تغییر نکرده است.
        </p>
      </footer>
    </div>
  );
}
