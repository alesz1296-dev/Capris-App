import { Injectable, NotFoundException } from "@nestjs/common";
import type {
  AgendaEvent,
  AgendaEventMutationResult,
  CalendarBootstrap,
  CalendarEntry,
  CalendarQueryInput,
  CalendarWindow,
  CreateAgendaEventInput,
  Task,
  UpdateAgendaEventInput,
  Visit
} from "@capris/shared";
import { ActorAccessService } from "../auth/actor-access.service";
import type { AuthJwtPayload } from "../auth/auth-token.service";
import { IdentityAccessService } from "../identity-access/identity-access.service";
import { PrismaService } from "../database/prisma.service";

type CalendarPrisma = PrismaService & {
  agendaEvent: any;
  task: any;
  visit: any;
  clientRequest: any;
  team: any;
  user: any;
};

@Injectable()
export class CalendarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actorAccessService: ActorAccessService,
    private readonly identityAccessService: IdentityAccessService
  ) {}

  async getCalendarBootstrap(query: CalendarQueryInput): Promise<CalendarBootstrap> {
    const window = this.buildWindow(query);
    const prisma = this.prisma as unknown as CalendarPrisma;

    const [agendaEvents, tasks, visits, clientRequests, users, teams] = await Promise.all([
      prisma.agendaEvent.findMany({
        where: { startAt: { gte: window.startDate, lte: window.endDate } },
        orderBy: [{ startAt: "asc" }, { createdAt: "asc" }]
      }),
      prisma.task.findMany({ orderBy: [{ scheduledFor: "asc" }, { createdAt: "asc" }] }),
      prisma.visit.findMany({ orderBy: [{ scheduledFor: "asc" }, { createdAt: "asc" }] }),
      prisma.clientRequest.findMany({ orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }] }),
      this.identityAccessService.getUsers(),
      prisma.team.findMany({ where: { active: true }, orderBy: [{ name: "asc" }] })
    ]);

    const usersWithoutPermissions = users.map(({ permissions, ...user }: any) => user);
    const entries = [
      ...agendaEvents.map((item: any) => this.toAgendaEntry(item)),
      ...tasks.filter((item: any) => this.isDateInWindow(item.scheduledFor, window)).map((item: any) => this.toTaskEntry(item)),
      ...visits.filter((item: any) => this.isDateInWindow(item.scheduledFor, window)).map((item: any) => this.toVisitEntry(item)),
      ...clientRequests
        .filter((item: any) => this.isDateInWindow(item.dueDate, window))
        .map((item: any) => this.toClientRequestEntry(item))
    ].sort((left, right) => left.startAt.localeCompare(right.startAt));

    return {
      window,
      entries,
      agendaEvents: agendaEvents.map((item: any) => this.toAgendaEvent(item)),
      users: usersWithoutPermissions,
      teams
    };
  }

  async getAgendaEvents(): Promise<AgendaEvent[]> {
    const items = await (this.prisma as unknown as CalendarPrisma).agendaEvent.findMany({
      orderBy: [{ startAt: "asc" }, { createdAt: "asc" }]
    });

    return items.map((item: any) => this.toAgendaEvent(item));
  }

  async createAgendaEvent(input: CreateAgendaEventInput, actor?: AuthJwtPayload): Promise<AgendaEventMutationResult> {
    if (actor) {
      await this.actorAccessService.assertOperationAccess(actor, {
        organizationId: input.organizationId,
        ownerUserId: input.ownerUserId
      });
    }
    await this.assertAgendaReferences(input);
    const created = await (this.prisma as unknown as CalendarPrisma).agendaEvent.create({
      data: {
        id: this.createId("agenda"),
        organizationId: input.organizationId,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        startAt: input.startAt,
        endAt: input.endAt,
        allDay: input.allDay,
        scopeType: input.scopeType,
        scopeReferenceId: input.scopeReferenceId ?? null,
        ownerUserId: input.ownerUserId ?? null,
        teamId: input.teamId ?? null,
        colorToken: input.colorToken?.trim() || null,
        createdByUserId: input.createdByUserId
      }
    });

    return {
      item: this.toAgendaEvent(created),
      message: `Agenda event ${created.id} created.`
    };
  }

  async updateAgendaEvent(id: string, input: UpdateAgendaEventInput, actor?: AuthJwtPayload): Promise<AgendaEventMutationResult> {
    const prisma = this.prisma as unknown as CalendarPrisma;
    const existing = await prisma.agendaEvent.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Agenda event ${id} was not found.`);
    }
    if (actor) {
      await this.actorAccessService.assertOperationAccess(actor, {
        organizationId: existing.organizationId,
        ownerUserId: input.ownerUserId === undefined ? existing.ownerUserId ?? undefined : input.ownerUserId
      });
    }

    await this.assertAgendaReferences({
      organizationId: existing.organizationId,
      scopeType: input.scopeType ?? existing.scopeType,
      scopeReferenceId: input.scopeReferenceId === undefined ? existing.scopeReferenceId ?? undefined : input.scopeReferenceId,
      ownerUserId: input.ownerUserId === undefined ? existing.ownerUserId ?? undefined : input.ownerUserId,
      teamId: input.teamId === undefined ? existing.teamId ?? undefined : input.teamId,
      createdByUserId: existing.createdByUserId
    });

    const updated = await prisma.agendaEvent.update({
      where: { id },
      data: {
        title: input.title?.trim(),
        description: input.description?.trim(),
        startAt: input.startAt,
        endAt: input.endAt,
        allDay: input.allDay,
        scopeType: input.scopeType,
        scopeReferenceId: input.scopeReferenceId ?? undefined,
        ownerUserId: input.ownerUserId ?? undefined,
        teamId: input.teamId ?? undefined,
        colorToken: input.colorToken?.trim()
      }
    });

    return {
      item: this.toAgendaEvent(updated),
      message: `Agenda event ${updated.id} updated.`
    };
  }

  private async assertAgendaReferences(input: {
    organizationId: string;
    scopeType: string;
    scopeReferenceId?: string;
    ownerUserId?: string;
    teamId?: string;
    createdByUserId: string;
  }) {
    const prisma = this.prisma as unknown as CalendarPrisma;
    const [creator, owner, team] = await Promise.all([
      prisma.user.findFirst({ where: { id: input.createdByUserId, organizationId: input.organizationId, active: true } }),
      input.ownerUserId
        ? prisma.user.findFirst({ where: { id: input.ownerUserId, organizationId: input.organizationId, active: true } })
        : Promise.resolve(null),
      input.teamId
        ? prisma.team.findFirst({ where: { id: input.teamId, organizationId: input.organizationId, active: true } })
        : Promise.resolve(null)
    ]);

    if (!creator) {
      throw new NotFoundException(`User ${input.createdByUserId} was not found.`);
    }
    if (input.ownerUserId && !owner) {
      throw new NotFoundException(`Owner ${input.ownerUserId} was not found.`);
    }
    if (input.teamId && !team) {
      throw new NotFoundException(`Team ${input.teamId} was not found.`);
    }
    if (input.scopeType === "team" && input.scopeReferenceId) {
      const scopedTeam = await prisma.team.findFirst({
        where: { id: input.scopeReferenceId, organizationId: input.organizationId, active: true }
      });
      if (!scopedTeam) {
        throw new NotFoundException(`Team scope ${input.scopeReferenceId} was not found.`);
      }
    }
    if (input.scopeType === "user" && input.scopeReferenceId) {
      const scopedUser = await prisma.user.findFirst({
        where: { id: input.scopeReferenceId, organizationId: input.organizationId, active: true }
      });
      if (!scopedUser) {
        throw new NotFoundException(`User scope ${input.scopeReferenceId} was not found.`);
      }
    }
  }

  private buildWindow(query: CalendarQueryInput): CalendarWindow {
    const anchor = new Date(`${query.date}T00:00:00.000Z`);
    const start = new Date(anchor);
    const end = new Date(anchor);

    if (query.view === "week") {
      const day = start.getUTCDay();
      const distanceToMonday = (day + 6) % 7;
      start.setUTCDate(start.getUTCDate() - distanceToMonday);
      end.setTime(start.getTime());
      end.setUTCDate(start.getUTCDate() + 6);
    } else if (query.view === "month") {
      start.setUTCDate(1);
      end.setUTCMonth(start.getUTCMonth() + 1, 0);
    } else if (query.view === "year") {
      start.setUTCMonth(0, 1);
      end.setUTCMonth(11, 31);
    }

    return {
      view: query.view,
      anchorDate: query.date,
      startDate: this.formatDate(start),
      endDate: this.formatDate(end)
    };
  }

  private isDateInWindow(date: string, window: CalendarWindow) {
    return date >= window.startDate && date <= window.endDate;
  }

  private toAgendaEvent(item: any): AgendaEvent {
    return {
      id: item.id,
      organizationId: item.organizationId,
      title: item.title,
      description: item.description ?? undefined,
      startAt: item.startAt,
      endAt: item.endAt,
      allDay: item.allDay,
      scopeType: item.scopeType,
      scopeReferenceId: item.scopeReferenceId ?? undefined,
      ownerUserId: item.ownerUserId ?? undefined,
      teamId: item.teamId ?? undefined,
      colorToken: item.colorToken ?? undefined,
      createdByUserId: item.createdByUserId
    };
  }

  private toAgendaEntry(item: any): CalendarEntry {
    return {
      id: `agenda-${item.id}`,
      kind: "agenda_event",
      organizationId: item.organizationId,
      title: item.title,
      description: item.description ?? undefined,
      startAt: item.startAt,
      endAt: item.endAt,
      allDay: item.allDay,
      ownerUserId: item.ownerUserId ?? undefined,
      scopeType: item.scopeType,
      scopeReferenceId: item.scopeReferenceId ?? undefined,
      teamId: item.teamId ?? undefined,
      colorToken: item.colorToken ?? undefined
    };
  }

  private toTaskEntry(item: Task): CalendarEntry {
    return {
      id: `task-${item.id}`,
      kind: "task",
      organizationId: item.organizationId,
      title: item.title,
      startAt: `${item.scheduledFor}T08:00:00.000Z`,
      endAt: `${item.scheduledFor}T17:00:00.000Z`,
      allDay: true,
      ownerUserId: item.assigneeId,
      taskId: item.id,
      status: item.status,
      colorToken: "task"
    };
  }

  private toVisitEntry(item: Visit): CalendarEntry {
    return {
      id: `visit-${item.id}`,
      kind: "visit",
      organizationId: item.organizationId,
      title: `Visit ${item.id}`,
      startAt: `${item.scheduledFor}T09:00:00.000Z`,
      endAt: `${item.scheduledFor}T12:00:00.000Z`,
      allDay: false,
      ownerUserId: item.assigneeId,
      taskId: item.taskId,
      visitId: item.id,
      status: item.status,
      colorToken: "visit"
    };
  }

  private toClientRequestEntry(item: any): CalendarEntry {
    return {
      id: `request-${item.id}`,
      kind: "client_request",
      organizationId: item.organizationId,
      title: item.title,
      description: item.description ?? undefined,
      startAt: `${item.dueDate}T10:00:00.000Z`,
      endAt: `${item.dueDate}T11:00:00.000Z`,
      allDay: false,
      ownerUserId: item.ownerUserId,
      taskId: item.taskId ?? undefined,
      visitId: item.visitId ?? undefined,
      clientRequestId: item.id,
      status: item.status,
      colorToken: "request"
    };
  }

  private formatDate(value: Date) {
    return value.toISOString().slice(0, 10);
  }

  private createId(prefix: string) {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
  }
}
