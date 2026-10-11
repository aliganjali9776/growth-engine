"use client";
import { businessStorage } from "@/lib/saas/workspace-storage";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button, Panel, Drawer, Field } from "@/components/system/ui";
import {
  capabilityRegistry,
  defaultPermissions,
} from "@/lib/agent/capabilities";
import {
  readBusinessContext,
  buildContextPacket,
  type AgentReadContext,
} from "@/lib/agent/context";
import { AgentOrchestrator } from "@/lib/agent/orchestrator";
import {
  AgentActionExecutor,
  emptyAgentState,
  prepareAction,
  requestApproval,
  decideApproval,
  AgentError,
} from "@/lib/agent/actions";
import { loadAgent, saveAgent } from "@/lib/agent-storage";
import type {
  AgentState,
  AgentEvidence,
  AgentProposedAction,
} from "@/lib/agent/types";
import "@/components/system/system.css";
import "./agent.css";
const labels: Record<string, string> = {
  health: "سلامت",
  criticalProcesses: "فرآیندهای بحرانی",
  founderDependency: "وابستگی به بنیان‌گذار",
  ownershipRisks: "ریسک مالکیت",
  activeCycleId: "دوره فعال",
  objectives: "تعداد اهداف",
  krRisks: "موارد توجه استراتژی",
  focus: "تمرکز مدیریت",
  primaryConstraint: "گلوگاه اصلی",
  experiments: "تعداد آزمایش‌ها",
  candidates: "کاندیدهای رشد",
  capacityRisks: "ریسک‌های ظرفیت",
  funnel: "قیف منتخب",
  targetValue: "مقدار هدف",
  startValue: "مقدار مبنا",
  currentValue: "مقدار فعلی",
  lifecycle: "چرخه حیات",
  updatedAt: "آخرین تغییر",
  objectiveId: "شناسه هدف",
  type: "نوع",
  ownerRoleId: "مالک",
  status: "وضعیت",
  independence: "استقلال",
  reasons: "دلایل",
  gap: "شکاف ظرفیت",
  severity: "شدت",
  target: "هدف",
  current: "فعلی",
  weight: "وزن",
  result: "نتیجه",
  rationale: "دلیل",
  Metric: "شاخص",
  Status: "وضعیت",
  Risk: "ریسک",
  Capacity: "ظرفیت",
  Process: "فرآیند",
  Constraint: "گلوگاه",
  Learning: "یادگیری",
  HistoricalRecord: "سابقه",
  Relationship: "رابطه",
  active: "فعال",
  high: "زیاد",
  critical: "بحرانی",
  medium: "متوسط",
  low: "کم",
  early: "شواهد اولیه",
  insufficient: "داده ناکافی",
  partial: "موفقیت نسبی",
  win: "موفق",
  atRisk: "در معرض ریسک",
  offTrack: "خارج از مسیر",
  System: "سیستم",
  Strategy: "استراتژی",
  Scale: "رشد",
  Executive: "مدیریت",
  CrossModule: "میان‌ماژولی",
  Observe: "مشاهده",
  Recommend: "توصیه",
  Prepare: "آماده‌سازی",
  Execute: "اجرای تأییدشده",
  Low: "کم",
  Medium: "متوسط",
  High: "بالا",
  Critical: "بحرانی",
  Draft: "پیش‌نویس",
  ReadyForApproval: "در انتظار تأیید",
  Approved: "تأییدشده",
  Rejected: "ردشده",
  Executed: "شبیه‌سازی انجام شد",
  Failed: "ناموفق",
  Cancelled: "لغوشده",
  Pending: "در انتظار",
  Expired: "منقضی",
};
export function EvidenceChip({ e }: { e: AgentEvidence }) {
  const readable = (v: unknown): string =>
    v == null
      ? "نامشخص"
      : Array.isArray(v)
        ? v.map(readable).join("؛ ")
        : typeof v === "object"
          ? Object.entries(v)
              .map(([k, x]) => `${labels[k] ?? k}: ${readable(x)}`)
              .join(" · ")
          : (labels[String(v)] ?? String(v));
  return (
    <Link className="agent-evidence" href={e.route ?? "/dev/agent"}>
      <span>
        {labels[e.domain]} · {labels[e.evidenceType] ?? e.evidenceType}
      </span>
      <strong>{e.title}</strong>
      <small>{readable(e.value ?? e.summary)}</small>
      <small>منبع: {e.sourceSelector ?? "وضعیت ثبت‌شده"}</small>
    </Link>
  );
}
export function ActionPreview({
  p,
  evidence,
}: {
  p: AgentProposedAction;
  evidence: AgentEvidence[];
}) {
  return (
    <div className="agent-preview">
      <h3>{p.title}</h3>
      <p>{p.rationale}</p>
      <p>ریسک: {labels[p.risk]} · تأیید الزامی · فقط شبیه‌سازی</p>
      <div className="agent-grid">
        <div>
          <h4>وضعیت هنگام تهیه</h4>
          {Object.entries(p.expectedCurrentState).map(([k, v]) => (
            <p key={k}>
              <b>{labels[k] ?? k}</b>:{" "}
              {labels[String(v)] ?? String(v ?? "نامشخص")}
            </p>
          ))}
        </div>
        <div>
          <h4>تغییر پیشنهادی</h4>
          <p>{String(p.payload.value)}</p>
          <p>وضعیت: {labels[p.status]}</p>
          {p.affectedEntities.map((e) => (
            <Link key={e.entityId} href={e.route ?? "/dev/agent"}>
              {e.label}
            </Link>
          ))}
        </div>
      </div>
      <p>
        هشدار: این پیش‌نمایش مجوز تغییر داده کسب‌وکار نیست. اجرا در این مرحله
        اتصال نوشتن ندارد.
      </p>
      <div className="agent-grid">
        {evidence
          .filter((e) => p.evidenceIds.includes(e.id))
          .map((e) => (
            <EvidenceChip key={e.id} e={e} />
          ))}
      </div>
    </div>
  );
}
export function AgentLab() {
  const [ctx, setCtx] = useState<AgentReadContext | null>(null),
    [state, setState] = useState<AgentState>(emptyAgentState),
    [message, setMessage] = useState(""),
    [blocked, setBlocked] = useState(false),
    [selected, setSelected] = useState(""),
    [value, setValue] = useState("700"),
    [dialog, setDialog] = useState<string | null>(null),
    [reason, setReason] = useState("Not now"),
    [topic, setTopic] = useState("Executive3S");
  const raw = useRef<string | null>(null);
  const refresh = () => {
    setCtx(readBusinessContext(businessStorage));
    const loaded = loadAgent(businessStorage);
    raw.current = loaded.raw;
    setState(loaded.state);
    setBlocked(!!loaded.warning);
    if (loaded.warning) setMessage(loaded.warning);
  };
  useEffect(() => {
    refresh();
    const onStorage = () => {
      setBlocked(true);
      setMessage("داده در زبانه دیگری تغییر کرده است؛ صفحه را تازه کنید.");
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  function commit(fn: (s: AgentState, c: AgentReadContext) => string) {
    try {
      if (blocked)
        throw Error(
          "برای ادامه داده آزمایشی را بازنشانی یا صفحه را تازه کنید.",
        );
      const next = structuredClone(state),
        live = readBusinessContext(businessStorage);
      const result = fn(next, live);
      raw.current = saveAgent(businessStorage, next, raw.current);
      setState(next);
      setCtx(live);
      setMessage(result);
    } catch (e) {
      setMessage(
        e instanceof AgentError
          ? `${e.code}: ${e.message}`
          : e instanceof Error
            ? e.message
            : "عملیات ممکن نشد.",
      );
    }
  }
  const ks =
    ctx?.entities.filter(
      (e) =>
        e.ref.entityType === "KR" &&
        ["increase", "decrease", "maintain"].includes(String(e.state.type)),
    ) ?? [];
  const packet = ctx
    ? buildContextPacket(
        ctx,
        topic,
        topic === "Executive3S"
          ? undefined
          : ctx.entities.find((e) => e.ref.entityType === topic)?.ref,
      )
    : null;
  if (!ctx) return <p role="status">در حال خواندن منابع محلی…</p>;
  return (
    <div className="agent-lab">
      <header className="agent-hero">
        <span>BUILD 6A · DEVELOPMENT LAB</span>
        <h1>معماری ایمن Agent</h1>
        <p>
          توسعه / آزمایشی · مشاهده ← شواهد ← توصیه ← پیش‌نویس ← تأیید ←
          شبیه‌سازی
        </p>
        <div className="agent-tags">
          <span>بدون مدل هوش مصنوعی</span>
          <span>بدون تغییر داده کسب‌وکار</span>
          <span>تأیید برای تمام اقدام‌ها</span>
        </div>
        <Button
          secondary
          onClick={() => {
            refresh();
            setMessage("منابع دوباره خوانده شدند.");
          }}
        >
          تازه‌سازی منابع
        </Button>
      </header>
      <p className="agent-notice" role="status" aria-live="polite">
        {message || "فضای آزمایشی آماده است؛ تمام اجراها dry-run هستند."}
      </p>
      {blocked && (
        <Button
          onClick={() => {
            try {
              raw.current = saveAgent(
                businessStorage,
                emptyAgentState(),
                raw.current,
              );
              setBlocked(false);
              setState(emptyAgentState());
              setMessage("فقط فضای Agent بازنشانی شد.");
            } catch (e) {
              setMessage(e instanceof Error ? e.message : "خطا");
            }
          }}
        >
          بازنشانی فقط داده آزمایشی Agent
        </Button>
      )}
      <Panel
        title="۱. وضعیت معماری"
        caption="هیچ اتصال خارجی، مدل یا ابزار نوشتن فعال نیست."
      >
        <div className="agent-grid">
          {Object.entries(ctx.snapshot)
            .filter(([k]) => k !== "generatedAt")
            .map(([k, v]) => (
              <article key={k}>
                <h3>{labels[k]}</h3>
                {Object.entries(v).map(([field, val]) => (
                  <p key={field}>
                    <span>{labels[field] ?? field}</span>:{" "}
                    {String(val ?? "نامشخص")}
                  </p>
                ))}
              </article>
            ))}
        </div>
        {ctx.notices.map((n, i) => (
          <p key={i}>{n}</p>
        ))}
      </Panel>
      <Panel
        title="۲. فهرست قابلیت‌ها"
        caption={`${capabilityRegistry.length} قابلیت تعریف‌شده؛ قراردادهای نوشتن فقط شبیه‌سازی هستند.`}
      >
        <div className="agent-table">
          <table>
            <thead>
              <tr>
                {["قابلیت", "حوزه", "اختیار", "ریسک", "تأیید", "وضعیت"].map(
                  (h) => (
                    <th key={h}>{h}</th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {capabilityRegistry.map((c) => (
                <tr key={c.id}>
                  <td>
                    <details>
                      <summary dir="ltr">{c.id}</summary>
                      <p>{c.description}</p>
                      <p>ورودی: {JSON.stringify(c.inputSchema)}</p>
                      <p>خروجی: {c.outputSchema}</p>
                      <p>مجوز: {c.requiredPermissions.join(", ")}</p>
                    </details>
                  </td>
                  <td>{labels[c.domain]}</td>
                  <td>{labels[c.authorityLevel]}</td>
                  <td>{labels[c.riskLevel]}</td>
                  <td>{c.requiresApproval ? "همیشه الزامی" : "لازم نیست"}</td>
                  <td>
                    {c.enabled
                      ? "فعال" +
                        (c.authorityLevel === "Execute" ? " · شبیه‌سازی" : "")
                      : "غیرفعال"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel
        title="۳. ماتریس مجوزها"
        caption="داشتن دسترسی کاربر به معنی اجازه اجرای خودکار Agent نیست."
      >
        <div className="agent-table">
          <table>
            <thead>
              <tr>
                <th>حوزه</th>
                {["Observe", "Recommend", "Prepare", "Execute"].map((a) => (
                  <th key={a}>{labels[a]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {["System", "Strategy", "Scale", "Executive", "CrossModule"].map(
                (d) => (
                  <tr key={d}>
                    <th>{labels[d]}</th>
                    {["Observe", "Recommend", "Prepare", "Execute"].map((a) => (
                      <td key={a}>
                        {capabilityRegistry.some(
                          (c) =>
                            c.domain === d &&
                            c.authorityLevel === a &&
                            defaultPermissions.some(
                              (p) => p.capabilityId === c.id && p.allowed,
                            ),
                        )
                          ? a === "Execute"
                            ? "فقط تأییدشده · شبیه‌سازی"
                            : "مجاز"
                          : "تعریف نشده"}
                      </td>
                    ))}
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel
        title="۴. مرور شواهد"
        caption="شواهد هنگام ساخت پیشنهاد ثبت می‌شوند؛ تغییر منبع، نسخه قبلی را بازنویسی نمی‌کند."
      >
        <div className="agent-grid">
          {ctx.evidence.map((e) => (
            <EvidenceChip e={e} key={e.id} />
          ))}
        </div>
      </Panel>
      <Panel
        title="۵. پیش‌نمایش زمینه"
        caption={`${packet?.evidence.length} شاهد · ${new TextEncoder().encode(JSON.stringify(packet)).length.toLocaleString("fa-IR")} بایت؛ داده کامل ماژول‌ها منتقل نمی‌شود.`}
      >
        <Field label="نوع زمینه">
          <select value={topic} onChange={(e) => setTopic(e.target.value)}>
            <option value="Executive3S">مدیریت سه ماژول</option>
            <option value="process">فرآیند سیستم</option>
            <option value="objective">هدف استراتژی</option>
            <option value="KR">نتیجه کلیدی</option>
            <option value="constraint">گلوگاه رشد</option>
            <option value="experiment">آزمایش رشد</option>
          </select>
        </Field>
        <div className="agent-grid">
          {packet?.entities.map((e) => (
            <article key={e.domain + e.entityType + e.entityId}>
              <h3>{e.label}</h3>
              <Link href={e.route ?? "/dev/agent"}>باز کردن منبع</Link>
            </article>
          ))}
        </div>
        <details>
          <summary>جزئیات فنی زمینه</summary>
          <pre dir="ltr">{JSON.stringify(packet, null, 2)}</pre>
        </details>
      </Panel>
      <Panel
        title="۶. نمونه توصیهٔ مبتنی بر قواعد"
        caption="سه قاعده محدود؛ اطمینان، قدرت شواهد است و احتمال موفقیت نیست."
      >
        <Button
          disabled={blocked}
          onClick={() =>
            commit((s, c) => {
              const r = new AgentOrchestrator().recommend(s, c);
              return r.length
                ? `${r.length} توصیه با شواهد ثبت شد.`
                : "هیچ‌کدام از سه قاعده با داده فعلی تطبیق ندارد.";
            })
          }
        >
          تولید توصیه از داده فعلی
        </Button>
        {state.recommendations.slice(-3).map((r) => (
          <article className="agent-recommendation" key={r.id}>
            <h3>{r.title}</h3>
            <p>{r.rationale}</p>
            <p>
              اولویت: {labels[r.priority]} · اطمینان شواهد:{" "}
              {labels[r.confidence]}
            </p>
            <div className="agent-grid">
              {state.evidence
                .filter((e) => r.evidenceIds.includes(e.id))
                .map((e) => (
                  <EvidenceChip key={e.id} e={e} />
                ))}
            </div>
            {r.suggestedActions.map((id) => (
              <Button
                key={id}
                secondary
                onClick={() => {
                  const draft = new AgentOrchestrator().invoke(id, {}, ctx);
                  setMessage(
                    draft.success
                      ? "پیش‌نویس زمینه آماده شد؛ داده کسب‌وکار تغییر نکرد."
                      : (draft.error?.message ?? "خطا"),
                  );
                }}
              >
                {id} · پیش‌نویس
              </Button>
            ))}
          </article>
        ))}
        <p>مشاهدات ثبت‌شده: {state.observations.length}</p>
      </Panel>
      <Panel
        title="۷. پیش‌نمایش اقدام پیشنهادی"
        caption="نمونه هدف KR: پیش‌نویس نیز هیچ تغییری در استراتژی ایجاد نمی‌کند."
      >
        <div className="agent-grid">
          <Field label="نتیجه کلیدی برای شبیه‌سازی">
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">انتخاب کنید</option>
              {ks.map((k) => (
                <option key={k.ref.entityId} value={k.ref.entityId}>
                  {k.ref.label} · هدف {String(k.state.targetValue)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="هدف پیشنهادی">
            <input
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </Field>
        </div>
        <Button
          disabled={!selected || blocked}
          onClick={() =>
            commit((s, c) => {
              prepareAction(
                s,
                c,
                "strategy.updateKRTarget",
                {
                  entityId: selected,
                  value: value.trim() ? Number(value) : NaN,
                },
                c.evidence
                  .filter(
                    (e) =>
                      e.domain === "Strategy" &&
                      (!e.entityRef || e.entityRef.entityId === selected),
                  )
                  .slice(0, 3)
                  .map((e) => e.id),
              );
              return "پیش‌نویس ساخته شد؛ هدف واقعی تغییر نکرد.";
            })
          }
        >
          تهیه پیشنهاد شبیه‌سازی
        </Button>
        {!ks.length && (
          <p>
            KR عددی موجود نیست؛ برای این نمونه داده ساختگی وارد ماژول نمی‌کنیم.
          </p>
        )}
        {state.proposals
          .slice(-4)
          .reverse()
          .map((p) => (
            <article key={p.id}>
              <ActionPreview p={p} evidence={state.evidence} />
              {p.status === "Draft" && (
                <Button
                  onClick={() =>
                    commit((s) => {
                      requestApproval(s, p.id);
                      return "درخواست تأیید ثبت شد.";
                    })
                  }
                >
                  درخواست تأیید
                </Button>
              )}
              {p.status === "Approved" && (
                <div className="agent-actions">
                  <Button
                    onClick={() =>
                      commit(
                        (s, c) =>
                          new AgentActionExecutor().execute(s, p.id, (ref) =>
                            c.entities.find(
                              (e) =>
                                e.ref.domain === ref.domain &&
                                e.ref.entityType === ref.entityType &&
                                e.ref.entityId === ref.entityId,
                            ),
                          ).summary,
                      )
                    }
                  >
                    اجرای شبیه‌سازی
                  </Button>
                  <Button
                    secondary
                    onClick={() =>
                      commit(
                        (s, c) =>
                          new AgentActionExecutor().execute(s, p.id, (ref) => {
                            const e = c.entities.find(
                              (e) =>
                                e.ref.entityId === ref.entityId &&
                                e.ref.domain === ref.domain &&
                                e.ref.entityType === ref.entityType,
                            );
                            return e
                              ? {
                                  ...e,
                                  state: {
                                    ...e.state,
                                    targetValue: 600,
                                    simulationConflict: true,
                                  },
                                }
                              : undefined;
                          }).summary,
                      )
                    }
                  >
                    آزمون تعارض در نسخه شبیه‌سازی
                  </Button>
                </div>
              )}
              {["Rejected", "Executed", "Failed"].includes(p.status) && (
                <Button
                  secondary
                  onClick={() =>
                    commit(
                      (s, c) =>
                        new AgentActionExecutor().execute(s, p.id, (ref) =>
                          c.entities.find(
                            (e) =>
                              e.ref.domain === ref.domain &&
                              e.ref.entityType === ref.entityType &&
                              e.ref.entityId === ref.entityId,
                          ),
                        ).summary,
                    )
                  }
                >
                  بررسی مسدود بودن اجرای مجدد
                </Button>
              )}
            </article>
          ))}
      </Panel>
      <Panel
        title="۸. صف تأیید"
        caption="تأیید به همین پیشنهاد و شواهد آن متصل است؛ اعتبار ۲۴ ساعت."
      >
        {state.approvals
          .slice(-5)
          .reverse()
          .map((a) => (
            <article className="agent-approval" key={a.id}>
              <h3>{a.title}</h3>
              <p>
                ریسک: {labels[a.risk]} · {labels[a.status]}
              </p>
              {a.status === "Pending" && (
                <Button onClick={() => setDialog(a.id)}>بررسی درخواست</Button>
              )}
              {a.rejectionReason && <p>دلیل رد: {a.rejectionReason}</p>}
            </article>
          ))}
      </Panel>
      <Panel
        title="۹. تاریخچهٔ حسابرسی"
        caption="تاریخچه فقط مربوط به Agent است؛ رویداد اجرا به معنی شبیه‌سازی است."
      >
        {state.audit
          .slice(-30)
          .reverse()
          .map((a) => (
            <article className="agent-audit" key={a.id}>
              <strong>{a.event}</strong>
              <p>{a.summary}</p>
              <small>
                {new Date(a.timestamp).toLocaleString("fa-IR")} · dry-run{" "}
                {a.errorCode && `· ${a.errorCode}`}
              </small>
            </article>
          ))}
      </Panel>
      <Drawer
        open={!!dialog}
        onClose={() => setDialog(null)}
        title="بررسی درخواست شبیه‌سازی"
        description="تأیید شما فقط اجازه شبیه‌سازی همین پیشنهاد را می‌دهد؛ هیچ داده کسب‌وکار تغییر نمی‌کند."
      >
        {dialog &&
          (() => {
            const a = state.approvals.find((a) => a.id === dialog),
              p = state.proposals.find((p) => p.id === a?.proposedActionId);
            return p ? (
              <>
                <ActionPreview p={p} evidence={state.evidence} />
                <Field label="دلیل رد">
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  >
                    {[
                      ["Not relevant", "نامرتبط"],
                      ["Insufficient evidence", "شواهد ناکافی"],
                      ["Wrong recommendation", "توصیه نادرست"],
                      ["Not now", "فعلاً نه"],
                      ["Other", "سایر"],
                    ].map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="agent-actions">
                  <Button
                    onClick={() => {
                      commit((s) => {
                        decideApproval(s, dialog, true);
                        return "شبیه‌سازی تأیید شد؛ هنوز اجرا نشده است.";
                      });
                      setDialog(null);
                    }}
                  >
                    تأیید فقط شبیه‌سازی
                  </Button>
                  <Button
                    secondary
                    onClick={() => {
                      commit((s) => {
                        decideApproval(s, dialog, false, reason);
                        return "پیشنهاد رد شد و قابل اجرا نیست.";
                      });
                      setDialog(null);
                    }}
                  >
                    رد پیشنهاد
                  </Button>
                </div>
              </>
            ) : null;
          })()}
      </Drawer>
    </div>
  );
}
