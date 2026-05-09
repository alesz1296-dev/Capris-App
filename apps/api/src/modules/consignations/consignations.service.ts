import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type {
  Consignation,
  ConsignationMutationResult,
  FailConsignationInput,
  PrepareConsignationInput,
  ReviewConsignationInput,
  SendConsignationInput
} from "@capris/shared";
import { AuditService } from "../audit/audit.service";
import { ActorAccessService } from "../auth/actor-access.service";
import type { AuthJwtPayload } from "../auth/auth-token.service";
import { EmailService } from "../email/email.service";
import { ObjectStorageService } from "../object-storage/object-storage.service";
import { ReplayProtectionService } from "../replay-protection/replay-protection.service";
import { PrismaService } from "../database/prisma.service";

type ConsignationsPrisma = PrismaService & {
  consignation: any;
  task: any;
  user: any;
  visit: any;
  evidencePhoto: any;
  emailLog: any;
};

@Injectable()
export class ConsignationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actorAccessService: ActorAccessService,
    private readonly auditService: AuditService,
    private readonly emailService: EmailService,
    private readonly objectStorageService: ObjectStorageService,
    private readonly replayProtectionService: ReplayProtectionService
  ) {}

  async getConsignations(): Promise<Consignation[]> {
    const prisma = this.prisma as unknown as ConsignationsPrisma;
    const items = await prisma.consignation.findMany({
      orderBy: [{ preparedAt: "desc" }, { createdAt: "desc" }]
    });
    return items.map((item: any) => this.toConsignation(item));
  }

  async prepareConsignation(input: PrepareConsignationInput, actor?: AuthJwtPayload): Promise<ConsignationMutationResult> {
    const cached = await this.replayProtectionService.getCachedResult<ConsignationMutationResult>(
      input.organizationId,
      "consignation_prepare",
      input.clientOperationId
    );
    if (cached) {
      return cached;
    }

    const task = await this.assertReferences(input);
    if (actor) {
      await this.actorAccessService.assertOperationAccess(actor, {
        organizationId: input.organizationId,
        userId: input.userId,
        assigneeId: task.assigneeId,
        provinceId: task.provinceId,
        zoneId: task.zoneId,
        clientId: task.clientId ?? undefined
      });
    }
    const created = await (this.prisma as unknown as ConsignationsPrisma).consignation.create({
      data: {
        id: this.createId("consignation"),
        organizationId: input.organizationId,
        taskId: input.taskId,
        userId: input.userId,
        visitId: input.visitId ?? null,
        note: input.note?.trim() || null,
        status: "prepared",
        preparedAt: input.preparedAt,
        recipientEmails: "",
        emailSubject: null,
        emailBody: null
      }
    });

    await this.auditService.recordAudit({
      organizationId: created.organizationId,
      actorUserId: actor?.sub ?? created.userId,
      action: "consignation.prepare",
      entityType: "consignation",
      entityId: created.id,
      metadata: {
        taskId: created.taskId,
        visitId: created.visitId ?? undefined
      }
    });

    const result = {
      item: this.toConsignation(created),
      message: `Consignation ${created.id} prepared for task ${created.taskId}.`
    };
    await this.replayProtectionService.recordResult(input.organizationId, "consignation_prepare", input.clientOperationId, result);
    return result;
  }

  async reviewConsignation(id: string, input: ReviewConsignationInput, actor?: AuthJwtPayload): Promise<ConsignationMutationResult> {
    const prisma = this.prisma as unknown as ConsignationsPrisma;
    const existing = await prisma.consignation.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Consignation ${id} was not found.`);
    }
    if (actor) {
      const task = await prisma.task.findUnique({ where: { id: existing.taskId } });
      await this.actorAccessService.assertOperationAccess(actor, {
        organizationId: existing.organizationId,
        userId: existing.userId,
        assigneeId: task?.assigneeId,
        provinceId: task?.provinceId,
        zoneId: task?.zoneId,
        clientId: task?.clientId ?? undefined
      });
    }

    const cached = await this.replayProtectionService.getCachedResult<ConsignationMutationResult>(
      existing.organizationId,
      "consignation_review",
      input.clientOperationId
    );
    if (cached) {
      return cached;
    }

    await this.assertReviewEvidence(existing.organizationId, existing.taskId, existing.visitId, input);

    const updated = await prisma.consignation.update({
      where: { id },
      data: {
        status: "ready_to_send",
        reviewedAt: input.reviewedAt,
        recipientEmails: input.recipientEmails.join(","),
        emailSubject: input.emailSubject.trim(),
        emailBody: input.emailBody.trim(),
        beforeEvidenceId: input.beforeEvidenceId ?? null,
        afterEvidenceId: input.afterEvidenceId ?? null,
        sendFailureReason: null,
        failedAt: null
      }
    });

    await this.auditService.recordAudit({
      organizationId: updated.organizationId,
      actorUserId: actor?.sub,
      action: "consignation.review",
      entityType: "consignation",
      entityId: updated.id,
      metadata: {
        status: updated.status
      }
    });
    await this.auditService.recordEmailLog({
      organizationId: updated.organizationId,
      triggeredByUserId: actor?.sub ?? updated.userId,
      relatedEntityType: "consignation",
      relatedEntityId: updated.id,
      consignationId: updated.id,
      recipientEmails: input.recipientEmails,
      subject: input.emailSubject,
      provider: "application_review",
      status: "pending_review",
      metadata: {
        beforeEvidenceId: input.beforeEvidenceId,
        afterEvidenceId: input.afterEvidenceId
      }
    });

    const result = {
      item: this.toConsignation(updated),
      message: `Consignation ${updated.id} reviewed and ready to send.`
    };
    await this.replayProtectionService.recordResult(existing.organizationId, "consignation_review", input.clientOperationId, result);
    return result;
  }

  async sendConsignation(id: string, input: SendConsignationInput, actor?: AuthJwtPayload): Promise<ConsignationMutationResult> {
    const prisma = this.prisma as unknown as ConsignationsPrisma;
    const existing = await prisma.consignation.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Consignation ${id} was not found.`);
    }
    if (actor) {
      const task = await prisma.task.findUnique({ where: { id: existing.taskId } });
      await this.actorAccessService.assertOperationAccess(actor, {
        organizationId: existing.organizationId,
        userId: existing.userId,
        assigneeId: task?.assigneeId,
        provinceId: task?.provinceId,
        zoneId: task?.zoneId,
        clientId: task?.clientId ?? undefined
      });
    }

    const cached = await this.replayProtectionService.getCachedResult<ConsignationMutationResult>(
      existing.organizationId,
      "consignation_send",
      input.clientOperationId
    );
    if (cached) {
      return cached;
    }

    if (existing.status === "sent") {
      throw new BadRequestException(`Consignation ${id} has already been sent.`);
    }

    const recipientEmails = existing.recipientEmails ? existing.recipientEmails.split(",").map((email: string) => email.trim()).filter(Boolean) : [];
    if (!recipientEmails.length || !existing.emailSubject?.trim() || !existing.emailBody?.trim()) {
      throw new BadRequestException(`Consignation ${id} must be reviewed with recipients, subject, and body before sending.`);
    }

    const emailLog = await this.auditService.recordEmailLog({
      organizationId: existing.organizationId,
      triggeredByUserId: actor?.sub ?? existing.userId,
      relatedEntityType: "consignation",
      relatedEntityId: existing.id,
      consignationId: existing.id,
      recipientEmails,
      subject: existing.emailSubject,
      provider: "pending_provider",
      status: "queued",
      metadata: {
        sentAt: input.sentAt
      }
    });

    try {
      const body = await this.buildOutgoingEmailBody(existing);
      const delivery = await this.emailService.send({
        to: recipientEmails,
        subject: existing.emailSubject,
        textBody: body.textBody,
        htmlBody: body.htmlBody
      });

      const updated = await prisma.consignation.update({
        where: { id },
        data: {
          status: "sent",
          sendFailureReason: null,
          failedAt: null,
          sentAt: input.sentAt
        }
      });

      await this.auditService.updateEmailLog({
        id: emailLog.id,
        status: "sent",
        provider: delivery.provider,
        metadata: {
          sentAt: input.sentAt,
          messageId: delivery.messageId
        }
      });
      await this.auditService.recordNotificationLog({
        organizationId: updated.organizationId,
        userId: updated.userId,
        channel: "email",
        eventType: "consignation_delivery",
        recipient: recipientEmails.join(","),
        status: "sent",
        payload: {
          consignationId: updated.id,
          provider: delivery.provider,
          messageId: delivery.messageId
        }
      });
      await this.auditService.recordAudit({
        organizationId: updated.organizationId,
        actorUserId: actor?.sub,
        action: "consignation.send",
        entityType: "consignation",
        entityId: updated.id,
        metadata: {
          status: updated.status,
          provider: delivery.provider
        }
      });

      const result = {
        item: this.toConsignation(updated),
        message: `Consignation ${updated.id} sent through ${delivery.provider}.`
      };
      await this.replayProtectionService.recordResult(existing.organizationId, "consignation_send", input.clientOperationId, result);
      return result;
    } catch (error) {
      const failureReason = error instanceof Error ? error.message : "Email delivery failed.";
      const failed = await prisma.consignation.update({
        where: { id },
        data: {
          status: "failed",
          failedAt: input.sentAt,
          sendFailureReason: failureReason
        }
      });

      await this.auditService.updateEmailLog({
        id: emailLog.id,
        status: "failed",
        failureReason,
        metadata: {
          sentAt: input.sentAt
        }
      });
      await this.auditService.recordNotificationLog({
        organizationId: failed.organizationId,
        userId: failed.userId,
        channel: "email",
        eventType: "consignation_delivery",
        recipient: recipientEmails.join(","),
        status: "failed",
        failureReason,
        payload: {
          consignationId: failed.id
        }
      });
      await this.auditService.recordAudit({
        organizationId: failed.organizationId,
        actorUserId: actor?.sub,
        action: "consignation.send",
        entityType: "consignation",
        entityId: failed.id,
        status: "failure",
        metadata: {
          reason: failureReason
        }
      });

      const result = {
        item: this.toConsignation(failed),
        message: `Consignation ${failed.id} delivery failed: ${failureReason}`
      };
      await this.replayProtectionService.recordResult(existing.organizationId, "consignation_send", input.clientOperationId, result);
      return result;
    }
  }

  async failConsignation(id: string, input: FailConsignationInput, actor?: AuthJwtPayload): Promise<ConsignationMutationResult> {
    const prisma = this.prisma as unknown as ConsignationsPrisma;
    const existing = await prisma.consignation.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Consignation ${id} was not found.`);
    }
    if (actor) {
      const task = await prisma.task.findUnique({ where: { id: existing.taskId } });
      await this.actorAccessService.assertOperationAccess(actor, {
        organizationId: existing.organizationId,
        userId: existing.userId,
        assigneeId: task?.assigneeId,
        provinceId: task?.provinceId,
        zoneId: task?.zoneId,
        clientId: task?.clientId ?? undefined
      });
    }

    const cached = await this.replayProtectionService.getCachedResult<ConsignationMutationResult>(
      existing.organizationId,
      "consignation_fail",
      input.clientOperationId
    );
    if (cached) {
      return cached;
    }

    if (existing.status === "sent") {
      throw new BadRequestException(`Consignation ${id} has already been sent and cannot be marked as failed.`);
    }

    const updated = await prisma.consignation.update({
      where: { id },
      data: {
        status: "failed",
        failedAt: input.failedAt,
        sendFailureReason: input.reason.trim()
      }
    });

    await this.auditService.recordAudit({
      organizationId: updated.organizationId,
      actorUserId: actor?.sub,
      action: "consignation.fail",
      entityType: "consignation",
      entityId: updated.id,
      status: "failure",
      metadata: {
        reason: input.reason.trim()
      }
    });
    await this.auditService.recordEmailLog({
      organizationId: updated.organizationId,
      triggeredByUserId: actor?.sub ?? updated.userId,
      relatedEntityType: "consignation",
      relatedEntityId: updated.id,
      consignationId: updated.id,
      recipientEmails: existing.recipientEmails
        ? existing.recipientEmails.split(",").map((email: string) => email.trim()).filter(Boolean)
        : [],
      subject: existing.emailSubject ?? undefined,
      provider: "capris_manual_status",
      status: "failed",
      failureReason: input.reason.trim()
    });

    const result = {
      item: this.toConsignation(updated),
      message: `Consignation ${updated.id} marked as failed.`
    };
    await this.replayProtectionService.recordResult(existing.organizationId, "consignation_fail", input.clientOperationId, result);
    return result;
  }

  private async assertReferences(input: PrepareConsignationInput) {
    const prisma = this.prisma as unknown as ConsignationsPrisma;
    const [task, user] = await Promise.all([
      prisma.task.findFirst({ where: { id: input.taskId, organizationId: input.organizationId } }),
      prisma.user.findFirst({ where: { id: input.userId, organizationId: input.organizationId, active: true } })
    ]);

    if (!task) {
      throw new NotFoundException(`Task ${input.taskId} was not found.`);
    }

    if (!user) {
      throw new NotFoundException(`User ${input.userId} was not found.`);
    }

    if (input.visitId) {
      const visit = await prisma.visit.findFirst({
        where: {
          id: input.visitId,
          taskId: input.taskId,
          organizationId: input.organizationId
        }
      });

      if (!visit) {
        throw new NotFoundException(`Visit ${input.visitId} was not found for task ${input.taskId}.`);
      }
    }

    return task;
  }

  private async assertReviewEvidence(
    organizationId: string,
    taskId: string,
    visitId: string | null,
    input: ReviewConsignationInput
  ) {
    const prisma = this.prisma as unknown as ConsignationsPrisma;

    for (const requirement of [
      { evidenceId: input.beforeEvidenceId, type: "before" },
      { evidenceId: input.afterEvidenceId, type: "after" }
    ] as const) {
      if (!requirement.evidenceId) {
        continue;
      }

      const evidence = await prisma.evidencePhoto.findFirst({
        where: {
          id: requirement.evidenceId,
          organizationId,
          taskId,
          ...(visitId ? { visitId } : {})
        },
        include: {
          mediaAsset: true
        }
      });

      if (!evidence) {
        throw new NotFoundException(`Evidence ${requirement.evidenceId} was not found for consignation review.`);
      }

      if (evidence.type !== requirement.type) {
        throw new BadRequestException(`Evidence ${requirement.evidenceId} must be a ${requirement.type} photo.`);
      }

      if (evidence.mediaAsset?.uploadStatus !== "uploaded") {
        throw new BadRequestException(`Evidence ${requirement.evidenceId} must finish uploading before consignation review.`);
      }
    }
  }

  private toConsignation(item: {
    id: string;
    organizationId: string;
    taskId: string;
    userId: string;
    visitId: string | null;
    note: string | null;
    status: string;
    preparedAt: string;
    reviewedAt: string | null;
    recipientEmails: string | null;
    emailSubject: string | null;
    emailBody: string | null;
    beforeEvidenceId: string | null;
    afterEvidenceId: string | null;
    sendFailureReason: string | null;
    failedAt: string | null;
    sentAt: string | null;
  }): Consignation {
    return {
      id: item.id,
      organizationId: item.organizationId,
      taskId: item.taskId,
      userId: item.userId,
      visitId: item.visitId ?? undefined,
      note: item.note ?? undefined,
      status: item.status as Consignation["status"],
      preparedAt: item.preparedAt,
      reviewedAt: item.reviewedAt ?? undefined,
      recipientEmails: item.recipientEmails ? item.recipientEmails.split(",").map((email) => email.trim()).filter(Boolean) : [],
      emailSubject: item.emailSubject ?? undefined,
      emailBody: item.emailBody ?? undefined,
      beforeEvidenceId: item.beforeEvidenceId ?? undefined,
      afterEvidenceId: item.afterEvidenceId ?? undefined,
      sendFailureReason: item.sendFailureReason ?? undefined,
      failedAt: item.failedAt ?? undefined,
      sentAt: item.sentAt ?? undefined
    };
  }

  private async buildOutgoingEmailBody(item: {
    organizationId: string;
    beforeEvidenceId: string | null;
    afterEvidenceId: string | null;
    emailBody: string | null;
  }) {
    const prisma = this.prisma as unknown as ConsignationsPrisma;
    const evidenceIds = [item.beforeEvidenceId, item.afterEvidenceId].filter(Boolean) as string[];
    const evidence = evidenceIds.length
      ? await prisma.evidencePhoto.findMany({
          where: {
            id: {
              in: evidenceIds
            },
            organizationId: item.organizationId
          },
          include: {
            mediaAsset: true
          }
        })
      : [];

    const links = evidence
      .map((entry: any) => {
        const storagePath = entry.mediaAsset?.originalStoragePath ?? entry.mediaAsset?.thumbnailStoragePath;
        if (!storagePath) {
          return null;
        }

        return `${entry.type}: ${this.objectStorageService.createSignedReadPath(storagePath)}`;
      })
      .filter(Boolean) as string[];

    const linkSection = links.length ? `\n\nEvidence links:\n${links.join("\n")}` : "";
    const textBody = `${item.emailBody?.trim() || ""}${linkSection}`.trim();
    const htmlBody = `${escapeHtml(item.emailBody?.trim() || "").replace(/\n/g, "<br />")}${
      links.length ? `<br /><br /><strong>Evidence links:</strong><br />${links.map((link) => `<a href="${escapeHtml(link)}">${escapeHtml(link)}</a>`).join("<br />")}` : ""
    }`;

    return {
      textBody,
      htmlBody
    };
  }

  private createId(prefix: string) {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}
