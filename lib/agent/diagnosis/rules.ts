import type { Domain, Risk } from "../types";
import type {
  AgentSignal,
  PatternType,
  AgentPattern,
  AgentDiagnosis,
} from "./types";
import { fingerprint } from "./source";
type Match = { signals: AgentSignal[]; primaryKey: string };
export interface DiagnosisRule {
  id: string;
  name: string;
  description: string;
  requiredDomains: Domain[];
  type: PatternType;
  category: AgentDiagnosis["category"];
  severityLogic: Risk;
  confidenceLogic: string;
  dedupKey: string;
  enabled: boolean;
  evaluate(signals: AgentSignal[]): Match[];
}
const same = (a: AgentSignal, b: AgentSignal) =>
  a.entityRefs.some((x) =>
    b.entityRefs.some(
      (y) =>
        x.domain === y.domain &&
        x.entityType === y.entityType &&
        x.entityId === y.entityId,
    ),
  );
const core = (s: AgentSignal) =>
  s.entityRefs.find((r) => r.entityType === "process") ??
  s.entityRefs.find((r) => r.entityType === "KR") ??
  s.entityRefs[0];
function key(s: AgentSignal) {
  const r = core(s);
  return r ? `${r.domain}:${r.entityType}:${r.entityId}` : s.fingerprint;
}
function joins(signals: AgentSignal[], families: string[][]): Match[] {
  const first = signals.filter((s) => families[0].includes(s.sourceFamily));
  return first.flatMap((seed) => {
    const group = [seed];
    for (const family of families.slice(1)) {
      const matches = signals.filter(
        (s) => family.includes(s.sourceFamily) && same(seed, s),
      );
      if (!matches.length) return [];
      group.push(...matches);
    }
    return [{ signals: group, primaryKey: key(seed) }];
  });
}
function rule(
  id: string,
  name: string,
  type: PatternType,
  category: AgentDiagnosis["category"],
  families: string[][],
  domains: Domain[],
  severity: Risk = "High",
): DiagnosisRule {
  return {
    id,
    name,
    type,
    category,
    description: name + "؛ فقط پیوندهای ثبت‌شده بررسی می‌شوند.",
    requiredDomains: domains,
    severityLogic: severity,
    confidenceLogic: "منابع مستقل، کیفیت شواهد و تکرار در اسکن‌های دستی",
    dedupKey: "نوع مسئله + موجودیت اصلی مرتبط",
    enabled: true,
    evaluate: (signals) => joins(signals, families),
  };
}
export const diagnosisRules: DiagnosisRule[] = [
  rule(
    "closing-chain",
    "نتیجه کلیدی، قیف و فرآیند مرتبط نیازمند بررسی مشترک‌اند",
    "CrossModuleConstraint",
    "CrossModule",
    [
      ["constraint"],
      ["KR-progress"],
      ["funnel"],
      ["process-health", "founder"],
    ],
    ["System", "Strategy", "Scale"],
  ),
  rule(
    "execution-result",
    "فعالیت یا تبدیل از حرکت نتیجه جلوتر است",
    "ExecutionResultMismatch",
    "StrategyExecution",
    [["execution-result", "revenue-funnel"]],
    ["Strategy"],
  ),
  rule(
    "growth-capacity",
    "ظرفیت پیش از افزایش حجم نیازمند بررسی است",
    "GrowthCapacityMismatch",
    "Capacity",
    [["growth-capacity"], ["founder", "process-health"]],
    ["System", "Scale"],
  ),
  rule(
    "strategy-capacity",
    "ظرفیت رشد با نتیجه استراتژیک در معرض ریسک همراه است",
    "StrategyCapacityMismatch",
    "Capacity",
    [["growth-capacity"], ["KR-progress"]],
    ["Strategy", "Scale"],
  ),
  rule(
    "founder-impact",
    "وابستگی به بنیان‌گذار در مسیر رشد",
    "FounderDependencyImpact",
    "LeadershipDependency",
    [["constraint", "growth-volume"], ["founder"]],
    ["System", "Scale"],
  ),
  rule(
    "experiment-system",
    "شواهد مثبت آزمایش با آمادگی اجرای فرآیند فاصله دارد",
    "ExperimentToSystemConflict",
    "SystemConstraint",
    [["experiment-result"], ["process-readiness"]],
    ["System", "Scale"],
  ),
  rule(
    "quality-kr",
    "برای قضاوت درباره نتیجه کلیدی داده تازه لازم است",
    "DataQualityRisk",
    "DataQuality",
    [["KR-quality"]],
    ["Strategy"],
    "Medium",
  ),
  rule(
    "quality-capacity",
    "قضاوت درباره آمادگی رشد به داده بیشتر نیاز دارد",
    "DataQualityRisk",
    "DataQuality",
    [["candidate-quality"]],
    ["Scale"],
    "Medium",
  ),
  rule(
    "owner-load",
    "نتیجه کلیدی در معرض ریسک و مالک پرتراکم",
    "ResourceOverload",
    "Capacity",
    [["KR-progress"], ["owner-load"]],
    ["Strategy"],
  ),
  rule(
    "growth-alignment",
    "پیوند استراتژیک تعهد رشد نیازمند بازبینی است",
    "AlignmentConflict",
    "Alignment",
    [["growth-alignment"]],
    ["Scale", "Strategy"],
  ),
  rule(
    "decision-conflict",
    "تعهد رشد با شواهد آمادگی تعارض دارد",
    "GrowthCapacityMismatch",
    "Capacity",
    [["growth-decision"]],
    ["Scale"],
  ),
  rule(
    "growth-opportunity",
    "آمادگی رشد فرصت بررسی مدیریت است",
    "EmergingOpportunity",
    "Opportunity",
    [["candidate-ready"]],
    ["Scale"],
    "Medium",
  ),
  rule(
    "repeated-blocker",
    "مانع تکرارشونده با مسئله فرآیند مرتبط همراه است",
    "RepeatedManagementBlocker",
    "SystemConstraint",
    [["repeated-blocker"], ["process-health", "founder", "process-readiness"]],
    ["Strategy", "System"],
  ),
  rule(
    "negative-experiments",
    "چند آزمایش یک محدودیت نتیجه مثبت نداشته‌اند",
    "RepeatedManagementBlocker",
    "GrowthConstraint",
    [["negative-experiments"]],
    ["Scale"],
    "Medium",
  ),
  rule(
    "channel-concentration",
    "توسعه رشد همراه با تمرکز کانال است",
    "GrowthCapacityMismatch",
    "GrowthConstraint",
    [["channel-concentration"]],
    ["Scale"],
  ),
];
export function detectPatterns(
  signals: AgentSignal[],
  at: string,
): AgentPattern[] {
  const unique = new Map<string, AgentPattern>();
  for (const r of diagnosisRules.filter((x) => x.enabled))
    for (const m of r.evaluate(signals)) {
      const fp = r.id + ":" + m.primaryKey;
      const previous = unique.get(fp);
      const families = new Set(m.signals.map((s) => s.sourceFamily));
      const entities = new Map(
        m.signals
          .flatMap((s) => s.entityRefs)
          .map((x) => [`${x.domain}:${x.entityType}:${x.entityId}`, x]),
      );
      unique.set(fp, {
        id: "p-" + fingerprint(fp),
        fingerprint: fp,
        ruleId: r.id,
        primaryKey: m.primaryKey,
        type: r.type,
        title: r.name,
        description: r.description,
        signalIds: [
          ...new Set([
            ...(previous?.signalIds ?? []),
            ...m.signals.map((s) => s.id),
          ]),
        ],
        evidenceIds: [
          ...new Set([
            ...(previous?.evidenceIds ?? []),
            ...m.signals.flatMap((s) => s.evidenceIds),
          ]),
        ],
        entityRefs: [
          ...new Map(
            [...(previous?.entityRefs ?? []), ...entities.values()].map((e) => [
              e.domain + ":" + e.entityType + ":" + e.entityId,
              e,
            ]),
          ).values(),
        ],
        strength:
          families.size >= 3
            ? "Strong"
            : families.size >= 2
              ? "Moderate"
              : "Weak",
        firstDetectedAt: at,
        lastDetectedAt: at,
        status: "Active",
      });
    }
  return [...unique.values()];
}
