import type { ProcessMap } from "../maps/model";
export function reachable(
  map: ProcessMap,
  start: string,
  blocked = new Set<string>(),
) {
  const seen = new Set<string>(),
    queue = [start];
  while (queue.length) {
    const id = queue.pop()!;
    if (seen.has(id) || blocked.has(id)) continue;
    seen.add(id);
    for (const e of map.connections)
      if (e.sourceStepId === id) queue.push(e.targetStepId);
  }
  return seen;
}
export function loopSteps(map: ProcessMap) {
  return new Set(
    map.steps
      .filter((s) =>
        map.connections.some(
          (e) =>
            e.sourceStepId === s.id && reachable(map, e.targetStepId).has(s.id),
        ),
      )
      .map((s) => s.id),
  );
}
export function completionBlockedBy(map: ProcessMap, id: string) {
  const starts = map.steps.filter((s) => s.type === "start"),
    ends = map.steps.filter((s) => s.type === "end");
  if (!starts.length || !ends.length) return false;
  const reaches = (blocked: Set<string>) =>
    starts.some((s) =>
      ends.some((e) => reachable(map, s.id, blocked).has(e.id)),
    );
  return reaches(new Set()) && !reaches(new Set([id]));
}
