import { defaultPermissions, findCapability, permitted } from "./capabilities";
import { audit, fail } from "./actions";
import { buildContextPacket, type AgentReadContext } from "./context";
import { routeWorkspaceIntent, type WorkspaceOption } from "./workspace";
import type {
  AgentPermission,
  AgentRecommendation,
  AgentState,
  AgentToolResult,
} from "./types";
export class AgentOrchestrator {
  workspaceIntent(
    text: string,
    visibleOptions: WorkspaceOption[],
    selectedOptionId?: string,
    activeActionId?: string,
  ) {
    return routeWorkspaceIntent(
      text,
      visibleOptions,
      selectedOptionId,
      activeActionId,
    );
  }
  constructor(
    private permissions: readonly AgentPermission[] = defaultPermissions,
  ) {}
  invoke(id: string, input: unknown, ctx: AgentReadContext): AgentToolResult {
    const c = findCapability(id);
    if (!c || !c.enabled)
      return {
        success: false,
        evidence: [],
        warnings: [],
        error: {
          code: "UnsupportedCapability",
          message: "قابلیت پشتیبانی نمی‌شود.",
        },
      };
    if (!permitted(c, this.permissions))
      return {
        success: false,
        evidence: [],
        warnings: [],
        error: { code: "PermissionDenied", message: "مجوز لازم وجود ندارد." },
      };
    if (c.authorityLevel === "Execute")
      return {
        success: false,
        evidence: [],
        warnings: [],
        error: {
          code: "ApprovalRequired",
          message: "اقدام نیازمند پیشنهاد، تأیید و اجرای مرکزی است.",
        },
      };
    if (
      !input ||
      typeof input !== "object" ||
      Array.isArray(input) ||
      Object.keys(input).some((k) => k !== "entityId")
    )
      return {
        success: false,
        evidence: [],
        warnings: [],
        error: { code: "InvalidPayload", message: "ورودی معتبر لازم است." },
      };
    const entityId = (input as Record<string, unknown>).entityId;
    if (entityId !== undefined && typeof entityId !== "string")
      return {
        success: false,
        evidence: [],
        warnings: [],
        error: { code: "InvalidPayload", message: "شناسه باید متن باشد." },
      };
    const types: Record<string, string> = {
      getProcess: "process",
      getProcessKPIs: "process",
      getKR: "KR",
    };
    const entity = entityId
      ? ctx.entities.find(
          (e) =>
            e.ref.entityId === entityId &&
            e.ref.domain === c.domain &&
            (!types[c.name] || e.ref.entityType === types[c.name]),
        )
      : undefined;
    if ((entityId && !entity) || (types[c.name] && !entity))
      return {
        success: false,
        evidence: [],
        warnings: [],
        error: { code: "EntityNotFound", message: "موجودیت پیدا نشد." },
      };
    const packet = buildContextPacket(ctx, c.name, entity?.ref),
      ev = packet.evidence.filter(
        (e) =>
          c.domain === "Executive" ||
          c.domain === "CrossModule" ||
          e.domain === c.domain,
      );
    return {
      success: true,
      data:
        c.authorityLevel === "Prepare"
          ? {
              kind: "draft",
              capabilityId: id,
              title: "پیش‌نویس برای بررسی کاربر",
              context: packet,
              requiresApprovalForExecution: true,
            }
          : id === "system.getProcessKPIs"
            ? {
                process: entity?.ref,
                kpis: structuredClone(ctx.reads?.[`${id}:${entityId}`] ?? []),
              }
            : entity
              ? structuredClone(entity)
              : ctx.reads && id in ctx.reads
                ? structuredClone(ctx.reads[id])
                : {
                    summary:
                      ctx.snapshot[c.domain as "System" | "Strategy" | "Scale"],
                    packet: { ...packet, evidence: ev },
                  },
      evidence: ev,
      warnings:
        c.authorityLevel === "Prepare"
          ? ["پیش‌نویس به داده کسب‌وکار نوشته نشده است."]
          : ctx.notices,
    };
  }
  recommend(
    s: AgentState,
    ctx: AgentReadContext,
    at = new Date().toISOString(),
  ) {
    const c = findCapability("crossmodule.recommend")!;
    if (!permitted(c, this.permissions))
      return fail("PermissionDenied", "مجوز توصیه وجود ندارد.");
    const specs: {
      title: string;
      rationale: string;
      ids: string[];
      confidence: AgentRecommendation["confidence"];
      actions: string[];
    }[] = [];
    if (ctx.signals.linkedChain.length)
      specs.push({
        title: "استانداردسازی و واگذاری پیش از افزایش تقاضا",
        rationale:
          "KR با وزن بالا خارج از مسیر است؛ گلوگاه مرتبط، آزمایش مثبت و وابستگی فرآیند به بنیان‌گذار هم‌زمان ثبت شده‌اند.",
        ids: ctx.signals.linkedChain,
        confidence: "Medium",
        actions: ["system.prepareImprovement"],
      });
    if (ctx.signals.strongGrowth && ctx.signals.capacityRisk)
      specs.push({
        title: "ابتدا ظرفیت را آماده کنید، سپس رشد دهید",
        rationale:
          "بلوغ شواهد رشد همراه با ریسک ظرفیت گزارش شده است؛ مثبت بودن رشد به معنی آمادگی اجرا نیست.",
        ids: ctx.evidence
          .filter(
            (e) =>
              e.evidenceType === "Capacity" ||
              e.sourceSelector === "getScaleEvidence",
          )
          .map((e) => e.id),
        confidence: "Medium",
        actions: ["scale.preparePreparationItem"],
      });
    if (ctx.signals.missingEvidence)
      specs.push({
        title: "شواهد مفقود را تکمیل کنید",
        rationale:
          "شواهد رشد یا ارزیابی آمادگی ناکافی است؛ پیش از تصمیم، داده مرتبط را ثبت و بازبینی کنید.",
        ids: ctx.evidence
          .filter(
            (e) =>
              e.sourceSelector === "getScaleEvidence" ||
              e.evidenceType === "Capacity" ||
              e.value === null,
          )
          .map((e) => e.id),
        confidence: "Low",
        actions: ["scale.prepareExperiment"],
      });
    return specs
      .slice(0, 3)
      .filter((x) => x.ids.length)
      .map((x) => {
        x.ids.forEach((id) => {
          const e = ctx.evidence.find((e) => e.id === id)!;
          if (!s.evidence.some((e) => e.id === id))
            s.evidence.push(structuredClone(e));
        });
        const o = {
          id: crypto.randomUUID(),
          domain: "CrossModule" as const,
          type: "CanonicalSignal",
          statement: x.rationale,
          evidenceIds: [...x.ids],
          createdAt: at,
        };
        s.observations.push(o);
        audit(s, "ObservationCreated", o.id, o.statement, at);
        const r: AgentRecommendation = {
          id: crypto.randomUUID(),
          domain: "CrossModule",
          title: x.title,
          summary: x.title,
          rationale: x.rationale,
          priority: "High",
          confidence: x.confidence,
          evidenceIds: [...x.ids],
          suggestedActions: x.actions,
          status: "New",
          createdAt: at,
        };
        s.recommendations.push(r);
        audit(s, "RecommendationCreated", r.id, r.title, at);
        return r;
      });
  }
}
