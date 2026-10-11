import type { ScaleStore } from "../model";
import { experimentData } from "../experiments/model";
import { networkData } from "../network/model";
import { funnelData } from "../funnel/model";
import * as M from "./model";
const obj = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === "object" && !Array.isArray(x);
function check(
  v: unknown,
  msg = "داده آمادگی مقیاس‌دهی معتبر نیست.",
): asserts v {
  if (!v) throw Error(msg);
}
const str = (x: unknown) => typeof x === "string" && x.length <= 10000;
const num = (x: unknown) =>
  x === null || (typeof x === "number" && Number.isFinite(x) && x >= 0);
const time = (x: unknown) => str(x) && Number.isFinite(Date.parse(x as string));
function fields(x: Record<string, unknown>, names: string[]) {
  for (const k of names) check(str(x[k]));
}
function enumeration(x: unknown, labels: object) {
  check(typeof x === "string" && Object.hasOwn(labels, x));
}
function rows(x: unknown): Record<string, unknown>[] {
  check(Array.isArray(x) && x.length <= 20000);
  const ids = new Set();
  for (const r of x) {
    check(obj(r) && str(r.id) && r.id && !ids.has(r.id));
    ids.add(r.id);
  }
  return x;
}
export function validateReadiness(s: ScaleStore) {
  if (s.readinessData === undefined) return;
  check(obj(s.readinessData));
  const d = s.readinessData;
  check(
    obj(d.thresholds) &&
      typeof d.thresholds.tight === "number" &&
      typeof d.thresholds.overloaded === "number" &&
      d.thresholds.tight > 0 &&
      d.thresholds.tight < d.thresholds.overloaded &&
      d.thresholds.overloaded <= 100,
  );
  const cs = rows(d.candidates),
    areas = rows(d.areas),
    scenarios = rows(d.scenarios),
    fin = rows(d.financial),
    inv = rows(d.investments),
    prep = rows(d.preparation),
    snaps = rows(d.snapshots),
    decs = rows(d.decisions);
  for (const c of cs) {
    fields(c, [
      "name",
      "sourceId",
      "description",
      "ownerRoleId",
      "objectiveId",
      "krId",
      "manualEvidence",
    ]);
    check((c.name as string).trim());
    enumeration(c.sourceType, M.sourceTypes);
    enumeration(c.status, M.candidateStatuses);
    check(
      Array.isArray(c.processIds) &&
        c.processIds.every(str) &&
        new Set(c.processIds).size === c.processIds.length,
    );
    check(
      num(c.manualPositivePeriods) &&
        (c.manualPositivePeriods === null ||
          Number.isInteger(c.manualPositivePeriods)),
    );
    check(time(c.createdAt) && time(c.updatedAt));
    const id = c.sourceId;
    check(
      c.sourceType === "management"
        ? id === ""
        : c.sourceType === "channel"
          ? networkData(s).channels.some((x) => x.id === id)
          : c.sourceType === "loop"
            ? networkData(s).loops.some((x) => x.id === id)
            : c.sourceType === "funnel"
              ? funnelData(s).funnels.some((x) => x.id === id)
              : c.sourceType === "idea"
                ? s.ideas.some((x) => x.id === id)
                : experimentData(s).experiments.some((x) => x.id === id),
      "منبع کاندید پیدا نشد.",
    );
  }
  for (const collection of [areas, scenarios, fin, inv, prep, snaps])
    for (const x of collection)
      check(
        cs.some((c) => c.id === x.candidateId),
        "کاندید مرتبط پیدا نشد.",
      );
  for (const a of areas) {
    fields(a, [
      "name",
      "unit",
      "period",
      "ownerRoleId",
      "processId",
      "funnelStageId",
      "source",
      "notes",
      "action",
    ]);
    enumeration(a.area, M.areaTypes);
    check(
      (a.name as string).trim() &&
        (a.unit as string).trim() &&
        (a.period as string).trim(),
    );
    check(
      num(a.currentCapacity) &&
        num(a.currentLoad) &&
        num(a.targetLoad) &&
        typeof a.criticalRoleGap === "boolean" &&
        time(a.createdAt) &&
        time(a.updatedAt),
    );
    if (
      [a.currentCapacity, a.currentLoad, a.targetLoad].some((n) => n !== null)
    )
      check((a.source as string).trim(), "منبع ظرفیت را ثبت کنید.");
    check(
      !a.funnelStageId ||
        funnelData(s).stages.some((x) => x.id === a.funnelStageId),
    );
  }
  for (const x of scenarios) {
    fields(x, ["name", "funnelId", "funnelPeriodId", "outputStageId", "notes"]);
    check(
      (x.name as string).trim() &&
        typeof x.factor === "number" &&
        Number.isFinite(x.factor) &&
        x.factor > 0 &&
        x.factor <= 100 &&
        typeof x.useTargetRates === "boolean" &&
        typeof x.periodConfirmed === "boolean" &&
        time(x.createdAt) &&
        time(x.updatedAt),
    );
    if (x.funnelId) {
      const p = funnelData(s).periods.find(
        (p) =>
          p.id === x.funnelPeriodId &&
          p.funnelId === x.funnelId &&
          p.status === "completed",
      );
      check(
        p && p.snapshot?.stages.some((st) => st.id === x.outputStageId),
        "دوره تکمیل‌شده و مرحله خروجی قیف را انتخاب کنید.",
      );
    } else check(!x.funnelPeriodId && !x.outputStageId);
  }
  for (const f of fin) {
    enumeration(f.kind, M.financeTypes);
    enumeration(f.state, M.financialStates);
    fields(f, ["evidence"]);
    check(time(f.updatedAt));
    check(
      f.state === "unknown" || (f.evidence as string).trim(),
      "ارزیابی مالی به دلیل و منبع نیاز دارد.",
    );
  }
  check(
    new Set(fin.map((f) => f.candidateId + "|" + f.kind)).size === fin.length,
  );
  for (const i of inv) {
    enumeration(i.kind, M.investmentTypes);
    fields(i, ["unit", "description"]);
    check(num(i.amount) && (i.description as string).trim());
    check(i.amount === null || (i.unit as string).trim());
  }
  for (const p of prep) {
    fields(p, [
      "title",
      "ownerRoleId",
      "dueDate",
      "relatedSystemProcessId",
      "notes",
    ]);
    check((p.title as string).trim());
    enumeration(p.category, M.preparationCategories);
    enumeration(p.status, M.preparationStatuses);
    check(time(p.createdAt) && time(p.updatedAt));
    check(
      !p.dueDate ||
        (typeof p.dueDate === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(p.dueDate) &&
          new Date(p.dueDate + "T12:00:00Z").toISOString().slice(0, 10) ===
            p.dueDate),
    );
  }
  for (const p of snaps) {
    check(
      time(p.createdAt) &&
        obj(p.candidate) &&
        p.candidate.id === p.candidateId &&
        obj(p.assessment),
    );
    const a = p.assessment;
    check(
      num(a.score) &&
        (a.score === null || (a.score as number) <= 100) &&
        typeof a.coverage === "number" &&
        a.coverage >= 0 &&
        a.coverage <= 100 &&
        typeof a.completeness === "number" &&
        a.completeness >= 0 &&
        a.completeness <= 100,
    );
    check(
      ["ready", "prepare", "hold", "insufficient"].includes(a.gate as string) &&
        ["low", "medium", "high"].includes(a.confidence as string),
    );
    check(
      Array.isArray(a.components) &&
        a.components.length === 10 &&
        a.components.every(
          (x) =>
            obj(x) &&
            str(x.key) &&
            str(x.evidence) &&
            str(x.label) &&
            num(x.value) &&
            (x.value === null || (x.value as number) <= 100) &&
            typeof x.weight === "number" &&
            Number.isFinite(x.weight) &&
            x.weight > 0,
        ),
    );
    check(
      Array.isArray(a.risks) &&
        Array.isArray(a.plan) &&
        obj(a.evidence) &&
        obj(a.preparation),
    );
    for (const risk of a.risks)
      check(obj(risk) && str(risk.area) && str(risk.evidence));
    for (const plan of a.plan)
      check(
        obj(plan) &&
          str(plan.id) &&
          str(plan.name) &&
          str(plan.unit) &&
          str(plan.period) &&
          num(plan.currentCapacity) &&
          num(plan.required) &&
          (plan.gap === null ||
            (typeof plan.gap === "number" && Number.isFinite(plan.gap))),
      );
    check(num(a.preparation.completed) && num(a.preparation.total));
    check(str(p.candidate.name));
    check(
      Array.isArray(p.areas) &&
        Array.isArray(p.financial) &&
        Array.isArray(p.investments) &&
        Array.isArray(p.preparation),
    );
    check(
      p.decision === null || Object.hasOwn(M.decisions, p.decision as string),
    );
    check(
      p.scenario === null ||
        (obj(p.scenario) && p.scenario.candidateId === p.candidateId),
    );
    check(
      obj(p.sourceContext) &&
        Array.isArray(p.sourceContext.roles) &&
        p.sourceContext.roles.every((r) => obj(r) && str(r.id) && str(r.title)),
      "بافت تاریخی نقش‌های ارزیابی معتبر نیست.",
    );
  }
  for (const d of decs) {
    fields(d, [
      "scaleCandidateId",
      "rationale",
      "reviewedByRoleId",
      "scenarioId",
      "snapshotId",
    ]);
    enumeration(d.decision, M.decisions);
    check(
      (d.rationale as string).trim() &&
        (d.reviewedByRoleId as string).trim() &&
        time(d.createdAt),
    );
    check(
      snaps.some(
        (p) =>
          p.id === d.snapshotId &&
          p.candidateId === d.scaleCandidateId &&
          p.decision === d.decision &&
          p.createdAt === d.createdAt,
      ),
      "تصمیم به تصویر همان ارزیابی نیاز دارد.",
    );
    check(
      !d.scenarioId ||
        scenarios.some(
          (x) => x.id === d.scenarioId && x.candidateId === d.scaleCandidateId,
        ),
    );
  }
}
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
export function assertReadinessTransition(
  before: ScaleStore,
  after: ScaleStore,
) {
  const a = M.readinessData(before),
    b = M.readinessData(after);
  for (const key of ["snapshots", "decisions"] as const)
    for (const x of a[key])
      check(
        b[key].some((y) => y.id === x.id && eq(y, x)),
        "تصویر ارزیابی و تصمیم تاریخی قابل تغییر نیست.",
      );
  for (const key of [
    "candidates",
    "scenarios",
    "areas",
    "preparation",
  ] as const)
    for (const x of a[key])
      check(
        b[key].some((y) => y.id === x.id),
        "سابقه آمادگی حذف نمی‌شود.",
      );
  for (const c of b.candidates) {
    const old = a.candidates.find((x) => x.id === c.id);
    if (old)
      check(
        old.sourceId === c.sourceId && old.sourceType === c.sourceType,
        "منبع کاندید تاریخی قابل جابه‌جایی نیست.",
      );
    if (old?.status === "archived")
      check(
        c.status === "archived",
        "کاندید آرشیوشده دوباره فعال نمی‌شود؛ کاندید جدید بسازید.",
      );
    if (old && c.status !== old.status && c.status === "ready") {
      const latest = b.snapshots.filter((x) => x.candidateId === c.id).at(-1);
      check(
        latest &&
          obj(latest.assessment) &&
          latest.assessment.gate === "ready" &&
          eq(latest.candidate, old) &&
          eq(
            latest.areas,
            b.areas.filter((x) => x.candidateId === c.id),
          ) &&
          eq(
            latest.financial,
            b.financial.filter((x) => x.candidateId === c.id),
          ) &&
          eq(
            latest.scenario,
            b.scenarios.find((x) => x.id === latest.scenario?.id) ?? null,
          ),
        "آمادگی به ارزیابی آماده و منطبق با کاندید فعلی نیاز دارد.",
      );
    }
    if (!old)
      check(
        c.status === "candidate",
        "کاندید جدید هنوز تصمیم مقیاس‌دهی ندارد.",
      );
    else if (
      c.status !== old.status &&
      ["scaling", "prepare", "hold", "stopped"].includes(c.status)
    )
      check(
        b.decisions.some(
          (d) =>
            !a.decisions.some((x) => x.id === d.id) &&
            d.scaleCandidateId === c.id &&
            {
              scale: "scaling",
              prepare: "prepare",
              experiment: "assessing",
              hold: "hold",
              stop: "stopped",
            }[d.decision] === c.status,
        ),
        "این وضعیت از مسیر تصمیم مدیریت ثبت می‌شود.",
      );
  }
  for (const key of [
    "scenarios",
    "areas",
    "preparation",
    "financial",
    "investments",
  ] as const)
    for (const old of a[key]) {
      const next = b[key].find((x) => x.id === old.id);
      if (next)
        check(
          next.candidateId === old.candidateId,
          "رکورد مرتبط را به کاندید دیگری منتقل نکنید.",
        );
    }
}
