import React, { useState, useEffect, useCallback } from "react";
import { Database, Download, Save, ShieldCheck, Upload, RotateCcw } from "lucide-react";
import type { FinanceState } from "@/lib/types";
import { logger } from "@/lib/logger";
import {
  loadBackupList,
  exportCSV,
  exportJSON,
  exportFullBackup,
  createBackup,
  restoreFromBackup,
  type BackupMeta,
} from "@/lib/backup";

export function ToolsPage({
  state,
  setState,
  pushToast,
  onRestoreModal,
}: {
  state: FinanceState;
  setState: React.Dispatch<React.SetStateAction<FinanceState>>;
  pushToast: (message: string, type: "success" | "danger" | "info" | "neutral") => void;
  onRestoreModal: () => void;
}) {
  const [backups, setBackups] = useState<BackupMeta[]>([]);
  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);

  const refreshBackups = useCallback(() => {
    setBackups(loadBackupList());
  }, []);

  useEffect(() => {
    refreshBackups();
  }, [refreshBackups]);

  const hasAutoBackup = backups.some((b) => b.label.startsWith("Backup automático"));
  const lastAutoBackup = backups.filter((b) => b.label.startsWith("Backup automático")).pop();
  const manualBackups = backups.filter((b) => !b.label.startsWith("Backup automático"));

  const handleExport = useCallback(
    (format: "csv" | "json" | "full") => {
      const start = performance.now();
      if (format === "csv") exportCSV(state);
      else if (format === "json") exportJSON(state);
      else exportFullBackup(state);
      const duration = performance.now() - start;
      logger.info("export", `${format.toUpperCase()} export completed`, { duration: `${duration.toFixed(0)}ms` });
    },
    [state]
  );

  return (
    <>
      <section className="decision-hero compact-hero" style={{ marginBottom: "24px" }}>
        <div>
          <span className="eyebrow"><Database size={16} /> Exportar e backup</span>
          <h2 style={{ fontSize: "16px", fontWeight: 600, marginTop: "4px" }}>Proteja seus dados financeiros</h2>
          <p style={{ fontSize: "13px", color: "var(--muted)", marginTop: "4px" }}>Backups automáticos a cada 5 minutos. Exporte manualmente quando quiser.</p>
        </div>
      </section>

      <section className="dashboard-grid dashboard-grid-primary">
        <article className="panel">
          <div className="panel-heading">
            <div><span>Exportar dados</span><h3>Formatos disponíveis</h3></div>
            <Download size={20} />
          </div>
          <div className="export-bar">
            <button className="export-button" onClick={() => handleExport("csv")}><Download size={14} />CSV</button>
            <button className="export-button" onClick={() => handleExport("json")}><Download size={14} />JSON</button>
            <button className="export-button" onClick={() => handleExport("full")}><Save size={14} />Backup completo</button>
          </div>
          <div className="privacy-note" style={{ borderTop: "none", paddingTop: 0 }}>
            <ShieldCheck size={18} />
            <div>
              <strong>Exportação privada</strong>
              <span>Os dados são baixados diretamente para seu computador. Nenhum servidor intermediário.</span>
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div><span>Importar</span><h3>Restaurar backup JSON</h3></div>
          </div>
          <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
            <p style={{ fontSize: "13px", color: "var(--muted)" }}>Faça upload de um arquivo JSON de backup exportado anteriormente.</p>
            <label className="upload-button" style={{ padding: "24px", cursor: "pointer", textAlign: "center" }}>
              <Upload size={24} />
              <span>Selecionar JSON</span>
              <input
                type="file"
                accept=".json"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setImportFile(file);
                    setShowImport(true);
                  }
                  e.target.value = "";
                }}
              />
            </label>
            {showImport && importFile && (
              <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                Arquivo: {importFile.name}
                <button className="primary-button compact" style={{ marginLeft: "8px" }} onClick={onRestoreModal}>Restaurar</button>
              </div>
            )}
          </div>
        </article>
      </section>

      <section className="dashboard-grid" style={{ gridTemplateColumns: "1fr", marginTop: "24px" }}>
        <article className="panel panel-wide">
          <div className="panel-heading">
            <div>
            <span>Backups automáticos</span>
            <h3>Últimos backups salvos (máx 50)</h3>
          </div>
            <button
              className="primary-button compact"
              onClick={() => {
                createBackup(state);
                refreshBackups();
              }}
            >
              <Save size={15} />Criar backup agora
            </button>
          </div>
          {lastAutoBackup && (
            <div className="privacy-note" style={{ borderTop: "none", paddingTop: 0, borderBottom: "1px solid var(--border)", paddingBottom: 0 }}>
              <Save size={18} />
              <div>
                <strong>Último backup automático</strong>
                <span style={{ fontSize: "13px" }}>{new Date(lastAutoBackup.timestamp).toLocaleString("pt-BR")} · {lastAutoBackup.entryCount} lançamentos</span>
              </div>
            </div>
          )}
          {manualBackups.length === 0 ? (
            <div className="empty-state">
              <span>Nenhum backup manual</span>
              <p>Backups automáticos são criados a cada 5 minutos. Clique em 'Criar backup agora' para o primeiro.</p>
            </div>
          ) : (
            <div className="backup-list">
              {manualBackups.slice().reverse().map((backup) => (
                <div key={backup.id} className="backup-item">
                  <div>
                    <strong>{backup.label}</strong>
                    <span>{new Date(backup.timestamp).toLocaleString("pt-BR")} · {backup.entryCount} lançamentos</span>
                  </div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      className="export-button"
                      onClick={() => {
                        const restored = restoreFromBackup(backup.id);
                        if (restored) {
                          createBackup(state, "Antes da restauração");
                          setState(restored);
                          logger.info("export", "Backup restored", { id: backup.id });
                          pushToast("Backup restaurado com sucesso.", "success");
                        } else {
                          pushToast("Falha ao restaurar backup.", "danger");
                        }
                      }}
                    >
                      <RotateCcw size={12} />Restaurar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
    </>
  );
}
