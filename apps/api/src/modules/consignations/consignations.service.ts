import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type {
  Consignation,
  ConsignationMutationResult,
  PrepareConsignationInput,
  SendConsignationInput
} from "@capris/shared";
import { PrismaService } from "../database/prisma.service";

type ConsignationsPrisma = PrismaService & {
  consignation: any;
  task: any;
  user: any;
  visit: any;
};

@Injectable()
export class ConsignationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getConsignations(): Promise<Consignation[]> {
    const prisma = this.prisma as unknown as ConsignationsPrisma;
    const items = await prisma.consignation.findMany({
      orderBy: [{ preparedAt: "desc" }, { createdAt: "desc" }]
    });
    return items.map((item: any) => this.toConsignation(item));
  }

  async prepareConsignation(input: PrepareConsignationInput): Promise<ConsignationMutationResult> {
    await this.assertReferences(input);
    const created = await (this.prisma as unknown as ConsignationsPrisma).consignation.create({
      data: {
        id: this.createId("consignation"),
        organizationId: input.organizationId,
        taskId: input.taskId,
        userId: input.userId,
        visitId: input.visitId ?? null,
        note: input.note?.trim() || null,
        status: "prepared",
        preparedAt: input.preparedAt
      }
    });

    return {
      item: this.toConsignation(created),
      message: `Consignation ${created.id} prepared for task ${created.taskId}.`
    };
  }

  async sendConsignation(id: string, input: SendConsignationInput): Promise<ConsignationMutationResult> {
    const prisma = this.prisma as unknown as ConsignationsPrisma;
    const existing = await prisma.consignation.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Consignation ${id} was not found.`);
    }

    if (existing.status === "sent") {
      throw new BadRequestException(`Consignation ${id} has already been sent.`);
    }

    const updated = await prisma.consignation.update({
      where: { id },
      data: {
        status: "sent",
        sentAt: input.sentAt
      }
    });

    return {
      item: this.toConsignation(updated),
      message: `Consignation ${updated.id} marked as sent.`
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
      sentAt: item.sentAt ?? undefined
    };
  }

  private createId(prefix: string) {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
  }
}
