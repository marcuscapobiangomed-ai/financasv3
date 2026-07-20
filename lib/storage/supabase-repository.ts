import type { FinanceRepository } from "./finance-repository";
import type { FinanceState, FinanceEntry, Invoice } from "../types";
import { supabase } from "../supabase";

export class SupabaseFinanceRepository implements FinanceRepository {
  userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  async loadState(): Promise<FinanceState> {
    // 1. Meta do perfil
    const { data: profile } = await supabase
      .from("profiles")
      .select("goal")
      .eq("id", this.userId)
      .maybeSingle();

    const goal = profile ? Number(profile.goal) / 100 : 10000;

    // 2. Contas
    const { data: accountsData } = await supabase
      .from("accounts")
      .select("*")
      .eq("user_id", this.userId);

    const accounts = (accountsData || []).map((a: any) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      balance: Number(a.balance_cents) / 100,
      available: a.available,
      note: a.note || undefined,
    }));

    // 3. Faturas
    const { data: invoicesData } = await supabase
      .from("invoices")
      .select("*")
      .eq("user_id", this.userId);

    const invoices: Invoice[] = (invoicesData || []).map((i: any) => ({
      id: i.id,
      cardId: i.card_id,
      referenceMonth: i.reference_month,
      closingDate: i.closing_date || "",
      dueDate: i.due_date || "",
      officialTotal: Number(i.official_total_cents) / 100,
      identifiedSubtotal: Number(i.subtotal_identified_cents) / 100,
      status: (i.status as "open" | "closed" | "paid" | "partial") || "open",
      dataQuality: (i.data_quality as "completo" | "parcial" | "estimado") || "parcial",
      sourceFileId: i.source_file_id || undefined,
    }));

    // 4. Lançamentos
    const { data: transactionsData } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", this.userId)
      .is("deleted_at", null);

    const entries: FinanceEntry[] = (transactionsData || []).map((t: any) => ({
      id: t.id,
      title: t.title,
      amount: Number(t.amount_cents) / 100,
      kind: t.kind as "income" | "expense",
      dueDate: t.due_date,
      paymentDate: t.payment_date || undefined,
      status: t.status as any,
      category: t.category,
      account: t.account_id || undefined,
      paidBy: t.paid_by as "me" | "father",
      origin: t.origin as any,
      dataQuality: t.data_quality as any,
      isOfficial: t.is_official,
      note: t.note || undefined,
      invoiceMonth: t.invoice_month || undefined,
      installment: t.installment || undefined,
    }));

    return {
      schemaVersion: 4,
      goal,
      accounts,
      entries,
      invoices,
      updatedAt: new Date().toISOString(),
    };
  }

  async saveState(state: FinanceState): Promise<void> {
    const now = new Date().toISOString();

    // Helper: lança erro se Supabase retornar error
    const check = (error: any, ctx: string) => {
      if (error) throw new Error(`[Supabase] ${ctx}: ${error.message || JSON.stringify(error)}`);
    };

    // 1. Meta / perfil
    const { error: profileErr } = await supabase
      .from("profiles")
      .upsert([{ id: this.userId, goal: Math.round(state.goal * 100), updated_at: now }]);
    check(profileErr, "profiles.upsert");

    // 2. Contas
    if (state.accounts.length > 0) {
      const { error: accErr } = await supabase.from("accounts").upsert(
        state.accounts.map((a) => ({
          id: a.id,
          user_id: this.userId,
          name: a.name,
          type: a.type,
          balance_cents: Math.round(a.balance * 100),
          available: a.available,
          note: a.note || null,
          updated_at: now,
        }))
      );
      check(accErr, "accounts.upsert");
    }

    // 3. Faturas
    if (state.invoices && state.invoices.length > 0) {
      const { error: invErr } = await supabase.from("invoices").upsert(
        state.invoices.map((i) => ({
          id: i.id,
          card_id: i.cardId,
          user_id: this.userId,
          reference_month: i.referenceMonth,
          closing_date: i.closingDate || null,
          due_date: i.dueDate || null,
          official_total_cents: Math.round((i.officialTotal ?? 0) * 100),
          subtotal_identified_cents: Math.round(i.identifiedSubtotal * 100),
          status: i.status,
          data_quality: i.dataQuality,
          source_file_id: i.sourceFileId || null,
          updated_at: now,
        }))
      );
      check(invErr, "invoices.upsert");
    }

    // 4. Lançamentos em lotes de 100
    if (state.entries.length > 0) {
      const BATCH = 100;
      const rows = state.entries.map((e) => ({
        id: e.id,
        user_id: this.userId,
        title: e.title,
        amount_cents: Math.round(e.amount * 100),
        kind: e.kind,
        due_date: e.dueDate,
        payment_date: e.paymentDate || null,
        status: e.status,
        category: e.category,
        account_id: e.account || null,
        paid_by: e.paidBy,
        origin: e.origin,
        data_quality: e.dataQuality || "high",
        is_official: e.isOfficial,
        note: e.note || null,
        invoice_month: e.invoiceMonth || null,
        installment: e.installment || null,
        updated_at: now,
      }));

      for (let i = 0; i < rows.length; i += BATCH) {
        const { error: txErr } = await supabase
          .from("transactions")
          .upsert(rows.slice(i, i + BATCH));
        check(txErr, `transactions.upsert lote ${Math.floor(i / BATCH) + 1}`);
      }

      // 5. Exclusão lógica de entradas removidas localmente
      const activeIds = state.entries.map((e) => e.id);
      const { data: remoteActive, error: listErr } = await supabase
        .from("transactions")
        .select("id")
        .eq("user_id", this.userId)
        .is("deleted_at", null);
      check(listErr, "transactions.select(ids)");

      const remoteIds = (remoteActive || []).map((r: any) => r.id);
      const toDelete = remoteIds.filter((id: string) => !activeIds.includes(id));

      if (toDelete.length > 0) {
        const { error: delErr } = await supabase
          .from("transactions")
          .update({ deleted_at: new Date().toISOString() })
          .eq("user_id", this.userId)
          .in("id", toDelete);
        check(delErr, "transactions.soft-delete");
      }
    }
  }

  async createBackup(state: FinanceState, label?: string) {
    const { createBackup: localCreate } = await import("../backup");
    return localCreate(state, label);
  }

  async restoreBackup(backupId: string): Promise<FinanceState | null> {
    const { restoreFromBackup } = await import("../backup");
    return restoreFromBackup(backupId);
  }

  async loadBackupList() {
    const { loadBackupList } = await import("../backup");
    return loadBackupList();
  }
}
