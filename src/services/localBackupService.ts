import { DATABASE_NAME, DATABASE_VERSION, database } from '../repositories/database';

const BACKUP_SCHEMA_VERSION = 'daon-local-backup-v1';
const LOCAL_STORAGE_PREFIX = 'daon:';

type EncodedBinary = { __daonBinary: 'blob' | 'arraybuffer'; mimeType?: string; base64: string };
type BackupStoreRow = { key: unknown; value: unknown };

export interface DaonLocalBackup {
  schemaVersion: typeof BACKUP_SCHEMA_VERSION;
  createdAt: string;
  databaseName: string;
  databaseVersion: number;
  stores: Record<string, BackupStoreRow[]>;
  localStorage: Record<string, string>;
}

export interface BackupPreview {
  schemaVersion: string;
  createdAt: string;
  databaseVersion: number;
  storeCount: number;
  recordCount: number;
  localStorageCount: number;
  storeCounts: Array<{ name: string; count: number }>;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
  return btoa(binary);
}

function base64ToBytes(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function encodeValue(value: unknown): Promise<unknown> {
  if (value instanceof Blob) {
    return { __daonBinary: 'blob', mimeType: value.type, base64: bytesToBase64(new Uint8Array(await value.arrayBuffer())) } satisfies EncodedBinary;
  }
  if (value instanceof ArrayBuffer) {
    return { __daonBinary: 'arraybuffer', base64: bytesToBase64(new Uint8Array(value)) } satisfies EncodedBinary;
  }
  if (ArrayBuffer.isView(value)) {
    const view = value as ArrayBufferView;
    const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
    return { __daonBinary: 'arraybuffer', base64: bytesToBase64(bytes) } satisfies EncodedBinary;
  }
  if (Array.isArray(value)) return Promise.all(value.map(encodeValue));
  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) output[key] = await encodeValue(item);
    return output;
  }
  return value;
}

async function decodeValue(value: unknown): Promise<unknown> {
  if (Array.isArray(value)) return Promise.all(value.map(decodeValue));
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (record.__daonBinary === 'blob' && typeof record.base64 === 'string') {
      const bytes = base64ToBytes(record.base64);
      return new Blob([bytes], { type: typeof record.mimeType === 'string' ? record.mimeType : '' });
    }
    if (record.__daonBinary === 'arraybuffer' && typeof record.base64 === 'string') return base64ToBytes(record.base64).buffer;
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(record)) output[key] = await decodeValue(item);
    return output;
  }
  return value;
}

function readDaonLocalStorage() {
  const result: Record<string, string> = {};
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.startsWith(LOCAL_STORAGE_PREFIX)) result[key] = localStorage.getItem(key) ?? '';
  }
  return result;
}

function validateBackup(value: unknown): asserts value is DaonLocalBackup {
  if (!value || typeof value !== 'object') throw new Error('백업 파일 형식이 올바르지 않습니다.');
  const backup = value as Partial<DaonLocalBackup>;
  if (backup.schemaVersion !== BACKUP_SCHEMA_VERSION || !backup.stores || typeof backup.stores !== 'object') throw new Error('지원하지 않는 DA:ON 백업 파일입니다.');
}

export const localBackupService = {
  async create(): Promise<DaonLocalBackup> {
    const db = await database;
    const stores: Record<string, BackupStoreRow[]> = {};
    for (const storeName of Array.from(db.objectStoreNames)) {
      const tx = db.transaction(storeName, 'readonly');
      const [keys, values] = await Promise.all([tx.store.getAllKeys(), tx.store.getAll()]);
      await tx.done;
      stores[storeName] = await Promise.all(values.map(async (value, index) => ({ key: await encodeValue(keys[index]), value: await encodeValue(value) })));
    }
    return {
      schemaVersion: BACKUP_SCHEMA_VERSION,
      createdAt: new Date().toISOString(),
      databaseName: DATABASE_NAME,
      databaseVersion: DATABASE_VERSION,
      stores,
      localStorage: readDaonLocalStorage(),
    };
  },

  stringify(backup: DaonLocalBackup) { return JSON.stringify(backup); },

  parse(text: string): DaonLocalBackup {
    const parsed = JSON.parse(text) as unknown;
    validateBackup(parsed);
    return parsed;
  },

  preview(backup: DaonLocalBackup): BackupPreview {
    const storeCounts = Object.entries(backup.stores).map(([name, rows]) => ({ name, count: rows.length })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    return {
      schemaVersion: backup.schemaVersion,
      createdAt: backup.createdAt,
      databaseVersion: backup.databaseVersion,
      storeCount: storeCounts.length,
      recordCount: storeCounts.reduce((sum, item) => sum + item.count, 0),
      localStorageCount: Object.keys(backup.localStorage || {}).length,
      storeCounts,
    };
  },

  async restore(backup: DaonLocalBackup, mode: 'merge' | 'replace') {
    validateBackup(backup);
    const db = await database;
    const availableStores = new Set(Array.from(db.objectStoreNames));
    let restoredRecords = 0;
    for (const [storeName, rows] of Object.entries(backup.stores)) {
      if (!availableStores.has(storeName)) continue;
      const tx = db.transaction(storeName, 'readwrite');
      if (mode === 'replace') await tx.store.clear();
      for (const row of rows) {
        const value = await decodeValue(row.value);
        const key = await decodeValue(row.key);
        if (tx.store.keyPath == null) await tx.store.put(value, key as IDBValidKey);
        else await tx.store.put(value);
        restoredRecords += 1;
      }
      await tx.done;
    }
    if (mode === 'replace') {
      const keysToRemove: string[] = [];
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (key?.startsWith(LOCAL_STORAGE_PREFIX)) keysToRemove.push(key);
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));
    }
    for (const [key, value] of Object.entries(backup.localStorage || {})) if (key.startsWith(LOCAL_STORAGE_PREFIX)) localStorage.setItem(key, value);
    return { restoredRecords, restoredLocalStorage: Object.keys(backup.localStorage || {}).length, mode };
  },
};
