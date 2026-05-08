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
import { CatalogsService } from "../catalogs/catalogs.service";
import { PrismaService } from "../database/prisma.service";
import { IdentityAccessService } from "../identity-access/identity-access.service";
import { TasksService } from "../tasks/tasks.service";

@Injectable()
export class VisitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tasksService: TasksService,
    private readonly catalogsService: CatalogsService,
    private readonly identityAccessService: IdentityAccessService
  ) {}

  async getVisitBootstrap(): Promise<VisitBootstrap> {
    const [visits, tasks, users, catalogs] = await Promise.all([
      this.getVisits(),
      this.tasksService.getTasks(),
      this.identityAccessService.getUsers(),
      this.catalogsService.getCatalogBootstrap()
    ]);

    return {
      visits,
      tasks,
      users: users.map(({ permissions, ...user }) => user),
      provinces: catalogs.provinces,
      zones: catalogs.zones,
      pointsOfSale: catalogs.pointsOfSale
    };
  }

  async getVisits(): Promise<Visit[]> {
    const visits = await this.prisma.visit.findMany({
      orderBy: [{ scheduledFor: "asc" }, { createdAt: "asc" }]
    });
    return visits.map((visit) => this.toVisit(visit));
  }

  async getVisit(id: string): Promise<Visit> {
    return this.toVisit(await this.findVisit(id));
  }

  async createVisit(input: CreateVisitInput): Promise<Visit> {
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

    return this.toVisit(visit);
  }

  async checkInVisit(id: string, input: VisitCheckInInput): Promise<VisitMutationResult> {
    const visit = await this.findVisit(id);

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

    return {
      item: this.toVisit(updated),
      message: `Visit ${updated.id} checked in.`
    };
  }

  async checkOutVisit(id: string, input: VisitCheckOutInput): Promise<VisitMutationResult> {
    const visit = await this.findVisit(id);

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
