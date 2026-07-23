import type { FinanceState, FinanceEntry, Account, InstallmentEditScope } from "../types";
import { financeRepository } from "./local-storage-repository";
import { validateDataIntegrity } from "../validation";
import { recordAudit } from "../audit";
import { trashEntry } from "../trash";

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

function isSettled(entry: FinanceEntry): boolean {
  return entry.status === "recebido" || entry.status === "realizado";
}

function applyCashDelta(accounts: Account[], amountDiff: number): Account[] {
  const cashAccount = accounts.find((a) => a.available);
  if (!cashAccount || amountDiff === 0) return accounts;

  return accounts.map((a) =>
    a.id === cashAccount.id
      ? { ...a, balance: a.balance + amountDiff }
      : a
  );
}

function calculateCashDelta(original: FinanceEntry, next: FinanceEntry): number {
  const originalEffect = original.kind === "income"
    ? (isSettled(original) ? original.amount : 0)
    : (isSettled(original) && original.paidBy !== "father" ? -original.amount : 0);
  const nextEffect = next.kind === "income"
    ? (isSettled(next) ? next.amount : 0)
    : (isSettled(next) && next.paidBy !== "father" ? -next.amount : 0);
  return nextEffect - originalEffect;
}

function parseInstallmentLabel(installment?: string): { installmentNumber?: number; installmentTotal?: number } {
  if (!installment) return {};
  const clean = installment.replace("?", "").trim();
  const match = clean.match(/^(\d+)\/(\d+)$/);
  if (!match) return {};
  return {
    installmentNumber: Number(match[1]),
    installmentTotal: Number(match[2]),
  };
}

function normalizeInstallmentTitle(title: string): string {
  return title.replace(/\s+\d+\/\d+\??$/, "").trim();
}

function getInstallmentTargets(state: FinanceState, original: FinanceEntry, scope: InstallmentEditScope): FinanceEntry[] {
  if (!original.installment || scope === "single") {
    return [original];
  }

  const baseTitle = normalizeInstallmentTitle(original.title);
  const baseAccount = original.account?.toLowerCase() ?? "";
  const originalInstallment = parseInstallmentLabel(original.installment);

  const series = state.entries.filter((entry) => {
    if (!entry.installment) return false;
    if (entry.kind !== original.kind) return false;
    if ((entry.account?.toLowerCase() ?? "") !== baseAccount) return false;
    if (normalizeInstallmentTitle(entry.title) !== baseTitle) return false;

    const parsed = parseInstallmentLabel(entry.installment);
    if (originalInstallment.installmentTotal && parsed.installmentTotal && parsed.installmentTotal !== originalInstallment.installmentTotal) {
      return false;
    }
    return true;
  });

  if (scope === "all") return series;

  return series.filter((entry) => {
    const parsed = parseInstallmentLabel(entry.installment);
    if (originalInstallment.installmentNumber && parsed.installmentNumber) {
      return parsed.installmentNumber >= originalInstallment.installmentNumber;
    }
    return entry.dueDate >= original.dueDate;
  });
}

function buildUpdatedEntry(base: FinanceEntry, updated: Omit<FinanceEntry, "id">, preserveSchedule: boolean): FinanceEntry {
  const next: FinanceEntry = {
    ...base,
    ...updated,
    id: base.id,
    origin: updated.origin ?? base.origin,
  };

  if (preserveSchedule) {
    next.title = base.installment ? `${normalizeInstallmentTitle(updated.title)} ${base.installment}` : updated.title;
    next.dueDate = base.dueDate;
    next.status = base.status;
    next.paymentDate = base.paymentDate;
    next.installment = base.installment;
    next.installmentNumber = base.installmentNumber;
    next.installmentTotal = base.installmentTotal;
    next.invoiceMonth = base.invoiceMonth;
    next.invoiceId = base.invoiceId;
    next.transactionType = base.transactionType;
    next.includeInSpending = base.includeInSpending;
    next.estimatedDate = base.estimatedDate;
    next.isOfficial = updated.isOfficial ?? base.isOfficial;
    next.dataQuality = updated.dataQuality ?? base.dataQuality;
  }

  return next;
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

    let nextAccounts = [...state.accounts];
    const settled = isSettled(newEntry);
    if (settled) {
      nextAccounts = adjustCashBalance(nextAccounts, newEntry.kind, newEntry.paidBy, newEntry.amount);
    }

    const nextState = {
      ...state,
      accounts: nextAccounts,
      entries: [newEntry, ...state.entries],
      updatedAt: new Date().toISOString(),
    };

    const issues = validateDataIntegrity(nextState);
    const criticals = issues.filter((i) => i.type === "error");
    if (criticals.length > 0) {
      throw new Error(`Erro de integridade ao criar lançamento: ${criticals[0].message}`);
    }

    financeRepository.saveState(nextState);
    setState(nextState);
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

      if (isSettled(newEntry)) {
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

    const issues = validateDataIntegrity(nextState);
    const criticals = issues.filter((i) => i.type === "error");
    if (criticals.length > 0) {
      throw new Error(`Erro de integridade ao criar lançamentos: ${criticals[0].message}`);
    }

    financeRepository.saveState(nextState);
    setState(nextState);

    for (const ne of createdList) {
      recordAudit(ne.id, "created", [], ne);
    }

    return createdList;
  },

  updateEntry(
    state: FinanceState,
    entryId: string,
    updated: Omit<FinanceEntry, "id">,
    setState: React.Dispatch<React.SetStateAction<FinanceState>>,
    installmentScope: InstallmentEditScope = "single"
  ): FinanceEntry {
    const original = state.entries.find((e) => e.id === entryId);
    if (!original) throw new Error("Lançamento não encontrado.");

    const buildChanges = (before: FinanceEntry, after: FinanceEntry) => {
      const changes: Array<{ field: string; oldValue: any; newValue: any }> = [];
      Object.keys(before).forEach((k) => {
        const key = k as keyof FinanceEntry;
        if (before[key] !== after[key]) {
          changes.push({ field: key, oldValue: before[key], newValue: after[key] });
        }
      });
      return changes;
    };

    if (!original.installment || installmentScope === "single") {
      const newEntry = buildUpdatedEntry(original, updated, false);
      let paymentDate = newEntry.paymentDate || original.paymentDate;
      if (isSettled(newEntry) && !isSettled(original)) {
        paymentDate = new Date().toLocaleDateString("sv-SE");
      } else if (!isSettled(newEntry)) {
        paymentDate = undefined;
      }
      newEntry.paymentDate = paymentDate;

      const nextAccounts = applyCashDelta([...state.accounts], calculateCashDelta(original, newEntry));
      const nextState = {
        ...state,
        accounts: nextAccounts,
        entries: state.entries.map((e) => (e.id === entryId ? newEntry : e)),
        updatedAt: new Date().toISOString(),
      };

      const issues = validateDataIntegrity(nextState);
      const criticals = issues.filter((i) => i.type === "error");
      if (criticals.length > 0) {
        throw new Error(`Erro de integridade ao editar lançamento: ${criticals[0].message}`);
      }

      financeRepository.saveState(nextState);
      setState(nextState);
      recordAudit(entryId, "updated", buildChanges(original, newEntry), newEntry);
      return newEntry;
    }

    const targets = getInstallmentTargets(state, original, installmentScope);
    const targetIds = new Set(targets.map((entry) => entry.id));
    const updatedTargets = new Map<string, FinanceEntry>();
    let cashDelta = 0;

    const nextEntries = state.entries.map((entry) => {
      if (!targetIds.has(entry.id)) return entry;
      const nextEntry = buildUpdatedEntry(entry, updated, true);
      cashDelta += calculateCashDelta(entry, nextEntry);
      updatedTargets.set(entry.id, nextEntry);
      return nextEntry;
    });

    const nextAccounts = applyCashDelta([...state.accounts], cashDelta);
    const nextState = {
      ...state,
      accounts: nextAccounts,
      entries: nextEntries,
      updatedAt: new Date().toISOString(),
    };

    const issues = validateDataIntegrity(nextState);
    const criticals = issues.filter((i) => i.type === "error");
    if (criticals.length > 0) {
      throw new Error(`Erro de integridade ao editar lançamento: ${criticals[0].message}`);
    }

    financeRepository.saveState(nextState);
    setState(nextState);

    for (const entry of targets) {
      const nextEntry = updatedTargets.get(entry.id);
      if (!nextEntry) continue;
      recordAudit(entry.id, "updated", buildChanges(entry, nextEntry), nextEntry);
    }

    return updatedTargets.get(entryId) ?? original;
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

    trashEntry(entry);

    let nextAccounts = [...state.accounts];
    if (isSettled(entry)) {
      nextAccounts = adjustCashBalance(nextAccounts, entry.kind, entry.paidBy, -entry.amount);
    }

    const nextState = {
      ...state,
      accounts: nextAccounts,
      entries: state.entries.filter((e) => e.id !== entryId),
      updatedAt: new Date().toISOString(),
    };

    financeRepository.saveState(nextState);
    setState(nextState);
    recordAudit(entryId, "deleted", [], entry);
  },

  restoreEntry(
    state: FinanceState,
    entry: FinanceEntry,
    setState: React.Dispatch<React.SetStateAction<FinanceState>>
  ): void {
    let nextAccounts = [...state.accounts];
    if (isSettled(entry)) {
      nextAccounts = adjustCashBalance(nextAccounts, entry.kind, entry.paidBy, entry.amount);
    }

    const nextState = {
      ...state,
      accounts: nextAccounts,
      entries: [entry, ...state.entries],
      updatedAt: new Date().toISOString(),
    };

    financeRepository.saveState(nextState);
    setState(nextState);
    recordAudit(entry.id, "restored", [], entry);
  },

  settleEntry(
    state: FinanceState,
    entryId: string,
    setState: React.Dispatch<React.SetStateAction<FinanceState>>
  ): FinanceEntry {
    const entry = state.entries.find((e) => e.id === entryId);
    if (!entry) throw new Error("Lançamento não encontrado.");

    if (isSettled(entry)) {
      return entry;
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

    financeRepository.saveState(nextState);
    setState(nextState);

    recordAudit(entryId, "settled", [
      { field: "status", oldValue: entry.status, newValue: newStatus },
      { field: "paymentDate", oldValue: null, newValue: paymentDate },
    ], updatedEntry);

    return updatedEntry;
  },
};
