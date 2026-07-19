import type { FinanceState } from "../types";
import { logger } from "../logger";

export interface Migration {
  fromVersion: number;
  toVersion: number;
  migrate(state: any): any;
}

const migrations: Migration[] = [
  {
    fromVersion: 0, // Legacy/no schema version
    toVersion: 4,
    migrate(state: any): any {
      logger.info("system", "Migrating database structure from legacy schema to v4...");
      const entries = Array.isArray(state.entries) ? state.entries.map((entry: any) => {
        return {
          ...entry,
          dataQuality: entry.dataQuality || "completo",
          paidBy: entry.paidBy || "me",
          isOfficial: entry.isOfficial !== undefined ? entry.isOfficial : true,
          installment: entry.installment || undefined,
        };
      }) : [];

      return {
        ...state,
        schemaVersion: 4,
        entries,
      };
    }
  }
];

export function runMigrations(state: any): FinanceState {
  let currentVersion = state?.schemaVersion || 0;
  let migratedState = { ...state };

  if (currentVersion >= 4) {
    return migratedState as FinanceState;
  }

  // Backup legacy state before migrating
  if (typeof window !== "undefined") {
    try {
      const backupKey = `meu-financeiro-pre-migration-${Date.now()}`;
      localStorage.setItem(backupKey, JSON.stringify(state));
      logger.info("system", "Pre-migration backup created", { key: backupKey });
    } catch (err) {
      logger.error("system", "Failed to create pre-migration backup", { error: String(err) });
    }
  }

  // Run migrations sequentially
  for (const migration of migrations) {
    if (migration.fromVersion === currentVersion) {
      try {
        migratedState = migration.migrate(migratedState);
        currentVersion = migration.toVersion;
        logger.info("system", `Successfully migrated schema to v${currentVersion}`);
      } catch (err) {
        logger.error("system", `Failed during migration from v${migration.fromVersion} to v${migration.toVersion}`, { error: String(err) });
        throw err;
      }
    }
  }

  return migratedState as FinanceState;
}
