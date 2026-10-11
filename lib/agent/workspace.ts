import type { AgentSession, AdvisorSelection } from "./advisor/types";
import type { AgentEvidence } from "./types";
import type { TemplateId } from "./preparation/types";
import { template } from "./preparation/templates";
import { getField } from "./preparation/templates";
import type { PreparedAction } from "./preparation/types";
import type { PreparedRecommendation } from "./preparation/types";
import type { PreparationContext } from "./preparation/context";
import { safeValue, validateEvidence } from "./advisor/validation";

export function workspaceEvidenceSnapshot(
  evidence: AgentEvidence[],
): AgentEvidence[] {
  return evidence.slice(0, 24).flatMap((source) => {
    const e = structuredClone(source);
    e.summary = businessEvidenceText(e).slice(0, 600);
    e.title = e.title.slice(0, 250);
    if (e.value !== undefined && !safeValue(e.value)) delete e.value;
    if (e.previousValue !== undefined && !safeValue(e.previousValue))
      delete e.previousValue;
    try {
      validateEvidence(e);
      return [e];
    } catch {
      return [];
    }
  });
}

export type WorkspaceMode =
  | "Conversation"
  | "Diagnosis"
  | "Recommendation"
  | "ActionReview"
  | "ExecutionResult";
export type WorkspaceContext =
  AdvisorSelection | { type: "candidate" | "diagnosis"; id: string };
export interface ArtifactRef {
  type: "diagnosis" | "recommendation" | "action" | "execution";
  id: string;
}
export interface WorkspaceMessage {
  context?: WorkspaceContext;
  id: string;
  role: "user" | "advisor";
  content: string;
  at: string;
  evidence: AgentEvidence[];
  refs: ArtifactRef[];
}
export function workspaceHistory(
  messages: WorkspaceMessage[],
  context: WorkspaceContext,
) {
  return messages
    .filter(
      (m) => m.context?.type === context.type && m.context?.id === context.id,
    )
    .slice(-6)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 1200) }));
}
export function workspaceRequestMatches(
  source: Pick<WorkspaceSession, "id" | "activeContext">,
  current: WorkspaceSession | undefined,
) {
  return (
    !!current &&
    source.id === current.id &&
    source.activeContext.type === current.activeContext.type &&
    source.activeContext.id === current.activeContext.id
  );
}
export function contextualRecommendation(
  c: PreparationContext,
  context: WorkspaceContext,
  evidence: AgentEvidence[],
): PreparedRecommendation {
  const options = contextualOptions(c, context),
    id = crypto.randomUUID();
  if (!options.length)
    throw Error("برای این زمینه گزینه قابل بررسی موجود نیست.");
  return {
    id,
    title: `گزینه‌های بررسی ${contextLabels[context.type]}`,
    domain: template(options[0].templateId).domain,
    summary:
      "این گزینه‌ها از الگوهای موجود و ارتباط‌های ثبت‌شده انتخاب شده‌اند؛ تصمیم و سنجش اثر با شماست.",
    rationale: "درخواست صریح کاربر برای پیشنهاد در زمینه منتخب",
    priority: "Medium",
    confidence: "Low",
    evidenceIds: evidence.map((e) => e.id),
    suggestedActions: options.map((o) => o.templateId),
    status: "Reviewed",
    createdAt: new Date().toISOString(),
    recommendationType: "Investigate",
    assumptions: ["ارتباط ثبت‌شده رابطه علّی قطعی نیست."],
    risks: ["ایجاد اقدام به معنی دستیابی به نتیجه کسب‌وکار نیست."],
    primaryReason:
      "گزینه قابل بررسی بر اساس ارتباط ثبت‌شده؛ اثر کسب‌وکار هنوز اثبات نشده است.",
    sourceVersion: c.version,
    actionOptions: options.map((o, i) => {
      const t = template(o.templateId);
      return {
        id: crypto.randomUUID(),
        recommendationId: id,
        title: o.title,
        description: o.targetLabel,
        capabilityId: t.capabilityId,
        templateId: o.templateId,
        domain: t.domain,
        riskLevel: t.risk,
        effort: "Medium",
        timeHorizon: "ThisWeek",
        expectedImpact: t.expectedImpact,
        prerequisites: t.prerequisites,
        evidenceIds: evidence.map((e) => e.id),
        recommended: i === 0,
      };
    }),
  };
}
export interface WorkspaceSession extends Pick<
  AgentSession,
  "id" | "createdAt" | "updatedAt"
> {
  title: string;
  activeContext: WorkspaceContext;
  activeDiagnosisId?: string;
  activeRecommendationId?: string;
  activeActionId?: string;
  selectedOptionId?: string;
  workspaceState: WorkspaceMode;
  lastActivityAt: string;
  messages: WorkspaceMessage[];
  contextLocked: boolean;
  dismissedOptions: string[];
}
export interface WorkspaceOption {
  id: string;
  title: string;
  templateId: TemplateId;
  targetId: string;
  targetLabel: string;
  why: string;
  diagnosisId?: string;
  recommendationId?: string;
  optionId?: string;
}
export const contextLabels: Record<string, string> = {
  executive: "نمای جامع کسب‌وکار",
  process: "فرآیند",
  objective: "هدف استراتژیک",
  kr: "نتیجه کلیدی",
  constraint: "محدودیت رشد",
  experiment: "آزمایش رشد",
  candidate: "فرصت مقیاس‌دهی",
  diagnosis: "تحلیل مدیریتی",
};
const businessValueLabels: Record<string, string> = {
  active: "فعال",
  draft: "پیش‌نویس",
  proposed: "پیشنهادشده",
  inbox: "ورودی",
  archived: "آرشیو",
  high: "زیاد",
  medium: "متوسط",
  low: "کم",
  critical: "بحرانی",
  atRisk: "در معرض ریسک",
  offTrack: "خارج از مسیر",
  onTrack: "در مسیر",
  achieved: "محقق‌شده",
  notStarted: "شروع نشده",
  win: "نتیجه مثبت ثبت‌شده",
  partial: "نتیجه نسبی",
  loss: "نتیجه منفی",
  inconclusive: "شواهد ناکافی",
  unknown: "نامشخص",
  completed: "تکمیل‌شده",
  cancelled: "لغوشده",
  running: "در حال اجرا",
  paused: "متوقف",
  review: "در بازبینی",
  increase: "افزایشی",
  decrease: "کاهشی",
  binary: "بله / خیر",
  milestone: "مرحله‌ای",
  backlog: "در صف",
  pending: "در انتظار",
  ready: "آماده",
  healthy: "سالم",
  weak: "ضعیف",
  strong: "قوی",
  moderate: "متوسط",
  reliable: "قابل اتکا",
  partialEvidence: "شواهد ناقص",
  notReady: "آماده نیست",
  none: "ندارد",
  mixed: "ترکیبی",
  insufficient: "شواهد ناکافی",
  Medium: "متوسط",
  Low: "کم",
  High: "زیاد",
  Critical: "بحرانی",
};
export function businessEvidenceText(
  e: Pick<AgentEvidence, "summary" | "value">,
): string {
  let value: unknown = e.summary;
  try {
    value = JSON.parse(e.summary);
  } catch {
    /* Business prose remains prose. */
  }
  const labels: Record<string, string> = {
    health: "سلامت",
    independence: "استقلال",
    founderDependency: "وابستگی به بنیان‌گذار",
    status: "وضعیت",
    target: "هدف",
    current: "مقدار فعلی",
    weight: "وزن",
    gap: "شکاف ظرفیت",
    severity: "شدت",
    result: "نتیجه ثبت‌شده",
    rationale: "دلیل ثبت‌شده",
    name: "نام",
    periodEnd: "پایان دوره",
    volume: "حجم",
    conversion: "نرخ تبدیل",
    targetConversion: "هدف تبدیل",
    score: "امتیاز",
    progress: "پیشرفت",
    confidence: "اطمینان",
    coverage: "پوشش داده",
  };
  const display = (v: unknown) =>
    v === null || v === undefined
      ? "نامشخص"
      : typeof v === "number"
        ? v.toLocaleString("fa-IR")
        : typeof v === "string"
          ? (businessValueLabels[v] ?? v)
          : "در منبع ثبت شده";
  if (Array.isArray(value))
    return (
      value
        .slice(-3)
        .map((row) => businessEvidenceText({ summary: JSON.stringify(row) }))
        .join(" · ") || "سابقه‌ای ثبت نشده است."
    );
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const row = value as Record<string, unknown>;
    const parts = Object.entries(row)
      .filter(([k]) => !!labels[k])
      .map(([k, v]) => `${labels[k]}: ${display(v)}`);
    if (Array.isArray(row.reasons))
      parts.push(
        ...row.reasons.filter((v) => typeof v === "string").slice(0, 3),
      );
    return (
      parts.join(" · ") || "شاهد ثبت‌شده؛ جزئیات در صفحه منبع قابل بررسی است."
    );
  }
  return display(value);
}
export function newWorkspaceSession(
  context: WorkspaceContext = { type: "executive" },
  label?: string,
): WorkspaceSession {
  const at = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: label ? `بررسی ${label}` : "خلاصه مدیریتی 3S",
    createdAt: at,
    updatedAt: at,
    lastActivityAt: at,
    activeContext: context,
    workspaceState: "Conversation",
    messages: [],
    contextLocked: true,
    dismissedOptions: [],
  };
}
export type WorkspaceIntent =
  | "Ask"
  | "Explain"
  | "Diagnose"
  | "Recommend"
  | "Prepare"
  | "EditDraft"
  | "ApproveIntent"
  | "ExecuteIntent"
  | "ShowEvidence"
  | "RejectIntent"
  | "GeneralQuestion";
export function workspaceIntent(text: string): WorkspaceIntent {
  const q = text.trim().replace(/‌/g, " ");
  if (
    /اجرا(?:ش|یش)?\s*(کن|بکن)|همین[و]?\s*بزن|اوکیه\s*انجامش\s*بده|execute/i.test(
      q,
    )
  )
    return "ExecuteIntent";
  if (/ت[أا]یید(?:ش)?\s*(کن|بکن)|approve/i.test(q)) return "ApproveIntent";
  if (/رد(?:ش)?\s*کن|reject/i.test(q)) return "RejectIntent";
  if (/آماده|پیش نویس|prepare/i.test(q)) return "Prepare";
  if (/شواهد|evidence/i.test(q)) return "ShowEvidence";
  if (/چه کار|پیشنهاد|recommend/i.test(q)) return "Recommend";
  if (/ویرایش|edit/i.test(q)) return "EditDraft";
  if (/خلاصه مدیریتی|تشخیص|تحلیل کن|diagnos/i.test(q)) return "Diagnose";
  if (/اصل عمومی|سؤال عمومی|general/i.test(q)) return "GeneralQuestion";
  if (/چرا|علت|explain/i.test(q)) return "Explain";
  return "Ask";
}
export function resolveVisibleReference(
  text: string,
  options: WorkspaceOption[],
  selected?: string,
) {
  const q = text.trim();
  const ordinal = /اولی|اولین/.test(q)
    ? 0
    : /دومی|دومین/.test(q)
      ? 1
      : /سومی|سومین/.test(q)
        ? 2
        : null;
  if (ordinal !== null) return options[ordinal] ?? null;
  const named = options.filter((o) => q.includes(o.title));
  if (named.length === 1) return named[0];
  if (named.length > 1) return null;
  if (selected) return options.find((o) => o.id === selected) ?? null;
  return options.length === 1 ? options[0] : null;
}
// Resolve targets only from recorded links. Never substitute an unrelated process.
export function contextualOptions(
  c: PreparationContext,
  context: WorkspaceContext,
): WorkspaceOption[] {
  const type = context.type === "kr" ? "KR" : context.type;
  const root = c.entities.find(
    (e) => e.ref.entityType === type && e.ref.entityId === context.id,
  );
  const related = new Set<string>(
    relatedEntities(c, context).map((e) => e.ref.entityId),
  );
  if (root) related.add(root.ref.entityId);
  for (const row of c.entities) {
    if (
      root &&
      Object.values(root.value).some(
        (v) =>
          v === row.ref.entityId ||
          (Array.isArray(v) && v.includes(row.ref.entityId)),
      )
    )
      related.add(row.ref.entityId);
  }
  // Objective's recorded process relationship is also relevant to its KR.
  const objective = c.entities.find(
    (e) =>
      e.ref.entityType === "objective" &&
      e.ref.entityId === root?.value.objectiveId,
  );
  if (objective) {
    related.add(objective.ref.entityId);
    for (const row of c.entities)
      if (
        Object.values(objective.value).some(
          (v) =>
            v === row.ref.entityId ||
            (Array.isArray(v) && v.includes(row.ref.entityId)),
        )
      )
        related.add(row.ref.entityId);
  }
  const candidates: TemplateId[] =
    context.type === "process"
      ? ["Improvement", "KPI"]
      : context.type === "constraint"
        ? ["GrowthIdea", "Experiment"]
        : context.type === "candidate"
          ? ["ScalePreparation"]
          : context.type === "kr"
            ? ["Improvement", "Initiative", "Experiment"]
            : context.type === "objective"
              ? ["KR", "Improvement", "Initiative"]
              : ["GrowthIdea", "Improvement", "Experiment"];
  const result: WorkspaceOption[] = [];
  for (const id of candidates) {
    const t = template(id);
    let targets = c.entities.filter(
      (e) => e.ref.entityType === t.targetType && related.has(e.ref.entityId),
    );
    if (root?.ref.entityType === t.targetType) targets = [root];
    if (context.type === "executive")
      targets = c.entities
        .filter(
          (e) =>
            e.ref.entityType === t.targetType &&
            !["archived", "completed", "cancelled", "resolved"].includes(
              String(e.value.status),
            ),
        )
        .slice(0, 1);
    for (const target of targets.slice(0, 1))
      result.push({
        id: `${id}:${target.ref.entityId}`,
        title: t.title,
        templateId: id,
        targetId: target.ref.entityId,
        targetLabel: target.ref.label ?? contextLabels[context.type],
        why: "گزینه قابل بررسی بر اساس ارتباط ثبت‌شده؛ اثر کسب‌وکار هنوز اثبات نشده است.",
      });
  }
  return result.slice(0, 3);
}
export function relatedEntities(
  c: PreparationContext,
  context: WorkspaceContext,
) {
  const keys = [
    "linkedStrategyKRId",
    "linkedStrategyObjectiveId",
    "linkedSystemProcessId",
    "objectiveId",
    "constraintId",
    "processId",
    "keyResultId",
    "krId",
    "candidateId",
    "experimentId",
  ];
  const ids = new Set<string>(context.id ? [context.id] : []);
  for (let depth = 0; depth < 2; depth++) {
    const before = new Set(ids);
    for (const row of c.entities) {
      const links = [
        ...keys.map((k) => row.value[k]),
        ...(Array.isArray(row.value.processIds) ? row.value.processIds : []),
      ].filter((v) => typeof v === "string" && v);
      if (
        before.has(row.ref.entityId) ||
        links.some((id) => before.has(String(id)))
      ) {
        ids.add(row.ref.entityId);
        for (const id of links) ids.add(String(id));
      }
    }
  }
  return c.entities.filter(
    (e) => ids.has(e.ref.entityId) && e.ref.entityId !== context.id,
  );
}
export function draftTextInput(
  action: PreparedAction,
  text: string,
): Record<string, unknown> | null {
  const q = text
    .trim()
    .replace(/[۰-۹]/g, (c) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c)))
    .replace(/[٠-٩]/g, (c) => String("٠١٢٣٤٥٦٧٨٩".indexOf(c)));
  const missing = action.fields.filter(
    (f) =>
      f.required &&
      (getField(action.payload, f.path) === null ||
        getField(action.payload, f.path) === undefined ||
        getField(action.payload, f.path) === ""),
  );
  let fields = action.fields.filter(
    (f) => q.startsWith(f.label + ":") || q.startsWith(f.label + "："),
  );
  let raw =
    fields.length === 1 ? q.slice(fields[0].label.length + 1).trim() : q;
  if (!fields.length && missing.length === 1) fields = missing;
  if (fields.length !== 1 || !raw) return null;
  const field = fields[0];
  if (field.kind === "number")
    return /^-?\d+(?:\.\d+)?$/.test(raw) && Number.isFinite(Number(raw))
      ? { [field.path]: Number(raw) }
      : null;
  if (field.kind === "date")
    return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? { [field.path]: raw } : null;
  if (["role", "entity", "select"].includes(field.kind)) {
    const choices = field.choices?.filter((c) => c.label === raw) ?? [];
    return choices.length === 1 ? { [field.path]: choices[0].id } : null;
  }
  return q.startsWith(field.label + ":") ? { [field.path]: raw } : null;
}
export function routeWorkspaceIntent(
  text: string,
  options: WorkspaceOption[],
  selected?: string,
  actionId?: string,
) {
  const intent = workspaceIntent(text),
    option = resolveVisibleReference(text, options, selected);
  const ambiguousAction = /اولی|اولین|دومی|دومین|سومی|سومین/.test(text);
  return {
    intent,
    option,
    control:
      intent === "ExecuteIntent"
        ? actionId && !ambiguousAction
          ? "ExecutionConfirmation"
          : "ChooseAction"
        : intent === "ApproveIntent"
          ? actionId && !ambiguousAction
            ? "ApprovalConfirmation"
            : "ChooseAction"
          : intent === "RejectIntent"
            ? actionId && !ambiguousAction
              ? "RejectionControl"
              : "ChooseAction"
            : intent === "Prepare"
              ? option
                ? "PrepareDraft"
                : "ChooseOption"
              : null,
  } as const;
}
