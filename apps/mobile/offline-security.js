"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOfflineEncryptionKey = createOfflineEncryptionKey;
exports.encryptOfflineJson = encryptOfflineJson;
exports.decryptOfflineJson = decryptOfflineJson;
exports.minimizeBootstrapForOfflineCache = minimizeBootstrapForOfflineCache;
exports.restoreBootstrapFromOfflineCache = restoreBootstrapFromOfflineCache;
const crypto_js_1 = __importDefault(require("crypto-js"));
const ENCRYPTED_PAYLOAD_PREFIX = "enc:v1:";
function createOfflineEncryptionKey() {
    return crypto_js_1.default.lib.WordArray.random(32).toString(crypto_js_1.default.enc.Hex);
}
function encryptOfflineJson(plaintext, key) {
    if (!plaintext.trim()) {
        throw new Error("Cannot encrypt empty offline payloads.");
    }
    return `${ENCRYPTED_PAYLOAD_PREFIX}${crypto_js_1.default.AES.encrypt(plaintext, key).toString()}`;
}
function decryptOfflineJson(ciphertext, key) {
    if (!ciphertext.startsWith(ENCRYPTED_PAYLOAD_PREFIX)) {
        throw new Error("Offline payload is missing the expected encryption prefix.");
    }
    const encryptedBody = ciphertext.slice(ENCRYPTED_PAYLOAD_PREFIX.length);
    const decrypted = crypto_js_1.default.AES.decrypt(encryptedBody, key).toString(crypto_js_1.default.enc.Utf8);
    if (!decrypted.trim()) {
        throw new Error("Offline payload could not be decrypted.");
    }
    return decrypted;
}
function minimizeBootstrapForOfflineCache(bootstrap) {
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
            contactEmail: item.contactEmail
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
            clientId: item.clientId,
            name: item.name,
            latitude: item.latitude,
            longitude: item.longitude
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
function restoreBootstrapFromOfflineCache(payload) {
    return {
        ...payload,
        pendingSyncOperations: [],
        users: [],
        workflowRules: []
    };
}
