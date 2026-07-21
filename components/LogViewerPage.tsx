import React, { useState, useEffect, useCallback } from "react";
import { ListTodo } from "lucide-react";
import { logger, type LogCategory, type LogLevel } from "@/lib/logger";

export function LogViewerPage() {
  const [logs, setLogs] = useState<ReturnType<typeof logger.loadAll>>([]);
  const [filter, setFilter] = useState<LogCategory | "all">("all");
  const [levelFilter, setLevelFilter] = useState<LogLevel | "all">("all");

  const refresh = useCallback(() => {
    const all = logger.loadAll();
    setLogs(all);
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 5000);
    return () => clearInterval(timer);
  }, [refresh]);

  const stats = logger.getStats();
  const filtered = logs.filter((l) => {
    if (filter !== "all" && l.category !== filter) return false;
    if (levelFilter !== "all" && l.level !== levelFilter) return false;
    return true;
  });

  return (
    <>
      <section className="decision-hero compact-hero" style={{ marginBottom: "24px" }}>
        <div>
          <span className="eyebrow"><ListTodo size={16} /> Observabilidade</span>
          <h2 style={{ fontSize: "16px", fontWeight: 600, marginTop: "4px" }}>Monitoramento e logs do sistema</h2>
          <p style={{ fontSize: "13px", color: "var(--muted)", marginTop: "4px" }}>
            {stats.total} logs do sistema · {stats.errors} erros · últimas 24h: {stats.last24h}
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button className="secondary-button" style={{ fontSize: "11px", padding: "4px 10px" }} onClick={() => { logger.clear(); refresh(); }}>Limpar logs</button>
          <button className="secondary-button" style={{ fontSize: "11px", padding: "4px 10px" }} onClick={refresh}>Atualizar</button>
        </div>
      </section>

      <section className="dashboard-grid" style={{ gridTemplateColumns: "1fr" }}>
        <article className="panel">
          <div className="panel-heading">
            <div><span>Filtros</span><h3>Filtrar por tipo e nível</h3></div>
            <div style={{ display: "flex", gap: "8px" }}>
              <select value={filter} onChange={(e) => setFilter(e.target.value as LogCategory | "all")} className="period-select" style={{ fontSize: "11px", padding: "4px 20px 4px 8px" }}>
                <option value="all">Todas categorias</option>
                {[...new Set(logs.map((l) => l.category))].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value as LogLevel | "all")} className="period-select" style={{ fontSize: "11px", padding: "4px 20px 4px 8px" }}>
                <option value="all">Todos níveis</option>
                <option value="error">Erro</option>
                <option value="warn">Aviso</option>
                <option value="info">Info</option>
                <option value="debug">Debug</option>
              </select>
            </div>
          </div>
          <div className="log-viewer" style={{ maxHeight: "500px", overflowY: "auto" }}>
            {filtered.length === 0 ? (
              <div className="empty-state">
                <ListTodo size={28} />
                <strong>Nenhum log registrado</strong>
                <span>Os logs do sistema são gerados automaticamente ao realizar ações como importar, exportar ou fechar o mês.</span>
              </div>
            ) : (
              filtered.slice().reverse().map((entry) => (
                <div key={entry.id} className="log-entry">
                  <span className="log-time">{new Date(entry.timestamp).toLocaleString("pt-BR")}</span>
                  <span className={`log-level log-level-${entry.level}`}>{entry.level}</span>
                  <span className="log-category">{entry.category}</span>
                  <span className="log-message">{entry.message}</span>
                  {entry.context && Object.keys(entry.context).length > 0 && (
                    <span className="log-context" title={JSON.stringify(entry.context)}>{JSON.stringify(entry.context)}</span>
                  )}
                </div>
              ))
            )}
          </div>
        </article>
      </section>
    </>
  );
}
