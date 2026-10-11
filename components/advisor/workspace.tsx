"use client";
import { businessStorage } from "@/lib/saas/workspace-storage";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdvisorNavigation } from "./navigation";
import { ActionsPage } from "./actions";
import { executionDisposition, useExecutions } from "./execution";
import {
  AdvisorTextBlock,
  EvidenceBlock,
  DiagnosisBlock,
  RecommendationBlock,
  ActionDraftBlock,
  ApprovalBlock,
  ExecutionResultBlock,
  DataGapBlock,
  RelationshipBlock,
} from "./workspace-blocks";
import { AgentOrchestrator } from "@/lib/agent/orchestrator";
import {
  contextLabels,
  newWorkspaceSession,
  contextualOptions,
  contextualRecommendation,
  businessEvidenceText,
  workspaceEvidenceSnapshot,
  workspaceHistory,
  workspaceRequestMatches,
  relatedEntities,
  draftTextInput,
  type WorkspaceContext,
  type WorkspaceSession,
  type WorkspaceMessage,
  type WorkspaceOption,
  type ArtifactRef,
} from "@/lib/agent/workspace";
import {
  emptyWorkspace,
  readWorkspace,
  saveWorkspace,
  importAdvisorSession,
  type WorkspaceStore,
} from "@/lib/workspace-storage";
import {
  buildAdvisorContext,
  parseSelection,
} from "@/lib/agent/advisor/context";
import type {
  AgentAdvisorResponse,
  AdvisorSelection,
} from "@/lib/agent/advisor/types";
import { missingMetricMessage } from "@/lib/agent/advisor/metrics";
import {
  preparationContext,
  findEntity,
} from "@/lib/agent/preparation/context";
import { readPreparation, savePreparation } from "@/lib/preparation-storage";
import {
  generateRecommendation,
  prepareDraft,
  editDraft,
} from "@/lib/agent/preparation/engine";
import { template, getField } from "@/lib/agent/preparation/templates";
import { readDiagnosis, saveDiagnosis } from "@/lib/diagnosis-storage";
import { collectDiagnosisSignals } from "@/lib/agent/diagnosis/source";
import { runDiagnosis, setDiagnosisStatus } from "@/lib/agent/diagnosis/engine";
import { validateAgentProposedAction } from "@/lib/agent/preparation/validation";
import { Drawer } from "@/components/system/ui";
import "./advisor.css";
import "./actions.css";
import "./workspace.css";
type Context = ReturnType<typeof buildAdvisorContext>;
const domains: Record<string, string> = {
  System: "سیستم",
  Strategy: "استراتژی",
  Scale: "اسکیل",
  Executive: "کسب‌وکار",
  CrossModule: "بین‌بخشی",
};
function useWorkspaceStore() {
  const [store, setStore] = useState<WorkspaceStore>(emptyWorkspace),
    [error, setError] = useState(""),
    [loaded, setLoaded] = useState(false);
  const raw = useRef<string | null>(null),
    current = useRef(store);
  const refresh = useCallback(() => {
    const r = readWorkspace(businessStorage);
    raw.current = r.raw;
    current.current = r.store;
    setStore(r.store);
    setError(r.error ?? "");
    setLoaded(true);
  }, []);
  useEffect(() => {
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("workspace-saved", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("workspace-saved", refresh);
    };
  }, [refresh]);
  function commit(fn: (s: WorkspaceStore) => void) {
    if (error) return false;
    try {
      const next = structuredClone(current.current);
      fn(next);
      raw.current = saveWorkspace(businessStorage, next, raw.current);
      current.current = next;
      setStore(next);
      window.dispatchEvent(new Event("workspace-saved"));
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "ذخیره گفت‌وگو ممکن نشد.");
      return false;
    }
  }
  return {
    store,
    error,
    loaded,
    commit,
    refresh,
    currentSession: () =>
      current.current.sessions.find(
        (s) => s.id === current.current.activeSessionId,
      ),
  };
}
function businessContext(sel: WorkspaceContext): AdvisorSelection {
  return sel.type === "candidate" || sel.type === "diagnosis"
    ? { type: "executive" }
    : (sel as AdvisorSelection);
}
function sourceContext(sel: WorkspaceContext) {
  const c = preparationContext(businessStorage);
  return c.entities.find(
    (e) =>
      e.ref.entityType === (sel.type === "kr" ? "KR" : sel.type) &&
      e.ref.entityId === sel.id,
  );
}
export function WorkspacePage() {
  const router = useRouter();
  const {
    store,
    error: storageError,
    loaded,
    commit,
    refresh: reloadSessions,
    currentSession,
  } = useWorkspaceStore();
  const [context, setContext] = useState<Context | null>(null),
    [data, setData] = useState<ReturnType<typeof preparationContext> | null>(
      null,
    ),
    [preparation, setPreparation] = useState<
      ReturnType<typeof readPreparation>["state"] | null
    >(null),
    [question, setQuestion] = useState(""),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [changed, setChanged] = useState(false),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState<{
      connected: boolean;
      demoAllowed?: boolean;
    } | null>(null),
    [selected, setSelected] = useState<string>(),
    [showEvidence, setShowEvidence] = useState(true),
    [windowSize, setWindowSize] = useState(30),
    [control, setControl] = useState<{
      kind: "approve" | "execute" | "reject";
      nonce: number;
    }>(),
    [pendingSwitch, setPendingSwitch] = useState<WorkspaceContext | null>(null),
    [contextChoice, setContextChoice] = useState("executive"),
    [demo, setDemo] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null),
    initialized = useRef(false),
    controller = useRef<AbortController | null>(null),
    previousFingerprint = useRef<string | undefined>(undefined);
  const [contextExpanded, setContextExpanded] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 951px)");
    const sync = () => setContextExpanded(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  const executions = useExecutions();
  const session =
    store.sessions.find((s) => s.id === store.activeSessionId) ?? null;
  const activeContext =
    session?.activeContext ?? ({ type: "executive" } as WorkspaceContext);
  useEffect(
    () => () => controller.current?.abort(),
    [session?.id, activeContext.type, activeContext.id],
  );
  const activeAction = preparation?.actions.find(
    (a) => a.id === session?.activeActionId,
  );
  const diagnosis = data?.diagnosis.diagnoses.find(
    (d) => d.id === session?.activeDiagnosisId,
  );
  const entities =
    data?.entities.filter((e) =>
      [
        "process",
        "objective",
        "KR",
        "constraint",
        "experiment",
        "candidate",
      ].includes(e.ref.entityType),
    ) ?? [];
  const activeEntity = data?.entities.find(
    (e) =>
      e.ref.entityType ===
        (activeContext.type === "kr" ? "KR" : activeContext.type) &&
      e.ref.entityId === activeContext.id,
  );
  const label =
    activeEntity?.ref.label ??
    diagnosis?.title ??
    contextLabels[activeContext.type];
  function update(fn: (s: WorkspaceSession) => void) {
    return commit((st) => {
      const s = st.sessions.find((s) => s.id === st.activeSessionId);
      if (!s) throw Error("ابتدا گفت‌وگو را شروع کنید.");
      fn(s);
      s.updatedAt = s.lastActivityAt = new Date().toISOString();
    });
  }
  function message(
    role: WorkspaceMessage["role"],
    content: string,
    refs: ArtifactRef[] = [],
    evidence = context?.packet.evidence ?? [],
  ) {
    update((s) => {
      if (s.messages.length >= 1000)
        throw Error("این گفت‌وگو به سقف پیام رسیده است؛ گفت‌وگوی جدید بسازید.");
      s.messages.push({
        id: crypto.randomUUID(),
        role,
        content: content.slice(0, 4000),
        context: structuredClone(activeContext),
        refs,
        evidence: role === "advisor" ? workspaceEvidenceSnapshot(evidence) : [],
        at: new Date().toISOString(),
      });
    });
  }
  function fresh(sel: WorkspaceContext = activeContext) {
    try {
      const d = preparationContext(businessStorage),
        p = readPreparation(businessStorage);
      if (p.error) throw Error(p.error);
      const c = buildAdvisorContext(
        businessStorage,
        "وضعیت موضوع انتخاب‌شده",
        businessContext(sel),
        [],
        undefined,
        true,
      );
      if (sel.type === "candidate") {
        const candidate = d.entities.find(
          (e) => e.ref.entityType === "candidate" && e.ref.entityId === sel.id,
        );
        if (!candidate)
          throw Error("فرصت انتخاب‌شده دیگر در این مرورگر وجود ندارد.");
        c.packet.evidence = c.packet.evidence.filter(
          (e) => e.entityRef?.entityId === sel.id,
        );
        c.packet.metrics = c.packet.metrics.filter((e) =>
          c.packet.evidence.includes(e),
        );
        c.packet.risks = c.packet.risks.filter((e) =>
          c.packet.evidence.includes(e),
        );
        c.packet.historySummary = [];
        c.packet.entities = [candidate.ref];
      }
      if (
        previousFingerprint.current &&
        previousFingerprint.current !== c.fingerprint
      )
        setChanged(true);
      previousFingerprint.current = c.fingerprint;
      setContext(c);
      setData(d);
      setPreparation(p.state);
      setError("");
      return { c, d, p };
    } catch (e) {
      setError(e instanceof Error ? e.message : "خواندن زمینه ممکن نشد.");
      setContext(null);
      return null;
    }
  }
  useEffect(() => {
    if (!loaded || initialized.current) return;
    initialized.current = true;
    const imported = importAdvisorSession(businessStorage, store);
    if (imported.sessions.length !== store.sessions.length)
      commit((s) => Object.assign(s, imported));
    const params = new URLSearchParams(location.search);
    if (params.has("session")) {
      const resume = imported.sessions.find(
        (s) => s.id === params.get("session"),
      );
      if (resume)
        commit((st) => {
          st.activeSessionId = resume.id;
        });
      else setError("گفت‌وگوی انتخاب‌شده در این مرورگر وجود ندارد.");
    } else if (params.has("action")) {
      const action = readPreparation(businessStorage).state.actions.find(
        (a) => a.id === params.get("action"),
      );
      if (action) {
        const prior = imported.sessions.find(
          (s) =>
            s.activeActionId === action.id ||
            s.messages.some((m) =>
              m.refs.some((r) => r.type === "action" && r.id === action.id),
            ),
        );
        if (prior)
          commit((st) => {
            st.activeSessionId = prior.id;
            const s = st.sessions.find((x) => x.id === prior.id)!;
            s.activeActionId = action.id;
            s.workspaceState = "ActionReview";
          });
        else {
          const s = newWorkspaceSession({ type: "executive" }, action.title);
          s.activeActionId = action.id;
          s.workspaceState = "ActionReview";
          commit((st) => {
            st.sessions.unshift(s);
            st.activeSessionId = s.id;
          });
        }
      } else setError("اقدام انتخاب‌شده در این مرورگر وجود ندارد.");
    } else if (params.has("context")) {
      try {
        const type = params.get("context");
        const id = params.get("id");
        const sel: WorkspaceContext =
          type === "candidate" || type === "diagnosis"
            ? { type, id: id ?? "" }
            : parseSelection(type, id);
        if (
          sel.type !== "executive" &&
          !/^[a-zA-Z0-9_-]{1,160}$/.test(sel.id ?? "")
        )
          throw Error("زمینه معتبر نیست.");
        const entity = sourceContext(sel);
        if (sel.type !== "executive" && sel.type !== "diagnosis" && !entity)
          throw Error("موضوع در این مرورگر پیدا نشد.");
        const recent = imported.sessions.find(
          (s) =>
            s.activeContext.type === sel.type && s.activeContext.id === sel.id,
        );
        if (recent)
          commit((s) => {
            s.activeSessionId = recent.id;
          });
        else start(sel, entity?.ref.label);
      } catch (e) {
        setError(e instanceof Error ? e.message : "زمینه معتبر نیست.");
      }
    } else fresh({ type: "executive" });
    fetch("/api/advisor", { cache: "no-store" })
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ connected: false }));
    return () => controller.current?.abort();
  }, [loaded]);
  useEffect(() => {
    if (!loaded) return;
    setSelected(session?.selectedOptionId);
    setControl(undefined);
    setWindowSize(30);
    setContextChoice(
      activeContext.type === "executive"
        ? "executive"
        : `${activeContext.type}:${activeContext.id}`,
    );
    previousFingerprint.current = undefined;
    setChanged(false);
    fresh();
  }, [session?.id, activeContext.type, activeContext.id]);
  useEffect(() => {
    if (!loaded) return;
    const listener = () => fresh();
    for (const event of [
      "focus",
      "storage",
      "preparation-saved",
      "execution-saved",
      "diagnosis-saved",
    ])
      window.addEventListener(event, listener);
    return () => {
      for (const event of [
        "focus",
        "storage",
        "preparation-saved",
        "execution-saved",
        "diagnosis-saved",
      ])
        window.removeEventListener(event, listener);
    };
  }, [loaded, activeContext.type, activeContext.id]);
  function start(
    sel: WorkspaceContext = { type: "executive" },
    title?: string,
  ) {
    if (!loaded) return;
    if (store.sessions.length >= 100) {
      setError("سقف صد گفت‌وگوی محلی رسیده است؛ تاریخچه حفظ شد.");
      return;
    }
    const s = newWorkspaceSession(sel, title);
    if (sel.type === "diagnosis") s.activeDiagnosisId = sel.id;
    commit((st) => {
      st.sessions.unshift(s);
      st.activeSessionId = s.id;
    });
    router.replace(`/advisor/workspace?session=${encodeURIComponent(s.id)}`);
    setNotice("گفت‌وگوی جدید آماده است.");
  }
  function ensureSession() {
    if (session) return session;
    const s = newWorkspaceSession(activeContext, label);
    commit((st) => {
      st.sessions.unshift(s);
      st.activeSessionId = s.id;
    });
    router.replace(`/advisor/workspace?session=${encodeURIComponent(s.id)}`);
    return s;
  }
  const contextual = data ? contextualOptions(data, activeContext) : [];
  const recommendation = preparation?.recommendations.find(
    (r) => r.id === session?.activeRecommendationId,
  );
  const diagnosedOptions: WorkspaceOption[] =
    recommendation?.actionOptions.slice(0, 3).map((o) => {
      const t = template(o.templateId);
      const targets =
        diagnosis?.affectedEntities.filter(
          (r) => r.entityType === t.targetType,
        ) ??
        contextual
          .filter((x) => x.templateId === o.templateId)
          .flatMap((x) => {
            const e = data?.entities.find(
              (e) =>
                e.ref.entityId === x.targetId &&
                e.ref.entityType === t.targetType,
            );
            return e ? [e.ref] : [];
          });
      return {
        id: o.id,
        title: o.title,
        templateId: o.templateId,
        targetId: targets.length === 1 ? targets[0].entityId : "",
        targetLabel:
          targets.length === 1
            ? (targets[0].label ?? "موضوع مرتبط")
            : "موضوع را هنگام آماده‌سازی انتخاب کنید",
        why: recommendation.primaryReason,
        diagnosisId: diagnosis?.id,
        recommendationId: recommendation.id,
        optionId: o.id,
      };
    }) ?? [];
  const options = (
    diagnosedOptions.length ? diagnosedOptions : contextual
  ).filter((o) => !session?.dismissedOptions.includes(o.id));
  function prepare(option: WorkspaceOption, variant = false) {
    ensureSession();
    try {
      const f = fresh();
      if (!f) return;
      const a = prepareDraft(f.p.state, f.d, {
        templateId: option.templateId,
        variant,
        targetEntityId: option.targetId || undefined,
        diagnosisId: option.diagnosisId,
        recommendationId: option.recommendationId,
        optionId: option.optionId,
        origin: "AdvisorRequest",
        evidence: option.diagnosisId
          ? undefined
          : f.c.packet.evidence.slice(0, 6),
        reason: option.why,
      });
      savePreparation(businessStorage, f.p.state, f.p.raw);
      window.dispatchEvent(new Event("preparation-saved"));
      update((s) => {
        s.activeActionId = a.id;
        s.workspaceState = "ActionReview";
      });
      message(
        "advisor",
        a.status === "Executed"
          ? `اقدام «${a.title}» قبلاً اجرا شده است؛ نتیجه قبلی باز شد. برای تغییر تازه، پیش‌نویس تازه بسازید.`
          : `پیش‌نویس «${a.title}» آماده شد. هیچ داده کسب‌وکار تغییر نکرده است.`,
        [{ type: "action", id: a.id }],
      );
      setNotice("اطلاعات لازم را در فرم همین صفحه تکمیل کنید.");
      fresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "آماده‌سازی ممکن نشد.");
    }
  }
  function scan() {
    ensureSession();
    try {
      const read = readDiagnosis(businessStorage);
      if (read.error) throw Error(read.error);
      const next = runDiagnosis(
        read.state,
        collectDiagnosisSignals(businessStorage),
      );
      saveDiagnosis(businessStorage, next, read.raw);
      update((s) => {
        s.workspaceState = "Diagnosis";
        s.activeDiagnosisId = undefined;
        s.activeRecommendationId = undefined;
      });
      message(
        "advisor",
        "تحلیل دستی با داده‌های فعلی انجام شد. نبود شواهد به معنی نبود مسئله نیست.",
        [],
        next.evidence.slice(0, 6),
      );
      fresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تحلیل ممکن نشد.");
    }
  }
  function reviewDiagnosis(id: string) {
    ensureSession();
    try {
      const r = readDiagnosis(businessStorage);
      setDiagnosisStatus(r.state, id, "Reviewed");
      saveDiagnosis(businessStorage, r.state, r.raw);
      update((s) => {
        s.activeDiagnosisId = id;
        s.workspaceState = "Diagnosis";
        s.activeRecommendationId = undefined;
      });
      message("advisor", "تحلیل منتخب در این گفت‌وگو بازبینی شد.", [
        { type: "diagnosis", id },
      ]);
      fresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "بازبینی ممکن نشد.");
    }
  }
  function recommend() {
    ensureSession();
    try {
      const f = fresh();
      if (!f) return;
      if (session?.activeDiagnosisId) {
        const r = generateRecommendation(
          f.p.state,
          f.d,
          session.activeDiagnosisId,
        );
        savePreparation(businessStorage, f.p.state, f.p.raw);
        window.dispatchEvent(new Event("preparation-saved"));
        update((s) => {
          s.activeRecommendationId = r.id;
          s.workspaceState = "Recommendation";
        });
        message("advisor", r.summary, [{ type: "recommendation", id: r.id }]);
        fresh();
      } else {
        const evidence = f.c.packet.evidence.slice(0, 6);
        const r = contextualRecommendation(f.d, activeContext, evidence);
        const existing = f.p.state.recommendations.find(
          (x) =>
            !x.diagnosisId &&
            !["PotentiallyStale", "Archived", "Dismissed"].includes(x.status) &&
            x.title === r.title &&
            x.sourceVersion === r.sourceVersion &&
            x.actionOptions.map((o) => o.description).join("|") ===
              r.actionOptions.map((o) => o.description).join("|"),
        );
        if (!existing) {
          for (const e of evidence)
            if (!f.p.state.evidence.some((x) => x.id === e.id))
              f.p.state.evidence.push(structuredClone(e));
          f.p.state.recommendations.push(r);
          savePreparation(businessStorage, f.p.state, f.p.raw);
          window.dispatchEvent(new Event("preparation-saved"));
        }
        update((s) => {
          s.activeRecommendationId = (existing ?? r).id;
          s.workspaceState = "Recommendation";
        });
        message(
          "advisor",
          contextual.length
            ? "گزینه‌های زیر از الگوهای موجود و ارتباط‌های ثبت‌شده انتخاب شده‌اند؛ تصمیم نهایی با شماست."
            : "برای پیشنهاد اقدام، ابتدا یک موضوع یا تحلیل معتبر انتخاب کنید.",
          [{ type: "recommendation", id: (existing ?? r).id }],
          evidence,
        );
        fresh();
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "پیشنهاد نیازمند تازه‌سازی تحلیل است.",
      );
    }
  }
  async function send(text = question) {
    if (!loaded || busy || !text.trim() || storageError) return;
    if (text.trim().length > 2000) {
      setError("پرسش باید حداکثر ۲۰۰۰ نویسه باشد.");
      return;
    }
    const requestSession = structuredClone(ensureSession());
    const f = fresh();
    if (!f) return;
    const q = text.trim();
    const fieldInput = activeAction ? draftTextInput(activeAction, q) : null;
    if (fieldInput) {
      try {
        editDraft(f.p.state, f.d, activeAction!.id, fieldInput);
        savePreparation(businessStorage, f.p.state, f.p.raw);
        window.dispatchEvent(new Event("preparation-saved"));
        message("user", q, [], []);
        message(
          "advisor",
          "ورودی شما در نسخه جدید ذخیره شد؛ اعتبار پیشنهاد دوباره بررسی می‌شود.",
          [{ type: "action", id: activeAction!.id }],
        );
        setQuestion("");
        fresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "ورودی قابل ذخیره نیست.");
      }
      return;
    }
    const route = new AgentOrchestrator().workspaceIntent(
      q,
      options,
      selected,
      session?.activeActionId,
    );
    message("user", q, [], []);
    setQuestion("");
    setError("");
    if (route.intent === "Prepare") {
      if (route.option) prepare(route.option);
      else {
        update((s) => {
          s.workspaceState = "Recommendation";
        });
        message(
          "advisor",
          "اشاره روشن نیست؛ یکی از گزینه‌های قابل مشاهده را انتخاب کنید.",
        );
      }
      return;
    }
    if (
      ["ApproveIntent", "ExecuteIntent", "RejectIntent", "EditDraft"].includes(
        route.intent,
      )
    ) {
      if (!activeAction || route.control === "ChooseAction") {
        message(
          "advisor",
          "ابتدا اقدام مورد نظر را از فهرست همین صفحه انتخاب کنید.",
        );
        return;
      }
      update((s) => {
        s.workspaceState = "ActionReview";
      });
      if (route.intent !== "EditDraft") {
        // The send button becomes disabled after submission; return focus to
        // the stable composer when the review dialog closes.
        input.current?.focus();
        setControl({
          kind:
            route.intent === "ExecuteIntent"
              ? "execute"
              : route.intent === "ApproveIntent"
                ? "approve"
                : "reject",
          nonce: Date.now(),
        });
      }
      message(
        "advisor",
        route.intent === "ExecuteIntent"
          ? "پیش‌نمایش اجرا باز می‌شود؛ فقط دکمه «اجرای تغییر» داده کسب‌وکار را تغییر می‌دهد."
          : route.intent === "ApproveIntent"
            ? "کنترل تأیید باز می‌شود؛ دستور متنی به‌تنهایی تأیید ثبت نمی‌کند."
            : "از کنترل‌های بررسی اقدام در همین صفحه استفاده کنید.",
        [{ type: "action", id: activeAction.id }],
      );
      return;
    }
    // A free-form analysis question may ask for evidence as part of its answer.
    // Keep the explicit evidence shortcut, but let connected analysis reach the provider.
    const asksAnalysis = !!status?.connected && /چیست|چرا|مهم.*مسئله|تحلیل|بررسی کن/.test(q);
    if (route.intent === "ShowEvidence" && !asksAnalysis) {
      setShowEvidence(true);
      message(
        "advisor",
        "شواهد پاسخ و داده‌های موضوع منتخب در بخش شواهد قابل مشاهده است.",
      );
      return;
    }
    if (route.intent === "Recommend") {
      recommend();
      return;
    }
    if (route.intent === "Diagnose") {
      scan();
      return;
    }
    const drift = /موضوع جدید|تغییر موضوع|از موضوع خارج/.test(q);
    if (drift) {
      message(
        "advisor",
        "برای تغییر موضوع از انتخاب زمینه استفاده کنید؛ زمینه فعلی بدون تصمیم شما تغییر نمی‌کند.",
      );
      return;
    }
    const metricGap = missingMetricMessage(q, f.c.packet.evidence);
    if (metricGap) {
      message("advisor", metricGap, [], []);
      return;
    }
    if (!status?.connected && !demo) {
      const evidence = f.c.packet.evidence.slice(0, 6);
      message(
        "advisor",
        route.intent === "GeneralQuestion"
          ? "اصل عمومی مدیریت: نتیجه را از فعالیت جدا کنید، فرض‌ها را روشن و با شواهد آزمون کنید. این توضیح تحلیل اختصاصی کسب‌وکار شما نیست."
          : `${label}: ${
              evidence
                .slice(0, 3)
                .map((e) => businessEvidenceText(e))
                .join(" · ") || "شواهد کافی برای توضیح علت موجود نیست."
            } توضیح آزاد مدل در دسترس نیست؛ تحلیل‌ها، شواهد و اقدامات ساختاریافته همچنان قابل استفاده‌اند.`,
        [],
        evidence,
      );
      return;
    }
    setBusy(true);
    const requestController = new AbortController();
    controller.current = requestController;
    const history = workspaceHistory(
      requestSession.messages,
      requestSession.activeContext,
    );
    try {
      const c = buildAdvisorContext(
        businessStorage,
        q,
        businessContext(activeContext),
        history,
        undefined,
        true,
      );
      const res = await fetch("/api/advisor", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Advisor-Client": "advisor-v1",
        },
        signal: requestController.signal,
        body: JSON.stringify({
          requestId: crypto.randomUUID(),
          question: q,
          selection: c.selection,
          packet: activeContext.type === "candidate" ? f.c.packet : c.packet,
          capabilityIds: c.capabilityIds,
          history,
          mode: "answer",
          demo,
        }),
      });
      const response = await res.json();
      if (
        requestController.signal.aborted ||
        !workspaceRequestMatches(requestSession, currentSession())
      )
        return;
      if (!res.ok)
        throw Error(response.error?.message ?? "پاسخ مدل دریافت نشد.");
      const r = response.response as AgentAdvisorResponse;
      message("advisor", [
        `تفسیر: ${r.answer.replace(/^تفسیر:\s*/u, "")}`,
        ...r.observations.map(item => `واقعیت: ${item.text.replace(/^واقعیت:\s*/u, "")}`),
        ...r.recommendations.map(item => `پیشنهاد مدیریتی: ${item.text.replace(/^پیشنهاد مدیریتی:\s*/u, "")}`),
        ...r.dataGaps.map(item => `کمبود داده: ${item.replace(/^کمبود داده:\s*/u, "")}`),
      ].join("\n\n"), [], r.evidenceRefs);
      setNotice(r.dataGaps.join(" · "));
    } catch (e) {
      if (
        requestController.signal.aborted ||
        !workspaceRequestMatches(requestSession, currentSession())
      )
        return;
      message(
        "advisor",
        `${e instanceof Error ? e.message : "پاسخ مدل دریافت نشد."} تحلیل و بررسی اقدام همچنان در دسترس است.`,
        [],
        f.c.packet.evidence.slice(0, 6),
      );
    } finally {
      setBusy(false);
    }
  }
  const related =
    activeEntity && data
      ? relatedEntities(data, activeContext)
          .map((e) => e.ref)
          .slice(0, 8)
      : [];
  const currentEvidence =
    session?.messages
      .filter(
        (m) =>
          m.role === "advisor" &&
          m.evidence.length &&
          m.context?.type === activeContext.type &&
          m.context?.id === activeContext.id,
      )
      .at(-1)?.evidence ??
    context?.packet.evidence ??
    [];
  const pending =
    preparation?.actions
      .filter(
        (a) =>
          !["Executed", "Rejected", "Archived", "Cancelled"].includes(a.status),
      )
      .slice(-8)
      .reverse() ?? [];
  const activeDiagnoses =
    data?.diagnosis.diagnoses
      .filter(
        (d) =>
          !["Resolved", "Dismissed"].includes(d.status) &&
          (activeContext.type === "executive" ||
            activeContext.type === "diagnosis" ||
            d.affectedEntities.some(
              (r) =>
                r.entityId === activeContext.id ||
                related.some((e) => e.entityId === r.entityId),
            )),
      )
      .slice(0, 3) ?? [];
  const result = executions.state.records.find(
    (r) => r.actionId === session?.activeActionId,
  );
  useEffect(() => {
    if (
      !result ||
      !session ||
      !["Succeeded", "RolledBack"].includes(result.status)
    )
      return;
    const content =
      result.status === "RolledBack"
        ? "بازگردانی جبرانی ثبت شد؛ نتیجه کسب‌وکار از آن استنتاج نمی‌شود."
        : "تغییر در ماژول ثبت و نتیجه ذخیره بررسی شد؛ موفقیت کسب‌وکار هنوز نیازمند شواهد است.";
    if (
      !session.messages.some(
        (m) =>
          m.content === content &&
          m.refs.some((r) => r.type === "execution" && r.id === result.id),
      )
    ) {
      update((s) => {
        s.workspaceState = "ExecutionResult";
        s.messages.push({
          id: crypto.randomUUID(),
          role: "advisor",
          content,
          at: new Date().toISOString(),
          evidence: [],
          refs: [
            { type: "action", id: result.actionId },
            { type: "execution", id: result.id },
          ],
        });
      });
    }
  }, [result?.id, result?.status, session?.id]);
  const missing =
    activeAction && data
      ? validateAgentProposedAction(activeAction, preparation!, data).missing
      : [];
  function artifactAvailable(r: ArtifactRef) {
    if (r.type === "action")
      return preparation?.actions.some((a) => a.id === r.id) ?? false;
    if (r.type === "diagnosis")
      return data?.diagnosis.diagnoses.some((d) => d.id === r.id) ?? false;
    if (r.type === "recommendation")
      return preparation?.recommendations.some((a) => a.id === r.id) ?? false;
    return executions.state.records.some((e) => e.id === r.id);
  }
  return (
    <div className="advisor-page workspace-page">
      <AdvisorNavigation />
      <header className="workspace-header">
        <div>
          <span className="advisor-eyebrow">
            GROWTH ENGINE · EXECUTIVE COPILOT
          </span>
          <h1>فضای مشاور مدیریتی</h1>
          <p>از پرسش تا تصمیم و تغییر قابل بررسی.</p>
        </div>
        <span className="workspace-engine">
          {status?.connected
            ? "هوش مصنوعی متصل"
            : "تحلیل هوشمند متصل نیست؛ موتور تحلیلی داخلی فعال است."}
        </span>
      </header>
      <section className="workspace-context">
        <nav aria-label="زمینه فعلی">
          کسب‌وکار ›{" "}
          {activeEntity
            ? domains[activeEntity.ref.domain]
            : contextLabels[activeContext.type]}{" "}
          {activeEntity && (
            <>
              {data?.entities.some(
                (e) => e.ref.entityId === activeEntity.value.objectiveId,
              ) && (
                <>
                  ›{" "}
                  {String(
                    data?.entities.find(
                      (e) => e.ref.entityId === activeEntity.value.objectiveId,
                    )?.ref.label ?? "",
                  )}{" "}
                </>
              )}
              › {label}
            </>
          )}
        </nav>
        <div className="workspace-buttons">
          <label>
            موضوع بررسی
            <select
              aria-label="موضوع بررسی"
              value={contextChoice}
              onChange={(e) => {
                const value = e.target.value;
                setContextChoice(value);
                const sep = value.indexOf(":");
                const type =
                  value.slice(0, sep) === "KR" ? "kr" : value.slice(0, sep);
                setPendingSwitch(
                  value === "executive"
                    ? { type: "executive" }
                    : ({
                        type: type as WorkspaceContext["type"],
                        id: value.slice(sep + 1),
                      } as WorkspaceContext),
                );
              }}
            >
              <option value="executive">نمای جامع کسب‌وکار</option>
              {entities.map((e) => (
                <option
                  key={`${e.ref.entityType}:${e.ref.entityId}`}
                  value={`${e.ref.entityType === "KR" ? "kr" : e.ref.entityType}:${e.ref.entityId}`}
                >
                  {
                    contextLabels[
                      e.ref.entityType === "KR" ? "kr" : e.ref.entityType
                    ]
                  }{" "}
                  · {e.ref.label}
                </option>
              ))}
            </select>
          </label>
          <button onClick={() => start()}>گفت‌وگوی جدید</button>
          <button className="secondary" onClick={scan}>
            خلاصه مدیریتی
          </button>
          <label className="workspace-lock">
            <input
              type="checkbox"
              checked={session?.contextLocked ?? true}
              onChange={(e) => {
                ensureSession();
                update((s) => {
                  s.contextLocked = e.target.checked;
                });
              }}
            />
            قفل روی این موضوع
          </label>
        </div>
        {changed && (
          <p role="status">
            اطلاعات این بخش به‌روزرسانی شده است؛ اعتبار اقدام پیش از تصمیم
            دوباره بررسی می‌شود.
          </p>
        )}
      </section>
      {(error || storageError) && (
        <p role="alert" className="preparation-error">
          {error || storageError}
          {storageError && (
            <button onClick={reloadSessions}>بارخوانی تاریخچه</button>
          )}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <div className="workspace-layout">
        <section className="workspace-main" aria-label="گفت‌وگو و جریان تصمیم">
          {!loaded ? (
            <p>در حال خواندن فضای مشاور…</p>
          ) : (
            <>
              <section className="workspace-block">
                <h2>{session?.title ?? "شروع یک تصمیم روشن"}</h2>
                {!session && (
                  <>
                    <p>
                      وضعیت ثبت‌شده 3S؛ داده ناموجود به معنی عملکرد خوب یا بد
                      نیست.
                    </p>
                    <div className="workspace-summary">
                      {Object.entries(context?.snapshot ?? {})
                        .filter(([key]) =>
                          ["system", "strategy", "scale"].includes(
                            key.toLowerCase(),
                          ),
                        )
                        .map(([key, value]) => (
                          <div key={key}>
                            <strong>
                              {domains[key] ??
                                domains[key[0].toUpperCase() + key.slice(1)] ??
                                key}
                            </strong>
                            <p>
                              {value &&
                              typeof value === "object" &&
                              "health" in value
                                ? `سلامت ثبت‌شده: ${value.health === null ? "نامشخص" : String(value.health) + " از ۱۰۰"}`
                                : "داده ناموجود"}
                            </p>
                          </div>
                        ))}
                    </div>
                  </>
                )}
                <div className="workspace-buttons">
                  {[
                    "چرا این موضوع نیازمند توجه است؟",
                    "چه کار کنیم؟",
                    "شواهدش رو نشون بده",
                  ].map((q) => (
                    <button
                      className="secondary"
                      key={q}
                      onClick={() => send(q)}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </section>
              {!!store.sessions.length && (
                <details className="workspace-block">
                  <summary>گفت‌وگوهای اخیر</summary>
                  {store.sessions.slice(0, 8).map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        commit((st) => {
                          st.activeSessionId = s.id;
                        });
                        router.replace(
                          `/advisor/workspace?session=${encodeURIComponent(s.id)}`,
                        );
                      }}
                    >
                      {s.title} · ادامه
                    </button>
                  ))}
                </details>
              )}
              <section
                aria-label="پیام‌های گفت‌وگو"
                className="workspace-messages"
              >
                {session && session.messages.length > windowSize && (
                  <button onClick={() => setWindowSize((n) => n + 30)}>
                    پیام‌های پیشین
                  </button>
                )}
                {session?.messages.slice(-windowSize).map((m) => (
                  <article key={m.id} className={`workspace-message ${m.role}`}>
                    <small>
                      {m.role === "user" ? "درخواست شما" : "مشاور مدیریتی"} ·{" "}
                      {new Date(m.at).toLocaleTimeString("fa-IR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </small>
                    {m.role === "advisor" ? (
                      <AdvisorTextBlock>
                        <p>{m.content}</p>
                      </AdvisorTextBlock>
                    ) : (
                      <p>{m.content}</p>
                    )}
                    {m.refs.map((r) => (
                      <button
                        className="secondary"
                        disabled={!artifactAvailable(r)}
                        key={`${r.type}:${r.id}`}
                        onClick={() =>
                          update((s) => {
                            if (r.type === "action") {
                              s.activeActionId = r.id;
                              s.workspaceState = "ActionReview";
                            }
                            if (r.type === "diagnosis") {
                              s.activeDiagnosisId = r.id;
                              s.workspaceState = "Diagnosis";
                            }
                            if (r.type === "recommendation") {
                              s.activeRecommendationId = r.id;
                              s.workspaceState = "Recommendation";
                            }
                            if (r.type === "execution") {
                              const record = executions.state.records.find(
                                (e) => e.id === r.id,
                              );
                              if (record) {
                                s.activeActionId = record.actionId;
                                s.workspaceState = "ExecutionResult";
                              }
                            }
                          })
                        }
                      >
                        مشاهده{" "}
                        {r.type === "action"
                          ? "اقدام"
                          : r.type === "diagnosis"
                            ? "تحلیل"
                            : r.type === "execution"
                              ? "نتیجه"
                              : "پیشنهاد"}{" "}
                        مرتبط
                        {!artifactAvailable(r) && " (این مورد در دسترس نیست)"}
                      </button>
                    ))}
                    {!!m.evidence.length && (
                      <details>
                        <summary>شواهد این پاسخ</summary>
                        <EvidenceBlock evidence={m.evidence} />
                      </details>
                    )}
                  </article>
                ))}
              </section>
              {busy && <p role="status">در حال تحلیل داده‌های مرتبط…</p>}
              <form
                className="workspace-composer"
                onSubmit={(e) => {
                  e.preventDefault();
                  send();
                }}
              >
                <label htmlFor="workspace-question">پرسش یا گام بعدی شما</label>
                <textarea
                  ref={input}
                  id="workspace-question"
                  rows={3}
                  maxLength={2000}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="مثلاً: چه کار کنیم؟ یا دومی رو آماده کن"
                />
                <div className="workspace-buttons">
                  <button disabled={busy || !question.trim() || !!storageError}>
                    ارسال
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => input.current?.focus()}
                  >
                    نوشتن پرسش
                  </button>
                  {status?.demoAllowed && (
                    <label>
                      <input
                        type="checkbox"
                        checked={demo}
                        onChange={(e) => setDemo(e.target.checked)}
                      />
                      پاسخ آزمایشی محلی
                    </label>
                  )}
                </div>
              </form>
              {diagnosis ? (
                <DiagnosisBlock diagnosis={diagnosis} />
              ) : (
                <section aria-label="تحلیل‌ها و اولویت‌ها">
                  <h2>تحلیل‌های مرتبط و سه اولویت</h2>
                  {activeDiagnoses.length ? (
                    activeDiagnoses.map((d) => (
                      <DiagnosisBlock
                        key={d.id}
                        diagnosis={d}
                        onReview={() => reviewDiagnosis(d.id)}
                      />
                    ))
                  ) : (
                    <p>
                      تحلیل مرتبط ثبت نشده است؛ خلاصه مدیریتی را به‌صورت دستی
                      تازه کنید.
                    </p>
                  )}
                </section>
              )}
              <section aria-label="پیشنهادها">
                <h2>گزینه‌های قابل بررسی</h2>
                <button className="secondary" onClick={recommend}>
                  پیشنهاد بده
                </button>
                {options.map((o) => (
                  <RecommendationBlock
                    key={o.id}
                    option={o}
                    selected={selected === o.id}
                    onSelect={() => {
                      ensureSession();
                      setSelected(o.id);
                      update((s) => {
                        s.selectedOptionId = o.id;
                        s.workspaceState = "Recommendation";
                      });
                    }}
                    onPrepare={() => prepare(o)}
                    onDismiss={() => {
                      ensureSession();
                      update((s) => {
                        s.dismissedOptions.push(o.id);
                      });
                    }}
                  />
                ))}
              </section>
              {activeAction && (
                <>
                  {activeAction.status === "Executed" &&
                    options.some(
                      (o) =>
                        o.templateId === activeAction.templateId &&
                        o.targetId === activeAction.targetEntityId,
                    ) && (
                      <button
                        onClick={() =>
                          prepare(
                            options.find(
                              (o) =>
                                o.templateId === activeAction.templateId &&
                                o.targetId === activeAction.targetEntityId,
                            )!,
                            true,
                          )
                        }
                      >
                        ساخت پیش‌نویس تازه برای این موضوع
                      </button>
                    )}
                  <nav className="workspace-lineage" aria-label="مسیر تصمیم">
                    {activeAction.sourceDiagnosisId ? "تحلیل ← " : ""}
                    {activeAction.sourceRecommendationId ? "پیشنهاد ← " : ""}
                    پیش‌نویس ←{" "}
                    {activeAction.status === "Approved" || result
                      ? "تأیید ← "
                      : ""}
                    {result ? "اجرا ← بررسی نتیجه" : "بررسی و تصمیم شما"}
                  </nav>
                  <DataGapBlock
                    gaps={missing.map((m) => `برای تکمیل پیش‌نویس: ${m}`)}
                  />
                  <ApprovalBlock />
                  <div className="workspace-buttons">
                    <button
                      onClick={() =>
                        setControl({ kind: "approve", nonce: Date.now() })
                      }
                    >
                      بررسی تأیید پیشنهاد
                    </button>
                    <button
                      className="secondary"
                      onClick={() =>
                        setControl({ kind: "reject", nonce: Date.now() })
                      }
                    >
                      بررسی رد پیشنهاد
                    </button>
                  </div>
                  <ActionDraftBlock>
                    <ActionsPage
                      key={activeAction.id}
                      id={activeAction.id}
                      embedded
                      onSelectAction={(id) =>
                        update((s) => {
                          s.activeActionId = id;
                        })
                      }
                      workspaceIntent={control}
                    />
                  </ActionDraftBlock>
                  {result &&
                    ["Succeeded", "RolledBack"].includes(result.status) && (
                      <ExecutionResultBlock>
                        {result.entityRefs.map((r) => (
                          <a
                            key={r.entityId}
                            href={r.route}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            مشاهده {r.label} در ماژول ↗
                          </a>
                        ))}
                        <button
                          className="secondary"
                          onClick={() =>
                            message(
                              "advisor",
                              "بررسی نتیجه کسب‌وکار به شواهد تازه و ثبت‌شده نیاز دارد؛ هیچ پایش یا یادآوری خودکار ایجاد نشد.",
                              [{ type: "execution", id: result.id }],
                            )
                          }
                        >
                          بعداً نتیجه را بررسی کن
                        </button>
                      </ExecutionResultBlock>
                    )}
                </>
              )}
              <section className="workspace-block">
                <h2>اقدامات در انتظار تصمیم</h2>
                {pending.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => {
                      ensureSession();
                      update((s) => {
                        s.activeActionId = a.id;
                        s.workspaceState = "ActionReview";
                      });
                    }}
                  >
                    {a.title} ·{" "}
                    {a.validation.status === "Stale"
                      ? "داده تغییر کرده"
                      : a.validation.status === "NeedsInput"
                        ? "نیازمند ورودی"
                        : a.status === "Approved"
                          ? "تأیید شده؛ منتظر اجرا"
                          : a.status === "ReadyForApproval"
                            ? "در انتظار تأیید"
                            : "آماده بررسی"}
                  </button>
                ))}
                {!pending.length && <p>اقدام منتظر تصمیم وجود ندارد.</p>}
              </section>
              <section className="workspace-block">
                <h2>اجراهای اخیر</h2>
                {executions.state.records
                  .slice(-4)
                  .reverse()
                  .map((r) => (
                    <button
                      key={r.id}
                      onClick={() => {
                        ensureSession();
                        update((s) => {
                          s.activeActionId = r.actionId;
                          s.workspaceState = "ExecutionResult";
                        });
                      }}
                    >
                      {preparation?.actions.find((a) => a.id === r.actionId)
                        ?.title ?? "اقدام ثبت‌شده"}{" "}
                      ·{" "}
                      {r.status === "RolledBack"
                        ? "بازگردانی‌شده"
                        : r.status === "Succeeded"
                          ? "تغییر ثبت شد"
                          : "نیازمند بررسی"}
                    </button>
                  ))}
              </section>
            </>
          )}
        </section>
        <aside className="workspace-side">
          <details
            open={contextExpanded}
            onToggle={(e) => setContextExpanded(e.currentTarget.open)}
          >
            <summary>زمینه و شواهد تصمیم</summary>
            <section className="workspace-block">
              <h2>{label}</h2>
              {activeEntity && (
                <>
                  <p>
                    وضعیت:{" "}
                    {String(
                      activeEntity.value.status === "active"
                        ? "فعال"
                        : activeEntity.value.status === "draft"
                          ? "پیش‌نویس"
                          : activeEntity.value.status === "proposed"
                            ? "پیشنهادشده"
                            : "در منبع ثبت شده",
                    )}
                  </p>
                  <a
                    href={activeEntity.ref.route}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    باز کردن موضوع در ماژول ↗
                  </a>
                </>
              )}
              {context?.packet.metrics.slice(0, 3).map((e) => (
                <p key={e.id}>
                  {e.title}: {businessEvidenceText(e)}
                </p>
              ))}
              {context?.packet.risks.slice(0, 3).map((e) => (
                <p key={e.id}>
                  {e.title}: {businessEvidenceText(e)}
                </p>
              ))}
              {context?.packet.historySummary.slice(0, 3).map((h) => (
                <p key={h}>{businessEvidenceText({ summary: h })}</p>
              ))}
            </section>
            <button
              className="secondary"
              onClick={() => setShowEvidence((v) => !v)}
            >
              {showEvidence ? "جمع کردن شواهد" : "داده‌های مورد استفاده"}
            </button>
            {showEvidence && (
              <>
                <EvidenceBlock
                  evidence={currentEvidence.filter(
                    (e) =>
                      !["HistoricalRecord", "Learning", "Trend"].includes(
                        e.evidenceType,
                      ) &&
                      (!activeEntity ||
                        !e.entityRef ||
                        e.entityRef.domain === activeEntity.ref.domain),
                  )}
                />
                <EvidenceBlock
                  title="شواهد تاریخی"
                  evidence={currentEvidence.filter((e) =>
                    ["HistoricalRecord", "Learning", "Trend"].includes(
                      e.evidenceType,
                    ),
                  )}
                />
                <EvidenceBlock
                  title="شواهد بین‌بخشی"
                  evidence={currentEvidence.filter(
                    (e) =>
                      !!activeEntity &&
                      e.entityRef?.domain !== activeEntity.ref.domain,
                  )}
                />
                <DataGapBlock
                  gaps={
                    context?.notices.length
                      ? [
                          "بعضی منابع خوانده نشدند یا داده کافی ندارند؛ از صفحه ماژول بررسی کنید.",
                        ]
                      : []
                  }
                />
              </>
            )}
            <RelationshipBlock refs={related} />
          </details>
        </aside>
      </div>
      {pendingSwitch && (
        <Drawer
          open
          onClose={() => setPendingSwitch(null)}
          title="تغییر موضوع بررسی"
          description="گفت‌وگو حفظ می‌شود؛ اقدام و پیشنهاد قبلی از انتخاب فعال کنار می‌روند."
        >
          <p>
            از {label} به {contextLabels[pendingSwitch.type]} برویم؟
          </p>
          <button
            onClick={() => {
              ensureSession();
              update((s) => {
                s.activeContext = pendingSwitch;
                s.selectedOptionId = undefined;
                s.activeActionId = undefined;
                s.activeDiagnosisId =
                  pendingSwitch.type === "diagnosis"
                    ? pendingSwitch.id
                    : undefined;
                s.activeRecommendationId = undefined;
                s.workspaceState = "Conversation";
              });
              if (session)
                router.replace(
                  "/advisor/workspace?session=" +
                    encodeURIComponent(session.id),
                );
              setPendingSwitch(null);
            }}
          >
            تغییر موضوع
          </button>
          <button
            className="secondary"
            onClick={() => {
              setPendingSwitch(null);
              setContextChoice(
                activeContext.type === "executive"
                  ? "executive"
                  : `${activeContext.type}:${activeContext.id}`,
              );
            }}
          >
            انصراف
          </button>
        </Drawer>
      )}
      {process.env.NODE_ENV === "development" && (
        <Link href="/dev/agent">بررسی توسعه‌دهنده</Link>
      )}
    </div>
  );
}

export function WorkspaceHistoryPage() {
  const { store, loaded, error } = useWorkspaceStore();
  const [data, setData] = useState<ReturnType<
      typeof preparationContext
    > | null>(null),
    [actions, setActions] = useState<
      ReturnType<typeof readPreparation>["state"] | null
    >(null),
    [type, setType] = useState("all"),
    [domain, setDomain] = useState("all"),
    [status, setStatus] = useState("all"),
    [page, setPage] = useState(0);
  const execution = useExecutions();
  useEffect(() => {
    setData(preparationContext(businessStorage));
    setActions(readPreparation(businessStorage).state);
  }, []);
  const rows = [
    ...store.sessions.map((s) => ({
      id: s.id,
      type: "session",
      domain: "Executive",
      status: "conversation",
      title: s.title,
      at: s.lastActivityAt,
      url: `/advisor/workspace?session=${s.id}`,
      detail: `${s.messages.length.toLocaleString("fa-IR")} پیام · زمینه: ${contextLabels[s.activeContext.type]}`,
    })),
    ...(data?.diagnosis.diagnoses
      .filter((d) => d.status === "Reviewed" || d.status === "Monitoring")
      .map((d) => ({
        id: d.id,
        type: "diagnosis",
        domain: d.affectedEntities[0]?.domain ?? "Executive",
        status: d.status,
        title: d.title,
        at: d.lastUpdatedAt,
        url: `/advisor/workspace?context=diagnosis&id=${d.id}`,
        detail: d.summary,
      })) ?? []),
    ...(actions?.actions
      .filter((a) => a.status === "Rejected")
      .map((a) => ({
        id: a.id,
        type: "rejected",
        domain: a.domain,
        status: "Rejected",
        title: a.title,
        at: a.updatedAt,
        url: `/advisor/workspace?action=${a.id}`,
        detail:
          [...(actions?.approvals ?? [])]
            .reverse()
            .find((r) => r.proposedActionId === a.id && r.status === "Rejected")
            ?.rejectionReason ?? "دلیل رد ثبت نشده است.",
      })) ?? []),
    ...execution.state.records.map((r) => ({
      id: r.id,
      type: r.status === "RolledBack" ? "rollback" : "execution",
      domain: r.domain,
      status: r.status,
      title:
        actions?.actions.find((a) => a.id === r.actionId)?.title ??
        "اقدام ثبت‌شده",
      at: r.completedAt ?? r.startedAt,
      url: `/advisor/workspace?action=${r.actionId}`,
      detail:
        r.status === "Succeeded"
          ? "تغییر اعمال و بررسی شد؛ نتیجه کسب‌وکار هنوز اثبات نشده است."
          : r.status === "RolledBack"
            ? "بازگردانی جبرانی ثبت شد؛ تاریخچه اجرای اصلی حفظ شده است."
            : "نتیجه نیازمند بررسی است.",
    })),
  ]
    .filter(
      (r) =>
        (type === "all" || r.type === type) &&
        (domain === "all" || r.domain === domain) &&
        (status === "all" || r.status === status),
    )
    .sort((a, b) => b.at.localeCompare(a.at));
  return (
    <div className="advisor-page workspace-page">
      <AdvisorNavigation />
      <h1>تاریخچه تصمیم‌های مدیریتی</h1>
      <p>گفت‌وگو، تحلیل بازبینی‌شده و تصمیم ثبت‌شده؛ بدون حافظه پنهان.</p>
      {error && <p role="alert">{error}</p>}
      <section className="workspace-history-filters">
        {[
          [
            "نوع",
            type,
            setType,
            [
              ["all", "همه"],
              ["session", "گفت‌وگو"],
              ["diagnosis", "تحلیل"],
              ["execution", "اجرا"],
              ["rejected", "رد پیشنهاد"],
              ["rollback", "بازگردانی"],
            ],
          ],
          [
            "بخش",
            domain,
            setDomain,
            [
              ["all", "همه"],
              ["System", "سیستم"],
              ["Strategy", "استراتژی"],
              ["Scale", "اسکیل"],
              ["Executive", "جامع"],
            ],
          ],
          [
            "وضعیت",
            status,
            setStatus,
            [
              ["all", "همه"],
              ["Succeeded", "موفق"],
              ["RolledBack", "بازگردانی‌شده"],
              ["Failed", "ناموفق"],
              ["Rejected", "ردشده"],
              ["Reviewed", "بازبینی‌شده"],
              ["conversation", "گفت‌وگو"],
            ],
          ],
        ].map(([label, value, set, choices]) => (
          <label key={String(label)}>
            {String(label)}
            <select
              value={String(value)}
              onChange={(e) => {
                (set as (v: string) => void)(e.target.value);
                setPage(0);
              }}
            >
              {(choices as string[][]).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        ))}
      </section>
      {!loaded ? (
        <p>در حال خواندن تاریخچه…</p>
      ) : (
        rows.slice(page * 25, page * 25 + 25).map((r) => (
          <article className="workspace-block" key={`${r.type}:${r.id}`}>
            <h2>
              <Link href={r.url}>{r.title}</Link>
            </h2>
            <p>
              {domains[r.domain]} · {new Date(r.at).toLocaleString("fa-IR")}
            </p>
            <p>{r.detail}</p>
            {r.type === "execution" || r.type === "rollback" ? (
              <details>
                <summary>مسیر تصمیم و نتیجه</summary>
                {(() => {
                  const record = execution.state.records.find(
                    (x) => x.id === r.id,
                  );
                  const action = actions?.actions.find(
                    (a) => a.id === record?.actionId,
                  );
                  return (
                    <>
                      <p>
                        {action?.sourceDiagnosisId
                          ? data?.diagnosis.diagnoses.find(
                              (d) => d.id === action.sourceDiagnosisId,
                            )?.title
                          : "درخواست صریح مدیر"}{" "}
                        ← {action?.rationale} ← {action?.title}
                      </p>
                      {record?.entityRefs.map((e) => (
                        <a
                          key={e.entityId}
                          href={e.route}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          مشاهده رکورد واقعی ↗
                        </a>
                      ))}
                    </>
                  );
                })()}
              </details>
            ) : null}
          </article>
        ))
      )}
      {loaded && !rows.length && <p>موردی با این فیلتر ثبت نشده است.</p>}
      <div className="workspace-buttons">
        <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
          صفحه قبل
        </button>
        <span>{(page + 1).toLocaleString("fa-IR")}</span>
        <button
          disabled={(page + 1) * 25 >= rows.length}
          onClick={() => setPage((p) => p + 1)}
        >
          صفحه بعد
        </button>
      </div>
    </div>
  );
}
