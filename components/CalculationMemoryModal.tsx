import React from "react";
import { X, ShieldCheck, AlertTriangle, HelpCircle } from "lucide-react";
import type { FinanceState, FinanceEntry } from "@/lib/types";
import { brl, isEntryInPeriod } from "@/lib/finance";
import {
  selectAvailableCash,
  selectPatrimony,
  selectMonthlyExpenses,
  selectConfirmedReceivables,
  selectUncertainReceivables,
  selectSafeToSpendConservative,
  selectSafeToSpendProbable,
  selectSafeToSpendOptimistic,
} from "@/lib/selectors";

type MetricType = "patrimony" | "reserve" | "receivables" | "safeToSpend" | "expenses";

interface CalculationMemoryModalProps {
  metric: MetricType;
  state: FinanceState;
  selectedPeriod: string;
  onClose: () => void;
}

export function CalculationMemoryModal({
  metric,
  state,
  selectedPeriod,
  onClose,
}: CalculationMemoryModalProps) {
  const currentMonth = selectedPeriod;

  // Gather details based on metric
  let title = "";
  let formula = "";
  let confidence: "alta" | "média" | "baixa" = "alta";
  let confidenceReason = "";

  const renderContent = () => {
    switch (metric) {
      case "patrimony": {
        title = "Memória de Cálculo — Patrimônio Líquido";
        formula = "Patrimônio = Soma dos saldos de todas as contas ativas";
        const accounts = state.accounts;
        const total = selectPatrimony(state);

        return (
          <div>
            <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "16px" }}>
              O Patrimônio Líquido consolida a soma absoluta do saldo de todas as suas contas, incluindo contas de reserva (cofrinho) e contas de uso diário.
            </p>
            <div className="compact-list" style={{ border: "1px solid var(--border)", borderRadius: "var(--r-sm)" }}>
              {accounts.map((acc) => (
                <div key={acc.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>
                  <div>
                    <strong style={{ fontSize: "13px" }}>{acc.name}</strong>
                    <span style={{ fontSize: "11px", display: "block", color: "var(--muted)" }}>
                      Tipo: {acc.type === "reserve" ? "Reserva" : "Caixa Líquido"} · {acc.available ? "Livre" : "Reservado"}
                    </span>
                  </div>
                  <strong>{brl.format(acc.balance)}</strong>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 14px", background: "rgba(255,255,255,0.02)", fontWeight: "bold" }}>
                <span>Total Calculado</span>
                <span style={{ color: "var(--text)" }}>{brl.format(total)}</span>
              </div>
            </div>
          </div>
        );
      }

      case "reserve": {
        title = "Memória de Cálculo — Reserva Financeira";
        formula = "Reserva = Soma das contas marcadas com available = false";
        const reserveAccounts = state.accounts.filter(a => !a.available);
        const total = reserveAccounts.reduce((sum, a) => sum + a.balance, 0);

        return (
          <div>
            <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "16px" }}>
              Contas designadas como reservas guardadas de longo prazo (ex: cofrinho). Estes fundos são protegidos e excluídos do cálculo do "Livre para gastar".
            </p>
            {reserveAccounts.length === 0 ? (
              <p style={{ fontSize: "13px", color: "var(--muted)" }}>Nenhuma conta de reserva cadastrada.</p>
            ) : (
              <div className="compact-list" style={{ border: "1px solid var(--border)", borderRadius: "var(--r-sm)" }}>
                {reserveAccounts.map((acc) => (
                  <div key={acc.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>
                    <div>
                      <strong style={{ fontSize: "13px" }}>{acc.name}</strong>
                      <span style={{ fontSize: "11px", display: "block", color: "var(--muted)" }}>{acc.note || "Sem observações"}</span>
                    </div>
                    <strong>{brl.format(acc.balance)}</strong>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 14px", background: "rgba(255,255,255,0.02)", fontWeight: "bold" }}>
                  <span>Total Guardado</span>
                  <span style={{ color: "var(--text)" }}>{brl.format(total)}</span>
                </div>
              </div>
            )}
          </div>
        );
      }

      case "receivables": {
        title = `Memória de Cálculo — Recebimentos (${currentMonth})`;
        formula = "Total = Recebido + Confirmado + Incerto";
        const incomes = state.entries.filter(e => e.kind === "income" && isEntryInPeriod(e, currentMonth));
        const total = incomes.reduce((sum, e) => sum + e.amount, 0);

        return (
          <div>
            <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "16px" }}>
              Detalhamento de todas as receitas esperadas ou recebidas para este período selecionado:
            </p>
            {incomes.length === 0 ? (
              <p style={{ fontSize: "13px", color: "var(--muted)" }}>Nenhum recebimento cadastrado neste mês.</p>
            ) : (
              <div className="compact-list" style={{ border: "1px solid var(--border)", borderRadius: "var(--r-sm)" }}>
                {incomes.map((inc) => (
                  <div key={inc.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>
                    <div>
                      <strong style={{ fontSize: "13px" }}>{inc.title}</strong>
                      <span style={{ fontSize: "11px", display: "block", color: "var(--muted)" }}>
                        Data: {inc.dueDate} · Status: {inc.status === "recebido" ? "Recebido" : "Pendente"}
                      </span>
                    </div>
                    <strong style={{ color: "var(--success)" }}>+{brl.format(inc.amount)}</strong>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 14px", background: "rgba(255,255,255,0.02)", fontWeight: "bold" }}>
                  <span>Total Projetado</span>
                  <span style={{ color: "var(--success)" }}>{brl.format(total)}</span>
                </div>
              </div>
            )}
          </div>
        );
      }

      case "expenses": {
        title = `Memória de Cálculo — Despesas Pendentes (${currentMonth})`;
        formula = "Pendentes = Despesas do período não realizadas (exclui pagos pelo pai)";
        const pending = state.entries.filter(e => e.kind === "expense" && e.paidBy !== "father" && e.status !== "realizado" && isEntryInPeriod(e, currentMonth));
        const total = pending.reduce((sum, e) => sum + e.amount, 0);

        return (
          <div>
            <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "16px" }}>
              Estas são as despesas e compras do cartão pendentes no mês de faturamento selecionado que exigirão desembolso do seu caixa disponível:
            </p>
            {pending.length === 0 ? (
              <p style={{ fontSize: "13px", color: "var(--muted)" }}>Nenhuma despesa pendente neste período.</p>
            ) : (
              <div className="compact-list" style={{ border: "1px solid var(--border)", borderRadius: "var(--r-sm)", maxHeight: "300px", overflowY: "auto" }}>
                {pending.map((exp) => (
                  <div key={exp.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>
                    <div>
                      <strong style={{ fontSize: "13px" }}>{exp.title}</strong>
                      <span style={{ fontSize: "11px", display: "block", color: "var(--muted)" }}>
                        Vence em: {exp.dueDate} {exp.account ? `· Cartão: ${exp.account}` : ""}
                      </span>
                    </div>
                    <strong style={{ color: "var(--danger)" }}>-{brl.format(exp.amount)}</strong>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 14px", background: "rgba(255,255,255,0.02)", fontWeight: "bold" }}>
                  <span>Total Pendente</span>
                  <span style={{ color: "var(--danger)" }}>{brl.format(total)}</span>
                </div>
              </div>
            )}
          </div>
        );
      }

      case "safeToSpend": {
        title = "Memória de Cálculo — Livre para Gastar";
        formula = "Conservador (Padrão) = Caixa Disponível - Despesas Pendentes - Margem (R$ 100)";
        
        const cash = selectAvailableCash(state);
        const expenses = selectMonthlyExpenses(state, currentMonth);
        const confirmed = selectConfirmedReceivables(state, currentMonth);
        const uncertain = selectUncertainReceivables(state, currentMonth);

        const conservative = selectSafeToSpendConservative(state, currentMonth);
        const probable = selectSafeToSpendProbable(state, currentMonth);
        const optimistic = selectSafeToSpendOptimistic(state, currentMonth);

        confidence = "média";
        confidenceReason = "A qualidade depende de faturas completas importadas. Faturas parciais reduzem a precisão dos gastos estimados.";

        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0 }}>
              O "Livre para Gastar" projeta a disponibilidade de caixa para o mês. Comparamos três cenários matemáticos dependendo das receitas consideradas:
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
              <div style={{ border: "2px solid #ff7a18", borderRadius: "var(--r-sm)", padding: "12px", background: "rgba(255,122,24,0.04)" }}>
                <span style={{ fontSize: "11px", color: "var(--muted)", fontWeight: "bold" }}>CONSERVADOR (Principal)</span>
                <strong style={{ display: "block", fontSize: "20px", marginTop: "4px" }}>{brl.format(conservative)}</strong>
                <small style={{ fontSize: "10px", display: "block", color: "var(--muted)", marginTop: "4px" }}>Sem receitas pendentes. Margem de R$ 100.</small>
              </div>

              <div style={{ border: "1px solid var(--border)", borderRadius: "var(--r-sm)", padding: "12px" }}>
                <span style={{ fontSize: "11px", color: "var(--muted)" }}>PROVÁVEL</span>
                <strong style={{ display: "block", fontSize: "20px", marginTop: "4px" }}>{brl.format(probable)}</strong>
                <small style={{ fontSize: "10px", display: "block", color: "var(--muted)", marginTop: "4px" }}>Com receitas confirmadas. Margem de R$ 50.</small>
              </div>

              <div style={{ border: "1px solid var(--border)", borderRadius: "var(--r-sm)", padding: "12px" }}>
                <span style={{ fontSize: "11px", color: "var(--muted)" }}>OTIMISTA</span>
                <strong style={{ display: "block", fontSize: "20px", marginTop: "4px" }}>{brl.format(optimistic)}</strong>
                <small style={{ fontSize: "10px", display: "block", color: "var(--muted)", marginTop: "4px" }}>Com receitas incertas. Margem R$ 0.</small>
              </div>
            </div>

            <article style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", padding: "16px" }}>
              <h4 style={{ margin: "0 0 12px 0", fontSize: "12px", textTransform: "uppercase", color: "var(--muted)" }}>Componentes considerados</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Caixa Disponível nas Contas</span>
                  <strong>{brl.format(cash)}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", color: "var(--danger)" }}>
                  <span>Despesas Pendentes / Cartões no Mês</span>
                  <strong>-{brl.format(expenses)}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", color: "var(--success)" }}>
                  <span>Receitas Confirmadas (Pendente)</span>
                  <strong>+{brl.format(confirmed)}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", color: "var(--info)" }}>
                  <span>Receitas Otimistas (Incerto)</span>
                  <strong>+{brl.format(uncertain)}</strong>
                </div>
              </div>
            </article>
          </div>
        );
      }
    }
  };

  return (
    <div className="modal-backdrop" style={{ zIndex: 1000 }}>
      <div className="modal-content" style={{ maxWidth: "600px", width: "90%", padding: "28px" }}>
        <header className="modal-header" style={{ marginBottom: "20px" }}>
          <div>
            <span style={{ fontSize: "11px", textTransform: "uppercase", color: "var(--muted)", fontWeight: "bold" }}>Memória de Cálculo</span>
            <h3 style={{ margin: "4px 0 0 0", fontSize: "18px", fontWeight: "bold" }}>{title || "Detalhamento de Cálculo"}</h3>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Fechar modal"><X size={20} /></button>
        </header>

        <section style={{ marginBottom: "24px" }}>
          <div style={{ fontSize: "12px", padding: "8px 12px", background: "rgba(255,255,255,0.03)", borderRadius: "var(--r-sm)", border: "1px solid var(--border)", marginBottom: "16px", fontFamily: "monospace", color: "var(--muted)" }}>
            Fórmula: {formula}
          </div>

          {renderContent()}
        </section>

        <footer style={{ borderTop: "1px solid var(--border)", paddingTop: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {confidence === "alta" ? (
              <ShieldCheck size={18} style={{ color: "var(--success)" }} />
            ) : (
              <AlertTriangle size={18} style={{ color: "var(--warning)" }} />
            )}
            <span style={{ fontSize: "12px", color: "var(--muted)" }}>
              Confiança do cálculo: <strong>{confidence === "alta" ? "Alta (Confiável)" : "Média (Revisar)"}</strong>
            </span>
          </div>
          <button className="secondary-button compact" onClick={onClose}>Fechar</button>
        </footer>
      </div>
    </div>
  );
}
