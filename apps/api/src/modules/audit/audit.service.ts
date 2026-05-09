import { Injectable } from "@nestjs/common";
import type { AuditLogEntry, AuditLogStatus, EmailLogEntry, EmailLogStatus, NotificationLogEntry, NotificationLogStatus } from "@capris/shared";
import { PrismaService } from "../database/prisma.service";

type AuditPrisma = PrismaService & {
  auditLog: any;
  emailLog: any;
  notificationLog: any;
};

interface RecordAuditInput {
  organizationId: string;
  actorUserId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  status?: AuditLogStatus;
  metadata?: Record<string, unknown>;
}

interface RecordEmailLogInput {
  id?: string;
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
}

interface RecordNotificationLogInput {
  organizationId: string;
  userId?: string;
  reminderRuleId?: string;
  channel: string;
  eventType: string;
  recipient?: string;
  status: NotificationLogStatus;
  payload?: Record<string, unknown>;
  failureReason?: string;
}

interface UpdateEmailLogInput {
  id: string;
  status?: EmailLogStatus;
  provider?: string;
  failureReason?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async recordAudit(input: RecordAuditInput): Promise<AuditLogEntry> {
    const created = await (this.prisma as unknown as AuditPrisma).auditLog.create({
      data: {
        id: this.createId("audit"),
        organizationId: input.organizationId,
        actorUserId: input.actorUserId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        status: input.status ?? "success",
        metadataJson: input.metadata ? JSON.stringify(input.metadata) : null
      }
    });

    return this.toAuditLog(created);
  }

  async recordEmailLog(input: RecordEmailLogInput): Promise<EmailLogEntry> {
    const created = await (this.prisma as unknown as AuditPrisma).emailLog.create({
      data: {
        id: input.id ?? this.createId("email"),
        organizationId: input.organizationId,
        triggeredByUserId: input.triggeredByUserId ?? null,
        relatedEntityType: input.relatedEntityType ?? null,
        relatedEntityId: input.relatedEntityId ?? null,
        consignationId: input.consignationId ?? null,
        recipientEmailsJson: JSON.stringify(input.recipientEmails),
        subject: input.subject?.trim() || null,
        provider: input.provider?.trim() || null,
        status: input.status,
        failureReason: input.failureReason?.trim() || null,
        metadataJson: input.metadata ? JSON.stringify(input.metadata) : null
      }
    });

    return this.toEmailLog(created);
  }

  async updateEmailLog(input: UpdateEmailLogInput): Promise<EmailLogEntry> {
    const updated = await (this.prisma as unknown as AuditPrisma).emailLog.update({
      where: { id: input.id },
      data: {
        status: input.status,
        provider: input.provider?.trim() || undefined,
        failureReason: input.failureReason?.trim() || null,
        metadataJson: input.metadata ? JSON.stringify(input.metadata) : undefined
      }
    });

    return this.toEmailLog(updated);
  }

  async recordNotificationLog(input: RecordNotificationLogInput): Promise<NotificationLogEntry> {
    const created = await (this.prisma as unknown as AuditPrisma).notificationLog.create({
      data: {
        id: this.createId("notification"),
        organizationId: input.organizationId,
        userId: input.userId ?? null,
        reminderRuleId: input.reminderRuleId ?? null,
        channel: input.channel,
        eventType: input.eventType,
        recipient: input.recipient?.trim() || null,
        status: input.status,
        payloadJson: input.payload ? JSON.stringify(input.payload) : null,
        failureReason: input.failureReason?.trim() || null
      }
    });

    return this.toNotificationLog(created);
  }

  private toAuditLog(item: {
    id: string;
    organizationId: string;
    actorUserId: string | null;
    action: string;
    entityType: string;
    entityId: string | null;
    status: string;
    metadataJson: string | null;
    createdAt: Date;
  }): AuditLogEntry {
    return {
      id: item.id,
      organizationId: item.organizationId,
      actorUserId: item.actorUserId ?? undefined,
      action: item.action,
      entityType: item.entityType,
      entityId: item.entityId ?? undefined,
      status: item.status as AuditLogStatus,
      metadata: item.metadataJson ? (JSON.parse(item.metadataJson) as Record<string, unknown>) : undefined,
      createdAt: item.createdAt.toISOString()
    };
  }

  private toEmailLog(item: {
    id: string;
    organizationId: string;
    triggeredByUserId: string | null;
    relatedEntityType: string | null;
    relatedEntityId: string | null;
    consignationId: string | null;
    recipientEmailsJson: string;
    subject: string | null;
    provider: string | null;
    status: string;
    failureReason: string | null;
    metadataJson: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): EmailLogEntry {
    return {
      id: item.id,
      organizationId: item.organizationId,
      triggeredByUserId: item.triggeredByUserId ?? undefined,
      relatedEntityType: item.relatedEntityType ?? undefined,
      relatedEntityId: item.relatedEntityId ?? undefined,
      consignationId: item.consignationId ?? undefined,
      recipientEmails: JSON.parse(item.recipientEmailsJson) as string[],
      subject: item.subject ?? undefined,
      provider: item.provider ?? undefined,
      status: item.status as EmailLogStatus,
      failureReason: item.failureReason ?? undefined,
      metadata: item.metadataJson ? (JSON.parse(item.metadataJson) as Record<string, unknown>) : undefined,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString()
    };
  }

  private toNotificationLog(item: {
    id: string;
    organizationId: string;
    userId: string | null;
    reminderRuleId: string | null;
    channel: string;
    eventType: string;
    recipient: string | null;
    status: string;
    payloadJson: string | null;
    failureReason: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): NotificationLogEntry {
    return {
      id: item.id,
      organizationId: item.organizationId,
      userId: item.userId ?? undefined,
      reminderRuleId: item.reminderRuleId ?? undefined,
      channel: item.channel,
      eventType: item.eventType,
      recipient: item.recipient ?? undefined,
      status: item.status as NotificationLogStatus,
      payload: item.payloadJson ? (JSON.parse(item.payloadJson) as Record<string, unknown>) : undefined,
      failureReason: item.failureReason ?? undefined,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString()
    };
  }

  private createId(prefix: string) {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
  }
}
