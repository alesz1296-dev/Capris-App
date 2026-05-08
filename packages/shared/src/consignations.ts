import { z } from "zod";
import { CONSIGNATION_STATUSES, type Consignation, type ConsignationStatus } from "./domain";

const identifierSchema = z.string().trim().min(1);
const noteSchema = z.string().trim().max(1000);
const isoTimestampSchema = z.string().datetime({ offset: true });

export const prepareConsignationSchema = z.object({
  organizationId: identifierSchema,
  taskId: identifierSchema,
  userId: identifierSchema,
  visitId: identifierSchema.optional(),
  note: noteSchema.optional(),
  preparedAt: isoTimestampSchema
});

export const sendConsignationSchema = z.object({
  sentAt: isoTimestampSchema
});

export interface PrepareConsignationInput {
  organizationId: string;
  taskId: string;
  userId: string;
  visitId?: string;
  note?: string;
  preparedAt: string;
}

export interface SendConsignationInput {
  sentAt: string;
}

export interface ConsignationMutationResult {
  item: Consignation;
  message: string;
}

export { CONSIGNATION_STATUSES };
export type { ConsignationStatus };
