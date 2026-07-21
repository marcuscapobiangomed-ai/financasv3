import type { FinanceEntry, FinanceState } from "./types";
import { buildInvoiceView } from "./invoice";

export type IntegrityIssue = {
  id?: string;
  type: "error" | "warning";
  code: string;
  message: string;
  entry?: FinanceEntry;
  details?: string;
};

export function validateDataIntegrity(state: FinanceState): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  const entries = state.entries;

  // 1. Detect Duplicate IDs
  const idCounts = new Map<string, number>();
  entries.forEach((e) => {
    idCounts.set(e.id, (idCounts.get(e.id) ?? 0) + 1);
  });
  idCounts.forEach((count, id) => {
    if (count > 1) {
      issues.push({
        type: "error",
        code: "DUPLICATE_ID",
        message: `O ID "${id}" está duplicado na base de dados ${count} vezes.`,
      });
    }
  });

  // 2. Validate Individual Entries
  entries.forEach((e) => {
    // Validate Amount
    if (typeof e.amount !== "number" || isNaN(e.amount) || e.amount < 0) {
      issues.push({
        id: e.id,
        type: "error",
        code: "INVALID_AMOUNT",
        message: `Lançamento "${e.title}" tem valor inválido: ${e.amount}.`,
        entry: e,
      });
    }

    // Validate Due Date
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (typeof e.dueDate !== "string" || !dateRegex.test(e.dueDate)) {
      issues.push({
        id: e.id,
        type: "error",
        code: "INVALID_DUE_DATE",
        message: `Lançamento "${e.title}" tem data de vencimento inválida: "${e.dueDate}".`,
        entry: e,
      });
    }

    // Validate Purchase Date if present
    if (e.purchaseDate && (!dateRegex.test(e.purchaseDate) || typeof e.purchaseDate !== "string")) {
      issues.push({
        id: e.id,
        type: "warning",
        code: "INVALID_PURCHASE_DATE",
        message: `Lançamento "${e.title}" tem data de compra com formato inválido: "${e.purchaseDate}".`,
        entry: e,
      });
    }

    // Validate Category
    if (!e.category || e.category.trim() === "" || e.category.toLowerCase() === "outros") {
      issues.push({
        id: e.id,
        type: "warning",
        code: "MISSING_CATEGORY",
        message: `Lançamento "${e.title}" está sem categoria ou classificado como "Outros".`,
        entry: e,
      });
    }

    // Validate Card Invoice month
    const isCard = e.account?.toLowerCase() === "unicred" || e.account?.toLowerCase() === "nubank";
    if (isCard) {
      if (!e.invoiceMonth) {
        issues.push({
          id: e.id,
          type: "warning",
          code: "MISSING_INVOICE_MONTH",
          message: `Compra de cartão "${e.title}" está associada à conta "${e.account}" mas não possui mês de fatura (invoiceMonth).`,
          entry: e,
        });
      } else if (!/^\d{4}-\d{2}$/.test(e.invoiceMonth)) {
        issues.push({
          id: e.id,
          type: "error",
          code: "INVALID_INVOICE_MONTH",
          message: `Compra de cartão "${e.title}" possui formato de mês de fatura inválido: "${e.invoiceMonth}".`,
          entry: e,
        });
      }
    }

    // Check for fatura payments counted as regular expenses
    const titleLower = e.title.toLowerCase();
    if (
      (titleLower.includes("pagamento de fatura") || titleLower.includes("pagamento fatura") || titleLower.includes("fatura pago")) &&
      e.transactionType !== "invoice_payment" &&
      e.kind === "expense" &&
      e.paidBy !== "father"
    ) {
      issues.push({
        id: e.id,
        type: "warning",
        code: "FATURA_PAYMENT_EXPENSE",
        message: `O lançamento "${e.title}" parece ser um pagamento de fatura, mas está classificado como despesa regular. Isso pode duplicar gastos nos relatórios.`,
        entry: e,
      });
    }
  });

  // 3. Invoice Entity vs Computed Subtotal Reconciliation
  if (Array.isArray(state.invoices)) {
    state.invoices.forEach((inv) => {
      const subtotal = entries
        .filter((e) => e.account?.toLowerCase() === inv.cardId.toLowerCase() && e.invoiceMonth === inv.referenceMonth && e.transactionType !== "invoice_payment")
        .reduce((sum, e) => sum + e.amount, 0);

      // Check: computed subtotal vs invoice entity identifiedSubtotal
      if (Math.abs(subtotal - inv.identifiedSubtotal) > 0.01) {
        issues.push({
          type: "warning",
          code: `INVOICE_SUBTOTAL_MISMATCH_${inv.cardId.toUpperCase()}_${inv.referenceMonth.replace("-", "_")}`,
          message: `Divergência na fatura ${inv.cardId} (${inv.referenceMonth}): a soma das compras (R$ ${subtotal.toFixed(2)}) difere do identifiedSubtotal cadastrado (R$ ${inv.identifiedSubtotal.toFixed(2)}).`,
          details: `Diferença de R$ ${(subtotal - inv.identifiedSubtotal).toFixed(2)}. Verifique se há compras faltando, duplicadas, ou se identifiedSubtotal precisa ser atualizado.`,
        });
      }

      // Check: if officialTotal is defined, compare against computed subtotal
      if (inv.officialTotal !== undefined && inv.officialTotal > 0 && Math.abs(subtotal - inv.officialTotal) > 0.01) {
        issues.push({
          type: "warning",
          code: `INVOICE_OFFICIAL_MISMATCH_${inv.cardId.toUpperCase()}_${inv.referenceMonth.replace("-", "_")}`,
          message: `Divergência na fatura ${inv.cardId} (${inv.referenceMonth}): o subtotal identificado (R$ ${subtotal.toFixed(2)}) difere do total oficial cadastrado (R$ ${inv.officialTotal.toFixed(2)}).`,
          details: `Diferença de R$ ${(subtotal - inv.officialTotal).toFixed(2)}. O total oficial veio de documento externo; a diferença precisa ser investigada.`,
        });
      }
    });
  }

  // 5. Cross-page consistency: Invoice Entity vs buildInvoiceView
  if (Array.isArray(state.invoices)) {
    state.invoices.forEach((inv) => {
      const view = buildInvoiceView(state, inv.cardId as "Nubank" | "Unicred", inv.referenceMonth);
      if (inv.identifiedSubtotal !== undefined && Math.abs(view.identifiedSubtotal - inv.identifiedSubtotal) > 0.01) {
        issues.push({
          type: "error",
          code: `INVOICE_ENTITY_VIEW_MISMATCH_${inv.cardId.toUpperCase()}_${inv.referenceMonth.replace("-", "_")}`,
          message: `Inconsistência entre entity e view para ${inv.cardId} (${inv.referenceMonth}): Entity=${R(inv.identifiedSubtotal)} vs View=${R(view.identifiedSubtotal)}.`,
          details: `A entidade de fatura persistida não reflete os lançamentos atuais. Isso pode causar divergência entre a Visão Geral e a página de Cartões.`,
        });
      }
    });
  }

  // 6. Card entries without invoiceMonth
  entries.forEach((e) => {
    const isCard = e.account?.toLowerCase() === "unicred" || e.account?.toLowerCase() === "nubank";
    if (isCard && !e.invoiceMonth) {
      issues.push({
        id: e.id,
        type: "warning",
        code: "CARD_ENTRY_NO_INVOICE_MONTH",
        message: `Lançamento de cartão "${e.title}" não possui invoiceMonth associado.`,
        details: "Lançamentos de cartão devem ter um mês de fatura para aparecerem na página de Cartões e parcelas.",
        entry: e,
      });
    }
  });

  // 7. Check for empty invoices with existing card entries
  const currentMonth = entries[0]?.dueDate?.slice(0, 7) || "";
  if (currentMonth) {
    const unicredView = buildInvoiceView(state, "Unicred", currentMonth);
    const nubankView = buildInvoiceView(state, "Nubank", currentMonth);
    
    if (unicredView.identifiedSubtotal === 0 && entries.some((e) => e.account?.toLowerCase() === "unicred")) {
      issues.push({
        type: "warning",
        code: "UNICRED_EMPTY_INVOICE_WITH_ENTRIES",
        message: `Existem lançamentos Unicred na base, mas a fatura de ${currentMonth} está vazia.`,
        details: "Verifique se os lançamentos possuem invoiceMonth correto para este período.",
      });
    }
    if (nubankView.identifiedSubtotal === 0 && entries.some((e) => e.account?.toLowerCase() === "nubank")) {
      issues.push({
        type: "warning",
        code: "NUBANK_EMPTY_INVOICE_WITH_ENTRIES",
        message: `Existem lançamentos Nubank na base, mas a fatura de ${currentMonth} está vazia.`,
        details: "Verifique se os lançamentos possuem invoiceMonth correto para este período.",
      });
    }
  }

  return issues;
}

function R(value: number): string {
  return `R$ ${value.toFixed(2)}`;
}
