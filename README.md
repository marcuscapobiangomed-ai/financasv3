# Meu Financeiro — Dashboard pessoal

MVP funcional em Next.js para acompanhar patrimônio, valores a receber, parcelas, gastos e a meta de R$ 10 mil.

## O que já funciona

- Visão executiva orientada à decisão.
- Dados iniciais preenchidos com os valores informados na conversa.
- Persistência local no navegador (`localStorage`).
- Cadastro de entradas e despesas.
- Baixa de pagamentos/recebimentos com atualização do caixa.
- Exclusão de lançamentos.
- Projeção mensal de entradas e compromissos.
- Calendário de parcelas e recebíveis.
- Simulador da meta de R$ 10 mil.
- Importação e revisão de CSV.
- Upload de PDF/print para registro da sessão e conferência manual.
- Layout responsivo para celular e desktop.
- Fatura Unicred importada a partir dos prints enviados: **R$ 801,85** em lançamentos visíveis, com vencimento configurado para 11/08/2026.
- Fatura Nubank de agosto/2026 importada: **R$ 192,40** em compras visíveis, vencimento em 10/08/2026. O pagamento recebido de **R$ 482,12** foi deliberadamente ignorado.
- Subtotal visível combinado dos cartões em agosto: **R$ 994,25**.
- Projeção de **R$ 436,66** em parcelas futuras identificáveis nos prints.
- Arquivo de auditoria `unicred-lancamentos-extraidos.csv` com os lançamentos extraídos e as incertezas registradas.

## Rodar localmente

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000`.

## Estrutura esperada para CSV

A importação reconhece vírgula ou ponto e vírgula e tenta mapear:

```csv
data;descricao;valor;tipo;categoria;conta
2026-07-21;Pagamento Clara;50;entrada;Presentes;Mercado Pago
2026-07-24;Passagem;80;despesa;Transporte;Nubank
```

Também aceita cabeçalhos equivalentes em inglês, como `date`, `description`, `amount`, `type`, `category` e `account`.

## Limite conhecido desta V1

PDFs e imagens ainda não são extraídos automaticamente pelo aplicativo. Os prints da Unicred e do Nubank enviados nesta conversa foram revisados e inseridos manualmente na base inicial. Alguns dados parcialmente cobertos — como o número da parcela de uma corrida 99 e a parcela do AliExpress — foram marcados como incertos e não tiveram compromissos futuros inventados.

## Banco remoto opcional

O arquivo `supabase/schema.sql` contém um modelo inicial para migrar do armazenamento local para PostgreSQL/Supabase. A V1 roda sem credenciais externas.
