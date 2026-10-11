import type { ScaleStore } from "../model";
import { businessModels } from "../model";
import { funnelData, stageTypes, periodStages } from "./model";
import { stageRows } from "./logic";
const ok = (v: unknown, message = "داده قیف معتبر نیست."): asserts v => {
  if (!v) throw Error(message);
};
// Explicit function declarations keep runtime validation usable before a typed cast.
function ensure(v: unknown, message = "داده قیف معتبر نیست."): asserts v {
  if (!v) throw Error(message);
}
const obj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown) => typeof v === "string" && v.length <= 10000;
const numeric = (v: unknown) =>
  v === null || (typeof v === "number" && Number.isFinite(v) && v >= 0);
const date = (v: unknown) =>
  typeof v === "string" && Number.isFinite(Date.parse(v));
const day = (v: unknown) =>
  typeof v === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  date(v) &&
  new Date(v).toISOString().slice(0, 10) === v;
function rows(v: unknown): Record<string, unknown>[] {
  ensure(Array.isArray(v) && v.length <= 20000);
  const ids = new Set();
  for (const r of v) {
    ensure(obj(r) && text(r.id) && r.id && !ids.has(r.id));
    ids.add(r.id);
  }
  return v;
}
function strings(r: Record<string, unknown>, keys: string[]) {
  for (const k of keys) ensure(text(r[k]));
}
function stage(r: Record<string, unknown>) {
  strings(r, [
    "id",
    "funnelId",
    "name",
    "description",
    "ownerRoleId",
    "metricUnit",
  ]);
  ensure(
    (r.name as string).trim() &&
      (r.metricUnit as string).trim() &&
      typeof r.active === "boolean" &&
      Number.isInteger(r.order) &&
      (r.order as number) >= 0 &&
      typeof r.type === "string" &&
      Object.hasOwn(stageTypes, r.type),
  );
  ensure(
    numeric(r.targetVolume) &&
      numeric(r.targetConversion) &&
      (r.targetConversion === null || (r.targetConversion as number) <= 100),
  );
  ensure(date(r.createdAt) && date(r.updatedAt));
}
function revenue(r: Record<string, unknown>) {
  strings(r, ["funnelId", "revenueStageId", "currency", "strategyKRId"]);
  for (const k of [
    "averageDealValue",
    "targetRevenue",
    "currentRevenue",
    "repeatRate",
    "expansionRevenue",
  ])
    ensure(numeric(r[k]));
  ensure(r.repeatRate === null || (r.repeatRate as number) <= 100);
  ensure(date(r.updatedAt));
}
function funnel(r: Record<string, unknown>) {
  strings(r, ["id", "name", "description", "currency"]);
  ensure(
    (r.name as string).trim() &&
      typeof r.active === "boolean" &&
      typeof r.businessModel === "string" &&
      Object.hasOwn(businessModels, r.businessModel) &&
      date(r.createdAt) &&
      date(r.updatedAt),
  );
}
export function validateFunnel(s: ScaleStore) {
  if (s.funnelData === undefined) return;
  const raw: unknown = s.funnelData;
  ensure(obj(raw));
  const funnels = rows(raw.funnels),
    stages = rows(raw.stages),
    periods = rows(raw.periods),
    measurements = rows(raw.measurements),
    links = rows(raw.links),
    evidence = rows(raw.evidence);
  ensure(
    Number.isInteger(raw.staleDays) &&
      (raw.staleDays as number) >= 1 &&
      (raw.staleDays as number) <= 365,
  );
  for (const f of funnels) funnel(f);
  ensure(funnels.filter((f) => f.active).length <= 1);
  for (const st of stages) {
    stage(st);
    ensure(funnels.some((f) => f.id === st.funnelId));
  }
  for (const f of funnels) {
    const active = stages.filter((st) => st.funnelId === f.id && st.active);
    ensure(new Set(active.map((st) => st.order)).size === active.length);
  }
  ensure(Array.isArray(raw.revenueModels));
  const revenueIds = new Set();
  for (const r of raw.revenueModels) {
    ensure(obj(r));
    revenue(r);
    ensure(
      !revenueIds.has(r.funnelId) && funnels.some((f) => f.id === r.funnelId),
    );
    revenueIds.add(r.funnelId);
    ensure(
      !r.revenueStageId ||
        stages.some(
          (st) =>
            st.id === r.revenueStageId &&
            st.funnelId === r.funnelId &&
            st.active,
        ),
      "مرحله درآمد باید فعال باشد.",
    );
  }
  for (const p of periods) {
    strings(p, ["funnelId", "label"]);
    ensure(
      funnels.some((f) => f.id === p.funnelId) &&
        day(p.periodStart) &&
        day(p.periodEnd) &&
        (p.periodStart as string) <= (p.periodEnd as string) &&
        date(p.createdAt) &&
        date(p.updatedAt),
    );
    ensure(
      ["draft", "completed"].includes(p.status as string) &&
        ["weekly", "monthly", "custom"].includes(p.cadence as string),
    );
    if (p.status === "completed") {
      ensure(date(p.completedAt) && obj(p.snapshot));
      ensure(obj(p.snapshot.funnel));
      funnel(p.snapshot.funnel);
      ensure(p.snapshot.funnel.id === p.funnelId);
      const ss = rows(p.snapshot.stages);
      ensure(ss.length >= 2);
      for (const st of ss) {
        stage(st);
        ensure(st.funnelId === p.funnelId);
      }
      ensure(new Set(ss.map((st) => st.order)).size === ss.length);
      if (p.snapshot.revenue !== null) {
        ensure(obj(p.snapshot.revenue));
        revenue(p.snapshot.revenue);
        ensure(
          p.snapshot.revenue.funnelId === p.funnelId &&
            (!p.snapshot.revenue.revenueStageId ||
              ss.some(
                (st) =>
                  st.id ===
                  (p.snapshot as { revenue: { revenueStageId: string } })
                    .revenue.revenueStageId,
              )),
        );
      }
    } else ensure(!p.snapshot && !p.completedAt);
  }
  const pairs = new Set();
  for (const m of measurements) {
    strings(m, ["periodId", "funnelId", "stageId", "note", "source"]);
    const p = periods.find((p) => p.id === m.periodId);
    ensure(p && p.funnelId === m.funnelId);
    ensure(
      numeric(m.volume) &&
        numeric(m.revenueValue) &&
        date(m.createdAt) &&
        date(m.updatedAt),
    );
    ensure(!pairs.has(m.periodId + "|" + m.stageId));
    pairs.add(m.periodId + "|" + m.stageId);
    const defs =
      p.status === "completed"
        ? (p.snapshot as { stages: { id: string }[] }).stages
        : stages.filter((st) => st.funnelId === p.funnelId);
    ensure(defs.some((st) => st.id === m.stageId));
  }
  for (const p of s.funnelData.periods.filter((p) => p.status === "completed"))
    ensure(
      periodStages(s.funnelData, p).every((st) =>
        s.funnelData!.measurements.some(
          (m) =>
            m.periodId === p.id && m.stageId === st.id && m.volume !== null,
        ),
      ),
      "برای تکمیل دوره، حجم همه مراحل لازم است.",
    );
  for (const l of links) {
    strings(l, ["kind", "entityId", "funnelId", "stageId"]);
    ensure(
      date(l.createdAt) &&
        stages.some((st) => st.id === l.stageId && st.funnelId === l.funnelId),
    );
    const entities =
      l.kind === "constraint"
        ? s.constraints
        : l.kind === "idea"
          ? s.ideas
          : l.kind === "experiment"
            ? s.experimentData?.experiments
            : undefined;
    ensure(entities?.some((e) => e.id === l.entityId));
  }
  ensure(
    new Set(links.map((l) => l.kind + "|" + l.entityId)).size === links.length,
  );
  for (const e of evidence) {
    strings(e, [
      "constraintId",
      "periodId",
      "stageId",
      "stageName",
      "previousStageName",
    ]);
    ensure(
      s.constraints.some((c) => c.id === e.constraintId) &&
        periods.some((p) => p.id === e.periodId && p.status === "completed") &&
        date(e.createdAt),
    );
    ensure(
      numeric(e.actual) &&
        numeric(e.target) &&
        (e.gap === null ||
          (typeof e.gap === "number" && Number.isFinite(e.gap))),
    );
    const p = s.funnelData.periods.find((p) => p.id === e.periodId)!;
    const rs = stageRows(s.funnelData, p),
      index = rs.findIndex((r) => r.stage.id === e.stageId),
      r = rs[index];
    ensure(
      index > 0 &&
        r.conversion === e.actual &&
        r.stage.targetConversion === e.target &&
        r.gap === e.gap &&
        r.stage.name === e.stageName &&
        rs[index - 1].stage.name === e.previousStageName,
      "شواهد باید با دوره تاریخی مطابقت داشته باشد.",
    );
  }
}
export function assertFunnelTransition(before: ScaleStore, after: ScaleStore) {
  const a = funnelData(before),
    b = funnelData(after),
    equal = (x: unknown, y: unknown) => JSON.stringify(x) === JSON.stringify(y);
  for (const e of before.experimentData?.experiments ?? []) {
    if (e.startedAt || e.status === "cancelled")
      ensure(
        equal(
          a.links.find((l) => l.kind === "experiment" && l.entityId === e.id),
          b.links.find((l) => l.kind === "experiment" && l.entityId === e.id),
        ),
        "پیوند قیف آزمایش شروع‌شده ثابت است.",
      );
  }
  for (const f of a.funnels)
    ensure(
      b.funnels.some((n) => n.id === f.id),
      "قیف حذف نمی‌شود؛ آن را غیرفعال کنید.",
    );
  for (const st of a.stages)
    ensure(
      b.stages.some((n) => n.id === st.id && n.funnelId === st.funnelId),
      "مرحله حذف نمی‌شود؛ آن را غیرفعال کنید.",
    );
  for (const p of a.periods) {
    const next = b.periods.find((n) => n.id === p.id);
    ensure(next, "دوره حذف نمی‌شود.");
    if (p.status === "completed") {
      ensure(equal(p, next), "دوره تکمیل‌شده ثابت است.");
      ensure(
        equal(
          a.measurements.filter((m) => m.periodId === p.id),
          b.measurements.filter((m) => m.periodId === p.id),
        ),
        "اندازه‌گیری تاریخی ثابت است.",
      );
    } else if (next.status === "completed") {
      ensure(next.snapshot);
      const expected = a.stages
        .filter((st) => st.funnelId === p.funnelId && st.active)
        .sort((x, y) => x.order - y.order);
      ensure(
        equal(expected, next.snapshot.stages),
        "ساختار ثبت‌شده باید با قیف فعلی یکسان باشد.",
      );
    }
  }
  for (const p of b.periods.filter(
    (p) => !a.periods.some((old) => old.id === p.id),
  ))
    ensure(p.status === "draft", "دوره جدید باید پیش‌نویس باشد.");
  for (const e of a.evidence)
    ensure(
      b.evidence.some((n) => n.id === e.id && equal(e, n)),
      "شواهد تاریخی حذف یا بازنویسی نمی‌شوند.",
    );
}
