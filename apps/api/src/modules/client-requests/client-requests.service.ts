import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type {
  ClientRequest,
  ClientRequestBootstrap,
  ClientRequestMutationResult,
  ClientRequestStatus,
  CreateClientRequestInput,
  Priority,
  Task,
  UpdateClientRequestInput,
  UpdateClientRequestStatusInput
} from "@capris/shared";
import { ActorAccessService } from "../auth/actor-access.service";
import type { AuthJwtPayload } from "../auth/auth-token.service";
import { CatalogsService } from "../catalogs/catalogs.service";
import { IdentityAccessService } from "../identity-access/identity-access.service";
import { PrismaService } from "../database/prisma.service";

const CLOSED_STATUSES: ClientRequestStatus[] = ["resolved", "closed"];

type ClientRequestPrisma = PrismaService & {
  clientRequest: any;
  user: any;
  client: any;
  province: any;
  zone: any;
  pointOfSale: any;
  task: any;
  visit: any;
};

@Injectable()
export class ClientRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actorAccessService: ActorAccessService,
    private readonly identityAccessService: IdentityAccessService,
    private readonly catalogsService: CatalogsService
  ) {}

  async getClientRequestBootstrap(actor?: AuthJwtPayload): Promise<ClientRequestBootstrap> {
    const [requests, users, catalogs, tasks] = await Promise.all([
      this.getClientRequests(actor),
      this.identityAccessService.getUsers(),
      this.catalogsService.getCatalogBootstrap(),
      this.loadVisibleTasks(actor)
    ]);

    const userIds = new Set(requests.map((request) => request.ownerUserId));
    const clientIds = new Set(requests.map((request) => request.clientId).filter(Boolean));
    const provinceIds = new Set(requests.map((request) => request.provinceId).filter(Boolean));
    const zoneIds = new Set(requests.map((request) => request.zoneId).filter(Boolean));
    const pointOfSaleIds = new Set(requests.map((request) => request.pointOfSaleId).filter(Boolean));

    return {
      requests,
      users: users.map(({ permissions, ...user }) => user).filter((user) => userIds.has(user.id)),
      clients: catalogs.clients.filter((client) => clientIds.has(client.id)),
      provinces: catalogs.provinces.filter((province) => provinceIds.has(province.id)),
      zones: catalogs.zones.filter((zone) => zoneIds.has(zone.id)),
      pointsOfSale: catalogs.pointsOfSale.filter((pointOfSale) => pointOfSaleIds.has(pointOfSale.id)),
      tasks
    };
  }

  async getClientRequests(actor?: AuthJwtPayload): Promise<ClientRequest[]> {
    const items = await (this.prisma as unknown as ClientRequestPrisma).clientRequest.findMany({
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }]
    });

    const normalized = items.map((item: any) => this.toClientRequest(item));
    return this.actorAccessService.filterReadable(actor, normalized, (item) => ({
      organizationId: item.organizationId,
      ownerUserId: item.ownerUserId,
      provinceId: item.provinceId,
      zoneId: item.zoneId,
      clientId: item.clientId
    }));
  }

  async createClientRequest(input: CreateClientRequestInput, actor?: AuthJwtPayload): Promise<ClientRequestMutationResult> {
    if (actor) {
      await this.actorAccessService.assertOperationAccess(actor, {
        organizationId: input.organizationId,
        ownerUserId: input.ownerUserId,
        provinceId: input.provinceId,
        zoneId: input.zoneId,
        clientId: input.clientId
      });
    }
    await this.assertReferences(input);
    const created = await (this.prisma as unknown as ClientRequestPrisma).clientRequest.create({
      data: {
        id: this.createId("request"),
        organizationId: input.organizationId,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        requesterName: input.requesterName.trim(),
        requesterEmail: input.requesterEmail?.trim() || null,
        ownerUserId: input.ownerUserId,
        clientId: input.clientId ?? null,
        provinceId: input.provinceId ?? null,
        zoneId: input.zoneId ?? null,
        pointOfSaleId: input.pointOfSaleId ?? null,
        taskId: input.taskId ?? null,
        visitId: null,
        status: input.status ?? "open",
        dueDate: input.dueDate,
        openedAt: input.openedAt,
        priority: input.priority ?? "medium"
      }
    });

    return {
      item: this.toClientRequest(created),
      message: `Client request ${created.id} created.`
    };
  }

  async updateClientRequest(id: string, input: UpdateClientRequestInput, actor?: AuthJwtPayload): Promise<ClientRequestMutationResult> {
    const prisma = this.prisma as unknown as ClientRequestPrisma;
    const existing = await prisma.clientRequest.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Client request ${id} was not found.`);
    }
    if (actor) {
      await this.actorAccessService.assertOperationAccess(actor, {
        organizationId: existing.organizationId,
        ownerUserId: input.ownerUserId ?? existing.ownerUserId,
        provinceId: input.provinceId === undefined ? existing.provinceId ?? undefined : input.provinceId,
        zoneId: input.zoneId === undefined ? existing.zoneId ?? undefined : input.zoneId,
        clientId: input.clientId === undefined ? existing.clientId ?? undefined : input.clientId
      });
    }

    await this.assertReferences({
      organizationId: existing.organizationId,
      title: input.title ?? existing.title,
      description: input.description ?? existing.description ?? undefined,
      requesterName: input.requesterName ?? existing.requesterName,
      requesterEmail: input.requesterEmail === undefined ? existing.requesterEmail ?? undefined : input.requesterEmail,
      ownerUserId: input.ownerUserId ?? existing.ownerUserId,
      clientId: input.clientId === undefined ? existing.clientId ?? undefined : input.clientId,
      provinceId: input.provinceId === undefined ? existing.provinceId ?? undefined : input.provinceId,
      zoneId: input.zoneId === undefined ? existing.zoneId ?? undefined : input.zoneId,
      pointOfSaleId: input.pointOfSaleId === undefined ? existing.pointOfSaleId ?? undefined : input.pointOfSaleId,
      taskId: input.taskId === undefined ? existing.taskId ?? undefined : input.taskId,
      status: existing.status,
      dueDate: input.dueDate ?? existing.dueDate,
      openedAt: existing.openedAt,
      priority: input.priority ?? existing.priority
    });

    const updated = await prisma.clientRequest.update({
      where: { id },
      data: {
        title: input.title?.trim(),
        description: input.description?.trim(),
        requesterName: input.requesterName?.trim(),
        requesterEmail: input.requesterEmail?.trim(),
        ownerUserId: input.ownerUserId,
        clientId: input.clientId ?? undefined,
        provinceId: input.provinceId ?? undefined,
        zoneId: input.zoneId ?? undefined,
        pointOfSaleId: input.pointOfSaleId ?? undefined,
        taskId: input.taskId ?? undefined,
        dueDate: input.dueDate,
        priority: input.priority
      }
    });

    return {
      item: this.toClientRequest(updated),
      message: `Client request ${updated.id} updated.`
    };
  }

  async updateClientRequestStatus(id: string, input: UpdateClientRequestStatusInput, actor?: AuthJwtPayload): Promise<ClientRequestMutationResult> {
    const prisma = this.prisma as unknown as ClientRequestPrisma;
    const existing = await prisma.clientRequest.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Client request ${id} was not found.`);
    }
    if (actor) {
      await this.actorAccessService.assertOperationAccess(actor, {
        organizationId: existing.organizationId,
        ownerUserId: existing.ownerUserId,
        provinceId: existing.provinceId ?? undefined,
        zoneId: existing.zoneId ?? undefined,
        clientId: existing.clientId ?? undefined
      });
    }

    if (input.status === "resolved" && !input.resolvedAt && !existing.resolvedAt) {
      throw new BadRequestException("resolvedAt is required when moving a client request to resolved.");
    }

    if (input.status === "closed" && !input.closedAt && !existing.closedAt) {
      throw new BadRequestException("closedAt is required when moving a client request to closed.");
    }

    const updated = await prisma.clientRequest.update({
      where: { id },
      data: {
        status: input.status,
        resolvedAt: input.status === "resolved" ? input.resolvedAt ?? existing.resolvedAt : existing.resolvedAt,
        closedAt: input.status === "closed" ? input.closedAt ?? existing.closedAt : existing.closedAt
      }
    });

    return {
      item: this.toClientRequest(updated),
      message: `Client request ${updated.id} status updated to ${updated.status}.`
    };
  }

  private async assertReferences(input: CreateClientRequestInput | (UpdateClientRequestInput & { organizationId: string; requesterName: string; dueDate: string; title: string; ownerUserId: string; openedAt: string; priority: Priority; status?: ClientRequestStatus })) {
    const prisma = this.prisma as unknown as ClientRequestPrisma;
    const [owner, client, province, task] = await Promise.all([
      prisma.user.findFirst({ where: { id: input.ownerUserId, organizationId: input.organizationId, active: true } }),
      input.clientId ? prisma.client.findFirst({ where: { id: input.clientId, organizationId: input.organizationId, active: true } }) : Promise.resolve(null),
      input.provinceId ? prisma.province.findFirst({ where: { id: input.provinceId, organizationId: input.organizationId, active: true } }) : Promise.resolve(null),
      input.taskId ? prisma.task.findFirst({ where: { id: input.taskId, organizationId: input.organizationId } }) : Promise.resolve(null)
    ]);

    if (!owner) {
      throw new NotFoundException(`Owner ${input.ownerUserId} was not found.`);
    }
    if (input.clientId && !client) {
      throw new NotFoundException(`Client ${input.clientId} was not found.`);
    }
    if (input.provinceId && !province) {
      throw new NotFoundException(`Province ${input.provinceId} was not found.`);
    }
    if (input.taskId && !task) {
      throw new NotFoundException(`Task ${input.taskId} was not found.`);
    }
    if (input.zoneId) {
      const zone = await prisma.zone.findFirst({
        where: {
          id: input.zoneId,
          organizationId: input.organizationId,
          provinceId: input.provinceId,
          active: true
        }
      });
      if (!zone) {
        throw new NotFoundException(`Zone ${input.zoneId} was not found for the selected province.`);
      }
    }
    if (input.pointOfSaleId) {
      const pointOfSale = await prisma.pointOfSale.findFirst({
        where: {
          id: input.pointOfSaleId,
          organizationId: input.organizationId,
          provinceId: input.provinceId,
          zoneId: input.zoneId,
          clientId: input.clientId,
          active: true
        }
      });
      if (!pointOfSale) {
        throw new NotFoundException(`Point of sale ${input.pointOfSaleId} was not found for the selected scope.`);
      }
    }
  }

  private toClientRequest(item: any): ClientRequest {
    const today = new Date().toISOString().slice(0, 10);
    const agingDays = this.daysBetween(item.openedAt.slice(0, 10), today);
    const overdue = !CLOSED_STATUSES.includes(item.status as ClientRequestStatus) && item.dueDate < today;

    return {
      id: item.id,
      organizationId: item.organizationId,
      title: item.title,
      description: item.description ?? undefined,
      requesterName: item.requesterName,
      requesterEmail: item.requesterEmail ?? undefined,
      ownerUserId: item.ownerUserId,
      clientId: item.clientId ?? undefined,
      provinceId: item.provinceId ?? undefined,
      zoneId: item.zoneId ?? undefined,
      pointOfSaleId: item.pointOfSaleId ?? undefined,
      taskId: item.taskId ?? undefined,
      status: item.status as ClientRequestStatus,
      dueDate: item.dueDate,
      openedAt: item.openedAt,
      resolvedAt: item.resolvedAt ?? undefined,
      closedAt: item.closedAt ?? undefined,
      agingDays,
      overdue,
      priority: item.priority as Priority
    };
  }

  private daysBetween(startDate: string, endDate: string) {
    const start = new Date(`${startDate}T00:00:00.000Z`).getTime();
    const end = new Date(`${endDate}T00:00:00.000Z`).getTime();
    return Math.max(0, Math.floor((end - start) / 86400000));
  }

  private createId(prefix: string) {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
  }

  private async loadVisibleTasks(actor?: AuthJwtPayload): Promise<Task[]> {
    const tasks = await (this.prisma as unknown as ClientRequestPrisma).task.findMany({
      orderBy: [{ scheduledFor: "asc" }, { createdAt: "asc" }]
    });

    const normalized: Task[] = tasks.map((task: any) => ({
      id: task.id,
      organizationId: task.organizationId,
      title: task.title,
      requesterId: task.requesterId,
      assigneeId: task.assigneeId,
      scheduledFor: task.scheduledFor,
      provinceId: task.provinceId,
      zoneId: task.zoneId,
      clientId: task.clientId ?? undefined,
      pointOfSaleId: task.pointOfSaleId ?? undefined,
      activityTypeId: task.activityTypeId,
      taskTypeId: task.taskTypeId,
      status: task.status,
      priority: task.priority,
      difficulty: task.difficulty
    }));

    return this.actorAccessService.filterReadable(actor, normalized, (task) => ({
      organizationId: task.organizationId,
      assigneeId: task.assigneeId,
      provinceId: task.provinceId,
      zoneId: task.zoneId,
      clientId: task.clientId
    }));
  }
}
