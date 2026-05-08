export interface ActivityType {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  active: boolean;
}

export interface TaskType {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  active: boolean;
}

export interface WorkflowRule {
  id: string;
  organizationId: string;
  taskTypeId?: string;
  activityTypeId?: string;
  requiresBeforePhoto: boolean;
  requiresAfterPhoto: boolean;
  requiresGps: boolean;
  requiresComment: boolean;
  requiresSupervisorApproval: boolean;
  requiresConsignationEmail: boolean;
}

export interface CreateActivityTypeInput {
  organizationId: string;
  name: string;
  code: string;
  active?: boolean;
}

export interface UpdateActivityTypeInput {
  name?: string;
  code?: string;
  active?: boolean;
}

export interface CreateTaskTypeInput {
  organizationId: string;
  name: string;
  code: string;
  active?: boolean;
}

export interface UpdateTaskTypeInput {
  name?: string;
  code?: string;
  active?: boolean;
}

export interface CreateWorkflowRuleInput {
  organizationId: string;
  taskTypeId?: string;
  activityTypeId?: string;
  requiresBeforePhoto?: boolean;
  requiresAfterPhoto?: boolean;
  requiresGps?: boolean;
  requiresComment?: boolean;
  requiresSupervisorApproval?: boolean;
  requiresConsignationEmail?: boolean;
}

export interface UpdateWorkflowRuleInput {
  taskTypeId?: string;
  activityTypeId?: string;
  requiresBeforePhoto?: boolean;
  requiresAfterPhoto?: boolean;
  requiresGps?: boolean;
  requiresComment?: boolean;
  requiresSupervisorApproval?: boolean;
  requiresConsignationEmail?: boolean;
}

export const DEFAULT_FIELD_WORKFLOW_RULE: Omit<WorkflowRule, "id" | "organizationId"> = {
  requiresBeforePhoto: true,
  requiresAfterPhoto: true,
  requiresGps: true,
  requiresComment: false,
  requiresSupervisorApproval: false,
  requiresConsignationEmail: false
};

export type ReminderEvent =
  | "pending_task"
  | "overdue_task"
  | "missing_evidence"
  | "unclosed_visit"
  | "failed_sync"
  | "failed_email"
  | "aging_client_request";
