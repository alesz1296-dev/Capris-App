export type AuditLogStatus = "success" | "failure";
export type EmailLogStatus = "draft" | "pending_review" | "queued" | "sent" | "failed";
export type NotificationLogStatus = "queued" | "sent" | "failed";

export interface AuditLogEntry {
  id: string;
  organizationId: string;
  actorUserId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  status: AuditLogStatus;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface EmailLogEntry {
  id: string;
  organizationId: string;
  triggeredByUserId?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  consignationId?: string;
  recipientEmails: string[];
  subject?: string;
  provider?: string;
  status: EmailLogStatus;
  failureReason?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationLogEntry {
  id: string;
  organizationId: string;
  userId?: string;
  reminderRuleId?: string;
  channel: string;
  eventType: string;
  recipient?: string;
  status: NotificationLogStatus;
  payload?: Record<string, unknown>;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}
