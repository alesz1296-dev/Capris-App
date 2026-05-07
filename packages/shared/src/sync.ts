export type SyncState = "pending_sync" | "sync_failed" | "needs_review" | "synced";

export type SyncOperationType =
  | "task_update"
  | "visit_check_in"
  | "visit_check_out"
  | "photo_upload"
  | "comment_create"
  | "observation_create"
  | "consignation_prepare"
  | "consignation_send"
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

