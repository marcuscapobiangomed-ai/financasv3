import { describe, it, expect } from "vitest";
import type { FinanceState } from "../lib/types";
import { buildInvoiceView } from "../lib/invoice";

describe("buildInvoiceView", () => {
  it("compiles Nubank fatura for August 2026 with correct official total", () => {
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
    expect(invoice.officialTotal).toBe(192.4);
    expect(invoice.identifiedSubtotal).toBe(192.4);
    expect(invoice.dueDate).toBe("2026-08-10");
  });

  it("identifies paid status when matched payment is present", () => {
    const mockState: FinanceState = {
      goal: 10000,
      accounts: [],
      entries: [
        { id: "1", title: "iFood", amount: 192.4, kind: "expense", dueDate: "2026-08-10", invoiceMonth: "2026-08", account: "Nubank", status: "realizado", category: "Lazer" },
        { id: "2", title: "Pagamento Fatura Nubank", amount: 192.4, kind: "income", dueDate: "2026-08-10", account: "Nubank", status: "recebido", category: "Ajuste" },
      ],
      updatedAt: "",
    };

    const invoice = buildInvoiceView(mockState, "Nubank", "2026-08");
    expect(invoice.status).toBe("paid");
    expect(invoice.paidAmount).toBe(192.4);
  });
});
