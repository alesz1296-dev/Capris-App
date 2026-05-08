import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type {
  Consignation,
  ConsignationMutationResult,
  FailConsignationInput,
  PrepareConsignationInput,
  ReviewConsignationInput,
  SendConsignationInput
} from "@capris/shared";
import { ActorAccessService } from "../auth/actor-access.service";
import type { AuthJwtPayload } from "../auth/auth-token.service";
import { PrismaService } from "../database/prisma.service";

type ConsignationsPrisma = PrismaService & {
  consignation: any;
  task: any;
  user: any;
  visit: any;
  evidencePhoto: any;
};

@Injectable()
export class ConsignationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actorAccessService: ActorAccessService
  ) {}

  async getConsignations(): Promise<Consignation[]> {
    const prisma = this.prisma as unknown as ConsignationsPrisma;
    const items = await prisma.consignation.findMany({
      orderBy: [{ preparedAt: "desc" }, { createdAt: "desc" }]
    });
    return items.map((item: any) => this.toConsignation(item));
  }

  async prepareConsignation(input: PrepareConsignationInput, actor?: AuthJwtPayload): Promise<ConsignationMutationResult> {
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

    return {
      item: this.toConsignation(created),
      message: `Consignation ${created.id} prepared for task ${created.taskId}.`
    };
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

    return {
      item: this.toConsignation(updated),
      message: `Consignation ${updated.id} reviewed and ready to send.`
    };
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

    if (existing.status === "sent") {
      throw new BadRequestException(`Consignation ${id} has already been sent.`);
    }

    const updated = await prisma.consignation.update({
      where: { id },
      data: {
        status: "sent",
        sendFailureReason: null,
        failedAt: null,
        sentAt: input.sentAt
      }
    });

    return {
      item: this.toConsignation(updated),
      message: `Consignation ${updated.id} marked as sent.`
    };
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

    return {
      item: this.toConsignation(updated),
      message: `Consignation ${updated.id} marked as failed.`
    };
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

  private createId(prefix: string) {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
  }
}
