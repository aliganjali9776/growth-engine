import type { SystemData, ProcessStep } from "../types";
import type { ProcessMap, ProcessConnection } from "./model";
export function stepOwner(system: SystemData, step: ProcessStep) {
  const role = system.roles.find((r) => r.id === step.ownerRoleId);
  return { role, person: system.people.find((p) => p.id === role?.personId) };
}
export function founderStep(system: SystemData, step: ProcessStep) {
  return (
    step.founderDependency !== "none" ||
    !!stepOwner(system, step).role?.isFounderRole
  );
}
export function isHandoff(map: ProcessMap, edge: ProcessConnection) {
  const a = map.steps.find((s) => s.id === edge.sourceStepId),
    b = map.steps.find((s) => s.id === edge.targetStepId);
  return !!(
    a?.ownerRoleId &&
    b?.ownerRoleId &&
    a.ownerRoleId !== b.ownerRoleId
  );
}
export const operational = (s: ProcessStep) =>
  s.type !== "start" && s.type !== "end";
export function mapMetrics(map: ProcessMap, system: SystemData) {
  const work = map.steps.reduce((n, s) => n + (s.workTimeMinutes ?? 0), 0),
    wait = map.steps.reduce((n, s) => n + (s.waitTimeMinutes ?? 0), 0);
  const auto = map.connections.filter((e) => isHandoff(map, e));
  // Explicit handoff steps count once only when not already represented by an incoming handoff edge.
  const explicit = map.steps.filter(
    (s) =>
      (s.handoff || s.type === "handoff") &&
      !auto.some((e) => e.targetStepId === s.id),
  );
  return {
    steps: map.steps.length,
    work,
    wait,
    cycle: work + wait,
    waitingRatio: work + wait ? (100 * wait) / (work + wait) : 0,
    handoffs: auto.length + explicit.length,
    founder: map.steps.filter((s) => founderStep(system, s)).length,
    decisions: map.steps.filter((s) => s.type === "decision").length,
    highRework: map.steps.filter((s) => s.reworkProbability >= 50).length,
  };
}
export interface MapWarning {
  code: string;
  message: string;
  stepId?: string;
}
export function mapWarnings(map: ProcessMap, system: SystemData): MapWarning[] {
  const warnings: MapWarning[] = [];
  const add = (code: string, message: string, stepId?: string) =>
    warnings.push({ code, message, stepId });
  if (!map.steps.some((s) => s.type === "start"))
    add("start", "نقشه مرحله شروع ندارد.");
  if (!map.steps.some((s) => s.type === "end"))
    add("end", "نقشه مرحله پایان ندارد.");
  const visited = new Set<string>();
  let islands = 0;
  for (const s of map.steps) {
    if (visited.has(s.id)) continue;
    islands++;
    const queue = [s.id];
    while (queue.length) {
      const id = queue.pop()!;
      if (visited.has(id)) continue;
      visited.add(id);
      for (const e of map.connections) {
        if (e.sourceStepId === id) queue.push(e.targetStepId);
        if (e.targetStepId === id) queue.push(e.sourceStepId);
      }
    }
  }
  if (islands > 1)
    add(
      "islands",
      `${islands.toLocaleString("fa-IR")} بخش جدا از هم در نقشه وجود دارد.`,
    );
  for (const s of map.steps) {
    const incoming = map.connections.filter((e) => e.targetStepId === s.id),
      outgoing = map.connections.filter((e) => e.sourceStepId === s.id);
    if (!incoming.length && !outgoing.length)
      add("disconnected", `${s.title}: مرحله بدون اتصال است.`, s.id);
    if (operational(s) && !incoming.length)
      add("incoming", `${s.title}: مسیر ورودی ندارد.`, s.id);
    if (operational(s) && !outgoing.length)
      add("outgoing", `${s.title}: مسیر خروجی ندارد.`, s.id);
    if (s.type === "decision" && outgoing.length < 2)
      add(
        "decision",
        `${s.title}: تصمیم به حداقل دو شاخه خروجی نیاز دارد.`,
        s.id,
      );
    if (
      s.type === "decision" &&
      outgoing.some((e) => !e.label.trim() && !e.condition.trim())
    )
      add(
        "branch-label",
        `${s.title}: شرط یا برچسب شاخه‌ها را مشخص کنید.`,
        s.id,
      );
    if (operational(s) && !stepOwner(system, s).role)
      add("owner", `${s.title}: مالک معتبر ندارد.`, s.id);
    if (
      operational(s) &&
      (s.workTimeMinutes === null || s.waitTimeMinutes === null)
    )
      add(
        "time",
        `${s.title}: زمان کار یا انتظار ثبت نشده؛ صفر یعنی بدون زمان.`,
        s.id,
      );
    if (founderStep(system, s))
      add("founder", `${s.title}: وابستگی به بنیان‌گذار دارد.`, s.id);
  }
  return warnings;
}
function reachable(map: ProcessMap, starts: string[], reverse = false) {
  const seen = new Set<string>(),
    queue = [...starts];
  while (queue.length) {
    const id = queue.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const e of map.connections)
      if ((reverse ? e.targetStepId : e.sourceStepId) === id)
        queue.push(reverse ? e.sourceStepId : e.targetStepId);
  }
  return seen;
}
export function mapCompleteness(map: ProcessMap, system: SystemData) {
  const ops = map.steps.filter(operational),
    ratio = (n: number, d: number) => (d ? (100 * n) / d : 0);
  const owner = ratio(
      ops.filter((s) => stepOwner(system, s).role).length,
      ops.length,
    ),
    time = ratio(
      ops.filter(
        (s) => s.workTimeMinutes !== null && s.waitTimeMinutes !== null,
      ).length,
      ops.length,
    );
  const from = reachable(
      map,
      map.steps.filter((s) => s.type === "start").map((s) => s.id),
    ),
    to = reachable(
      map,
      map.steps.filter((s) => s.type === "end").map((s) => s.id),
      true,
    );
  const connection = ratio(
    map.steps.filter((s) => from.has(s.id) && to.has(s.id)).length,
    map.steps.length,
  );
  const branches = map.steps
    .filter((s) => s.type === "decision")
    .every(
      (s) => map.connections.filter((e) => e.sourceStepId === s.id).length >= 2,
    );
  return {
    owner,
    time,
    connection,
    completeness: (owner + time + connection) / 3,
    ready:
      map.steps.length >= 3 &&
      ops.length > 0 &&
      owner >= 80 &&
      connection === 100 &&
      branches,
  };
}
export function formatMinutes(n: number) {
  return n >= 60
    ? `${Math.floor(n / 60).toLocaleString("fa-IR")} ساعت${n % 60 ? ` و ${(Math.round((n % 60) * 10) / 10).toLocaleString("fa-IR")} دقیقه` : ""}`
    : `${n.toLocaleString("fa-IR")} دقیقه`;
}
