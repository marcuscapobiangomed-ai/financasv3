import { describe, it, expect, beforeEach } from "vitest";
import type { FinanceState, FinanceEntry } from "../lib/types";
import { getSummary, getSafeToSpend } from "../lib/finance";

// Mocking localStorage for backup/trash/audit modules
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem(key: string) {
      return store[key] || null;
    },
    setItem(key: string, value: string) {
      store[key] = String(value);
    },
    clear() {
      store = {};
    },
    removeItem(key: string) {
      delete store[key];
    }
  };
})();

Object.defineProperty(global, "localStorage", { value: localStorageMock, writable: true });

// Import the modules to test
import { trashEntry, restoreFromTrash, getTrashItems } from "../lib/trash";
import { recordAudit, getAuditTrail } from "../lib/audit";
import { createBackup, restoreFromBackup } from "../lib/backup";

describe("Integration Flows", () => {
  let state: FinanceState;

  beforeEach(() => {
    localStorageMock.clear();
    state = {
      schemaVersion: 4,
      goal: 10000,
      accounts: [
        { id: "acc-1", name: "Pix", type: "cash", balance: 1000, available: true }
      ],
      entries: [
        { id: "ent-1", title: "Salário", amount: 5000, kind: "income", dueDate: "2026-08-01", status: "a_receber_confirmado", category: "Trabalho" }
      ],
      updatedAt: new Date().toISOString(),
    };
  });

  it("Fluxo 1 — Novo gasto e persistência lógica", () => {
    // 1. Criar gasto
    const newGasto: FinanceEntry = {
      id: "ent-2",
      title: "Supermercado",
      amount: 400,
      kind: "expense",
      dueDate: "2026-08-05",
      status: "a_pagar",
      category: "Alimentação",
    };
    state.entries.push(newGasto);

    // 2. Verificar totais pós-gasto
    const summary = getSummary(state, "2026-08");
    expect(summary.pendingExpenses).toBe(400);

    // 3. Verificar valor seguro para gastar
    const safeData = getSafeToSpend(state, "2026-08-01", 100);
    expect(safeData.safeToSpend).toBe(5900);
  });

  it("Fluxo 2 — Edição com histórico de auditoria", () => {
    const entry = state.entries[0];
    
    // 1. Gravar auditoria para alteração de valor
    const updatedEntry = { ...entry, amount: 6000 };
    recordAudit(entry.id, "updated", [{ field: "amount", oldValue: 5000, newValue: 6000 }], updatedEntry);

    // 2. Aplicar edição no estado
    state.entries = state.entries.map(e => e.id === entry.id ? updatedEntry : e);

    // 3. Verificar recálculo
    const summary = getSummary(state, "2026-08");
    expect(summary.pendingIncome).toBe(6000);

    // 4. Verificar histórico de auditoria
    const logs = getAuditTrail(entry.id);
    expect(logs.length).toBe(1);
    expect(logs[0].action).toBe("updated");
    expect(logs[0].changes[0].newValue).toBe(6000);
  });

  it("Fluxo 3 — Exclusão para lixeira e restauração", () => {
    const entry = state.entries[0];

    // 1. Excluir item (enviar para a lixeira)
    trashEntry(entry);
    state.entries = state.entries.filter(e => e.id !== entry.id);

    // 2. Confirmar remoção dos cálculos
    const summaryDeleted = getSummary(state, "2026-08");
    expect(summaryDeleted.pendingIncome).toBe(0);

    // 3. Abrir lixeira e restaurar
    const trashItems = getTrashItems();
    expect(trashItems.length).toBe(1);
    
    const restored = restoreFromTrash(trashItems[0].id) as FinanceEntry;
    expect(restored).toBeDefined();
    expect(restored.id).toBe(entry.id);
    
    state.entries.push(restored);

    // 4. Confirmar retorno dos totais
    const summaryRestored = getSummary(state, "2026-08");
    expect(summaryRestored.pendingIncome).toBe(5000);
  });

  it("Fluxo 4 — Cálculo da Fatura por Mês de Referência", () => {
    // 1. Adicionar compras no cartão Nubank
    state.entries.push(
      { id: "nub-1", title: "iFood", amount: 60, kind: "expense", dueDate: "2026-08-10", invoiceMonth: "2026-08", account: "Nubank", status: "a_pagar", category: "Alimentação" },
      { id: "nub-2", title: "Netflix", amount: 40, kind: "expense", dueDate: "2026-08-10", invoiceMonth: "2026-08", account: "Nubank", status: "a_pagar", category: "Lazer" },
      { id: "nub-3", title: "Uber", amount: 30, kind: "expense", dueDate: "2026-08-10", invoiceMonth: "2026-09", account: "Nubank", status: "a_pagar", category: "Transporte" }
    );

    // 2. Calcular subtotal Nubank Agosto/2026
    const nubankAgosto = state.entries
      .filter(e => e.account === "Nubank" && e.invoiceMonth === "2026-08")
      .reduce((sum, e) => sum + e.amount, 0);
    expect(nubankAgosto).toBe(100);

    // 3. Editar item e ver atualização
    state.entries = state.entries.map(e => e.id === "nub-1" ? { ...e, amount: 70 } : e);
    const nubankAgostoUpdated = state.entries
      .filter(e => e.account === "Nubank" && e.invoiceMonth === "2026-08")
      .reduce((sum, e) => sum + e.amount, 0);
    expect(nubankAgostoUpdated).toBe(110);
  });

  it("Fluxo 5 — Exportação e importação de Backup completo", () => {
    // 1. Criar backup do estado original
    createBackup(state, "Backup de Integração");

    // 2. Modificar dados
    state.goal = 20000;
    state.entries = [];

    // 3. Restaurar backup
    const backupList = JSON.parse(localStorage.getItem("meu-financeiro-backups") || "[]");
    expect(backupList.length).toBe(1);

    const restoredState = restoreFromBackup(backupList[0].id) as FinanceState;
    expect(restoredState).toBeDefined();
    expect(restoredState.goal).toBe(10000);
    expect(restoredState.entries.length).toBe(1);
    expect(restoredState.entries[0].title).toBe("Salário");
  });
});
