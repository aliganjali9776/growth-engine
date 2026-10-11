"use client";
import { businessStorage } from "@/lib/saas/workspace-storage";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUpLeft,
  ShieldCheck,
  Send,
  Plus,
  FileText,
  Square,
  ChevronDown,
} from "lucide-react";
import {
  buildAdvisorContext,
  parseSelection,
} from "@/lib/agent/advisor/context";
import {
  readAdvisor,
  saveAdvisor,
  newAdvisorSession,
} from "@/lib/advisor-storage";
import type {
  AgentSession,
  AgentMessage,
  AdvisorSelection,
  AdvisorHistory,
  AgentAdvisorResponse,
} from "@/lib/agent/advisor/types";
import type { AgentAuditRecord, AgentEvidence } from "@/lib/agent/types";
import { READ_ONLY_MESSAGE } from "@/lib/agent/advisor/policy";
import "./advisor.css";
import { InsightsEntry } from "./insights";
import { PreparationRequestPanel } from "./actions";
import { AdvisorNavigation } from "./navigation";
import { readDiagnosis } from "@/lib/diagnosis-storage";
import { collectDiagnosisSignals } from "@/lib/agent/diagnosis/source";
import { diagnosisAdvisorAnswer } from "@/lib/agent/diagnosis/advisor";
import { isMutationQuestion } from "@/lib/agent/advisor/policy";
type Context = ReturnType<typeof buildAdvisorContext>;
type Status = {
  provider: string;
  model: string | null;
  connected: boolean;
  demoAllowed: boolean;
  message: string;
  promptVersion: string;
};
const labels = {
  executive: "نمای جامع کسب‌وکار",
  process: "فرآیند",
  objective: "هدف استراتژیک",
  kr: "نتیجه کلیدی",
  constraint: "محدودیت رشد",
  experiment: "آزمایش رشد",
};
const confidence = { Low: "کم", Medium: "متوسط", High: "زیاد" };
const starters = [
  "وضعیت کسب‌وکار را خلاصه کن",
  "بزرگ‌ترین ریسک رشد چیست؟",
  "این هفته کجا تمرکز کنیم؟",
  "چرا نتایج استراتژی عقب افتاده‌اند؟",
  "تقویت ظرفیت یا افزایش تقاضا را مقایسه کن",
  "آیا داده کافی برای CAC داریم؟",
];
function Evidence({ e }: { e: AgentEvidence }) {
  return (
    <details className="advisor-evidence">
      <summary>
        <span>{e.title}</span>
        <ChevronDown size={14} />
      </summary>
      <p>{e.summary}</p>
      <dl>
        <dt>منبع</dt>
        <dd dir="ltr">{e.sourceSelector ?? "نامشخص"}</dd>
        <dt>مقدار ثبت‌شده</dt>
        <dd>
          <code dir="auto">{JSON.stringify(e.value ?? null)}</code>
        </dd>
        <dt>زمان منبع</dt>
        <dd>
          {e.timestamp
            ? new Date(e.timestamp).toLocaleString("fa-IR")
            : "زمان منبع ثبت نشده"}
        </dd>
        <dt>زمان خواندن</dt>
        <dd>{new Date(e.createdAt).toLocaleString("fa-IR")}</dd>
        <dt>موجودیت</dt>
        <dd>{e.entityRef?.label ?? e.entityRef?.entityId ?? "خلاصه ماژول"}</dd>
      </dl>
      {e.route && (
        <Link href={e.route}>
          مشاهده منبع <ArrowUpLeft size={14} />
        </Link>
      )}
    </details>
  );
}
function Response({ r }: { r: AgentAdvisorResponse }) {
  const refs = (ids: string[]) => (
    <div className="advisor-ref-links">
      {ids.map((id) => {
        const e = r.evidenceRefs.find((e) => e.id === id);
        return e ? (
          <a href={"#source-" + id + "-" + r.generatedAt} key={id}>
            {e.title}
          </a>
        ) : null;
      })}
    </div>
  );
  return (
    <>
      <p className="advisor-answer">{r.answer}</p>
      {r.summary && r.summary !== r.answer && (
        <p className="muted">{r.summary}</p>
      )}
      <div className="advisor-meta">
        <span>اطمینان: {confidence[r.confidence]}</span>
        <span>{new Date(r.generatedAt).toLocaleString("fa-IR")}</span>
        <span>
          {r.provider === "mock"
            ? "حالت آزمایشی"
            : r.provider === "policy"
              ? "بررسی قواعد داخلی"
              : r.model}
        </span>
      </div>
      {!!r.observations.length && (
        <section>
          <h3>مشاهدات</h3>
          {r.observations.map((o, i) => (
            <div className="advisor-claim" key={i}>
              <p>{o.text}</p>
              {refs(o.evidenceIds)}
            </div>
          ))}
        </section>
      )}
      {!!r.recommendations.length && (
        <section>
          <h3>پیشنهاد مدیریتی</h3>
          {r.recommendations.map((o, i) => (
            <div className="advisor-claim" key={i}>
              <p>{o.text}</p>
              <small>اطمینان: {confidence[o.confidence]}</small>
              {refs(o.evidenceIds)}
            </div>
          ))}
        </section>
      )}
      {r.brief.map((s, i) => (
        <section key={i}>
          <h3>{s.title}</h3>
          {s.items.map((c, j) => (
            <div className="advisor-claim" key={j}>
              <p>{c.text}</p>
              {refs(c.evidenceIds)}
            </div>
          ))}
        </section>
      ))}
      {!!r.comparison.length && (
        <div className="advisor-comparison">
          {r.comparison.map((o, i) => (
            <section key={i}>
              <h3>{o.option}</h3>
              <p>مزیت: {o.benefits}</p>
              <p>ریسک: {o.risks}</p>
              {refs(o.evidenceIds)}
            </section>
          ))}
        </div>
      )}
      {!!r.dataGaps.length && (
        <section className="advisor-gap">
          <h3>داده‌های موردنیاز</h3>
          {r.dataGaps.map((g, i) => (
            <p key={i}>{g}</p>
          ))}
        </section>
      )}
      {r.warnings
        .filter((w) => w !== r.answer)
        .map((w, i) => (
          <p key={i} className="advisor-warning">
            {w}
          </p>
        ))}
      {!!r.evidenceRefs.length && (
        <section>
          <h3>شواهد این پاسخ</h3>
          <div className="advisor-sources">
            {r.evidenceRefs.map((e) => (
              <div id={"source-" + e.id + "-" + r.generatedAt} key={e.id}>
                <Evidence e={e} />
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
export function AdvisorPage() {
  const [hasDiagnosis, setHasDiagnosis] = useState(false);
  useEffect(() => {
    const refresh = () =>
      setHasDiagnosis(readDiagnosis(businessStorage).state.runs.length > 0);
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  const [session, setSession] = useState<AgentSession | null>(null),
    [selection, setSelection] = useState<AdvisorSelection>({
      type: "executive",
    }),
    [context, setContext] = useState<Context | null>(null),
    [status, setStatus] = useState<Status | null>(null),
    [demo, setDemo] = useState(false),
    [question, setQuestion] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [stale, setStale] = useState(false),
    [storageError, setStorageError] = useState("");
  const raw = useRef<string | null>(null),
    controller = useRef<AbortController | null>(null),
    sessionRef = useRef<AgentSession | null>(null),
    pending = useRef(false),
    textarea = useRef<HTMLTextAreaElement>(null);
  function commit(s: AgentSession) {
    setSession(s);
    sessionRef.current = s;
    if (storageError) return;
    try {
      raw.current = saveAdvisor(businessStorage, s, raw.current);
    } catch (e) {
      setStorageError(
        e instanceof Error ? e.message : "ذخیره گفت‌وگو ممکن نشد.",
      );
    }
  }
  const history = (s: AgentSession | null): AdvisorHistory[] =>
    (s?.messages ?? [])
      .filter((m) => m.role === "user" || m.role === "advisor")
      .slice(-6)
      .map((m) => ({
        role: m.role as "user" | "advisor",
        content: m.content.slice(0, 1200),
      }));
  function refresh(
    sel: AdvisorSelection,
    s: AgentSession | null,
    q = "وضعیت کسب‌وکار را خلاصه کن",
  ) {
    try {
      const c = buildAdvisorContext(businessStorage, q, sel, history(s));
      setContext(c);
      setStale(!!s?.lastFingerprint && c.fingerprint !== s.lastFingerprint);
      return c;
    } catch (e) {
      setContext(null);
      setError(e instanceof Error ? e.message : "خواندن زمینه ممکن نشد.");
      return null;
    }
  }
  useEffect(() => {
    const loaded = readAdvisor(businessStorage);
    raw.current = loaded.raw;
    setStorageError(loaded.error ?? "");
    let sel: AdvisorSelection;
    try {
      const params = new URLSearchParams(location.search);
      sel = params.has("context")
        ? parseSelection(params.get("context"), params.get("id"))
        : (loaded.store.session?.currentContext ?? { type: "executive" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "زمینه نامعتبر است.");
      return;
    }
    const s = loaded.store.session ?? newAdvisorSession(sel);
    s.currentContext = sel;
    setSelection(sel);
    setSession(s);
    sessionRef.current = s;
    refresh(
      sel,
      s,
      s.messages.filter((m) => m.role === "user").at(-1)?.content,
    );
    fetch("/api/advisor", { cache: "no-store" })
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setError("بررسی اتصال مدل ممکن نشد."));
    return () => controller.current?.abort();
  }, []);
  useEffect(() => {
    const listener = () =>
      refresh(
        selection,
        sessionRef.current,
        sessionRef.current?.messages.filter((m) => m.role === "user").at(-1)
          ?.content,
      );
    window.addEventListener("focus", listener);
    window.addEventListener("storage", listener);
    return () => {
      window.removeEventListener("focus", listener);
      window.removeEventListener("storage", listener);
    };
  }, [selection]);
  function audit(
    s: AgentSession,
    event: AgentAuditRecord["event"],
    summary: string,
    id: string,
  ) {
    s.audit.push({
      id: crypto.randomUUID(),
      event,
      timestamp: new Date().toISOString(),
      summary,
      artifactId: id,
      affectedEntities: [],
      dryRun: true,
    });
  }
  async function ask(text = question, mode: "answer" | "brief" = "answer") {
    if (pending.current || !text.trim() || !sessionRef.current) return;
    setError("");
    const base = sessionRef.current,
      c = refresh(selection, base, text);
    if (!c) return;
    setSelection(c.selection);
    const s = structuredClone(base),
      id = crypto.randomUUID(),
      at = new Date().toISOString();
    s.currentContext = c.selection;
    s.messages.push({
      id,
      sessionId: s.id,
      role: "user",
      content: text.trim(),
      evidenceRefs: [],
      generatedAt: at,
    });
    audit(s, "AdvisorQuestionAsked", "پرسش مشاور ثبت شد.", id);
    audit(
      s,
      "ContextBuilt",
      `${c.packet.evidence.length} شاهد منتخب خوانده شد.`,
      id,
    );
    s.lastPacket = c.packet;
    s.lastCapabilities = c.capabilityIds;
    commit(s);
    setQuestion("");
    setBusy(true);
    pending.current = true;
    controller.current = new AbortController();
    try {
      const localDiagnosis =
        c.selection.type === "executive" &&
        !isMutationQuestion(text) &&
        (mode === "brief" ||
          /(?:مهم‌ترین مشکلات|مهمترین مشکلات|مسائل فعلی|مشکلات فعلی|current problems|top issues)/i.test(
            text,
          ))
          ? diagnosisAdvisorAnswer(
              readDiagnosis(businessStorage).state,
              collectDiagnosisSignals(businessStorage),
              at,
            )
          : null;
      const result = localDiagnosis
        ? null
        : await fetch("/api/advisor", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Advisor-Client": "advisor-v1",
            },
            signal: controller.current.signal,
            body: JSON.stringify({
              requestId: id,
              question: text.trim(),
              selection: c.selection,
              packet: c.packet,
              capabilityIds: c.capabilityIds,
              history: history(base),
              mode,
              demo,
            }),
          });
      const data = localDiagnosis
        ? { response: localDiagnosis }
        : await result!.json();
      if (result && !result.ok && data.error?.modelCalled)
        audit(s, "ModelCalled", "مدل فراخوانی شد؛ پاسخ موفق دریافت نشد.", id);
      if (result && !result.ok)
        throw Error(data.error?.message ?? "پاسخ معتبر دریافت نشد.");
      const response = data.response as AgentAdvisorResponse;
      if (response.modelCalled)
        audit(
          s,
          "ModelCalled",
          `${response.provider} / ${response.model} / ${response.promptVersion}`,
          id,
        );
      audit(
        s,
        "AdvisorResponseCreated",
        "پاسخ با ساختار و شواهد معتبر ثبت شد.",
        id,
      );
      s.messages.push({
        id: crypto.randomUUID(),
        sessionId: s.id,
        role: "advisor",
        content: response.answer,
        evidenceRefs: response.evidenceRefs,
        generatedAt: response.generatedAt,
        response,
        providerMetadata: {
          provider: response.provider,
          model: response.model,
          promptVersion: response.promptVersion,
          requestTimestamp: response.requestTimestamp,
        },
        contextFingerprint: c.fingerprint,
      });
      s.lastFingerprint = c.fingerprint;
      s.updatedAt = new Date().toISOString();
      commit(s);
      setStale(false);
    } catch (e) {
      const msg =
        e instanceof Error && e.name === "AbortError"
          ? "درخواست لغو شد."
          : e instanceof Error
            ? e.message
            : "تحلیل ممکن نشد.";
      setError(msg);
      audit(s, "ModelError", msg.slice(0, 300), id);
      commit(s);
    } finally {
      setBusy(false);
      pending.current = false;
      controller.current = null;
      textarea.current?.focus();
    }
  }
  function change(sel: AdvisorSelection) {
    setSelection(sel);
    setError("");
    const s = sessionRef.current;
    if (s) {
      const next = { ...s, currentContext: sel };
      commit(next);
      refresh(sel, next);
    }
  }
  const entities =
      context?.entities.filter(
        (e) =>
          e.entityType === (selection.type === "kr" ? "KR" : selection.type),
      ) ?? [],
    connected = !!status?.connected || demo;
  return (
    <div className="advisor-page">
      <AdvisorNavigation />
      <InsightsEntry />
      <PreparationRequestPanel />
      <header className="advisor-heading">
        <div>
          <span className="advisor-eyebrow">
            GROWTH ENGINE · EXECUTIVE ADVISOR
          </span>
          <h1>مشاور مدیریتی</h1>
          <p>از شواهد کسب‌وکار، به یک تصمیم روشن برسید.</p>
        </div>
        <button
          className="button secondary"
          disabled={busy || !session || !!storageError}
          onClick={() => {
            const s = newAdvisorSession(selection);
            commit(s);
            setError("");
            setStale(false);
            refresh(selection, s);
            textarea.current?.focus();
          }}
        >
          <Plus size={16} />
          گفت‌وگوی جدید
        </button>
      </header>
      <div className="advisor-safety">
        <ShieldCheck size={18} />
        <span>
          فقط تحلیل و پیشنهاد · تغییری در داده‌های کسب‌وکار اعمال نمی‌شود.
        </span>
      </div>
      {storageError && (
        <p role="alert" className="advisor-gap">
          {storageError}
        </p>
      )}
      <div className="advisor-layout">
        <div className="advisor-main">
          <div className="advisor-status">
            <span
              className={connected ? "advisor-dot active" : "advisor-dot"}
            />
            <p>
              {demo
                ? "حالت آزمایشی؛ این پاسخ‌ها از مدل واقعی نیستند."
                : (status?.message ?? "در حال بررسی اتصال مدل…")}
            </p>
            {status?.demoAllowed && !status.connected && (
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => setDemo(!demo)}
              >
                {demo ? "خروج از حالت آزمایشی" : "فعال‌کردن حالت آزمایشی"}
              </button>
            )}
          </div>
          {stale && (
            <p role="status" className="advisor-gap">
              داده‌های زمینه تغییر کرده‌اند؛ پاسخ قبلی یک تصویر تاریخی است. پرسش
              بعدی با شواهد تازه تحلیل می‌شود.
            </p>
          )}
          <section
            className="advisor-conversation"
            aria-label="گفت‌وگوی مشاور"
            aria-busy={busy}
          >
            {!session?.messages.length && (
              <div className="advisor-empty">
                <FileText size={30} />
                <h2>تصویر روشن‌تری از کسب‌وکار بسازید</h2>
                <p>
                  یک پرسش مدیریتی بپرسید؛ هر پاسخ، شواهد و کمبود داده را همراه
                  خود دارد.
                </p>
                <div className="advisor-starters">
                  {starters.map((q) => (
                    <button
                      key={q}
                      onClick={() => {
                        setQuestion(q);
                        textarea.current?.focus();
                      }}
                    >
                      {q}
                      <ArrowUpLeft size={14} />
                    </button>
                  ))}
                </div>
              </div>
            )}
            {session?.messages.map((m) => (
              <article key={m.id} className={"advisor-message " + m.role}>
                <h2>{m.role === "user" ? "پرسش شما" : "تحلیل مدیریتی"}</h2>
                {m.response ? <Response r={m.response} /> : <p>{m.content}</p>}
                {m.response && (
                  <div className="advisor-feedback">
                    <span>این تحلیل مفید بود؟</span>
                    {(["Helpful", "NotHelpful"] as const).map((f) => (
                      <button
                        key={f}
                        aria-pressed={m.feedback === f}
                        disabled={busy}
                        onClick={() => {
                          const s = structuredClone(session);
                          const found = s.messages.find((x) => x.id === m.id);
                          if (found) found.feedback = f;
                          commit(s);
                        }}
                      >
                        {f === "Helpful" ? "بله" : "نیازمند بهبود"}
                      </button>
                    ))}
                  </div>
                )}
              </article>
            ))}
            {busy && (
              <p role="status" className="advisor-loading">
                در حال بررسی شواهد و آماده‌سازی تحلیل…
              </p>
            )}
          </section>
          {error && (
            <p role="alert" className="advisor-gap">
              {error}
            </p>
          )}
          <form
            className="advisor-composer"
            onSubmit={(e) => {
              e.preventDefault();
              void ask();
            }}
          >
            <label htmlFor="advisor-question">پرسش مدیریتی شما</label>
            <textarea
              id="advisor-question"
              ref={textarea}
              value={question}
              maxLength={2000}
              rows={3}
              placeholder="برای تصمیم بعدی، چه چیزی باید بدانم؟"
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  void ask();
                }
              }}
            />
            <div>
              <small>
                {question.length.toLocaleString("fa-IR")} / ۲٬۰۰۰ · Ctrl + Enter
              </small>
              {busy ? (
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => controller.current?.abort()}
                >
                  <Square size={14} />
                  لغو درخواست
                </button>
              ) : (
                <button
                  className="button"
                  disabled={
                    !question.trim() ||
                    (!connected &&
                      !(
                        hasDiagnosis &&
                        selection.type === "executive" &&
                        /(?:مهم‌ترین مشکلات|مهمترین مشکلات|مسائل فعلی|مشکلات فعلی|current problems|top issues)/i.test(
                          question,
                        ) &&
                        !isMutationQuestion(question)
                      )) ||
                    !session ||
                    !context
                  }
                >
                  <Send size={15} />
                  ارسال پرسش
                </button>
              )}
            </div>
          </form>
          <p className="advisor-disclaimer">
            پیشنهادها نیازمند قضاوت مدیر هستند. اطمینان از کیفیت شواهد محاسبه
            می‌شود؛ صحت علت و معلول تضمین نمی‌شود.
          </p>
        </div>
        <aside className="advisor-panel">
          <section>
            <span className="advisor-eyebrow">زمینه تحلیل</span>
            <h2>شواهد مرتبط، تصمیم دقیق‌تر</h2>
            <label>
              نوع زمینه
              <select
                aria-label="نوع زمینه"
                value={selection.type}
                disabled={busy}
                onChange={(e) => {
                  const type = e.target.value as AdvisorSelection["type"];
                  if (type === "executive") change({ type });
                  else {
                    const ref = context?.entities.find(
                      (x) => x.entityType === (type === "kr" ? "KR" : type),
                    );
                    if (ref) change({ type, id: ref.entityId });
                    else
                      setError("در این زمینه موجودیت قابل تحلیل وجود ندارد.");
                  }
                }}
              >
                {Object.entries(labels).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            {selection.type !== "executive" && (
              <label>
                موجودیت
                <select
                  aria-label="موجودیت زمینه"
                  value={selection.id ?? ""}
                  disabled={busy}
                  onChange={(e) => change({ ...selection, id: e.target.value })}
                >
                  {entities.map((e) => (
                    <option key={e.entityId} value={e.entityId}>
                      {e.label ?? e.entityId}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <p>
              {context?.packet.evidence.length.toLocaleString("fa-IR") ?? "—"}{" "}
              شاهد منتخب · داده‌های فعلی
            </p>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => refresh(selection, sessionRef.current)}
            >
              بازخوانی زمینه
            </button>
          </section>
          <section>
            <h2>مرور اجرایی</h2>
            <p>
              وضعیت، ریسک‌ها، فرصت‌ها و تمرکز مدیریتی را در یک گزارش بررسی کنید.
            </p>
            <button
              className="button"
              disabled={
                busy ||
                (!connected &&
                  !(hasDiagnosis && selection.type === "executive")) ||
                !context
              }
              onClick={() =>
                void ask("مرور اجرایی کسب‌وکار را آماده کن", "brief")
              }
            >
              <FileText size={16} />
              تهیه مرور اجرایی
            </button>
          </section>
          <section>
            <h2>نمای 3S</h2>
            {context && (
              <div className="advisor-summary">
                {(
                  [
                    ["System", "سیستم"],
                    ["Strategy", "استراتژی"],
                    ["Scale", "اسکیل"],
                  ] as const
                ).map(([key, label]) => {
                  const value = context.snapshot[key].health;
                  return (
                    <div key={key}>
                      <span>{label}</span>
                      <strong>
                        {typeof value === "number"
                          ? value.toLocaleString("fa-IR") + " / ۱۰۰"
                          : "داده کافی نیست"}
                      </strong>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="muted">
              زمینه محدود فقط روابط ثبت‌شده را دنبال می‌کند؛ اطلاعات نامرتبط
              ارسال نمی‌شود.
            </p>
          </section>
          <section>
            <h2>شواهد زمینه</h2>
            {context?.packet.evidence.slice(0, 6).map((e) => (
              <Evidence key={e.id} e={e} />
            ))}
            {context?.notices.map((n, i) => (
              <p className="muted" key={i}>
                {n}
              </p>
            ))}
          </section>
        </aside>
      </div>
    </div>
  );
}
