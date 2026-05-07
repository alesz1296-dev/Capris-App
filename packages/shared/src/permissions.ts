import type { Role, SupervisorScope, SupervisorScopeType } from "./domain";

export type Permission =
  | "users.manage"
  | "roles.manage"
  | "catalogs.manage"
  | "workflow_rules.manage"
  | "tasks.assign"
  | "tasks.complete"
  | "visits.perform"
  | "evidence.upload"
  | "consignations.review_send"
  | "exceptions.review"
  | "dashboards.view"
  | "reports.export"
  | "audit.view"
  | "system_health.view"
  | "device_sessions.revoke";

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    "users.manage",
    "roles.manage",
    "catalogs.manage",
    "workflow_rules.manage",
    "tasks.assign",
    "tasks.complete",
    "visits.perform",
    "evidence.upload",
    "consignations.review_send",
    "exceptions.review",
    "dashboards.view",
    "reports.export",
    "audit.view",
    "system_health.view",
    "device_sessions.revoke"
  ],
  supervisor: [
    "tasks.assign",
    "exceptions.review",
    "dashboards.view",
    "reports.export",
    "audit.view",
    "system_health.view"
  ],
  field_user: [
    "tasks.complete",
    "visits.perform",
    "evidence.upload",
    "consignations.review_send"
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

  if (actor.role !== "supervisor") {
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
