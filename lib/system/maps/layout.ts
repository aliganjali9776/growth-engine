import type { ProcessMap } from "./model";
// Layered layout with strongly connected components: rework loops never cause an infinite traversal.
export function autoLayout(
  map: ProcessMap,
  direction: ProcessMap["direction"] = map.direction,
): ProcessMap {
  const ids = map.steps.map((s) => s.id),
    adjacency = new Map(
      ids.map((id) => [
        id,
        map.connections
          .filter((e) => e.sourceStepId === id)
          .map((e) => e.targetStepId),
      ]),
    );
  let index = 0;
  const indices = new Map<string, number>(),
    low = new Map<string, number>(),
    stack: string[] = [],
    onStack = new Set<string>(),
    groups: string[][] = [];
  function visit(id: string) {
    indices.set(id, index);
    low.set(id, index++);
    stack.push(id);
    onStack.add(id);
    for (const child of adjacency.get(id) ?? []) {
      if (!indices.has(child)) {
        visit(child);
        low.set(id, Math.min(low.get(id)!, low.get(child)!));
      } else if (onStack.has(child))
        low.set(id, Math.min(low.get(id)!, indices.get(child)!));
    }
    if (low.get(id) === indices.get(id)) {
      const group: string[] = [];
      let v: string;
      do {
        v = stack.pop()!;
        onStack.delete(v);
        group.push(v);
      } while (v !== id);
      groups.push(group.reverse());
    }
  }
  ids.forEach((id) => {
    if (!indices.has(id)) visit(id);
  });
  const groupOf = new Map(
      groups.flatMap((g, i) => g.map((id) => [id, i] as const)),
    ),
    ranks = new Map<number, number>();
  function rank(i: number): number {
    if (ranks.has(i)) return ranks.get(i)!;
    const parents = map.connections
      .filter(
        (e) =>
          groupOf.get(e.targetStepId) === i &&
          groupOf.get(e.sourceStepId) !== i,
      )
      .map((e) => groupOf.get(e.sourceStepId)!);
    const r = parents.length ? Math.max(...parents.map(rank)) + 1 : 0;
    ranks.set(i, r);
    return r;
  }
  groups.forEach((_, i) => rank(i));
  const max = Math.max(0, ...ranks.values()),
    lanes = new Map<number, number>();
  const positions = new Map<string, { positionX: number; positionY: number }>();
  groups.forEach((g, i) => {
    const r = ranks.get(i)!;
    for (const id of g) {
      const lane = lanes.get(r) ?? 0;
      lanes.set(r, lane + 1);
      positions.set(
        id,
        direction === "RL"
          ? { positionX: (max - r) * 360, positionY: lane * 250 }
          : { positionX: lane * 320, positionY: r * 280 },
      );
    }
  });
  return {
    ...map,
    direction,
    steps: map.steps.map((s) => ({ ...s, ...positions.get(s.id)! })),
  };
}
