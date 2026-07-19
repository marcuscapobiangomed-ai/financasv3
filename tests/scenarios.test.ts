import { describe, it, expect } from "vitest";
import type { FinanceState, FinanceEntry } from "../lib/types";
import {
  selectAvailableCash,
  selectMonthlyExpenses,
  selectSafeToSpendConservative,
  selectSafeToSpendProbable,
  selectSafeToSpendOptimistic,
} from "../lib/selectors";
import { financeCommandService } from "../lib/storage/finance-command-service";

// Mock React state updater
const mockSetState = () => {};

describe("Auditoria de Cenários Financeiros", () => {
  const baseState: FinanceState = {
    schemaVersion: 4,
    goal: 10000,
    accounts: [
      { id: "wallet", name: "Carteira Líquida", type: "cash", balance: 1000, available: true },
      { id: "savings", name: "Reserva", type: "reserve", balance: 500, available: false },
    ],
    entries: [],
    invoices: [],
    updatedAt: new Date().toISOString(),
  };

  it("Cenário A: Compra simples - despesa de R$ 100 reduz o caixa após pagamento", () => {
    let state = { ...baseState };
    const setState = (next: any) => { state = next; };

    // Criar despesa pendente
    const entry = financeCommandService.createEntry(
      state,
      {
        title: "Mercado",
        amount: 100,
        kind: "expense",
        dueDate: "2026-08-15",
        status: "a_pagar",
        category: "Alimentação",
        paidBy: "me",
        origin: "manual",
      },
      setState
    );

    // Verificar despesa pendente e caixa intacto
    expect(selectMonthlyExpenses(state, "2026-08")).toBe(100);
    expect(selectAvailableCash(state)).toBe(1000);

    // Liquidar despesa
    financeCommandService.settleEntry(state, entry.id, setState);

    // Verificar que a despesa foi liquidada (não é mais pendente) e reduziu caixa
    expect(selectMonthlyExpenses(state, "2026-08")).toBe(0);
    expect(selectAvailableCash(state)).toBe(900);
  });

  it("Cenário B: Compra parcelada - R$ 600 em 6x gera faturas de R$ 100 e compromissos futuros", () => {
    let state = { ...baseState };
    const setState = (next: any) => { state = next; };

    const installments: Omit<FinanceEntry, "id">[] = Array.from({ length: 6 }).map((_, i) => {
      const month = String(8 + i).padStart(2, "0");
      return {
        title: "Celular",
        amount: 100,
        kind: "expense",
        dueDate: `2026-${month}-10`,
        status: i === 0 ? "a_pagar" : "projetado",
        category: "Tecnologia",
        account: "Unicred",
        invoiceMonth: `2026-${month}`,
        installment: `${i + 1}/6`,
        origin: "manual",
      };
    });

    financeCommandService.createEntries(state, installments, setState);

    // Fatura de agosto deve ter R$ 100
    expect(selectMonthlyExpenses(state, "2026-08")).toBe(100);
    // Fatura de setembro deve ter R$ 100
    expect(selectMonthlyExpenses(state, "2026-09")).toBe(100);
  });

  it("Cenário C: Pai Paga - despesa custeada pelo pai não afeta o caixa nem o livre para gastar", () => {
    let state = { ...baseState };
    const setState = (next: any) => { state = next; };

    // Criar despesa paga pelo pai
    financeCommandService.createEntry(
      state,
      {
        title: "Gasolina Pai",
        amount: 150,
        kind: "expense",
        dueDate: "2026-08-12",
        status: "a_pagar",
        category: "Transporte",
        paidBy: "father",
        origin: "manual",
      },
      setState
    );

    // Verificar que a despesa paga pelo pai não entra no cálculo de despesas mensais pendentes do usuário
    expect(selectMonthlyExpenses(state, "2026-08")).toBe(0);
    expect(selectAvailableCash(state)).toBe(1000);
    // Livre para gastar conservador deve ser: Caixa (1000) - Despesas (0) - Margem (100) = 900
    expect(selectSafeToSpendConservative(state, "2026-08")).toBe(900);
  });

  it("Cenário D: Recebimento incerto - receita incerta entra apenas no cenário otimista", () => {
    let state = { ...baseState };
    const setState = (next: any) => { state = next; };

    // Criar receita incerta
    financeCommandService.createEntry(
      state,
      {
        title: "Venda OLX",
        amount: 200,
        kind: "income",
        dueDate: "2026-08-25",
        status: "a_receber_incerto",
        category: "Outros",
        origin: "manual",
      },
      setState
    );

    // Conservador: Caixa (1000) - Despesas (0) - Margem (100) = 900
    expect(selectSafeToSpendConservative(state, "2026-08")).toBe(900);
    // Provável: Caixa (1000) + Receita Confirmada (0) - Despesas (0) - Margem (50) = 950
    expect(selectSafeToSpendProbable(state, "2026-08")).toBe(950);
    // Otimista: Caixa (1000) + Receitas (0 + 200) - Despesas (0) = 1200
    expect(selectSafeToSpendOptimistic(state, "2026-08")).toBe(1200);
  });

  it("Cenário E: Pagamento de fatura - marcar pagamento como transferência não gera despesa duplicada", () => {
    let state = { ...baseState };
    const setState = (next: any) => { state = next; };

    // Criar uma compra de cartão
    financeCommandService.createEntry(
      state,
      {
        title: "Amazon",
        amount: 150,
        kind: "expense",
        dueDate: "2026-08-10",
        status: "a_pagar",
        category: "Livros",
        account: "Unicred",
        invoiceMonth: "2026-08",
        origin: "manual",
      },
      setState
    );

    // O pagamento de fatura deve ser cadastrado com a palavra chave 'pagamento' e 'fatura'
    // classificado como income ou despesa não regular para liquidação
    const pmt = financeCommandService.createEntry(
      state,
      {
        title: "Pagamento fatura Unicred",
        amount: 150,
        kind: "income", // entrada de liquidação
        dueDate: "2026-08-11",
        status: "recebido",
        category: "Faturas",
        origin: "manual",
      },
      setState
    );

    // Verificar que a compra de R$ 150 entra na despesa mensal
    expect(selectMonthlyExpenses(state, "2026-08")).toBe(150);
    // O pagamento de fatura não é considerado despesa regular
    expect(state.entries.find((e) => e.id === pmt.id)?.kind).toBe("income");
  });
});
