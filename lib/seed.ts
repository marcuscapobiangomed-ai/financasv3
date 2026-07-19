import type { FinanceEntry, FinanceState } from "./types";

function parsePurchaseDate(note?: string, dueDate?: string): string {
  if (note) {
    const match = note.match(/Compra em (\d{2})\/(\d{2})\/(\d{4})/);
    if (match) {
      return `${match[3]}-${match[2]}-${match[1]}`;
    }
  }
  return dueDate || "";
}

function mapCardEntries(entries: any[], accountName: string): FinanceEntry[] {
  return entries.map((entry) => {
    const purchaseDate = parsePurchaseDate(entry.note, entry.dueDate);
    const isFuture = entry.dueDate > (accountName === "Unicred" ? "2026-08-11" : "2026-08-10");
    return {
      ...entry,
      account: accountName,
      purchaseDate,
      invoiceMonth: entry.dueDate.slice(0, 7),
      dataQuality: isFuture ? "estimado" : "parcial",
      isOfficial: false,
      status: isFuture ? "projetado" : "a_pagar",
    };
  });
}

function mapOtherEntries(entries: any[]): FinanceEntry[] {
  return entries.map((entry) => {
    let newStatus = entry.status;
    let dataQuality = entry.dataQuality || "completo";

    if (entry.kind === "income") {
      if (entry.status === "received") {
        newStatus = "recebido";
      } else if (entry.status === "pending" || entry.status === "planned") {
        newStatus = "a_receber_confirmado";
      }
    } else {
      if (entry.status === "received") {
        newStatus = "realizado";
      } else if (entry.status === "pending") {
        newStatus = "a_pagar";
      } else if (entry.status === "planned") {
        newStatus = "projetado";
        dataQuality = "estimado";
      }
    }

    return {
      ...entry,
      status: newStatus,
      dataQuality,
      isOfficial: entry.isOfficial ?? true,
    };
  });
}

const unicredEntries: any[] = [
  { id: "unicred-petite-2026-07-15", title: "Petite Patisserie & Co", amount: 75.00, kind: "expense", dueDate: "2026-08-11", status: "planned", category: "Alimentação", account: "Unicred", paidBy: "me", note: "Compra em 15/07/2026. Importado de prints da fatura Unicred; conferir contra o PDF/CSV." },
  { id: "unicred-iof-deepseek-2026-07-14", title: "IOF — transação exterior", amount: 0.38, kind: "expense", dueDate: "2026-08-11", status: "planned", category: "Taxas", account: "Unicred", paidBy: "me", note: "Compra em 14/07/2026. Importado de prints da fatura Unicred; conferir contra o PDF/CSV. Relacionado à compra Deepseek" },
  { id: "unicred-deepseek-2026-07-14", title: "Deepseek", amount: 10.85, kind: "expense", dueDate: "2026-08-11", status: "planned", category: "IA e assinaturas", account: "Unicred", paidBy: "me", note: "Compra em 14/07/2026. Importado de prints da fatura Unicred; conferir contra o PDF/CSV. Compra internacional" },
  { id: "unicred-ultrapopular-2026-07-14", title: "Ultrapopular Vassoura", amount: 52.50, kind: "expense", dueDate: "2026-08-11", status: "planned", category: "Saúde", account: "Unicred", paidBy: "me", note: "Compra em 14/07/2026. Importado de prints da fatura Unicred; conferir contra o PDF/CSV." },
  { id: "unicred-clickbus-2026-07-13", title: "ClickBus", amount: 30.05, kind: "expense", dueDate: "2026-08-11", status: "planned", category: "Transporte", account: "Unicred", paidBy: "me", note: "Compra em 13/07/2026. Importado de prints da fatura Unicred; conferir contra o PDF/CSV." },
  { id: "unicred-vodec-2026-07-12", title: "Vodec Comércio de Alimentos", amount: 41.80, kind: "expense", dueDate: "2026-08-11", status: "planned", category: "Alimentação", account: "Unicred", paidBy: "me", note: "Compra em 12/07/2026. Importado de prints da fatura Unicred; conferir contra o PDF/CSV." },
  { id: "unicred-restaurante-rodr-2026-07-10", title: "Bar e Restaurante Rodr", amount: 70.00, kind: "expense", dueDate: "2026-08-11", status: "planned", category: "Alimentação", account: "Unicred", paidBy: "me", note: "Compra em 10/07/2026. Importado de prints da fatura Unicred; conferir contra o PDF/CSV." },
  { id: "unicred-casa-atleta-2026-07-10", title: "Casa do Atleta VR", amount: 104.98, kind: "expense", dueDate: "2026-08-11", status: "planned", category: "Compras pessoais", account: "Unicred", paidBy: "me", note: "Compra em 10/07/2026. Importado de prints da fatura Unicred; conferir contra o PDF/CSV." },
  { id: "unicred-parada-celular-2026-07-08", title: "Parada do Celular", amount: 30.00, kind: "expense", dueDate: "2026-08-11", status: "planned", category: "Tecnologia", account: "Unicred", paidBy: "me", note: "Compra em 08/07/2026. Importado de prints da fatura Unicred; conferir contra o PDF/CSV." },
  { id: "unicred-muticafe-2026-07-08", title: "Muticafe", amount: 23.50, kind: "expense", dueDate: "2026-08-11", status: "planned", category: "Alimentação", account: "Unicred", paidBy: "me", note: "Compra em 08/07/2026. Importado de prints da fatura Unicred; conferir contra o PDF/CSV." },
  { id: "unicred-cafe-charutaria-2026-07-08", title: "Café e Charutaria", amount: 9.00, kind: "expense", dueDate: "2026-08-11", status: "planned", category: "Alimentação", account: "Unicred", paidBy: "me", note: "Compra em 08/07/2026. Importado de prints da fatura Unicred; conferir contra o PDF/CSV." },
  { id: "unicred-clickbus-2026-07-07", title: "ClickBus", amount: 32.62, kind: "expense", dueDate: "2026-08-11", status: "planned", category: "Transporte", account: "Unicred", paidBy: "me", note: "Compra em 07/07/2026. Importado de prints da fatura Unicred; conferir contra o PDF/CSV." },
  { id: "unicred-evaldo-2026-07-07", title: "Evaldo Nunes de Andrade", amount: 14.00, kind: "expense", dueDate: "2026-08-11", status: "planned", category: "Alimentação", account: "Unicred", paidBy: "me", note: "Compra em 07/07/2026. Importado de prints da fatura Unicred; conferir contra o PDF/CSV. Categoria inferida pelo ícone do aplicativo" },
  { id: "unicred-shoppingparksul-2026-07-06", title: "Shopping Park Sul", amount: 17.00, kind: "expense", dueDate: "2026-08-11", status: "planned", category: "Compras pessoais", account: "Unicred", paidBy: "me", note: "Compra em 06/07/2026. Importado de prints da fatura Unicred; conferir contra o PDF/CSV. Categoria provisória" },
  { id: "unicred-coffee-break-2026-07-06", title: "Coffee Break", amount: 14.00, kind: "expense", dueDate: "2026-08-11", status: "planned", category: "Alimentação", account: "Unicred", paidBy: "me", note: "Compra em 06/07/2026. Importado de prints da fatura Unicred; conferir contra o PDF/CSV." },
  { id: "unicred-zuhause-bier-2026-07-03", title: "Zuhause Bier", amount: 69.40, kind: "expense", dueDate: "2026-08-11", status: "planned", category: "Alimentação", account: "Unicred", paidBy: "me", note: "Compra em 03/07/2026. Importado de prints da fatura Unicred; conferir contra o PDF/CSV." },
  { id: "unicred-anuidade-2026-07-03", title: "Anuidade — parcela", amount: 30.00, kind: "expense", dueDate: "2026-08-11", status: "planned", category: "Taxas bancárias", account: "Unicred", paidBy: "me", note: "Compra em 03/07/2026. Importado de prints da fatura Unicred; conferir contra o PDF/CSV. Lançamento aparece como à vista na fatura" },
  { id: "unicred-grazy-gourmet-2026-07-02", title: "Grazy Espaço Gourmet", amount: 8.00, kind: "expense", dueDate: "2026-08-11", status: "planned", category: "Alimentação", account: "Unicred", paidBy: "me", note: "Compra em 02/07/2026. Importado de prints da fatura Unicred; conferir contra o PDF/CSV." },
  { id: "unicred-99-2026-06-23", title: "99", amount: 7.74, kind: "expense", dueDate: "2026-08-11", status: "planned", category: "Transporte", account: "Unicred", paidBy: "me", installment: "2/6", note: "Compra em 23/06/2026. Importado de prints da fatura Unicred; conferir contra o PDF/CSV." },
  { id: "unicred-99-2026-06-16", title: "99", amount: 5.12, kind: "expense", dueDate: "2026-08-11", status: "planned", category: "Transporte", account: "Unicred", paidBy: "me", installment: "parcelado — nº oculto", note: "Compra em 16/06/2026. Importado de prints da fatura Unicred; conferir contra o PDF/CSV. Número da parcela ficou coberto no print; não foram criadas parcelas futuras" },
  { id: "unicred-jpasantos-2026-06-06", title: "JPA Santos Farmácia", amount: 36.11, kind: "expense", dueDate: "2026-08-11", status: "planned", category: "Saúde", account: "Unicred", paidBy: "me", installment: "2/2", note: "Compra em 06/06/2026. Importado de prints da fatura Unicred; conferir contra o PDF/CSV." },
  { id: "unicred-drogaria-retiro-2026-06-05", title: "Drogaria Retiro", amount: 36.46, kind: "expense", dueDate: "2026-08-11", status: "planned", category: "Saúde", account: "Unicred", paidBy: "me", installment: "2/3", note: "Compra em 05/06/2026. Importado de prints da fatura Unicred; conferir contra o PDF/CSV." },
  { id: "unicred-shopee-nosso-lar-2026-04-14", title: "Shopee — Nosso Lar Enxovais", amount: 19.08, kind: "expense", dueDate: "2026-08-11", status: "planned", category: "Casa", account: "Unicred", paidBy: "me", installment: "4/4", note: "Compra em 14/04/2026. Importado de prints da fatura Unicred; conferir contra o PDF/CSV." },
  { id: "unicred-vivo-easy-2026-04-11", title: "Vivo Easy Anual", amount: 30.00, kind: "expense", dueDate: "2026-08-11", status: "planned", category: "Telefonia", account: "Unicred", paidBy: "me", installment: "4/12", note: "Compra em 11/04/2026. Importado de prints da fatura Unicred; conferir contra o PDF/CSV." },
  { id: "unicred-shopee-festas-2026-04-07", title: "Shopee — Mam Festas e Produtos", amount: 5.23, kind: "expense", dueDate: "2026-08-11", status: "planned", category: "Presentes e festas", account: "Unicred", paidBy: "me", installment: "4/4", note: "Compra em 07/04/2026. Importado de prints da fatura Unicred; conferir contra o PDF/CSV." },
  { id: "unicred-shopee-susstore-2026-02-09", title: "Shopee — Susstore", amount: 21.54, kind: "expense", dueDate: "2026-08-11", status: "planned", category: "Compras pessoais", account: "Unicred", paidBy: "me", installment: "6/12", note: "Compra em 09/02/2026. Importado de prints da fatura Unicred; conferir contra o PDF/CSV." },
  { id: "unicred-aliexpress-2025-09-11", title: "AliExpress", amount: 7.49, kind: "expense", dueDate: "2026-08-11", status: "planned", category: "Compras pessoais", account: "Unicred", paidBy: "me", installment: "10/12?", note: "Compra em 11/09/2025. Importado de prints da fatura Unicred; conferir contra o PDF/CSV. Número parcialmente coberto no print; parece 10/12. Parcelas futuras não projetadas" },
  { id: "unicred-99-7-74-2026-09", title: "99", amount: 7.74, kind: "expense", dueDate: "2026-09-11", status: "planned", category: "Transporte", account: "Unicred", paidBy: "me", recurring: true, installment: "3/6", estimatedDate: true, note: "Parcela futura projetada a partir do print da fatura Unicred." },
  { id: "unicred-99-7-74-2026-10", title: "99", amount: 7.74, kind: "expense", dueDate: "2026-10-11", status: "planned", category: "Transporte", account: "Unicred", paidBy: "me", recurring: true, installment: "4/6", estimatedDate: true, note: "Parcela futura projetada a partir do print da fatura Unicred." },
  { id: "unicred-99-7-74-2026-11", title: "99", amount: 7.74, kind: "expense", dueDate: "2026-11-11", status: "planned", category: "Transporte", account: "Unicred", paidBy: "me", recurring: true, installment: "5/6", estimatedDate: true, note: "Parcela futura projetada a partir do print da fatura Unicred." },
  { id: "unicred-99-7-74-2026-12", title: "99", amount: 7.74, kind: "expense", dueDate: "2026-12-11", status: "planned", category: "Transporte", account: "Unicred", paidBy: "me", recurring: true, installment: "6/6", estimatedDate: true, note: "Parcela futura projetada a partir do print da fatura Unicred." },
  { id: "unicred-drogaria-retiro-2026-09", title: "Drogaria Retiro", amount: 36.46, kind: "expense", dueDate: "2026-09-11", status: "planned", category: "Saúde", account: "Unicred", paidBy: "me", recurring: true, installment: "3/3", estimatedDate: true, note: "Parcela futura projetada a partir do print da fatura Unicred." },
  { id: "unicred-vivo-easy-2026-09", title: "Vivo Easy Anual", amount: 30.00, kind: "expense", dueDate: "2026-09-11", status: "planned", category: "Telefonia", account: "Unicred", paidBy: "me", recurring: true, installment: "5/12", estimatedDate: true, note: "Parcela futura projetada a partir do print da fatura Unicred." },
  { id: "unicred-vivo-easy-2026-10", title: "Vivo Easy Anual", amount: 30.00, kind: "expense", dueDate: "2026-10-11", status: "planned", category: "Telefonia", account: "Unicred", paidBy: "me", recurring: true, installment: "6/12", estimatedDate: true, note: "Parcela futura projetada a partir do print da fatura Unicred." },
  { id: "unicred-vivo-easy-2026-11", title: "Vivo Easy Anual", amount: 30.00, kind: "expense", dueDate: "2026-11-11", status: "planned", category: "Telefonia", account: "Unicred", paidBy: "me", recurring: true, installment: "7/12", estimatedDate: true, note: "Parcela futura projetada a partir do print da fatura Unicred." },
  { id: "unicred-vivo-easy-2026-12", title: "Vivo Easy Anual", amount: 30.00, kind: "expense", dueDate: "2026-12-11", status: "planned", category: "Telefonia", account: "Unicred", paidBy: "me", recurring: true, installment: "8/12", estimatedDate: true, note: "Parcela futura projetada a partir do print da fatura Unicred." },
  { id: "unicred-vivo-easy-2027-01", title: "Vivo Easy Anual", amount: 30.00, kind: "expense", dueDate: "2027-01-11", status: "planned", category: "Telefonia", account: "Unicred", paidBy: "me", recurring: true, installment: "9/12", estimatedDate: true, note: "Parcela futura projetada a partir do print da fatura Unicred." },
  { id: "unicred-vivo-easy-2027-02", title: "Vivo Easy Anual", amount: 30.00, kind: "expense", dueDate: "2027-02-11", status: "planned", category: "Telefonia", account: "Unicred", paidBy: "me", recurring: true, installment: "10/12", estimatedDate: true, note: "Parcela futura projetada a partir do print da fatura Unicred." },
  { id: "unicred-vivo-easy-2027-03", title: "Vivo Easy Anual", amount: 30.00, kind: "expense", dueDate: "2027-03-11", status: "planned", category: "Telefonia", account: "Unicred", paidBy: "me", recurring: true, installment: "11/12", estimatedDate: true, note: "Parcela futura projetada a partir do print da fatura Unicred." },
  { id: "unicred-vivo-easy-2027-04", title: "Vivo Easy Anual", amount: 30.00, kind: "expense", dueDate: "2027-04-11", status: "planned", category: "Telefonia", account: "Unicred", paidBy: "me", recurring: true, installment: "12/12", estimatedDate: true, note: "Parcela futura projetada a partir do print da fatura Unicred." },
  { id: "unicred-shopee-susstore-2026-09", title: "Shopee — Susstore", amount: 21.54, kind: "expense", dueDate: "2026-09-11", status: "planned", category: "Compras pessoais", account: "Unicred", paidBy: "me", recurring: true, installment: "7/12", estimatedDate: true, note: "Parcela futura projetada a partir do print da fatura Unicred." },
  { id: "unicred-shopee-susstore-2026-10", title: "Shopee — Susstore", amount: 21.54, kind: "expense", dueDate: "2026-10-11", status: "planned", category: "Compras pessoais", account: "Unicred", paidBy: "me", recurring: true, installment: "8/12", estimatedDate: true, note: "Parcela futura projetada a partir do print da fatura Unicred." },
  { id: "unicred-shopee-susstore-2026-11", title: "Shopee — Susstore", amount: 21.54, kind: "expense", dueDate: "2026-11-11", status: "planned", category: "Compras pessoais", account: "Unicred", paidBy: "me", recurring: true, installment: "9/12", estimatedDate: true, note: "Parcela futura projetada a partir do print da fatura Unicred." },
  { id: "unicred-shopee-susstore-2026-12", title: "Shopee — Susstore", amount: 21.54, kind: "expense", dueDate: "2026-12-11", status: "planned", category: "Compras pessoais", account: "Unicred", paidBy: "me", recurring: true, installment: "10/12", estimatedDate: true, note: "Parcela futura projetada a partir do print da fatura Unicred." },
  { id: "unicred-shopee-susstore-2027-01", title: "Shopee — Susstore", amount: 21.54, kind: "expense", dueDate: "2027-01-11", status: "planned", category: "Compras pessoais", account: "Unicred", paidBy: "me", recurring: true, installment: "11/12", estimatedDate: true, note: "Parcela futura projetada a partir do print da fatura Unicred." },
  { id: "unicred-shopee-susstore-2027-02", title: "Shopee — Susstore", amount: 21.54, kind: "expense", dueDate: "2027-02-11", status: "planned", category: "Compras pessoais", account: "Unicred", paidBy: "me", recurring: true, installment: "12/12", estimatedDate: true, note: "Parcela futura projetada a partir do print da fatura Unicred." },
];

const nubankEntries: any[] = [
  { id: "nubank-ifood-2026-07-10", title: "iFood — NuPay", amount: 50.99, kind: "expense", dueDate: "2026-08-10", status: "planned", category: "Alimentação", account: "Nubank", paidBy: "me", note: "Compra em 10/07/2026. Importado de prints da fatura Nubank de agosto/2026; conferir contra PDF/CSV." },
  { id: "nubank-openai-2026-07-05", title: "OpenAI — ChatGPT", amount: 103.48, kind: "expense", dueDate: "2026-08-10", status: "planned", category: "IA e assinaturas", account: "Nubank", paidBy: "me", note: "Compra internacional em 05/07/2026. Importado de prints da fatura Nubank de agosto/2026." },
  { id: "nubank-iof-openai-2026-07-05", title: "IOF — compra internacional", amount: 3.62, kind: "expense", dueDate: "2026-08-10", status: "planned", category: "Taxas", account: "Nubank", paidBy: "me", note: "IOF relacionado à compra internacional de 05/07/2026." },
  { id: "nubank-paulo-gustavo-2026-08", title: "Pix no Crédito — Produtos Naturais", amount: 9.66, kind: "expense", dueDate: "2026-08-10", status: "planned", category: "Saúde", account: "Nubank", paidBy: "me", installment: "11/12", note: "Paulo Gustavo MR Comércio de Produtos Naturais. Categoria provisória." },
  { id: "nubank-paraiso-pet-2026-08", title: "Paraíso — Casa, Planta e Pet", amount: 11.56, kind: "expense", dueDate: "2026-08-10", status: "planned", category: "Casa e pet", account: "Nubank", paidBy: "me", installment: "2/12" },
  { id: "nubank-cartorio-2026-08", title: "Pix no Crédito — Cartório", amount: 1.42, kind: "expense", dueDate: "2026-08-10", status: "planned", category: "Documentos e taxas", account: "Nubank", paidBy: "me", installment: "11/12" },
  { id: "nubank-padaria-2026-08", title: "Pix no Crédito — Padaria da Ilha", amount: 3.29, kind: "expense", dueDate: "2026-08-10", status: "planned", category: "Alimentação", account: "Nubank", paidBy: "me", installment: "11/12" },
  { id: "nubank-ebanx-2026-08", title: "Pix no Crédito — EBANX", amount: 5.06, kind: "expense", dueDate: "2026-08-10", status: "planned", category: "Compras online", account: "Nubank", paidBy: "me", installment: "9/10", note: "Categoria provisória; estabelecimento final não aparece no print." },
  { id: "nubank-ifood-parcela-2026-08", title: "iFood — NuPay", amount: 3.32, kind: "expense", dueDate: "2026-08-10", status: "planned", category: "Alimentação", account: "Nubank", paidBy: "me", installment: "11/12" },

  { id: "nubank-paulo-gustavo-2026-09", title: "Pix no Crédito — Produtos Naturais", amount: 9.66, kind: "expense", dueDate: "2026-09-10", status: "planned", category: "Saúde", account: "Nubank", paidBy: "me", recurring: true, installment: "12/12", estimatedDate: true, note: "Parcela futura projetada a partir do print da fatura Nubank." },
  { id: "nubank-cartorio-2026-09", title: "Pix no Crédito — Cartório", amount: 1.42, kind: "expense", dueDate: "2026-09-10", status: "planned", category: "Documentos e taxas", account: "Nubank", paidBy: "me", recurring: true, installment: "12/12", estimatedDate: true, note: "Parcela futura projetada a partir do print da fatura Nubank." },
  { id: "nubank-padaria-2026-09", title: "Pix no Crédito — Padaria da Ilha", amount: 3.29, kind: "expense", dueDate: "2026-09-10", status: "planned", category: "Alimentação", account: "Nubank", paidBy: "me", recurring: true, installment: "12/12", estimatedDate: true, note: "Parcela futura projetada a partir do print da fatura Nubank." },
  { id: "nubank-ebanx-2026-09", title: "Pix no Crédito — EBANX", amount: 5.06, kind: "expense", dueDate: "2026-09-10", status: "planned", category: "Compras online", account: "Nubank", paidBy: "me", recurring: true, installment: "10/10", estimatedDate: true, note: "Parcela futura projetada a partir do print da fatura Nubank." },
  { id: "nubank-ifood-parcela-2026-09", title: "iFood — NuPay", amount: 3.32, kind: "expense", dueDate: "2026-09-10", status: "planned", category: "Alimentação", account: "Nubank", paidBy: "me", recurring: true, installment: "12/12", estimatedDate: true, note: "Parcela futura projetada a partir do print da fatura Nubank." },
  { id: "nubank-paraiso-pet-2026-09", title: "Paraíso — Casa, Planta e Pet", amount: 11.56, kind: "expense", dueDate: "2026-09-10", status: "planned", category: "Casa e pet", account: "Nubank", paidBy: "me", recurring: true, installment: "3/12", estimatedDate: true, note: "Parcela futura projetada a partir do print da fatura Nubank." },
  { id: "nubank-paraiso-pet-2026-10", title: "Paraíso — Casa, Planta e Pet", amount: 11.56, kind: "expense", dueDate: "2026-10-10", status: "planned", category: "Casa e pet", account: "Nubank", paidBy: "me", recurring: true, installment: "4/12", estimatedDate: true, note: "Parcela futura projetada a partir do print da fatura Nubank." },
  { id: "nubank-paraiso-pet-2026-11", title: "Paraíso — Casa, Planta e Pet", amount: 11.56, kind: "expense", dueDate: "2026-11-10", status: "planned", category: "Casa e pet", account: "Nubank", paidBy: "me", recurring: true, installment: "5/12", estimatedDate: true, note: "Parcela futura projetada a partir do print da fatura Nubank." },
  { id: "nubank-paraiso-pet-2026-12", title: "Paraíso — Casa, Planta e Pet", amount: 11.56, kind: "expense", dueDate: "2026-12-10", status: "planned", category: "Casa e pet", account: "Nubank", paidBy: "me", recurring: true, installment: "6/12", estimatedDate: true, note: "Parcela futura projetada a partir do print da fatura Nubank." },
  { id: "nubank-paraiso-pet-2027-01", title: "Paraíso — Casa, Planta e Pet", amount: 11.56, kind: "expense", dueDate: "2027-01-10", status: "planned", category: "Casa e pet", account: "Nubank", paidBy: "me", recurring: true, installment: "7/12", estimatedDate: true, note: "Parcela futura projetada a partir do print da fatura Nubank." },
  { id: "nubank-paraiso-pet-2027-02", title: "Paraíso — Casa, Planta e Pet", amount: 11.56, kind: "expense", dueDate: "2027-02-10", status: "planned", category: "Casa e pet", account: "Nubank", paidBy: "me", recurring: true, installment: "8/12", estimatedDate: true, note: "Parcela futura projetada a partir do print da fatura Nubank." },
  { id: "nubank-paraiso-pet-2027-03", title: "Paraíso — Casa, Planta e Pet", amount: 11.56, kind: "expense", dueDate: "2027-03-10", status: "planned", category: "Casa e pet", account: "Nubank", paidBy: "me", recurring: true, installment: "9/12", estimatedDate: true, note: "Parcela futura projetada a partir do print da fatura Nubank." },
  { id: "nubank-paraiso-pet-2027-04", title: "Paraíso — Casa, Planta e Pet", amount: 11.56, kind: "expense", dueDate: "2027-04-10", status: "planned", category: "Casa e pet", account: "Nubank", paidBy: "me", recurring: true, installment: "10/12", estimatedDate: true, note: "Parcela futura projetada a partir do print da fatura Nubank." },
  { id: "nubank-paraiso-pet-2027-05", title: "Paraíso — Casa, Planta e Pet", amount: 11.56, kind: "expense", dueDate: "2027-05-10", status: "planned", category: "Casa e pet", account: "Nubank", paidBy: "me", recurring: true, installment: "11/12", estimatedDate: true, note: "Parcela futura projetada a partir do print da fatura Nubank." },
  { id: "nubank-paraiso-pet-2027-06", title: "Paraíso — Casa, Planta e Pet", amount: 11.56, kind: "expense", dueDate: "2027-06-10", status: "planned", category: "Casa e pet", account: "Nubank", paidBy: "me", recurring: true, installment: "12/12", estimatedDate: true, note: "Parcela futura projetada a partir do print da fatura Nubank." },
];

export const initialFinanceState: FinanceState = {
  goal: 10000,
  updatedAt: "2026-07-18T23:07:00-03:00",
  accounts: [
    {
      id: "cofrinho",
      name: "Cofrinho 123% CDI",
      type: "reserve",
      balance: 4805.56,
      available: false,
      note: "Rentabilidade promocional informada até 31/07/2026",
    },
    {
      id: "pix",
      name: "Pix / carteira",
      type: "cash",
      balance: 150,
      available: true,
      note: "Saldo operacional informado",
    },
  ],
  entries: [
    ...mapCardEntries(unicredEntries, "Unicred"),
    ...mapCardEntries(nubankEntries, "Nubank"),
    ...mapOtherEntries([
      { id: "clara-2026-07", title: "Clara", amount: 50, kind: "income", dueDate: "2026-07-21", status: "pending", category: "Presentes", source: "Clara" },
      { id: "luandder-2026-07", title: "Luandder", amount: 283, kind: "income", dueDate: "2026-07-25", status: "pending", category: "Freelancer", source: "Luandder", recurring: true, installment: "1/2" },
      { id: "luandder-2026-08", title: "Luandder", amount: 283, kind: "income", dueDate: "2026-08-25", status: "planned", category: "Freelancer", source: "Luandder", recurring: true, installment: "2/2" },
      { id: "biel-2026-08", title: "Biel", amount: 500, kind: "income", dueDate: "2026-08-05", status: "planned", category: "Venda de produtos", source: "Biel", recurring: true, installment: "1/2" },
      { id: "biel-2026-09", title: "Biel", amount: 300, kind: "income", dueDate: "2026-09-05", status: "planned", category: "Venda de produtos", source: "Biel", recurring: true, installment: "2/2" },
      { id: "dargam-2026-08", title: "Dargam — artigo", amount: 125, kind: "income", dueDate: "2026-08-05", status: "planned", category: "Artigos", source: "Dargam", recurring: true },
      { id: "dargam-2026-09", title: "Dargam — artigo", amount: 125, kind: "income", dueDate: "2026-09-05", status: "planned", category: "Artigos", source: "Dargam", recurring: true },
      { id: "dargam-2026-10", title: "Dargam — artigo", amount: 125, kind: "income", dueDate: "2026-10-05", status: "planned", category: "Artigos", source: "Dargam", recurring: true },
      { id: "willian-2026-08", title: "Willian Júnior", amount: 100, kind: "income", dueDate: "2026-08-13", status: "planned", category: "Freelancer", source: "Willian Júnior", recurring: true, installment: "1/7" },
      { id: "willian-2026-09", title: "Willian Júnior", amount: 100, kind: "income", dueDate: "2026-09-13", status: "planned", category: "Freelancer", source: "Willian Júnior", recurring: true, installment: "2/7" },
      { id: "willian-2026-10", title: "Willian Júnior", amount: 100, kind: "income", dueDate: "2026-10-13", status: "planned", category: "Freelancer", source: "Willian Júnior", recurring: true, installment: "3/7" },
      { id: "willian-2026-11", title: "Willian Júnior", amount: 100, kind: "income", dueDate: "2026-11-13", status: "planned", category: "Freelancer", source: "Willian Júnior", recurring: true, installment: "4/7" },
      { id: "willian-2026-12", title: "Willian Júnior", amount: 100, kind: "income", dueDate: "2026-12-13", status: "planned", category: "Freelancer", source: "Willian Júnior", recurring: true, installment: "5/7" },
      { id: "willian-2027-01", title: "Willian Júnior", amount: 100, kind: "income", dueDate: "2027-01-13", status: "planned", category: "Freelancer", source: "Willian Júnior", recurring: true, installment: "6/7" },
      { id: "willian-2027-02", title: "Willian Júnior", amount: 100, kind: "income", dueDate: "2027-02-13", status: "planned", category: "Freelancer", source: "Willian Júnior", recurring: true, installment: "7/7" },

      { id: "remedio-2026-07", title: "Remédio", amount: 90, kind: "expense", dueDate: "2026-07-20", status: "pending", category: "Saúde", paidBy: "me", recurring: true, installment: "1/5", estimatedDate: true, note: "Data estimada; recorrência informada até novembro" },
      { id: "remedio-2026-08", title: "Remédio", amount: 90, kind: "expense", dueDate: "2026-08-20", status: "planned", category: "Saúde", paidBy: "me", recurring: true, installment: "2/5", estimatedDate: true },
      { id: "remedio-2026-09", title: "Remédio", amount: 90, kind: "expense", dueDate: "2026-09-20", status: "planned", category: "Saúde", paidBy: "me", recurring: true, installment: "3/5", estimatedDate: true },
      { id: "remedio-2026-10", title: "Remédio", amount: 90, kind: "expense", dueDate: "2026-10-20", status: "planned", category: "Saúde", paidBy: "me", recurring: true, installment: "4/5", estimatedDate: true },
      { id: "remedio-2026-11", title: "Remédio", amount: 90, kind: "expense", dueDate: "2026-11-20", status: "planned", category: "Saúde", paidBy: "me", recurring: true, installment: "5/5", estimatedDate: true },

      { id: "passagem-2026-07", title: "Passagem", amount: 80, kind: "expense", dueDate: "2026-07-24", status: "pending", category: "Transporte", paidBy: "me", recurring: true, installment: "1/7" },
      { id: "passagem-2026-08", title: "Passagem", amount: 80, kind: "expense", dueDate: "2026-08-24", status: "planned", category: "Transporte", paidBy: "me", recurring: true, installment: "2/7" },
      { id: "passagem-2026-09", title: "Passagem", amount: 80, kind: "expense", dueDate: "2026-09-24", status: "planned", category: "Transporte", paidBy: "me", recurring: true, installment: "3/7" },
      { id: "passagem-2026-10", title: "Passagem", amount: 80, kind: "expense", dueDate: "2026-10-24", status: "planned", category: "Transporte", paidBy: "me", recurring: true, installment: "4/7" },
      { id: "passagem-2026-11", title: "Passagem", amount: 80, kind: "expense", dueDate: "2026-11-24", status: "planned", category: "Transporte", paidBy: "me", recurring: true, installment: "5/7" },
      { id: "passagem-2026-12", title: "Passagem", amount: 80, kind: "expense", dueDate: "2026-12-24", status: "planned", category: "Transporte", paidBy: "me", recurring: true, installment: "6/7" },
      { id: "passagem-2027-01", title: "Passagem", amount: 80, kind: "expense", dueDate: "2027-01-24", status: "planned", category: "Transporte", paidBy: "me", recurring: true, installment: "7/7" },

      { id: "macbook-2026-08", title: "MacBook", amount: 250, kind: "expense", dueDate: "2026-08-10", status: "planned", category: "Tecnologia", paidBy: "me", recurring: true, installment: "1/6", estimatedDate: true },
      { id: "macbook-2026-09", title: "MacBook", amount: 250, kind: "expense", dueDate: "2026-09-10", status: "planned", category: "Tecnologia", paidBy: "me", recurring: true, installment: "2/6", estimatedDate: true },
      { id: "macbook-2026-10", title: "MacBook", amount: 250, kind: "expense", dueDate: "2026-10-10", status: "planned", category: "Tecnologia", paidBy: "me", recurring: true, installment: "3/6", estimatedDate: true },
      { id: "macbook-2026-11", title: "MacBook", amount: 250, kind: "expense", dueDate: "2026-11-10", status: "planned", category: "Tecnologia", paidBy: "me", recurring: true, installment: "4/6", estimatedDate: true },
      { id: "macbook-2026-12", title: "MacBook", amount: 250, kind: "expense", dueDate: "2026-12-10", status: "planned", category: "Tecnologia", paidBy: "me", recurring: true, installment: "5/6", estimatedDate: true },
      { id: "macbook-2027-01", title: "MacBook", amount: 250, kind: "expense", dueDate: "2027-01-10", status: "planned", category: "Tecnologia", paidBy: "me", recurring: true, installment: "6/6", estimatedDate: true },

      { id: "medcel-2026-12", title: "Curso Medcel", amount: 255, kind: "expense", dueDate: "2026-12-31", status: "planned", category: "Educação", paidBy: "me", recurring: true, installment: "1/12", estimatedDate: true },
      { id: "medcel-2027-01", title: "Curso Medcel", amount: 255, kind: "expense", dueDate: "2027-01-31", status: "planned", category: "Educação", paidBy: "me", recurring: true, installment: "2/12", estimatedDate: true },
      { id: "medcel-2027-02", title: "Curso Medcel", amount: 255, kind: "expense", dueDate: "2027-02-28", status: "planned", category: "Educação", paidBy: "me", recurring: true, installment: "3/12", estimatedDate: true },
      { id: "medcel-2027-03", title: "Curso Medcel", amount: 255, kind: "expense", dueDate: "2027-03-31", status: "planned", category: "Educação", paidBy: "me", recurring: true, installment: "4/12", estimatedDate: true },
      { id: "medcel-2027-04", title: "Curso Medcel", amount: 255, kind: "expense", dueDate: "2027-04-30", status: "planned", category: "Educação", paidBy: "me", recurring: true, installment: "5/12", estimatedDate: true },
      { id: "medcel-2027-05", title: "Curso Medcel", amount: 255, kind: "expense", dueDate: "2027-05-31", status: "planned", category: "Educação", paidBy: "me", recurring: true, installment: "6/12", estimatedDate: true },
      { id: "medcel-2027-06", title: "Curso Medcel", amount: 255, kind: "expense", dueDate: "2027-06-30", status: "planned", category: "Educação", paidBy: "me", recurring: true, installment: "7/12", estimatedDate: true },
      { id: "medcel-2027-07", title: "Curso Medcel", amount: 255, kind: "expense", dueDate: "2027-07-31", status: "planned", category: "Educação", paidBy: "me", recurring: true, installment: "8/12", estimatedDate: true },
      { id: "medcel-2027-08", title: "Curso Medcel", amount: 255, kind: "expense", dueDate: "2027-08-31", status: "planned", category: "Educação", paidBy: "me", recurring: true, installment: "9/12", estimatedDate: true },
      { id: "medcel-2027-09", title: "Curso Medcel", amount: 255, kind: "expense", dueDate: "2027-09-30", status: "planned", category: "Educação", paidBy: "me", recurring: true, installment: "10/12", estimatedDate: true },
      { id: "medcel-2027-10", title: "Curso Medcel", amount: 255, kind: "expense", dueDate: "2027-10-31", status: "planned", category: "Educação", paidBy: "me", recurring: true, installment: "11/12", estimatedDate: true },
      { id: "medcel-2027-11", title: "Curso Medcel", amount: 255, kind: "expense", dueDate: "2027-11-30", status: "planned", category: "Educação", paidBy: "me", recurring: true, installment: "12/12", estimatedDate: true }
    ])
  ],
};
