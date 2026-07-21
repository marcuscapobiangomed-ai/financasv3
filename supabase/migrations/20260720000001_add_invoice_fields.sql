-- Add new fields to transactions table for v5 schema

alter table public.transactions
  add column if not exists invoice_id text,
  add column if not exists transaction_type text,
  add column if not exists installment_number integer,
  add column if not exists installment_total integer,
  add column if not exists include_in_spending boolean not null default true;
