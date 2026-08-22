import type { Role, SupervisorScope, SupervisorScopeType } from "./domain";

export type Permission =
  | "users.manage"
  | "roles.manage"
  | "catalogs.manage"
  | "workflow_rules.manage"
  | "tasks.assign"
  | "tasks.complete"
  | "visits.view"
  | "visits.perform"
  | "visits.manage"
  | "evidence.view"
  | "evidence.upload"
  | "notes.view"
  | "notes.manage"
  | "consignations.view"
  | "consignations.review_send"
  | "activities.view"
  | "activities.manage"
  | "exhibitions.view"
  | "exhibitions.manage"
  | "client_requests.view"
  | "client_requests.manage"
  | "calendar.view"
  | "calendar.manage"
  | "exceptions.review"
  | "dashboards.view"
  | "performance.view"
  | "performance.export"
  | "reports.export"
  | "audit.view"
  | "system_health.view"
  | "metrics.view"
  | "observability.view"
  | "ops.read"
  | "ops.manage"
  | "developer_tools.use"
  | "device_sessions.revoke";

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    "users.manage",
    "roles.manage",
    "catalogs.manage",
    "workflow_rules.manage",
    "tasks.assign",
    "tasks.complete",
    "visits.view",
    "visits.perform",
    "visits.manage",
    "evidence.view",
    "evidence.upload",
    "notes.view",
    "notes.manage",
    "consignations.view",
    "consignations.review_send",
    "activities.view",
    "activities.manage",
    "exhibitions.view",
    "exhibitions.manage",
    "client_requests.view",
    "client_requests.manage",
    "calendar.view",
    "calendar.manage",
    "exceptions.review",
    "dashboards.view",
    "performance.view",
    "performance.export",
    "reports.export",
    "audit.view",
    "system_health.view",
    "metrics.view",
    "observability.view",
    "ops.read",
    "ops.manage",
    "developer_tools.use",
    "device_sessions.revoke"
  ],
  supervisor_auditor: [
    "tasks.assign",
    "visits.view",
    "visits.manage",
    "evidence.view",
    "notes.view",
    "consignations.view",
    "consignations.review_send",
    "activities.view",
    "activities.manage",
    "exhibitions.view",
    "exhibitions.manage",
    "client_requests.view",
    "client_requests.manage",
    "calendar.view",
    "calendar.manage",
    "exceptions.review",
    "dashboards.view",
    "performance.view",
    "performance.export",
    "reports.export",
    "audit.view"
  ],
  field_user: [
    "tasks.complete",
    "visits.view",
    "visits.perform",
    "evidence.view",
    "evidence.upload",
    "notes.view",
    "notes.manage",
    "consignations.view",
    "activities.view",
    "activities.manage",
    "exhibitions.view",
    "exhibitions.manage",
    "calendar.view"
  ],
  developer_sre: [
    "system_health.view",
    "metrics.view",
    "observability.view",
    "ops.read",
    "ops.manage",
    "developer_tools.use"
  ]
};

export interface PermissionActor {
  organizationId: string;
  role: Role;
  supervisorScopes?: SupervisorScope[];
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function getPermissionsForRole(role: Role): Permission[] {
  return [...ROLE_PERMISSIONS[role]];
}

export function canAccessOrganization(actor: PermissionActor, organizationId: string): boolean {
  return actor.organizationId === organizationId;
}

export function canAccessScopedResource(
  actor: PermissionActor,
  scopeType: SupervisorScopeType,
  referenceId: string,
  organizationId: string
): boolean {
  if (!canAccessOrganization(actor, organizationId)) {
    return false;
  }

  if (actor.role === "admin") {
    return true;
  }

  if (actor.role !== "supervisor_auditor") {
    return false;
  }

  return (
    actor.supervisorScopes?.some(
      (scope) =>
        scope.active &&
        scope.organizationId === organizationId &&
        scope.type === scopeType &&
        scope.referenceId === referenceId
    ) ?? false
  );
}
