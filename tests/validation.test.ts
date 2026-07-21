import { describe, it, expect } from "vitest";
import { validateDataIntegrity } from "../lib/validation";
import { runMigrations } from "../lib/storage/migration-runner";
import type { FinanceState, FinanceEntry } from "../lib/types";

describe("validateDataIntegrity", () => {
  it("detects duplicate IDs", () => {
    const mockState: FinanceState = {
      goal: 10000,
      accounts: [],
      entries: [
        { id: "dup-1", title: "Entry 1", amount: 10, kind: "income", dueDate: "2026-07-01", status: "recebido", category: "Lazer" },
        { id: "dup-1", title: "Entry 2", amount: 20, kind: "expense", dueDate: "2026-07-02", status: "a_pagar", category: "Saúde" },
      ],
      updatedAt: "",
    };

    const issues = validateDataIntegrity(mockState);
    const duplicates = issues.filter((i) => i.code === "DUPLICATE_ID");
    expect(duplicates.length).toBe(1);
    expect(duplicates[0].message).toContain("dup-1");
  });

  it("detects invalid amounts and dates", () => {
    const mockState: FinanceState = {
      goal: 10000,
      accounts: [],
      entries: [
        { id: "1", title: "Negative Amount", amount: -10, kind: "expense", dueDate: "2026-07-01", status: "a_pagar", category: "Lazer" },
        { id: "2", title: "Bad Date", amount: 50, kind: "expense", dueDate: "01-07-2026", status: "a_pagar", category: "Lazer" },
      ],
      updatedAt: "",
    };

    const issues = validateDataIntegrity(mockState);
    expect(issues.some((i) => i.code === "INVALID_AMOUNT")).toBe(true);
    expect(issues.some((i) => i.code === "INVALID_DUE_DATE")).toBe(true);
  });

  it("detects missing category or Outros category", () => {
    const mockState: FinanceState = {
      goal: 10000,
      accounts: [],
      entries: [
        { id: "1", title: "No Category", amount: 100, kind: "expense", dueDate: "2026-07-01", status: "a_pagar", category: "" },
        { id: "2", title: "Outros Category", amount: 50, kind: "expense", dueDate: "2026-07-02", status: "a_pagar", category: "Outros" },
      ],
      updatedAt: "",
    };

    const issues = validateDataIntegrity(mockState);
    const missingCat = issues.filter((i) => i.code === "MISSING_CATEGORY");
    expect(missingCat.length).toBe(2);
  });

  it("detects missing invoiceMonth for card entries", () => {
    const mockState: FinanceState = {
      goal: 10000,
      accounts: [],
      entries: [
        { id: "1", title: "Nubank Purchase", amount: 100, kind: "expense", dueDate: "2026-08-10", account: "Nubank", status: "a_pagar", category: "Lazer" },
      ],
      updatedAt: "",
    };

    const issues = validateDataIntegrity(mockState);
    expect(issues.some((i) => i.code === "MISSING_INVOICE_MONTH")).toBe(true);
  });

  it("detects credit card payments misclassified as regular expenses", () => {
    const mockState: FinanceState = {
      goal: 10000,
      accounts: [],
      entries: [
        { id: "1", title: "Pagamento de fatura Unicred", amount: 800, kind: "expense", dueDate: "2026-08-11", status: "realizado", category: "Ajuste" },
      ],
      updatedAt: "",
    };

    const issues = validateDataIntegrity(mockState);
    expect(issues.some((i) => i.code === "FATURA_PAYMENT_EXPENSE")).toBe(true);
  });
});

describe("runMigrations", () => {
  it("upgrades v4 state to v5 with corrected invoices", () => {
    const v4State: FinanceState = {
      schemaVersion: 4,
      goal: 10000,
      accounts: [],
      entries: [],
      updatedAt: "",
    };
    const res = runMigrations(v4State);
    expect(res.schemaVersion).toBe(5);
    // Should have corrected invoice entities
    const unicredInvoice = res.invoices?.find((i) => i.id === "invoice-unicred-2026-08");
    expect(unicredInvoice).toBeDefined();
    if (unicredInvoice) {
      expect(unicredInvoice.status).toBe("partial");
      expect(unicredInvoice.officialTotal).toBeUndefined();
      expect(unicredInvoice.dataQuality).toBe("parcial");
      expect(unicredInvoice.closingDate).toBe("2026-08-01");
    }
  });

  it("migrates legacy schema to v5 by populating fallback properties", () => {
    const legacyState = {
      goal: 10000,
      accounts: [],
      entries: [
        { id: "1", title: "No Quality", amount: 100, kind: "expense", dueDate: "2026-07-01", status: "a_pagar", category: "Lazer" }
      ],
      updatedAt: "",
    };
    const res = runMigrations(legacyState);
    expect(res.schemaVersion).toBe(5);
    expect(res.entries[0].dataQuality).toBe("completo");
    expect(res.entries[0].paidBy).toBe("me");
    expect(res.entries[0].isOfficial).toBe(true);
  });

  it("does not re-migrate v5 state", () => {
    const v5State: FinanceState = {
      schemaVersion: 5,
      goal: 10000,
      accounts: [],
      entries: [
        { id: "seed-1", title: "Existing entry", amount: 50, kind: "expense", dueDate: "2026-08-01", status: "a_pagar", category: "Lazer", account: "Nubank", invoiceMonth: "2026-08", transactionType: "purchase", includeInSpending: true, origin: "seed" }
      ],
      invoices: [
        { id: "invoice-nubank-2026-08", cardId: "Nubank", referenceMonth: "2026-08", closingDate: "2026-07-31", dueDate: "2026-08-10", officialTotal: undefined, identifiedSubtotal: 50, status: "partial", dataQuality: "parcial" }
      ],
      updatedAt: "",
    };
    const res = runMigrations(v5State);
    expect(res.schemaVersion).toBe(5);
    expect(res.entries.length).toBe(1);
  });
});
