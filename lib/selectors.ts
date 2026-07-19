import type { FinanceState, FinanceEntry } from "./types";
import { getSafeToSpend, isEntryInPeriod } from "./finance";

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

export function selectSafeToSpend(state: FinanceState, today: string, safetyMargin: number) {
  return getSafeToSpend(state, today, safetyMargin);
}
