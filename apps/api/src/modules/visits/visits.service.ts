import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type {
  CreateVisitInput,
  Visit,
  VisitBootstrap,
  VisitCheckInInput,
  VisitCheckOutInput,
  VisitMutationResult,
  VisitStatus
} from "@capris/shared";
import { AuditService } from "../audit/audit.service";
import { CatalogsService } from "../catalogs/catalogs.service";
import { ActorAccessService } from "../auth/actor-access.service";
import { PrismaService } from "../database/prisma.service";
import { IdentityAccessService } from "../identity-access/identity-access.service";
import { TasksService } from "../tasks/tasks.service";
import type { AuthJwtPayload } from "../auth/auth-token.service";

@Injectable()
export class VisitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tasksService: TasksService,
    private readonly catalogsService: CatalogsService,
    private readonly identityAccessService: IdentityAccessService,
    private readonly actorAccessService: ActorAccessService,
    private readonly auditService: AuditService
  ) {}

  async getVisitBootstrap(actor?: AuthJwtPayload): Promise<VisitBootstrap> {
    const [visits, tasks, users, catalogs] = await Promise.all([
      this.getVisits(actor),
      this.tasksService.getTasks(actor),
      this.identityAccessService.getUsers(),
      this.catalogsService.getCatalogBootstrap()
    ]);
    const userIds = new Set(visits.map((visit) => visit.assigneeId));
    const provinceIds = new Set(visits.map((visit) => visit.provinceId));
    const zoneIds = new Set(visits.map((visit) => visit.zoneId));
    const pointOfSaleIds = new Set(visits.map((visit) => visit.pointOfSaleId).filter(Boolean));

    return {
      visits,
      tasks,
      users: users.map(({ permissions, ...user }: any) => user).filter((user: any) => userIds.has(user.id)),
      provinces: catalogs.provinces.filter((province) => provinceIds.has(province.id)),
      zones: catalogs.zones.filter((zone) => zoneIds.has(zone.id)),
      pointsOfSale: catalogs.pointsOfSale.filter((pointOfSale) => pointOfSaleIds.has(pointOfSale.id))
    };
  }

  async getVisits(actor?: AuthJwtPayload): Promise<Visit[]> {
    const visits = await this.prisma.visit.findMany({
      orderBy: [{ scheduledFor: "asc" }, { createdAt: "asc" }]
    });
    const normalized = visits.map((visit: any) => this.toVisit(visit));
    return this.actorAccessService.filterReadable(actor, normalized, (visit) => ({
      organizationId: visit.organizationId,
      assigneeId: visit.assigneeId,
      provinceId: visit.provinceId,
      zoneId: visit.zoneId
    }));
  }

  async getVisit(id: string, actor?: AuthJwtPayload): Promise<Visit> {
    const visit = this.toVisit(await this.findVisit(id));
    if (actor) {
      await this.actorAccessService.assertReadAccess(actor, {
        organizationId: visit.organizationId,
        assigneeId: visit.assigneeId,
        provinceId: visit.provinceId,
        zoneId: visit.zoneId
      });
    }
    return visit;
  }

  async createVisit(input: CreateVisitInput, actor?: AuthJwtPayload): Promise<Visit> {
    if (actor) {
      await this.actorAccessService.assertOperationAccess(actor, {
        organizationId: input.organizationId,
        assigneeId: input.assigneeId,
        provinceId: input.provinceId,
        zoneId: input.zoneId
      });
    }
    await this.assertVisitReferences(input);

    const visit = await this.prisma.visit.create({
      data: {
        id: this.createId("visit"),
        organizationId: input.organizationId,
        taskId: input.taskId,
        assigneeId: input.assigneeId,
        scheduledFor: input.scheduledFor,
        provinceId: input.provinceId,
        zoneId: input.zoneId,
        pointOfSaleId: input.pointOfSaleId ?? null,
        status: input.status ?? "scheduled"
      }
    });

    await this.auditService.recordAudit({
      organizationId: visit.organizationId,
      actorUserId: actor?.sub ?? visit.assigneeId,
      action: "visit.create",
      entityType: "visit",
      entityId: visit.id,
      metadata: {
        taskId: visit.taskId,
        scheduledFor: visit.scheduledFor
      }
    });

    return this.toVisit(visit);
  }

  async checkInVisit(id: string, input: VisitCheckInInput, actor?: AuthJwtPayload): Promise<VisitMutationResult> {
    const visit = await this.findVisit(id);
    if (actor) {
      await this.actorAccessService.assertOperationAccess(actor, {
        organizationId: visit.organizationId,
        assigneeId: visit.assigneeId,
        provinceId: visit.provinceId,
        zoneId: visit.zoneId
      });
    }

    if (visit.status !== "scheduled") {
      throw new BadRequestException(`Visit ${visit.id} cannot check in from ${visit.status}.`);
    }

    const updated = await this.prisma.visit.update({
      where: { id },
      data: {
        status: "checked_in",
        checkedInAt: input.checkedInAt,
        checkedInLatitude: input.checkedInLatitude,
        checkedInLongitude: input.checkedInLongitude
      }
    });

    await this.auditService.recordAudit({
      organizationId: updated.organizationId,
      actorUserId: actor?.sub,
      action: "visit.check_in",
      entityType: "visit",
      entityId: updated.id,
      metadata: {
        taskId: updated.taskId
      }
    });

    return {
      item: this.toVisit(updated),
      message: `Visit ${updated.id} checked in.`
    };
  }

  async checkOutVisit(id: string, input: VisitCheckOutInput, actor?: AuthJwtPayload): Promise<VisitMutationResult> {
    const visit = await this.findVisit(id);
    if (actor) {
      await this.actorAccessService.assertOperationAccess(actor, {
        organizationId: visit.organizationId,
        assigneeId: visit.assigneeId,
        provinceId: visit.provinceId,
        zoneId: visit.zoneId
      });
    }

    if (visit.status !== "checked_in") {
      throw new BadRequestException(`Visit ${visit.id} cannot check out from ${visit.status}.`);
    }

    const updated = await this.prisma.visit.update({
      where: { id },
      data: {
        status: "checked_out",
        checkedOutAt: input.checkedOutAt,
        checkedOutLatitude: input.checkedOutLatitude,
        checkedOutLongitude: input.checkedOutLongitude
      }
    });

    await this.auditService.recordAudit({
      organizationId: updated.organizationId,
      actorUserId: actor?.sub,
      action: "visit.check_out",
      entityType: "visit",
      entityId: updated.id,
      metadata: {
        taskId: updated.taskId
      }
    });

    return {
      item: this.toVisit(updated),
      message: `Visit ${updated.id} checked out.`
    };
  }

  private async assertVisitReferences(input: CreateVisitInput) {
    const [task, assignee, province, zone] = await Promise.all([
      this.prisma.task.findFirst({
        where: {
          id: input.taskId,
          organizationId: input.organizationId,
          assigneeId: input.assigneeId,
          provinceId: input.provinceId,
          zoneId: input.zoneId
        }
      }),
      this.prisma.user.findFirst({
        where: {
          id: input.assigneeId,
          organizationId: input.organizationId,
          active: true
        }
      }),
      this.prisma.province.findFirst({
        where: {
          id: input.provinceId,
          organizationId: input.organizationId,
          active: true
        }
      }),
      this.prisma.zone.findFirst({
        where: {
          id: input.zoneId,
          organizationId: input.organizationId,
          provinceId: input.provinceId,
          active: true
        }
      })
    ]);

    if (!task) {
      throw new NotFoundException(`Task ${input.taskId} was not found for the selected visit scope.`);
    }

    if (!assignee) {
      throw new NotFoundException(`Assignee ${input.assigneeId} was not found.`);
    }

    if (!province) {
      throw new NotFoundException(`Province ${input.provinceId} was not found.`);
    }

    if (!zone) {
      throw new NotFoundException(`Zone ${input.zoneId} was not found in province ${input.provinceId}.`);
    }

    if (input.pointOfSaleId) {
      const pointOfSale = await this.prisma.pointOfSale.findFirst({
        where: {
          id: input.pointOfSaleId,
          organizationId: input.organizationId,
          provinceId: input.provinceId,
          zoneId: input.zoneId,
          active: true
        }
      });

      if (!pointOfSale) {
        throw new NotFoundException(`Point of sale ${input.pointOfSaleId} was not found for the selected visit scope.`);
      }
    }
  }

  private async findVisit(id: string) {
    const visit = await this.prisma.visit.findUnique({ where: { id } });
    if (!visit) {
      throw new NotFoundException(`Visit ${id} was not found.`);
    }
    return visit;
  }

  private toVisit(visit: {
    id: string;
    organizationId: string;
    taskId: string;
    assigneeId: string;
    scheduledFor: string;
    provinceId: string;
    zoneId: string;
    pointOfSaleId: string | null;
    status: string;
    checkedInAt: string | null;
    checkedInLatitude: number | null;
    checkedInLongitude: number | null;
    checkedOutAt: string | null;
    checkedOutLatitude: number | null;
    checkedOutLongitude: number | null;
  }): Visit {
    return {
      id: visit.id,
      organizationId: visit.organizationId,
      taskId: visit.taskId,
      assigneeId: visit.assigneeId,
      scheduledFor: visit.scheduledFor,
      provinceId: visit.provinceId,
      zoneId: visit.zoneId,
      pointOfSaleId: visit.pointOfSaleId ?? undefined,
      status: visit.status as VisitStatus,
      checkedInAt: visit.checkedInAt ?? undefined,
      checkedInLatitude: visit.checkedInLatitude ?? undefined,
      checkedInLongitude: visit.checkedInLongitude ?? undefined,
      checkedOutAt: visit.checkedOutAt ?? undefined,
      checkedOutLatitude: visit.checkedOutLatitude ?? undefined,
      checkedOutLongitude: visit.checkedOutLongitude ?? undefined
    };
  }

  private createId(prefix: string) {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
  }
}
