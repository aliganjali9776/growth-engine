import {
  ArrowLeft,
  CircleAlert,
  ShieldCheck,
  Compass,
  FileSearch,
  ArrowUpLeft,
} from "lucide-react";
import { dimensionMeta } from "@/lib/assessment/questions";
import { severityLabels, severityOrder } from "@/lib/assessment/severity";
import { healthLabels } from "@/lib/assessment/interpretation";
import type {
  AssessmentResult,
  DiagnosticIssue,
  DimensionDiagnostic,
  FindingSeverity,
  HiddenRisk,
} from "@/lib/assessment/types";
import { fa } from "@/lib/mock-data";
export function SeverityBadge({ severity }: { severity: FindingSeverity }) {
  return (
    <span className={`finding-badge ${severity}`}>
      <i />
      {severityLabels[severity]}
    </span>
  );
}
export function DiagnosticFindingCard({
  finding,
}: {
  finding: DiagnosticIssue;
}) {
  return (
    <article className={`finding-card ${finding.severity}`}>
      <div className="finding-top">
        <span>{dimensionMeta[finding.dimension].label}</span>
        <SeverityBadge severity={finding.severity} />
      </div>
      <h3>{finding.title}</h3>
      <p>{finding.explanation}</p>
      <small>
        پاسخ شما: {fa(finding.answer)} از ۵{" "}
        {finding.critical ? "· پرسش با وزن کلیدی" : ""}
      </small>
    </article>
  );
}
export function StrengthCard({ finding }: { finding: DiagnosticIssue }) {
  return <DiagnosticFindingCard finding={finding} />;
}
export function ScoreInterpretation({
  diagnostic,
}: {
  diagnostic: DimensionDiagnostic;
}) {
  return (
    <div className="score-interpretation">
      <span className={`health-status ${diagnostic.status}`}>
        {healthLabels[diagnostic.status]}
      </span>
      <p>{diagnostic.interpretation}</p>
    </div>
  );
}
export function HiddenRiskCard({ risk }: { risk: HiddenRisk }) {
  return (
    <article className="hidden-risk-card">
      <CircleAlert size={16} />
      <div>
        <h3>{risk.title}</h3>
        <p>{risk.explanation}</p>
        <small>مبنای تشخیص: {risk.evidence.join(" · ")}</small>
      </div>
    </article>
  );
}
export function RecommendedActionCard({
  focus,
  action,
}: {
  focus: string;
  action: string;
}) {
  return (
    <div className="recommended-action">
      <Compass size={20} />
      <div>
        <span>تمرکز پیشنهادی</span>
        <h3>{focus}</h3>
        <p>
          <b>اقدام پیشنهادی: </b>
          {action}
        </p>
      </div>
    </div>
  );
}
export function ExecutiveSummary({ result }: { result: AssessmentResult }) {
  return (
    <section className="executive-summary">
      <div className="report-section-title">
        <span className="report-section-number">۰۲</span>
        <div>
          <div className="eyebrow">EXECUTIVE BRIEF</div>
          <h2>خلاصه مدیریتی</h2>
        </div>
        <FileSearch size={22} />
      </div>
      <div>
        {result.executiveSummary.map((s, i) => (
          <p key={s}>
            <span>{fa(i + 1)}</span>
            {s}
          </p>
        ))}
      </div>
    </section>
  );
}
export function DimensionDiagnosticSection({
  diagnostic,
  index,
}: {
  diagnostic: DimensionDiagnostic;
  index: number;
}) {
  const meta = dimensionMeta[diagnostic.dimension];
  return (
    <section
      className="dimension-diagnostic"
      id={`diagnostic-${diagnostic.dimension}`}
    >
      <header>
        <div className="dimension-title">
          <span className="report-section-number">
            {fa(index + 5).padStart(2, "۰")}
          </span>
          <div>
            <div className="eyebrow">{meta.english} DIAGNOSTIC</div>
            <h2>تشخیص {meta.label}</h2>
          </div>
        </div>
        <div className="dimension-large-score">
          <strong>{fa(Math.round(diagnostic.score))}</strong>
          <span>از ۱۰۰</span>
        </div>
      </header>
      <ScoreInterpretation diagnostic={diagnostic} />
      <div className="working-note">
        <ShieldCheck size={17} />
        <div>
          <h3>آنچه در این محور کار می‌کند</h3>
          <p>{diagnostic.working}</p>
        </div>
      </div>
      <div className="dimension-findings">
        {severityOrder.map((severity) => {
          const found = diagnostic.findings.filter(
            (f) => f.severity === severity,
          );
          return (
            <div key={severity} className="dimension-finding-group">
              <div className="group-label">
                <SeverityBadge severity={severity} />
                <span>{fa(found.length)} مورد</span>
              </div>
              {found.length ? (
                <>
                  <h3>{found[0].title}</h3>
                  <p>{found[0].explanation}</p>
                  <small>پاسخ: {fa(found[0].answer)} از ۵</small>
                  {found.length > 1 && (
                    <a href={`#findings-${severity}`} className="finding-more">
                      مشاهده همه یافته‌های این دسته
                      <ArrowLeft size={12} />
                    </a>
                  )}
                </>
              ) : (
                <p className="empty-finding">
                  {severity === "strength"
                    ? "پاسخ ۵ ثبت نشده؛ عملکرد خوب به‌تنهایی نشانه پایداری کامل نیست."
                    : severity === "critical"
                      ? "در پاسخ‌های این محور مسئله بحرانی شناسایی نشد."
                      : severity === "action"
                        ? "یافته‌ای در سطح نیازمند اقدام شناسایی نشد."
                        : "فرصت مستقلی در این سطح ثبت نشد؛ حفظ و انتقال قابلیت‌ها همچنان بررسی شود."}
                </p>
              )}
            </div>
          );
        })}
      </div>
      <div className="dimension-risk">
        <h3>ریسک مدیریتی در صورت باقی‌ماندن شکاف‌ها</h3>
        {diagnostic.risks.length ? (
          diagnostic.risks.map((r) => <HiddenRiskCard key={r.id} risk={r} />)
        ) : (
          <p>{diagnostic.riskNote}</p>
        )}
      </div>
      <RecommendedActionCard
        focus={diagnostic.focus}
        action={diagnostic.action}
      />
    </section>
  );
}
const categoryTitles: Record<FindingSeverity, string> = {
  critical: "مسائل بحرانی در کسب‌وکار",
  action: "نیازمند اقدام",
  improvement: "فرصت‌های بهبود",
  strength: "نقاط قوتی که باید حفظ شوند",
};
export function FindingsCategory({
  severity,
  findings,
  number,
}: {
  severity: FindingSeverity;
  findings: DiagnosticIssue[];
  number: string;
}) {
  const matching = findings.filter((f) => f.severity === severity);
  return (
    <section
      className={`findings-category ${severity}`}
      id={`findings-${severity}`}
    >
      <div className="report-section-title">
        <span className="report-section-number">{number}</span>
        <div>
          <h2>{categoryTitles[severity]}</h2>
          <p>
            {fa(matching.length)} یافته در سه محور · همه یافته‌ها بر اساس
            پاسخ‌های شما
          </p>
        </div>
        <SeverityBadge severity={severity} />
      </div>
      {matching.length ? (
        <details open={severity === "critical" || severity === "action"}>
          <summary>
            مشاهده {fa(matching.length)} یافته و توضیحات مدیریتی
          </summary>
          <div className="all-findings-grid">
            {matching.map((f) =>
              severity === "strength" ? (
                <StrengthCard key={f.id} finding={f} />
              ) : (
                <DiagnosticFindingCard key={f.id} finding={f} />
              ),
            )}
          </div>
        </details>
      ) : (
        <p className="no-findings">
          {severity === "strength"
            ? "نقطه قوت با پاسخ ۵ ثبت نشده است؛ هدف فعلی، ساخت و تثبیت قابلیت‌های قابل اتکاست."
            : "یافته‌ای در این سطح ثبت نشده است؛ سایر دسته‌ها را برای فرصت‌های بهبود و حفظ کیفیت بررسی کنید."}
        </p>
      )}
    </section>
  );
}
