export type EntityStatus = "active" | "archived";
export interface Department {
  id: string;
  name: string;
  description: string;
  parentDepartmentId?: string;
  managerRoleId?: string;
  status: EntityStatus;
}
export interface Role {
  id: string;
  title: string;
  departmentId: string;
  reportsToRoleId?: string;
  purpose: string;
  responsibilities: string[];
  personId?: string;
  isKeyRole: boolean;
  isFounderRole: boolean;
}
// Role.personId is the canonical assignment. Person remains independent of a position.
export interface Person {
  id: string;
  name: string;
  jobTitle: string;
  email?: string;
  status: EntityStatus;
  avatar?: string;
}
export interface OrganizationNode {
  id: string;
  kind: "department" | "role";
  entityId: string;
  parentId?: string;
  x: number;
  y: number;
}
export type Rating = 1 | 2 | 3;
export type FounderDependency = "none" | "low" | "medium" | "high" | "critical";
export type PriorityLevel = "critical" | "high" | "medium" | "low";
export type SystemizationStage =
  | "identified"
  | "mapped"
  | "analyzed"
  | "redesigned"
  | "standardized"
  | "implemented"
  | "measured"
  | "improving";
export interface Process {
  id: string;
  code: string;
  name: string;
  description: string;
  valueChain: string;
  departmentId: string;
  ownerRoleId: string;
  frequency: Rating;
  impact: Rating;
  variation: Rating;
  dependency: Rating;
  founderDependency: FounderDependency;
  priorityScore: number;
  priorityLevel: PriorityLevel;
  status: EntityStatus;
  systemizationStage: SystemizationStage;
  documentationStatus: "none" | "partial" | "complete";
  adoptionStatus: "not-started" | "partial" | "adopted";
  healthScore?: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}
export interface ProcessStep {
  improvementAction?:
    "none" | "eliminate" | "simplify" | "delegate" | "automate";
  improvementNote?: string;
  id: string;
  processId: string;
  title: string;
  description: string;
  ownerRoleId?: string;
  // Person is resolved live from Role.personId, never duplicated in map storage.
  type: "action" | "decision" | "handoff" | "start" | "end";
  input: string;
  output: string;
  workTimeMinutes: number | null;
  waitTimeMinutes: number | null;
  handoff: boolean;
  reworkProbability: 0 | 25 | 50 | 75 | 100;
  founderDependency: FounderDependency;
  notes: string;
  positionX: number;
  positionY: number;
  createdAt: string;
  updatedAt: string;
}
export interface SystemData {
  version: 1;
  departments: Department[];
  roles: Role[];
  people: Person[];
  processes: Process[];
}
