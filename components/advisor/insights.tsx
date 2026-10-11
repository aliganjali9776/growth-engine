"use client";
import { businessStorage } from "@/lib/saas/workspace-storage";
import { RecommendationsPanel } from "./actions";
import { AdvisorNavigation } from "./navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { readDiagnosis, saveDiagnosis } from "@/lib/diagnosis-storage";
import { collectDiagnosisSignals } from "@/lib/agent/diagnosis/source";
import { diagnosisContextVersion } from "@/lib/agent/diagnosis/freshness";
import { runDiagnosis, setDiagnosisStatus } from "@/lib/agent/diagnosis/engine";
import { diagnosisRules } from "@/lib/agent/diagnosis/rules";
import {
  applyDiagnosisWording,
  responseWording,
} from "@/lib/agent/diagnosis/hybrid";
import { validateEvidence } from "@/lib/agent/advisor/validation";
import {
  emptyDiagnosisState,
  type AgentDiagnosis,
  type DiagnosisStatus,
} from "@/lib/agent/diagnosis/types";
import "./advisor.css";
import "./insights.css";
const statusLabels: Record<DiagnosisStatus, string> = {
  New: "جدید",
  Reviewed: "بازبینی‌شده",
  Monitoring: "تحت پایش",
  Resolved: "حل‌شده",
  Dismissed: "کنار گذاشته‌شده",
};
const riskLabels = {
  Low: "پایین",
  Medium: "متوسط",
  High: "بالا",
  Critical: "بحرانی",
};
const confidenceLabels = { Low: "کم", Medium: "متوسط", High: "زیاد" };
const impactLabels = {
  Localized: "محدود به یک بخش",
  Material: "قابل توجه",
  CrossFunctional: "چندبخشی",
  Strategic: "استراتژیک",
};
const signalLabels = {
  Active: "فعال",
  Resolved: "حل‌شده",
  Suppressed: "کنار گذاشته‌شده",
  Stale: "نیازمند تازه‌سازی",
};
const historyLabels = {
  Created: "شناسایی",
  Updated: "به‌روزرسانی",
  Reviewed: "بازبینی",
  Monitoring: "پایش",
  Dismissed: "کنار گذاشتن",
  Resolved: "حل‌شدن",
  Reopened: "بازگشایی",
};
function useDiagnosis() {
  const [store, setStore] = useState(emptyDiagnosisState),
    [raw, setRaw] = useState<string | null>(null),
    [error, setError] = useState(""),
    [stale, setStale] = useState(false),
    [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const refresh = () => {
      const read = readDiagnosis(businessStorage);
      setStore(read.state);
      setRaw(read.raw);
      setError(read.error ?? "");
      setLoaded(true);
      try {
        setStale(
          !!read.state.runs.length &&
            diagnosisContextVersion(businessStorage) !==
              read.state.runs.at(-1)?.contextVersion,
        );
      } catch {
        setStale(true);
      }
    };
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  function commit(next: typeof store) {
    try {
      const saved = saveDiagnosis(businessStorage, next, raw);
      setStore(next);
      setRaw(saved);
      setError("");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "ذخیره تحلیل انجام نشد.");
      return false;
    }
  }
  return { store, error, stale, loaded, commit, setStale, setError };
}
function Card({ d }: { d: AgentDiagnosis }) {
  return (
    <Link className="diagnosis-card" href={"/advisor/insights/" + d.id}>
      <div className="advisor-meta">
        <span>{statusLabels[d.status]}</span>
        <span>شدت: {riskLabels[d.severity]}</span>
        <span>اطمینان: {confidenceLabels[d.confidence]}</span>
      </div>
      <h3>{d.title}</h3>
      <p>{d.summary}</p>
      <small>{d.affectedEntities.map((e) => e.label).join(" · ")}</small>
    </Link>
  );
}
export function InsightsPage({
  id,
  debug = false,
}: {
  id?: string;
  debug?: boolean;
}) {
  const { store, error, stale, loaded, commit, setStale, setError } =
    useDiagnosis();
  const [busy, setBusy] = useState(false),
    [reason, setReason] = useState(""),
    [hybrid, setHybrid] = useState(false),
    [notice, setNotice] = useState("");
  const d = store.diagnoses.find((d) => d.id === id),
    latest = store.runs.at(-1),
    active = store.diagnoses.filter(
      (d) => !["Resolved", "Dismissed"].includes(d.status),
    );
  async function scan() {
    setBusy(true);
    setNotice("");
    try {
      const input = collectDiagnosisSignals(businessStorage);
      let next = runDiagnosis(store, input);
      if (hybrid && next.priorities.length) {
        try {
          const status = await (await fetch("/api/advisor")).json();
          if (!status.connected || status.provider !== "openai")
            throw Error("مدل واقعی متصل نیست");
          const d = next.diagnoses.find(
            (d) => d.id === next.priorities[0].diagnosisId,
          )!;
          const evidence = next.evidence
            .filter((e) => d.evidenceIds.includes(e.id))
            .map((e) => ({
              ...e,
              title: e.title.slice(0, 250),
              summary: e.summary.slice(0, 500),
              value: e.summary.slice(0, 500),
            }))
            .filter((e) => {
              try {
                validateEvidence(e);
                return true;
              } catch {
                return false;
              }
            })
            .slice(0, 6);
          if (!evidence.length)
            throw Error("شواهد مناسب عبارت‌بندی موجود نیست");
          const at = new Date().toISOString();
          const res = await fetch("/api/advisor", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Advisor-Client": "advisor-v1",
            },
            body: JSON.stringify({
              requestId: crypto.randomUUID(),
              question:
                "این الگوی از پیش شناسایی‌شده را فقط با یک عنوان کوتاه در نخستین مشاهده، خلاصه محتاطانه، پرسش مدیریتی در نخستین پیشنهاد و منطق کسب‌وکار در پاسخ شرح دهید. تشخیص جدید، ادعای علت‌ومعلولی یا دستور اجرا نسازید. الگو: " +
                d.title,
              selection: { type: "executive" },
              packet: {
                topic: "Executive3SContext",
                entities: evidence
                  .flatMap((e) => (e.entityRef ? [e.entityRef] : []))
                  .filter(
                    (e, i, all) =>
                      all.findIndex(
                        (r) =>
                          r.domain === e.domain &&
                          r.entityType === e.entityType &&
                          r.entityId === e.entityId,
                      ) === i,
                  ),
                metrics: [],
                risks: [],
                evidence,
                historySummary: [],
                generatedAt: at,
              },
              capabilityIds: ["executive.get3SSummary"],
              history: [],
              mode: "answer",
              demo: false,
            }),
          });
          const data = await res.json();
          if (!res.ok || !data.response?.modelCalled)
            throw Error("پاسخ مدل قابل استفاده نیست");
          next = applyDiagnosisWording(
            next,
            d.id,
            responseWording(data.response),
            data.response.model,
          );
          setNotice(
            "عبارت‌بندی اولویت نخست با مدل انجام شد؛ تشخیص و رتبه‌بندی مبتنی بر قواعد است.",
          );
        } catch {
          setNotice(
            "عبارت‌بندی مدل در دسترس نبود؛ تحلیل مبتنی بر قواعد کامل شد.",
          );
        }
      }
      if (commit(next)) setStale(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تحلیل انجام نشد.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="advisor-page diagnosis-page">
      <AdvisorNavigation />
      <header className="advisor-heading">
        <div>
          <span className="advisor-eyebrow">
            GROWTH ENGINE · BUSINESS DIAGNOSIS
          </span>
          <h1>{id ? "جزئیات تحلیل" : "تحلیل‌های شناسایی‌شده"}</h1>
          <p>از شواهد مرتبط، به تمرکز مدیریتی روشن برسید.</p>
        </div>
        <Link
          className="button secondary"
          href={id ? "/advisor/insights" : "/advisor"}
        >
          {id ? "همه تحلیل‌ها" : "مشاور مدیریتی"}
        </Link>
      </header>
      <div className="advisor-safety">
        تحلیل فقط با درخواست شما اجرا می‌شود. داده‌های سیستم، استراتژی و رشد
        تغییر نمی‌کنند.
      </div>
      {error && (
        <p role="alert" className="diagnosis-alert">
          {error}
        </p>
      )}
      {stale && (
        <p role="status" className="diagnosis-alert">
          داده‌ها تغییر کرده‌اند؛ تحلیل ذخیره‌شده نیازمند تازه‌سازی است.
        </p>
      )}
      <div className="diagnosis-toolbar">
        <label>
          <input
            type="checkbox"
            checked={hybrid}
            disabled={busy}
            onChange={(e) => setHybrid(e.target.checked)}
          />{" "}
          عبارت‌بندی اختیاری با مدل متصل
        </label>
        <button
          className="button primary"
          disabled={!loaded || busy || !!error}
          onClick={scan}
        >
          {busy ? "در حال تحلیل…" : "تحلیل وضعیت فعلی"}
        </button>
        <span>
          {latest
            ? "آخرین تحلیل: " +
              new Date(latest.completedAt).toLocaleString("fa-IR")
            : "هنوز تحلیلی اجرا نشده است."}
        </span>
        <span>تحلیل مبتنی بر قواعد · بدون نیاز به اتصال مدل</span>
      </div>
      {notice && (
        <p role="status" className="diagnosis-alert">
          {notice}
        </p>
      )}
      {id ? (
        !loaded ? (
          <p>در حال خواندن…</p>
        ) : !d ? (
          <p>
            تحلیل پیدا نشد.{" "}
            <Link href="/advisor/insights">بازگشت به تحلیل‌ها</Link>
          </p>
        ) : (
          <>
            <section className="diagnosis-section">
              <h2>{d.title}</h2>
              <p>{d.summary}</p>
              <div className="advisor-meta">
                <span>{statusLabels[d.status]}</span>
                <span>شدت: {riskLabels[d.severity]}</span>
                <span>اطمینان: {confidenceLabels[d.confidence]}</span>
                <span>دامنه اثر: {impactLabels[d.businessImpact]}</span>
              </div>
              <h3>پرسش مدیریتی</h3>
              <p>{d.managementQuestion}</p>
              <p>
                اطمینان بر پایه{" "}
                {d.sourceFamilies.length.toLocaleString("fa-IR")} خانواده منبع
                مستقل است. تکرار تحلیل، جایگزین شواهد تازه نمی‌شود.
              </p>
              <label>
                وضعیت تحلیل
                <select
                  value={d.status}
                  onChange={(e) =>
                    commit(
                      setDiagnosisStatus(
                        store,
                        d.id,
                        e.target.value as DiagnosisStatus,
                        reason,
                      ),
                    )
                  }
                >
                  {Object.entries(statusLabels).map(([v, label]) => (
                    <option key={v} value={v}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                دلیل اختیاری
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={600}
                />
              </label>
            </section>
            <section className="diagnosis-section">
              <h2>موجودیت‌های مرتبط</h2>
              {d.affectedEntities.map((r) => (
                <p key={r.domain + r.entityType + r.entityId}>
                  <Link href={r.route ?? "/advisor/insights"}>
                    {r.label ?? r.entityId}
                  </Link>{" "}
                  · {r.domain}
                </p>
              ))}
            </section>
            <section className="diagnosis-section">
              <h2>از الگو تا شاهد</h2>
              {d.patternIds.map((pid) => {
                const p = store.patterns.find((p) => p.id === pid);
                return (
                  p && (
                    <div key={pid}>
                      <h3>{p.title}</h3>
                      {p.signalIds.map((sid) => {
                        const s = store.signals.find((s) => s.id === sid);
                        return (
                          s && (
                            <details key={sid}>
                              <summary>
                                {s.title} · {signalLabels[s.status]}
                              </summary>
                              {s.evidenceIds.map((eid) => {
                                const e = store.evidence.find(
                                  (e) => e.id === eid,
                                );
                                return (
                                  e && (
                                    <div key={eid}>
                                      <p>{e.summary}</p>
                                      <small>
                                        {e.sourceSelector} ·{" "}
                                        {new Date(e.createdAt).toLocaleString(
                                          "fa-IR",
                                        )}
                                      </small>
                                      {e.route && (
                                        <p>
                                          <Link href={e.route}>
                                            مشاهده منبع
                                          </Link>
                                        </p>
                                      )}
                                    </div>
                                  )
                                );
                              })}
                            </details>
                          )
                        );
                      })}
                    </div>
                  )
                );
              })}
            </section>
            <RecommendationsPanel diagnosisId={d.id} />
            <section className="diagnosis-section">
              <h2>پیشنهاد بررسی</h2>
              {d.recommendations.map((r) => (
                <div key={r.id}>
                  <h3>{r.title}</h3>
                  <p>{r.summary}</p>
                </div>
              ))}
            </section>
            <section className="diagnosis-section">
              <h2>تاریخچه و شواهد ثابت</h2>
              {store.history
                .filter((h) => h.diagnosisId === d.id)
                .slice()
                .reverse()
                .map((h) => (
                  <details key={h.id}>
                    <summary>
                      {historyLabels[h.event]} ·{" "}
                      {new Date(h.timestamp).toLocaleString("fa-IR")}
                    </summary>
                    <p>{h.summary}</p>
                    {h.evidenceIds.map((eid) => (
                      <p key={eid}>
                        {store.evidence.find((e) => e.id === eid)?.summary}
                      </p>
                    ))}
                  </details>
                ))}
            </section>
          </>
        )
      ) : (
        <>
          <section className="diagnosis-section">
            <h2>سه اولویت اجرایی</h2>
            {store.priorities.length ? (
              store.priorities.map((p) => {
                const d = store.diagnoses.find((d) => d.id === p.diagnosisId)!;
                return (
                  <div key={p.id}>
                    <p>
                      {p.rank.toLocaleString("fa-IR")} · {p.reason}
                    </p>
                    <Card d={d} />
                  </div>
                );
              })
            ) : (
              <p>در داده‌های فعلی مسئله مهم و قابل اتکایی شناسایی نشد.</p>
            )}
          </section>
          {[
            [
              "مسائل جدید",
              active.filter(
                (d) =>
                  d.status === "New" &&
                  !["Opportunity", "DataQuality"].includes(d.category),
              ),
            ],
            [
              "فرصت‌های نوظهور",
              active.filter((d) => d.category === "Opportunity"),
            ],
            [
              "تحت پایش و بازبینی",
              active.filter((d) =>
                ["Reviewed", "Monitoring"].includes(d.status),
              ),
            ],
            ["کیفیت داده", active.filter((d) => d.category === "DataQuality")],
            [
              "اخیراً حل‌شده",
              store.diagnoses
                .filter((d) => d.status === "Resolved")
                .slice(-6)
                .reverse(),
            ],
          ].map(([title, items]) => (
            <section className="diagnosis-section" key={title as string}>
              <h2>{title as string}</h2>
              <div className="diagnosis-grid">
                {(items as AgentDiagnosis[]).map((d) => (
                  <Card key={d.id} d={d} />
                ))}
              </div>
              {!(items as AgentDiagnosis[]).length && (
                <p className="muted">موردی ثبت نشده است.</p>
              )}
            </section>
          ))}
        </>
      )}
      {debug && (
        <section className="diagnosis-section">
          <h2>جزئیات موتور تشخیص</h2>
          <pre dir="ltr">
            {JSON.stringify(
              {
                rules: diagnosisRules.map(({ evaluate, ...r }) => r),
                latest,
                signals: store.signals,
                patterns: store.patterns,
                priorities: store.priorities,
              },
              null,
              2,
            )}
          </pre>
        </section>
      )}
    </div>
  );
}
export function InsightsEntry() {
  const { store, stale } = useDiagnosis();
  const active = store.diagnoses.filter(
    (d) => !["Resolved", "Dismissed"].includes(d.status),
  );
  return (
    <section className="diagnosis-entry">
      <Link href="/advisor/insights">
        <strong>تحلیل‌های شناسایی‌شده</strong> ·{" "}
        {active.length.toLocaleString("fa-IR")} مسئله و فرصت
      </Link>
      <p>
        {stale
          ? "داده‌ها تغییر کرده‌اند؛ تحلیل را تازه‌سازی کنید."
          : store.priorities
              .map(
                (p) =>
                  store.diagnoses.find((d) => d.id === p.diagnosisId)?.title,
              )
              .join(" · ") || "تحلیل دستی وضعیت فعلی کسب‌وکار"}
      </p>
      {store.priorities.map((p) => (
        <p key={p.id}>
          <Link href={"/advisor/insights/" + p.diagnosisId}>
            بررسی اقدام بعدی: {store.diagnoses.find((d) => d.id === p.diagnosisId)?.title}
          </Link>
        </p>
      ))}
    </section>
  );
}
