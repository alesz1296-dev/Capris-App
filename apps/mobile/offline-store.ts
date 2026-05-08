import * as SQLite from "expo-sqlite";
import type { EvidenceBootstrap, SyncOperation } from "@capris/shared";

const DATABASE_NAME = "capris-offline.db";
const BOOTSTRAP_CACHE_KEY = "route-day-bootstrap";
const AUTH_SESSION_KEY = "auth-session";

type StoredSyncOperationRow = {
  id: string;
  type: string;
  state: string;
  payload_json: string;
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
      payload_json TEXT NOT NULL,
      retry_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      last_attempt_at TEXT,
      error_message TEXT
    );
  `);
}

export async function loadAuthSession<TValue>(): Promise<TValue | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ payload_json: string }>(
    "SELECT payload_json FROM auth_session_cache WHERE session_key = ?",
    AUTH_SESSION_KEY
  );

  if (!row?.payload_json) {
    return null;
  }

  return JSON.parse(row.payload_json) as TValue;
}

export async function saveAuthSession(payload: unknown) {
  const database = await getDatabase();
  await database.runAsync(
    `
      INSERT INTO auth_session_cache (session_key, payload_json, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(session_key) DO UPDATE SET
        payload_json = excluded.payload_json,
        updated_at = excluded.updated_at
    `,
    AUTH_SESSION_KEY,
    JSON.stringify(payload),
    new Date().toISOString()
  );
}

export async function clearAuthSession() {
  const database = await getDatabase();
  await database.runAsync("DELETE FROM auth_session_cache WHERE session_key = ?", AUTH_SESSION_KEY);
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

  return JSON.parse(row.payload_json) as EvidenceBootstrap;
}

export async function saveBootstrapCache(bootstrap: EvidenceBootstrap) {
  const database = await getDatabase();
  await database.runAsync(
    `
      INSERT INTO bootstrap_cache (cache_key, payload_json, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(cache_key) DO UPDATE SET
        payload_json = excluded.payload_json,
        updated_at = excluded.updated_at
    `,
    BOOTSTRAP_CACHE_KEY,
    JSON.stringify(bootstrap),
    new Date().toISOString()
  );
}

export async function loadSyncOperations(): Promise<SyncOperation[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<StoredSyncOperationRow>(
    "SELECT * FROM sync_operations ORDER BY created_at ASC"
  );

  return rows.map((row) => ({
    id: row.id,
    type: row.type as SyncOperation["type"],
    state: row.state as SyncOperation["state"],
    payload: JSON.parse(row.payload_json),
    retryCount: row.retry_count,
    createdAt: row.created_at,
    lastAttemptAt: row.last_attempt_at ?? undefined,
    errorMessage: row.error_message ?? undefined
  }));
}

export async function enqueueSyncOperation(operation: SyncOperation) {
  const database = await getDatabase();
  await database.runAsync(
    `
      INSERT OR REPLACE INTO sync_operations (
        id,
        type,
        state,
        payload_json,
        retry_count,
        created_at,
        last_attempt_at,
        error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    operation.id,
    operation.type,
    operation.state,
    JSON.stringify(operation.payload),
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
}
