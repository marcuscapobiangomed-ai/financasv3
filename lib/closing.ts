const CLOSING_KEY = "meu-financeiro-closing";

export type ClosingStatus = "open" | "in_review" | "closed";

export type MonthClose = {
  period: string;
  status: ClosingStatus;
  closedAt?: string;
  checklist: ClosingChecklist;
  notes?: string;
};

export type ClosingChecklist = {
  invoicesImported: boolean;
  balancesVerified: boolean;
  reconciled: boolean;
  savingsRecorded: boolean;
  spendingReviewed: boolean;
  alertsReviewed: boolean;
};

const DEFAULT_CHECKLIST: ClosingChecklist = {
  invoicesImported: false,
  balancesVerified: false,
  reconciled: false,
  savingsRecorded: false,
  spendingReviewed: false,
  alertsReviewed: false,
};

export function getMonthClose(period: string): MonthClose {
  try {
    const raw = localStorage.getItem(CLOSING_KEY);
    const closes: Record<string, MonthClose> = raw ? JSON.parse(raw) : {};
    return closes[period] ?? { period, status: "open", checklist: { ...DEFAULT_CHECKLIST } };
  } catch {
    return { period, status: "open", checklist: { ...DEFAULT_CHECKLIST } };
  }
}

export function saveChecklist(period: string, checklist: ClosingChecklist) {
  try {
    const raw = localStorage.getItem(CLOSING_KEY);
    const closes: Record<string, MonthClose> = raw ? JSON.parse(raw) : {};
    closes[period] = { ...closes[period], period, checklist, status: "in_review" };
    localStorage.setItem(CLOSING_KEY, JSON.stringify(closes));
  } catch { /* ignore */ }
}

export function closeMonth(period: string, notes?: string) {
  try {
    const raw = localStorage.getItem(CLOSING_KEY);
    const closes: Record<string, MonthClose> = raw ? JSON.parse(raw) : {};
    closes[period] = {
      period,
      status: "closed",
      closedAt: new Date().toISOString(),
      checklist: closes[period]?.checklist ?? { ...DEFAULT_CHECKLIST },
      notes,
    };
    localStorage.setItem(CLOSING_KEY, JSON.stringify(closes));
  } catch { /* ignore */ }
}

export function reopenMonth(period: string) {
  try {
    const raw = localStorage.getItem(CLOSING_KEY);
    const closes: Record<string, MonthClose> = raw ? JSON.parse(raw) : {};
    if (closes[period]) {
      closes[period].status = "open";
      closes[period].closedAt = undefined;
      localStorage.setItem(CLOSING_KEY, JSON.stringify(closes));
    }
  } catch { /* ignore */ }
}

export function getAllCloses(): MonthClose[] {
  try {
    const raw = localStorage.getItem(CLOSING_KEY);
    if (!raw) return [];
    const closes: Record<string, MonthClose> = JSON.parse(raw);
    return Object.values(closes).sort((a, b) => b.period.localeCompare(a.period));
  } catch { return []; }
}
