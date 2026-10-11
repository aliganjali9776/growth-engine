import type { ScaleStore } from "../model";
import { funnelData } from "../funnel/model";
import { experimentData } from "../experiments/model";
import * as N from "./model";
import { loopReadiness } from "./logic";
function ensure(
  value: unknown,
  message = "ساختار داده کانال / حلقه معتبر نیست.",
): asserts value {
  if (!value) throw Error(message);
}
const obj = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === "object" && !Array.isArray(x);
const str = (x: unknown) => typeof x === "string" && x.length <= 10000;
const num = (x: unknown) =>
  x === null || (typeof x === "number" && Number.isFinite(x) && x >= 0);
const time = (x: unknown) =>
  typeof x === "string" && Number.isFinite(Date.parse(x));
const date = (x: unknown) =>
  typeof x === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(x) &&
  time(x) &&
  new Date(x).toISOString().slice(0, 10) === x;
const member = (v: unknown, labels: object) =>
  typeof v === "string" && Object.hasOwn(labels, v);
function strings(r: Record<string, unknown>, keys: string[]) {
  keys.forEach((k) => ensure(str(r[k]), `فیلد ${k} معتبر نیست.`));
}
function rows(v: unknown): Record<string, unknown>[] {
  ensure(Array.isArray(v) && v.length <= 20000);
  const ids = new Set();
  for (const r of v) {
    ensure(obj(r) && str(r.id) && r.id && !ids.has(r.id));
    ids.add(r.id);
  }
  return v;
}
function channel(r: Record<string, unknown>) {
  strings(r, [
    "id",
    "name",
    "description",
    "ownerRoleId",
    "targetAudience",
    "linkedLeverId",
    "funnelStageId",
    "strategyObjectiveId",
    "strategyKRId",
    "systemProcessId",
  ]);
  ensure(
    (r.name as string).trim() &&
      member(r.category, N.channelCategories) &&
      member(r.status, N.channelStatuses) &&
      member(r.maturity, N.maturities) &&
      typeof r.active === "boolean" &&
      time(r.createdAt) &&
      time(r.updatedAt),
  );
  ensure(r.active === (r.status !== "retired"));
}
function loop(r: Record<string, unknown>) {
  strings(r, [
    "id",
    "name",
    "description",
    "ownerRoleId",
    "primaryOutputMetricId",
    "hypothesis",
    "input",
    "valueCreated",
    "output",
    "reentry",
    "dependency",
  ]);
  ensure(
    (r.name as string).trim() &&
      member(r.type, N.loopTypes) &&
      member(r.status, N.loopStatuses) &&
      member(r.evidenceLevel, N.evidenceLevels) &&
      num(r.loopCycleTime) &&
      time(r.createdAt) &&
      time(r.updatedAt),
  );
}
function node(r: Record<string, unknown>) {
  strings(r, [
    "id",
    "loopId",
    "name",
    "description",
    "metricId",
    "linkedFunnelStageId",
    "linkedChannelId",
    "ownerRoleId",
  ]);
  ensure(
    (r.name as string).trim() &&
      Number.isInteger(r.order) &&
      (r.order as number) >= 0 &&
      typeof r.active === "boolean",
  );
}
function period(r: Record<string, unknown>) {
  ensure(
    date(r.periodStart) &&
      date(r.periodEnd) &&
      (r.periodStart as string) <= (r.periodEnd as string) &&
      ["draft", "completed"].includes(r.status as string) &&
      time(r.createdAt),
  );
  strings(r, ["note"]);
  if (r.status === "completed")
    ensure(
      time(r.completedAt) &&
        obj(r.snapshot) &&
        (r.periodEnd as string) <= N.day(),
    );
  else ensure(!r.completedAt && !r.snapshot);
}
export function validateNetwork(s: ScaleStore) {
  if (s.networkData === undefined) return;
  const raw: unknown = s.networkData;
  ensure(obj(raw));
  const cs = rows(raw.channels),
    cp = rows(raw.channelPeriods),
    dec = rows(raw.decisions),
    ls = rows(raw.loops),
    ns = rows(raw.nodes),
    lp = rows(raw.loopPeriods),
    ev = rows(raw.evidence),
    leaks = rows(raw.leakage),
    links = rows(raw.links);
  ensure(
    Number.isInteger(raw.staleDays) &&
      (raw.staleDays as number) >= 1 &&
      (raw.staleDays as number) <= 365,
  );
  const fd = funnelData(s),
    ed = experimentData(s);
  for (const c of cs) {
    channel(c);
    ensure(!c.linkedLeverId || s.levers.some((l) => l.id === c.linkedLeverId));
    ensure(
      !c.funnelStageId || fd.stages.some((st) => st.id === c.funnelStageId),
    );
  }
  const channelKeys = new Set();
  for (const p of cp) {
    period(p);
    strings(p, ["channelId", "source", "currency"]);
    ensure(
      cs.some((c) => c.id === p.channelId) &&
        ["weekly", "monthly", "custom"].includes(p.cadence as string) &&
        ["primary", "assisted"].includes(p.attribution as string),
    );
    for (const k of Object.keys(N.metricNames)) ensure(num(p[k]));
    ensure(num(p.contributedVolume));
    ensure(Array.isArray(p.customMetrics) && p.customMetrics.length <= 100);
    for (const x of p.customMetrics) {
      ensure(
        obj(x) &&
          str(x.name) &&
          (x.name as string).trim() &&
          str(x.unit) &&
          num(x.value),
      );
    }
    ensure(
      new Set(p.customMetrics.map((x) => (x as { name: string }).name)).size ===
        p.customMetrics.length,
    );
    if (p.status === "completed") {
      channel(p.snapshot as Record<string, unknown>);
      ensure((p.snapshot as Record<string, unknown>).id === p.channelId);
      ensure((p.source as string).trim(), "منبع دوره را ثبت کنید.");
      ensure(
        Object.keys(N.metricNames).some((k) => p[k] !== null) ||
          p.contributedVolume !== null ||
          p.customMetrics.some((x) => (x as { value: unknown }).value !== null),
        "حداقل یک مشاهده برای تکمیل دوره لازم است.",
      );
      const key =
        p.channelId +
        "|" +
        p.periodStart +
        "|" +
        p.periodEnd +
        "|" +
        p.attribution;
      ensure(
        !channelKeys.has(key),
        "برای این کانال و دوره، سابقه تکمیل‌شده وجود دارد.",
      );
      channelKeys.add(key);
    }
  }
  for (const r of dec) {
    strings(r, [
      "channelId",
      "reason",
      "ownerRoleId",
      "sourceReview",
      "channelName",
    ]);
    ensure(
      cs.some((c) => c.id === r.channelId) &&
        member(r.decision, N.channelDecisions) &&
        member(r.previousStatus, N.channelStatuses) &&
        member(r.status, N.channelStatuses) &&
        member(r.previousMaturity, N.maturities) &&
        member(r.maturity, N.maturities) &&
        (r.reason as string).trim() &&
        time(r.createdAt) &&
        typeof r.capacityReviewed === "boolean" &&
        typeof r.economicsReviewed === "boolean",
    );
    if (r.status === "scaling" || r.maturity === "scalable")
      ensure(
        r.capacityReviewed &&
          r.economicsReviewed &&
          (r.sourceReview as string).trim(),
        "برای توسعه، مرور ظرفیت و اقتصاد و توضیح شواهد لازم است.",
      );
  }
  for (const l of ls) {
    loop(l);
    ensure(
      !l.primaryOutputMetricId ||
        ed.metrics.some((m) => m.id === l.primaryOutputMetricId),
    );
  }
  for (const n of ns) {
    node(n);
    ensure(
      ls.some((l) => l.id === n.loopId) &&
        (!n.metricId || ed.metrics.some((m) => m.id === n.metricId)) &&
        (!n.linkedChannelId || cs.some((c) => c.id === n.linkedChannelId)) &&
        (!n.linkedFunnelStageId ||
          fd.stages.some((st) => st.id === n.linkedFunnelStageId)),
    );
  }
  for (const l of ls) {
    const active = ns.filter((n) => n.loopId === l.id && n.active);
    ensure(new Set(active.map((n) => n.order)).size === active.length);
  }
  for (const e of ev) {
    strings(e, ["loopId", "sourceId", "text"]);
    ensure(
      ls.some((l) => l.id === e.loopId) &&
        member(e.type, N.evidenceSources) &&
        (e.text as string).trim() &&
        time(e.createdAt),
    );
    if (e.type === "channel")
      ensure(cp.some((p) => p.id === e.sourceId && p.status === "completed"));
    if (e.type === "funnel")
      ensure(
        fd.periods.some((p) => p.id === e.sourceId && p.status === "completed"),
      );
    if (e.type === "experiment")
      ensure(
        ed.experiments.some(
          (x) => x.id === e.sourceId && x.status === "completed",
        ),
      );
  }
  const loopKeys = new Set();
  for (const p of lp) {
    period(p);
    strings(p, ["loopId"]);
    ensure(
      ls.some((l) => l.id === p.loopId) &&
        num(p.outputMetric) &&
        num(p.inputVolume) &&
        num(p.cycleTime) &&
        Array.isArray(p.nodeMeasurements),
    );
    let defs = ns.filter((n) => n.loopId === p.loopId);
    if (p.status === "completed") {
      const snap = p.snapshot as Record<string, unknown>;
      ensure(obj(snap.loop));
      loop(snap.loop);
      ensure(snap.loop.id === p.loopId);
      defs = rows(snap.nodes);
      defs.forEach(node);
      ensure(defs.every((n) => n.loopId === p.loopId) && defs.length >= 2);
      strings(snap, ["metricName", "metricUnit"]);
      ensure(
        p.outputMetric !== null,
        "برای تکمیل دوره حلقه، خروجی اصلی را وارد کنید.",
      );
      const key = p.loopId + "|" + p.periodStart + "|" + p.periodEnd;
      ensure(!loopKeys.has(key));
      loopKeys.add(key);
    }
    const seen = new Set();
    for (const m of p.nodeMeasurements) {
      ensure(
        obj(m) &&
          str(m.nodeId) &&
          defs.some((n) => n.id === m.nodeId) &&
          num(m.value) &&
          !seen.has(m.nodeId),
      );
      seen.add(m.nodeId);
    }
  }
  for (const l of leaks) {
    strings(l, ["loopId", "nodeId", "description"]);
    ensure(
      ls.some((x) => x.id === l.loopId) &&
        ns.some((n) => n.id === l.nodeId && n.loopId === l.loopId) &&
        (l.description as string).trim() &&
        ["low", "medium", "high", "critical"].includes(l.severity as string) &&
        typeof l.resolved === "boolean" &&
        time(l.createdAt),
    );
  }
  const linkKeys = new Set();
  for (const l of links) {
    strings(l, [
      "kind",
      "entityId",
      "channelId",
      "loopId",
      "nodeId",
      "leakageId",
    ]);
    const entities =
      l.kind === "idea"
        ? s.ideas
        : l.kind === "constraint"
          ? s.constraints
          : l.kind === "experiment"
            ? ed.experiments
            : l.kind === "learning"
              ? ed.learnings
              : undefined;
    ensure(
      entities?.some((e) => e.id === l.entityId) &&
        time(l.createdAt) &&
        (l.channelId || l.loopId),
    );
    ensure(!l.channelId || cs.some((c) => c.id === l.channelId));
    ensure(!l.loopId || ls.some((x) => x.id === l.loopId));
    ensure(
      !l.nodeId || ns.some((n) => n.id === l.nodeId && n.loopId === l.loopId),
    );
    ensure(
      !l.leakageId ||
        leaks.some(
          (x) =>
            x.id === l.leakageId &&
            x.loopId === l.loopId &&
            x.nodeId === l.nodeId,
        ),
    );
    const key = l.kind + "|" + l.entityId + "|" + l.channelId + "|" + l.loopId;
    ensure(!linkKeys.has(key));
    linkKeys.add(key);
  }
}
const equal = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
export function assertNetworkTransition(before: ScaleStore, after: ScaleStore) {
  const a = N.networkData(before),
    b = N.networkData(after);
  for (const c of b.channels.filter(
    (c) => !a.channels.some((old) => old.id === c.id),
  ))
    ensure(
      c.status === "exploring" && c.maturity === "unproven",
      "کانال جدید باید در حال بررسی و اثبات‌نشده باشد.",
    );
  for (const key of ["decisions", "evidence"] as const)
    for (const old of a[key])
      ensure(
        b[key].some((n) => n.id === old.id && equal(n, old)),
        "شواهد و تصمیم‌های ثبت‌شده ثابت هستند.",
      );
  for (const old of a.leakage) {
    const n = b.leakage.find((l) => l.id === old.id);
    ensure(
      n && equal({ ...old, resolved: n.resolved }, n),
      "نشتی ثبت‌شده فقط قابل حل‌کردن است.",
    );
  }
  for (const key of ["channelPeriods", "loopPeriods"] as const) {
    for (const old of a[key]) {
      const n = b[key].find((p) => p.id === old.id);
      ensure(n, "دوره قابل حذف نیست.");
      if (old.status === "completed")
        ensure(equal(old, n), "دوره تکمیل‌شده ثابت است.");
    }
    for (const p of b[key].filter((n) => !a[key].some((p) => p.id === n.id)))
      ensure(p.status === "draft", "دوره جدید باید پیش‌نویس باشد.");
  }
  for (const old of a.channels) {
    const n = b.channels.find((c) => c.id === old.id);
    ensure(n, "کانال حذف نمی‌شود؛ از کنارگذاری استفاده کنید.");
    if (n.status !== old.status || n.maturity !== old.maturity)
      ensure(
        b.decisions.some(
          (d) =>
            !a.decisions.some((x) => x.id === d.id) &&
            d.channelId === old.id &&
            d.previousStatus === old.status &&
            d.previousMaturity === old.maturity &&
            d.status === n.status &&
            d.maturity === n.maturity,
        ),
        "وضعیت و بلوغ فقط با تصمیم مستند تغییر می‌کند.",
      );
  }
  for (const old of a.loops)
    ensure(
      b.loops.some((l) => l.id === old.id),
      "حلقه حذف نمی‌شود؛ از آرشیو استفاده کنید.",
    );
  for (const old of a.nodes)
    ensure(
      b.nodes.some((n) => n.id === old.id && n.loopId === old.loopId),
      "مرحله حذف نمی‌شود؛ غیرفعال کنید.",
    );
  for (const e of experimentData(before).experiments)
    if (e.startedAt || e.status === "cancelled")
      ensure(
        equal(
          a.links.filter((l) => l.kind === "experiment" && l.entityId === e.id),
          b.links.filter((l) => l.kind === "experiment" && l.entityId === e.id),
        ),
        "پیوند آزمایش شروع‌شده ثابت است.",
      );
  for (const l of b.loops.filter((l) =>
    ["active", "strengthening"].includes(l.status),
  )) {
    const old = a.loops.find((x) => x.id === l.id);
    if (
      !old ||
      !equal(l, old) ||
      !equal(
        a.nodes.filter((n) => n.loopId === l.id),
        b.nodes.filter((n) => n.loopId === l.id),
      )
    )
      ensure(
        loopReadiness(after, l).ready,
        "حلقه فعال به ساختار، مالک، شاخص، شواهد و بازگشت خروجی نیاز دارد.",
      );
  }
}
