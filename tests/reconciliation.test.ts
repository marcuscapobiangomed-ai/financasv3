import { describe, it, expect } from "vitest";
import { initialFinanceState } from "../lib/seed";
import { selectInvoiceTotal, selectFutureCommitments } from "../lib/selectors";

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
});
