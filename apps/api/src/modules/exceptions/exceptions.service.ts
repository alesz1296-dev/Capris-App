import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type {
  CreateExceptionInput,
  ExceptionBootstrap,
  ExceptionMutationResult,
  ExceptionRecord,
  ExceptionStatus,
  ReviewExceptionInput
} from "@capris/shared";
import { AuditService } from "../audit/audit.service";
import { ActorAccessService } from "../auth/actor-access.service";
import type { AuthJwtPayload } from "../auth/auth-token.service";
import { IdentityAccessService } from "../identity-access/identity-access.service";
import { PrismaService } from "../database/prisma.service";

type ExceptionsPrisma = PrismaService & {
  exceptionRecord: any;
  user: any;
  task: any;
  visit: any;
  mediaAsset: any;
  consignation: any;
};

@Injectable()
export class ExceptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly identityAccessService: IdentityAccessService,
    private readonly actorAccessService: ActorAccessService,
    private readonly auditService: AuditService
  ) {}

  async getExceptionBootstrap(): Promise<ExceptionBootstrap> {
    const prisma = this.prisma as unknown as ExceptionsPrisma;
    const [exceptions, users, tasks, visits, mediaAssets, consignations] = await Promise.all([
      this.getExceptions(),
      this.identityAccessService.getUsers(),
      prisma.task.findMany({
        orderBy: [{ scheduledFor: "desc" }, { createdAt: "desc" }],
        select: { id: true, title: true, status: true }
      }),
      prisma.visit.findMany({
        orderBy: [{ scheduledFor: "desc" }, { createdAt: "desc" }],
        select: { id: true, taskId: true, status: true }
      }),
      prisma.mediaAsset.findMany({
        orderBy: [{ createdAt: "desc" }],
        select: { id: true, fileName: true, uploadStatus: true }
      }),
      prisma.consignation.findMany({
        orderBy: [{ preparedAt: "desc" }],
        select: { id: true, taskId: true, status: true }
      })
    ]);

    return {
      exceptions,
      users: users.map(({ permissions, ...user }: any) => user),
      tasks,
      visits,
      mediaAssets,
      consignations
    };
  }

  async getExceptions(): Promise<ExceptionRecord[]> {
    const items = await (this.prisma as unknown as ExceptionsPrisma).exceptionRecord.findMany({
      orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }]
    });

    return items.map((item: any) => this.toException(item));
  }

  async createException(input: CreateExceptionInput, actor?: AuthJwtPayload): Promise<ExceptionMutationResult> {
    const references = await this.assertCreateReferences(input);
    if (actor) {
      await this.actorAccessService.assertOperationAccess(actor, {
        organizationId: input.organizationId,
        userId: input.submittedByUserId,
        assigneeId: references.task?.assigneeId,
        provinceId: references.task?.provinceId ?? references.visit?.provinceId,
        zoneId: references.task?.zoneId ?? references.visit?.zoneId,
        clientId: references.task?.clientId ?? undefined
      });
    }
    const created = await (this.prisma as unknown as ExceptionsPrisma).exceptionRecord.create({
      data: {
        id: this.createId("exception"),
        organizationId: input.organizationId,
        type: input.type,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        submittedByUserId: input.submittedByUserId,
        taskId: input.taskId ?? null,
        visitId: input.visitId ?? null,
        mediaAssetId: input.mediaAssetId ?? null,
        consignationId: input.consignationId ?? null,
        status: "submitted",
        submittedAt: input.submittedAt
      }
    });

    await this.auditService.recordAudit({
      organizationId: created.organizationId,
      actorUserId: actor?.sub ?? created.submittedByUserId,
      action: "exception.submit",
      entityType: "exception",
      entityId: created.id,
      metadata: {
        type: created.type
      }
    });

    return {
      item: this.toException(created),
      message: `Exception ${created.id} submitted.`
    };
  }

  async reviewException(id: string, input: ReviewExceptionInput, actor?: AuthJwtPayload): Promise<ExceptionMutationResult> {
    const prisma = this.prisma as unknown as ExceptionsPrisma;
    const existing = await prisma.exceptionRecord.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException(`Exception ${id} was not found.`);
    }

    if (actor) {
      const [task, visit] = await Promise.all([
        existing.taskId ? prisma.task.findFirst({ where: { id: existing.taskId } }) : Promise.resolve(null),
        existing.visitId ? prisma.visit.findFirst({ where: { id: existing.visitId } }) : Promise.resolve(null)
      ]);

      await this.actorAccessService.assertOperationAccess(actor, {
        organizationId: existing.organizationId,
        userId: input.reviewedByUserId,
        assigneeId: task?.assigneeId,
        provinceId: task?.provinceId ?? visit?.provinceId,
        zoneId: task?.zoneId ?? visit?.zoneId,
        clientId: task?.clientId ?? undefined
      });
    }

    if (existing.status !== "submitted" && existing.status !== "needs_correction") {
      throw new BadRequestException(`Exception ${id} is already finalized as ${existing.status}.`);
    }

    const reviewer = await prisma.user.findFirst({
      where: {
        id: input.reviewedByUserId,
        organizationId: existing.organizationId,
        active: true,
        role: { in: ["admin", "supervisor"] }
      }
    });

    if (!reviewer) {
      throw new NotFoundException(`Reviewer ${input.reviewedByUserId} was not found.`);
    }

    if ((input.status === "rejected" || input.status === "needs_correction") && !input.reviewNote?.trim()) {
      throw new BadRequestException("reviewNote is required when rejecting an exception or requesting correction.");
    }

    const updated = await prisma.exceptionRecord.update({
      where: { id },
      data: {
        status: input.status,
        reviewedByUserId: input.reviewedByUserId,
        reviewedAt: input.reviewedAt,
        reviewNote: input.reviewNote?.trim() || null
      }
    });

    await this.auditService.recordAudit({
      organizationId: updated.organizationId,
      actorUserId: actor?.sub ?? updated.reviewedByUserId ?? undefined,
      action: "exception.review",
      entityType: "exception",
      entityId: updated.id,
      metadata: {
        status: updated.status
      }
    });

    return {
      item: this.toException(updated),
      message: `Exception ${updated.id} reviewed as ${updated.status}.`
    };
  }

  private async assertCreateReferences(input: CreateExceptionInput) {
    const prisma = this.prisma as unknown as ExceptionsPrisma;
    const [submittedBy, task, visit, mediaAsset, consignation] = await Promise.all([
      prisma.user.findFirst({
        where: { id: input.submittedByUserId, organizationId: input.organizationId, active: true }
      }),
      input.taskId
        ? prisma.task.findFirst({ where: { id: input.taskId, organizationId: input.organizationId } })
        : Promise.resolve(null),
      input.visitId
        ? prisma.visit.findFirst({ where: { id: input.visitId, organizationId: input.organizationId } })
        : Promise.resolve(null),
      input.mediaAssetId
        ? prisma.mediaAsset.findFirst({ where: { id: input.mediaAssetId, organizationId: input.organizationId } })
        : Promise.resolve(null),
      input.consignationId
        ? prisma.consignation.findFirst({ where: { id: input.consignationId, organizationId: input.organizationId } })
        : Promise.resolve(null)
    ]);

    if (!submittedBy) {
      throw new NotFoundException(`Submitter ${input.submittedByUserId} was not found.`);
    }
    if (input.taskId && !task) {
      throw new NotFoundException(`Task ${input.taskId} was not found.`);
    }
    if (input.visitId && !visit) {
      throw new NotFoundException(`Visit ${input.visitId} was not found.`);
    }
    if (input.mediaAssetId && !mediaAsset) {
      throw new NotFoundException(`Media asset ${input.mediaAssetId} was not found.`);
    }
    if (input.consignationId && !consignation) {
      throw new NotFoundException(`Consignation ${input.consignationId} was not found.`);
    }

    if (!input.taskId && !input.visitId && !input.mediaAssetId && !input.consignationId) {
      throw new BadRequestException("At least one linked task, visit, media asset, or consignation is required.");
    }

    if (visit && task && visit.taskId !== task.id) {
      throw new BadRequestException("Visit does not belong to the selected task.");
    }

    if (consignation && task && consignation.taskId !== task.id) {
      throw new BadRequestException("Consignation does not belong to the selected task.");
    }

    if (consignation && visit && consignation.visitId && consignation.visitId !== visit.id) {
      throw new BadRequestException("Consignation does not belong to the selected visit.");
    }

    return { task, visit, mediaAsset, consignation };
  }

  private toException(item: {
    id: string;
    organizationId: string;
    type: string;
    title: string;
    description: string | null;
    submittedByUserId: string;
    reviewedByUserId: string | null;
    taskId: string | null;
    visitId: string | null;
    mediaAssetId: string | null;
    consignationId: string | null;
    status: string;
    submittedAt: string;
    reviewedAt: string | null;
    reviewNote: string | null;
  }): ExceptionRecord {
    return {
      id: item.id,
      organizationId: item.organizationId,
      type: item.type as ExceptionRecord["type"],
      title: item.title,
      description: item.description ?? undefined,
      submittedByUserId: item.submittedByUserId,
      reviewedByUserId: item.reviewedByUserId ?? undefined,
      taskId: item.taskId ?? undefined,
      visitId: item.visitId ?? undefined,
      mediaAssetId: item.mediaAssetId ?? undefined,
      consignationId: item.consignationId ?? undefined,
      status: item.status as ExceptionStatus,
      submittedAt: item.submittedAt,
      reviewedAt: item.reviewedAt ?? undefined,
      reviewNote: item.reviewNote ?? undefined
    };
  }

  private createId(prefix: string) {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
  }
}
