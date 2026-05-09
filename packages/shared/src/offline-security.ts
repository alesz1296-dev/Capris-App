import CryptoJS from "crypto-js";
import type { EvidenceBootstrap } from "./evidence";

const ENCRYPTED_PAYLOAD_PREFIX = "enc:v1:";

export type OfflineBootstrapCachePayload = Omit<EvidenceBootstrap, "users" | "workflowRules" | "pendingSyncOperations"> & {
  users?: [];
  workflowRules?: [];
  pendingSyncOperations?: [];
};

export function createOfflineEncryptionKey() {
  return CryptoJS.lib.WordArray.random(32).toString(CryptoJS.enc.Hex);
}

export function encryptOfflineJson(plaintext: string, key: string) {
  if (!plaintext.trim()) {
    throw new Error("Cannot encrypt empty offline payloads.");
  }

  return `${ENCRYPTED_PAYLOAD_PREFIX}${CryptoJS.AES.encrypt(plaintext, key).toString()}`;
}

export function decryptOfflineJson(ciphertext: string, key: string) {
  if (!ciphertext.startsWith(ENCRYPTED_PAYLOAD_PREFIX)) {
    throw new Error("Offline payload is missing the expected encryption prefix.");
  }

  const encryptedBody = ciphertext.slice(ENCRYPTED_PAYLOAD_PREFIX.length);
  const decrypted = CryptoJS.AES.decrypt(encryptedBody, key).toString(CryptoJS.enc.Utf8);
  if (!decrypted.trim()) {
    throw new Error("Offline payload could not be decrypted.");
  }

  return decrypted;
}

export function minimizeBootstrapForOfflineCache(bootstrap: EvidenceBootstrap): OfflineBootstrapCachePayload {
  return {
    activities: bootstrap.activities.map((item) => ({
      id: item.id,
      organizationId: item.organizationId,
      taskId: item.taskId,
      userId: item.userId,
      visitId: item.visitId,
      pointOfSaleId: item.pointOfSaleId,
      quantity: item.quantity,
      note: item.note,
      recordedAt: item.recordedAt
    })),
    clients: bootstrap.clients.map((item) => ({
      id: item.id,
      organizationId: item.organizationId,
      name: item.name,
      code: item.code,
      contactEmail: item.contactEmail,
      active: item.active
    })),
    evidence: bootstrap.evidence.map((item) => ({
      id: item.id,
      organizationId: item.organizationId,
      uploaderUserId: item.uploaderUserId,
      taskId: item.taskId,
      visitId: item.visitId,
      mediaAssetId: item.mediaAssetId,
      type: item.type,
      capturedAt: item.capturedAt,
      latitude: item.latitude,
      longitude: item.longitude,
      uploadStatus: item.uploadStatus
    })),
    exhibitions: bootstrap.exhibitions.map((item) => ({
      id: item.id,
      organizationId: item.organizationId,
      taskId: item.taskId,
      userId: item.userId,
      visitId: item.visitId,
      pointOfSaleId: item.pointOfSaleId,
      quantity: item.quantity,
      note: item.note,
      recordedAt: item.recordedAt
    })),
    mediaAssets: bootstrap.mediaAssets.map((item) => ({
      id: item.id,
      organizationId: item.organizationId,
      uploaderUserId: item.uploaderUserId,
      fileName: item.fileName,
      mimeType: item.mimeType,
      originalStoragePath: item.originalStoragePath,
      thumbnailStoragePath: item.thumbnailStoragePath,
      capturedAt: item.capturedAt,
      uploadStatus: item.uploadStatus,
      syncState: item.syncState,
      uploadSessionId: item.uploadSessionId,
      uploadProgress: item.uploadProgress,
      retryCount: item.retryCount,
      lastError: item.lastError,
      chunkCount: item.chunkCount,
      uploadedChunkCount: item.uploadedChunkCount,
      byteSize: item.byteSize,
      width: item.width,
      height: item.height
    })),
    comments: bootstrap.comments.map((item) => ({
      id: item.id,
      organizationId: item.organizationId,
      taskId: item.taskId,
      userId: item.userId,
      body: item.body,
      createdAt: item.createdAt
    })),
    observations: bootstrap.observations.map((item) => ({
      id: item.id,
      organizationId: item.organizationId,
      taskId: item.taskId,
      userId: item.userId,
      body: item.body,
      createdAt: item.createdAt
    })),
    consignations: bootstrap.consignations.map((item) => ({
      id: item.id,
      organizationId: item.organizationId,
      taskId: item.taskId,
      userId: item.userId,
      visitId: item.visitId,
      note: item.note,
      status: item.status,
      preparedAt: item.preparedAt,
      reviewedAt: item.reviewedAt,
      sentAt: item.sentAt,
      failedAt: item.failedAt,
      beforeEvidenceId: item.beforeEvidenceId,
      afterEvidenceId: item.afterEvidenceId,
      recipientEmails: [],
      emailSubject: undefined,
      emailBody: undefined,
      sendFailureReason: item.sendFailureReason
    })),
    pointsOfSale: bootstrap.pointsOfSale.map((item) => ({
      id: item.id,
      organizationId: item.organizationId,
      zoneId: item.zoneId,
      provinceId: item.provinceId,
      clientId: item.clientId,
      name: item.name,
      code: item.code,
      latitude: item.latitude,
      longitude: item.longitude,
      active: item.active
    })),
    tasks: bootstrap.tasks.map((item) => ({
      id: item.id,
      organizationId: item.organizationId,
      title: item.title,
      requesterId: item.requesterId,
      assigneeId: item.assigneeId,
      scheduledFor: item.scheduledFor,
      provinceId: item.provinceId,
      zoneId: item.zoneId,
      clientId: item.clientId,
      pointOfSaleId: item.pointOfSaleId,
      activityTypeId: item.activityTypeId,
      taskTypeId: item.taskTypeId,
      status: item.status,
      priority: item.priority,
      difficulty: item.difficulty
    })),
    visits: bootstrap.visits.map((item) => ({
      id: item.id,
      organizationId: item.organizationId,
      taskId: item.taskId,
      assigneeId: item.assigneeId,
      scheduledFor: item.scheduledFor,
      provinceId: item.provinceId,
      zoneId: item.zoneId,
      pointOfSaleId: item.pointOfSaleId,
      status: item.status,
      checkedInAt: item.checkedInAt,
      checkedInLatitude: item.checkedInLatitude,
      checkedInLongitude: item.checkedInLongitude,
      checkedOutAt: item.checkedOutAt,
      checkedOutLatitude: item.checkedOutLatitude,
      checkedOutLongitude: item.checkedOutLongitude
    })),
    requirementSummaries: bootstrap.requirementSummaries.map((item) => ({
      taskId: item.taskId,
      requiredBeforePhoto: item.requiredBeforePhoto,
      requiredAfterPhoto: item.requiredAfterPhoto,
      beforeUploaded: item.beforeUploaded,
      afterUploaded: item.afterUploaded,
      supportingCount: item.supportingCount,
      missingTypes: [...item.missingTypes],
      complete: item.complete
    })),
    pendingSyncOperations: [],
    users: [],
    workflowRules: []
  };
}

export function restoreBootstrapFromOfflineCache(payload: OfflineBootstrapCachePayload): EvidenceBootstrap {
  return {
    ...payload,
    pendingSyncOperations: [],
    users: [],
    workflowRules: []
  };
}
