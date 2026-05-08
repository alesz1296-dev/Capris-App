import { z } from "zod";
import { DIFFICULTIES, PRIORITIES, TASK_STATUSES, type Difficulty, type Priority, type Task, type TaskStatus, type User } from "./domain";
import type { ActivityType, TaskType, WorkflowRule } from "./workflow";
import type { Client, PointOfSale, Province, Zone } from "./domain";

const identifierSchema = z.string().trim().min(1);
const taskDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "scheduledFor must use YYYY-MM-DD format.");

export const createTaskSchema = z.object({
  organizationId: identifierSchema,
  title: z.string().trim().min(3).max(160),
  requesterId: identifierSchema,
  assigneeId: identifierSchema,
  scheduledFor: taskDateSchema,
  provinceId: identifierSchema,
  zoneId: identifierSchema,
  pointOfSaleId: identifierSchema.optional(),
  clientId: identifierSchema.optional(),
  activityTypeId: identifierSchema,
  taskTypeId: identifierSchema,
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  difficulty: z.enum(DIFFICULTIES).optional()
});

export const updateTaskSchema = z
  .object({
    title: z.string().trim().min(3).max(160).optional(),
    requesterId: identifierSchema.optional(),
    assigneeId: identifierSchema.optional(),
    scheduledFor: taskDateSchema.optional(),
    provinceId: identifierSchema.optional(),
    zoneId: identifierSchema.optional(),
    pointOfSaleId: identifierSchema.optional(),
    clientId: identifierSchema.optional(),
    activityTypeId: identifierSchema.optional(),
    taskTypeId: identifierSchema.optional(),
    priority: z.enum(PRIORITIES).optional(),
    difficulty: z.enum(DIFFICULTIES).optional()
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: "At least one task field must be provided."
  });

export const updateTaskStatusSchema = z.object({
  status: z.enum(TASK_STATUSES)
});

export interface CreateTaskInput {
  organizationId: string;
  title: string;
  requesterId: string;
  assigneeId: string;
  scheduledFor: string;
  provinceId: string;
  zoneId: string;
  pointOfSaleId?: string;
  clientId?: string;
  activityTypeId: string;
  taskTypeId: string;
  status?: TaskStatus;
  priority?: Priority;
  difficulty?: Difficulty;
}

export interface UpdateTaskInput {
  title?: string;
  requesterId?: string;
  assigneeId?: string;
  scheduledFor?: string;
  provinceId?: string;
  zoneId?: string;
  pointOfSaleId?: string;
  clientId?: string;
  activityTypeId?: string;
  taskTypeId?: string;
  priority?: Priority;
  difficulty?: Difficulty;
}

export interface UpdateTaskStatusInput {
  status: TaskStatus;
}

export interface TaskMutationResult {
  item: Task;
  message: string;
}

export interface TaskBootstrap {
  tasks: Task[];
  users: User[];
  provinces: Province[];
  zones: Zone[];
  clients: Client[];
  pointsOfSale: PointOfSale[];
  activityTypes: ActivityType[];
  taskTypes: TaskType[];
  workflowRules: WorkflowRule[];
}

export type CreateTaskSchemaInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskSchemaInput = z.infer<typeof updateTaskSchema>;
export type UpdateTaskStatusSchemaInput = z.infer<typeof updateTaskStatusSchema>;
