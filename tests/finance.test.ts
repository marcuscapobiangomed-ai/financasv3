import { describe, it, expect } from "vitest";
import { getSummary, getSafeToSpend, isEntryInPeriod, parseCsv } from "../lib/finance";
import type { FinanceState, FinanceEntry } from "../lib/types";

describe("isEntryInPeriod", () => {
  it("filters income by dueDate", () => {
    const entry: FinanceEntry = {
      id: "1",
      title: "Test Income",
      amount: 1000,
      kind: "income",
      dueDate: "2026-07-15",
      status: "a_receber_confirmado",
      category: "Salário",
    };
    expect(isEntryInPeriod(entry, "2026-07")).toBe(true);
    expect(isEntryInPeriod(entry, "2026-08")).toBe(false);
  });

  it("filters expense by invoiceMonth if present, otherwise by dueDate", () => {
    const entry1: FinanceEntry = {
      id: "2",
      title: "Unicred Expense",
      amount: 100,
      kind: "expense",
      dueDate: "2026-08-11",
      invoiceMonth: "2026-08",
      status: "a_pagar",
      category: "Lazer",
    };
    const entry2: FinanceEntry = {
      id: "3",
      title: "Cash Expense",
      amount: 50,
      kind: "expense",
      dueDate: "2026-07-20",
      status: "a_pagar",
      category: "Alimentação",
    };
    expect(isEntryInPeriod(entry1, "2026-08")).toBe(true);
    expect(isEntryInPeriod(entry1, "2026-07")).toBe(false);
    expect(isEntryInPeriod(entry2, "2026-07")).toBe(true);
    expect(isEntryInPeriod(entry2, "2026-08")).toBe(false);
  });
});

describe("getSummary", () => {
  it("calculates correct summary totals", () => {
    const mockState: FinanceState = {
      goal: 10000,
      accounts: [
        { id: "1", name: "Caixa", type: "cash", balance: 1000, available: true },
        { id: "2", name: "Cofrinho", type: "reserve", balance: 4000, available: false },
      ],
      entries: [
        { id: "e1", title: "Income 1", amount: 500, kind: "income", dueDate: "2026-08-05", status: "a_receber_confirmado", category: "Freelance" },
        { id: "e2", title: "Expense 1", amount: 200, kind: "expense", dueDate: "2026-08-10", status: "a_pagar", category: "Transporte" },
        { id: "e3", title: "Expense Father", amount: 300, kind: "expense", dueDate: "2026-08-12", status: "a_pagar", category: "Saúde", paidBy: "father" },
      ],
      updatedAt: "",
    };

    const summary = getSummary(mockState, "2026-08");
    expect(summary.patrimony).toBe(5000);
    expect(summary.availableCash).toBe(1000);
    expect(summary.reserve).toBe(4000);
    expect(summary.pendingIncome).toBe(500);
    expect(summary.pendingExpenses).toBe(200); // Expense Father should be ignored for pendingExpenses!
    expect(summary.goalProgress).toBe(50);
  });
});

describe("getSafeToSpend", () => {
  it("calculates safe to spend values correctly", () => {
    const mockState: FinanceState = {
      goal: 10000,
      accounts: [
        { id: "1", name: "Caixa", type: "cash", balance: 1000, available: true },
      ],
      entries: [
        // Renda confirmada hoje
        { id: "e1", title: "Renda", amount: 2000, kind: "income", dueDate: "2026-07-20", status: "a_receber_confirmado", category: "Job" },
        // Despesa pendente
        { id: "e2", title: "Gasto", amount: 500, kind: "expense", dueDate: "2026-07-22", status: "a_pagar", category: "Aluguel" },
        // Despesa realizada (deve ser ignorada já que foi abatida do saldo)
        { id: "e3", title: "Gasto Pago", amount: 150, kind: "expense", dueDate: "2026-07-15", status: "realizado", category: "Lazer" },
      ],
      updatedAt: "",
    };

    const res = getSafeToSpend(mockState, "2026-07-19", 100);
    expect(res.safeToSpend).toBe(2900);
    expect(res.nextIncomeDate).toBe("2026-07-20");
  });
});

describe("parseCsv", () => {
  it("parses valid CSV string with comma/semicolon and handles values correctly", () => {
    const csvData = `data;descricao;valor;tipo;categoria;conta
2026-07-21;Pagamento Clara;50;entrada;Presentes;Mercado Pago
2026-07-24;Passagem;80;despesa;Transporte;Nubank`;
    const res = parseCsv(csvData);
    expect(res.length).toBe(2);
    expect(res[0].title).toBe("Pagamento Clara");
    expect(res[0].amount).toBe(50);
    expect(res[0].kind).toBe("income");
    expect(res[1].title).toBe("Passagem");
    expect(res[1].amount).toBe(80);
    expect(res[1].kind).toBe("expense");
  });
});
