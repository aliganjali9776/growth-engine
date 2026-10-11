"use client";
import { businessStorage } from "@/lib/saas/workspace-storage";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Drawer } from "@/components/system/ui";
import { AdvisorNavigation } from "./navigation";
import {
  preparationContext,
  findEntity,
  type PreparationContext,
} from "@/lib/agent/preparation/context";
import {
  AgentDraftTemplateRegistry,
  template,
  getField,
} from "@/lib/agent/preparation/templates";
import {
  generateRecommendation,
  createPlan,
  prepareDraft,
  editDraft,
  validateDraft,
  rebuildPreview,
  requestApproval,
  approveDraft,
  rejectDraft,
  archiveDraft,
  markRecommendations,
  preparationIntent,
} from "@/lib/agent/preparation/engine";
import { readPreparation, savePreparation } from "@/lib/preparation-storage";
import {
  emptyPreparation,
  type PreparationState,
  type PreparedAction,
  type TemplateId,
  type PreparedRecommendation,
} from "@/lib/agent/preparation/types";
import "./advisor.css";
import "./actions.css";
import { compareDrafts } from "@/lib/agent/preparation/wording";
import { validateAgentProposedAction } from "@/lib/agent/preparation/validation";
import {
  ExecutionPanel,
  ExecutionHistory,
  useExecutions,
  executionDisposition,
} from "./execution";
const risks = { Low: "کم", Medium: "متوسط", High: "بالا", Critical: "بحرانی" };
const status = {
  Draft: "پیش‌نویس",
  ReadyForApproval: "در انتظار تأیید",
  Approved: "تأیید مفهومی",
  Rejected: "ردشده",
  Archived: "آرشیو",
  NeedsReview: "نیازمند بازبینی",
  ReadyToExecute: "آماده اجرا",
  Executing: "در حال اجرا",
  Executed: "اجراشده",
  ExecutionFailed: "اجرای ناموفق",
  Stale: "نیازمند بازبینی",
  Cancelled: "لغوشده",
};
const validity = {
  Valid: "کامل و معتبر",
  NeedsInput: "نیازمند اطلاعات شما",
  Stale: "منبع تغییر کرده",
  Invalid: "نیازمند اصلاح",
};
function usePreparation() {
  const [state, setState] = useState<PreparationState>(emptyPreparation),
    [context, setContext] = useState<PreparationContext | null>(null),
    [error, setError] = useState(""),
    [loaded, setLoaded] = useState(false);
  const refresh = useCallback(() => {
    const r = readPreparation(businessStorage);
    const context = preparationContext(businessStorage);
    for (const action of r.state.actions) {
      const validation = validateAgentProposedAction(action, r.state, context);
      if (
        validation.status === "Stale" &&
        ![
          "Rejected",
          "Archived",
          "Executed",
          "Executing",
          "Cancelled",
        ].includes(action.status)
      ) {
        action.validation = validation;
        action.status = "NeedsReview";
      }
    }
    markRecommendations(r.state, context);
    setState(r.state);
    setContext(context);
    setError(r.error ?? "");
    setLoaded(true);
  }, []);
  useEffect(() => {
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("preparation-saved", refresh);
    window.addEventListener("execution-saved", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("preparation-saved", refresh);
      window.removeEventListener("execution-saved", refresh);
    };
  }, [refresh]);
  function commit<T>(
    fn: (s: PreparationState, c: PreparationContext) => T,
  ): T | undefined {
    try {
      const r = readPreparation(businessStorage);
      if (r.error) throw Error(r.error);
      const c = preparationContext(businessStorage),
        next = structuredClone(r.state);
      markRecommendations(next, c);
      const result = fn(next, c);
      savePreparation(businessStorage, next, r.raw);
      setState(next);
      setContext(c);
      setError("");
      window.dispatchEvent(new Event("preparation-saved"));
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : "ذخیره انجام نشد.");
      return undefined;
    }
  }
  return { state, context, error, loaded, commit };
}
function Evidence({ ids, state }: { ids: string[]; state: PreparationState }) {
  return (
    <details className="preparation-evidence">
      <summary>شواهد تصمیم ({ids.length.toLocaleString("fa-IR")})</summary>
      {ids.map((id) => {
        const e = state.evidence.find((e) => e.id === id);
        return e ? (
          <article key={id}>
            <strong>{e.title}</strong>
            <p>{e.summary}</p>
            <small>
              {new Date(e.timestamp ?? e.createdAt).toLocaleString("fa-IR")} ·
              اطمینان {e.confidence ? risks[e.confidence] : "نامشخص"}
            </small>
            {e.route && <Link href={e.route}>مشاهده منبع</Link>}
          </article>
        ) : (
          <p key={id}>شاهد در دسترس نیست.</p>
        );
      })}
    </details>
  );
}
export function RecommendationsPanel({ diagnosisId }: { diagnosisId: string }) {
  const { state, context, error, commit } = usePreparation(),
    router = useRouter();
  const r = state.recommendations
    .filter((r) => r.diagnosisId === diagnosisId)
    .at(-1);
  function prepare(r: PreparedRecommendation, optionId: string) {
    const o = r.actionOptions.find((o) => o.id === optionId)!;
    const a = commit((s, c) =>
      prepareDraft(s, c, {
        templateId: o.templateId,
        diagnosisId,
        recommendationId: r.id,
        optionId,
      }),
    );
    if (a) router.push("/advisor/actions/" + a.id);
  }
  return (
    <section className="preparation-panel">
      <h2>اقدام بعدی پیشنهادی</h2>
      <p>
        گزینه‌ها را مقایسه کنید و فقط اقدام انتخابی را برای بررسی آماده کنید.
      </p>
      {error && (
        <p role="alert" className="preparation-error">
          {error}
        </p>
      )}
      <div className="preparation-buttons">
        <button
          onClick={() =>
            commit((s, c) => generateRecommendation(s, c, diagnosisId))
          }
        >
          تولید پیشنهادهای اقدام
        </button>
        <button
          className="secondary"
          onClick={() => {
            const p = commit((s, c) => createPlan(s, c, diagnosisId));
            if (p) router.push("/advisor/actions");
          }}
        >
          آماده‌سازی برنامه مرحله‌ای
        </button>
      </div>
      {r && (
        <>
          <p className="preparation-primary">
            <strong>دلیل گزینه اصلی: </strong>
            {r.primaryReason}
          </p>
          <p>
            اطمینان پیشنهاد: {risks[r.confidence]} · کامل‌بودن پیش‌نویس پس از
            انتخاب جداگانه سنجیده می‌شود.
          </p>
          {r.status === "PotentiallyStale" && (
            <p role="status">این پیشنهاد نیازمند تازه‌سازی است.</p>
          )}
          <div className="preparation-options">
            {r.actionOptions.map((o) => (
              <article key={o.id}>
                <span className="preparation-tag">
                  {o.recommended ? "گزینه اصلی" : "گزینه جایگزین"} · ریسک{" "}
                  {risks[o.riskLevel]}
                </span>
                <h3>{o.title}</h3>
                <p>{o.description}</p>
                <p>اثر مورد انتظار: {o.expectedImpact}</p>
                <p>
                  تلاش:{" "}
                  {o.effort === "Low"
                    ? "کم"
                    : o.effort === "High"
                      ? "زیاد"
                      : "متوسط"}{" "}
                  · افق: {o.timeHorizon === "Immediate" ? "اکنون" : "این هفته"}
                </p>
                {o.prerequisites.map((p) => (
                  <p key={p}>پیش‌نیاز: {p}</p>
                ))}
                <button
                  disabled={!context || r.status === "PotentiallyStale"}
                  onClick={() => prepare(r, o.id)}
                >
                  آماده‌سازی اقدام
                </button>
              </article>
            ))}
          </div>
          <Evidence ids={r.evidenceIds} state={state} />
        </>
      )}
    </section>
  );
}
export function PreparationRequestPanel() {
  const { context, error, commit } = usePreparation(),
    router = useRouter(),
    [text, setText] = useState(""),
    [type, setType] = useState<TemplateId>("Experiment"),
    [target, setTarget] = useState("");
  const t = template(type),
    options =
      context?.entities.filter((e) => e.ref.entityType === t.targetType) ?? [];
  return (
    <section className="preparation-panel">
      <h2>آماده‌سازی به درخواست شما</h2>
      <p>
        مثلاً «برای این مشکل یک آزمایش آماده کن». موضوع را صریح انتخاب کنید؛ این
        درخواست چیزی را اجرا نمی‌کند.
      </p>
      <label>
        درخواست آماده‌سازی
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            const intent = preparationIntent(e.target.value);
            if (intent) {
              setType(intent);
              setTarget("");
            }
          }}
          placeholder="برای این مشکل یک آزمایش آماده کن"
        />
      </label>
      <div className="preparation-form">
        <label>
          نوع پیشنهاد
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value as TemplateId);
              setTarget("");
            }}
          >
            {AgentDraftTemplateRegistry.filter((t) => t.targetType).map((t) => (
              <option value={t.id} key={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          موضوع مشخص
          <select value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">انتخاب کنید؛ حدس زده نمی‌شود</option>
            {options.map((e) => (
              <option key={e.ref.entityId} value={e.ref.entityId}>
                {e.ref.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && (
        <p role="alert" className="preparation-error">
          {error}
        </p>
      )}
      <button
        disabled={!target || (!!text && !preparationIntent(text))}
        onClick={() => {
          const a = commit((s, c) =>
            prepareDraft(s, c, {
              templateId: type,
              targetEntityId: target,
              origin: "AdvisorRequest",
              reason: text || "درخواست صریح مدیر برای بررسی پیشنهاد",
            }),
          );
          if (a) router.push("/advisor/actions/" + a.id);
        }}
      >
        آماده‌سازی پیش‌نویس
      </button>
      {text && !preparationIntent(text) && (
        <p>
          این بخش فقط درخواست آماده‌سازی مشخص را می‌پذیرد؛ متن را با «آماده کن»
          یا «پیشنهادی بساز» بنویسید.
        </p>
      )}
    </section>
  );
}
function Preview({
  a,
  context,
}: {
  a: PreparedAction;
  context: PreparationContext;
}) {
  const t = template(a.templateId),
    current = a.currentStateSnapshot[
      `${t.domain}:${t.targetType}:${a.targetEntityId}`
    ] as Record<string, unknown> | undefined;
  function value(v: unknown, path: string) {
    if (v === null || v === undefined || v === "")
      return "نامشخص / نیازمند ورودی";
    const field = a.fields.find((f) => f.path === path);
    if (field?.entityType)
      return (
        findEntity(context, field.entityType, String(v))?.ref.label ?? String(v)
      );
    if (typeof v === "number") return v.toLocaleString("fa-IR");
    return String(v);
  }
  return (
    <section className="preparation-panel">
      <h2>پیش‌نمایش تغییر کسب‌وکار</h2>
      <p>
        {[
          "OwnerChange",
          "KRTargetChange",
          "ConstraintUpdate",
          "CancelObjective",
          "SOPChange",
        ].includes(a.templateId)
          ? "تغییر پیشنهادی در موضوع موجود"
          : a.status === "Executed"
            ? "پیش‌نمایش مصوب این رکورد؛ نتیجه اجرای واقعی در بخش اجرا نمایش داده می‌شود."
            : "ایجاد پیشنهادی؛ هنوز هیچ رکوردی در کسب‌وکار ایجاد نشده است."}
      </p>
      <div className="preparation-preview">
        <article>
          <h3>وضعیت فعلی</h3>
          {current ? (
            <>
              <p>{String(current.name ?? current.title ?? t.title)}</p>
              {a.fields
                .filter(
                  (f) =>
                    Object.hasOwn(current, f.path) || f.path === "targetValue",
                )
                .map((f) => (
                  <p key={f.path}>
                    <strong>{f.label}: </strong>
                    {value(current[f.path], f.path)}
                  </p>
                ))}
              <p>
                وضعیت:{" "}
                {(
                  {
                    active: "فعال",
                    draft: "پیش‌نویس",
                    proposed: "پیشنهادی",
                    candidate: "کاندید",
                    review: "در بازبینی",
                    completed: "تکمیل‌شده",
                    cancelled: "لغوشده",
                    archived: "آرشیو",
                    prepare: "نیازمند آماده‌سازی",
                  } as Record<string, string>
                )[String(current.status ?? current.lifecycle)] ?? "ثبت‌شده"}
              </p>
            </>
          ) : (
            <p>موضوع جدید یا یادداشت مدیریتی؛ وضعیت موجود ندارد.</p>
          )}
        </article>
        <article>
          <h3>وضعیت پیشنهادی</h3>
          {a.fields.map((f) => (
            <p key={f.path}>
              <strong>{f.label}: </strong>
              {value(getField(a.payload, f.path), f.path)}
            </p>
          ))}
        </article>
      </div>
      <p className="preparation-safety">
        این پیش‌نمایش فقط تغییر پیشنهادی را نشان می‌دهد؛ تأیید آن هیچ داده‌ای را
        تغییر نمی‌دهد.
      </p>
    </section>
  );
}
export function ActionsPage({
  id,
  debug = false,
  embedded = false,
  onSelectAction,
  workspaceIntent,
}: {
  id?: string;
  debug?: boolean;
  embedded?: boolean;
  onSelectAction?: (id: string) => void;
  workspaceIntent?: { kind: "approve" | "execute" | "reject"; nonce: number };
}) {
  const { state, context, error, loaded, commit } = usePreparation(),
    router = useRouter(),
    [changes, setChanges] = useState<Record<string, unknown>>({}),
    [reason, setReason] = useState(""),
    [filter, setFilter] = useState(""),
    [notice, setNotice] = useState(""),
    [comparison, setComparison] = useState("");
  const a = state.actions.find((a) => a.id === id),
    dirty = !!Object.keys(changes).length;
  const executions = useExecutions();
  const [decisionDialog, setDecisionDialog] = useState<
    "approve" | "reject" | null
  >(null);
  useEffect(() => {
    if (
      workspaceIntent?.kind === "approve" ||
      workspaceIntent?.kind === "reject"
    )
      setDecisionDialog(workspaceIntent.kind);
  }, [workspaceIntent?.nonce]);
  const locked =
    !!a &&
    ["Executed", "Executing"].includes(
      executionDisposition(a, executions.state),
    );
  useEffect(() => {
    if (locked) setNotice("");
  }, [locked]);
  useEffect(() => {
    setChanges({});
  }, [id]);
  useEffect(() => {
    setNotice("");
    setComparison("");
  }, [id]);
  useEffect(() => {
    if (id && context && state.actions.some((a) => a.id === id))
      commit((s, c) => validateDraft(s, c, id));
  }, [id, context?.version]);
  function operation(
    fn: (s: PreparationState, c: PreparationContext) => unknown,
    message: string,
  ) {
    const result = commit((s, c) => {
      fn(s, c);
      return true;
    });
    if (result) {
      setNotice(message);
      setChanges({});
    }
  }
  function changeField(path: string, value: unknown) {
    setChanges((previous) => ({ ...previous, [path]: value }));
  }
  const groups: [string, (a: PreparedAction) => boolean][] = [
    [
      "نیازمند اطلاعات شما",
      (a) =>
        ["Draft", "NeedsReview"].includes(a.status) &&
        !["Stale"].includes(a.validation.status) &&
        a.validation.status !== "Valid",
    ],
    [
      "آماده بررسی",
      (a) =>
        ["Draft", "NeedsReview"].includes(a.status) &&
        a.validation.status === "Valid",
    ],
    ["در انتظار تأیید", (a) => a.status === "ReadyForApproval"],
    [
      "آماده اجرا",
      (a) => executionDisposition(a, executions.state) === "ReadyToExecute",
    ],
    [
      "تأیید مفهومی — آماده‌سازی فقط",
      (a) => executionDisposition(a, executions.state) === "Approved",
    ],
    [
      "اجراشده",
      (a) => executionDisposition(a, executions.state) === "Executed",
    ],
    [
      "اجرای ناموفق یا نیازمند بازیابی",
      (a) =>
        ["ExecutionFailed", "Executing"].includes(
          executionDisposition(a, executions.state),
        ),
    ],
    [
      "منبع تغییر کرده — نیازمند بازبینی",
      (a) => executionDisposition(a, executions.state) === "Stale",
    ],
    ["ردشده", (a) => a.status === "Rejected"],
    ["آرشیو", (a) => a.status === "Archived"],
  ];
  return (
    <div className="advisor-page preparation-page">
      {!embedded && <AdvisorNavigation />}
      {!embedded && (
        <header className="advisor-heading">
          <div>
            <span className="advisor-eyebrow">
              GROWTH ENGINE · ACTION REVIEW
            </span>
            <h1>{id ? "بررسی اقدام پیشنهادی" : "اقدامات پیشنهادی"}</h1>
            <p>از تشخیص تا تصمیم قابل بررسی، با اختیار کامل شما.</p>
          </div>
          {id && (
            <Link className="button secondary" href="/advisor/actions">
              همه اقدامات
            </Link>
          )}
        </header>
      )}
      <p className="preparation-safety">
        تأیید به معنی اجرا نیست؛ تغییر کسب‌وکار فقط با اجرای صریح شما انجام
        می‌شود.
      </p>
      {!embedded && (
        <Link href="/advisor/actions/history">تاریخچه اجرای اقدامات</Link>
      )}
      {error && (
        <p role="alert" className="preparation-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="preparation-notice">
          {notice}
        </p>
      )}
      {decisionDialog && a && context && (
        <Drawer
          open
          onClose={() => setDecisionDialog(null)}
          title={decisionDialog === "approve" ? "تأیید پیشنهاد" : "رد پیشنهاد"}
          description="تصمیم شما فقط با دکمه صریح ثبت می‌شود؛ تأیید به معنی اجرا نیست."
        >
          <p>
            {a.title} · ریسک {risks[a.risk]} · نسخه{" "}
            {a.revision.toLocaleString("fa-IR")}
          </p>
          <Preview a={a} context={context} />
          {decisionDialog === "approve" ? (
            <>
              <button
                disabled={
                  dirty ||
                  locked ||
                  a.validation.status !== "Valid" ||
                  !["Draft", "NeedsReview"].includes(a.status)
                }
                onClick={() =>
                  operation(
                    (s, c) => requestApproval(s, c, a.id),
                    "درخواست تأیید ثبت شد.",
                  )
                }
              >
                درخواست تأیید
              </button>
              <button
                disabled={dirty || locked || a.status !== "ReadyForApproval"}
                onClick={() => {
                  operation(
                    (s, c) => approveDraft(s, c, a.id),
                    "تأیید ثبت شد؛ هنوز اجرا نشده است.",
                  );
                  setDecisionDialog(null);
                }}
              >
                تأیید صریح پیشنهاد
              </button>
            </>
          ) : (
            <>
              <label>
                دلیل رد پیشنهاد
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={2000}
                />
              </label>
              <button
                disabled={!reason.trim() || locked}
                onClick={() => {
                  operation(
                    (s) => rejectDraft(s, a.id, reason),
                    "پیشنهاد رد شد.",
                  );
                  setDecisionDialog(null);
                }}
              >
                ثبت رد پیشنهاد
              </button>
            </>
          )}
          <button className="secondary" onClick={() => setDecisionDialog(null)}>
            انصراف
          </button>
        </Drawer>
      )}
      {!loaded ? (
        <p>در حال خواندن پیشنهادهای محلی…</p>
      ) : id ? (
        !a || !context ? (
          <section className="preparation-panel">
            <h2>اقدام پیدا نشد</h2>
            <p>این پیشنهاد در مرورگر فعلی ذخیره نشده است.</p>
            <Link href="/advisor/actions">بازگشت به اقدامات</Link>
          </section>
        ) : (
          <>
            <fieldset className="execution-lock" disabled={locked}>
              <section
                className="preparation-panel"
                data-workspace-decision={workspaceIntent?.kind}
              >
                <span className="preparation-tag">
                  {status[a.status]} · ریسک {risks[a.risk]} ·{" "}
                  {validity[a.validation.status]}
                </span>
                <h2>{a.title}</h2>
                <p>
                  <strong>چرا این تغییر؟ </strong>
                  {a.rationale}
                </p>
                <p>
                  <strong>اثر مورد انتظار: </strong>
                  {a.expectedImpact}
                </p>
                <p>
                  برگشت‌پذیری:{" "}
                  {
                    {
                      Easy: "آسان",
                      Moderate: "متوسط",
                      Difficult: "دشوار",
                      Irreversible: "برگشت‌ناپذیر",
                    }[a.reversibility]
                  }{" "}
                  · تکمیل اطلاعات:{" "}
                  {a.validation.completeness.toLocaleString("fa-IR")}٪
                </p>
                {a.sourceDiagnosisId && (
                  <Link href={"/advisor/insights/" + a.sourceDiagnosisId}>
                    مشاهده تحلیل مبنا
                  </Link>
                )}
              </section>
              <Evidence ids={a.evidenceIds} state={state} />
              <Preview a={a} context={context} />
              {state.actions.some(
                (b) => b.id !== a.id && b.dedupKey === a.dedupKey,
              ) && (
                <section className="preparation-panel">
                  <h2>مقایسه نسخه‌های پیشنهادی</h2>
                  <label>
                    نسخه جایگزین
                    <select
                      value={comparison}
                      onChange={(e) => setComparison(e.target.value)}
                    >
                      <option value="">انتخاب کنید</option>
                      {state.actions
                        .filter(
                          (b) => b.id !== a.id && b.dedupKey === a.dedupKey,
                        )
                        .map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.title} · نسخه{" "}
                            {b.revision.toLocaleString("fa-IR")}
                          </option>
                        ))}
                    </select>
                  </label>
                  {comparison &&
                    state.actions.some((b) => b.id === comparison) && (
                      <>
                        {compareDrafts(
                          a,
                          state.actions.find((b) => b.id === comparison)!,
                        ).fields.length ? (
                          compareDrafts(
                            a,
                            state.actions.find((b) => b.id === comparison)!,
                          ).fields.map((f) => (
                            <div className="preparation-preview" key={f.path}>
                              <p>
                                <strong>
                                  {
                                    a.fields.find((x) => x.path === f.path)
                                      ?.label
                                  }
                                  :{" "}
                                </strong>
                                {String(f.left ?? "نامشخص")}
                              </p>
                              <p>
                                <strong>نسخه جایگزین: </strong>
                                {String(f.right ?? "نامشخص")}
                              </p>
                            </div>
                          ))
                        ) : (
                          <p>مقادیر قابل ویرایش این دو نسخه یکسان‌اند.</p>
                        )}
                      </>
                    )}
                </section>
              )}
              <section className="preparation-panel">
                <h2>اطلاعات لازم و ویرایش پیشنهاد</h2>
                <p>
                  مقادیر نامشخص نیازمند تصمیم شما هستند. ویرایش، تأیید قبلی را
                  باطل می‌کند.
                </p>
                <div className="preparation-form">
                  {a.fields.map((f) => {
                    const v = Object.hasOwn(changes, f.path)
                      ? changes[f.path]
                      : getField(a.payload, f.path);
                    const disabled = ["Rejected", "Archived"].includes(
                      a.status,
                    );
                    return (
                      <label key={f.path}>
                        {f.label}
                        {f.required ? " *" : ""}
                        <small>
                          {f.source === "UserEdited"
                            ? "ویرایش شما"
                            : "پیشنهاد مشاور"}{" "}
                          ·{" "}
                          {
                            {
                              Resolved: "تکمیل‌شده",
                              Suggested: "پیشنهادی",
                              NeedsUserInput: "ورودی شما لازم است",
                              Invalid: "نامعتبر",
                            }[f.state]
                          }
                        </small>
                        {f.kind === "entity" ||
                        f.kind === "role" ||
                        f.kind === "select" ? (
                          <select
                            disabled={disabled}
                            value={v === false ? "false" : String(v ?? "")}
                            onChange={(e) =>
                              changeField(f.path, e.target.value)
                            }
                          >
                            <option value="">انتخاب کنید</option>
                            {(f.entityType
                              ? context.entities
                                  .filter(
                                    (e) => e.ref.entityType === f.entityType,
                                  )
                                  .map((e) => ({
                                    id: e.ref.entityId,
                                    label: e.ref.label ?? e.ref.entityId,
                                  }))
                              : (f.choices ?? [])
                            ).map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        ) : f.kind === "text" ? (
                          <textarea
                            disabled={disabled}
                            value={String(v ?? "")}
                            onChange={(e) =>
                              changeField(f.path, e.target.value)
                            }
                            maxLength={2000}
                            rows={f.path.includes("title") ? 2 : 3}
                          />
                        ) : (
                          <input
                            disabled={disabled}
                            type={f.kind === "date" ? "date" : "number"}
                            step="any"
                            value={
                              v === null || v === undefined ? "" : String(v)
                            }
                            onInput={(e) =>
                              changeField(
                                f.path,
                                f.kind === "number"
                                  ? e.currentTarget.value === ""
                                    ? null
                                    : Number(e.currentTarget.value)
                                  : e.currentTarget.value,
                              )
                            }
                            onChange={(e) =>
                              setChanges((previous) => ({
                                ...previous,
                                [f.path]:
                                  f.kind === "number"
                                    ? e.target.value === ""
                                      ? null
                                      : Number(e.target.value)
                                    : e.target.value,
                              }))
                            }
                          />
                        )}
                      </label>
                    );
                  })}
                </div>
                <button
                  disabled={!dirty}
                  onClick={() =>
                    operation(
                      (s, c) => editDraft(s, c, a.id, changes),
                      "ویرایش شما و یک نسخه جدید ذخیره شد.",
                    )
                  }
                >
                  ذخیره ویرایش
                </button>
              </section>
              <section className="preparation-panel">
                <h2>اعتبارسنجی، ریسک و پیش‌نیازها</h2>
                <p>{validity[a.validation.status]}</p>
                {a.validation.missing.map((x) => (
                  <p className="preparation-error" key={x}>
                    ورودی لازم: {x}
                  </p>
                ))}
                {a.validation.errors.map((x) => (
                  <p className="preparation-error" key={x}>
                    {x}
                  </p>
                ))}
                {[...new Set([...a.assumptions, ...a.validation.warnings])].map(
                  (x) => (
                    <p key={x}>{x}</p>
                  ),
                )}
                {a.dependencyIds.map((dep) => {
                  const p = state.plans.find((p) =>
                      p.dependencies.some((d) => d.id === dep),
                    ),
                    d = p?.dependencies.find((d) => d.id === dep);
                  return <p key={dep}>پیش‌نیاز: {d?.condition}</p>;
                })}
                <div className="preparation-buttons">
                  <button
                    disabled={dirty}
                    onClick={() =>
                      operation(
                        (s, c) => validateDraft(s, c, a.id),
                        "اعتبارسنجی با منابع فعلی انجام شد.",
                      )
                    }
                  >
                    بررسی با داده‌های فعلی
                  </button>
                  <button
                    disabled={
                      dirty || ["Rejected", "Archived"].includes(a.status)
                    }
                    className="secondary"
                    onClick={() =>
                      operation(
                        (s, c) => rebuildPreview(s, c, a.id),
                        "پیش‌نمایش بازسازی شد؛ ویرایش‌های شما حفظ شدند.",
                      )
                    }
                  >
                    بازسازی پیش‌نمایش
                  </button>
                </div>
              </section>
              <section className="preparation-panel">
                <h2>تصمیم شما</h2>
                {a.status === "Approved" ? (
                  <p className="preparation-notice">
                    این اقدام تأیید شده اما هنوز اجرا نشده است.
                  </p>
                ) : (
                  <p>
                    تأیید از اجرای تغییر جداست؛ ابتدا پیشنهاد را بررسی کنید.
                  </p>
                )}
                <div className="preparation-buttons">
                  <button
                    disabled={
                      dirty ||
                      a.validation.status !== "Valid" ||
                      !["Draft", "NeedsReview"].includes(a.status)
                    }
                    onClick={() =>
                      operation(
                        (s, c) => requestApproval(s, c, a.id),
                        "درخواست تأیید ایجاد شد؛ پیش‌نمایش را بررسی کنید.",
                      )
                    }
                  >
                    درخواست تأیید
                  </button>
                  <button
                    disabled={dirty || a.status !== "ReadyForApproval"}
                    onClick={() =>
                      operation(
                        (s, c) => approveDraft(s, c, a.id),
                        "این اقدام تأیید شده اما هنوز اجرا نشده است.",
                      )
                    }
                  >
                    تأیید برای اجرا
                  </button>
                </div>
                <label>
                  دلیل رد پیشنهاد
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                    maxLength={2000}
                  />
                </label>
                <div className="preparation-buttons">
                  <button
                    className="secondary"
                    disabled={
                      !reason.trim() ||
                      ["Rejected", "Archived"].includes(a.status)
                    }
                    onClick={() =>
                      operation(
                        (s) => rejectDraft(s, a.id, reason),
                        "پیشنهاد رد شد؛ داده کسب‌وکار تغییر نکرد.",
                      )
                    }
                  >
                    رد کردن
                  </button>
                  <button
                    className="secondary"
                    disabled={a.status === "Archived"}
                    onClick={() =>
                      operation(
                        (s) => archiveDraft(s, a.id),
                        "پیشنهاد آرشیو شد.",
                      )
                    }
                  >
                    آرشیو پیشنهاد
                  </button>
                  <button
                    className="secondary"
                    onClick={() => {
                      const variant = commit((s, c) =>
                        prepareDraft(s, c, {
                          templateId: a.templateId,
                          targetEntityId: a.targetEntityId,
                          diagnosisId: a.sourceDiagnosisId,
                          variant: true,
                          origin: "Manual",
                        }),
                      );
                      if (variant)
                        onSelectAction
                          ? onSelectAction(variant.id)
                          : router.push("/advisor/actions/" + variant.id);
                    }}
                  >
                    ساخت نسخه جایگزین
                  </button>
                </div>
              </section>
              <section className="preparation-panel">
                <h2>تاریخچه نسخه‌ها</h2>
                {state.revisions
                  .filter((r) => r.actionId === a.id)
                  .slice()
                  .reverse()
                  .map((r) => (
                    <details key={r.id}>
                      <summary>
                        نسخه {r.revision.toLocaleString("fa-IR")} ·{" "}
                        {r.source === "User"
                          ? "ویرایش شما"
                          : "آماده‌سازی مشاور"}{" "}
                        · {new Date(r.changedAt).toLocaleString("fa-IR")}
                      </summary>
                      <p>
                        {r.changedFields
                          .map(
                            (p) =>
                              a.fields.find((f) => f.path === p)?.label ??
                              "پیش‌نمایش",
                          )
                          .join("، ")}
                      </p>
                    </details>
                  ))}
              </section>
            </fieldset>
            <ExecutionPanel
              a={a}
              preparation={state}
              context={context}
              dirty={dirty}
              intentRequest={
                workspaceIntent?.kind === "execute"
                  ? workspaceIntent.nonce
                  : undefined
              }
            />
          </>
        )
      ) : (
        <>
          <PreparationRequestPanel />
          <section className="preparation-panel">
            <label>
              جست‌وجوی پیشنهادها
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="عنوان یا موضوع"
              />
            </label>
            <p>
              {state.actions.length.toLocaleString("fa-IR")} پیش‌نویس ذخیره‌شده
              در این مرورگر
            </p>
          </section>
          {groups.map(([label, predicate]) => {
            const items = state.actions
              .filter(predicate)
              .filter((a) => a.title.includes(filter));
            return (
              <section className="preparation-group" key={label}>
                <h2>
                  {label}{" "}
                  <small>({items.length.toLocaleString("fa-IR")})</small>
                </h2>
                {!items.length ? (
                  <p className="muted">موردی ثبت نشده است.</p>
                ) : (
                  <div className="preparation-options">
                    {items
                      .slice(-100)
                      .reverse()
                      .map((a) => (
                        <article key={a.id}>
                          <span className="preparation-tag">
                            ریسک {risks[a.risk]} ·{" "}
                            {validity[a.validation.status]}
                          </span>
                          <h3>
                            <Link href={"/advisor/actions/" + a.id}>
                              {a.title}
                            </Link>
                          </h3>
                          <p>{a.expectedImpact}</p>
                          <p>چرا: {a.rationale}</p>
                          <p>
                            {a.validation.missing.length
                              ? `اطلاعات لازم: ${a.validation.missing.join("، ")}`
                              : "اطلاعات تکمیل شده است."}
                          </p>
                          <Link href={"/advisor/actions/" + a.id}>
                            بررسی تغییر پیشنهادی ←
                          </Link>
                        </article>
                      ))}
                  </div>
                )}
              </section>
            );
          })}
          <section className="preparation-panel">
            <h2>برنامه‌های مرحله‌ای</h2>
            {state.plans.length ? (
              state.plans.map((p) => (
                <article key={p.id}>
                  <h3>{p.title}</h3>
                  <p>{p.objective}</p>
                  <ol>
                    {p.steps.map((step) => (
                      <li key={step.id}>
                        <strong>{step.title}</strong>
                        <p>
                          {(() => {
                            const result = executions.state.records.find(
                              (r) => r.actionId === step.proposedActionId,
                            );
                            if (result?.status === "Succeeded")
                              return "اجراشده";
                            if (result?.status === "RolledBack")
                              return "بازگردانی‌شده؛ پیش‌نیاز تکمیل نیست";
                            const blocked = step.dependencyIds.some((id) => {
                              const dep = p.dependencies.find(
                                  (d) => d.id === id,
                                ),
                                previous = p.steps.find(
                                  (x) => x.id === dep?.fromStepId,
                                );
                              return !executions.state.records.some(
                                (r) =>
                                  r.actionId === previous?.proposedActionId &&
                                  r.status === "Succeeded",
                              );
                            });
                            return blocked
                              ? "مسدود تا اجرای گام پیش‌نیاز"
                              : step.proposedActionId
                                ? "آماده بررسی جداگانه"
                                : "در انتظار آماده‌سازی";
                          })()}
                        </p>
                        <p>{step.completionCondition}</p>
                        {step.proposedActionId ? (
                          <Link
                            href={"/advisor/actions/" + step.proposedActionId}
                          >
                            بررسی پیش‌نویس این گام
                          </Link>
                        ) : (
                          <button
                            onClick={() => {
                              const a = commit((s, c) =>
                                prepareDraft(s, c, {
                                  templateId: step.templateId,
                                  diagnosisId: p.diagnosisId,
                                  planId: p.id,
                                  stepId: step.id,
                                }),
                              );
                              if (a) router.push("/advisor/actions/" + a.id);
                            }}
                          >
                            آماده‌سازی این گام
                          </button>
                        )}
                      </li>
                    ))}
                  </ol>
                  <p>هر گام نیازمند تأیید جداگانه است.</p>
                </article>
              ))
            ) : (
              <p>از صفحه جزئیات تحلیل، برنامه مرحله‌ای آماده کنید.</p>
            )}
          </section>
        </>
      )}
      {debug && (
        <section className="preparation-panel">
          <h2>Preparation debug · BUILD 6D</h2>
          <pre dir="ltr">
            {JSON.stringify(
              {
                templates: AgentDraftTemplateRegistry,
                recommendations: state.recommendations,
                plans: state.plans,
                actions: state.actions,
                validation: state.actions.map((a) => ({
                  id: a.id,
                  ...a.validation,
                })),
                approvals: state.approvals,
                revisions: state.revisions,
                audit: state.audit,
              },
              null,
              2,
            )}
          </pre>
        </section>
      )}
      {debug && <ExecutionHistory debug />}
    </div>
  );
}
