import type { ScaleStore } from "../model";
import type { ScaleSources } from "../sources";
import { experimentData } from "../experiments/model";
import * as M from "./model";
import { scaleReadiness } from "./logic";
import { validateReadiness, assertReadinessTransition } from "./validation";
const clone = (s: ScaleStore) => ({
  ...s,
  readinessData: structuredClone(M.readinessData(s)),
});
function checked(s: ScaleStore, n: ScaleStore) {
  validateReadiness(n);
  assertReadinessTransition(s, n);
  return n;
}
export function saveCandidate(
  s: ScaleStore,
  c: M.ScaleCandidate,
  sources?: ScaleSources,
) {
  const n = clone(s),
    old = n.readinessData.candidates.find((x) => x.id === c.id);
  if (!old) {
    if (
      c.sourceType === "experiment" &&
      !experimentData(s).experiments.some(
        (e) =>
          e.id === c.sourceId &&
          e.status === "completed" &&
          ["win", "partial"].includes(e.resultStatus ?? ""),
      )
    )
      throw Error("آزمایش با نتیجه مثبت تکمیل‌شده انتخاب کنید.");
    if (
      c.sourceType === "idea" &&
      !s.ideas.some((i) => i.id === c.sourceId && i.status === "validated")
    )
      throw Error("ایده اعتبارسنجی‌شده انتخاب کنید.");
  } else if (old.sourceId !== c.sourceId || old.sourceType !== c.sourceType)
    throw Error(
      "برای منبع متفاوت کاندید جدید بسازید؛ سابقه این منبع حفظ می‌شود.",
    );
  if (c.status === "ready") {
    const snapshot = n.readinessData.snapshots
      .filter((x) => x.candidateId === c.id)
      .at(-1);
    const scenario =
      n.readinessData.scenarios.find((x) => x.id === snapshot?.scenario?.id) ??
      null;
    if (!sources || scaleReadiness(s, c, sources, scenario).gate !== "ready")
      throw Error("آمادگی باید با شواهد، ظرفیت و منابع فعلی دوباره تأیید شود.");
  }
  n.readinessData.candidates = [
    ...n.readinessData.candidates.filter((x) => x.id !== c.id),
    { ...c, createdAt: old?.createdAt ?? c.createdAt, updatedAt: M.now() },
  ];
  return checked(s, n);
}
export function saveArea(s: ScaleStore, x: M.CapacityArea) {
  const n = clone(s);
  n.readinessData.areas = [
    ...n.readinessData.areas.filter((a) => a.id !== x.id),
    { ...x, updatedAt: M.now() },
  ];
  return checked(s, n);
}
export function saveScenario(s: ScaleStore, x: M.ScaleScenario) {
  const n = clone(s);
  n.readinessData.scenarios = [
    ...n.readinessData.scenarios.filter((a) => a.id !== x.id),
    { ...x, updatedAt: M.now() },
  ];
  return checked(s, n);
}
export function saveFinancial(s: ScaleStore, x: M.FinancialCapacity) {
  const n = clone(s);
  n.readinessData.financial = [
    ...n.readinessData.financial.filter(
      (a) => !(a.candidateId === x.candidateId && a.kind === x.kind),
    ),
    { ...x, updatedAt: M.now() },
  ];
  return checked(s, n);
}
export function saveInvestment(s: ScaleStore, x: M.ScaleInvestment) {
  const n = clone(s);
  n.readinessData.investments = [
    ...n.readinessData.investments.filter((a) => a.id !== x.id),
    x,
  ];
  return checked(s, n);
}
export function savePreparation(s: ScaleStore, x: M.ScalePreparationItem) {
  const n = clone(s);
  n.readinessData.preparation = [
    ...n.readinessData.preparation.filter((a) => a.id !== x.id),
    { ...x, updatedAt: M.now() },
  ];
  return checked(s, n);
}
export function saveThresholds(
  s: ScaleStore,
  t: M.ReadinessData["thresholds"],
) {
  const n = clone(s);
  n.readinessData.thresholds = t;
  return checked(s, n);
}
export function recordAssessment(
  s: ScaleStore,
  candidateId: string,
  scenarioId: string,
  sources: ScaleSources,
  decision?: {
    decision: keyof typeof M.decisions;
    rationale: string;
    reviewedByRoleId: string;
    reviewed: boolean;
  },
) {
  const n = clone(s),
    d = n.readinessData,
    c = d.candidates.find((c) => c.id === candidateId),
    scenario =
      d.scenarios.find(
        (x) => x.id === scenarioId && x.candidateId === candidateId,
      ) ?? null;
  if (!c) throw Error("کاندید پیدا نشد.");
  if (scenarioId && !scenario) throw Error("سناریو پیدا نشد.");
  if (
    decision &&
    (!decision.reviewed ||
      !decision.rationale.trim() ||
      !sources.roles.some((r) => r.id === decision.reviewedByRoleId))
  )
    throw Error("دلیل، نقش تصمیم‌گیر و تأیید مرور شواهد لازم است.");
  if (decision?.decision === "scale" && !scenario)
    throw Error("برای مقیاس‌دهی سناریوی مشخص لازم است.");
  const at = M.now(),
    snapshot: M.ScaleReadinessSnapshot = {
      id: M.id(),
      candidateId,
      createdAt: at,
      assessment: scaleReadiness(s, c, sources, scenario),
      candidate: structuredClone(c),
      scenario: structuredClone(scenario),
      areas: structuredClone(
        d.areas.filter((x) => x.candidateId === candidateId),
      ),
      financial: structuredClone(
        d.financial.filter((x) => x.candidateId === candidateId),
      ),
      investments: structuredClone(
        d.investments.filter((x) => x.candidateId === candidateId),
      ),
      preparation: structuredClone(
        d.preparation.filter((x) => x.candidateId === candidateId),
      ),
      sourceContext: structuredClone({
        processes: sources.capacity.filter((p) => c.processIds.includes(p.id)),
        objective:
          sources.objectives.find((o) => o.id === c.objectiveId) ?? null,
        kr: sources.keyResults.find((k) => k.id === c.krId) ?? null,
        roles: sources.roles.filter(
          (r) => r.id === c.ownerRoleId || r.id === decision?.reviewedByRoleId,
        ),
      }),
      decision: decision?.decision ?? null,
    };
  d.snapshots.push(snapshot);
  if (decision) {
    d.decisions.push({
      id: M.id(),
      scaleCandidateId: candidateId,
      decision: decision.decision,
      rationale: decision.rationale,
      reviewedByRoleId: decision.reviewedByRoleId,
      scenarioId: scenario?.id ?? "",
      createdAt: at,
      snapshotId: snapshot.id,
    });
    c.status = (
      {
        scale: "scaling",
        prepare: "prepare",
        experiment: "assessing",
        hold: "hold",
        stop: "stopped",
      } as const
    )[decision.decision];
    c.updatedAt = at;
  }
  return checked(s, n);
}
