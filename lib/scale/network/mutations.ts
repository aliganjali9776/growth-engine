import { ScaleStore, newIdea, newConstraint } from "../model";
import { experimentData } from "../experiments/model";
import * as N from "./model";
import { loopReadiness } from "./logic";
import { validateNetwork, assertNetworkTransition } from "./validation";
const clone = (s: ScaleStore) => ({
  ...s,
  networkData: structuredClone(N.networkData(s)),
});
function checked(s: ScaleStore, n: ScaleStore) {
  validateNetwork(n);
  assertNetworkTransition(s, n);
  return n;
}
export function saveChannel(s: ScaleStore, c: N.GrowthChannel) {
  const n = clone(s),
    old = n.networkData.channels.find((x) => x.id === c.id);
  if (!old && (c.status !== "exploring" || c.maturity !== "unproven"))
    throw Error("کانال جدید با وضعیت بررسی و بلوغ اثبات‌نشده شروع می‌شود.");
  n.networkData.channels = [
    ...n.networkData.channels.filter((x) => x.id !== c.id),
    { ...c, createdAt: old?.createdAt ?? c.createdAt, updatedAt: N.now() },
  ];
  return checked(s, n);
}
export function saveChannelPeriod(
  s: ScaleStore,
  p: N.ChannelPeriodMeasurement,
) {
  const n = clone(s);
  n.networkData.channelPeriods = [
    ...n.networkData.channelPeriods.filter((x) => x.id !== p.id),
    p,
  ];
  return checked(s, n);
}
export function completeChannelPeriod(s: ScaleStore, id: string) {
  const n = clone(s),
    p = n.networkData.channelPeriods.find((p) => p.id === id);
  if (!p || p.status !== "draft") throw Error("پیش‌نویس معتبر لازم است.");
  p.status = "completed";
  p.completedAt = N.now();
  p.snapshot = structuredClone(
    n.networkData.channels.find((c) => c.id === p.channelId)!,
  );
  return checked(s, n);
}
export function recordChannelDecision(
  s: ScaleStore,
  decision: Omit<
    N.ChannelDecision,
    "id" | "createdAt" | "previousStatus" | "previousMaturity" | "channelName"
  >,
) {
  const n = clone(s),
    c = n.networkData.channels.find((c) => c.id === decision.channelId);
  if (!c) throw Error("کانال موجود نیست.");
  n.networkData.decisions.push({
    ...decision,
    id: N.id(),
    createdAt: N.now(),
    previousStatus: c.status,
    previousMaturity: c.maturity,
    channelName: c.name,
  });
  c.status = decision.status;
  c.maturity = decision.maturity;
  c.active = c.status !== "retired";
  c.updatedAt = N.now();
  return checked(s, n);
}
export function saveLoop(
  s: ScaleStore,
  l: N.GrowthLoop,
  nodes: N.GrowthLoopNode[],
  ownerIds?: string[],
) {
  const n = clone(s),
    old = n.networkData.loops.find((x) => x.id === l.id);
  n.networkData.loops = [
    ...n.networkData.loops.filter((x) => x.id !== l.id),
    { ...l, createdAt: old?.createdAt ?? l.createdAt, updatedAt: N.now() },
  ];
  const retired = n.networkData.nodes
    .filter((x) => x.loopId === l.id && !nodes.some((n) => n.id === x.id))
    .map((x) => ({ ...x, active: false }));
  n.networkData.nodes = [
    ...n.networkData.nodes.filter((x) => x.loopId !== l.id),
    ...retired,
    ...nodes.map((x, i) => ({ ...x, loopId: l.id, order: i })),
  ];
  if (
    ["active", "strengthening"].includes(l.status) &&
    !loopReadiness(n, l, ownerIds).ready
  )
    throw Error(
      "تکمیل کنید: ساختار، مالک معتبر، شاخص اصلی، شواهد و سازوکار بازگشت.",
    );
  return checked(s, n);
}
export function addEvidence(
  s: ScaleStore,
  e: Omit<N.LoopEvidence, "id" | "createdAt">,
) {
  const n = clone(s);
  n.networkData.evidence.push({ ...e, id: N.id(), createdAt: N.now() });
  return checked(s, n);
}
export function addLeakage(
  s: ScaleStore,
  l: Omit<N.LoopLeakage, "id" | "createdAt" | "resolved">,
) {
  const n = clone(s);
  n.networkData.leakage.push({
    ...l,
    id: N.id(),
    createdAt: N.now(),
    resolved: false,
  });
  return checked(s, n);
}
export function resolveLeakage(s: ScaleStore, id: string) {
  const n = clone(s),
    l = n.networkData.leakage.find((l) => l.id === id);
  if (l) l.resolved = true;
  return checked(s, n);
}
export function saveLoopPeriod(s: ScaleStore, p: N.GrowthLoopPeriod) {
  const n = clone(s);
  n.networkData.loopPeriods = [
    ...n.networkData.loopPeriods.filter((x) => x.id !== p.id),
    p,
  ];
  return checked(s, n);
}
export function completeLoopPeriod(s: ScaleStore, id: string) {
  const n = clone(s),
    p = n.networkData.loopPeriods.find((p) => p.id === id);
  if (!p || p.status !== "draft") throw Error("پیش‌نویس معتبر لازم است.");
  const l = n.networkData.loops.find((l) => l.id === p.loopId)!,
    m = experimentData(s).metrics.find((m) => m.id === l.primaryOutputMetricId);
  if (!m) throw Error("شاخص اصلی را تعریف کنید.");
  p.snapshot = {
    loop: structuredClone(l),
    nodes: structuredClone(
      n.networkData.nodes
        .filter((n) => n.loopId === l.id && n.active)
        .sort((a, b) => a.order - b.order),
    ),
    metricName: m.name,
    metricUnit: m.unit,
  };
  p.status = "completed";
  p.completedAt = N.now();
  return checked(s, n);
}
export function saveNetworkLink(
  s: ScaleStore,
  l: Omit<N.NetworkLink, "id" | "createdAt">,
) {
  const n = clone(s);
  n.networkData.links = n.networkData.links.filter(
    (x) =>
      !(
        x.kind === l.kind &&
        x.entityId === l.entityId &&
        x.channelId === l.channelId &&
        x.loopId === l.loopId
      ),
  );
  n.networkData.links.push({ ...l, id: N.id(), createdAt: N.now() });
  return checked(s, n);
}
export function createFromLeakage(
  s: ScaleStore,
  leakageId: string,
  kind: "idea" | "constraint",
) {
  let n = clone(s);
  const leak = n.networkData.leakage.find((l) => l.id === leakageId);
  if (!leak) throw Error("نشتی موجود نیست.");
  let entityId = "";
  if (kind === "idea") {
    const idea = newIdea();
    idea.title = `بهبود: ${leak.description}`;
    idea.source = "data";
    idea.evidence = leak.description;
    n.ideas = [...n.ideas, idea];
    entityId = idea.id;
  } else {
    const c = newConstraint();
    c.title = `نشتی حلقه: ${leak.description}`;
    c.description = leak.description;
    c.dimension = "retention";
    n.constraints = [...n.constraints, c];
    entityId = c.id;
  }
  return saveNetworkLink(n, {
    kind,
    entityId,
    channelId: "",
    loopId: leak.loopId,
    nodeId: leak.nodeId,
    leakageId,
  });
}
