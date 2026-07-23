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
    (e) =>
      e.account?.toLowerCase() === card.toLowerCase() &&
      e.invoiceMonth === month &&
      e.transactionType !== "invoice_payment"
  );
}

export function selectInvoiceTotal(state: FinanceState, card: string, month: string): number {
  return selectInvoiceEntries(state, card, month).reduce((sum, e) => sum + e.amount, 0);
}

export function selectAllCardPurchases(state: FinanceState): number {
  return state.entries
    .filter((e) =>
      e.includeInSpending !== false &&
      (e.account?.toLowerCase() === "unicred" || e.account?.toLowerCase() === "nubank") &&
      e.transactionType !== "invoice_payment" &&
      e.status !== "projetado"
    )
    .reduce((sum, e) => sum + e.amount, 0);
}

export function selectFutureCardInstallments(state: FinanceState): number {
  return state.entries
    .filter((e) => e.status === "projetado" && (e.account?.toLowerCase() === "unicred" || e.account?.toLowerCase() === "nubank"))
    .reduce((sum, e) => sum + e.amount, 0);
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

// Three safe-to-spend scenarios.
export function selectSafeToSpendConservative(state: FinanceState, month: string): number {
  const cash = selectAvailableCash(state);
  const expenses = selectMonthlyExpenses(state, month);
  return cash - expenses - 100;
}

export function selectSafeToSpendProbable(state: FinanceState, month: string): number {
  const cash = selectAvailableCash(state);
  const expenses = selectMonthlyExpenses(state, month);
  const confirmedIncomes = selectConfirmedReceivables(state, month);
  return cash + confirmedIncomes - expenses - 50;
}

export function selectSafeToSpendOptimistic(state: FinanceState, month: string): number {
  const cash = selectAvailableCash(state);
  const expenses = selectMonthlyExpenses(state, month);
  const confirmedIncomes = selectConfirmedReceivables(state, month);
  const uncertainIncomes = selectUncertainReceivables(state, month);
  return cash + confirmedIncomes + uncertainIncomes - expenses;
}

function computeSafeToSpendAudit(state: FinanceState, today: string, safetyMargin: number) {
  const availableCash = selectAvailableCash(state);

  const pendingIncomes = state.entries
    .filter((entry) => entry.kind === "income" && entry.status === "a_receber_confirmado" && entry.dueDate >= today)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const [year, month] = today.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const endOfMonthDate = `${today.slice(0, 7)}-${String(lastDay).padStart(2, "0")}`;
  const nextIncomeDate = pendingIncomes[0]?.dueDate || endOfMonthDate;

  const incomesUntilNext = state.entries
    .filter((entry) => entry.kind === "income" && entry.status === "a_receber_confirmado" && entry.dueDate >= today && entry.dueDate <= nextIncomeDate)
    .reduce((sum, entry) => sum + entry.amount, 0);

  const expensesUntilNext = state.entries
    .filter((entry) => entry.kind === "expense" && entry.paidBy !== "father" && entry.status !== "realizado" && entry.dueDate >= today && entry.dueDate <= nextIncomeDate)
    .reduce((sum, entry) => sum + entry.amount, 0);

  return {
    safeToSpend: availableCash + incomesUntilNext - expensesUntilNext - safetyMargin,
    nextIncomeDate,
    availableCash,
    incomesUntilNext,
    expensesUntilNext,
    safetyMargin,
  };
}

export type CalculationAuditSnapshot = {
  patrimony: number;
  reserve: number;
  pendingIncome: number;
  pendingExpenses: number;
  safeToSpend: number;
  cardsSubtotal: number;
  unicredSubtotal: number;
  nubankSubtotal: number;
  futureInstallments: number;
};

export type CalculationAuditReport = {
  kpi: string;
  displayed: number;
  recalculated: number;
  diff: number;
  confidence: "alta" | "média" | "baixa";
  status: "ok" | "divergente";
  formula: string;
};

export function recalculateSafeToSpendAudit(state: FinanceState, today: string, safetyMargin: number) {
  return computeSafeToSpendAudit(state, today, safetyMargin);
}

export function auditDisplayedValues(
  state: FinanceState,
  currentMonth: string,
  snapshot: CalculationAuditSnapshot,
  today: string,
  safetyMargin: number
): CalculationAuditReport[] {
  const reports: CalculationAuditReport[] = [];

  const patrimony = selectPatrimony(state);
  const reserve = state.accounts.filter((account) => !account.available).reduce((sum, account) => sum + account.balance, 0);
  const pendingIncome = state.entries
    .filter((entry) => entry.kind === "income" && entry.status !== "recebido" && isEntryInPeriod(entry, currentMonth))
    .reduce((sum, entry) => sum + entry.amount, 0);
  const pendingExpenses = selectMonthlyExpenses(state, currentMonth);
  const unicredEntrySubtotal = selectInvoiceTotal(state, "Unicred", currentMonth);
  const nubankEntrySubtotal = selectInvoiceTotal(state, "Nubank", currentMonth);
  const futureInstallments = state.entries
    .filter((entry) => entry.kind === "expense" && entry.installment && entry.status !== "realizado")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const safeToSpendAudit = computeSafeToSpendAudit(state, today, safetyMargin);

  reports.push({
    kpi: "Patrimônio Líquido",
    displayed: snapshot.patrimony,
    recalculated: patrimony,
    diff: snapshot.patrimony - patrimony,
    confidence: "alta",
    status: Math.abs(snapshot.patrimony - patrimony) < 0.01 ? "ok" : "divergente",
    formula: "Soma de saldos de todas as contas",
  });

  reports.push({
    kpi: "Reserva",
    displayed: snapshot.reserve,
    recalculated: reserve,
    diff: snapshot.reserve - reserve,
    confidence: "alta",
    status: Math.abs(snapshot.reserve - reserve) < 0.01 ? "ok" : "divergente",
    formula: "Soma das contas marcadas como nao disponiveis",
  });

  reports.push({
    kpi: `Recebimentos (${currentMonth})`,
    displayed: snapshot.pendingIncome,
    recalculated: pendingIncome,
    diff: snapshot.pendingIncome - pendingIncome,
    confidence: "alta",
    status: Math.abs(snapshot.pendingIncome - pendingIncome) < 0.01 ? "ok" : "divergente",
    formula: "Receitas pendentes e confirmadas no periodo selecionado",
  });

  reports.push({
    kpi: `Compromissos (${currentMonth})`,
    displayed: snapshot.pendingExpenses,
    recalculated: pendingExpenses,
    diff: snapshot.pendingExpenses - pendingExpenses,
    confidence: "alta",
    status: Math.abs(snapshot.pendingExpenses - pendingExpenses) < 0.01 ? "ok" : "divergente",
    formula: "Despesas pendentes do periodo selecionado",
  });

  reports.push({
    kpi: `Unicred (${currentMonth})`,
    displayed: snapshot.unicredSubtotal,
    recalculated: unicredEntrySubtotal,
    diff: snapshot.unicredSubtotal - unicredEntrySubtotal,
    confidence: "alta",
    status: Math.abs(snapshot.unicredSubtotal - unicredEntrySubtotal) < 0.01 ? "ok" : "divergente",
    formula: "Soma de entries com account=Unicred e invoiceMonth=currentMonth (exclui invoice_payment)",
  });

  reports.push({
    kpi: `Nubank (${currentMonth})`,
    displayed: snapshot.nubankSubtotal,
    recalculated: nubankEntrySubtotal,
    diff: snapshot.nubankSubtotal - nubankEntrySubtotal,
    confidence: "alta",
    status: Math.abs(snapshot.nubankSubtotal - nubankEntrySubtotal) < 0.01 ? "ok" : "divergente",
    formula: "Soma de entries com account=Nubank e invoiceMonth=currentMonth (exclui invoice_payment)",
  });

  reports.push({
    kpi: "Compras combinadas (todos os cartoes)",
    displayed: snapshot.cardsSubtotal,
    recalculated: unicredEntrySubtotal + nubankEntrySubtotal,
    diff: snapshot.cardsSubtotal - (unicredEntrySubtotal + nubankEntrySubtotal),
    confidence: "alta",
    status: Math.abs(snapshot.cardsSubtotal - (unicredEntrySubtotal + nubankEntrySubtotal)) < 0.01 ? "ok" : "divergente",
    formula: "Soma das compras de Unicred e Nubank no periodo selecionado",
  });

  reports.push({
    kpi: "Parcelas futuras confirmadas",
    displayed: snapshot.futureInstallments,
    recalculated: futureInstallments,
    diff: snapshot.futureInstallments - futureInstallments,
    confidence: "alta",
    status: Math.abs(snapshot.futureInstallments - futureInstallments) < 0.01 ? "ok" : "divergente",
    formula: "Soma de entries de cartao com status=projetado",
  });

  reports.push({
    kpi: `Livre para Gastar (${currentMonth})`,
    displayed: snapshot.safeToSpend,
    recalculated: safeToSpendAudit.safeToSpend,
    diff: snapshot.safeToSpend - safeToSpendAudit.safeToSpend,
    confidence: "alta",
    status: Math.abs(snapshot.safeToSpend - safeToSpendAudit.safeToSpend) < 0.01 ? "ok" : "divergente",
    formula: "Caixa disponivel + receitas confirmadas ate a proxima renda - despesas ate a proxima renda - margem",
  });

  return reports;
}
