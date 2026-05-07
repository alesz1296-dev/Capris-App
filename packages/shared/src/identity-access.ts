import type {
  Locale,
  Organization,
  OrganizationAccessProfile,
  Role,
  RoleDefinition,
  SupervisorScope,
  SupervisorScopeType,
  Team,
  User
} from "./domain";
import type { Permission } from "./permissions";

export interface UserAccessSummary extends User {
  permissions: Permission[];
}

export interface CreateUserInput {
  organizationId: string;
  name: string;
  email: string;
  role: Role;
  locale: Locale;
  active?: boolean;
}

export interface AssignUserRoleInput {
  role: Role;
}

export interface AssignSupervisorScopeInput {
  userId: string;
  organizationId: string;
  type: SupervisorScopeType;
  referenceId: string;
  referenceName: string;
  active?: boolean;
}

export interface IdentityAccessBootstrap {
  organizations: Organization[];
  teams: Team[];
  users: UserAccessSummary[];
  supervisorScopes: SupervisorScope[];
  roleDefinitions: RoleDefinition[];
}

export interface AccessProfileResponse {
  profile: OrganizationAccessProfile;
  permissions: Permission[];
  roleDefinition?: RoleDefinition;
}

