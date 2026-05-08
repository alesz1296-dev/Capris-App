import { Injectable, NotFoundException } from "@nestjs/common";
import type {
  Comment,
  CommentMutationResult,
  CreateCommentInput,
  CreateObservationInput,
  Observation,
  ObservationMutationResult
} from "@capris/shared";
import { ActorAccessService } from "../auth/actor-access.service";
import type { AuthJwtPayload } from "../auth/auth-token.service";
import { PrismaService } from "../database/prisma.service";

type NotesPrisma = PrismaService & {
  comment: any;
  observation: any;
  task: any;
  user: any;
};

@Injectable()
export class NotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actorAccessService: ActorAccessService
  ) {}

  async getComments(): Promise<Comment[]> {
    const prisma = this.prisma as unknown as NotesPrisma;
    const items = await prisma.comment.findMany({
      orderBy: [{ createdAt: "desc" }]
    });
    return items.map((item: any) => this.toComment(item));
  }

  async getObservations(): Promise<Observation[]> {
    const prisma = this.prisma as unknown as NotesPrisma;
    const items = await prisma.observation.findMany({
      orderBy: [{ createdAt: "desc" }]
    });
    return items.map((item: any) => this.toObservation(item));
  }

  async createComment(input: CreateCommentInput, actor?: AuthJwtPayload): Promise<CommentMutationResult> {
    const task = await this.assertReferences(input.organizationId, input.taskId, input.userId);
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
    const created = await (this.prisma as unknown as NotesPrisma).comment.create({
      data: {
        id: this.createId("comment"),
        organizationId: input.organizationId,
        taskId: input.taskId,
        userId: input.userId,
        body: input.body.trim(),
        createdAt: input.createdAt
      }
    });

    return {
      item: this.toComment(created),
      message: `Comment ${created.id} created for task ${created.taskId}.`
    };
  }

  async createObservation(input: CreateObservationInput, actor?: AuthJwtPayload): Promise<ObservationMutationResult> {
    const task = await this.assertReferences(input.organizationId, input.taskId, input.userId);
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
    const created = await (this.prisma as unknown as NotesPrisma).observation.create({
      data: {
        id: this.createId("observation"),
        organizationId: input.organizationId,
        taskId: input.taskId,
        userId: input.userId,
        body: input.body.trim(),
        createdAt: input.createdAt
      }
    });

    return {
      item: this.toObservation(created),
      message: `Observation ${created.id} created for task ${created.taskId}.`
    };
  }

  private async assertReferences(organizationId: string, taskId: string, userId: string) {
    const prisma = this.prisma as unknown as NotesPrisma;
    const [task, user] = await Promise.all([
      prisma.task.findFirst({ where: { id: taskId, organizationId } }),
      prisma.user.findFirst({ where: { id: userId, organizationId, active: true } })
    ]);

    if (!task) {
      throw new NotFoundException(`Task ${taskId} was not found.`);
    }

    if (!user) {
      throw new NotFoundException(`User ${userId} was not found.`);
    }

    return task;
  }

  private toComment(item: {
    id: string;
    organizationId: string;
    taskId: string;
    userId: string;
    body: string;
    createdAt: string;
  }): Comment {
    return {
      id: item.id,
      organizationId: item.organizationId,
      taskId: item.taskId,
      userId: item.userId,
      body: item.body,
      createdAt: item.createdAt
    };
  }

  private toObservation(item: {
    id: string;
    organizationId: string;
    taskId: string;
    userId: string;
    body: string;
    createdAt: string;
  }): Observation {
    return {
      id: item.id,
      organizationId: item.organizationId,
      taskId: item.taskId,
      userId: item.userId,
      body: item.body,
      createdAt: item.createdAt
    };
  }

  private createId(prefix: string) {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
  }
}
