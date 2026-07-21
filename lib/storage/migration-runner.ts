import type { FinanceState, FinanceEntry, TransactionType } from "../types";
import { logger } from "../logger";
import { initialFinanceState } from "../seed";
import { recordAudit } from "../audit";

export interface Migration {
  fromVersion: number;
  toVersion: number;
  migrate(state: any): any;
}

function parseInstallment(installment?: string): { installmentNumber?: number; installmentTotal?: number } {
  if (!installment) return {};
  const clean = installment.replace("?", "").trim();
  const match = clean.match(/^(\d+)\/(\d+)$/);
  if (match) {
    return {
      installmentNumber: parseInt(match[1], 10),
      installmentTotal: parseInt(match[2], 10),
    };
  }
  return {};
}

function inferTransactionType(title: string): TransactionType {
  const lower = (title || "").toLowerCase();
  if (lower.startsWith("iof")) return "iof";
  if (lower.includes("anuidade")) return "fee";
  return "purchase";
}

function ensureBackup(state: any, label: string): void {
  if (typeof window === "undefined") return;
  try {
    const backupKey = `meu-financeiro-pre-migration-${Date.now()}`;
    localStorage.setItem(backupKey, JSON.stringify(state));
    logger.info("system", `Pre-migration backup created before ${label}`, { key: backupKey });
  } catch (err) {
    logger.error("system", "Failed to create pre-migration backup", { error: String(err) });
  }
}

const migrations: Migration[] = [
  {
    fromVersion: 0,
    toVersion: 4,
    migrate(state: any): any {
      logger.info("system", "Migrating database structure from legacy schema to v4...");
      const entries = Array.isArray(state.entries) ? state.entries.map((entry: any) => {
        let origin = entry.origin;
        if (!origin) {
          if (entry.note?.includes("Importado") || entry.note?.includes("CSV") || entry.account?.toLowerCase() === "importado") {
            origin = "csv";
          } else if (entry.id?.startsWith("unicred-") || entry.id?.startsWith("nubank-")) {
            origin = "seed";
          } else {
            origin = "manual";
          }
        }
        return {
          ...entry,
          dataQuality: entry.dataQuality || "completo",
          paidBy: entry.paidBy || "me",
          isOfficial: entry.isOfficial !== undefined ? entry.isOfficial : true,
          installment: entry.installment || undefined,
          origin,
        };
      }) : [];

      const defaultInvoices = [
        {
          id: "invoice-unicred-2026-08",
          cardId: "Unicred",
          referenceMonth: "2026-08",
          closingDate: "2026-08-03",
          dueDate: "2026-08-11",
          officialTotal: 801.85,
          identifiedSubtotal: 801.85,
          status: "closed" as const,
          dataQuality: "completo" as const,
        },
        {
          id: "invoice-nubank-2026-08",
          cardId: "Nubank",
          referenceMonth: "2026-08",
          closingDate: "2026-08-03",
          dueDate: "2026-08-10",
          officialTotal: 192.40,
          identifiedSubtotal: 192.40,
          status: "closed" as const,
          dataQuality: "completo" as const,
        },
      ];

      return {
        ...state,
        schemaVersion: 4,
        entries,
        invoices: state.invoices || defaultInvoices,
      };
    }
  },
  {
    fromVersion: 4,
    toVersion: 5,
    migrate(state: any): any {
      logger.info("system", "Migrating database from v4 to v5 — recovering canonical purchases, correcting invoices...");

      const currentEntries: FinanceEntry[] = Array.isArray(state.entries) ? state.entries : [];
      const currentIds = new Set(currentEntries.map((e: FinanceEntry) => e.id));
      const seedEntries = initialFinanceState.entries;
      const seedMap = new Map(seedEntries.map((e: FinanceEntry) => [e.id, e]));

      let trashIds = new Set<string>();
      if (typeof window !== "undefined") {
        try {
          const trashRaw = localStorage.getItem("meu-financeiro-trash");
          if (trashRaw) {
            const trashItems = JSON.parse(trashRaw);
            trashIds = new Set(trashItems.map((t: any) => t.entry?.id).filter(Boolean));
          }
        } catch { /* ignore */ }
      }

      const nextEntries = [...currentEntries];
      let recoveredCount = 0;

      for (const seedEntry of seedEntries) {
        if (!currentIds.has(seedEntry.id)) {
          if (trashIds.has(seedEntry.id)) continue;

          const inst = parseInstallment(seedEntry.installment);
          const recoveredEntry: FinanceEntry = {
            ...seedEntry,
            invoiceId: seedEntry.invoiceId,
            transactionType: seedEntry.transactionType || inferTransactionType(seedEntry.title),
            installmentNumber: inst.installmentNumber || seedEntry.installmentNumber,
            installmentTotal: inst.installmentTotal || seedEntry.installmentTotal,
            includeInSpending: seedEntry.includeInSpending !== false,
            origin: "recovery",
            note: (seedEntry.note || "") + " | Recuperado na migração v4→v5",
          };
          nextEntries.push(recoveredEntry);

          try { recordAudit(recoveredEntry.id, "created", [], recoveredEntry, "Recuperado automaticamente na migração v4→v5"); } catch { /* silent */ }
          recoveredCount++;
        } else {
          // Preserve user edits — just ensure new fields exist
          const idx = nextEntries.findIndex((e: FinanceEntry) => e.id === seedEntry.id);
          if (idx !== -1) {
            const browser = nextEntries[idx];
            const inst = parseInstallment(browser.installment);
            nextEntries[idx] = {
              ...browser,
              invoiceId: browser.invoiceId || seedEntry.invoiceId,
              transactionType: browser.transactionType || inferTransactionType(browser.title),
              installmentNumber: browser.installmentNumber ?? inst.installmentNumber,
              installmentTotal: browser.installmentTotal ?? inst.installmentTotal,
              includeInSpending: browser.includeInSpending !== false,
            };
          }
        }
      }

      // Add Nubank payment entry if missing
      const hasPayment = nextEntries.some((e: FinanceEntry) => e.id === "nubank-payment-2026-07-10");
      if (!hasPayment) {
        const paymentEntry: FinanceEntry = {
          id: "nubank-payment-2026-07-10",
          title: "Pagamento recebido — Nubank",
          amount: 482.12,
          kind: "income",
          dueDate: "2026-07-10",
          status: "recebido",
          category: "Fatura",
          paidBy: "me",
          transactionType: "invoice_payment",
          includeInSpending: false,
          dataQuality: "completo",
          isOfficial: true,
          origin: "recovery",
          note: "Recuperado na migração v4→v5. Pagamento recebido na fatura Nubank — não é gasto.",
        };
        nextEntries.push(paymentEntry);
        try { recordAudit(paymentEntry.id, "created", [], paymentEntry, "Pagamento Nubank recuperado na migração v4→v5"); } catch { /* silent */ }
        recoveredCount++;
      }

      // Fix invoice entities
      const correctedInvoices = [
        {
          id: "invoice-unicred-2026-08",
          cardId: "Unicred",
          referenceMonth: "2026-08",
          closingDate: "2026-08-01",
          dueDate: "2026-08-11",
          officialTotal: undefined,
          identifiedSubtotal: 801.85,
          status: "partial" as const,
          dataQuality: "parcial" as const,
        },
        {
          id: "invoice-nubank-2026-08",
          cardId: "Nubank",
          referenceMonth: "2026-08",
          closingDate: "2026-07-31",
          dueDate: "2026-08-10",
          officialTotal: undefined,
          identifiedSubtotal: 192.40,
          status: "partial" as const,
          dataQuality: "parcial" as const,
        },
      ];

      // Merge with existing invoices preserving any user edits
      const existingInvoices = Array.isArray(state.invoices) ? state.invoices : [];
      const mergedInvoices = correctedInvoices.map((corrected) => {
        const existing = existingInvoices.find((i: any) => i.id === corrected.id);
        if (existing) {
          return {
            ...corrected,
            identifiedSubtotal: existing.identifiedSubtotal ?? corrected.identifiedSubtotal,
          };
        }
        return corrected;
      });

      // Add any existing invoices not in the corrected set
      for (const existing of existingInvoices) {
        if (!mergedInvoices.some((i: any) => i.id === existing.id)) {
          mergedInvoices.push(existing);
        }
      }

      logger.info("system", `v4→v5 migration complete: ${recoveredCount} entries recovered`);

      return {
        ...state,
        schemaVersion: 5,
        entries: nextEntries,
        invoices: mergedInvoices,
        updatedAt: new Date().toISOString(),
      };
    }
  }
];

export function runMigrations(state: any): FinanceState {
  let currentVersion = state?.schemaVersion || 0;
  let migratedState = { ...state };

  if (currentVersion >= 5) {
    return migratedState as FinanceState;
  }

  if (currentVersion > 0) {
    ensureBackup(state, `migration-from-v${currentVersion}`);
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
