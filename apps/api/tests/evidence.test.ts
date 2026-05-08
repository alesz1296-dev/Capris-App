import "reflect-metadata";
import assert from "node:assert/strict";
import { BadRequestException } from "@nestjs/common";
import { EvidenceController } from "../src/modules/evidence/evidence.controller";
import { EvidenceService } from "../src/modules/evidence/evidence.service";

async function testEvidenceCreationValidation() {
  const controller = new EvidenceController({
    createEvidence: () => {
      throw new Error("Service should not be reached for invalid evidence payloads.");
    }
  } as never);

  assert.throws(
    () =>
      controller.createEvidence({
        organizationId: "org_capris",
        taskId: "task_launch_display",
        uploaderUserId: "user_field_001",
        type: "before",
        capturedAt: "2026-05-08 14:00:00",
        fileName: "before.jpg",
        mimeType: "image/jpeg",
        originalStoragePath: "/mock-storage/originals/before.jpg",
        uploadStatus: "uploaded"
      }),
    (error: unknown) => error instanceof BadRequestException && `${error.message}`.includes("Invalid ISO datetime")
  );
}

async function testUploadProgressValidation() {
  const controller = new EvidenceController({
    updateMediaUploadStatus: () => {
      throw new Error("Service should not be reached for invalid upload progress payloads.");
    }
  } as never);

  assert.throws(
    () =>
      controller.updateMediaUploadStatus("media_before_launch_display", {
        uploadStatus: "uploading",
        uploadProgress: 30,
        chunkCount: 2,
        uploadedChunkCount: 3
      }),
    (error: unknown) =>
      error instanceof BadRequestException && `${error.message}`.includes("uploadedChunkCount cannot be greater than chunkCount")
  );
}

async function testUploadCapturedEvidenceValidation() {
  const controller = new EvidenceController({
    uploadCapturedEvidence: () => {
      throw new Error("Service should not be reached for invalid upload payloads.");
    }
  } as never);

  assert.throws(
    () =>
      controller.uploadCapturedEvidence({
        organizationId: "org_capris",
        taskId: "task_launch_display",
        uploaderUserId: "user_field_001",
        type: "before",
        capturedAt: "2026-05-08T16:00:00.000Z",
        fileName: "before.jpg",
        mimeType: "image/jpeg",
        fileBase64: "",
        captureSource: "camera"
      }),
    (error: unknown) => error instanceof BadRequestException
  );
}

async function testMediaUploadTransitionValidation() {
  const service = new EvidenceService(
    {
      mediaAsset: {
        findUnique: async () => ({
          id: "media_before_launch_display",
          organizationId: "org_capris",
          uploaderUserId: "user_field_001",
          fileName: "before.jpg",
          mimeType: "image/jpeg",
          originalStoragePath: "/mock-storage/originals/before.jpg",
          thumbnailStoragePath: "/mock-storage/thumbs/before.jpg",
          capturedAt: "2026-05-08T14:00:00.000Z",
          uploadStatus: "uploaded",
          syncState: "synced",
          uploadSessionId: null,
          uploadProgress: 100,
          retryCount: 0,
          lastError: null,
          chunkCount: 4,
          uploadedChunkCount: 4,
          byteSize: 240000,
          width: 1440,
          height: 1080
        }),
        update: async () => {
          throw new Error("Update should not run for invalid upload transitions.");
        }
      }
    } as never,
    {} as never,
    {} as never,
    {
      createSignedReadPath: (storagePath: string) => storagePath
    } as never
  );

  await assert.rejects(
    () =>
      service.updateMediaUploadStatus("media_before_launch_display", {
        uploadStatus: "uploading"
      }),
    (error: unknown) =>
      error instanceof BadRequestException &&
      `${error.message}`.includes("cannot move from uploaded to uploading")
  );
}

async function testMediaRetryQueuesNewSession() {
  let updatedPayload: Record<string, unknown> | undefined;
  const service = new EvidenceService(
    {
      mediaAsset: {
        findUnique: async () => ({
          id: "media_failed_upload",
          organizationId: "org_capris",
          uploaderUserId: "user_field_001",
          fileName: "after.jpg",
          mimeType: "image/jpeg",
          originalStoragePath: "/local-device/originals/after.jpg",
          thumbnailStoragePath: "/local-device/thumbs/after.jpg",
          capturedAt: "2026-05-08T15:00:00.000Z",
          uploadStatus: "failed",
          syncState: "sync_failed",
          uploadSessionId: "upload_old123",
          uploadProgress: 25,
          retryCount: 1,
          lastError: "Connection lost.",
          chunkCount: 4,
          uploadedChunkCount: 1,
          byteSize: 240000,
          width: 1440,
          height: 1080
        }),
        update: async ({ data }: { data: Record<string, unknown> }) => {
          updatedPayload = data;
          return {
            id: "media_failed_upload",
            organizationId: "org_capris",
            uploaderUserId: "user_field_001",
            fileName: "after.jpg",
            mimeType: "image/jpeg",
            originalStoragePath: "/local-device/originals/after.jpg",
            thumbnailStoragePath: "/local-device/thumbs/after.jpg",
            capturedAt: "2026-05-08T15:00:00.000Z",
            uploadStatus: data.uploadStatus,
            syncState: data.syncState,
            uploadSessionId: data.uploadSessionId,
            uploadProgress: data.uploadProgress,
            retryCount: data.retryCount,
            lastError: data.lastError ?? null,
            chunkCount: data.chunkCount,
            uploadedChunkCount: data.uploadedChunkCount,
            byteSize: 240000,
            width: 1440,
            height: 1080
          };
        }
      }
    } as never,
    {} as never,
    {} as never,
    {
      createSignedReadPath: (storagePath: string) => storagePath
    } as never
  );

  const result = await service.requestMediaRetry("media_failed_upload", {
    reason: "Retry on better connection",
    chunkCount: 6
  });

  assert.equal(result.item.uploadStatus, "pending_upload");
  assert.equal(result.item.syncState, "pending_sync");
  assert.equal(result.item.retryCount, 2);
  assert.equal(result.item.uploadProgress, 0);
  assert.equal(result.item.chunkCount, 6);
  assert.equal(result.item.uploadedChunkCount, 0);
  assert.ok(result.item.uploadSessionId?.startsWith("upload_"));
  assert.ok(updatedPayload);
}

async function testMediaResponsesSignStoredDeliveryPaths() {
  const service = new EvidenceService(
    {
      mediaAsset: {
        findUnique: async () => ({
          id: "media_failed_upload",
          organizationId: "org_capris",
          uploaderUserId: "user_field_001",
          fileName: "after.jpg",
          mimeType: "image/jpeg",
          originalStoragePath: "/api/v1/storage/local/b3JpZ2luYWw",
          thumbnailStoragePath: "/api/v1/storage/local/dGh1bWJuYWls",
          capturedAt: "2026-05-08T15:00:00.000Z",
          uploadStatus: "failed",
          syncState: "sync_failed",
          uploadSessionId: "upload_old123",
          uploadProgress: 25,
          retryCount: 1,
          lastError: "Connection lost.",
          chunkCount: 4,
          uploadedChunkCount: 1,
          byteSize: 240000,
          width: 1440,
          height: 1080
        }),
        update: async ({ data }: { data: Record<string, unknown> }) => ({
          id: "media_failed_upload",
          organizationId: "org_capris",
          uploaderUserId: "user_field_001",
          fileName: "after.jpg",
          mimeType: "image/jpeg",
          originalStoragePath: "/api/v1/storage/local/b3JpZ2luYWw",
          thumbnailStoragePath: "/api/v1/storage/local/dGh1bWJuYWls",
          capturedAt: "2026-05-08T15:00:00.000Z",
          uploadStatus: data.uploadStatus,
          syncState: data.syncState,
          uploadSessionId: data.uploadSessionId,
          uploadProgress: data.uploadProgress,
          retryCount: data.retryCount,
          lastError: data.lastError ?? null,
          chunkCount: data.chunkCount,
          uploadedChunkCount: data.uploadedChunkCount,
          byteSize: 240000,
          width: 1440,
          height: 1080
        })
      }
    } as never,
    {} as never,
    {} as never,
    {
      createSignedReadPath: (storagePath: string) => `${storagePath}?signed=1`
    } as never
  );

  const result = await service.requestMediaRetry("media_failed_upload", {
    reason: "Retry on better connection",
    chunkCount: 4
  });

  assert.equal(result.item.originalStoragePath, "/api/v1/storage/local/b3JpZ2luYWw?signed=1");
  assert.equal(result.item.thumbnailStoragePath, "/api/v1/storage/local/dGh1bWJuYWls?signed=1");
}

async function main() {
  await testEvidenceCreationValidation();
  await testUploadProgressValidation();
  await testUploadCapturedEvidenceValidation();
  await testMediaUploadTransitionValidation();
  await testMediaRetryQueuesNewSession();
  await testMediaResponsesSignStoredDeliveryPaths();
  console.log("Evidence tests passed.");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
