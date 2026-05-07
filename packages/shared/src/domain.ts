export const DEFAULT_COUNTRY = "Costa Rica" as const;
export const DEFAULT_TIMEZONE = "America/Costa_Rica" as const;

export type Locale = "en" | "es";

export type Role = "admin" | "supervisor" | "field_user";

export type SupervisorScopeType =
  | "organization"
  | "team"
  | "province"
  | "zone"
  | "client";

export type TaskStatus = "pending" | "in_progress" | "completed";
export type ClientRequestStatus =
  | "open"
  | "in_progress"
  | "waiting_client"
  | "resolved"
  | "closed";

export type Priority = "low" | "medium" | "high" | "urgent";
export type Difficulty = "easy" | "standard" | "hard" | "critical";
export type EvidenceType = "before" | "after" | "supporting";
export type UploadStatus = "pending_upload" | "uploading" | "uploaded" | "failed";
export type EmailStatus = "draft" | "pending_review" | "queued" | "sent" | "failed";
export type ExceptionStatus = "submitted" | "approved" | "rejected" | "needs_correction";

export interface Organization {
  id: string;
  name: string;
  defaultLocale: Locale;
  timezone: string;
  active: boolean;
}

export interface User {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  role: Role;
  locale: Locale;
  active: boolean;
}

export interface Team {
  id: string;
  organizationId: string;
  name: string;
  leadUserId?: string;
  active: boolean;
}

export interface SupervisorScope {
  id: string;
  organizationId: string;
  userId: string;
  type: SupervisorScopeType;
  referenceId: string;
  referenceName: string;
  active: boolean;
}

export interface RoleDefinition {
  id: Role;
  nameKey: string;
  descriptionKey: string;
}

export interface Province {
  id: string;
  organizationId: string;
  country: typeof DEFAULT_COUNTRY;
  name: string;
  code: string;
  active: boolean;
}

export interface Zone {
  id: string;
  organizationId: string;
  provinceId: string;
  name: string;
  code: string;
  active: boolean;
}

export interface Client {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  contactEmail?: string;
  active: boolean;
}

export interface PointOfSale {
  id: string;
  organizationId: string;
  zoneId: string;
  provinceId: string;
  clientId: string;
  name: string;
  code: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  active: boolean;
}

export interface Task {
  id: string;
  organizationId: string;
  title: string;
  requesterId: string;
  assigneeId: string;
  scheduledFor: string;
  provinceId: string;
  zoneId: string;
  pointOfSaleId?: string;
  activityTypeId: string;
  taskTypeId: string;
  status: TaskStatus;
  priority: Priority;
  difficulty: Difficulty;
}

export interface EvidencePhoto {
  id: string;
  taskId: string;
  visitId?: string;
  mediaAssetId: string;
  type: EvidenceType;
  capturedAt: string;
  latitude?: number;
  longitude?: number;
  uploadStatus: UploadStatus;
}

export interface OrganizationAccessProfile {
  organization: Organization;
  user: User;
  team?: Team;
  supervisorScopes: SupervisorScope[];
}

export const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    id: "admin",
    nameKey: "role.admin",
    descriptionKey: "role.admin.description"
  },
  {
    id: "supervisor",
    nameKey: "role.supervisor",
    descriptionKey: "role.supervisor.description"
  },
  {
    id: "field_user",
    nameKey: "role.field_user",
    descriptionKey: "role.field_user.description"
  }
];
