import type { AgentEvidence } from "@/lib/agent/types";
import type { AgentDiagnosis } from "@/lib/agent/diagnosis/types";
import type { WorkspaceOption } from "@/lib/agent/workspace";
import { businessEvidenceText } from "@/lib/agent/workspace";
export function AdvisorTextBlock({ children }: { children: React.ReactNode }) {
  return (
    <article className="workspace-block">
      <h3>جمع‌بندی مشاور</h3>
      {children}
    </article>
  );
}
export function EvidenceBlock({
  evidence,
  title = "شواهد کلیدی",
}: {
  evidence: AgentEvidence[];
  title?: string;
}) {
  return (
    <details className="workspace-evidence" open>
      <summary>
        {title} ({evidence.length.toLocaleString("fa-IR")})
      </summary>
      {evidence.map((e) => (
        <article key={e.id}>
          <strong>{e.title}</strong>
          <p>{businessEvidenceText(e)}</p>
          {e.timestamp && (
            <small>{new Date(e.timestamp).toLocaleDateString("fa-IR")}</small>
          )}
          {e.route && (
            <a href={e.route} target="_blank" rel="noopener noreferrer">
              مشاهده منبع ↗
            </a>
          )}
        </article>
      ))}
    </details>
  );
}
export function DiagnosisBlock({
  diagnosis,
  onReview,
}: {
  diagnosis: AgentDiagnosis;
  onReview?: () => void;
}) {
  return (
    <article className="workspace-block">
      <small>
        تحلیل مدیریتی ·{" "}
        {diagnosis.needsRefresh ? "نیازمند تازه‌سازی" : "بر اساس شواهد ثبت‌شده"}
      </small>
      <h3>{diagnosis.title}</h3>
      <p>{diagnosis.summary}</p>
      <p>{diagnosis.managementQuestion}</p>
      {onReview && <button onClick={onReview}>بررسی این تحلیل</button>}
    </article>
  );
}
export function RecommendationBlock({
  option,
  selected,
  onSelect,
  onPrepare,
  onDismiss,
}: {
  option: WorkspaceOption;
  selected: boolean;
  onSelect: () => void;
  onPrepare: () => void;
  onDismiss: () => void;
}) {
  return (
    <article className={`workspace-block ${selected ? "selected" : ""}`}>
      <h3>{option.title}</h3>
      <p>{option.targetLabel}</p>
      <p>{option.why}</p>
      <div className="workspace-buttons">
        <button aria-pressed={selected} onClick={onSelect}>
          بررسی گزینه
        </button>
        <button onClick={onPrepare}>آماده‌سازی این گزینه</button>
        <button className="secondary" onClick={onDismiss}>
          کنار گذاشتن
        </button>
      </div>
    </article>
  );
}
export function ActionDraftBlock({ children }: { children: React.ReactNode }) {
  return (
    <section className="workspace-action" aria-label="پیش‌نویس و بررسی اقدام">
      {children}
    </section>
  );
}
export function ApprovalBlock() {
  return (
    <p className="workspace-safety">
      تأیید و اجرا دو تصمیم جدا هستند؛ دستور متنی جایگزین دکمه تأیید صریح نیست.
    </p>
  );
}
export function ExecutionResultBlock({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section className="workspace-block" aria-label="نتیجه اجرای اقدام">
      <h3>ثبت تغییر تأیید شد</h3>
      <p>
        موفقیت اجرا یعنی اعمال تغییر؛ نتیجه کسب‌وکار هنوز باید با شواهد آینده
        بررسی شود.
      </p>
      {children}
    </section>
  );
}
export function DataGapBlock({ gaps }: { gaps: string[] }) {
  return gaps.length ? (
    <section className="workspace-block">
      <h3>داده‌های مورد نیاز</h3>
      {gaps.map((g) => (
        <p key={g}>{g}</p>
      ))}
    </section>
  ) : null;
}
export function RelationshipBlock({
  refs,
}: {
  refs: { label?: string; route?: string }[];
}) {
  return refs.length ? (
    <section className="workspace-block">
      <h3>ارتباط‌های ثبت‌شده</h3>
      <ul>
        {refs.map((r, i) => (
          <li key={i}>
            {r.route ? (
              <a href={r.route} target="_blank" rel="noopener noreferrer">
                {r.label ?? "مشاهده موضوع مرتبط"} ↗
              </a>
            ) : (
              r.label
            )}
          </li>
        ))}
      </ul>
      <small>فقط ارتباط‌های موجود در داده‌ها نمایش داده می‌شود.</small>
    </section>
  ) : null;
}
