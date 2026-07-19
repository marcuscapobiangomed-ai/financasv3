# Relatório de Integridade — Congelamento da Base (v4)

Este documento registra a versão oficial congelada da base de dados e os totais de controle após a conclusão da Fase 0 (Recuperação de Dados). Esses valores servem como referência para prevenir regressões durante a refatoração do monólito e a separação da camada de persistência.

---

## Totais de Controle (Baseline)

- **Versão da Base (Schema):** `4`
- **Contas de Caixa/Reserva Ativas:** `2` (Cofrinho 123% CDI, Pix / carteira)
- **Fatura Unicred (Agosto/2026):** `R$ 801,85` (27 lançamentos no total, incluindo parcelas futuras)
- **Fatura Nubank (Agosto/2026):** `R$ 192,40` (9 compras visíveis)
- **Subtotal de Cartões (Agosto/2026):** `R$ 994,25` (Unicred + Nubank combinados)
- **Projeção de Parcelas Futuras (Cartões):** `R$ 436,66` (Identificadas a partir dos prints)

---

## Auditoria de Recebíveis Mapeados

Os recebíveis recorrentes e avulsos estão congelados com os seguintes valores esperados:
- **Willian Júnior:** R$ 100,00 mensais (7 parcelas, vindo de `1/7` até `7/7`).
- **Luandder:** R$ 283,00 (2 parcelas).
- **Biel:** R$ 500,00 (`1/2`) e R$ 300,00 (`2/2`).
- **Clara:** R$ 50,00 (pendente em julho/2026).
- **Dargam:** R$ 125,00 mensais (3 ocorrências).

---

## Auditoria de Compromissos Financeiros Mapeados

- **Remédio:** R$ 90,00 mensais (5 parcelas, de julho a novembro de 2026).
- **Passagem:** R$ 80,00 mensais (7 parcelas).
- **MacBook:** R$ 250,00 mensais (6 parcelas, a partir de agosto/2026).
- **Curso Medcel:** R$ 255,00 mensais (12 parcelas, a partir de dezembro/2026).

---

## Verificação de Consistência
Qualquer alteração ou restauração de backup feita no sistema deve reproduzir exatamente os subtotais acima descritos. Caso o subtotal identificado nos cartões divirja dos prints (R$ 801,85 para Unicred e R$ 192,40 para Nubank), um alerta de inconsistência de reconciliação será exibido na Central de Correções.
