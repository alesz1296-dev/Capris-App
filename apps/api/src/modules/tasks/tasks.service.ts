import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type {
  CreateTaskInput,
  Difficulty,
  Priority,
  Task,
  TaskBootstrap,
  TaskMutationResult,
  TaskStatus,
  UpdateTaskInput,
  UpdateTaskStatusInput
} from "@capris/shared";
import { CatalogsService } from "../catalogs/catalogs.service";
import { EvidenceService } from "../evidence/evidence.service";
import { IdentityAccessService } from "../identity-access/identity-access.service";
import { PrismaService } from "../database/prisma.service";

const ALLOWED_STATUS_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  pending: ["in_progress", "completed"],
  in_progress: ["completed"],
  completed: []
};

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogsService: CatalogsService,
    private readonly identityAccessService: IdentityAccessService,
    private readonly evidenceService: EvidenceService
  ) {}

  async getTaskBootstrap(): Promise<TaskBootstrap> {
    const [tasks, users, catalogs] = await Promise.all([
      this.getTasks(),
      this.identityAccessService.getUsers(),
      this.catalogsService.getCatalogBootstrap()
    ]);

    return {
      tasks,
      users: users.map(({ permissions, ...user }) => user),
      provinces: catalogs.provinces,
      zones: catalogs.zones,
      clients: catalogs.clients,
      pointsOfSale: catalogs.pointsOfSale,
      activityTypes: catalogs.activityTypes,
      taskTypes: catalogs.taskTypes,
      workflowRules: catalogs.workflowRules
    };
  }

  async getTasks(): Promise<Task[]> {
    const tasks = await this.prisma.task.findMany({
      orderBy: [{ scheduledFor: "asc" }, { createdAt: "asc" }]
    });
    return tasks.map((task) => this.toTask(task));
  }

  async getTask(id: string): Promise<Task> {
    return this.toTask(await this.findTask(id));
  }

  async createTask(input: CreateTaskInput): Promise<Task> {
    this.assertRequiredString(input.organizationId, "organizationId");
    this.assertRequiredString(input.title, "title");
    this.assertRequiredString(input.requesterId, "requesterId");
    this.assertRequiredString(input.assigneeId, "assigneeId");
    this.assertRequiredString(input.scheduledFor, "scheduledFor");
    this.assertRequiredString(input.provinceId, "provinceId");
    this.assertRequiredString(input.zoneId, "zoneId");
    this.assertRequiredString(input.activityTypeId, "activityTypeId");
    this.assertRequiredString(input.taskTypeId, "taskTypeId");

    await this.assertTaskReferences({
      organizationId: input.organizationId,
      requesterId: input.requesterId,
      assigneeId: input.assigneeId,
      provinceId: input.provinceId,
      zoneId: input.zoneId,
      clientId: input.clientId,
      pointOfSaleId: input.pointOfSaleId,
      activityTypeId: input.activityTypeId,
      taskTypeId: input.taskTypeId
    });

    const task = await this.prisma.task.create({
      data: {
        id: this.createId("task"),
        organizationId: input.organizationId,
        title: input.title.trim(),
        requesterId: input.requesterId,
        assigneeId: input.assigneeId,
        scheduledFor: input.scheduledFor,
        provinceId: input.provinceId,
        zoneId: input.zoneId,
        clientId: input.clientId ?? null,
        pointOfSaleId: input.pointOfSaleId ?? null,
        activityTypeId: input.activityTypeId,
        taskTypeId: input.taskTypeId,
        status: input.status ?? "pending",
        priority: input.priority ?? "medium",
        difficulty: input.difficulty ?? "standard"
      }
    });

    return this.toTask(task);
  }

  async updateTask(id: string, input: UpdateTaskInput): Promise<TaskMutationResult> {
    const task = await this.findTask(id);

    const nextValues = {
      organizationId: task.organizationId,
      requesterId: input.requesterId ?? task.requesterId,
      assigneeId: input.assigneeId ?? task.assigneeId,
      provinceId: input.provinceId ?? task.provinceId,
      zoneId: input.zoneId ?? task.zoneId,
      clientId: input.clientId === undefined ? task.clientId ?? undefined : input.clientId,
      pointOfSaleId: input.pointOfSaleId === undefined ? task.pointOfSaleId ?? undefined : input.pointOfSaleId,
      activityTypeId: input.activityTypeId ?? task.activityTypeId,
      taskTypeId: input.taskTypeId ?? task.taskTypeId
    };

    await this.assertTaskReferences(nextValues);

    const updated = await this.prisma.task.update({
      where: { id },
      data: {
        title: input.title?.trim(),
        requesterId: nextValues.requesterId,
        assigneeId: nextValues.assigneeId,
        scheduledFor: input.scheduledFor,
        provinceId: nextValues.provinceId,
        zoneId: nextValues.zoneId,
        clientId: nextValues.clientId ?? null,
        pointOfSaleId: nextValues.pointOfSaleId ?? null,
        activityTypeId: nextValues.activityTypeId,
        taskTypeId: nextValues.taskTypeId,
        priority: input.priority,
        difficulty: input.difficulty
      }
    });

    return {
      item: this.toTask(updated),
      message: `Task ${updated.id} updated.`
    };
  }

  async updateTaskStatus(id: string, input: UpdateTaskStatusInput): Promise<TaskMutationResult> {
    const task = await this.findTask(id);

    if (task.status !== input.status && !ALLOWED_STATUS_TRANSITIONS[task.status as TaskStatus].includes(input.status)) {
      throw new BadRequestException(`Task ${task.id} cannot move from ${task.status} to ${input.status}.`);
    }

    if (input.status === "completed") {
      await this.evidenceService.assertTaskCompletionRequirements({
        id: task.id,
        organizationId: task.organizationId,
        taskTypeId: task.taskTypeId,
        activityTypeId: task.activityTypeId
      });
    }

    const updated = await this.prisma.task.update({
      where: { id },
      data: {
        status: input.status
      }
    });

    return {
      item: this.toTask(updated),
      message: `Task ${updated.id} status updated to ${updated.status}.`
    };
  }

  private async findTask(id: string) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) {
      throw new NotFoundException(`Task ${id} was not found.`);
    }
    return task;
  }

  private async assertTaskReferences(input: {
    organizationId: string;
    requesterId: string;
    assigneeId: string;
    provinceId: string;
    zoneId: string;
    clientId?: string;
    pointOfSaleId?: string;
    activityTypeId: string;
    taskTypeId: string;
  }) {
    const [requester, assignee, province, zone, activityType, taskType] = await Promise.all([
      this.prisma.user.findFirst({
        where: { id: input.requesterId, organizationId: input.organizationId, active: true }
      }),
      this.prisma.user.findFirst({
        where: { id: input.assigneeId, organizationId: input.organizationId, active: true }
      }),
      this.prisma.province.findFirst({
        where: { id: input.provinceId, organizationId: input.organizationId, active: true }
      }),
      this.prisma.zone.findFirst({
        where: { id: input.zoneId, organizationId: input.organizationId, provinceId: input.provinceId, active: true }
      }),
      this.prisma.activityType.findFirst({
        where: { id: input.activityTypeId, organizationId: input.organizationId, active: true }
      }),
      this.prisma.taskType.findFirst({
        where: { id: input.taskTypeId, organizationId: input.organizationId, active: true }
      })
    ]);

    if (!requester) {
      throw new NotFoundException(`Requester ${input.requesterId} was not found.`);
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

    if (!activityType) {
      throw new NotFoundException(`Activity type ${input.activityTypeId} was not found.`);
    }

    if (!taskType) {
      throw new NotFoundException(`Task type ${input.taskTypeId} was not found.`);
    }

    if (input.clientId) {
      const client = await this.prisma.client.findFirst({
        where: { id: input.clientId, organizationId: input.organizationId, active: true }
      });

      if (!client) {
        throw new NotFoundException(`Client ${input.clientId} was not found.`);
      }
    }

    if (input.pointOfSaleId) {
      const pointOfSale = await this.prisma.pointOfSale.findFirst({
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

  private toTask(task: {
    id: string;
    organizationId: string;
    title: string;
    requesterId: string;
    assigneeId: string;
    scheduledFor: string;
    provinceId: string;
    zoneId: string;
    clientId: string | null;
    pointOfSaleId: string | null;
    activityTypeId: string;
    taskTypeId: string;
    status: string;
    priority: string;
    difficulty: string;
  }): Task {
    return {
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
      status: task.status as TaskStatus,
      priority: task.priority as Priority,
      difficulty: task.difficulty as Difficulty
    };
  }

  private assertRequiredString(value: string, fieldName: string) {
    if (!value || !value.trim()) {
      throw new BadRequestException(`${fieldName} is required.`);
    }
  }

  private createId(prefix: string) {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
  }
}
