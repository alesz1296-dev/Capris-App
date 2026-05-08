export type SyncState = "pending_sync" | "sync_failed" | "needs_review" | "synced";

export type SyncOperationType =
  | "task_update"
  | "visit_check_in"
  | "visit_check_out"
  | "photo_upload"
  | "comment_create"
  | "observation_create"
  | "consignation_prepare"
  | "consignation_review"
  | "consignation_fail"
  | "consignation_send"
  | "activity_create"
  | "exhibition_create"
  | "reminder_acknowledge";

export interface SyncOperation {
  id: string;
  type: SyncOperationType;
  state: SyncState;
  payload: unknown;
  retryCount: number;
  createdAt: string;
  lastAttemptAt?: string;
  errorMessage?: string;
}

export interface TaskUpdateSyncPayload {
  taskId: string;
  patch: Record<string, unknown>;
}

export interface VisitCheckInSyncPayload {
  visitId: string;
  checkedInAt: string;
  checkedInLatitude: number;
  checkedInLongitude: number;
}

export interface VisitCheckOutSyncPayload {
  visitId: string;
  checkedOutAt: string;
  checkedOutLatitude: number;
  checkedOutLongitude: number;
}

export interface PhotoUploadSyncPayload {
  uploadRequest: {
    organizationId: string;
    taskId: string;
    visitId?: string;
    uploaderUserId: string;
    type: "before" | "after" | "supporting";
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
  };
  localEvidenceId: string;
  localMediaAssetId: string;
}

export interface CommentCreateSyncPayload {
  organizationId: string;
  taskId: string;
  userId: string;
  body: string;
  createdAt: string;
}

export interface ObservationCreateSyncPayload {
  organizationId: string;
  taskId: string;
  userId: string;
  body: string;
  createdAt: string;
}

export interface ConsignationPrepareSyncPayload {
  localConsignationId: string;
  organizationId: string;
  taskId: string;
  userId: string;
  visitId?: string;
  note?: string;
  preparedAt: string;
}

export interface ConsignationSendSyncPayload {
  consignationId: string;
  sentAt: string;
  localConsignationId?: string;
}

export interface ConsignationReviewSyncPayload {
  consignationId: string;
  reviewedAt: string;
  recipientEmails: string[];
  emailSubject: string;
  emailBody: string;
  beforeEvidenceId?: string;
  afterEvidenceId?: string;
  localConsignationId?: string;
}

export interface ConsignationFailSyncPayload {
  consignationId: string;
  failedAt: string;
  reason: string;
  localConsignationId?: string;
}

export interface ActivityCreateSyncPayload {
  organizationId: string;
  taskId: string;
  userId: string;
  visitId?: string;
  pointOfSaleId?: string;
  quantity: number;
  note?: string;
  recordedAt: string;
}

export interface ExhibitionCreateSyncPayload {
  organizationId: string;
  taskId: string;
  userId: string;
  visitId?: string;
  pointOfSaleId?: string;
  quantity: number;
  note?: string;
  recordedAt: string;
}

export interface ReminderAcknowledgeSyncPayload {
  reminderId: string;
  acknowledgedAt: string;
}
