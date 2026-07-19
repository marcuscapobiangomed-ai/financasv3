import type { FinanceRepository } from "./finance-repository";
import type { FinanceState } from "../types";
import { initialFinanceState } from "../seed";
import { createBackup, restoreFromBackup, loadBackupList } from "../backup";

const STORAGE_KEY = "meu-financeiro-v3";

export class LocalStorageRepository implements FinanceRepository {
  loadState(): FinanceState {
    if (typeof window === "undefined") {
      return initialFinanceState;
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.entries)) {
          return parsed as FinanceState;
        }
      }
    } catch (err) {
      console.error("Failed to load finance state from localStorage:", err);
    }
    return initialFinanceState;
  }

  saveState(state: FinanceState): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.error("Failed to save finance state to localStorage:", err);
    }
  }

  createBackup(state: FinanceState, label?: string) {
    return createBackup(state, label);
  }

  restoreBackup(backupId: string): FinanceState | null {
    return restoreFromBackup(backupId);
  }

  loadBackupList() {
    return loadBackupList();
  }
}
export const financeRepository: FinanceRepository = new LocalStorageRepository();
