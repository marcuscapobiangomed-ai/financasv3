import type { FinanceEntry, FinanceState } from "./types";

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

  // 3. Fatura subtotal checks for August 2026 (the recovered target period)
  const unicredAugustSubtotal = entries
    .filter((e) => e.account?.toLowerCase() === "unicred" && e.invoiceMonth === "2026-08")
    .reduce((sum, e) => sum + e.amount, 0);

  const expectedUnicredAugust = 801.85;
  if (unicredAugustSubtotal > 0 && Math.abs(unicredAugustSubtotal - expectedUnicredAugust) > 0.01) {
    issues.push({
      type: "warning",
      code: "INVOICE_SUBTOTAL_MISMATCH_UNICRED",
      message: `O subtotal identificado na fatura Unicred de Agosto (${unicredAugustSubtotal.toFixed(2)}) difere do valor esperado dos prints (${expectedUnicredAugust.toFixed(2)}).`,
    });
  }

  const nubankAugustSubtotal = entries
    .filter((e) => e.account?.toLowerCase() === "nubank" && e.invoiceMonth === "2026-08")
    .reduce((sum, e) => sum + e.amount, 0);

  const expectedNubankAugust = 192.40;
  if (nubankAugustSubtotal > 0 && Math.abs(nubankAugustSubtotal - expectedNubankAugust) > 0.01) {
    issues.push({
      type: "warning",
      code: "INVOICE_SUBTOTAL_MISMATCH_NUBANK",
      message: `O subtotal identificado na fatura Nubank de Agosto (${nubankAugustSubtotal.toFixed(2)}) difere do valor esperado dos prints (${expectedNubankAugust.toFixed(2)}).`,
    });
  }

  return issues;
}
