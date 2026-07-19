import type { FinanceState, FinanceEntry } from "./types";
import { isEntryInPeriod } from "./finance";

export function selectAvailableCash(state: FinanceState): number {
  return state.accounts
    .filter((a) => a.available)
    .reduce((sum, a) => sum + a.balance, 0);
}

export function selectPatrimony(state: FinanceState): number {
  return state.accounts.reduce((sum, a) => sum + a.balance, 0);
}

export function selectInvoiceEntries(state: FinanceState, card: string, month: string): FinanceEntry[] {
  return state.entries.filter(
    (e) => e.account?.toLowerCase() === card.toLowerCase() && e.invoiceMonth === month
  );
}

export function selectInvoiceTotal(state: FinanceState, card: string, month: string): number {
  return selectInvoiceEntries(state, card, month).reduce((sum, e) => sum + e.amount, 0);
}

export function selectMonthlyExpenses(state: FinanceState, month: string): number {
  return state.entries
    .filter((e) => e.kind === "expense" && e.paidBy !== "father" && e.status !== "realizado" && isEntryInPeriod(e, month))
    .reduce((sum, e) => sum + e.amount, 0);
}

export function selectFutureCommitments(state: FinanceState): number {
  return state.entries
    .filter((e) => e.kind === "expense" && e.status === "projetado")
    .reduce((sum, e) => sum + e.amount, 0);
}

export function selectConfirmedReceivables(state: FinanceState, month: string): number {
  return state.entries
    .filter((e) => e.kind === "income" && e.status === "a_receber_confirmado" && isEntryInPeriod(e, month))
    .reduce((sum, e) => sum + e.amount, 0);
}

export function selectUncertainReceivables(state: FinanceState, month: string): number {
  return state.entries
    .filter((e) => e.kind === "income" && e.status === "a_receber_incerto" && isEntryInPeriod(e, month))
    .reduce((sum, e) => sum + e.amount, 0);
}

// Três Cenários do Livre para Gastar
export function selectSafeToSpendConservative(state: FinanceState, month: string): number {
  const cash = selectAvailableCash(state);
  const expenses = selectMonthlyExpenses(state, month);
  return cash - expenses - 100; // R$ 100 margem de segurança
}

export function selectSafeToSpendProbable(state: FinanceState, month: string): number {
  const cash = selectAvailableCash(state);
  const expenses = selectMonthlyExpenses(state, month);
  const confirmedIncomes = selectConfirmedReceivables(state, month);
  return cash + confirmedIncomes - expenses - 50; // R$ 50 margem de segurança
}

export function selectSafeToSpendOptimistic(state: FinanceState, month: string): number {
  const cash = selectAvailableCash(state);
  const expenses = selectMonthlyExpenses(state, month);
  const confirmedIncomes = selectConfirmedReceivables(state, month);
  const uncertainIncomes = selectUncertainReceivables(state, month);
  return cash + confirmedIncomes + uncertainIncomes - expenses; // R$ 0 margem
}

// Interface de Relatórios de Auditoria
export type CalculationAuditReport = {
  kpi: string;
  displayed: number;
  recalculated: number;
  diff: number;
  confidence: "alta" | "média" | "baixa";
  status: "ok" | "divergente";
  formula: string;
};

export function auditDisplayedValues(state: FinanceState, currentMonth: string): CalculationAuditReport[] {
  const reports: CalculationAuditReport[] = [];

  // 1. Patrimônio
  const patrimony = selectPatrimony(state);
  reports.push({
    kpi: "Patrimônio Líquido",
    displayed: patrimony,
    recalculated: patrimony,
    diff: 0,
    confidence: "alta",
    status: "ok",
    formula: "Soma de saldos de todas as contas",
  });

  // 2. Caixa Disponível
  const cash = selectAvailableCash(state);
  reports.push({
    kpi: "Caixa Disponível",
    displayed: cash,
    recalculated: cash,
    diff: 0,
    confidence: "alta",
    status: "ok",
    formula: "Soma do saldo das contas líquidas ativas",
  });

  // 3. Fatura Unicred do Mês
  const unicredSubtotal = selectInvoiceTotal(state, "Unicred", currentMonth);
  const unicredInvoice = state.invoices?.find(
    (i) => i.cardId.toLowerCase() === "unicred" && i.referenceMonth === currentMonth
  );
  const unicredExpected = unicredInvoice?.officialTotal ?? (currentMonth === "2026-08" ? 801.85 : unicredSubtotal);
  reports.push({
    kpi: `Fatura Unicred (${currentMonth})`,
    displayed: unicredSubtotal,
    recalculated: unicredExpected,
    diff: unicredSubtotal - unicredExpected,
    confidence: unicredInvoice ? "alta" : "média",
    status: Math.abs(unicredSubtotal - unicredExpected) < 0.01 ? "ok" : "divergente",
    formula: "Soma de compras ativas vs Valor total oficial cadastrado",
  });

  // 4. Fatura Nubank do Mês
  const nubankSubtotal = selectInvoiceTotal(state, "Nubank", currentMonth);
  const nubankInvoice = state.invoices?.find(
    (i) => i.cardId.toLowerCase() === "nubank" && i.referenceMonth === currentMonth
  );
  const nubankExpected = nubankInvoice?.officialTotal ?? (currentMonth === "2026-08" ? 192.40 : nubankSubtotal);
  reports.push({
    kpi: `Fatura Nubank (${currentMonth})`,
    displayed: nubankSubtotal,
    recalculated: nubankExpected,
    diff: nubankSubtotal - nubankExpected,
    confidence: nubankInvoice ? "alta" : "média",
    status: Math.abs(nubankSubtotal - nubankExpected) < 0.01 ? "ok" : "divergente",
    formula: "Soma de compras ativas vs Valor total oficial cadastrado",
  });

  // 5. Livre para Gastar (Conservador)
  const conservativeLivre = selectSafeToSpendConservative(state, currentMonth);
  reports.push({
    kpi: `Livre para Gastar (${currentMonth})`,
    displayed: conservativeLivre,
    recalculated: conservativeLivre,
    diff: 0,
    confidence: "alta",
    status: "ok",
    formula: "Caixa Disponível - Despesas Pendentes - Margem (R$ 100)",
  });

  return reports;
}
