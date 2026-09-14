import type { ProcessMap } from "../maps/model";
import type { SystemData } from "../types";
import { fingerprint } from "../analysis/redesign";
import { operational } from "../maps/logic";
export const sopStatuses = {
  draft: "پیش‌نویس",
  review: "در حال بررسی",
  approved: "تأییدشده",
  "needs-review": "نیازمند بازبینی",
};
export interface Procedure {
  stepId: string;
  instruction: string;
  responsibleRoleId: string;
  expectedOutput: string;
  qualityCriteria: string;
  exceptionNote: string;
}
export interface ProcessSOP {
  id: string;
  processId: string;
  title: string;
  version: string;
  status: keyof typeof sopStatuses;
  basedOnToBeVersion: number;
  sourceFingerprint: string;
  purpose: string;
  scope: string;
  processOwnerRoleId: string;
  trigger: string;
  inputs: string[];
  outputs: string[];
  prerequisites: string[];
  procedureSteps: Procedure[];
  exceptions: string[];
  escalationRules: string[];
  definitionOfDone: string[];
  qualityCriteria: string[];
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  approvedByRoleId?: string;
  approvalSignature?: string;
}
export interface ChecklistItem {
  id: string;
  title: string;
  required: boolean;
  order: number;
  relatedStepId: string;
  note: string;
}
export interface Checklist {
  id: string;
  processId: string;
  name: string;
  description: string;
  trigger: string;
  ownerRoleId: string;
  items: ChecklistItem[];
  status: "draft" | "ready";
  createdAt: string;
  updatedAt: string;
}
export interface DecisionRule {
  id: string;
  processId: string;
  title: string;
  relatedStepId: string;
  condition: string;
  action: string;
  ownerRoleId: string;
  escalationRoleId: string;
  priority: 1 | 2 | 3;
  status: "draft" | "ready";
  notes: string;
}
export const assetTypes = {
  template: "Template",
  form: "Form",
  script: "Script",
  document: "Document",
  example: "Example",
  link: "Link",
  other: "Other",
};
export interface Asset {
  id: string;
  processId: string;
  name: string;
  type: keyof typeof assetTypes;
  description: string;
  relatedStepId: string;
  reference: string;
  version: string;
  status: "draft" | "ready";
}
export const pilotStatuses = {
  "not-required": "نیاز ندارد",
  planned: "برنامه‌ریزی‌شده",
  running: "در حال اجرا",
  completed: "تکمیل‌شده",
  revision: "نیازمند اصلاح",
};
export const trainingStatuses = {
  "not-required": "نیاز ندارد",
  "not-started": "شروع نشده",
  scheduled: "زمان‌بندی‌شده",
  "in-progress": "در حال آموزش",
  completed: "تکمیل‌شده",
};
export const goLiveStatuses = {
  "not-ready": "آماده نیست",
  ready: "آماده",
  live: "در حال استفاده",
  paused: "متوقف",
};
export interface ImplementationPlan {
  processId: string;
  implementationOwnerRoleId: string;
  targetGoLiveDate: string;
  pilotRequired: boolean;
  pilotOwnerRoleId: string;
  pilotStartDate: string;
  pilotEndDate: string;
  pilotStatus: keyof typeof pilotStatuses;
  pilotNotes: string;
  pilotIssues: string;
  pilotOutcome: string;
  pilotFeedbackReviewed: boolean;
  trainingRequired: boolean;
  trainingStatus: keyof typeof trainingStatuses;
  roles: { roleId: string; trained: boolean; acknowledged: boolean }[];
  ownerConfirmed: boolean;
  teamBriefed: boolean;
  toolsReady: boolean;
  templatesRequired: boolean;
  templatesReady: boolean;
  goLiveStatus: keyof typeof goLiveStatuses;
  goLiveAt?: string;
  notes: string;
  updatedAt: string;
}
export interface StandardRecord {
  processId: string;
  sop?: ProcessSOP;
  checklists: Checklist[];
  rules: DecisionRule[];
  assets: Asset[];
  plan: ImplementationPlan;
  standardizedAt?: string;
  standardizedSignature?: string;
  implementedAt?: string;
  implementedSignature?: string;
}
export interface StandardsStore {
  version: 1;
  records: StandardRecord[];
}
export function emptyRecord(processId: string): StandardRecord {
  return {
    processId,
    checklists: [],
    rules: [],
    assets: [],
    plan: {
      processId,
      implementationOwnerRoleId: "",
      targetGoLiveDate: "",
      pilotRequired: true,
      pilotOwnerRoleId: "",
      pilotStartDate: "",
      pilotEndDate: "",
      pilotStatus: "planned",
      pilotNotes: "",
      pilotIssues: "",
      pilotOutcome: "",
      pilotFeedbackReviewed: false,
      trainingRequired: true,
      trainingStatus: "not-started",
      roles: [],
      ownerConfirmed: false,
      teamBriefed: false,
      toolsReady: false,
      templatesRequired: true,
      templatesReady: false,
      goLiveStatus: "not-ready",
      notes: "",
      updatedAt: new Date().toISOString(),
    },
  };
}
export function createSOP(map: ProcessMap, sys: SystemData): ProcessSOP {
  const now = new Date().toISOString(),
    p = sys.processes.find((p) => p.id === map.processId);
  return {
    id: `sop-${map.processId}`,
    processId: map.processId,
    title: `استاندارد اجرایی ${p?.name ?? ""}`,
    version: "1.0",
    status: "draft",
    basedOnToBeVersion: map.version ?? 1,
    sourceFingerprint: fingerprint(map, sys),
    purpose: "",
    scope: "",
    processOwnerRoleId: p?.ownerRoleId ?? "",
    trigger: "",
    inputs: [],
    outputs: [],
    prerequisites: [],
    procedureSteps: map.steps
      .filter(operational)
      .map((s) => ({
        stepId: s.id,
        instruction: "",
        responsibleRoleId: s.ownerRoleId ?? "",
        expectedOutput: s.output,
        qualityCriteria: "",
        exceptionNote: "",
      })),
    exceptions: [],
    escalationRules: [],
    definitionOfDone: [],
    qualityCriteria: [],
    createdAt: now,
    updatedAt: now,
  };
}
export function rebaseSOP(
  sop: ProcessSOP,
  map: ProcessMap,
  sys: SystemData,
): ProcessSOP {
  return {
    ...sop,
    basedOnToBeVersion: map.version ?? 1,
    sourceFingerprint: fingerprint(map, sys),
    procedureSteps: map.steps
      .filter(operational)
      .map(
        (s) =>
          sop.procedureSteps.find((p) => p.stepId === s.id) ?? {
            stepId: s.id,
            instruction: "",
            responsibleRoleId: s.ownerRoleId ?? "",
            expectedOutput: s.output,
            qualityCriteria: "",
            exceptionNote: "",
          },
      ),
    status: "needs-review",
    approvedAt: undefined,
    approvedByRoleId: undefined,
    approvalSignature: undefined,
    updatedAt: new Date().toISOString(),
  };
}
