export const DEFAULT_COUNTRY = "Costa Rica" as const;
export const DEFAULT_TIMEZONE = "America/Costa_Rica" as const;
export const TASK_STATUSES = ["pending", "in_progress", "completed"] as const;
export const VISIT_STATUSES = ["scheduled", "checked_in", "checked_out"] as const;
export const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export const DIFFICULTIES = ["easy", "standard", "hard", "critical"] as const;
import type { SyncState } from "./sync";

export const EVIDENCE_TYPES = ["before", "after", "supporting"] as const;
export const UPLOAD_STATUSES = ["pending_upload", "uploading", "uploaded", "failed"] as const;

export type Locale = "en" | "es";

export type Role = "admin" | "supervisor" | "field_user";

export type SupervisorScopeType =
  | "organization"
  | "team"
  | "province"
  | "zone"
  | "client";

export type TaskStatus = (typeof TASK_STATUSES)[number];
export type VisitStatus = (typeof VISIT_STATUSES)[number];
export type ClientRequestStatus =
  | "open"
  | "in_progress"
  | "waiting_client"
  | "resolved"
  | "closed";

export type Priority = (typeof PRIORITIES)[number];
export type Difficulty = (typeof DIFFICULTIES)[number];
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];
export type UploadStatus = (typeof UPLOAD_STATUSES)[number];
export const CONSIGNATION_STATUSES = ["prepared", "sent"] as const;
export type ConsignationStatus = (typeof CONSIGNATION_STATUSES)[number];
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
  googleSubject?: string;
  avatarUrl?: string;
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
  clientId?: string;
  pointOfSaleId?: string;
  activityTypeId: string;
  taskTypeId: string;
  status: TaskStatus;
  priority: Priority;
  difficulty: Difficulty;
}

export interface Visit {
  id: string;
  organizationId: string;
  taskId: string;
  assigneeId: string;
  scheduledFor: string;
  provinceId: string;
  zoneId: string;
  pointOfSaleId?: string;
  status: VisitStatus;
  checkedInAt?: string;
  checkedInLatitude?: number;
  checkedInLongitude?: number;
  checkedOutAt?: string;
  checkedOutLatitude?: number;
  checkedOutLongitude?: number;
}

export interface EvidencePhoto {
  id: string;
  organizationId: string;
  uploaderUserId: string;
  taskId: string;
  visitId?: string;
  mediaAssetId: string;
  type: EvidenceType;
  capturedAt: string;
  latitude?: number;
  longitude?: number;
  uploadStatus: UploadStatus;
}

export interface Comment {
  id: string;
  organizationId: string;
  taskId: string;
  userId: string;
  body: string;
  createdAt: string;
}

export interface Observation {
  id: string;
  organizationId: string;
  taskId: string;
  userId: string;
  body: string;
  createdAt: string;
}

export interface Consignation {
  id: string;
  organizationId: string;
  taskId: string;
  userId: string;
  visitId?: string;
  note?: string;
  status: ConsignationStatus;
  preparedAt: string;
  sentAt?: string;
}

export interface MediaAsset {
  id: string;
  organizationId: string;
  uploaderUserId: string;
  fileName: string;
  mimeType: string;
  originalStoragePath: string;
  thumbnailStoragePath?: string;
  capturedAt: string;
  uploadStatus: UploadStatus;
  syncState: SyncState;
  uploadSessionId?: string;
  uploadProgress: number;
  retryCount: number;
  lastError?: string;
  chunkCount?: number;
  uploadedChunkCount?: number;
  byteSize?: number;
  width?: number;
  height?: number;
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
