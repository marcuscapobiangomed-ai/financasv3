import React, { useMemo } from "react";
import { ShieldCheck, AlertTriangle, AlertCircle } from "lucide-react";
import type { FinanceState } from "@/lib/types";
import { brl } from "@/lib/finance";
import { auditDisplayedValues } from "@/lib/selectors";

export function CalculationAudit({
  state,
  selectedPeriod,
}: {
  state: FinanceState;
  selectedPeriod: string;
}) {
  const reports = useMemo(() => {
    return auditDisplayedValues(state, selectedPeriod);
  }, [state, selectedPeriod]);

  const hasDivergences = reports.some((r) => r.status === "divergente");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <section className="decision-hero flex-col" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "16px", padding: "28px 32px" }}>
        <span className="eyebrow"><ShieldCheck size={16} /> Auditoria dos Cálculos</span>
        <h2 style={{ fontSize: "14px", fontWeight: 600, color: "var(--muted-2)", margin: 0 }}>Validação de Fórmulas e Reconciliação</h2>
        <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0, lineHeight: "1.4" }}>
          Esta página faz a re-avaliação em tempo real de cada indicador financeiro do dashboard, comparando os saldos e as compras com os valores de controle oficiais. Qualquer divergência é destacada em vermelho.
        </p>
      </section>

      {hasDivergences && (
        <article style={{ background: "rgba(239, 68, 68, 0.08)", border: "1px solid var(--danger)", borderRadius: "var(--r-sm)", padding: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
          <AlertCircle size={20} style={{ color: "var(--danger)", flexShrink: 0 }} />
          <div style={{ fontSize: "13px", color: "var(--text)" }}>
            <strong>Divergência Detectada!</strong> Alguns subtotais de compras não batem com os valores de faturas oficiais esperados dos prints. Verifique lançamentos duplicados ou ausentes.
          </div>
        </article>
      )}

      <article className="panel">
        <div className="panel-heading">
          <div>
            <span>Consistência dos KPIs</span>
            <h3>Recalculado vs Exibido</h3>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table className="entry-table" style={{ width: "100%", fontSize: "12px" }}>
            <thead>
              <tr>
                <th>Indicador / KPI</th>
                <th>Valor Exibido</th>
                <th>Valor Recalculado</th>
                <th>Divergência</th>
                <th>Confiança</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r, i) => {
                const isDivergent = r.status === "divergente";
                const rowBg = isDivergent ? "rgba(239, 68, 68, 0.03)" : "transparent";

                return (
                  <tr key={i} style={{ background: rowBg }}>
                    <td>
                      <strong>{r.kpi}</strong>
                      <span style={{ display: "block", fontSize: "10px", color: "var(--muted)" }}>Fórmula: {r.formula}</span>
                    </td>
                    <td>{brl.format(r.displayed)}</td>
                    <td>{brl.format(r.recalculated)}</td>
                    <td style={{ color: isDivergent ? "var(--danger)" : "var(--text-muted)", fontWeight: "bold" }}>
                      {r.diff === 0 ? "R$ 0,00" : brl.format(r.diff)}
                    </td>
                    <td>
                      <span style={{ fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "4px", color: r.confidence === "alta" ? "var(--success)" : "var(--warning)" }}>
                        {r.confidence === "alta" ? <ShieldCheck size={12} /> : <AlertTriangle size={12} />}
                        {r.confidence === "alta" ? "Alta" : "Média"}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${isDivergent ? "danger" : "success"}`} style={{ fontSize: "10px" }}>
                        {isDivergent ? "Divergente" : "Consistente"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}
