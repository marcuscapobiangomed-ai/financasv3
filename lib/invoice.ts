import type { FinanceState, FinanceEntry, InvoiceView, DataQuality } from "./types";
import { isEntryInPeriod } from "./finance";

export function buildInvoiceView(
  state: FinanceState,
  card: "Nubank" | "Unicred",
  month: string
): InvoiceView {
  const cardName = card;
  const entries = state.entries.filter(
    (e) => e.account?.toLowerCase() === cardName.toLowerCase() && e.invoiceMonth === month
  );

  const identifiedSubtotal = entries.reduce((sum, e) => sum + e.amount, 0);

  // Totais oficiais para Agosto de 2026 de acordo com os prints
  let officialTotal: number | undefined;
  let closingDate = `${month}-03`; // default
  let dueDate = `${month}-10`; // default
  
  if (month === "2026-08") {
    if (cardName === "Unicred") {
      officialTotal = 801.85;
      closingDate = "2026-08-03";
      dueDate = "2026-08-11";
    } else {
      officialTotal = 192.40;
      closingDate = "2026-08-03";
      dueDate = "2026-08-10";
    }
  } else {
    // defaults based on card
    if (cardName === "Unicred") {
      closingDate = `${month}-03`;
      dueDate = `${month}-11`;
    } else {
      closingDate = `${month}-03`;
      dueDate = `${month}-10`;
    }
  }

  // Verificar lançamentos de pagamento desta fatura na base
  const paymentEntries = state.entries.filter(
    (e) =>
      e.kind === "income" &&
      e.title.toLowerCase().includes("pagamento") &&
      e.title.toLowerCase().includes("fatura") &&
      (e.title.toLowerCase().includes(cardName.toLowerCase()) || e.account?.toLowerCase() === cardName.toLowerCase()) &&
      isEntryInPeriod(e, month)
  );
  const paidAmount = paymentEntries.reduce((sum, e) => sum + e.amount, 0);

  // Cálculo de status
  const targetTotal = officialTotal || identifiedSubtotal;
  let status: "open" | "closed" | "paid" | "partial" = "open";

  if (paidAmount >= targetTotal && targetTotal > 0) {
    status = "paid";
  } else if (paidAmount > 0) {
    status = "partial";
  } else {
    const today = new Date().toLocaleDateString("sv-SE");
    if (today > dueDate) {
      status = "closed";
    } else {
      status = "open";
    }
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
    id: `${cardName.toLowerCase()}-${month}`,
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
