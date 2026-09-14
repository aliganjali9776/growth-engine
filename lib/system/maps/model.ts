import type { ProcessStep } from "../types";
export type { ProcessStep } from "../types";
export interface ProcessConnection {
  id: string;
  processId: string;
  sourceStepId: string;
  targetStepId: string;
  label: string;
  condition: string;
  type: "sequence";
}
export interface ProcessMap {
  version?: number;
  processId: string;
  variant: "as-is" | "to-be";
  steps: ProcessStep[];
  connections: ProcessConnection[];
  direction: "RL" | "TB";
  createdAt: string;
  updatedAt: string;
}
export interface MapStore {
  version: 1;
  maps: ProcessMap[];
}
export const stepTypes = {
  start: "شروع",
  action: "اقدام",
  decision: "تصمیم",
  handoff: "تحویل بین نقش‌ها",
  end: "پایان",
};
export function emptyMap(processId: string): ProcessMap {
  const now = new Date().toISOString();
  return {
    processId,
    variant: "as-is",
    steps: [],
    connections: [],
    direction: "RL",
    createdAt: now,
    updatedAt: now,
  };
}
export function newStep(processId: string, id: string): ProcessStep {
  const now = new Date().toISOString();
  return {
    id,
    processId,
    title: "مرحله جدید",
    description: "",
    type: "action",
    input: "",
    output: "",
    workTimeMinutes: null,
    waitTimeMinutes: null,
    handoff: false,
    reworkProbability: 0,
    founderDependency: "none",
    notes: "",
    positionX: 0,
    positionY: 0,
    createdAt: now,
    updatedAt: now,
  };
}
export function removeStep(map: ProcessMap, id: string): ProcessMap {
  return {
    ...map,
    steps: map.steps.filter((s) => s.id !== id),
    connections: map.connections.filter(
      (e) => e.sourceStepId !== id && e.targetStepId !== id,
    ),
  };
}
export function connect(map: ProcessMap, edge: ProcessConnection): ProcessMap {
  if (
    edge.sourceStepId === edge.targetStepId ||
    !map.steps.some((s) => s.id === edge.sourceStepId) ||
    !map.steps.some((s) => s.id === edge.targetStepId) ||
    edge.processId !== map.processId
  )
    throw new Error(
      "مبدأ و مقصد اتصال باید دو مرحله موجود در همین نقشه باشند.",
    );
  if (
    map.connections.some(
      (e) =>
        e.sourceStepId === edge.sourceStepId &&
        e.targetStepId === edge.targetStepId,
    )
  )
    throw new Error("این اتصال قبلاً ثبت شده است.");
  return { ...map, connections: [...map.connections, edge] };
}
