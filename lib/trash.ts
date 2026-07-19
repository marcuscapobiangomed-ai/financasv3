const TRASH_KEY = "meu-financeiro-trash";

export type TrashItem = {
  id: string;
  entry: Record<string, unknown>;
  deletedAt: string;
  reason?: string;
  originalPeriod: string;
};

function loadAll(): TrashItem[] {
  try {
    const raw = localStorage.getItem(TRASH_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persist(items: TrashItem[]) {
  try {
    localStorage.setItem(TRASH_KEY, JSON.stringify(items));
  } catch {
    const trimmed = items.slice(-200);
    try {
      localStorage.setItem(TRASH_KEY, JSON.stringify(trimmed));
    } catch { /* ignore */ }
  }
}

export function trashEntry(
  entry: Record<string, unknown>,
  reason?: string
): void {
  const items = loadAll();
  const period =
    typeof entry.dueDate === "string"
      ? entry.dueDate.slice(0, 7)
      : "unknown";
  items.push({
    id: crypto.randomUUID(),
    entry: { ...entry },
    deletedAt: new Date().toISOString(),
    reason,
    originalPeriod: period,
  });
  persist(items);
}

export function restoreFromTrash(trashId: string): Record<string, unknown> | null {
  const items = loadAll();
  const idx = items.findIndex((t) => t.id === trashId);
  if (idx === -1) return null;
  const restored = items[idx].entry;
  items.splice(idx, 1);
  persist(items);
  return restored;
}

export function getTrashItems(period?: string): TrashItem[] {
  const items = loadAll().sort(
    (a, b) => b.deletedAt.localeCompare(a.deletedAt)
  );
  if (period) return items.filter((t) => t.originalPeriod === period);
  return items;
}

export function getTrashCount(period?: string): number {
  return period
    ? loadAll().filter((t) => t.originalPeriod === period).length
    : loadAll().length;
}

export function emptyTrash(): void {
  try {
    localStorage.removeItem(TRASH_KEY);
  } catch { /* ignore */ }
}
