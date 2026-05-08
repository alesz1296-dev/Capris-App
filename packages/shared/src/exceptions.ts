import { z } from "zod";
import type { ExceptionStatus, User } from "./domain";

export const EXCEPTION_TYPES = [
  "missing_gps",
  "poor_signal",
  "closed_store",
  "unavailable_contact",
  "failed_photo_upload",
  "failed_email_send",
  "off_route_visit",
  "missing_required_evidence"
] as const;

const identifierSchema = z.string().trim().min(1);
const isoTimestampSchema = z.string().datetime({ offset: true });

export const createExceptionSchema = z.object({
  organizationId: identifierSchema,
  type: z.enum(EXCEPTION_TYPES),
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(1200).optional(),
  submittedByUserId: identifierSchema,
  taskId: identifierSchema.optional(),
  visitId: identifierSchema.optional(),
  mediaAssetId: identifierSchema.optional(),
  consignationId: identifierSchema.optional(),
  submittedAt: isoTimestampSchema
});

export const reviewExceptionSchema = z.object({
  status: z.enum(["approved", "rejected", "needs_correction"]),
  reviewedByUserId: identifierSchema,
  reviewNote: z.string().trim().min(3).max(1200).optional(),
  reviewedAt: isoTimestampSchema
});

export type ExceptionType = (typeof EXCEPTION_TYPES)[number];

export interface ExceptionRecord {
  id: string;
  organizationId: string;
  type: ExceptionType;
  title: string;
  description?: string;
  submittedByUserId: string;
  reviewedByUserId?: string;
  taskId?: string;
  visitId?: string;
  mediaAssetId?: string;
  consignationId?: string;
  status: ExceptionStatus;
  submittedAt: string;
  reviewedAt?: string;
  reviewNote?: string;
}

export interface CreateExceptionInput {
  organizationId: string;
  type: ExceptionType;
  title: string;
  description?: string;
  submittedByUserId: string;
  taskId?: string;
  visitId?: string;
  mediaAssetId?: string;
  consignationId?: string;
  submittedAt: string;
}

export interface ReviewExceptionInput {
  status: Extract<ExceptionStatus, "approved" | "rejected" | "needs_correction">;
  reviewedByUserId: string;
  reviewNote?: string;
  reviewedAt: string;
}

export interface ExceptionMutationResult {
  item: ExceptionRecord;
  message: string;
}

export interface ExceptionTaskSummary {
  id: string;
  title: string;
  status: string;
}

export interface ExceptionVisitSummary {
  id: string;
  taskId: string;
  status: string;
}

export interface ExceptionMediaSummary {
  id: string;
  fileName: string;
  uploadStatus: string;
}

export interface ExceptionConsignationSummary {
  id: string;
  taskId: string;
  status: string;
}

export interface ExceptionBootstrap {
  exceptions: ExceptionRecord[];
  users: User[];
  tasks: ExceptionTaskSummary[];
  visits: ExceptionVisitSummary[];
  mediaAssets: ExceptionMediaSummary[];
  consignations: ExceptionConsignationSummary[];
}

export type CreateExceptionSchemaInput = z.infer<typeof createExceptionSchema>;
export type ReviewExceptionSchemaInput = z.infer<typeof reviewExceptionSchema>;
