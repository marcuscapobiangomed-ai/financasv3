import type { FinanceState } from "./types";
import { logger } from "./logger";
import { sanitizeString } from "./security";

const BACKUP_KEYS = {
  manual: "meu-financeiro-backups",
  auto: "meu-financeiro-auto-backups",
};

export type BackupMeta = {
  id: string;
  timestamp: string;
  label: string;
  entryCount: number;
  version: string;
};

export function exportState(state: FinanceState): { json: string; csv: string; entriesCount: number } {
  const json = JSON.stringify(state, null, 2);
  const header = "data,descricao,valor,tipo,categoria,status,conta,pago_por,qualidade,oficial,parcela";
  const rows = state.entries.map((e) => {
    const date = e.dueDate;
    const desc = sanitizeString(e.title);
    const val = e.kind === "income" ? String(e.amount) : `-${e.amount}`;
    return [date, desc, val, e.kind, e.category, e.status, e.account ?? "", e.paidBy ?? "", e.dataQuality ?? "", e.isOfficial ? "1" : "0", e.installment ?? ""].map((v) => `"${v}"`).join(",");
  });
  return {
    json,
    csv: [header, ...rows].join("\n"),
    entriesCount: state.entries.length,
  };
}

export function createBackup(state: FinanceState, label?: string): BackupMeta {
  const meta: BackupMeta = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    label: label || `Backup ${new Date().toLocaleDateString("pt-BR")}`,
    entryCount: state.entries.length,
    version: "0.1.0",
  };
  try {
    const backups = loadBackupList();
    const backupData = { meta, state };
    backups.push(meta);
    while (backups.length > 50) backups.shift();
    localStorage.setItem(BACKUP_KEYS.manual, JSON.stringify(backups));
    localStorage.setItem(`backup-${meta.id}`, JSON.stringify(backupData));
    logger.info("export", "Manual backup created", { id: meta.id, entries: meta.entryCount });
  } catch (err) {
    logger.error("export", "Failed to create manual backup", { error: String(err) });
    throw new Error("Não foi possível criar o backup.");
  }
  return meta;
}

export function loadBackupList(): BackupMeta[] {
  try {
    const raw = localStorage.getItem(BACKUP_KEYS.manual);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function restoreFromBackup(backupId: string): FinanceState | null {
  try {
    const raw = localStorage.getItem(`backup-${backupId}`);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data?.state?.entries) {
      logger.info("export", "Backup restored", { id: backupId, entries: data.state.entries.length });
      return data.state as FinanceState;
    }
    return null;
  } catch (err) {
    logger.error("export", "Failed to restore backup", { id: backupId, error: String(err) });
    return null;
  }
}

export function exportCSV(state: FinanceState): void {
  const { csv, entriesCount } = exportState(state);
  downloadFile(csv, `financas-${new Date().toISOString().slice(0, 10)}.csv`, "text/csv;charset=utf-8");
  logger.info("export", "CSV exported", { entries: entriesCount });
}

export function exportJSON(state: FinanceState): void {
  const { json, entriesCount } = exportState(state);
  downloadFile(json, `financas-${new Date().toISOString().slice(0, 10)}.json`, "application/json");
  logger.info("export", "JSON exported", { entries: entriesCount });
}

export function exportFullBackup(state: FinanceState): void {
  const backup = createBackup(state, `Backup completo ${new Date().toISOString().slice(0, 10)}`);
  const fullData = {
    exportedAt: new Date().toISOString(),
    version: "0.1.0",
    state: state,
    backupId: backup.id,
  };
  downloadFile(JSON.stringify(fullData, null, 2), `backup-financas-${new Date().toISOString().slice(0, 10)}.json`, "application/json");
  logger.info("export", "Full backup exported", { id: backup.id, entries: backup.entryCount });
}

export function importFromJSON(jsonString: string): FinanceState | null {
  try {
    const data = JSON.parse(jsonString);
    const state = data.state || data;
    if (!state.entries || !Array.isArray(state.entries)) {
      logger.error("export", "Invalid JSON import — missing entries");
      return null;
    }
    if (!state.accounts || !Array.isArray(state.accounts)) {
      logger.error("export", "Invalid JSON import — missing accounts");
      return null;
    }
    logger.info("export", "JSON data imported successfully", { entries: state.entries.length });
    return state as FinanceState;
  } catch (err) {
    logger.error("export", "Failed to parse JSON import", { error: String(err) });
    return null;
  }
}

export function restoreFromAutoBackup(): FinanceState | null {
  try {
    const raw = localStorage.getItem(BACKUP_KEYS.auto);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data?.entries) {
      logger.info("export", "Auto backup restored");
      return data as FinanceState;
    }
    return null;
  } catch {
    return null;
  }
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
