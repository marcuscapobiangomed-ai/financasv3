export type EntryKind = "income" | "expense";
export type EntryStatus =
  | "realizado"
  | "a_pagar"
  | "projetado"
  | "recebido"
  | "a_receber_confirmado"
  | "a_receber_incerto";
export type PaidBy = "me" | "father" | "shared" | "reimbursable";
export type EntryOrigin =
  | "seed"
  | "manual"
  | "csv"
  | "pdf"
  | "image"
  | "migration"
  | "recovery"
  | "recurrence";

export type DataQuality = "completo" | "parcial" | "estimado";

export type Account = {
  id: string;
  name: string;
  type: "cash" | "reserve" | "bank" | "wallet";
  balance: number;
  available: boolean;
  note?: string;
};

export type FinanceEntry = {
  id: string;
  title: string;
  amount: number;
  kind: EntryKind;
  dueDate: string;
  status: EntryStatus;
  category: string;
  source?: string;
  account?: string;
  paidBy?: PaidBy;
  recurring?: boolean;
  installment?: string;
  estimatedDate?: boolean;
  note?: string;
  purchaseDate?: string;
  invoiceMonth?: string;
  paymentDate?: string;
  dataQuality?: DataQuality;
  isOfficial?: boolean;
  origin?: EntryOrigin;
};

export type Invoice = {
  id: string;
  cardId: string;
  referenceMonth: string;
  closingDate: string;
  dueDate: string;
  officialTotal?: number;
  identifiedSubtotal: number;
  status: "open" | "closed" | "paid" | "partial";
  dataQuality: "completo" | "parcial" | "estimado";
  sourceFileId?: string;
};

export type FinanceState = {
  goal: number;
  accounts: Account[];
  entries: FinanceEntry[];
  invoices?: Invoice[];
  updatedAt: string;
  schemaVersion?: number;
};

export type ViewKey = "overview" | "receivables" | "cards" | "spending" | "goal" | "imports" | "tools" | "logs" | "quality" | "corrections" | "recovery_diagnostics" | "all_entries";

export type InvoiceView = {
  id: string;
  card: string;
  month: string;
  closingDate: string;
  dueDate: string;
  officialTotal?: number;
  identifiedSubtotal: number;
  paidAmount: number;
  status: "open" | "closed" | "paid" | "partial";
  entries: FinanceEntry[];
  dataQuality: DataQuality;
};
