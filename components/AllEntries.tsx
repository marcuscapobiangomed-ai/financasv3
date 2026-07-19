
import React, { useState, useMemo } from "react";
import { ClipboardList, Pencil, History, Plus, Trash2 } from "lucide-react";
import type { FinanceState, FinanceEntry } from "@/lib/types";
import { formatDate, brl, monthLabel } from "@/lib/finance";

type ToastType = "success" | "danger" | "info" | "neutral";

function statusLabel(entry: FinanceEntry, today: string) {
  if (entry.status === "recebido") return "Recebido";
  if (entry.status === "realizado") return "Pago";
  if (entry.dueDate < today && (entry.status === "a_pagar" || entry.status === "a_receber_confirmado")) return "Atrasado";
  if (entry.status === "projetado" || entry.status === "a_receber_incerto") return "Previsto";
  return "Pendente";
}

function statusClass(entry: FinanceEntry, today: string) {
  if (entry.status === "recebido" || entry.status === "realizado") return "success";
  if (entry.dueDate < today && (entry.status === "a_pagar" || entry.status === "a_receber_confirmado")) return "danger";
  if (entry.status === "projetado" || entry.status === "a_receber_incerto") return "neutral";
  return "warning";
}

export function AllEntries({
  state,
  setState,
  pushToast,
  onEdit,
  setHistoryModalEntry,
  removeEntry,
  today,
}: {
  state: FinanceState;
  setState: React.Dispatch<React.SetStateAction<FinanceState>>;
  pushToast: (msg: string, type?: "success" | "danger" | "info" | "neutral") => void;
  onEdit: (entry: FinanceEntry) => void;
  setHistoryModalEntry?: (entry: FinanceEntry) => void;
  removeEntry: (id: string) => void;
  today: string;
}) {
  const [periodFilter, setPeriodFilter] = useState("all");
  const [dateTypeFilter, setDateTypeFilter] = useState<"financial_month" | "purchase_date" | "invoice_cycle">("financial_month");
  const [accountFilter, setAccountFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [originFilter, setOriginFilter] = useState("all");
  const [qualityFilter, setQualityFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Extract unique periods for the filter
  const periods = useMemo(() => {
    const months = new Set<string>();
    state.entries.forEach((e) => {
      months.add(e.dueDate.slice(0, 7));
      if (e.invoiceMonth) months.add(e.invoiceMonth);
    });
    return Array.from(months).sort();
  }, [state.entries]);

  // Extract unique accounts
  const accounts = useMemo(() => {
    const accs = new Set<string>();
    state.entries.forEach((e) => {
      if (e.account) accs.add(e.account);
    });
    return Array.from(accs);
  }, [state.entries]);

  // Filtered entries
  const filteredEntries = useMemo(() => {
    return state.entries.filter((entry) => {
      // 1. Period filter (accounting for dateTypeFilter)
      if (periodFilter !== "all") {
        let entryPeriod = "";
        if (dateTypeFilter === "financial_month") {
          entryPeriod = entry.kind === "income" 
            ? entry.dueDate.slice(0, 7) 
            : (entry.invoiceMonth || entry.dueDate.slice(0, 7));
        } else if (dateTypeFilter === "purchase_date") {
          entryPeriod = (entry.purchaseDate || entry.dueDate).slice(0, 7);
        } else if (dateTypeFilter === "invoice_cycle") {
          entryPeriod = entry.invoiceMonth || entry.dueDate.slice(0, 7);
        }
        if (entryPeriod !== periodFilter) return false;
      }

      // 2. Account filter
      if (accountFilter !== "all" && entry.account !== accountFilter) return false;

      // 3. Status filter
      if (statusFilter !== "all") {
        const lowerStatus = entry.status.toLowerCase();
        if (statusFilter === "pago" && lowerStatus !== "realizado" && lowerStatus !== "recebido") return false;
        if (statusFilter === "pendente" && lowerStatus !== "a_pagar" && lowerStatus !== "a_receber_confirmado") return false;
        if (statusFilter === "projetado" && lowerStatus !== "projetado" && lowerStatus !== "a_receber_incerto") return false;
      }

      // 4. Origin filter
      if (originFilter !== "all") {
        const isRec = entry.note?.includes("Recuperado") || (entry as any).recoveryOrigin === "seed";
        const isImp = entry.note?.includes("Importado") || entry.account === "Importado";
        const isMan = !isRec && !isImp;

        if (originFilter === "recuperado" && !isRec) return false;
        if (originFilter === "importado" && !isImp) return false;
        if (originFilter === "manual" && !isMan) return false;
      }

      // 5. Quality filter
      if (qualityFilter !== "all" && entry.dataQuality !== qualityFilter) return false;

      // 6. Search query
      if (searchQuery.trim()) {
        const normalized = searchQuery.toLowerCase().trim();
        const text = [
          entry.title,
          entry.category,
          entry.account,
          entry.note,
          entry.id,
          String(entry.amount),
        ].filter(Boolean).join(" ").toLowerCase();
        if (!text.includes(normalized)) return false;
      }

      return true;
    });
  }, [state.entries, periodFilter, dateTypeFilter, accountFilter, statusFilter, originFilter, qualityFilter, searchQuery]);

  // Paginated entries
  const paginatedEntries = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredEntries.slice(start, start + pageSize);
  }, [filteredEntries, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredEntries.length / pageSize) || 1;

  function handleDuplicate(entry: FinanceEntry) {
    const duplicated = {
      ...entry,
      id: crypto.randomUUID(),
      title: `${entry.title} (Cópia)`,
      note: (entry.note || "") + " | Duplicado manualmente",
    };
    setState(prev => ({
      ...prev,
      entries: [duplicated, ...prev.entries],
      updatedAt: new Date().toISOString(),
    }));
    pushToast("Lançamento duplicado com sucesso!", "success");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <section className="decision-hero flex-col" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "16px", padding: "28px 32px" }}>
        <span className="eyebrow"><ClipboardList size={16} /> Todos os Lançamentos</span>
        <h2 style={{ fontSize: "14px", fontWeight: 600, color: "var(--muted-2)", margin: 0 }}>Visualização Global dos Dados</h2>
        <strong style={{ fontSize: "38px", fontWeight: 800, color: "var(--text)", display: "block", margin: "6px 0", letterSpacing: "-0.02em" }}>{filteredEntries.length} itens</strong>
        <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0, lineHeight: "1.4" }}>
          Tabela geral com todos os lançamentos financeiros do sistema. Utilize os filtros abaixo para refinar os resultados.
        </p>
      </section>

      {/* Filtros */}
      <article className="panel">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", padding: "8px 0" }}>
          <div style={{ flex: "1 1 180px", minWidth: "150px" }}>
            <label style={{ fontSize: "12px", color: "var(--muted-2)", display: "block", marginBottom: "4px" }}>Período</label>
            <select value={periodFilter} onChange={(e) => { setPeriodFilter(e.target.value); setCurrentPage(1); }} className="period-select" style={{ width: "100%", height: "38px" }}>
              <option value="all">Todos os períodos</option>
              {periods.map(p => <option key={p} value={p}>{monthLabel(p)}</option>)}
            </select>
          </div>

          <div style={{ flex: "1 1 180px", minWidth: "150px" }}>
            <label style={{ fontSize: "12px", color: "var(--muted-2)", display: "block", marginBottom: "4px" }}>Visualizar período por</label>
            <select value={dateTypeFilter} onChange={(e) => { setDateTypeFilter(e.target.value as any); setCurrentPage(1); }} className="period-select" style={{ width: "100%", height: "38px" }}>
              <option value="financial_month">Mês financeiro</option>
              <option value="purchase_date">Data da compra</option>
              <option value="invoice_cycle">Ciclo da fatura</option>
            </select>
          </div>

          <div style={{ flex: "1 1 150px", minWidth: "120px" }}>
            <label style={{ fontSize: "12px", color: "var(--muted-2)", display: "block", marginBottom: "4px" }}>Conta / Cartão</label>
            <select value={accountFilter} onChange={(e) => { setAccountFilter(e.target.value); setCurrentPage(1); }} className="period-select" style={{ width: "100%", height: "38px" }}>
              <option value="all">Todos</option>
              {accounts.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          <div style={{ flex: "1 1 150px", minWidth: "120px" }}>
            <label style={{ fontSize: "12px", color: "var(--muted-2)", display: "block", marginBottom: "4px" }}>Status</label>
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }} className="period-select" style={{ width: "100%", height: "38px" }}>
              <option value="all">Todos</option>
              <option value="pago">Pago / Recebido</option>
              <option value="pendente">Pendente / A pagar</option>
              <option value="projetado">Projetado / Previsto</option>
            </select>
          </div>

          <div style={{ flex: "1 1 150px", minWidth: "120px" }}>
            <label style={{ fontSize: "12px", color: "var(--muted-2)", display: "block", marginBottom: "4px" }}>Origem</label>
            <select value={originFilter} onChange={(e) => { setOriginFilter(e.target.value); setCurrentPage(1); }} className="period-select" style={{ width: "100%", height: "38px" }}>
              <option value="all">Todos</option>
              <option value="recuperado">Recuperado</option>
              <option value="importado">Importado</option>
              <option value="manual">Manual/Novo</option>
            </select>
          </div>

          <div style={{ flex: "1 1 150px", minWidth: "120px" }}>
            <label style={{ fontSize: "12px", color: "var(--muted-2)", display: "block", marginBottom: "4px" }}>Qualidade</label>
            <select value={qualityFilter} onChange={(e) => { setQualityFilter(e.target.value); setCurrentPage(1); }} className="period-select" style={{ width: "100%", height: "38px" }}>
              <option value="all">Todas</option>
              <option value="completo">Completo</option>
              <option value="parcial">Parcial</option>
              <option value="estimado">Estimado</option>
            </select>
          </div>
        </div>

        <div style={{ marginTop: "12px" }}>
          <label style={{ fontSize: "12px", color: "var(--muted-2)", display: "block", marginBottom: "4px" }}>Busca rápida</label>
          <input
            type="text"
            placeholder="Buscar por descrição, valor, categoria, conta, nota ou ID..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            style={{ width: "100%", padding: "10px 14px", background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", color: "var(--text)" }}
          />
        </div>
      </article>

      {/* Tabela de Lançamentos */}
      <article className="panel">
        <div style={{ overflowX: "auto" }}>
          <table className="entry-table" style={{ width: "100%", fontSize: "12px" }}>
            <thead>
              <tr>
                <th>Data Compra</th>
                <th>Descrição</th>
                <th>Valor</th>
                <th>Tipo</th>
                <th>Categoria</th>
                <th>Conta / Cartão</th>
                <th>Fatura (Mês)</th>
                <th>Vencimento</th>
                <th>Parcela</th>
                <th>Status</th>
                <th>Qualidade</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {paginatedEntries.length === 0 ? (
                <tr>
                  <td colSpan={12} style={{ textAlign: "center", padding: "32px", color: "var(--muted)" }}>
                    Nenhum lançamento corresponde aos filtros.
                  </td>
                </tr>
              ) : (
                paginatedEntries.map((entry) => {
                  const dateClass = entry.purchaseDate ? "" : "text-muted";
                  return (
                    <tr key={entry.id}>
                      <td className={dateClass}>{entry.purchaseDate ? formatDate(entry.purchaseDate) : formatDate(entry.dueDate)}</td>
                      <td>
                        <strong>{entry.title}</strong>
                        {entry.note && <div style={{ fontSize: "10px", color: "var(--muted)", fontStyle: "italic", marginTop: "2px" }}>{entry.note}</div>}
                      </td>
                      <td style={{ color: entry.kind === "income" ? "var(--success)" : "var(--text)" }}>
                        {entry.kind === "income" ? "+" : "−"}{brl.format(entry.amount)}
                      </td>
                      <td>
                        <span className={`status-badge ${entry.kind === "income" ? "status-success" : "status-neutral"}`} style={{ fontSize: "10px" }}>
                          {entry.kind === "income" ? "Entrada" : "Saída"}
                        </span>
                      </td>
                      <td>{entry.category}</td>
                      <td>{entry.account || "N/A"}</td>
                      <td>{entry.invoiceMonth ? monthLabel(entry.invoiceMonth) : "−"}</td>
                      <td>{formatDate(entry.dueDate)}</td>
                      <td>{entry.installment || "À vista"}</td>
                      <td>
                        <span className={`status-badge status-${statusClass(entry, today)}`}>
                          {statusLabel(entry, today)}
                        </span>
                      </td>
                      <td>
                        <span style={{ 
                          fontSize: "10px", 
                          padding: "2px 6px", 
                          borderRadius: "4px", 
                          background: entry.dataQuality === "completo" ? "rgba(40,167,69,0.1)" : entry.dataQuality === "parcial" ? "rgba(255,193,7,0.1)" : "rgba(23,162,184,0.1)",
                          color: entry.dataQuality === "completo" ? "var(--success)" : entry.dataQuality === "parcial" ? "var(--warning)" : "var(--info)",
                          fontWeight: 700 
                        }}>
                          {entry.dataQuality}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button className="icon-button" onClick={() => onEdit(entry)} title="Editar"><Pencil size={13} /></button>
                          {setHistoryModalEntry && (
                            <button className="icon-button" onClick={() => setHistoryModalEntry(entry)} title="Ver Histórico"><History size={13} /></button>
                          )}
                          <button className="icon-button" onClick={() => handleDuplicate(entry)} title="Duplicar"><Plus size={13} /></button>
                          <button className="icon-button text-danger" onClick={() => { if (window.confirm("Excluir lançamento?")) removeEntry(entry.id); }} title="Excluir"><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px", borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
            <span style={{ fontSize: "12px", color: "var(--muted)" }}>
              Mostrando {Math.min(filteredEntries.length, (currentPage - 1) * pageSize + 1)}–{Math.min(filteredEntries.length, currentPage * pageSize)} de {filteredEntries.length} itens
            </span>
            <div style={{ display: "flex", gap: "8px" }}>
              <button 
                className="secondary-button compact" 
                disabled={currentPage === 1} 
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              >
                Anterior
              </button>
              <span style={{ alignSelf: "center", fontSize: "12px", padding: "0 8px" }}>
                Página {currentPage} de {totalPages}
              </span>
              <button 
                className="secondary-button compact" 
                disabled={currentPage === totalPages} 
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </article>
    </div>
  );
}
