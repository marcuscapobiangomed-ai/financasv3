const AUDIT_KEY = "meu-financeiro-audit";
const MAX_VERSIONS_PER_ENTRY = 50;

export type AuditAction =
  | "created"
  | "updated"
  | "deleted"
  | "restored"
  | "settled"
  | "reopened";

export type AuditEntry = {
  id: string;
  entryId: string;
  timestamp: string;
  action: AuditAction;
  changes: Array<{
    field: string;
    oldValue: unknown;
    newValue: unknown;
  }>;
  snapshot: Record<string, unknown>;
  reason?: string;
  version: number;
};

function loadAll(): AuditEntry[] {
  try {
    const raw = localStorage.getItem(AUDIT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persist(entries: AuditEntry[]) {
  try {
    localStorage.setItem(AUDIT_KEY, JSON.stringify(entries));
  } catch {
    /* quota exceeded — trim aggressively */
    const trimmed = entries.slice(-1000);
    try {
      localStorage.setItem(AUDIT_KEY, JSON.stringify(trimmed));
    } catch {
      /* ignore */
    }
  }
}

export function getAuditTrail(entryId: string): AuditEntry[] {
  return loadAll()
    .filter((a) => a.entryId === entryId)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export function getAuditStats() {
  const all = loadAll();
  const now = Date.now();
  return {
    total: all.length,
    last7d: all.filter((a) => now - new Date(a.timestamp).getTime() < 7 * 86400000).length,
    editedEntries: new Set(all.map((a) => a.entryId)).size,
    recentActions: all.slice(-20).reverse(),
  };
}

export function recordAudit(
  entryId: string,
  action: AuditAction,
  changes: Array<{ field: string; oldValue: unknown; newValue: unknown }>,
  snapshot: Record<string, unknown>,
  reason?: string
) {
  const all = loadAll();
  const entryAudits = all.filter((a) => a.entryId === entryId);
  const version = entryAudits.length + 1;

  const audit: AuditEntry = {
    id: crypto.randomUUID(),
    entryId,
    timestamp: new Date().toISOString(),
    action,
    changes: changes.filter((c) => String(c.oldValue) !== String(c.newValue)),
    snapshot,
    reason,
    version,
  };

  all.push(audit);

  // Trim per-entry to avoid unbounded growth
  const trimmed = all
    .reverse()
    .filter((a) => {
      if (a.entryId !== entryId) return true;
      const idx = entryAudits.indexOf(a);
      return idx < MAX_VERSIONS_PER_ENTRY;
    })
    .reverse();

  persist(trimmed);
}

export function restoreSnapshot(
  entryId: string,
  targetVersion: number
): Record<string, unknown> | null {
  const all = loadAll()
    .filter((a) => a.entryId === entryId)
    .sort((a, b) => b.version - a.version);

  // Find the audit whose version is the target
  // We restore to the state BEFORE that version
  // Actually, we restore to the snapshot of the target version
  const target = all.find((a) => a.version === targetVersion);
  return target?.snapshot ?? null;
}

export function getAllAuditEntries(): AuditEntry[] {
  return loadAll().sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}
