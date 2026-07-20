import type { FinanceState } from "../types";
import type { BackupMeta } from "../backup";

export interface FinanceRepository {
  loadState(): Promise<FinanceState>;
  saveState(state: FinanceState): Promise<void>;
  createBackup(state: FinanceState, label?: string): Promise<BackupMeta>;
  restoreBackup(backupId: string): Promise<FinanceState | null>;
  loadBackupList(): Promise<BackupMeta[]>;
}
