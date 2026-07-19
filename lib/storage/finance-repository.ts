import type { FinanceState } from "../types";
import type { BackupMeta } from "../backup";

export interface FinanceRepository {
  loadState(): FinanceState;
  saveState(state: FinanceState): void;
  createBackup(state: FinanceState, label?: string): BackupMeta;
  restoreBackup(backupId: string): FinanceState | null;
  loadBackupList(): BackupMeta[];
}
