import * as SecureStore from "expo-secure-store";
import * as FileSystem from "expo-file-system";
import * as SQLite from "expo-sqlite";
import {
  createOfflineEncryptionKey,
  decryptOfflineJson,
  encryptOfflineJson,
  minimizeBootstrapForOfflineCache,
  restoreBootstrapFromOfflineCache,
  type EvidenceBootstrap,
  type SyncOperation
} from "@capris/shared";

const DATABASE_NAME = "capris-offline.db";
const BOOTSTRAP_CACHE_KEY = "route-day-bootstrap";
const AUTH_SESSION_KEY = "auth-session";
const SYNC_PAYLOAD_SECURE_PREFIX = "sync-operation-payload:";
const SYNC_PAYLOAD_FILE_DIRECTORY = `${FileSystem.documentDirectory ?? ""}sync-operation-payloads/`;
const OFFLINE_ENCRYPTION_KEY = "offline-encryption-key";
const SECURE_STORE_OPTIONS = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
} as const;

type StoredSyncOperationRow = {
  id: string;
  type: string;
  state: string;
  payload_json: string | null;
  payload_storage_kind: string | null;
  payload_ref: string | null;
  retry_count: number;
  created_at: string;
  last_attempt_at: string | null;
  error_message: string | null;
};

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getDatabase() {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync(DATABASE_NAME);
  }

  return databasePromise;
}

export async function initializeOfflineStore() {
  const database = await getDatabase();
  await ensureSyncPayloadDirectory();
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS bootstrap_cache (
      cache_key TEXT PRIMARY KEY NOT NULL,
      payload_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS auth_session_cache (
      session_key TEXT PRIMARY KEY NOT NULL,
      payload_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sync_operations (
      id TEXT PRIMARY KEY NOT NULL,
      type TEXT NOT NULL,
      state TEXT NOT NULL,
      payload_json TEXT,
      payload_storage_kind TEXT,
      payload_ref TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      last_attempt_at TEXT,
      error_message TEXT
    );
  `);
  await database.execAsync(`
    ALTER TABLE sync_operations ADD COLUMN payload_storage_kind TEXT;
  `).catch(() => undefined);
  await database.execAsync(`
    ALTER TABLE sync_operations ADD COLUMN payload_ref TEXT;
  `).catch(() => undefined);
}

export async function loadAuthSession<TValue>(): Promise<TValue | null> {
  const payloadJson = await SecureStore.getItemAsync(AUTH_SESSION_KEY, SECURE_STORE_OPTIONS);
  if (!payloadJson) {
    return null;
  }

  return JSON.parse(payloadJson) as TValue;
}

export async function saveAuthSession(payload: unknown) {
  const database = await getDatabase();
  await database.runAsync("DELETE FROM auth_session_cache WHERE session_key = ?", AUTH_SESSION_KEY);
  await SecureStore.setItemAsync(AUTH_SESSION_KEY, JSON.stringify(payload), SECURE_STORE_OPTIONS);
}

export async function clearAuthSession() {
  const database = await getDatabase();
  await database.runAsync("DELETE FROM auth_session_cache WHERE session_key = ?", AUTH_SESSION_KEY);
  await SecureStore.deleteItemAsync(AUTH_SESSION_KEY, SECURE_STORE_OPTIONS);
}

export async function loadCachedBootstrap(): Promise<EvidenceBootstrap | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ payload_json: string }>(
    "SELECT payload_json FROM bootstrap_cache WHERE cache_key = ?",
    BOOTSTRAP_CACHE_KEY
  );

  if (!row?.payload_json) {
    return null;
  }

  try {
    const encryptionKey = await getOrCreateOfflineEncryptionKey();
    return restoreBootstrapFromOfflineCache(JSON.parse(decryptOfflineJson(row.payload_json, encryptionKey)));
  } catch {
    await database.runAsync("DELETE FROM bootstrap_cache WHERE cache_key = ?", BOOTSTRAP_CACHE_KEY);
    return null;
  }
}

export async function saveBootstrapCache(bootstrap: EvidenceBootstrap) {
  const database = await getDatabase();
  const encryptionKey = await getOrCreateOfflineEncryptionKey();
  const minimizedBootstrap = minimizeBootstrapForOfflineCache(bootstrap);
  await database.runAsync(
    `
      INSERT INTO bootstrap_cache (cache_key, payload_json, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(cache_key) DO UPDATE SET
        payload_json = excluded.payload_json,
        updated_at = excluded.updated_at
    `,
    BOOTSTRAP_CACHE_KEY,
    encryptOfflineJson(JSON.stringify(minimizedBootstrap), encryptionKey),
    new Date().toISOString()
  );
}

export async function loadSyncOperations(): Promise<SyncOperation[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<StoredSyncOperationRow>(
    "SELECT * FROM sync_operations ORDER BY created_at ASC"
  );

  const operations: SyncOperation[] = [];

  for (const row of rows) {
    const payload = await loadStoredPayload(row);
    if (!payload) {
      await database.runAsync("DELETE FROM sync_operations WHERE id = ?", row.id);
      await removeStoredSyncPayload(row.id);
      continue;
    }

    operations.push({
      id: row.id,
      type: row.type as SyncOperation["type"],
      state: row.state as SyncOperation["state"],
      payload,
      retryCount: row.retry_count,
      createdAt: row.created_at,
      lastAttemptAt: row.last_attempt_at ?? undefined,
      errorMessage: row.error_message ?? undefined
    });
  }

  return operations;
}

export async function enqueueSyncOperation(operation: SyncOperation) {
  const database = await getDatabase();
  const storedPayload = await persistSyncPayload(operation);
  await database.runAsync(
    `
      INSERT OR REPLACE INTO sync_operations (
        id,
        type,
        state,
        payload_json,
        payload_storage_kind,
        payload_ref,
        retry_count,
        created_at,
        last_attempt_at,
        error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    operation.id,
    operation.type,
    operation.state,
    storedPayload.payloadJson,
    storedPayload.storageKind,
    storedPayload.payloadRef,
    operation.retryCount,
    operation.createdAt,
    operation.lastAttemptAt ?? null,
    operation.errorMessage ?? null
  );
}

export async function updateSyncOperation(operation: SyncOperation) {
  await enqueueSyncOperation(operation);
}

export async function removeSyncOperation(id: string) {
  const database = await getDatabase();
  await database.runAsync("DELETE FROM sync_operations WHERE id = ?", id);
  await removeStoredSyncPayload(id);
}

async function ensureSyncPayloadDirectory() {
  if (!FileSystem.documentDirectory) {
    return;
  }

  const directoryInfo = await FileSystem.getInfoAsync(SYNC_PAYLOAD_FILE_DIRECTORY);
  if (!directoryInfo.exists) {
    await FileSystem.makeDirectoryAsync(SYNC_PAYLOAD_FILE_DIRECTORY, { intermediates: true });
  }
}

async function persistSyncPayload(operation: SyncOperation) {
  await removeStoredSyncPayload(operation.id);
  const encryptionKey = await getOrCreateOfflineEncryptionKey();

  if (operation.type === "photo_upload") {
    await ensureSyncPayloadDirectory();
    const payloadRef = `${SYNC_PAYLOAD_FILE_DIRECTORY}${operation.id}.json`;
    await FileSystem.writeAsStringAsync(payloadRef, encryptOfflineJson(JSON.stringify(operation.payload), encryptionKey));
    return {
      payloadJson: null,
      storageKind: "file",
      payloadRef
    };
  }

  const payloadRef = `${SYNC_PAYLOAD_SECURE_PREFIX}${operation.id}`;
  await SecureStore.setItemAsync(payloadRef, JSON.stringify(operation.payload), SECURE_STORE_OPTIONS);
  return {
    payloadJson: null,
    storageKind: "secure_store",
    payloadRef
  };
}

async function loadStoredPayload(row: StoredSyncOperationRow): Promise<SyncOperation["payload"] | null> {
  const encryptionKey = await getOrCreateOfflineEncryptionKey();

  if (row.payload_storage_kind === "secure_store" && row.payload_ref) {
    const payloadJson = await SecureStore.getItemAsync(row.payload_ref, SECURE_STORE_OPTIONS);
    return payloadJson ? JSON.parse(payloadJson) : null;
  }

  if (row.payload_storage_kind === "file" && row.payload_ref) {
    const fileInfo = await FileSystem.getInfoAsync(row.payload_ref).catch(() => null);
    if (!fileInfo?.exists) {
      return null;
    }

    try {
      const payloadCiphertext = await FileSystem.readAsStringAsync(row.payload_ref);
      return JSON.parse(decryptOfflineJson(payloadCiphertext, encryptionKey));
    } catch {
      return null;
    }
  }

  if (row.payload_json && row.payload_storage_kind !== "file") {
    try {
      return JSON.parse(row.payload_json);
    } catch {
      return null;
    }
  }

  return null;
}

async function getOrCreateOfflineEncryptionKey() {
  const existingKey = await SecureStore.getItemAsync(OFFLINE_ENCRYPTION_KEY, SECURE_STORE_OPTIONS);
  if (existingKey) {
    return existingKey;
  }

  const generatedKey = createOfflineEncryptionKey();
  await SecureStore.setItemAsync(OFFLINE_ENCRYPTION_KEY, generatedKey, SECURE_STORE_OPTIONS);
  return generatedKey;
}

async function removeStoredSyncPayload(operationId: string) {
  const secureStoreKey = `${SYNC_PAYLOAD_SECURE_PREFIX}${operationId}`;
  await SecureStore.deleteItemAsync(secureStoreKey, SECURE_STORE_OPTIONS).catch(() => undefined);

  if (!FileSystem.documentDirectory) {
    return;
  }

  const filePath = `${SYNC_PAYLOAD_FILE_DIRECTORY}${operationId}.json`;
  const fileInfo = await FileSystem.getInfoAsync(filePath).catch(() => null);
  if (fileInfo?.exists) {
    await FileSystem.deleteAsync(filePath, { idempotent: true }).catch(() => undefined);
  }
}
