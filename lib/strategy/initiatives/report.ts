import type { StrategyStore, StrategyRole } from "../model";
import {
  calculateKRProgress,
  calculateKRStatus,
  calculateObjectiveProgress,
  validDate,
} from "../kr/calculations";
import {
  initiativeThresholds as t,
  type StrategicInitiative,
  type InitiativeFinding,
} from "./types";
import { initiativeQuality } from "./validation";
export const isInitiativeActive = (i: StrategicInitiative) =>
  i.status === "inProgress" || i.status === "blocked";
export function isInitiativeOverdue(i: StrategicInitiative, today: string) {
  return (
    !["proposed", "completed", "cancelled"].includes(i.status) &&
    validDate(i.dueDate) &&
    i.dueDate < today
  );
}
export function initiativeDeadlineRisk(i: StrategicInitiative, today: string) {
  const days = validDate(i.dueDate)
    ? Math.ceil((Date.parse(i.dueDate) - Date.parse(today)) / 86400000)
    : null;
  return {
    days,
    overdue: isInitiativeOverdue(i, today),
    dueSoon:
      !["proposed", "completed", "cancelled"].includes(i.status) &&
      days !== null &&
      days >= 0 &&
      days <= t.dueSoonDays,
  };
}
export function ownerInitiativeLoad(items: StrategicInitiative[]) {
  const counts = new Map<string, number>();
  for (const i of items.filter(isInitiativeActive))
    if (i.ownerRoleId)
      counts.set(i.ownerRoleId, (counts.get(i.ownerRoleId) ?? 0) + 1);
  return [...counts].map(([ownerRoleId, count]) => ({
    ownerRoleId,
    count,
    overloaded: count > t.perOwner,
  }));
}
export function initiativeCapacityWarnings(
  items: StrategicInitiative[],
  roles: StrategyRole[],
): InitiativeFinding[] {
  const active = items.filter(isInitiativeActive),
    findings: InitiativeFinding[] = [];
  if (active.length > t.perCycle)
    findings.push({
      id: "capacity-cycle",
      severity: 70,
      text: `بیش از ${t.perCycle} اقدام هم‌زمان در این دوره فعال است؛ تمرکز اجرا را بازبینی کنید.`,
      href: "/strategy/initiatives",
    });
  for (const id of new Set(active.map((i) => i.objectiveId)))
    if (active.filter((i) => i.objectiveId === id).length > t.perObjective)
      findings.push({
        id: "capacity-objective-" + id,
        severity: 70,
        text: `بیش از ${t.perObjective} اقدام هم‌زمان برای یک هدف فعال است.`,
        href: `/strategy/cycles/${active.find((i) => i.objectiveId === id)!.cycleId}/objectives/${id}`,
      });
  for (const owner of ownerInitiativeLoad(items).filter((o) => o.overloaded))
    findings.push({
      id: "capacity-owner-" + owner.ownerRoleId,
      severity: 75,
      text: `${roles.find((r) => r.id === owner.ownerRoleId)?.title ?? "نقش ناموجود"}: تمرکز اجرای استراتژی روی این نقش بالاست (${owner.count} اقدام).`,
      href: "/strategy/initiatives",
    });
  return findings;
}
export function executionResultGap(
  execution: number | null,
  result: number | null,
) {
  const gap = execution !== null && result !== null ? execution - result : null;
  return {
    gap,
    needsReview: gap !== null && gap >= t.gapAttention,
    text:
      gap === null
        ? "برای مقایسه اجرا و نتیجه داده کافی نیست."
        : gap >= t.gapAttention
          ? "حجم اجرای اقدامات از حرکت نتایج جلوتر است؛ اثربخشی اقدامات نیازمند بررسی است. این اختلاف رابطه علت‌ومعلولی را اثبات نمی‌کند."
          : "اختلاف اجرا و نتیجه صرفاً زمینه بررسی مدیریت است؛ رابطه علت‌ومعلولی را نشان نمی‌دهد.",
  };
}
export function initiativeKRSignals(
  i: StrategicInitiative,
  store: StrategyStore,
  today: string,
): InitiativeFinding[] {
  const kr = store.keyResults?.find((k) => k.id === i.keyResultId),
    findings: InitiativeFinding[] = [],
    href = "/strategy/initiatives/" + i.id;
  if (!kr || i.status === "cancelled" || kr.lifecycle === "cancelled")
    return findings;
  const p = calculateKRProgress(kr),
    status = calculateKRStatus(kr, today).status;
  const add = (id: string, severity: number, text: string) =>
    findings.push({ id: id + "-" + i.id, severity, text, href });
  if (p !== null && i.progress > t.highExecution && p < t.lowKRProgress)
    add(
      "gap",
      80,
      "اجرای اقدام جلوتر از حرکت نتیجه است؛ نیازمند بررسی، بدون استنتاج علت‌ومعلولی.",
    );
  if (
    i.status === "completed" &&
    p !== null &&
    i.krProgressAtStart != null &&
    i.baselineKeyResultId === kr.id &&
    p - i.krProgressAtStart <= t.meaningfulMovement
  )
    add(
      "unchanged",
      85,
      "اقدام تکمیل شده، اما KR از زمان آغاز ثبت‌شده حرکت مثبت معناداری نداشته است؛ نیازمند بررسی.",
    );
  if (i.status === "blocked" && (status === "atRisk" || status === "offTrack"))
    add(
      "blocked-risk",
      100,
      "اقدام متوقف است و نتیجه کلیدی مرتبط نیز در معرض ریسک یا خارج از مسیر است.",
    );
  if (p === 100 && isInitiativeActive(i))
    add(
      "achieved",
      60,
      "KR محقق شده است؛ ضرورت ادامه این اقدام را بازبینی کنید.",
    );
  return findings;
}
export function initiativeNeedsAttention(
  items: StrategicInitiative[],
  store: StrategyStore,
  roles: StrategyRole[],
  today: string,
): InitiativeFinding[] {
  const findings = initiativeCapacityWarnings(items, roles);
  for (const i of items.filter((i) => i.status !== "cancelled")) {
    const href = "/strategy/initiatives/" + i.id,
      add = (id: string, severity: number, text: string) =>
        findings.push({
          id: id + "-" + i.id,
          severity,
          text: `${i.code} · ${i.title}: ${text}`,
          href,
        });
    const risk = initiativeDeadlineRisk(i, today);
    if (risk.overdue) add("overdue", 90, "مهلت اقدام گذشته است.");
    else if (risk.dueSoon) add("soon", 60, "مهلت اقدام در هفت روز آینده است.");
    if (
      isInitiativeActive(i) &&
      ["critical", "high"].includes(i.priority) &&
      i.progress < t.lowExecution
    )
      add(
        "priority-progress",
        80,
        "اهمیت اجرایی بالا و پیشرفت کمتر از ۲۵٪؛ نیازمند توجه.",
      );
    if (i.status === "blocked")
      add(
        "blocked",
        ["critical", "high"].includes(i.priority) ? 95 : 80,
        `متوقف‌شده: ${i.blockedReason}`,
      );
    if (
      i.status === "completed" &&
      (i.effectiveness === "notEvaluated" || !i.actualImpact.trim())
    )
      add(
        "evaluation",
        75,
        "اثر این اقدام هنوز ارزیابی نشده یا شاهد واقعی ثبت نشده است.",
      );
    const q = initiativeQuality(i, store, roles);
    if (
      isInitiativeActive(i) &&
      (store.keyResults?.find((k) => k.id === i.keyResultId)?.lifecycle ===
        "cancelled" ||
        store.objectives.find((o) => o.id === i.objectiveId)?.status ===
          "cancelled")
    )
      add(
        "cancelled-link",
        90,
        "هدف یا نتیجه مرتبط لغوشده است؛ ادامه اقدام را بازبینی کنید.",
      );
    if (q.missing.length) add("incomplete", 65, q.missing.join(" "));
    for (const f of initiativeKRSignals(i, store, today))
      findings.push({ ...f, text: `${i.code} · ${i.title}: ${f.text}` });
  }
  return findings.sort(
    (a, b) => b.severity - a.severity || a.id.localeCompare(b.id),
  );
}
export function portfolioSummary(items: StrategicInitiative[], today: string) {
  const eligible = items.filter((i) =>
    ["inProgress", "blocked", "completed"].includes(i.status),
  );
  return {
    total: items.length,
    active: items.filter(isInitiativeActive).length,
    blocked: items.filter((i) => i.status === "blocked").length,
    overdue: items.filter((i) => isInitiativeOverdue(i, today)).length,
    completed: items.filter((i) => i.status === "completed").length,
    effective: items.filter(
      (i) => i.status !== "cancelled" && i.effectiveness === "effective",
    ).length,
    needsEvaluation: items.filter(
      (i) =>
        i.status === "completed" &&
        (i.effectiveness === "notEvaluated" || !i.actualImpact.trim()),
    ).length,
    execution: eligible.length
      ? eligible.reduce((n, i) => n + i.progress, 0) / eligible.length
      : null,
  };
}
export function objectiveExecution(
  store: StrategyStore,
  objectiveId: string,
  today: string,
) {
  const items = (store.initiatives ?? []).filter(
      (i) => i.objectiveId === objectiveId,
    ),
    summary = portfolioSummary(items, today),
    objective = store.objectives.find((o) => o.id === objectiveId),
    result = objective
      ? calculateObjectiveProgress(
          (store.keyResults ?? []).filter((k) => k.objectiveId === objectiveId),
          objective.krWeightMode ?? "equal",
        )
      : null;
  return {
    items,
    summary,
    result,
    ...executionResultGap(summary.execution, result),
  };
}
export function initiativeReadOnly(
  store: StrategyStore,
  i: Pick<StrategicInitiative, "cycleId">,
) {
  return ["completed", "archived"].includes(
    store.cycles.find((c) => c.id === i.cycleId)?.status ?? "",
  );
}
