import type { MapStore, ProcessMap } from "./model";
import { stepTypes } from "./model";
import { founderLevels } from "../config";
export const MAP_STORAGE_KEY = "growth-engine.process-maps.v1";
const object = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === "object" && !Array.isArray(x);
const text = (x: unknown) => typeof x === "string";
const date = (x: unknown) =>
  text(x) && Number.isFinite(Date.parse(x as string));
const number = (x: unknown) => typeof x === "number" && Number.isFinite(x);
export function parseMaps(raw: string): MapStore {
  return validateMaps(JSON.parse(raw));
}
export function validateMaps(
  value: unknown,
  variant: "as-is" | "to-be" = "as-is",
): MapStore {
  const fail = () => {
    throw new Error(
      "ساختار داده نقشه معتبر نیست. داده قبلی بازنویسی نشده است.",
    );
  };
  if (!object(value) || value.version !== 1 || !Array.isArray(value.maps))
    return fail();
  const processes = new Set<string>();
  for (const m of value.maps) {
    if(object(m)&&m.version!==undefined&&(!Number.isInteger(m.version)||(m.version as number)<1))return fail();
    if (
      !object(m) ||
      !text(m.processId) ||
      !m.processId ||
      processes.has(m.processId as string) ||
      m.variant !== variant ||
      !["RL", "TB"].includes(m.direction as string) ||
      !date(m.createdAt) ||
      !date(m.updatedAt) ||
      !Array.isArray(m.steps) ||
      !Array.isArray(m.connections)
    )
      return fail();
    processes.add(m.processId as string);
    const ids = new Set<string>();
    for (const s of m.steps) {
      if (
        object(s) &&
        ((s.improvementAction !== undefined &&
          !["none", "eliminate", "simplify", "delegate", "automate"].includes(
            s.improvementAction as string,
          )) ||
          (s.improvementNote !== undefined && !text(s.improvementNote)))
      )
        return fail();
      if (
        !object(s) ||
        !text(s.id) ||
        !s.id ||
        ids.has(s.id as string) ||
        s.processId !== m.processId ||
        !text(s.title) ||
        !s.title.trim() ||
        !Object.hasOwn(stepTypes, s.type as string) ||
        !Object.hasOwn(founderLevels, s.founderDependency as string) ||
        typeof s.handoff !== "boolean" ||
        ![0, 25, 50, 75, 100].includes(s.reworkProbability as number) ||
        !date(s.createdAt) ||
        !date(s.updatedAt)
      )
        return fail();
      if (
        ["description", "input", "output", "notes"].some((k) => !text(s[k])) ||
        (s.ownerRoleId !== undefined && !text(s.ownerRoleId)) ||
        ["positionX", "positionY"].some((k) => !number(s[k])) ||
        ["workTimeMinutes", "waitTimeMinutes"].some(
          (k) => s[k] !== null && (!number(s[k]) || (s[k] as number) < 0),
        )
      )
        return fail();
      ids.add(s.id as string);
    }
    const edgeIds = new Set<string>(),
      pairs = new Set<string>();
    for (const e of m.connections) {
      if (
        !object(e) ||
        !text(e.id) ||
        !e.id ||
        edgeIds.has(e.id as string) ||
        e.processId !== m.processId ||
        !ids.has(e.sourceStepId as string) ||
        !ids.has(e.targetStepId as string) ||
        e.sourceStepId === e.targetStepId ||
        !text(e.label) ||
        !text(e.condition) ||
        e.type !== "sequence"
      )
        return fail();
      const pair = JSON.stringify([e.sourceStepId, e.targetStepId]);
      if (pairs.has(pair)) return fail();
      pairs.add(pair);
      edgeIds.add(e.id as string);
    }
  }
  return structuredClone(value) as unknown as MapStore;
}
export function replaceMap(store: MapStore, map: ProcessMap): MapStore {
  const now = new Date().toISOString(),
    saved = { ...map, updatedAt: now };
  return validateMaps({
    ...store,
    maps: [...store.maps.filter((m) => m.processId !== map.processId), saved],
  });
}
