import type { FinanceState, FinanceEntry, Account } from "../types";
import { financeRepository } from "./local-storage-repository";
import { validateDataIntegrity } from "../validation";
import { recordAudit } from "../audit";
import { trashEntry } from "../trash";

// Helper to calculate available cash adjustments
function adjustCashBalance(
  accounts: Account[],
  kind: "income" | "expense",
  paidBy: string | undefined,
  amountDiff: number
): Account[] {
  const cashAccount = accounts.find((a) => a.available);
  if (!cashAccount || amountDiff === 0 || paidBy === "father") return accounts;

  return accounts.map((a) =>
    a.id === cashAccount.id
      ? { ...a, balance: a.balance + (kind === "income" ? amountDiff : -amountDiff) }
      : a
  );
}

export const financeCommandService = {
  createEntry(
    state: FinanceState,
    entry: Omit<FinanceEntry, "id">,
    setState: React.Dispatch<React.SetStateAction<FinanceState>>
  ): FinanceEntry {
    const newEntry: FinanceEntry = {
      ...entry,
      id: `entry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };

    // Ajustar caixa se o lançamento for criado já liquidado
    let nextAccounts = [...state.accounts];
    const isSettled = newEntry.status === "recebido" || newEntry.status === "realizado";
    if (isSettled) {
      nextAccounts = adjustCashBalance(nextAccounts, newEntry.kind, newEntry.paidBy, newEntry.amount);
    }

    const nextState = {
      ...state,
      accounts: nextAccounts,
      entries: [newEntry, ...state.entries],
      updatedAt: new Date().toISOString(),
    };

    // Validar integridade antes de salvar
    const issues = validateDataIntegrity(nextState);
    const criticals = issues.filter((i) => i.type === "error");
    if (criticals.length > 0) {
      throw new Error(`Erro de integridade ao criar lançamento: ${criticals[0].message}`);
    }

    // Salvar e atualizar estado
    financeRepository.saveState(nextState);
    setState(nextState);

    // Auditoria
    recordAudit(newEntry.id, "created", [], newEntry);

    return newEntry;
  },

  createEntries(
    state: FinanceState,
    newEntriesList: Omit<FinanceEntry, "id">[],
    setState: React.Dispatch<React.SetStateAction<FinanceState>>
  ): FinanceEntry[] {
    let nextAccounts = [...state.accounts];
    const createdList: FinanceEntry[] = [];
    const nextEntries = [...state.entries];

    for (const entry of newEntriesList) {
      const newEntry: FinanceEntry = {
        ...entry,
        id: `entry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      };

      const isSettled = newEntry.status === "recebido" || newEntry.status === "realizado";
      if (isSettled) {
        nextAccounts = adjustCashBalance(nextAccounts, newEntry.kind, newEntry.paidBy, newEntry.amount);
      }

      nextEntries.unshift(newEntry);
      createdList.push(newEntry);
    }

    const nextState = {
      ...state,
      accounts: nextAccounts,
      entries: nextEntries,
      updatedAt: new Date().toISOString(),
    };

    // Validar integridade
    const issues = validateDataIntegrity(nextState);
    const criticals = issues.filter((i) => i.type === "error");
    if (criticals.length > 0) {
      throw new Error(`Erro de integridade ao criar lançamentos: ${criticals[0].message}`);
    }

    // Salvar e atualizar estado
    financeRepository.saveState(nextState);
    setState(nextState);

    // Auditoria
    for (const ne of createdList) {
      recordAudit(ne.id, "created", [], ne);
    }

    return createdList;
  },

  updateEntry(
    state: FinanceState,
    entryId: string,
    updated: Omit<FinanceEntry, "id">,
    setState: React.Dispatch<React.SetStateAction<FinanceState>>
  ): FinanceEntry {
    const original = state.entries.find((e) => e.id === entryId);
    if (!original) throw new Error("Lançamento não encontrado.");

    const newEntry: FinanceEntry = { ...updated, id: entryId };

    // Calcular diferença de caixa
    let balanceDiff = 0;
    if (original.kind === "income" && original.status === "recebido" && newEntry.status !== "recebido") {
      balanceDiff -= original.amount;
    } else if (original.kind === "income" && original.status !== "recebido" && newEntry.status === "recebido") {
      balanceDiff += newEntry.amount;
    } else if (original.kind === "income" && original.status === "recebido" && newEntry.status === "recebido") {
      balanceDiff += (newEntry.amount - original.amount);
    }

    if (original.kind === "expense" && original.paidBy !== "father" && original.status === "realizado" && newEntry.status !== "realizado") {
      balanceDiff += original.amount;
    } else if (original.kind === "expense" && newEntry.paidBy !== "father" && original.status !== "realizado" && newEntry.status === "realizado") {
      balanceDiff -= newEntry.amount;
    } else if (original.kind === "expense" && original.paidBy !== "father" && newEntry.paidBy !== "father" && original.status === "realizado" && newEntry.status === "realizado") {
      balanceDiff -= (newEntry.amount - original.amount);
    }

    const nextAccounts = adjustCashBalance([...state.accounts], original.kind, original.paidBy, balanceDiff);

    // Ajustar data de pagamento de forma inteligente
    let paymentDate = newEntry.paymentDate || original.paymentDate;
    if ((newEntry.status === "recebido" || newEntry.status === "realizado") && 
        !(original.status === "recebido" || original.status === "realizado")) {
      paymentDate = new Date().toLocaleDateString("sv-SE");
    } else if (newEntry.status !== "recebido" && newEntry.status !== "realizado") {
      paymentDate = undefined;
    }
    newEntry.paymentDate = paymentDate;

    const nextState = {
      ...state,
      accounts: nextAccounts,
      entries: state.entries.map((e) => (e.id === entryId ? newEntry : e)),
      updatedAt: new Date().toISOString(),
    };

    // Validar integridade
    const issues = validateDataIntegrity(nextState);
    const criticals = issues.filter((i) => i.type === "error");
    if (criticals.length > 0) {
      throw new Error(`Erro de integridade ao editar lançamento: ${criticals[0].message}`);
    }

    // Salvar e atualizar estado
    financeRepository.saveState(nextState);
    setState(nextState);

    // Auditoria com delta-changes
    const changes: Array<{ field: string; oldValue: any; newValue: any }> = [];
    Object.keys(original).forEach((k) => {
      const key = k as keyof FinanceEntry;
      if (original[key] !== newEntry[key]) {
        changes.push({ field: key, oldValue: original[key], newValue: newEntry[key] });
      }
    });

    recordAudit(entryId, "updated", changes, newEntry);

    return newEntry;
  },

  duplicateEntry(
    state: FinanceState,
    entryId: string,
    setState: React.Dispatch<React.SetStateAction<FinanceState>>
  ): FinanceEntry {
    const entry = state.entries.find((e) => e.id === entryId);
    if (!entry) throw new Error("Lançamento não encontrado.");

    const duplicated: Omit<FinanceEntry, "id"> = {
      ...entry,
      title: `${entry.title} (Cópia)`,
      origin: "manual",
    };

    return this.createEntry(state, duplicated, setState);
  },

  removeEntry(
    state: FinanceState,
    entryId: string,
    setState: React.Dispatch<React.SetStateAction<FinanceState>>
  ): void {
    const entry = state.entries.find((e) => e.id === entryId);
    if (!entry) throw new Error("Lançamento não encontrado.");

    // Lixeira
    trashEntry(entry);

    // Se o lançamento estava liquidado, reverter efeito de caixa
    let nextAccounts = [...state.accounts];
    const isSettled = entry.status === "recebido" || entry.status === "realizado";
    if (isSettled) {
      nextAccounts = adjustCashBalance(nextAccounts, entry.kind, entry.paidBy, -entry.amount);
    }

    const nextState = {
      ...state,
      accounts: nextAccounts,
      entries: state.entries.filter((e) => e.id !== entryId),
      updatedAt: new Date().toISOString(),
    };

    // Salvar e atualizar estado
    financeRepository.saveState(nextState);
    setState(nextState);

    // Auditoria
    recordAudit(entryId, "deleted", [], entry);
  },

  restoreEntry(
    state: FinanceState,
    entry: FinanceEntry,
    setState: React.Dispatch<React.SetStateAction<FinanceState>>
  ): void {
    // Re-aplicar efeito de caixa se restaurado já liquidado
    let nextAccounts = [...state.accounts];
    const isSettled = entry.status === "recebido" || entry.status === "realizado";
    if (isSettled) {
      nextAccounts = adjustCashBalance(nextAccounts, entry.kind, entry.paidBy, entry.amount);
    }

    const nextState = {
      ...state,
      accounts: nextAccounts,
      entries: [entry, ...state.entries],
      updatedAt: new Date().toISOString(),
    };

    // Salvar e atualizar estado
    financeRepository.saveState(nextState);
    setState(nextState);

    // Auditoria
    recordAudit(entry.id, "restored", [], entry);
  },

  settleEntry(
    state: FinanceState,
    entryId: string,
    setState: React.Dispatch<React.SetStateAction<FinanceState>>
  ): FinanceEntry {
    const entry = state.entries.find((e) => e.id === entryId);
    if (!entry) throw new Error("Lançamento não encontrado.");

    if (entry.status === "recebido" || entry.status === "realizado") {
      return entry; // Já liquidado
    }

    const newStatus = entry.kind === "income" ? "recebido" : "realizado";
    const paymentDate = new Date().toLocaleDateString("sv-SE");
    const updatedEntry: FinanceEntry = {
      ...entry,
      status: newStatus,
      paymentDate,
    };

    const nextAccounts = adjustCashBalance([...state.accounts], entry.kind, entry.paidBy, entry.amount);
    const nextState = {
      ...state,
      accounts: nextAccounts,
      entries: state.entries.map((e) => (e.id === entryId ? updatedEntry : e)),
      updatedAt: new Date().toISOString(),
    };

    // Salvar e atualizar estado
    financeRepository.saveState(nextState);
    setState(nextState);

    // Auditoria
    recordAudit(entryId, "settled", [
      { field: "status", oldValue: entry.status, newValue: newStatus },
      { field: "paymentDate", oldValue: null, newValue: paymentDate },
    ], updatedEntry);

    return updatedEntry;
  },
};
