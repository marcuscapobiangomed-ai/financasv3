import { describe, it, expect } from "vitest";
import { initialFinanceState } from "../lib/seed";
import { selectInvoiceTotal, selectAllCardPurchases, selectFutureCardInstallments, selectInvoiceEntries } from "../lib/selectors";
import { buildInvoiceView } from "../lib/invoice";

describe("Prova de Reconciliação dos Dados Históricos", () => {
  it("valida que a fatura Unicred de Agosto de 2026 totaliza exatamente R$ 801,85", () => {
    const total = selectInvoiceTotal(initialFinanceState, "Unicred", "2026-08");
    expect(total).toBeCloseTo(801.85, 2);
  });

  it("valida que a fatura Nubank de Agosto de 2026 totaliza exatamente R$ 192,40", () => {
    const total = selectInvoiceTotal(initialFinanceState, "Nubank", "2026-08");
    expect(total).toBeCloseTo(192.40, 2);
  });

  it("valida que o subtotal combinado das faturas de Agosto de 2026 totaliza exatamente R$ 994,25", () => {
    const unicred = selectInvoiceTotal(initialFinanceState, "Unicred", "2026-08");
    const nubank = selectInvoiceTotal(initialFinanceState, "Nubank", "2026-08");
    expect(unicred + nubank).toBeCloseTo(994.25, 2);
  });

  it("valida que selectAllCardPurchases retorna R$ 994,25", () => {
    const total = selectAllCardPurchases(initialFinanceState);
    expect(total).toBeCloseTo(994.25, 2);
  });

  it("valida que o comprometimento futuro do cartão Unicred totaliza exatamente R$ 436,66", () => {
    const futureUnicred = initialFinanceState.entries
      .filter((e) => e.account?.toLowerCase() === "unicred" && e.dueDate > "2026-08-31" && e.status === "projetado")
      .reduce((sum, e) => sum + e.amount, 0);
    expect(futureUnicred).toBeCloseTo(436.66, 2);
  });

  it("valida que o comprometimento futuro do cartão Nubank totaliza exatamente R$ 138,35", () => {
    const futureNubank = initialFinanceState.entries
      .filter((e) => e.account?.toLowerCase() === "nubank" && e.dueDate > "2026-08-31" && e.status === "projetado")
      .reduce((sum, e) => sum + e.amount, 0);
    expect(futureNubank).toBeCloseTo(138.35, 2);
  });

  it("valida que selectFutureCardInstallments retorna R$ 575,01", () => {
    const future = selectFutureCardInstallments(initialFinanceState);
    expect(future).toBeCloseTo(575.01, 2);
  });

  it("valida que a Unicred tem exatamente 27 compras na fatura de agosto", () => {
    const entries = selectInvoiceEntries(initialFinanceState, "Unicred", "2026-08");
    expect(entries).toHaveLength(27);
  });

  it("valida que a Nubank tem exatamente 9 compras na fatura de agosto", () => {
    const entries = selectInvoiceEntries(initialFinanceState, "Nubank", "2026-08");
    expect(entries).toHaveLength(9);
  });

  it("valida que o pagamento Nubank de R$ 482,12 não aparece como compra", () => {
    const unicredEntries = selectInvoiceEntries(initialFinanceState, "Unicred", "2026-08");
    const nubankEntries = selectInvoiceEntries(initialFinanceState, "Nubank", "2026-08");
    const allEntries = [...unicredEntries, ...nubankEntries];
    expect(allEntries.some((e) => e.id === "nubank-payment-2026-07-10")).toBe(false);
  });

  it("valida que o pagamento Nubank existe na base com transactionType invoice_payment", () => {
    const payment = initialFinanceState.entries.find((e) => e.id === "nubank-payment-2026-07-10");
    expect(payment).toBeDefined();
    expect(payment?.transactionType).toBe("invoice_payment");
    expect(payment?.includeInSpending).toBe(false);
    expect(payment?.amount).toBe(482.12);
  });

  it("valida que as entidades de fatura estão configuradas como partial sem officialTotal", () => {
    const unicredInv = initialFinanceState.invoices?.find((i) => i.id === "invoice-unicred-2026-08");
    const nubankInv = initialFinanceState.invoices?.find((i) => i.id === "invoice-nubank-2026-08");

    expect(unicredInv).toBeDefined();
    expect(nubankInv).toBeDefined();

    if (unicredInv) {
      expect(unicredInv.status).toBe("partial");
      expect(unicredInv.officialTotal).toBeUndefined();
      expect(unicredInv.dataQuality).toBe("parcial");
      expect(unicredInv.closingDate).toBe("2026-08-01");
      expect(unicredInv.identifiedSubtotal).toBe(801.85);
    }

    if (nubankInv) {
      expect(nubankInv.status).toBe("partial");
      expect(nubankInv.officialTotal).toBeUndefined();
      expect(nubankInv.dataQuality).toBe("parcial");
      expect(nubankInv.closingDate).toBe("2026-07-31");
      expect(nubankInv.identifiedSubtotal).toBe(192.40);
    }
  });

  it("valida que buildInvoiceView retorna dados consistentes com a entidade", () => {
    const unicredView = buildInvoiceView(initialFinanceState, "Unicred", "2026-08");
    const nubankView = buildInvoiceView(initialFinanceState, "Nubank", "2026-08");

    expect(unicredView.identifiedSubtotal).toBeCloseTo(801.85, 2);
    expect(unicredView.officialTotal).toBeUndefined();
    expect(unicredView.status).toBe("partial");

    expect(nubankView.identifiedSubtotal).toBeCloseTo(192.40, 2);
    expect(nubankView.officialTotal).toBeUndefined();
    expect(nubankView.status).toBe("partial");
  });
});
