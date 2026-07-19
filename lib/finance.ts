import type { FinanceEntry, FinanceState } from "./types";

export const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(`${date}T12:00:00`));
}

export function monthKey(date: string) {
  return date.slice(0, 7);
}

export function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" }).format(new Date(year, month - 1, 1));
}

export function isEntryInPeriod(entry: FinanceEntry, period: string): boolean {
  if (entry.kind === "income") {
    return entry.dueDate.slice(0, 7) === period;
  } else {
    if (entry.invoiceMonth) {
      return entry.invoiceMonth === period;
    }
    return entry.dueDate.slice(0, 7) === period;
  }
}

export function getSummary(state: FinanceState, period: string) {
  const patrimony = state.accounts.reduce((sum, account) => sum + account.balance, 0);
  const reserve = state.accounts.filter((account) => !account.available).reduce((sum, account) => sum + account.balance, 0);
  const availableCash = state.accounts.filter((account) => account.available).reduce((sum, account) => sum + account.balance, 0);
  
  const pendingIncome = state.entries
    .filter((entry) => entry.kind === "income" && entry.status !== "recebido" && isEntryInPeriod(entry, period))
    .reduce((sum, entry) => sum + entry.amount, 0);
    
  const pendingExpenses = state.entries
    .filter((entry) => entry.kind === "expense" && entry.paidBy !== "father" && entry.status !== "realizado" && isEntryInPeriod(entry, period))
    .reduce((sum, entry) => sum + entry.amount, 0);
    
  const goalProgress = Math.min(100, (patrimony / state.goal) * 100);
  return { patrimony, reserve, availableCash, pendingIncome, pendingExpenses, goalProgress };
}

export function monthSeries(entries: FinanceEntry[]) {
  const rows = new Map<string, { month: string; income: number; expense: number; net: number }>();
  for (const entry of entries) {
    const key = entry.kind === "income" 
      ? entry.dueDate.slice(0, 7) 
      : (entry.invoiceMonth || entry.dueDate.slice(0, 7));
      
    const current = rows.get(key) ?? { month: monthLabel(key), income: 0, expense: 0, net: 0 };
    if (entry.kind === "income") current.income += entry.amount;
    if (entry.kind === "expense" && entry.paidBy !== "father") current.expense += entry.amount;
    current.net = current.income - current.expense;
    rows.set(key, current);
  }
  return [...rows.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, row]) => row).slice(0, 7);
}

export function spendingByCategory(entries: FinanceEntry[]) {
  const rows = new Map<string, number>();
  entries.filter((entry) => entry.kind === "expense" && entry.paidBy !== "father").forEach((entry) => {
    rows.set(entry.category, (rows.get(entry.category) ?? 0) + entry.amount);
  });
  return [...rows.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

export function commitmentsByMonth(entries: FinanceEntry[]) {
  return monthSeries(entries).map((row) => ({ month: row.month, value: row.expense }));
}

export function parseCsv(text: string): Array<Partial<FinanceEntry>> {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const delimiter = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(delimiter).map((header) => header.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const values = line.split(delimiter).map((value) => value.trim().replace(/^"|"$/g, ""));
    const record = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
    const rawAmount = record.valor || record.amount || record.total || "0";
    const amount = Number(rawAmount.replace(/\./g, "").replace(",", ".").replace(/[^0-9.-]/g, ""));
    const rawType = (record.tipo || record.type || "despesa").toLowerCase();
    const kind = (rawType.includes("rece") || rawType.includes("entr") || amount < 0) ? ("income" as const) : ("expense" as const);
    return {
      title: record.descricao || record.description || record.estabelecimento || "Lançamento importado",
      amount: Number.isFinite(amount) ? Math.abs(amount) : 0,
      kind,
      dueDate: record.data || record.date || new Date().toISOString().slice(0, 10),
      category: record.categoria || record.category || "Outros",
      status: kind === "income" ? "a_receber_confirmado" : "a_pagar",
      account: record.conta || record.account || "Importado",
      paidBy: "me",
    };
  });
}

export function getSafeToSpend(state: FinanceState, today: string, safetyMargin: number) {
  const availableCash = state.accounts.filter((account) => account.available).reduce((sum, account) => sum + account.balance, 0);

  // Encontra a data da próxima renda (próxima entrada confirmada que seja hoje ou no futuro)
  const pendingIncomes = state.entries
    .filter((entry) => entry.kind === "income" && entry.status === "a_receber_confirmado" && entry.dueDate >= today)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const [year, month] = today.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const endOfMonthDate = `${today.slice(0, 7)}-${String(lastDay).padStart(2, "0")}`;
  
  const nextIncomeDate = pendingIncomes[0]?.dueDate || endOfMonthDate;

  const consideredIncomes = state.entries
    .filter((entry) => entry.kind === "income" && entry.status === "a_receber_confirmado" && entry.dueDate >= today && entry.dueDate <= nextIncomeDate);

  const incomesUntilNext = consideredIncomes.reduce((sum, entry) => sum + entry.amount, 0);

  const consideredExpenses = state.entries
    .filter((entry) => entry.kind === "expense" && entry.paidBy !== "father" && entry.status !== "realizado" && entry.dueDate >= today && entry.dueDate <= nextIncomeDate);

  const expensesUntilNext = consideredExpenses.reduce((sum, entry) => sum + entry.amount, 0);

  const safeToSpend = availableCash + incomesUntilNext - expensesUntilNext - safetyMargin;

  return {
    safeToSpend,
    nextIncomeDate,
    availableCash,
    incomesUntilNext,
    expensesUntilNext,
    safetyMargin,
    consideredIncomes,
    consideredExpenses,
  };
}

export type Recommendation = {
  id: string;
  title: string;
  subtitle: string;
  dataDetails: string;
  action: string;
  expectedImpact: string;
  category: "danger" | "warning" | "success" | "info";
};

export function getRecommendations(state: FinanceState, today: string, safeToSpend: number, safetyMargin: number): Recommendation[] {
  const list: Recommendation[] = [];
  const currentMonth = today.slice(0, 7);

  // Recommendation 1: Risco de Caixa
  const availableCash = state.accounts.filter((account) => account.available).reduce((sum, account) => sum + account.balance, 0);
  const currentExpenses = state.entries
    .filter((entry) => entry.kind === "expense" && entry.paidBy !== "father" && entry.status !== "realizado" && isEntryInPeriod(entry, currentMonth))
    .reduce((sum, entry) => sum + entry.amount, 0);

  if (safeToSpend < 0) {
    list.push({
      id: "caixa_negativo",
      title: "Risco iminente de saldo negativo no caixa",
      subtitle: "Suas despesas confirmadas até a próxima renda superam o seu caixa disponível mais as entradas confirmadas.",
      dataDetails: `Saldo seguro calculado: ${brl.format(safeToSpend)} (com margem de ${brl.format(safetyMargin)}).`,
      action: "Adie pagamentos não essenciais ou reduza temporariamente sua margem de segurança.",
      expectedImpact: "Evita a necessidade de usar o cheque especial ou resgatar da reserva de emergência.",
      category: "danger",
    });
  }

  // Recommendation 2: Comprometimento futuro nos próximos 3 meses
  // Calculamos para os próximos 3 períodos (ex: Julho, Agosto, Setembro)
  const next3Months: string[] = [];
  const [currYear, currMonth] = today.split("-").map(Number);
  for (let i = 0; i < 3; i++) {
    const d = new Date(currYear, currMonth - 1 + i, 1);
    next3Months.push(d.toISOString().slice(0, 7));
  }

  const nextIncomes = state.entries
    .filter((entry) => entry.kind === "income" && entry.status !== "a_receber_incerto" && next3Months.includes(entry.dueDate.slice(0, 7)))
    .reduce((sum, entry) => sum + entry.amount, 0);

  const nextExpenses = state.entries
    .filter((entry) => entry.kind === "expense" && entry.paidBy !== "father" && next3Months.includes(entry.invoiceMonth || entry.dueDate.slice(0, 7)))
    .reduce((sum, entry) => sum + entry.amount, 0);

  const commRatio = nextIncomes > 0 ? nextExpenses / nextIncomes : 0;
  if (commRatio > 0.50) {
    list.push({
      id: "evitar_parcelas",
      title: "Evite novas compras parceladas neste período",
      subtitle: `Você já possui ${brl.format(nextExpenses)} comprometidos nos próximos 3 meses.`,
      dataDetails: `Isso equivale a ${(commRatio * 100).toFixed(0)}% dos seus recebimentos confirmados (${brl.format(nextIncomes)}) para o período.`,
      action: "Adie compras de alto valor ou pague à vista se for indispensável.",
      expectedImpact: "Libera limite nos cartões e reduz a rigidez do seu orçamento nos meses futuros.",
      category: "warning",
    });
  }

  // Recommendation 3: Aporte na Meta
  if (safeToSpend > 150) {
    const suggestAmount = Math.max(50, Math.floor(safeToSpend * 0.7));
    list.push({
      id: "aporte_meta",
      title: "Oportunidade de aporte na reserva/meta",
      subtitle: "Seu caixa operacional está saudável e com boa folga acima da margem de segurança.",
      dataDetails: `Você possui saldo seguro sobressalente de ${brl.format(safeToSpend)}.`,
      action: `Transfira ${brl.format(suggestAmount)} para o seu cofrinho/reserva.`,
      expectedImpact: "Acelera a conquista da sua meta de R$ 10.000 sem comprometer os pagamentos imediatos.",
      category: "success",
    });
  }

  // Recommendation 4: Baixa previsibilidade
  const currentMonthIncomes = state.entries.filter((entry) => entry.kind === "income" && isEntryInPeriod(entry, currentMonth));
  const incertoAmount = currentMonthIncomes.filter((entry) => entry.status === "a_receber_incerto").reduce((sum, entry) => sum + entry.amount, 0);
  const totalMonthIncome = currentMonthIncomes.reduce((sum, entry) => sum + entry.amount, 0);
  const incertoRatio = totalMonthIncome > 0 ? incertoAmount / totalMonthIncome : 0;

  if (incertoRatio > 0.30) {
    list.push({
      id: "baixa_previsibilidade",
      title: "Previsibilidade de receita abaixo do recomendado",
      subtitle: "Uma parcela expressiva dos seus recebimentos deste mês ainda é considerada incerta ou estimada.",
      dataDetails: `${brl.format(incertoAmount)} de um total de ${brl.format(totalMonthIncome)} (${(incertoRatio * 100).toFixed(0)}%) estão como Previsto.`,
      action: "Confirme a data de pagamento com os clientes ou responsáveis por essas transferências.",
      expectedImpact: "Aumenta a precisão das projeções do fluxo de caixa e reduz riscos de atraso.",
      category: "info",
    });
  }

  return list;
}

export type ScenarioResult = {
  scenario: string;
  targetMonth: string;
  monthsCount: number;
  savingsRate: number;
  premissa: string;
};

export function getGoalScenarios(state: FinanceState, today: string): ScenarioResult[] {
  const patrimony = state.accounts.reduce((sum, account) => sum + account.balance, 0);
  const goalGap = Math.max(0, state.goal - patrimony);
  const currentMonth = today.slice(0, 7);

  // Filtros de entradas e despesas do mês corrente
  const monthEntries = state.entries.filter((entry) => isEntryInPeriod(entry, currentMonth));
  
  const confirmedIncome = monthEntries
    .filter((entry) => entry.kind === "income" && entry.status !== "a_receber_incerto")
    .reduce((sum, entry) => sum + entry.amount, 0);
  
  const totalIncome = monthEntries
    .filter((entry) => entry.kind === "income")
    .reduce((sum, entry) => sum + entry.amount, 0);

  const confirmedExpenses = monthEntries
    .filter((entry) => entry.kind === "expense" && entry.paidBy !== "father" && entry.status === "realizado")
    .reduce((sum, entry) => sum + entry.amount, 0);

  const totalExpenses = monthEntries
    .filter((entry) => entry.kind === "expense" && entry.paidBy !== "father")
    .reduce((sum, entry) => sum + entry.amount, 0);

  // Cenário Conservador: Apenas caixa operacional real do mês
  const consSaving = Math.max(100, Math.floor(confirmedIncome - confirmedExpenses));
  
  // Cenário Provável: Média do fluxo completo
  const probSaving = Math.max(250, Math.floor(totalIncome - totalExpenses));

  // Cenário Otimista: Fluxo completo + ganhos extras esperados
  const otimSaving = Math.max(400, Math.floor(totalIncome - totalExpenses + 200));

  function addMonths(dateStr: string, monthsToAdd: number): string {
    const [y, m] = dateStr.split("-").map(Number);
    const date = new Date(y, m - 1 + monthsToAdd, 1);
    return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(date);
  }

  const consMonths = consSaving > 0 ? Math.ceil(goalGap / consSaving) : 999;
  const probMonths = probSaving > 0 ? Math.ceil(goalGap / probSaving) : 999;
  const otimMonths = otimSaving > 0 ? Math.ceil(goalGap / otimSaving) : 999;

  return [
    {
      scenario: "Conservador",
      targetMonth: addMonths(today, consMonths),
      monthsCount: consMonths,
      savingsRate: consSaving,
      premissa: "Considera apenas receitas recebidas/confirmadas e despesas do mês.",
    },
    {
      scenario: "Provável",
      targetMonth: addMonths(today, probMonths),
      monthsCount: probMonths,
      savingsRate: probSaving,
      premissa: "Considera a previsão padrão de recebimentos completos e despesas mapeadas.",
    },
    {
      scenario: "Otimista",
      targetMonth: addMonths(today, otimMonths),
      monthsCount: otimMonths,
      savingsRate: otimSaving,
      premissa: "Considera todas as receitas e inclui aportes pontuais esperados de R$ 200 adicionais.",
    },
  ];
}

export type HealthStatus = "excelente" | "alerta" | "critico";

export type HealthDetails = {
  score: number;
  label: string;
  diagnostico: string;
  liquidez: "good" | "warning" | "danger";
  comprometimento: "good" | "warning" | "danger";
  previsibilidade: "good" | "warning" | "danger";
  acumulacao: "good" | "warning" | "danger";
};

export function getFinancialHealth(state: FinanceState, today: string, safeToSpend: number): HealthDetails {
  const patrimony = state.accounts.reduce((sum, account) => sum + account.balance, 0);
  const availableCash = state.accounts.filter((account) => account.available).reduce((sum, account) => sum + account.balance, 0);
  const currentMonth = today.slice(0, 7);

  // 1. Liquidez (Caixa vs Contas a Pagar do Mês)
  const pendingExpenses = state.entries
    .filter((entry) => entry.kind === "expense" && entry.paidBy !== "father" && entry.status !== "realizado" && isEntryInPeriod(entry, currentMonth))
    .reduce((sum, entry) => sum + entry.amount, 0);
  
  let liquidez: "good" | "warning" | "danger" = "good";
  let scoreLiquidez = 25;
  if (availableCash < pendingExpenses * 0.5) {
    liquidez = "danger";
    scoreLiquidez = 5;
  } else if (availableCash < pendingExpenses) {
    liquidez = "warning";
    scoreLiquidez = 15;
  }

  // 2. Comprometimento Futuro (Contas futuras vs Receitas futuras nos próximos 3 meses)
  const next3Months: string[] = [];
  const [currYear, currMonth] = today.split("-").map(Number);
  for (let i = 0; i < 3; i++) {
    const d = new Date(currYear, currMonth - 1 + i, 1);
    next3Months.push(d.toISOString().slice(0, 7));
  }

  const nextIncomes = state.entries
    .filter((entry) => entry.kind === "income" && entry.status !== "a_receber_incerto" && next3Months.includes(entry.dueDate.slice(0, 7)))
    .reduce((sum, entry) => sum + entry.amount, 0);

  const nextExpenses = state.entries
    .filter((entry) => entry.kind === "expense" && entry.paidBy !== "father" && next3Months.includes(entry.invoiceMonth || entry.dueDate.slice(0, 7)))
    .reduce((sum, entry) => sum + entry.amount, 0);

  const ratio = nextIncomes > 0 ? nextExpenses / nextIncomes : 0;
  let comprometimento: "good" | "warning" | "danger" = "good";
  let scoreComp = 25;
  if (ratio > 0.60) {
    comprometimento = "danger";
    scoreComp = 5;
  } else if (ratio > 0.35) {
    comprometimento = "warning";
    scoreComp = 15;
  }

  // 3. Previsibilidade (Receitas confirmadas vs Receitas totais)
  const monthIncomes = state.entries.filter((entry) => entry.kind === "income" && isEntryInPeriod(entry, currentMonth));
  const totalMonthIncome = monthIncomes.reduce((sum, entry) => sum + entry.amount, 0);
  const incertoAmount = monthIncomes.filter((entry) => entry.status === "a_receber_incerto").reduce((sum, entry) => sum + entry.amount, 0);
  const prevRatio = totalMonthIncome > 0 ? (totalMonthIncome - incertoAmount) / totalMonthIncome : 1;

  let previsibilidade: "good" | "warning" | "danger" = "good";
  let scorePrev = 25;
  if (prevRatio < 0.5) {
    previsibilidade = "danger";
    scorePrev = 5;
  } else if (prevRatio < 0.8) {
    previsibilidade = "warning";
    scorePrev = 15;
  }

  // 4. Acumulação (Patrimônio acumulado vs Meta de R$ 10k)
  const goalProgress = (patrimony / state.goal);
  let acumulacao: "good" | "warning" | "danger" = "good";
  let scoreAcum = 25;
  if (goalProgress < 0.15) {
    acumulacao = "danger";
    scoreAcum = 5;
  } else if (goalProgress < 0.5) {
    acumulacao = "warning";
    scoreAcum = 15;
  }

  const totalScore = scoreLiquidez + scoreComp + scorePrev + scoreAcum;
  
  let label = "Excelente";
  let diagnostico = "Suas finanças estão sob controle absoluto. Boa liquidez, baixo endividamento em parcelas futuras e excelente constância rumo à meta.";
  if (totalScore < 50) {
    label = "Atenção Crítica";
    diagnostico = "Caixa operacional de curto prazo pressionado e elevado comprometimento com compras parceladas futuras. Evite novos gastos fixos imediatamente.";
  } else if (totalScore < 80) {
    label = "Atenção";
    diagnostico = "Boa reserva financeira acumulada, mas caixa imediato baixo ou alto comprometimento futuro com parcelas que exigem monitoramento.";
  }

  return {
    score: totalScore,
    label,
    diagnostico,
    liquidez,
    comprometimento,
    previsibilidade,
    acumulacao,
  };
}
