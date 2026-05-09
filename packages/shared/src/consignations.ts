import { z } from "zod";
import { CONSIGNATION_STATUSES, type Consignation, type ConsignationStatus } from "./domain";

const identifierSchema = z.string().trim().min(1);
const noteSchema = z.string().trim().max(1000);
const isoTimestampSchema = z.string().datetime({ offset: true });
const emailSchema = z.string().trim().email();

export const prepareConsignationSchema = z.object({
  organizationId: identifierSchema,
  taskId: identifierSchema,
  userId: identifierSchema.optional(),
  clientOperationId: identifierSchema.optional(),
  visitId: identifierSchema.optional(),
  note: noteSchema.optional(),
  preparedAt: isoTimestampSchema
});

export const reviewConsignationSchema = z.object({
  clientOperationId: identifierSchema.optional(),
  reviewedAt: isoTimestampSchema,
  recipientEmails: z.array(emailSchema).min(1),
  emailSubject: z.string().trim().min(3).max(200),
  emailBody: z.string().trim().min(10).max(5000),
  beforeEvidenceId: identifierSchema.optional(),
  afterEvidenceId: identifierSchema.optional()
});

export const sendConsignationSchema = z.object({
  clientOperationId: identifierSchema.optional(),
  sentAt: isoTimestampSchema
});

export const failConsignationSchema = z.object({
  clientOperationId: identifierSchema.optional(),
  failedAt: isoTimestampSchema,
  reason: z.string().trim().min(3).max(1000)
});

export interface PrepareConsignationInput {
  organizationId: string;
  taskId: string;
  userId?: string;
  clientOperationId?: string;
  visitId?: string;
  note?: string;
  preparedAt: string;
}

export interface ReviewConsignationInput {
  clientOperationId?: string;
  reviewedAt: string;
  recipientEmails: string[];
  emailSubject: string;
  emailBody: string;
  beforeEvidenceId?: string;
  afterEvidenceId?: string;
}

export interface SendConsignationInput {
  clientOperationId?: string;
  sentAt: string;
}

export interface FailConsignationInput {
  clientOperationId?: string;
  failedAt: string;
  reason: string;
}

export interface ConsignationMutationResult {
  item: Consignation;
  message: string;
}

export { CONSIGNATION_STATUSES };
export type { ConsignationStatus };
