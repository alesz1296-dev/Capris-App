import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Req } from "@nestjs/common";
import { ZodError } from "zod";
import {
  createTaskSchema,
  updateTaskSchema,
  updateTaskStatusSchema,
  type CreateTaskInput,
  type UpdateTaskInput,
  type UpdateTaskStatusInput
} from "@capris/shared";
import { ActorAccessService } from "../auth/actor-access.service";
import type { AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { RequirePermissions } from "../auth/require-permission.decorator";
import { TasksService } from "./tasks.service";

@Controller("tasks")
export class TasksController {
  constructor(
    private readonly service: TasksService,
    private readonly actorAccessService: ActorAccessService
  ) {}

  @Get("bootstrap")
  getBootstrap(@Req() request: AuthenticatedRequest) {
    return this.service.getTaskBootstrap(this.actorAccessService.getActor(request));
  }

  @Get()
  getTasks(@Req() request: AuthenticatedRequest) {
    return this.service.getTasks(this.actorAccessService.getActor(request));
  }

  @Get(":id")
  getTask(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.service.getTask(id, this.actorAccessService.getActor(request));
  }

  @Post()
  @RequirePermissions("tasks.assign")
  createTask(@Body() input: CreateTaskInput, @Req() request: AuthenticatedRequest) {
    const actor = this.actorAccessService.getActor(request);
    return this.service.createTask(
      parseTaskInput(createTaskSchema, {
        ...input,
        organizationId: actor.organizationId,
        requesterId: actor.sub
      }),
      actor
    );
  }

  @Patch(":id")
  @RequirePermissions("tasks.assign")
  updateTask(@Param("id") id: string, @Body() input: UpdateTaskInput, @Req() request: AuthenticatedRequest) {
    return this.service.updateTask(id, parseTaskInput(updateTaskSchema, input), this.actorAccessService.getActor(request));
  }

  @Patch(":id/status")
  @RequirePermissions("tasks.complete")
  updateTaskStatus(@Param("id") id: string, @Body() input: UpdateTaskStatusInput, @Req() request: AuthenticatedRequest) {
    return this.service.updateTaskStatus(id, parseTaskInput(updateTaskStatusSchema, input), this.actorAccessService.getActor(request));
  }
}

function parseTaskInput<TOutput>(schema: { parse: (input: unknown) => TOutput }, input: unknown): TOutput {
  try {
    return schema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new BadRequestException(error.issues.map((issue) => issue.message).join(" "));
    }

    throw error;
  }
}
