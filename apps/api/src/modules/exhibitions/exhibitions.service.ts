import { Injectable, NotFoundException } from "@nestjs/common";
import type {
  CreateExhibitionInstallationInput,
  ExhibitionInstallation,
  ExhibitionMutationResult
} from "@capris/shared";
import { ActorAccessService } from "../auth/actor-access.service";
import type { AuthJwtPayload } from "../auth/auth-token.service";
import { PrismaService } from "../database/prisma.service";

type ExhibitionsPrisma = PrismaService & {
  exhibitionInstallation: any;
  task: any;
  user: any;
  visit: any;
  pointOfSale: any;
};

@Injectable()
export class ExhibitionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actorAccessService: ActorAccessService
  ) {}

  async getExhibitions(): Promise<ExhibitionInstallation[]> {
    const items = await (this.prisma as unknown as ExhibitionsPrisma).exhibitionInstallation.findMany({
      orderBy: [{ recordedAt: "desc" }, { createdAt: "desc" }]
    });

    return items.map((item: any) => this.toExhibition(item));
  }

  async createExhibition(input: CreateExhibitionInstallationInput, actor?: AuthJwtPayload): Promise<ExhibitionMutationResult> {
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
    const created = await (this.prisma as unknown as ExhibitionsPrisma).exhibitionInstallation.create({
      data: {
        id: this.createId("exhibition"),
        organizationId: input.organizationId,
        taskId: input.taskId,
        userId: input.userId,
        visitId: input.visitId ?? null,
        pointOfSaleId: input.pointOfSaleId ?? null,
        quantity: input.quantity,
        note: input.note?.trim() || null,
        recordedAt: input.recordedAt
      }
    });

    return {
      item: this.toExhibition(created),
      message: `Exhibition installation ${created.id} recorded for task ${created.taskId}.`
    };
  }

  private async assertReferences(input: CreateExhibitionInstallationInput) {
    const prisma = this.prisma as unknown as ExhibitionsPrisma;
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
        where: { id: input.visitId, taskId: input.taskId, organizationId: input.organizationId }
      });
      if (!visit) {
        throw new NotFoundException(`Visit ${input.visitId} was not found for task ${input.taskId}.`);
      }
    }

    if (input.pointOfSaleId) {
      const pointOfSale = await prisma.pointOfSale.findFirst({
        where: { id: input.pointOfSaleId, organizationId: input.organizationId, active: true }
      });
      if (!pointOfSale) {
        throw new NotFoundException(`Point of sale ${input.pointOfSaleId} was not found.`);
      }
    }

    return task;
  }

  private toExhibition(item: {
    id: string;
    organizationId: string;
    taskId: string;
    userId: string;
    visitId: string | null;
    pointOfSaleId: string | null;
    quantity: number;
    note: string | null;
    recordedAt: string;
  }): ExhibitionInstallation {
    return {
      id: item.id,
      organizationId: item.organizationId,
      taskId: item.taskId,
      userId: item.userId,
      visitId: item.visitId ?? undefined,
      pointOfSaleId: item.pointOfSaleId ?? undefined,
      quantity: item.quantity,
      note: item.note ?? undefined,
      recordedAt: item.recordedAt
    };
  }

  private createId(prefix: string) {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
  }
}
