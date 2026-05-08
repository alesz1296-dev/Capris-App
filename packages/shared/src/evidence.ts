import { z } from "zod";
import {
  type Activity,
  type Client,
  type Comment,
  type Consignation,
  EVIDENCE_TYPES,
  type ExhibitionInstallation,
  UPLOAD_STATUSES,
  type EvidencePhoto,
  type EvidenceType,
  type MediaAsset,
  type Observation,
  type PointOfSale,
  type Task,
  type UploadStatus,
  type User,
  type Visit
} from "./domain";
import { type SyncOperation, type SyncState as SharedSyncState } from "./sync";
import type { WorkflowRule } from "./workflow";

const identifierSchema = z.string().trim().min(1);
const isoTimestampSchema = z.string().datetime({ offset: true });
const latitudeSchema = z.number().min(-90).max(90);
const longitudeSchema = z.number().min(-180).max(180);
const storagePathSchema = z.string().trim().min(1);
const fileNameSchema = z.string().trim().min(1);
const mimeTypeSchema = z.string().trim().min(1);
const syncStateSchema = z.enum(["pending_sync", "sync_failed", "needs_review", "synced"]);
const nonNegativeIntSchema = z.number().int().min(0);
const progressSchema = z.number().min(0).max(100);
const base64PayloadSchema = z.string().trim().min(1);
const captureSourceSchema = z.enum(["camera", "library", "web_file"]);

export const createEvidenceSchema = z
  .object({
    organizationId: identifierSchema,
    taskId: identifierSchema,
    visitId: identifierSchema.optional(),
    uploaderUserId: identifierSchema,
    type: z.enum(EVIDENCE_TYPES),
    capturedAt: isoTimestampSchema,
    latitude: latitudeSchema.optional(),
    longitude: longitudeSchema.optional(),
    fileName: fileNameSchema,
    mimeType: mimeTypeSchema,
    originalStoragePath: storagePathSchema,
    thumbnailStoragePath: storagePathSchema.optional(),
    uploadStatus: z.enum(UPLOAD_STATUSES).optional(),
    syncState: syncStateSchema.optional(),
    uploadSessionId: identifierSchema.optional(),
    uploadProgress: progressSchema.optional(),
    retryCount: nonNegativeIntSchema.optional(),
    lastError: z.string().trim().min(1).optional(),
    chunkCount: nonNegativeIntSchema.optional(),
    uploadedChunkCount: nonNegativeIntSchema.optional(),
    byteSize: z.number().int().positive().optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional()
  })
  .superRefine((input, context) => {
    if (input.uploadStatus === "uploaded" && !input.originalStoragePath.trim()) {
      context.addIssue({
        code: "custom",
        message: "uploaded evidence requires originalStoragePath."
      });
    }

    if (
      input.chunkCount !== undefined &&
      input.uploadedChunkCount !== undefined &&
      input.uploadedChunkCount > input.chunkCount
    ) {
      context.addIssue({
        code: "custom",
        message: "uploadedChunkCount cannot be greater than chunkCount."
      });
    }
  });

export const updateMediaUploadStatusSchema = z
  .object({
    uploadStatus: z.enum(UPLOAD_STATUSES),
    originalStoragePath: storagePathSchema.optional(),
    thumbnailStoragePath: storagePathSchema.optional(),
    syncState: syncStateSchema.optional(),
    uploadSessionId: identifierSchema.optional(),
    uploadProgress: progressSchema.optional(),
    retryCount: nonNegativeIntSchema.optional(),
    lastError: z.string().trim().min(1).optional(),
    chunkCount: nonNegativeIntSchema.optional(),
    uploadedChunkCount: nonNegativeIntSchema.optional()
  })
  .superRefine((input, context) => {
    if (input.uploadStatus === "uploaded" && !input.originalStoragePath?.trim()) {
      context.addIssue({
        code: "custom",
        message: "uploaded media requires originalStoragePath."
      });
    }

    if (
      input.chunkCount !== undefined &&
      input.uploadedChunkCount !== undefined &&
      input.uploadedChunkCount > input.chunkCount
    ) {
      context.addIssue({
        code: "custom",
        message: "uploadedChunkCount cannot be greater than chunkCount."
      });
    }
  });

export const requestMediaRetrySchema = z.object({
  reason: z.string().trim().min(1).optional(),
  chunkCount: nonNegativeIntSchema.optional()
});

export const uploadCapturedEvidenceSchema = z.object({
  organizationId: identifierSchema,
  taskId: identifierSchema,
  visitId: identifierSchema.optional(),
  uploaderUserId: identifierSchema,
  type: z.enum(EVIDENCE_TYPES),
  capturedAt: isoTimestampSchema,
  latitude: latitudeSchema.optional(),
  longitude: longitudeSchema.optional(),
  fileName: fileNameSchema,
  mimeType: mimeTypeSchema,
  fileBase64: base64PayloadSchema,
  captureSource: captureSourceSchema,
  byteSize: z.number().int().positive().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional()
});

export interface CreateEvidenceInput {
  organizationId: string;
  taskId: string;
  visitId?: string;
  uploaderUserId: string;
  type: EvidenceType;
  capturedAt: string;
  latitude?: number;
  longitude?: number;
  fileName: string;
  mimeType: string;
  originalStoragePath: string;
  thumbnailStoragePath?: string;
  uploadStatus?: UploadStatus;
  syncState?: SharedSyncState;
  uploadSessionId?: string;
  uploadProgress?: number;
  retryCount?: number;
  lastError?: string;
  chunkCount?: number;
  uploadedChunkCount?: number;
  byteSize?: number;
  width?: number;
  height?: number;
}

export interface UpdateMediaUploadStatusInput {
  uploadStatus: UploadStatus;
  originalStoragePath?: string;
  thumbnailStoragePath?: string;
  syncState?: SharedSyncState;
  uploadSessionId?: string;
  uploadProgress?: number;
  retryCount?: number;
  lastError?: string;
  chunkCount?: number;
  uploadedChunkCount?: number;
}

export interface RequestMediaRetryInput {
  reason?: string;
  chunkCount?: number;
}

export interface UploadCapturedEvidenceInput {
  organizationId: string;
  taskId: string;
  visitId?: string;
  uploaderUserId: string;
  type: EvidenceType;
  capturedAt: string;
  latitude?: number;
  longitude?: number;
  fileName: string;
  mimeType: string;
  fileBase64: string;
  captureSource: "camera" | "library" | "web_file";
  byteSize?: number;
  width?: number;
  height?: number;
}

export interface EvidenceRequirementSummary {
  taskId: string;
  requiredBeforePhoto: boolean;
  requiredAfterPhoto: boolean;
  beforeUploaded: boolean;
  afterUploaded: boolean;
  supportingCount: number;
  missingTypes: EvidenceType[];
  complete: boolean;
}

export interface EvidenceMutationResult {
  item: EvidencePhoto;
  mediaAsset: MediaAsset;
  message: string;
}

export interface MediaAssetMutationResult {
  item: MediaAsset;
  message: string;
}

export interface UploadSessionPlan {
  mediaAssetId: string;
  uploadSessionId: string;
  syncState: SharedSyncState;
  uploadStatus: UploadStatus;
  uploadProgress: number;
  retryCount: number;
  chunkCount?: number;
  uploadedChunkCount?: number;
}

export interface EvidenceBootstrap {
  activities: Activity[];
  clients: Client[];
  evidence: EvidencePhoto[];
  exhibitions: ExhibitionInstallation[];
  mediaAssets: MediaAsset[];
  comments: Comment[];
  observations: Observation[];
  consignations: Consignation[];
  pointsOfSale: PointOfSale[];
  tasks: Task[];
  visits: Visit[];
  users: User[];
  workflowRules: WorkflowRule[];
  requirementSummaries: EvidenceRequirementSummary[];
  pendingSyncOperations: SyncOperation[];
}

export type CreateEvidenceSchemaInput = z.infer<typeof createEvidenceSchema>;
export type UpdateMediaUploadStatusSchemaInput = z.infer<typeof updateMediaUploadStatusSchema>;
export type RequestMediaRetrySchemaInput = z.infer<typeof requestMediaRetrySchema>;
export type UploadCapturedEvidenceSchemaInput = z.infer<typeof uploadCapturedEvidenceSchema>;
