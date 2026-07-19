# Fórmulas Financeiras e Matriz de Cálculos — financasv3

Este documento serve como a especificação de verdade para todos os cálculos matemáticos executados no sistema. Qualquer alteração ou inclusão de KPIs no dashboard deve seguir rigorosamente as definições contidas aqui.

---

## 1. Patrimônio Líquido e Caixa

### Patrimônio Líquido (Net Worth)
- **Fórmula:** Soma dos saldos de todas as contas cadastradas e ativas.
  $$\text{Patrimônio} = \sum (\text{account.balance})$$
- **Inclui:** Contas do tipo `cash`, `reserve`, `bank` e `wallet`.
- **Não Inclui:** Limites de crédito de cartões, recebimentos futuros ou despesas parceladas futuras.
- **Código Fonte:** `selectPatrimony(state)` em `lib/selectors.ts`.

### Caixa Disponível (Liquid Cash)
- **Fórmula:** Soma dos saldos de contas marcadas como disponíveis para uso imediato.
  $$\text{Caixa Disponível} = \sum (\text{account.balance} \mid \text{account.available} = \text{true})$$
- **Inclui:** Contas líquidas de movimentação diária (ex: 99Pay, Mercado Pago).
- **Não Inclui:** Contas marcadas como reservas de longo prazo (`available = false` ou cofrinhos).
- **Código Fonte:** `selectAvailableCash(state)` em `lib/selectors.ts`.

---

## 2. Despesas e Faturas

### Despesas Pendentes (Monthly Pending Expenses)
- **Fórmula:** Soma de todas as despesas não realizadas vinculadas ao mês selecionado, excluindo as que são custeadas pelo pai.
  $$\text{Despesas Pendentes} = \sum (\text{entry.amount} \mid \text{entry.kind} = \text{"expense"} \land \text{entry.status} \neq \text{"realizado"} \land \text{entry.paidBy} \neq \text{"father"})$$
- **Inclui:** Despesas com status `a_pagar` ou `projetado` no período selecionado, despesas compartilhadas (inteiras, conforme valor cadastrado) e despesas reembolsáveis.
- **Não Inclui:** Lançamentos com status `realizado` (já liquidados de fato), parcelas futuras de cartões (que vencem em outros meses), e transferências para contas de investimento.
- **Regra Antiduplicidade:** Lançamentos com títulos que indicam pagamento de fatura (ex: "pagamento de fatura") classificados como despesa regular são alertados pela auditoria de integridade para não contar o gasto duas vezes.

### Fatura de Cartão (Invoice View)
- **Subtotal Identificado:** Soma das despesas ativas vinculadas à conta do cartão (`account`) e com o `invoiceMonth` igual ao período selecionado.
- **Total Oficial:** O valor total da fatura física (obtido das entidades persistidas de `Invoice` ou dos backups históricos).
- **Divergência:** Diferença entre o subtotal e o total oficial.
  $$\text{Divergência} = \text{Subtotal Identificado} - \text{Total Oficial}$$
- **Valor em Aberto:** Subtotal identificado deduzindo os pagamentos já realizados na fatura.
- **Estorno:** Contabilizado como lançamento de despesa com valor negativo (`amount < 0`), reduzindo diretamente o subtotal da fatura.

---

## 3. Recebimentos

- **Recebido:** Receitas com status `recebido` do mês corrente (já somadas ao caixa das contas).
- **Confirmado:** Receitas a vencer com status `a_receber_confirmado` no mês selecionado.
- **Incerto:** Receitas com status `a_receber_incerto` (ex: vendas ou repasses informais).
- **Total Projetado:**
  $$\text{Total Receitas} = \text{Recebido} + \text{Confirmado} + \text{Incerto}$$

---

## 4. Metas e Projeções

- **Restante para Meta:** Meta de R$ 10.000,00 deduzida do Patrimônio Líquido atual.
- **Prazo Estimado:** Meses restantes baseados no aporte médio recente.

---

## 5. Livre para Gastar (Safe to Spend)

Este é o indicador mais sensível e vital para a tomada de decisão. Ele possui três cenários de análise dependendo do grau de conservadorismo do horizonte financeiro:

### A. Cenário Conservador (Visualização Principal)
Garante segurança absoluta contra inadimplência, ignorando receitas incertas ou reservas travadas.
- **Fórmula:**
  $$\text{Livre Conservador} = \text{Caixa Disponível} - \text{Despesas Pendentes} - \text{Faturas em Aberto} - \text{Margem de Segurança (R\$ 100,00)}$$
- **Inclusões:** Apenas receitas já depositadas no caixa líquido.
- **Exclusões:** Contas de reserva (`available = false`), receitas a receber não liquidadas.

### B. Cenário Provável
Mapeia o fluxo de caixa esperado do mês corrente.
- **Fórmula:**
  $$\text{Livre Provável} = \text{Caixa Disponível} + \text{Receitas Confirmadas} - \text{Despesas Pendentes} - \text{Faturas em Aberto} - \text{Margem de Segurança (R\$ 50,00)}$$

### C. Cenário Otimista
Mapeia o cenário ideal considerando todas as projeções possíveis.
- **Fórmula:**
  $$\text{Livre Otimista} = \text{Caixa Disponível} + \text{Receitas Confirmadas} + \text{Receitas Incertas} - \text{Despesas Pendentes} - \text{Faturas em Aberto}$$

---

## 6. Dimensões Temporais

Para evitar confusão e erros de análise, o sistema isola as consultas de dados por três eixos de tempo explícitos:
1. **Mês Financeiro (Competência):** Mês de vencimento ou competência da conta.
2. **Data da Compra:** Eixo de fluxo e consumo real no comércio.
3. **Ciclo da Fatura:** Agrupamento pelo mês fechamento/vencimento de cartões de crédito.
