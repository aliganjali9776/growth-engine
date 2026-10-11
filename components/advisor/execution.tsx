"use client";
import { businessStorage } from "@/lib/saas/workspace-storage";
import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { Drawer } from "@/components/system/ui";
import { readExecution } from "@/lib/execution-storage";
import { readPreparation } from "@/lib/preparation-storage";
import {
  emptyExecution,
  type ExecutionState,
} from "@/lib/agent/execution/types";
import {
  ExecutableCapabilityRegistry,
  executable,
} from "@/lib/agent/execution/registry";
import {
  dryRunAction,
  executeAction,
  rollbackAction,
} from "@/lib/agent/execution/engine";
import type {
  PreparedAction,
  PreparationState,
} from "@/lib/agent/preparation/types";
import type { PreparationContext } from "@/lib/agent/preparation/context";
import { approvalBinding } from "@/lib/agent/preparation/engine";
import { getField } from "@/lib/agent/preparation/templates";
import { findEntity } from "@/lib/agent/preparation/context";
import { AdvisorNavigation } from "./navigation";
import "./actions.css";
export function useExecutions() {
  const [state, setState] = useState<ExecutionState>(emptyExecution),
    [error, setError] = useState("");
  const refresh = useCallback(() => {
    const r = readExecution(businessStorage);
    setState(r.state);
    setError(r.error ?? "");
  }, []);
  useEffect(() => {
    refresh();
    window.addEventListener("execution-saved", refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("execution-saved", refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [refresh]);
  return { state, error, refresh };
}
export function executionDisposition(a: PreparedAction, e: ExecutionState) {
  const r = e.records.find((r) => r.actionId === a.id);
  return r?.status === "Succeeded" || r?.status === "RolledBack"
    ? "Executed"
    : r?.status === "Executing"
      ? "Executing"
      : r?.status === "Failed"
        ? "ExecutionFailed"
        : a.status === "NeedsReview" && a.validation.status === "Stale"
          ? "Stale"
          : a.status === "Approved" && executable(a.templateId)
            ? "ReadyToExecute"
            : a.status;
}
export function ExecutionPanel({
  a,
  preparation,
  context,
  dirty,
  intentRequest,
}: {
  a: PreparedAction;
  preparation: PreparationState;
  context: PreparationContext;
  dirty: boolean;
  intentRequest?: number;
}) {
  const { state, error, refresh } = useExecutions(),
    [preview, setPreview] = useState<ReturnType<typeof dryRunAction> | null>(
      null,
    ),
    [confirm, setConfirm] = useState<"execute" | "rollback" | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const confirmOrigin = useRef<HTMLElement | null>(null);
  const record = state.records.find((r) => r.actionId === a.id),
    policy = executable(a.templateId),
    done = record && ["Succeeded", "RolledBack"].includes(record.status),
    binding = approvalBinding(a, preparation);
  useEffect(() => {
    setPreview(null);
    setConfirm(null);
  }, [a.id, a.revision, binding, context.version]);
  useEffect(() => {
    if (!intentRequest) return;
    confirmOrigin.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    try {
      if (dirty) throw Error("ابتدا ویرایش را ذخیره کنید.");
      const current = dryRunAction(businessStorage, a.id);
      setPreview(current);
      setConfirm("execute");
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "ابتدا اعتبار اقدام را بررسی کنید.",
      );
    }
  }, [intentRequest]);
  const run = async (fn: () => void) => {
    setBusy(true);
    setMessage("");
    try {
      if (typeof navigator.locks !== "undefined")
        await navigator.locks.request("growth-engine.agent.execution", fn);
      else fn();
      refresh();
      window.dispatchEvent(new Event("execution-saved"));
      window.dispatchEvent(new Event("preparation-saved"));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "اجرا انجام نشد.");
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };
  const rollback =
    record && state.rollbacks.find((x) => x.id === record.rollbackRecordId);
  return (
    <section className="preparation-panel execution-panel">
      <h2>اجرای تغییر با تأیید شما</h2>
      <p>
        تأیید پیشنهاد به‌تنهایی تغییری ایجاد نمی‌کند. اجرا فقط با انتخاب صریح
        شما انجام می‌شود.
      </p>
      {error && <p role="alert">{error}</p>}
      {message && (
        <p role="status" className="preparation-error">
          {message}
        </p>
      )}
      {!policy ? (
        <p>این نوع اقدام فعلاً فقط قابل آماده‌سازی است و اجرای آن فعال نیست.</p>
      ) : done ? (
        <>
          <p className="preparation-notice">
            {record.status === "RolledBack"
              ? "اجرا ثبت شده؛ ایده با اقدام جبرانی آرشیو شده است."
              : "اجرا شد — نتیجه در بخش مربوط تأیید شده است."}
          </p>
          <p>
            {new Date(record.completedAt!).toLocaleString("fa-IR", {
              timeZone: "Asia/Tehran",
            })}
          </p>
          {record.entityRefs.map((r) => (
            <Link className="button secondary" key={r.entityId} href={r.route!}>
              مشاهده در{" "}
              {r.domain === "Scale"
                ? "رشد"
                : r.domain === "Strategy"
                  ? "استراتژی"
                  : "سیستم"}
            </Link>
          ))}
          <div className="preparation-preview">
            <article>
              <h3>قبل از اجرا</h3>
              <p>این رکورد وجود نداشت؛ موضوع مرتبط حفظ شده است.</p>
            </article>
            <article>
              <h3>بعد از اجرا</h3>
              <p>{record.entityRefs[0]?.label}</p>
              <p>
                رکورد ایجاد شد؛ فعال‌سازی، شروع یا تأیید عملیاتی انجام نشده است.
              </p>
            </article>
          </div>
          {rollback?.supported && record.status === "Succeeded" ? (
            <button
              className="secondary"
              onClick={(event) => {
                confirmOrigin.current = event.currentTarget;
                setConfirm("rollback");
              }}
              disabled={busy}
            >
              بازگردانی تغییر
            </button>
          ) : (
            <p>
              {record.status === "RolledBack"
                ? "تاریخچه اجرای اصلی و بازگردانی حفظ شده است."
                : "بازگردانی خودکار پشتیبانی نمی‌شود؛ رکورد ایجادشده را از بخش مربوط بازبینی کنید."}
            </p>
          )}
        </>
      ) : (
        <>
          <p>
            {record?.status === "Executing"
              ? "اجرای قبلی نیازمند بررسی نتیجه است؛ بازیابی ابتدا منبع مرجع را بررسی می‌کند."
              : record?.status === "Failed"
                ? "اجرا ناموفق است؛ پیش از تکرار، نتیجه قبلی بررسی می‌شود."
                : a.status === "Approved"
                  ? "تأیید شده — منتظر اجرا"
                  : "ابتدا پیشنهاد معتبر را تأیید کنید."}
          </p>
          <div className="preparation-buttons">
            <button
              disabled={busy || dirty || !!error || a.status !== "Approved"}
              onClick={() =>
                run(() => setPreview(dryRunAction(businessStorage, a.id)))
              }
            >
              اجرای آزمایشی
            </button>
            <button
              disabled={
                busy ||
                dirty ||
                !!error ||
                !preview ||
                preview.binding !== binding
              }
              onClick={(event) => {
                confirmOrigin.current = event.currentTarget;
                setConfirm("execute");
              }}
            >
              اجرا
            </button>
            {record && ["Executing", "Failed"].includes(record.status) && (
              <button
                disabled={busy || dirty || !!error}
                onClick={(event) => {
                  confirmOrigin.current = event.currentTarget;
                  setConfirm("execute");
                }}
              >
                بررسی نتیجه و تلاش مجدد صریح
              </button>
            )}
          </div>
          {preview && (
            <div className="preparation-notice">
              <h3>نتیجه اجرای آزمایشی</h3>
              <p>
                یک رکورد جدید «{a.title}» در{" "}
                {policy.domain === "Scale"
                  ? "رشد"
                  : policy.domain === "Strategy"
                    ? "استراتژی"
                    : "سیستم"}{" "}
                ایجاد خواهد شد. هنوز هیچ داده‌ای تغییر نکرده است.
              </p>
              <p>
                تازگی داده و اعتبار تأیید بررسی شد · نسخه{" "}
                {preview.revision.toLocaleString("fa-IR")}
              </p>
              {preview.warnings.map((w) => (
                <p key={w}>{w}</p>
              ))}
            </div>
          )}
        </>
      )}
      {confirm && (
        <Drawer
          returnFocusElement={confirmOrigin.current}
          open
          onClose={() => !busy && setConfirm(null)}
          title={
            confirm === "rollback"
              ? "تأیید آرشیو جبرانی ایده"
              : "تأیید اجرای تغییر"
          }
          description="پیش‌نمایش و شواهد را بررسی کنید؛ فقط این رکورد تغییر می‌کند."
        >
          <section className="execution-confirm">
            <h3 id="execution-confirm-title">
              {confirm === "rollback"
                ? "تأیید آرشیو جبرانی ایده"
                : "تأیید اجرای تغییر"}
            </h3>
            <p>
              {confirm === "rollback"
                ? "فقط ایده ایجادشده آرشیو می‌شود. رکوردهای دیگر و تاریخچه حفظ می‌شوند."
                : `با اجرای این اقدام، یک ${a.templateId === "Experiment" ? "آزمایش رشد جدید در وضعیت پیش‌نویس" : a.templateId === "Initiative" ? "اقدام استراتژیک جدید در وضعیت پیشنهادی" : "رکورد جدید در وضعیت اولیه"} ایجاد می‌شود.`}
            </p>
            <p>
              {a.title} · ریسک {a.riskLevel === "Low" ? "کم" : "متوسط"}
            </p>
            <p>چرا: {a.rationale}</p>
            <div className="preparation-preview">
              <article>
                <h3>قبل از تغییر</h3>
                <p>
                  {confirm === "rollback"
                    ? a.title + " — ایده در وضعیت ورودی"
                    : "این رکورد هنوز ایجاد نشده است؛ موضوع مرتبط تغییر نمی‌کند."}
                </p>
              </article>
              <article>
                <h3>بعد از تغییر</h3>
                {confirm === "rollback" ? (
                  <p>همین ایده آرشیو می‌شود؛ تاریخچه حفظ خواهد شد.</p>
                ) : (
                  a.fields.map((f) => {
                    const v = getField(a.payload, f.path);
                    return (
                      <p key={f.path}>
                        <strong>{f.label}: </strong>
                        {f.entityType
                          ? (findEntity(context, f.entityType, String(v))?.ref
                              .label ?? String(v))
                          : String(v ?? "نامشخص")}
                      </p>
                    );
                  })
                )}
              </article>
            </div>
            <details>
              <summary>شواهد مبنای تصمیم</summary>
              {a.evidenceIds.map((id) => {
                const ev = preparation.evidence.find((x) => x.id === id);
                return ev ? (
                  <p key={id}>
                    {ev.title} — {ev.summary}
                  </p>
                ) : (
                  <p key={id}>شاهد در دسترس نیست؛ اجرا بازبینی می‌شود.</p>
                );
              })}
            </details>
            <p>
              شواهد و پیش‌نمایش بالا مبنای این تغییر هستند. تأیید نسخه{" "}
              {a.revision.toLocaleString("fa-IR")}؛ وضعیت فعلی پیش از ذخیره
              دوباره بررسی می‌شود.
            </p>
            <div className="preparation-buttons">
              <button
                className="secondary"
                autoFocus
                onClick={() => setConfirm(null)}
                disabled={busy}
              >
                انصراف
              </button>
              <button
                disabled={busy || dirty}
                onClick={() =>
                  run(() => {
                    if (confirm === "rollback" && record)
                      rollbackAction(businessStorage, record.id, {
                        explicit: true,
                      });
                    else
                      executeAction(businessStorage, a.id, {
                        explicit: true,
                        dryRunBinding: preview?.binding ?? binding,
                      });
                    setPreview(null);
                  })
                }
              >
                {confirm === "rollback" ? "تأیید بازگردانی" : "اجرای تغییر"}
              </button>
            </div>
          </section>
        </Drawer>
      )}
      {record && (
        <details>
          <summary>خط زمانی اجرا</summary>
          {state.audit
            .filter((x) => x.executionId === record.id)
            .map((x) => (
              <p key={x.id}>
                {new Date(x.at).toLocaleString("fa-IR", {
                  timeZone: "Asia/Tehran",
                })}{" "}
                · {x.summary}
              </p>
            ))}
        </details>
      )}
    </section>
  );
}
export function ExecutionHistory({ debug = false }: { debug?: boolean }) {
  const { state, error } = useExecutions();
  const [draftCounts, setDraftCounts] = useState({
    prepared: 0,
    approved: 0,
    stale: 0,
  });
  useEffect(() => {
    if (debug) {
      const p = readPreparation(businessStorage).state;
      setDraftCounts({
        prepared: p.actions.length,
        approved: p.actions.filter((a) => a.status === "Approved").length,
        stale: p.actions.filter((a) => a.validation.status === "Stale").length,
      });
    }
  }, [debug, state]);
  return (
    <div className="advisor-page preparation-page">
      <AdvisorNavigation />
      <h1>{debug ? "Execution debug · BUILD 6E" : "تاریخچه اجرای اقدامات"}</h1>
      <Link href="/advisor/actions">بازگشت به اقدامات</Link>
      {error && <p role="alert">{error}</p>}
      {!state.records.length && <p>هنوز اجرایی ثبت نشده است.</p>}
      {state.records
        .slice()
        .reverse()
        .map((r) => (
          <article className="preparation-panel" key={r.id}>
            <h2>
              <Link href={"/advisor/actions/" + r.actionId}>
                {r.entityRefs[0]?.label ?? "بررسی نتیجه اقدام"}
              </Link>
            </h2>
            <p>
              {r.domain} ·{" "}
              {
                {
                  Succeeded: "اجراشده",
                  Executing: "نیازمند بررسی نتیجه",
                  Failed: "ناموفق",
                  RolledBack: "بازگردانی‌شده",
                  Pending: "منتظر اجرا",
                  PartiallyRecovered: "بازیابی جزئی",
                }[r.status]
              }
            </p>
            <p>
              {new Date(r.completedAt ?? r.startedAt).toLocaleString("fa-IR", {
                timeZone: "Asia/Tehran",
              })}
            </p>
            {r.entityRefs.map((x) => (
              <Link key={x.entityId} href={x.route!}>
                مشاهده رکورد
              </Link>
            ))}
            <p>
              {r.rollbackSupported
                ? "بازگردانی جبرانی با بررسی ایمنی"
                : "بازگردانی خودکار پشتیبانی نمی‌شود"}
            </p>
          </article>
        ))}
      {debug && (
        <pre dir="ltr">
          {JSON.stringify(
            {
              whitelist: ExecutableCapabilityRegistry,
              counts: {
                ...draftCounts,
                executed: state.records.filter((r) => r.status === "Succeeded")
                  .length,
                failed: state.records.filter((r) => r.status === "Failed")
                  .length,
                rolledBack: state.records.filter(
                  (r) => r.status === "RolledBack",
                ).length,
              },
              ...state,
            },
            null,
            2,
          )}
        </pre>
      )}
    </div>
  );
}
