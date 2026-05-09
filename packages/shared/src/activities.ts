import { z } from "zod";
import type { Activity, ExhibitionInstallation, PointOfSale, Task, User, Visit } from "./domain";

const identifierSchema = z.string().trim().min(1);
const noteSchema = z.string().trim().max(1000);
const isoTimestampSchema = z.string().datetime({ offset: true });
const quantitySchema = z.number().int().min(1).max(9999);

export const createActivitySchema = z.object({
  organizationId: identifierSchema,
  taskId: identifierSchema,
  userId: identifierSchema,
  clientOperationId: identifierSchema.optional(),
  visitId: identifierSchema.optional(),
  pointOfSaleId: identifierSchema.optional(),
  quantity: quantitySchema,
  note: noteSchema.optional(),
  recordedAt: isoTimestampSchema
});

export const createExhibitionInstallationSchema = z.object({
  organizationId: identifierSchema,
  taskId: identifierSchema,
  userId: identifierSchema,
  clientOperationId: identifierSchema.optional(),
  visitId: identifierSchema.optional(),
  pointOfSaleId: identifierSchema.optional(),
  quantity: quantitySchema,
  note: noteSchema.optional(),
  recordedAt: isoTimestampSchema
});

export interface CreateActivityInput {
  organizationId: string;
  taskId: string;
  userId: string;
  clientOperationId?: string;
  visitId?: string;
  pointOfSaleId?: string;
  quantity: number;
  note?: string;
  recordedAt: string;
}

export interface CreateExhibitionInstallationInput {
  organizationId: string;
  taskId: string;
  userId: string;
  clientOperationId?: string;
  visitId?: string;
  pointOfSaleId?: string;
  quantity: number;
  note?: string;
  recordedAt: string;
}

export interface ActivityMutationResult {
  item: Activity;
  message: string;
}

export interface ExhibitionMutationResult {
  item: ExhibitionInstallation;
  message: string;
}

export interface ActivitiesBootstrap {
  activities: Activity[];
  exhibitions: ExhibitionInstallation[];
  tasks: Task[];
  visits: Visit[];
  users: User[];
  pointsOfSale: PointOfSale[];
}
