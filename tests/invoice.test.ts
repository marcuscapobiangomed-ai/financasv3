import { describe, it, expect } from "vitest";
import type { FinanceState } from "../lib/types";
import { buildInvoiceView } from "../lib/invoice";

describe("buildInvoiceView", () => {
  it("compiles invoice from entries without persisted entity", () => {
    const mockState: FinanceState = {
      goal: 10000,
      accounts: [],
      entries: [
        { id: "1", title: "iFood", amount: 100, kind: "expense", dueDate: "2026-08-10", invoiceMonth: "2026-08", account: "Nubank", status: "a_pagar", category: "Lazer" },
        { id: "2", title: "Netflix", amount: 92.4, kind: "expense", dueDate: "2026-08-10", invoiceMonth: "2026-08", account: "Nubank", status: "a_pagar", category: "Lazer" },
      ],
      updatedAt: "",
    };

    const invoice = buildInvoiceView(mockState, "Nubank", "2026-08");
    expect(invoice.card).toBe("Nubank");
    expect(invoice.month).toBe("2026-08");
    expect(invoice.officialTotal).toBeUndefined();
    expect(invoice.identifiedSubtotal).toBe(192.4);
    expect(invoice.dueDate).toBe("2026-08-10");
  });

  it("uses persisted invoice entity when available", () => {
    const mockState: FinanceState = {
      goal: 10000,
      accounts: [],
      entries: [
        { id: "1", title: "iFood", amount: 100, kind: "expense", dueDate: "2026-08-10", invoiceMonth: "2026-08", account: "Nubank", status: "a_pagar", category: "Lazer" },
      ],
      invoices: [
        { id: "invoice-nubank-2026-08", cardId: "Nubank", referenceMonth: "2026-08", closingDate: "2026-07-31", dueDate: "2026-08-10", officialTotal: undefined, identifiedSubtotal: 100, status: "partial", dataQuality: "parcial" }
      ],
      updatedAt: "",
    };

    const invoice = buildInvoiceView(mockState, "Nubank", "2026-08");
    expect(invoice.card).toBe("Nubank");
    expect(invoice.officialTotal).toBeUndefined();
    expect(invoice.identifiedSubtotal).toBe(100);
    expect(invoice.status).toBe("partial");
    expect(invoice.closingDate).toBe("2026-07-31");
  });

  it("excludes invoice_payment entries from subtotal", () => {
    const mockState: FinanceState = {
      goal: 10000,
      accounts: [],
      entries: [
        { id: "1", title: "iFood", amount: 100, kind: "expense", dueDate: "2026-08-10", invoiceMonth: "2026-08", account: "Nubank", status: "a_pagar", category: "Lazer" },
        { id: "2", title: "Pagamento recebido — Nubank", amount: 500, kind: "income", dueDate: "2026-07-10", account: "Nubank", status: "recebido", category: "Fatura", transactionType: "invoice_payment", includeInSpending: false },
      ],
      updatedAt: "",
    };

    const invoice = buildInvoiceView(mockState, "Nubank", "2026-08");
    expect(invoice.identifiedSubtotal).toBe(100);
    expect(invoice.entries.length).toBe(1);
  });

  it("identifies paid status when invoice_payment is present", () => {
    const mockState: FinanceState = {
      goal: 10000,
      accounts: [],
      entries: [
        { id: "1", title: "iFood", amount: 192.4, kind: "expense", dueDate: "2026-08-10", invoiceMonth: "2026-08", account: "Nubank", status: "realizado", category: "Lazer" },
        { id: "2", title: "Pagamento recebido — Nubank", amount: 192.4, kind: "income", dueDate: "2026-08-10", account: "Nubank", status: "recebido", category: "Fatura", transactionType: "invoice_payment", includeInSpending: false },
      ],
      invoices: [
        { id: "invoice-nubank-2026-08", cardId: "Nubank", referenceMonth: "2026-08", closingDate: "2026-07-31", dueDate: "2026-08-10", officialTotal: undefined, identifiedSubtotal: 192.4, status: "paid", dataQuality: "parcial" }
      ],
      updatedAt: "",
    };

    const invoice = buildInvoiceView(mockState, "Nubank", "2026-08");
    expect(invoice.status).toBe("paid");
    expect(invoice.paidAmount).toBe(192.4);
  });
});
