
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { ShieldCheck, RotateCcw, Database, History, Trash2 } from "lucide-react";
import type { FinanceState, FinanceEntry } from "@/lib/types";
import { initialFinanceState } from "@/lib/seed";
import { getAllAuditEntries, recordAudit } from "@/lib/audit";
import { getTrashItems, restoreFromTrash } from "@/lib/trash";
import { formatDate, brl } from "@/lib/finance";
import { createBackup } from "@/lib/backup";

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

export function RecoveryDiagnostics({
  state,
  setState,
  pushToast,
}: {
  state: FinanceState;
  setState: React.Dispatch<React.SetStateAction<FinanceState>>;
  pushToast: (message: string, type?: "success" | "danger" | "info" | "neutral") => void;
}) {
  const seedEntries = initialFinanceState.entries;
  const browserEntries = state.entries;
  const auditEntries = getAllAuditEntries();
  const trashItems = getTrashItems();

  // Counts
  const nubankCount = browserEntries.filter(e => e.account?.toLowerCase() === "nubank").length;
  const unicredCount = browserEntries.filter(e => e.account?.toLowerCase() === "unicred").length;
  const personalCount = browserEntries.filter(e => e.account?.toLowerCase() !== "nubank" && e.account?.toLowerCase() !== "unicred").length;
  const incomeCount = browserEntries.filter(e => e.kind === "income").length;
  const expenseCount = browserEntries.filter(e => e.kind === "expense").length;
  const futureCount = browserEntries.filter(e => e.status === "projetado").length;
  const fatherPaidCount = browserEntries.filter(e => e.paidBy === "father").length;
  
  const manualCount = browserEntries.filter(b => !seedEntries.some(s => s.id === b.id)).length;
  const importedCount = browserEntries.filter(e => e.note?.includes("Importado via CSV") || e.note?.includes("Importado de prints")).length;

  // Comparison
  const seedMap = new Map(seedEntries.map(e => [e.id, e]));
  const browserMap = new Map(browserEntries.map(e => [e.id, e]));
  const trashMap = new Map(trashItems.map(t => [t.entry.id as string, t]));

  const allIds: string[] = Array.from(new Set([
    ...seedEntries.map(e => e.id),
    ...browserEntries.map(e => e.id),
    ...trashItems.map(t => t.entry.id as string)
  ]));

  const comparison = allIds.map(id => {
    const seed = seedMap.get(id);
    const browser = browserMap.get(id);
    const trash = trashMap.get(id);

    let status = "";
    let color = "";
    const item = browser || seed || (trash?.entry as FinanceEntry | undefined);

    if (seed && !browser) {
      if (trash) {
        status = "Na lixeira";
        color = "var(--danger)";
      } else {
        status = "Recuperável (Apenas no Seed)";
        color = "var(--warning)";
      }
    } else if (!seed && browser) {
      status = "Manual/Personalizado";
      color = "var(--success)";
    } else if (seed && browser) {
      const diff = 
        seed.title !== browser.title ||
        seed.amount !== browser.amount ||
        seed.dueDate !== browser.dueDate ||
        seed.category !== browser.category ||
        seed.status !== browser.status ||
        seed.account !== browser.account;
      if (diff) {
        status = "Divergente (Edições Preservadas)";
        color = "#a855f7"; // purple
      } else {
        status = "Sincronizado";
        color = "var(--text-muted)";
      }
    } else if (trash) {
      status = "Na lixeira (Manual)";
      color = "var(--danger)";
    }

    return { id, status, color, item, seed, browser, trash };
  });

  // Duplicate detection (same date, description, and amount but different ID)
  const duplicates: Array<{ entryA: FinanceEntry; entryB: FinanceEntry }> = [];
  for (let i = 0; i < browserEntries.length; i++) {
    for (let j = i + 1; j < browserEntries.length; j++) {
      const a = browserEntries[i];
      const b = browserEntries[j];
      if (
        a.title.toLowerCase().trim() === b.title.toLowerCase().trim() &&
        Math.abs(a.amount - b.amount) < 0.01 &&
        a.dueDate === b.dueDate &&
        a.id !== b.id
      ) {
        duplicates.push({ entryA: a, entryB: b });
      }
    }
  }

  // Dynamic seed counts for reconciliation report
  const expectedUnicred = seedEntries.filter(e => e.account === "Unicred").length;
  const expectedNubank = seedEntries.filter(e => e.account === "Nubank").length;
  const expectedWillian = seedEntries.filter(e => e.title.includes("Willian") || e.source?.includes("Willian")).length;
  const expectedBiel = seedEntries.filter(e => e.title.includes("Biel") || e.source?.includes("Biel")).length;
  const expectedClara = seedEntries.filter(e => e.title.includes("Clara") || e.source?.includes("Clara")).length;
  const expectedDargam = seedEntries.filter(e => e.title.includes("Dargam") || e.source?.includes("Dargam")).length;
  const expectedLuandder = seedEntries.filter(e => e.title.includes("Luandder") || e.source?.includes("Luandder")).length;
  const expectedRemedio = seedEntries.filter(e => e.title.toLowerCase().includes("remédio")).length;
  const expectedPassagem = seedEntries.filter(e => e.title.toLowerCase().includes("passagem")).length;
  const expectedMacbook = seedEntries.filter(e => e.title.toLowerCase().includes("macbook")).length;
  const expectedMedcel = seedEntries.filter(e => e.title.toLowerCase().includes("medcel")).length;

  const foundUnicred = browserEntries.filter(e => e.account === "Unicred").length;
  const foundNubank = browserEntries.filter(e => e.account === "Nubank").length;
  const foundWillian = browserEntries.filter(e => e.title.includes("Willian") || e.source?.includes("Willian")).length;
  const foundBiel = browserEntries.filter(e => e.title.includes("Biel") || e.source?.includes("Biel")).length;
  const foundClara = browserEntries.filter(e => e.title.includes("Clara") || e.source?.includes("Clara")).length;
  const foundDargam = browserEntries.filter(e => e.title.includes("Dargam") || e.source?.includes("Dargam")).length;
  const foundLuandder = browserEntries.filter(e => e.title.includes("Luandder") || e.source?.includes("Luandder")).length;
  const foundRemedio = browserEntries.filter(e => e.title.toLowerCase().includes("remédio")).length;
  const foundPassagem = browserEntries.filter(e => e.title.toLowerCase().includes("passagem")).length;
  const foundMacbook = browserEntries.filter(e => e.title.toLowerCase().includes("macbook")).length;
  const foundMedcel = browserEntries.filter(e => e.title.toLowerCase().includes("medcel")).length;

  // Smart Merge Function
  function executeSmartMerge() {
    let addedCount = 0;
    let preservedCount = 0;
    const currentBrowserEntries = [...state.entries];
    const newEntries = [...currentBrowserEntries];

    const currentBrowserIds = new Set(currentBrowserEntries.map(e => e.id));

    seedEntries.forEach(seed => {
      if (!currentBrowserIds.has(seed.id)) {
        if (trashMap.has(seed.id)) {
          return;
        }
        newEntries.push({
          ...seed,
          dataQuality: seed.dataQuality || "completo",
          isOfficial: seed.isOfficial ?? true,
          note: (seed.note || "") + " | Recuperado do Seed",
        } as FinanceEntry);
        addedCount++;
      } else {
        const browser = browserMap.get(seed.id);
        if (browser) {
          const diff = 
            seed.title !== browser.title ||
            seed.amount !== browser.amount ||
            seed.dueDate !== browser.dueDate ||
            seed.category !== browser.category ||
            seed.status !== browser.status ||
            seed.account !== browser.account;
          if (diff) {
            recordAudit(browser.id, "updated", [
              { field: "reconciliation_divergence", oldValue: "seed_values", newValue: "browser_values" }
            ], browser);
            preservedCount++;
          }
        }
      }
    });

    if (addedCount > 0) {
      createBackup(state, `Antes da mesclagem inteligente (${addedCount} recuperados)`);
      setState(prev => ({
        ...prev,
        entries: newEntries,
        updatedAt: new Date().toISOString(),
      }));
      pushToast(`${addedCount} lançamentos recuperados do seed com sucesso!`, "success");
    } else {
      pushToast("Todos os lançamentos do seed já estão integrados ou na lixeira.", "info");
    }
  }

  // Financial reconciliation (Agosto 2026)
  const finExpectedUnicred = 801.85;
  const finFoundUnicred = browserEntries
    .filter(e => e.account?.toLowerCase() === "unicred" && e.invoiceMonth === "2026-08")
    .reduce((sum, e) => sum + e.amount, 0);

  const finExpectedNubank = 192.40;
  const finFoundNubank = browserEntries
    .filter(e => e.account?.toLowerCase() === "nubank" && e.invoiceMonth === "2026-08")
    .reduce((sum, e) => sum + e.amount, 0);

  const finExpectedCombined = 994.25;
  const finFoundCombined = finFoundUnicred + finFoundNubank;

  const finExpectedFutureUnicred = 436.66;
  const finFoundFutureUnicred = browserEntries
    .filter(e => e.account?.toLowerCase() === "unicred" && e.dueDate > "2026-08-31" && e.status === "projetado")
    .reduce((sum, e) => sum + e.amount, 0);

  const finExpectedFutureNubank = 138.35;
  const finFoundFutureNubank = browserEntries
    .filter(e => e.account?.toLowerCase() === "nubank" && e.dueDate > "2026-08-31" && e.status === "projetado")
    .reduce((sum, e) => sum + e.amount, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <section className="decision-hero flex-col" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "16px", padding: "28px 32px" }}>
        <span className="eyebrow"><ShieldCheck size={16} /> Diagnóstico e Recuperação</span>
        <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center", flexWrap: "wrap", gap: "20px" }}>
          <div>
            <h2 style={{ fontSize: "14px", fontWeight: 600, color: "var(--muted-2)", margin: 0 }}>Diagnóstico da Integridade dos Dados</h2>
            <p style={{ fontSize: "13px", color: "var(--muted)", margin: "6px 0 0 0" }}>
              Compare as fontes de dados locais e do código para resgatar compras ou faturas perdidas.
            </p>
          </div>
          <button className="primary-button" onClick={executeSmartMerge}>
            <RotateCcw size={16} /> Executar Mesclagem Inteligente
          </button>
        </div>
      </section>

      {/* Grid de Fontes */}
      <section className="stat-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <article className="stat-card">
          <div className="stat-card-heading">
            <span>Base Inicial (Código)</span>
            <Database size={18} />
          </div>
          <strong>{seedEntries.length}</strong>
          <small>Lançamentos no seed.ts</small>
        </article>
        <article className="stat-card">
          <div className="stat-card-heading">
            <span>Navegador (Atual)</span>
            <Database size={18} />
          </div>
          <strong>{browserEntries.length}</strong>
          <small>Lançamentos no localStorage</small>
        </article>
        <article className="stat-card">
          <div className="stat-card-heading">
            <span>Auditoria (Histórico)</span>
            <History size={18} />
          </div>
          <strong>{auditEntries.length}</strong>
          <small>Operações registradas</small>
        </article>
        <article className="stat-card">
          <div className="stat-card-heading">
            <span>Lixeira</span>
            <Trash2 size={18} />
          </div>
        </article>
      </section>

      {/* Reconciliação Financeira de Faturas */}
      <article className="panel">
        <div className="panel-heading">
          <div>
            <span>Reconciliação de Faturas (Agosto 2026)</span>
            <h3>Prova de Integridade e Valores de Controle</h3>
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="entry-table" style={{ width: "100%", fontSize: "12px" }}>
            <thead>
              <tr>
                <th>Cartão / Período</th>
                <th>Esperado (Prints)</th>
                <th>Identificado (Base)</th>
                <th>Divergência</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: "Fatura Unicred (Agosto 2026)", expected: finExpectedUnicred, found: finFoundUnicred },
                { label: "Fatura Nubank (Agosto 2026)", expected: finExpectedNubank, found: finFoundNubank },
                { label: "Combinado (Agosto 2026)", expected: finExpectedCombined, found: finFoundCombined },
                { label: "Futuro Projetado (Unicred)", expected: finExpectedFutureUnicred, found: finFoundFutureUnicred },
                { label: "Futuro Projetado (Nubank)", expected: finExpectedFutureNubank, found: finFoundFutureNubank },
              ].map((g, i) => {
                const diff = g.found - g.expected;
                const isReconciled = Math.abs(diff) < 0.01;
                const statusColor = isReconciled ? "var(--success)" : "var(--danger)";
                const statusLabel = isReconciled ? "Reconciliado" : diff > 0 ? `+ ${brl.format(diff)} extra` : `- ${brl.format(Math.abs(diff))} divergência`;
                return (
                  <tr key={i}>
                    <td><strong>{g.label}</strong></td>
                    <td>{brl.format(g.expected)}</td>
                    <td>{brl.format(g.found)}</td>
                    <td style={{ color: statusColor, fontWeight: "bold" }}>
                      {isReconciled ? "R$ 0,00" : (diff > 0 ? "+" : "-") + brl.format(Math.abs(diff))}
                    </td>
                    <td style={{ color: statusColor, fontWeight: "bold" }}>{statusLabel}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </article>

      {/* Relatório de Reconciliação */}
      <article className="panel">
        <div className="panel-heading">
          <h3>Relatório de Reconciliação dos Dados Originais</h3>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="entry-table" style={{ width: "100%", fontSize: "12px" }}>
            <thead>
              <tr>
                <th>Grupo Financeiro</th>
                <th>Esperado (Seed)</th>
                <th>Encontrado (Navegador)</th>
                <th>Divergência / Ausentes</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: "Fatura Unicred", expected: expectedUnicred, found: foundUnicred },
                { label: "Fatura Nubank", expected: expectedNubank, found: foundNubank },
                { label: "Recebíveis - Willian Júnior", expected: expectedWillian, found: foundWillian },
                { label: "Recebíveis - Biel", expected: expectedBiel, found: foundBiel },
                { label: "Recebíveis - Clara", expected: expectedClara, found: foundClara },
                { label: "Recebíveis - Dargam", expected: expectedDargam, found: foundDargam },
                { label: "Recebíveis - Luandder", expected: expectedLuandder, found: foundLuandder },
                { label: "Compromissos - Remédio", expected: expectedRemedio, found: foundRemedio },
                { label: "Compromissos - Passagem", expected: expectedPassagem, found: foundPassagem },
                { label: "Compromissos - MacBook", expected: expectedMacbook, found: foundMacbook },
                { label: "Compromissos - Curso Medcel", expected: expectedMedcel, found: foundMedcel },
              ].map((g, i) => {
                const diff = g.expected - g.found;
                const statusColor = diff === 0 ? "var(--success)" : diff > 0 ? "var(--warning)" : "var(--info)";
                const statusLabel = diff === 0 ? "Reconciliado" : diff > 0 ? `${diff} ausente(s)` : `${Math.abs(diff)} extra(s)`;
                return (
                  <tr key={i}>
                    <td><strong>{g.label}</strong></td>
                    <td>{g.expected}</td>
                    <td>{g.found}</td>
                    <td style={{ color: statusColor, fontWeight: "bold" }}>{diff}</td>
                    <td style={{ color: statusColor, fontWeight: "bold" }}>{statusLabel}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </article>

      {/* Detalhamento de Contagens */}
      <article className="panel">
        <div className="panel-heading">
          <h3>Distribuição de Dados no Navegador</h3>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", padding: "16px 0" }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "13px" }}>
              <span>Unicred (Cartão):</span>
              <strong>{unicredCount}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "13px" }}>
              <span>Nubank (Cartão):</span>
              <strong>{nubankCount}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "13px" }}>
              <span>Despesas Pessoais (Outros):</span>
              <strong>{personalCount}</strong>
            </div>
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "13px" }}>
              <span>Recebimentos (Entradas):</span>
              <strong>{incomeCount}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "13px" }}>
              <span>Compromissos (Despesas):</span>
              <strong>{expenseCount}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "13px" }}>
              <span>Parcelas Futuras (Projetadas):</span>
              <strong>{futureCount}</strong>
            </div>
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "13px" }}>
              <span>Gastos Pagos pelo Pai:</span>
              <strong>{fatherPaidCount}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "13px" }}>
              <span>Lançamentos Manuais:</span>
              <strong>{manualCount}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "13px" }}>
              <span>Lançamentos Importados:</span>
              <strong>{importedCount}</strong>
            </div>
          </div>
        </div>
      </article>

      {/* Tabela de Duplicatas */}
      {duplicates.length > 0 && (
        <article className="panel" style={{ border: "1px solid var(--danger)" }}>
          <div className="panel-heading">
            <h3 style={{ color: "var(--danger)" }}>⚠️ Possíveis Duplicatas Detectadas ({duplicates.length})</h3>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="entry-table" style={{ width: "100%", fontSize: "12px" }}>
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Data</th>
                  <th>Valor</th>
                  <th>ID A</th>
                  <th>ID B</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {duplicates.map((dup, i) => (
                  <tr key={i}>
                    <td>{dup.entryA.title}</td>
                    <td>{formatDate(dup.entryA.dueDate)}</td>
                    <td>{brl.format(dup.entryA.amount)}</td>
                    <td><code>{dup.entryA.id}</code></td>
                    <td><code>{dup.entryB.id}</code></td>
                    <td>
                      <button 
                        className="reset-button" 
                        style={{ padding: "4px 8px", fontSize: "11px", height: "auto" }}
                        onClick={() => {
                          if (window.confirm("Deseja mesmo excluir o lançamento duplicado (ID B)?")) {
                            setState(prev => ({
                              ...prev,
                              entries: prev.entries.filter(e => e.id !== dup.entryB.id)
                            }));
                            pushToast("Lançamento duplicado removido.", "success");
                          }
                        }}
                      >
                        Remover B
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      )}

      {/* Tabela Comparativa de IDs */}
      <article className="panel">
        <div className="panel-heading">
          <h3>Comparação de Lançamentos (Seed vs Navegador)</h3>
        </div>
        <div style={{ overflowX: "auto", maxHeight: "400px", overflowY: "auto" }}>
          <table className="entry-table" style={{ width: "100%", fontSize: "12px" }}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Descrição</th>
                <th>Valor</th>
                <th>Data</th>
                <th>Status</th>
                <th>Situação</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {comparison.map((comp) => (
                <tr key={comp.id}>
                  <td><code style={{ fontSize: "10px" }}>{comp.id}</code></td>
                  <td>{comp.item?.title || "Sem descrição"}</td>
                  <td>{comp.item ? brl.format(comp.item.amount) : "−"}</td>
                  <td>{comp.item ? formatDate(comp.item.dueDate) : "−"}</td>
                  <td>
                    {comp.item?.status && (
                      <span className={`status-badge status-${statusClass(comp.item as any, new Date().toLocaleDateString("sv-SE"))}`}>
                        {statusLabel(comp.item as any, new Date().toLocaleDateString("sv-SE"))}
                      </span>
                    )}
                  </td>
                  <td style={{ color: comp.color, fontWeight: "bold" }}>{comp.status}</td>
                  <td>
                    {comp.seed && !comp.browser && !comp.trash && (
                      <button
                        className="primary-button compact"
                        style={{ padding: "4px 8px", fontSize: "11px", height: "auto" }}
                        onClick={() => {
                          setState(prev => ({
                            ...prev,
                            entries: [...prev.entries, {
                              ...comp.seed!,
                              dataQuality: comp.seed!.dataQuality || "completo",
                              isOfficial: comp.seed!.isOfficial ?? true,
                              note: (comp.seed!.note || "") + " | Recuperado manualmente",
                            }],
                          }));
                          pushToast("Lançamento recuperado!", "success");
                        }}
                      >
                        Recuperar
                      </button>
                    )}
                    {comp.trash && (
                      <button
                        className="primary-button compact"
                        style={{ padding: "4px 8px", fontSize: "11px", height: "auto" }}
                        onClick={() => {
                          const restored = restoreFromTrash(comp.id);
                          if (restored) {
                            setState(prev => ({
                              ...prev,
                              entries: [...prev.entries, restored as any],
                            }));
                            pushToast("Lançamento restaurado da lixeira!", "success");
                          }
                        }}
                      >
                        Restaurar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}

