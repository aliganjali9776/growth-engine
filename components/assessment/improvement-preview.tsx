import { ArrowRight } from "lucide-react";
import { dimensionMeta } from "@/lib/assessment/questions";
import type { AssessmentResult } from "@/lib/assessment/types";
import { fa } from "@/lib/mock-data";
export function ImprovementPreview({
  result,
  onBack,
}: {
  result: AssessmentResult;
  onBack: () => void;
}) {
  const meta = dimensionMeta[result.primaryConstraint];
  return (
    <>
      <div className="report-header">
        <div>
          <div className="eyebrow">FROM DIAGNOSIS TO DIRECTION</div>
          <h1>مسیر پیشنهادی بهبود</h1>
          <p>تمرکز بعدی: {meta.label}</p>
        </div>
        <span className="badge neutral">پیش‌نمایش مسیر</span>
      </div>
      <section className="assessment-panel">
        <h2>{result.recommendation.title}</h2>
        <p className="assessment-description">
          {result.recommendation.description}
        </p>
        <div className="roadmap-steps">
          {meta.roadmap.map((step, i) => (
            <div key={step}>
              <span>{fa(i + 1)}</span>
              <h3>{step}</h3>
              <small>محور پیشنهادی برای بررسی مدیریت</small>
            </div>
          ))}
        </div>
        <p className="assessment-guidance">
          این بخش فقط جهت پیشنهادی را نشان می‌دهد. تعیین اقدامات، مسئول،
          زمان‌بندی و پیگیری برنامه در ساخت‌های بعدی اضافه می‌شود.
        </p>
        <button className="assessment-secondary" onClick={onBack}>
          <ArrowRight size={16} />
          بازگشت به گزارش
        </button>
      </section>
    </>
  );
}
