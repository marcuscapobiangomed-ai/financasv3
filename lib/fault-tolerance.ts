import { logger } from "./logger";

const FORM_DRAFT_KEY = "meu-financeiro-form-draft";
const IMPORT_CHUNK_KEY = "meu-financeiro-import-chunk";
const OFFLINE_QUEUE_KEY = "meu-financeiro-offline-queue";
const LAST_SYNC_KEY = "meu-financeiro-last-sync";

type PendingOperation = {
  id: string;
  type: "create" | "update" | "delete";
  payload: unknown;
  timestamp: string;
  retries: number;
};

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

export function saveFormDraft(data: unknown) {
  try {
    sessionStorage.setItem(FORM_DRAFT_KEY, JSON.stringify(data));
  } catch { /* quota exceeded — silently ignore */ }
}

export function loadFormDraft<T>(): T | null {
  try {
    const raw = sessionStorage.getItem(FORM_DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function clearFormDraft() {
  try { sessionStorage.removeItem(FORM_DRAFT_KEY); } catch { /* ignore */ }
}

export function saveImportChunk(data: unknown) {
  try {
    sessionStorage.setItem(IMPORT_CHUNK_KEY, JSON.stringify(data));
  } catch { /* ignore */ }
}

export function loadImportChunk<T>(): T | null {
  try {
    const raw = sessionStorage.getItem(IMPORT_CHUNK_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function clearImportChunk() {
  try { sessionStorage.removeItem(IMPORT_CHUNK_KEY); } catch { /* ignore */ }
}

export function isOnline(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}

export function enqueueOperation(op: Omit<PendingOperation, "id" | "timestamp" | "retries">) {
  try {
    const queue = loadQueue();
    queue.push({ ...op, id: crypto.randomUUID(), timestamp: new Date().toISOString(), retries: 0 });
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    logger.info("sync", "Operation queued for offline sync", { type: op.type });
  } catch (err) {
    logger.error("sync", "Failed to enqueue offline operation", { error: String(err) });
  }
}

export function loadQueue(): PendingOperation[] {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function processQueue(processor: (op: PendingOperation) => boolean): { processed: number; failed: number } {
  const queue = loadQueue();
  let processed = 0;
  let failed = 0;
  const remaining: PendingOperation[] = [];

  for (const op of queue) {
    if (op.retries >= MAX_RETRIES) {
      logger.error("sync", "Operation permanently failed after max retries", { id: op.id, type: op.type });
      continue;
    }
    try {
      const success = processor(op);
      if (success) {
        processed++;
        logger.info("sync", "Offline operation processed", { id: op.id, type: op.type });
      } else {
        op.retries++;
        remaining.push(op);
        failed++;
      }
    } catch {
      op.retries++;
      remaining.push(op);
      failed++;
    }
  }

  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
    updateLastSync();
  } catch { /* ignore */ }
  return { processed, failed };
}

export function getLastSync(): string | null {
  return localStorage.getItem(LAST_SYNC_KEY);
}

function updateLastSync() {
  localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
}

export function retryLater(op: PendingOperation): Promise<boolean> {
  return new Promise((resolve) => {
    setTimeout(async () => {
      try {
        resolve(true);
      } catch {
        resolve(false);
      }
    }, RETRY_DELAY_MS * Math.pow(2, op.retries));
  });
}

export type ConnectionStatus = "online" | "offline" | "slow";

export function getConnectionStatus(): ConnectionStatus {
  if (!isOnline()) return "offline";
  if ("connection" in navigator) {
    const conn = (navigator as any).connection;
    if (conn?.effectiveType === "slow-2g" || conn?.effectiveType === "2g" || conn?.saveData) {
      return "slow";
    }
  }
  return "online";
}
