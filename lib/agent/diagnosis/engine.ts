import type {
  AgentDiagnosis,
  AgentPattern,
  DiagnosisState,
  DiagnosisHistoryEvent,
  DiagnosisStatus,
  SignalInput,
  AgentPriorityIssue,
} from "./types";
import { detectPatterns, diagnosisRules } from "./rules";
import { fingerprint } from "./source";
const rank = { Low: 0, Medium: 1, High: 2, Critical: 3 };
const riskLabel = {
  Low: "پایین",
  Medium: "متوسط",
  High: "بالا",
  Critical: "بحرانی",
};
const confidenceLabel = { Low: "کم", Medium: "متوسط", High: "زیاد" };
function history(
  state: DiagnosisState,
  d: AgentDiagnosis,
  event: DiagnosisHistoryEvent["event"],
  at: string,
  summary: string,
) {
  state.history.push({
    id: "h-" + fingerprint([d.id, event, at, state.history.length]),
    diagnosisId: d.id,
    event,
    timestamp: at,
    summary,
    evidenceIds: [...d.evidenceIds],
  });
}
export function rankDiagnoses(
  diagnoses: AgentDiagnosis[],
  at: string,
): AgentPriorityIssue[] {
  return diagnoses
    .filter(
      (d) =>
        ["New", "Reviewed", "Monitoring"].includes(d.status) &&
        !d.needsRefresh &&
        d.category !== "Opportunity",
    )
    .map((d) => {
      const reach = new Set(d.affectedEntities.map((x) => x.domain)).size;
      const factors = {
        severity: d.severity,
        confidence: d.confidence,
        reach,
        persistence: d.firstDetectedAt !== d.lastSeenAt,
        capacity:
          d.sourceFamilies.some(
            (f) => f === "growth-capacity" || f === "owner-load",
          ) ||
          ["Capacity", "SystemConstraint", "LeadershipDependency"].includes(
            d.category,
          ),
        strategic: d.affectedEntities.some((x) => x.entityType === "KR"),
        deadline: d.deadlineRisk ?? false,
      };
      return { d, factors };
    })
    .sort(
      (a, b) =>
        rank[b.d.severity] - rank[a.d.severity] ||
        rank[b.d.confidence] - rank[a.d.confidence] ||
        b.factors.reach - a.factors.reach ||
        Number(b.factors.capacity) - Number(a.factors.capacity) ||
        Number(b.factors.strategic) - Number(a.factors.strategic) ||
        Number(b.factors.deadline) - Number(a.factors.deadline) ||
        Number(b.factors.persistence) - Number(a.factors.persistence) ||
        a.d.id.localeCompare(b.d.id),
    )
    .slice(0, 3)
    .map(({ d, factors }, i) => ({
      id: "priority-" + d.id,
      diagnosisId: d.id,
      rank: i + 1,
      priority: d.severity,
      reason: `شدت ${riskLabel[d.severity]}؛ اطمینان ${confidenceLabel[d.confidence]}؛ ${factors.reach.toLocaleString("fa-IR")} حوزه مرتبط${factors.persistence ? "؛ تکرار در تحلیل دستی" : ""}`,
      managementFocus: d.managementQuestion,
      evidenceIds: d.evidenceIds,
      generatedAt: at,
      factors,
    }));
}
export function runDiagnosis(
  previous: DiagnosisState,
  input: SignalInput,
  at = new Date().toISOString(),
): DiagnosisState {
  const state = structuredClone(previous),
    evidenceIds = new Set(state.evidence.map((e) => e.id));
  for (const e of input.evidence)
    if (!evidenceIds.has(e.id)) {
      state.evidence.push(structuredClone(e));
      evidenceIds.add(e.id);
    }
  const oldSignals = new Map(state.signals.map((s) => [s.fingerprint, s]));
  const present = new Set(input.signals.map((s) => s.fingerprint));
  for (const s of input.signals) {
    const old = oldSignals.get(s.fingerprint);
    oldSignals.set(s.fingerprint, {
      ...s,
      detectedAt: old?.detectedAt ?? at,
      lastSeenAt: at,
    });
  }
  for (const s of oldSignals.values())
    if (!present.has(s.fingerprint))
      s.status =
        !input.availableKeys.includes(s.sourceKey) ||
        input.signals.some(
          (q) =>
            q.type === "DataQuality" &&
            q.entityRefs.some((r) =>
              s.entityRefs.some(
                (old) =>
                  old.domain === r.domain &&
                  old.entityType === r.entityType &&
                  old.entityId === r.entityId,
              ),
            ),
        )
          ? "Stale"
          : "Resolved";
  state.signals = [...oldSignals.values()];
  const patterns = detectPatterns(
      state.signals.filter(
        (s) => s.status === "Active" && present.has(s.fingerprint),
      ),
      at,
    ),
    oldPatterns = new Map(state.patterns.map((p) => [p.fingerprint, p]));
  const activePatterns = new Set(patterns.map((p) => p.fingerprint));
  for (const p of patterns)
    oldPatterns.set(p.fingerprint, {
      ...p,
      firstDetectedAt: oldPatterns.get(p.fingerprint)?.firstDetectedAt ?? at,
    });
  const signalById = new Map(state.signals.map((s) => [s.id, s]));
  for (const p of oldPatterns.values())
    if (!activePatterns.has(p.fingerprint))
      p.status = p.signalIds.some(
        (id) => signalById.get(id)?.status === "Stale",
      )
        ? "Stale"
        : "Resolved";
  state.patterns = [...oldPatterns.values()];
  // Connected risk patterns collapse at the explicit primary entity. Quality and opportunity stay separate.
  const groups = new Map<string, AgentPattern[]>();
  for (const p of patterns) {
    const category = diagnosisRules.find((r) => r.id === p.ruleId)!.category;
    const groupKey =
      (category === "DataQuality" || category === "Opportunity"
        ? category
        : "Issue") +
      ":" +
      p.primaryKey;
    groups.set(groupKey, [...(groups.get(groupKey) ?? []), p]);
  }
  const oldDiagnoses = new Map(state.diagnoses.map((d) => [d.fingerprint, d]));
  let created = 0;
  for (const [fp, ps] of groups) {
    const old = oldDiagnoses.get(fp),
      rule = diagnosisRules.find((r) => r.id === ps[0].ruleId)!;
    const ss = [...new Set(ps.flatMap((p) => p.signalIds))].map((id) =>
      signalById.get(id)!,
    );
    const sourceFamilies = [...new Set(ss.map((s) => s.sourceFamily))];
    const ev = [...new Set(ps.flatMap((p) => p.evidenceIds))];
    const entities = [
      ...new Map(
        ps
          .flatMap((p) => p.entityRefs)
          .map((r) => [r.domain + ":" + r.entityType + ":" + r.entityId, r]),
      ).values(),
    ];
    const domains = new Set(entities.map((e) => e.domain));
    const independentDomains = new Set(ss.map((s) => s.domain));
    const conflict =
      rule.category === "Opportunity" &&
      groups.has("Issue:" + ps[0].primaryKey);
    const quality =
      rule.category === "DataQuality" ||
      conflict ||
      ss.some((s) => s.confidence === "Low");
    const confidence = quality
      ? "Low"
      : sourceFamilies.length >= 3 && independentDomains.size >= 2
        ? "High"
        : "Medium";
    const d: AgentDiagnosis = {
      id: old?.id ?? "d-" + fingerprint(fp),
      fingerprint: fp,
      title: ps[0].title,
      summary:
        ps.map((p) => p.title).join("؛ ") +
        " این همراهی علت‌ومعلول را اثبات نمی‌کند." +
        (conflict
          ? " شواهد مثبت و محدودیت مرتبط هم‌زمان وجود دارند؛ ابهام باید بررسی شود."
          : ""),
      category: rule.category,
      severity: ss.reduce(
        (v, s) => (rank[s.severity] > rank[v] ? s.severity : v),
        rule.severityLogic,
      ),
      confidence,
      patternIds: ps.map((p) => p.id),
      evidenceIds: ev,
      affectedEntities: entities,
      businessImpact:
        domains.size >= 3
          ? "Strategic"
          : domains.size >= 2
            ? "CrossFunctional"
            : "Localized",
      managementQuestion: quality
        ? "کدام داده باید پیش از تصمیم تازه‌سازی یا تکمیل شود؟"
        : rule.category === "Opportunity"
          ? "آیا شواهد و ظرفیت برای بررسی یک توسعه محدود کافی است؟"
          : entities.some((e) => e.entityType === "process")
            ? "آیا استاندارد اجرا، مالکیت و ظرفیت فرآیند مرتبط پیش از افزایش حجم نیازمند بررسی است؟"
            : "کدام عامل قابل بررسی، حرکت نتیجه را محدود کرده است؟",
      status: old?.status === "Resolved" ? "New" : (old?.status ?? "New"),
      firstDetectedAt: old?.firstDetectedAt ?? at,
      lastUpdatedAt: at,
      lastSeenAt: at,
      needsRefresh: false,
      sourceFamilies,
      deadlineRisk: input.evidence.some(
        (e) =>
          ev.includes(e.id) &&
          !!e.value &&
          typeof e.value === "object" &&
          "overdue" in e.value &&
          e.value.overdue === true,
      ),
      recurrenceCount:
        (old?.recurrenceCount ?? 0) + (old?.status === "Resolved" ? 1 : 0),
      recommendations: [],
    };
    d.recommendations = [
      {
        id: "rec-" + d.id,
        domain: "CrossModule",
        title: quality
          ? "تکمیل شواهد پیش از تصمیم"
          : "بررسی مسیر مرتبط با مسئله",
        summary: d.managementQuestion,
        rationale: d.summary,
        priority: d.severity,
        confidence: d.confidence,
        evidenceIds: ev,
        suggestedActions: [],
        status: "New",
        createdAt: at,
        recommendationType: quality
          ? "CollectData"
          : rule.category === "Opportunity"
            ? "Validate"
            : "Investigate",
      },
    ];
    oldDiagnoses.set(fp, d);
    if (!old) {
      created++;
      history(state, d, "Created", at, d.summary);
    } else if (old.status === "Resolved")
      history(
        state,
        d,
        "Reopened",
        at,
        "مسئله در داده‌های فعلی دوباره مشاهده شد.",
      );
    else if (
      fingerprint([old.evidenceIds, old.patternIds, old.confidence]) !==
      fingerprint([ev, d.patternIds, confidence])
    )
      history(state, d, "Updated", at, d.summary);
  }
  for (const [fp, d] of oldDiagnoses)
    if (!groups.has(fp) && !["Resolved", "Dismissed"].includes(d.status)) {
      const missing = d.patternIds.some(
        (id) => state.patterns.find((p) => p.id === id)?.status === "Stale",
      );
      if (missing) d.needsRefresh = true;
      else {
        d.status = "Resolved";
        d.lastUpdatedAt = at;
        d.needsRefresh = false;
        history(
          state,
          d,
          "Resolved",
          at,
          "الگوی مرتبط در تحلیل فعلی مشاهده نشد؛ تاریخچه و شواهد قبلی حفظ شدند.",
        );
      }
    }
  state.diagnoses = [...oldDiagnoses.values()];
  state.priorities = rankDiagnoses(state.diagnoses, at);
  state.runs.push({
    id: "run-" + fingerprint([at, state.runs.length]),
    startedAt: at,
    completedAt: at,
    scope: "Executive3S",
    contextVersion: input.signature,
    signalsFound: input.signals.length,
    patternsFound: patterns.length,
    diagnosesCreated: created,
    status: "Completed",
    mode: "DeterministicOnly",
  });
  return state;
}
export function setDiagnosisStatus(
  previous: DiagnosisState,
  id: string,
  status: DiagnosisStatus,
  reason = "",
  at = new Date().toISOString(),
) {
  const state = structuredClone(previous),
    d = state.diagnoses.find((d) => d.id === id);
  if (!d) throw new Error("تحلیل پیدا نشد.");
  if (d.status === status) return state;
  d.status = status;
  d.lastUpdatedAt = at;
  history(
    state,
    d,
    status === "New" ? "Reopened" : status,
    at,
    reason.slice(0, 600) || "وضعیت تحلیل توسط کاربر تغییر کرد.",
  );
  state.priorities = rankDiagnoses(state.diagnoses, at);
  return state;
}
