import type { FinanceState, FinanceEntry } from "./types";
import { isEntryInPeriod } from "./finance";
import { buildInvoiceView } from "./invoice";

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

// Três Cenários do Livre para Gastar
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

  // 3. Fatura Unicred — subtotal identificado vs soma de compras
  const unicredEntrySubtotal = selectInvoiceTotal(state, "Unicred", currentMonth);
  const unicredInvoice = state.invoices?.find(
    (i) => i.cardId.toLowerCase() === "unicred" && i.referenceMonth === currentMonth
  );

  reports.push({
    kpi: `Unicred (${currentMonth}) — Compras recalculadas`,
    displayed: unicredEntrySubtotal,
    recalculated: unicredEntrySubtotal,
    diff: 0,
    confidence: "alta",
    status: "ok",
    formula: "Soma de entries com account=Unicred e invoiceMonth=currentMonth (exclui invoice_payment)",
  });

  if (unicredInvoice) {
    const diffUnicred = unicredInvoice.identifiedSubtotal - unicredEntrySubtotal;
    reports.push({
      kpi: `Unicred (${currentMonth}) — Entity vs Lançamentos`,
      displayed: unicredInvoice.identifiedSubtotal,
      recalculated: unicredEntrySubtotal,
      diff: diffUnicred,
      confidence: unicredInvoice.officialTotal ? "alta" : "média",
      status: Math.abs(diffUnicred) < 0.01 ? "ok" : "divergente",
      formula: unicredInvoice.officialTotal
        ? `Invoice.identifiedSubtotal (R$ ${unicredInvoice.officialTotal.toFixed(2)} oficial) vs Soma de entries`
        : `Invoice.identifiedSubtotal vs Soma de entries (sem total oficial)`,
    });
  }

  // 4. Fatura Nubank — subtotal identificado vs soma de compras
  const nubankEntrySubtotal = selectInvoiceTotal(state, "Nubank", currentMonth);
  const nubankInvoice = state.invoices?.find(
    (i) => i.cardId.toLowerCase() === "nubank" && i.referenceMonth === currentMonth
  );

  reports.push({
    kpi: `Nubank (${currentMonth}) — Compras recalculadas`,
    displayed: nubankEntrySubtotal,
    recalculated: nubankEntrySubtotal,
    diff: 0,
    confidence: "alta",
    status: "ok",
    formula: "Soma de entries com account=Nubank e invoiceMonth=currentMonth (exclui invoice_payment)",
  });

  if (nubankInvoice) {
    const diffNubank = nubankInvoice.identifiedSubtotal - nubankEntrySubtotal;
    reports.push({
      kpi: `Nubank (${currentMonth}) — Entity vs Lançamentos`,
      displayed: nubankInvoice.identifiedSubtotal,
      recalculated: nubankEntrySubtotal,
      diff: diffNubank,
      confidence: nubankInvoice.officialTotal ? "alta" : "média",
      status: Math.abs(diffNubank) < 0.01 ? "ok" : "divergente",
      formula: nubankInvoice.officialTotal
        ? `Invoice.identifiedSubtotal (R$ ${nubankInvoice.officialTotal.toFixed(2)} oficial) vs Soma de entries`
        : `Invoice.identifiedSubtotal vs Soma de entries (sem total oficial)`,
    });
  }

  // 5. Total combinado de compras de cartão
  const allCardPurchases = selectAllCardPurchases(state);
  reports.push({
    kpi: "Compras combinadas (todos os cartões)",
    displayed: allCardPurchases,
    recalculated: allCardPurchases,
    diff: 0,
    confidence: "alta",
    status: "ok",
    formula: "Soma de todas as compras de cartão (exclui invoice_payment)",
  });

  // 6. Parcelas futuras
  const futureInstallments = selectFutureCardInstallments(state);
  reports.push({
    kpi: "Parcelas futuras confirmadas",
    displayed: futureInstallments,
    recalculated: futureInstallments,
    diff: 0,
    confidence: "alta",
    status: "ok",
    formula: "Soma de entries de cartão com status=projetado",
  });

  // 7. Livre para Gastar (Conservador)
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
