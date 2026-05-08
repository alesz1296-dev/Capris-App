import { z } from "zod";
import { CLIENT_REQUEST_STATUSES, PRIORITIES, type ClientRequest, type ClientRequestStatus, type Priority, type User } from "./domain";
import type { Client, PointOfSale, Province, Task, Zone } from "./domain";

const identifierSchema = z.string().trim().min(1);
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must use YYYY-MM-DD format.");
const isoTimestampSchema = z.string().datetime({ offset: true });

export const createClientRequestSchema = z.object({
  organizationId: identifierSchema,
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(1000).optional(),
  requesterName: z.string().trim().min(2).max(120),
  requesterEmail: z.string().trim().email().optional(),
  ownerUserId: identifierSchema,
  clientId: identifierSchema.optional(),
  provinceId: identifierSchema.optional(),
  zoneId: identifierSchema.optional(),
  pointOfSaleId: identifierSchema.optional(),
  taskId: identifierSchema.optional(),
  status: z.enum(CLIENT_REQUEST_STATUSES).optional(),
  dueDate: isoDateSchema,
  openedAt: isoTimestampSchema,
  priority: z.enum(PRIORITIES).optional()
});

export const updateClientRequestSchema = z
  .object({
    title: z.string().trim().min(3).max(160).optional(),
    description: z.string().trim().max(1000).optional(),
    requesterName: z.string().trim().min(2).max(120).optional(),
    requesterEmail: z.string().trim().email().optional(),
    ownerUserId: identifierSchema.optional(),
    clientId: identifierSchema.optional(),
    provinceId: identifierSchema.optional(),
    zoneId: identifierSchema.optional(),
    pointOfSaleId: identifierSchema.optional(),
    taskId: identifierSchema.optional(),
    dueDate: isoDateSchema.optional(),
    priority: z.enum(PRIORITIES).optional()
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: "At least one client request field must be provided."
  });

export const updateClientRequestStatusSchema = z.object({
  status: z.enum(CLIENT_REQUEST_STATUSES),
  resolvedAt: isoTimestampSchema.optional(),
  closedAt: isoTimestampSchema.optional()
});

export interface CreateClientRequestInput {
  organizationId: string;
  title: string;
  description?: string;
  requesterName: string;
  requesterEmail?: string;
  ownerUserId: string;
  clientId?: string;
  provinceId?: string;
  zoneId?: string;
  pointOfSaleId?: string;
  taskId?: string;
  status?: ClientRequestStatus;
  dueDate: string;
  openedAt: string;
  priority?: Priority;
}

export interface UpdateClientRequestInput {
  title?: string;
  description?: string;
  requesterName?: string;
  requesterEmail?: string;
  ownerUserId?: string;
  clientId?: string;
  provinceId?: string;
  zoneId?: string;
  pointOfSaleId?: string;
  taskId?: string;
  dueDate?: string;
  priority?: Priority;
}

export interface UpdateClientRequestStatusInput {
  status: ClientRequestStatus;
  resolvedAt?: string;
  closedAt?: string;
}

export interface ClientRequestMutationResult {
  item: ClientRequest;
  message: string;
}

export interface ClientRequestBootstrap {
  requests: ClientRequest[];
  users: User[];
  clients: Client[];
  provinces: Province[];
  zones: Zone[];
  pointsOfSale: PointOfSale[];
  tasks: Task[];
}

export type CreateClientRequestSchemaInput = z.infer<typeof createClientRequestSchema>;
export type UpdateClientRequestSchemaInput = z.infer<typeof updateClientRequestSchema>;
export type UpdateClientRequestStatusSchemaInput = z.infer<typeof updateClientRequestStatusSchema>;
