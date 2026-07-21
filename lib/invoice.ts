import type { FinanceState, FinanceEntry, InvoiceView, DataQuality } from "./types";

export function buildInvoiceView(
  state: FinanceState,
  card: "Nubank" | "Unicred",
  month: string
): InvoiceView {
  const cardName = card;
  const entries = state.entries.filter(
    (e) =>
      e.account?.toLowerCase() === cardName.toLowerCase() &&
      e.invoiceMonth === month &&
      e.transactionType !== "invoice_payment"
  );

  const identifiedSubtotal = entries.reduce((sum, e) => sum + e.amount, 0);

  const persistedInvoice = state.invoices?.find(
    (inv) => inv.cardId.toLowerCase() === cardName.toLowerCase() && inv.referenceMonth === month
  );

  const officialTotal = persistedInvoice?.officialTotal;
  const closingDate = persistedInvoice?.closingDate || (cardName === "Unicred" ? `${month}-01` : `${month}-01`);
  const dueDate = persistedInvoice?.dueDate || (cardName === "Unicred" ? `${month}-11` : `${month}-10`);

  // Verificar pagamentos desta fatura na base
  const paymentEntries = state.entries.filter(
    (e) =>
      e.transactionType === "invoice_payment" &&
      (e.title.toLowerCase().includes(cardName.toLowerCase()) || e.account?.toLowerCase() === cardName.toLowerCase()) &&
      e.dueDate.slice(0, 7) === month
  );
  const paidAmount = paymentEntries.reduce((sum, e) => sum + e.amount, 0);

  // Cálculo de status baseado na entidade persistida
  let status: "open" | "closed" | "paid" | "partial";
  if (persistedInvoice) {
    status = persistedInvoice.status;
  } else {
    status = "open";
  }

  // Determinar qualidade de dados agregada da fatura
  const qualities = entries.map((e) => e.dataQuality || "completo");
  let dataQuality: DataQuality = "completo";
  if (qualities.includes("estimado")) {
    dataQuality = "estimado";
  } else if (qualities.includes("parcial")) {
    dataQuality = "parcial";
  }

  return {
    id: persistedInvoice?.id || `${cardName.toLowerCase()}-${month}`,
    card: cardName,
    month,
    closingDate,
    dueDate,
    officialTotal,
    identifiedSubtotal,
    paidAmount,
    status,
    entries,
    dataQuality,
  };
}
