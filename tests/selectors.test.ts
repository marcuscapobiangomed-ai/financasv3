import { describe, it, expect } from "vitest";
import type { FinanceState } from "../lib/types";
import {
  selectAvailableCash,
  selectPatrimony,
  selectInvoiceEntries,
  selectInvoiceTotal,
  selectMonthlyExpenses,
  selectFutureCommitments,
  selectConfirmedReceivables,
} from "../lib/selectors";

describe("selectors", () => {
  const mockState: FinanceState = {
    goal: 15000,
    accounts: [
      { id: "1", name: "Carteira", type: "cash", balance: 500, available: true },
      { id: "2", name: "Poupança", type: "reserve", balance: 5000, available: false },
    ],
    entries: [
      { id: "e1", title: "Freelance", amount: 1500, kind: "income", dueDate: "2026-08-05", status: "a_receber_confirmado", category: "Salário" },
      { id: "e2", title: "Energia", amount: 200, kind: "expense", dueDate: "2026-08-10", status: "a_pagar", category: "Moradia" },
      { id: "e3", title: "Netflix", amount: 45, kind: "expense", dueDate: "2026-08-15", invoiceMonth: "2026-08", account: "Nubank", status: "a_pagar", category: "Lazer" },
      { id: "e4", title: "iFood", amount: 120, kind: "expense", dueDate: "2026-08-18", invoiceMonth: "2026-08", account: "Nubank", status: "a_pagar", category: "Lazer" },
      { id: "e5", title: "Futuro", amount: 100, kind: "expense", dueDate: "2026-09-01", status: "projetado", category: "Lazer" },
    ],
    updatedAt: "",
  };

  it("selectAvailableCash calculates available cash balance", () => {
    expect(selectAvailableCash(mockState)).toBe(500);
  });

  it("selectPatrimony calculates total patrimony balance", () => {
    expect(selectPatrimony(mockState)).toBe(5500);
  });

  it("selectInvoiceEntries returns entries for a specific card and month", () => {
    const entries = selectInvoiceEntries(mockState, "Nubank", "2026-08");
    expect(entries.length).toBe(2);
    expect(entries.map(e => e.id)).toContain("e3");
    expect(entries.map(e => e.id)).toContain("e4");
  });

  it("selectInvoiceTotal sums the amount of card entries", () => {
    expect(selectInvoiceTotal(mockState, "Nubank", "2026-08")).toBe(165);
  });

  it("selectMonthlyExpenses calculates correct pending non-father expenses", () => {
    expect(selectMonthlyExpenses(mockState, "2026-08")).toBe(365); // 200 + 45 + 120
  });

  it("selectFutureCommitments calculates projected expenses", () => {
    expect(selectFutureCommitments(mockState)).toBe(100);
  });

  it("selectConfirmedReceivables calculates confirmed income", () => {
    expect(selectConfirmedReceivables(mockState, "2026-08")).toBe(1500);
  });
});
