import React, { useState, useEffect, useCallback } from "react";
import { ClipboardList, Trash2, RotateCcw } from "lucide-react";
import type { FinanceState, FinanceEntry } from "@/lib/types";
import { getMonthClose } from "@/lib/closing";
import { getAllAuditEntries, recordAudit, type AuditEntry } from "@/lib/audit";
import { getTrashItems, restoreFromTrash, emptyTrash, type TrashItem } from "@/lib/trash";
import { formatDate, brl, monthLabel } from "@/lib/finance";
import { validateDataIntegrity, type IntegrityIssue } from "@/lib/validation";

type ToastType = "success" | "danger" | "info" | "neutral";

function fieldLabel(field: string): string {
  const map: Record<string, string> = {
    title: "Descrição",
    amount: "Valor",
    dueDate: "Vencimento",
    status: "Status",
    category: "Categoria",
    account: "Conta",
    paidBy: "Pagador",
    source: "Origem",
    note: "Obs.",
    paymentDate: "Data pagamento",
    installment: "Parcela",
    deleted: "Excluído",
    created: "Criação",
  };
  return map[field] || field;
}

export function CorrectionCenter({
  state,
  selectedPeriod,
  entriesInPeriod,
  updateEntry,
  pushToast,
  setState,
}: {
  state: FinanceState;
  selectedPeriod: string;
  entriesInPeriod: FinanceEntry[];
  updateEntry: (id: string, updated: Omit<FinanceEntry, "id">) => void;
  pushToast: (message: string, type: ToastType) => void;
  setState: React.Dispatch<React.SetStateAction<FinanceState>>;
}) {
  const [trashItems, setTrashItems] = useState<TrashItem[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEntry[]>([]);
  const [issues, setIssues] = useState<IntegrityIssue[]>([]);
  const [tab, setTab] = useState<"pendentes" | "lixeira" | "auditoria" | "integridade">("pendentes");

  const refresh = useCallback(() => {
    setTrashItems(getTrashItems(selectedPeriod) as any);
    setAuditEvents(getAllAuditEntries().slice(0, 100));
    setIssues(validateDataIntegrity(state));
  }, [selectedPeriod, state]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const lowConfidence = entriesInPeriod.filter((e) => e.dataQuality === "parcial" || e.dataQuality === "estimado");
  const noCategory = entriesInPeriod.filter((e) => !e.category || e.category === "Outros");
  const closedPeriodChanges = entriesInPeriod.filter((e) => {
    const period = e.dueDate.slice(0, 7);
    return getMonthClose(period).status === "closed";
  });

  return (
    <>
      <section className="decision-hero compact-hero" style={{ marginBottom: "24px" }}>
        <div>
          <span className="eyebrow"><ClipboardList size={16} /> Central de Correções</span>
          <h2 style={{ fontSize: "16px", fontWeight: 600, marginTop: "4px" }}>Revise e corrija seus dados</h2>
          <p style={{ fontSize: "13px", color: "var(--muted)", marginTop: "4px" }}>
            {lowConfidence.length} com baixa confiança · {noCategory.length} sem categoria · {closedPeriodChanges.length} em meses fechados · {trashItems.length} na lixeira
          </p>
        </div>
        <button className="secondary-button" style={{ fontSize: "11px", padding: "4px 10px" }} onClick={refresh}>Atualizar</button>
      </section>

      <div className="type-toggle" role="tablist" style={{ marginBottom: "24px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "2px", height: "40px", width: "fit-content" }}>
        <button type="button" className={tab === "pendentes" ? "active" : ""} onClick={() => setTab("pendentes")} style={{ height: "34px", fontSize: "12px" }}>Pendências</button>
        <button type="button" className={tab === "lixeira" ? "active" : ""} onClick={() => setTab("lixeira")} style={{ height: "34px", fontSize: "12px" }}>Lixeira ({trashItems.length})</button>
        <button type="button" className={tab === "auditoria" ? "active" : ""} onClick={() => setTab("auditoria")} style={{ height: "34px", fontSize: "12px" }}>Auditoria</button>
        <button type="button" className={tab === "integridade" ? "active" : ""} onClick={() => setTab("integridade")} style={{ height: "34px", fontSize: "12px" }}>Integridade ({issues.filter(i => i.type === "error").length} crít.)</button>
      </div>

      {tab === "pendentes" && (
        <section className="dashboard-grid" style={{ gridTemplateColumns: "1fr" }}>
          {lowConfidence.length === 0 && noCategory.length === 0 && closedPeriodChanges.length === 0 ? (
            <article className="panel">
              <div className="empty-state">
                <span>Nenhuma pendência</span>
                <p>Todos os lançamentos do período estão revisados e categorizados.</p>
              </div>
            </article>
          ) : (
            <>
              {lowConfidence.length > 0 && (
                <article className="panel">
                  <div className="panel-heading"><div><span>Baixa confiança</span><h3>{lowConfidence.length} lançamentos com qualidade parcial ou estimada</h3></div></div>
                  <div className="compact-list">
                    {lowConfidence.slice(0, 10).map((entry) => (
                      <div key={entry.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 16px", borderBottom: "1px solid var(--border)" }}>
                        <div>
                          <strong style={{ fontSize: "13px" }}>{entry.title}</strong>
                          <small style={{ display: "block", fontSize: "11px", color: "var(--muted)" }}>
                            {entry.category} · {brl.format(entry.amount)} · <span className={`quality-badge ${entry.dataQuality ?? "completo"}`}>{entry.dataQuality}</span>
                          </small>
                        </div>
                        <button className="secondary-button" style={{ fontSize: "11px", padding: "4px 10px" }} onClick={() => updateEntry(entry.id, { ...entry, dataQuality: "completo" })}>Confirmar</button>
                      </div>
                    ))}
                  </div>
                </article>
              )}
              {noCategory.length > 0 && (
                <article className="panel">
                  <div className="panel-heading"><div><span>Sem categoria</span><h3>{noCategory.length} lançamentos sem categoria definida</h3></div></div>
                  <div className="compact-list">
                    {noCategory.slice(0, 10).map((entry) => (
                      <div key={entry.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 16px", borderBottom: "1px solid var(--border)" }}>
                        <div>
                          <strong style={{ fontSize: "13px" }}>{entry.title}</strong>
                          <small style={{ display: "block", fontSize: "11px", color: "var(--muted)" }}>{brl.format(entry.amount)} · {entry.category}</small>
                        </div>
                        <select
                          value={entry.category}
                          onChange={(e) => updateEntry(entry.id, { ...entry, category: e.target.value })}
                          style={{ fontSize: "12px", padding: "2px 6px", maxWidth: "120px" }}
                        >
                          {["Alimentação", "Tecnologia/IA", "Educação", "Saúde", "Transporte", "Lazer", "Mercado", "Streaming", "Seguros", "Outros"].map((cat) => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </article>
              )}
              {closedPeriodChanges.length > 0 && (
                <article className="panel">
                  <div className="panel-heading"><div><span>Meses fechados</span><h3>{closedPeriodChanges.length} lançamentos em períodos fechados</h3></div></div>
                  <div className="compact-list">
                    {closedPeriodChanges.slice(0, 10).map((entry) => (
                      <div key={entry.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 16px", borderBottom: "1px solid var(--border)" }}>
                        <div>
                          <strong style={{ fontSize: "13px" }}>{entry.title}</strong>
                          <small style={{ display: "block", fontSize: "11px", color: "var(--muted)" }}>{entry.dueDate.slice(0, 7)} · {brl.format(entry.amount)}</small>
                        </div>
                        <span className="status-badge warning">Mês fechado</span>
                      </div>
                    ))}
                  </div>
                </article>
              )}
            </>
          )}
        </section>
      )}

      {tab === "lixeira" && (
        <section className="dashboard-grid" style={{ gridTemplateColumns: "1fr" }}>
          <article className="panel">
            <div className="panel-heading">
              <div><span>Itens excluídos</span><h3>Restaurar ou limpar permanentemente</h3></div>
              {trashItems.length > 0 && (
                <button className="secondary-button" style={{ fontSize: "11px", padding: "4px 10px", color: "var(--danger)" }} onClick={() => { if (window.confirm("Esvaziar a lixeira permanentemente?")) { emptyTrash(); refresh(); pushToast("Lixeira esvaziada.", "info"); } }}>
                  <Trash2 size={14} /> Esvaziar
                </button>
              )}
            </div>
            {trashItems.length === 0 ? (
              <div className="empty-state">
                <span>Lixeira vazia</span>
                <p>Itens excluídos aparecerão aqui e podem ser restaurados.</p>
              </div>
            ) : (
              <div className="compact-list">
                {trashItems.map((item) => {
                  const entry = item.entry as any;
                  return (
                    <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 16px", borderBottom: "1px solid var(--border)" }}>
                      <div>
                        <strong style={{ fontSize: "13px" }}>{entry.title}</strong>
                        <small style={{ display: "block", fontSize: "11px", color: "var(--muted)" }}>
                          Excluído em {new Date(item.deletedAt).toLocaleString("pt-BR")} · {brl.format(entry.amount)} · {entry.category}
                        </small>
                      </div>
                      <button className="primary-button compact" onClick={() => {
                        const restored = restoreFromTrash(item.id) as any;
                        if (restored) {
                          setState((prev: FinanceState) => ({ ...prev, entries: [restored, ...prev.entries], updatedAt: new Date().toISOString() }));
                          recordAudit(restored.id, "restored", [{ field: "restored", oldValue: "deleted", newValue: "active" }], restored);
                          refresh();
                          pushToast(`"${restored.title}" restaurado.`, "success");
                        }
                      }}>
                        <RotateCcw size={14} /> Restaurar
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </article>
        </section>
      )}

      {tab === "auditoria" && (
        <section className="dashboard-grid" style={{ gridTemplateColumns: "1fr" }}>
          <article className="panel">
            <div className="panel-heading"><div><span>Registro de alterações</span><h3>Últimas {auditEvents.length} ações no sistema</h3></div></div>
            <div className="compact-list" style={{ maxHeight: "500px", overflowY: "auto" }}>
              {auditEvents.length === 0 ? (
                <div className="empty-state">
                  <span>Nenhuma alteração registrada</span>
                  <p>As edições realizadas aparecerão aqui com antes/depois.</p>
                </div>
              ) : (
                auditEvents.map((audit) => (
                  <div key={audit.id} style={{ padding: "8px 16px", borderBottom: "1px solid var(--border)", fontSize: "12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>
                        <strong>{audit.action === "created" ? "Criado" : audit.action === "updated" ? "Editado" : audit.action === "deleted" ? "Excluído" : audit.action === "settled" ? "Baixa" : audit.action === "restored" ? "Restaurado" : audit.action}</strong>
                        {' · '}{(audit.snapshot as any)?.title ?? "N/A"}
                      </span>
                      <span style={{ color: "var(--muted)" }}>{new Date(audit.timestamp).toLocaleString("pt-BR")}</span>
                    </div>
                    {audit.changes.length > 0 && (
                      <div style={{ color: "var(--muted)", marginTop: "2px", fontSize: "11px" }}>
                        {audit.changes.slice(0, 3).map((c, i) => (
                          <span key={i}>{fieldLabel(c.field)}: {String(c.oldValue ?? "—")} → {String(c.newValue ?? "—")}{i < Math.min(audit.changes.length, 3) - 1 ? ' · ' : ''}</span>
                        ))}
                        {audit.changes.length > 3 && <span> · +{audit.changes.length - 3} campos</span>}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </article>
        </section>
      )}

      {tab === "integridade" && (
        <section className="dashboard-grid" style={{ gridTemplateColumns: "1fr" }}>
          <article className="panel">
            <div className="panel-heading">
              <div>
                <span>Validações de Integridade</span>
                <h3>Auditoria de Integridade dos Dados</h3>
              </div>
              <button 
                className="secondary-button" 
                style={{ fontSize: "11px", padding: "4px 10px" }}
                onClick={() => {
                  setIssues(validateDataIntegrity(state));
                  pushToast("Integridade re-avaliada.", "info");
                }}
              >
                Re-avaliar
              </button>
            </div>
            {issues.length === 0 ? (
              <div style={{ padding: "24px", textAlign: "center", color: "var(--success)" }}>
                <strong>✓ Nenhum problema crítico encontrado.</strong> A base está consistente e íntegra.
              </div>
            ) : (
              <div className="compact-list">
                {issues.map((iss, index) => (
                  <div key={index} style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <span className={`status-badge status-${iss.type === "error" ? "danger" : "neutral"}`} style={{ fontSize: "10px", marginRight: "8px" }}>
                        {iss.type === "error" ? "Crítico" : "Aviso"}
                      </span>
                      <strong>{iss.message}</strong>
                      {iss.details && <p style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>{iss.details}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>
        </section>
      )}
    </>
  );
}
