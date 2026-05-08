import { BadRequestException, Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { ZodError } from "zod";
import {
  createTaskSchema,
  updateTaskSchema,
  updateTaskStatusSchema,
  type CreateTaskInput,
  type UpdateTaskInput,
  type UpdateTaskStatusInput
} from "@capris/shared";
import { TasksService } from "./tasks.service";

@Controller("tasks")
export class TasksController {
  constructor(private readonly service: TasksService) {}

  @Get("bootstrap")
  getBootstrap() {
    return this.service.getTaskBootstrap();
  }

  @Get()
  getTasks() {
    return this.service.getTasks();
  }

  @Get(":id")
  getTask(@Param("id") id: string) {
    return this.service.getTask(id);
  }

  @Post()
  createTask(@Body() input: CreateTaskInput) {
    return this.service.createTask(parseTaskInput(createTaskSchema, input));
  }

  @Patch(":id")
  updateTask(@Param("id") id: string, @Body() input: UpdateTaskInput) {
    return this.service.updateTask(id, parseTaskInput(updateTaskSchema, input));
  }

  @Patch(":id/status")
  updateTaskStatus(@Param("id") id: string, @Body() input: UpdateTaskStatusInput) {
    return this.service.updateTaskStatus(id, parseTaskInput(updateTaskStatusSchema, input));
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
