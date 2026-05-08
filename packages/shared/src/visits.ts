import { z } from "zod";
import { VISIT_STATUSES, type PointOfSale, type Province, type Task, type User, type Visit, type VisitStatus, type Zone } from "./domain";

const identifierSchema = z.string().trim().min(1);
const visitDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "scheduledFor must use YYYY-MM-DD format.");
const isoTimestampSchema = z.string().datetime({ offset: true });
const latitudeSchema = z.number().min(-90).max(90);
const longitudeSchema = z.number().min(-180).max(180);

export const createVisitSchema = z.object({
  organizationId: identifierSchema,
  taskId: identifierSchema,
  assigneeId: identifierSchema,
  scheduledFor: visitDateSchema,
  provinceId: identifierSchema,
  zoneId: identifierSchema,
  pointOfSaleId: identifierSchema.optional(),
  status: z.enum(VISIT_STATUSES).optional()
});

export const visitCheckInSchema = z.object({
  checkedInAt: isoTimestampSchema,
  checkedInLatitude: latitudeSchema,
  checkedInLongitude: longitudeSchema
});

export const visitCheckOutSchema = z.object({
  checkedOutAt: isoTimestampSchema,
  checkedOutLatitude: latitudeSchema,
  checkedOutLongitude: longitudeSchema
});

export interface CreateVisitInput {
  organizationId: string;
  taskId: string;
  assigneeId: string;
  scheduledFor: string;
  provinceId: string;
  zoneId: string;
  pointOfSaleId?: string;
  status?: VisitStatus;
}

export interface VisitCheckInInput {
  checkedInAt: string;
  checkedInLatitude: number;
  checkedInLongitude: number;
}

export interface VisitCheckOutInput {
  checkedOutAt: string;
  checkedOutLatitude: number;
  checkedOutLongitude: number;
}

export interface VisitMutationResult {
  item: Visit;
  message: string;
}

export interface VisitBootstrap {
  visits: Visit[];
  tasks: Task[];
  users: User[];
  provinces: Province[];
  zones: Zone[];
  pointsOfSale: PointOfSale[];
}

export type CreateVisitSchemaInput = z.infer<typeof createVisitSchema>;
export type VisitCheckInSchemaInput = z.infer<typeof visitCheckInSchema>;
export type VisitCheckOutSchemaInput = z.infer<typeof visitCheckOutSchema>;
