import type { AgentEntityRef, Domain, Risk, AgentPermission } from "../types";
import type { TemplateId } from "../preparation/types";
export type ExecutionErrorCode =
  | "ApprovalMissing"
  | "ApprovalInvalid"
  | "ActionStale"
  | "CapabilityDisabled"
  | "ExecutionNotAllowed"
  | "DomainValidationFailed"
  | "EntityConflict"
  | "DuplicateExecution"
  | "ExecutionFailed"
  | "PostExecutionVerificationFailed"
  | "RollbackNotSupported"
  | "StorageConflict"
  | "DependencyBlocked";
export interface AgentDomainCommand {
  commandId: string;
  capabilityId: string;
  domain: Domain;
  entityType: string;
  operation: "create";
  payload: Record<string, unknown>;
  sourceActionId: string;
  expectedState: Record<string, unknown>;
  requestedAt: string;
}
export interface AgentDomainCommandResult {
  commandId: string;
  success: boolean;
  entityRef?: AgentEntityRef;
  beforeSnapshot?: Record<string, unknown>;
  afterSnapshot?: Record<string, unknown>;
  warnings: string[];
  errorCode?: ExecutionErrorCode;
  executedAt?: string;
}
export interface ExecutionActor {
  actorUserId: string;
  organizationId: string;
  permissions: readonly AgentPermission[];
}
export type ExecutionStatus =
  | "Pending"
  | "Executing"
  | "Succeeded"
  | "Failed"
  | "PartiallyRecovered"
  | "RolledBack";
export interface AgentExecutionRecord {
  id: string;
  actionId: string;
  approvalId: string;
  approvedRevision: number;
  binding: string;
  commandId: string;
  capabilityId: string;
  domain: Domain;
  riskLevel: Risk;
  templateId: TemplateId;
  command: AgentDomainCommand;
  beforeSnapshot: Record<string, unknown>;
  afterSnapshot?: Record<string, unknown>;
  entityRefs: AgentEntityRef[];
  startedAt: string;
  completedAt?: string;
  status: ExecutionStatus;
  error?: ExecutionErrorCode;
  technicalDetail?: string;
  rollbackSupported: boolean;
  rollbackRecordId: string;
  actorUserId: string;
  organizationId: string;
  origin: string;
}
export interface AgentRollbackRecord {
  id: string;
  executionId: string;
  supported: boolean;
  rollbackType: "NotSupported" | "CompensatingAction" | "RestoreSnapshot";
  beforeSnapshot?: Record<string, unknown>;
  inverseCommand?: { operation: "archive"; entityRef: AgentEntityRef };
  status: "Available" | "NotSupported" | "RolledBack" | "Failed";
  createdAt: string;
  rolledBackAt?: string;
}
export interface ExecutionAudit {
  id: string;
  executionId: string;
  event:
    | "ExecutionRequested"
    | "ExecutionValidationPassed"
    | "ExecutionValidationFailed"
    | "ExecutionStarted"
    | "ExecutionSucceeded"
    | "ExecutionFailed"
    | "RollbackRequested"
    | "RollbackSucceeded"
    | "RollbackFailed";
  at: string;
  summary: string;
}
export interface ExecutionState {
  version: 1;
  records: AgentExecutionRecord[];
  rollbacks: AgentRollbackRecord[];
  audit: ExecutionAudit[];
}
export const emptyExecution = (): ExecutionState => ({
  version: 1,
  records: [],
  rollbacks: [],
  audit: [],
});
export type ExecutionStorage = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
> & {serverExecutionDisabled?:boolean};
