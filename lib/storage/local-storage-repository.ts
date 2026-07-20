import type { FinanceRepository } from "./finance-repository";
import type { FinanceState } from "../types";
import { initialFinanceState } from "../seed";
import { createBackup, restoreFromBackup, loadBackupList } from "../backup";

const STORAGE_KEY = "meu-financeiro-v3";

export class LocalStorageRepository implements FinanceRepository {
  async loadState(): Promise<FinanceState> {
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

  async saveState(state: FinanceState): Promise<void> {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.error("Failed to save finance state to localStorage:", err);
    }
  }

  async createBackup(state: FinanceState, label?: string) {
    return createBackup(state, label);
  }

  async restoreBackup(backupId: string): Promise<FinanceState | null> {
    return restoreFromBackup(backupId);
  }

  async loadBackupList() {
    return loadBackupList();
  }
}
export const financeRepository = new LocalStorageRepository();
