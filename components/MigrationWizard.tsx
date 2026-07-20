import React, { useState } from "react";
import { ShieldAlert, CheckCircle, Database, RefreshCw, X, Play } from "lucide-react";
import type { FinanceState } from "@/lib/types";
import { brl } from "@/lib/finance";
import { SupabaseFinanceRepository } from "@/lib/storage/supabase-repository";

export function MigrationWizard({
  localState,
  userId,
  onComplete,
  onClose,
}: {
  localState: FinanceState;
  userId: string;
  onComplete: () => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<{
    localEntriesCount: number;
    localTotalExpenses: number;
    localTotalIncomes: number;
    localPatrimony: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startAnalysis = () => {
    setLoading(true);
    setError(null);
    try {
      const expenses = localState.entries
        .filter((e) => e.kind === "expense" && e.paidBy !== "father")
        .reduce((sum, e) => sum + e.amount, 0);

      const incomes = localState.entries
        .filter((e) => e.kind === "income")
        .reduce((sum, e) => sum + e.amount, 0);

      const patrimony = localState.accounts.reduce((sum, e) => sum + e.balance, 0);

      setReport({
        localEntriesCount: localState.entries.length,
        localTotalExpenses: expenses,
        localTotalIncomes: incomes,
        localPatrimony: patrimony,
      });

      setStep(2);
    } catch (err: any) {
      setError("Falha na análise dos dados: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const executeMigration = async () => {
    setLoading(true);
    setError(null);
    try {
      const repo = new SupabaseFinanceRepository(userId);

      // Salvar os dados locais no Supabase
      await repo.saveState(localState);

      // Validar os totais recém gravados no Supabase
      const remoteState = await repo.loadState();

      const remoteExpenses = remoteState.entries
        .filter((e) => e.kind === "expense" && e.paidBy !== "father")
        .reduce((sum, e) => sum + e.amount, 0);

      const remotePatrimony = remoteState.accounts.reduce((sum, e) => sum + e.balance, 0);

      if (
        remoteState.entries.length !== localState.entries.length ||
        Math.abs(remoteExpenses - report!.localTotalExpenses) > 0.01 ||
        Math.abs(remotePatrimony - report!.localPatrimony) > 0.01
      ) {
        throw new Error(
          `Divergência matemática detectada após envio: Local tem ${localState.entries.length} lançamentos, Remoto tem ${remoteState.entries.length}.`
        );
      }

      setStep(3);
    } catch (err: any) {
      setError("Erro na migração/sincronização: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" style={{ zIndex: 1000 }}>
      <div className="modal-content" style={{ maxWidth: "500px", width: "90%", padding: "28px" }}>
        <header className="modal-header" style={{ marginBottom: "20px" }}>
          <div>
            <span style={{ fontSize: "11px", textTransform: "uppercase", color: "var(--muted)", fontWeight: "bold" }}>Assistente de Banco</span>
            <h3 style={{ margin: "4px 0 0 0", fontSize: "18px", fontWeight: "bold" }}>Migração segura para Supabase</h3>
          </div>
          <button className="icon-button" onClick={onClose} disabled={loading}><X size={20} /></button>
        </header>

        {error && (
          <div style={{ background: "rgba(239, 68, 68, 0.08)", border: "1px solid var(--danger)", borderRadius: "var(--r-sm)", padding: "12px", display: "flex", gap: "10px", alignItems: "center", marginBottom: "20px", fontSize: "12px", color: "var(--text)" }}>
            <ShieldAlert size={16} style={{ color: "var(--danger)", flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <section style={{ marginBottom: "24px" }}>
          {step === 1 && (
            <div>
              <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "16px" }}>
                Identificamos dados financeiros salvos localmente neste navegador. Vamos analisá-los e transferir com segurança para a sua conta remota protegida.
              </p>
              <button className="primary-button" style={{ width: "100%", justifyContent: "center", gap: "8px" }} onClick={startAnalysis} disabled={loading}>
                {loading ? <RefreshCw className="spin" size={18} /> : <Play size={18} />}
                Analisar dados locais
              </button>
            </div>
          )}

          {step === 2 && report && (
            <div>
              <h4 style={{ fontSize: "13px", color: "var(--text)", margin: "0 0 12px 0" }}>Resumo da auditoria de migração:</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", padding: "16px", marginBottom: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Total de Lançamentos</span>
                  <strong>{report.localEntriesCount} itens</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Soma das Receitas</span>
                  <strong style={{ color: "var(--success)" }}>+{brl.format(report.localTotalIncomes)}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Soma das Despesas</span>
                  <strong style={{ color: "var(--danger)" }}>-{brl.format(report.localTotalExpenses)}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Patrimônio Líquido</span>
                  <strong>{brl.format(report.localPatrimony)}</strong>
                </div>
              </div>

              <p style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "20px" }}>
                ⚠️ <strong>Atenção:</strong> Após a migração bem-sucedida, as tabelas remotas serão ativadas como fonte principal de dados e o cache local será mantido para redundância.
              </p>

              <button className="primary-button" style={{ width: "100%", justifyContent: "center", gap: "8px" }} onClick={executeMigration} disabled={loading}>
                {loading ? <RefreshCw className="spin" size={18} /> : <Database size={18} />}
                Confirmar e Migrar para Nuvem
              </button>
            </div>
          )}

          {step === 3 && (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <CheckCircle size={48} style={{ color: "var(--success)", marginBottom: "16px" }} />
              <h4 style={{ fontSize: "16px", fontWeight: "bold", margin: "0 0 8px 0" }}>Reconciliação Concluída!</h4>
              <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "24px" }}>
                Todos os dados locais foram exportados, recalculados e as diferenças batem exatamente em <strong>R$ 0,00</strong>.
              </p>
              <button className="primary-button" style={{ width: "100%", justifyContent: "center" }} onClick={onComplete}>
                Acessar Painel
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
