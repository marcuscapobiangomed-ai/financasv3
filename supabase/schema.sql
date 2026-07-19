create extension if not exists "pgcrypto";

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('cash','reserve','bank','wallet')),
  balance numeric(14,2) not null default 0,
  available boolean not null default true,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.finance_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  amount numeric(14,2) not null check (amount >= 0),
  kind text not null check (kind in ('income','expense')),
  due_date date not null,
  status text not null check (status in ('received','pending','overdue','planned')),
  category text not null default 'Outros',
  source text,
  account text,
  paid_by text check (paid_by in ('me','father','shared','reimbursable')),
  recurring boolean not null default false,
  installment text,
  estimated_date boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.accounts enable row level security;
alter table public.finance_entries enable row level security;

create policy "users_manage_own_accounts" on public.accounts
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users_manage_own_entries" on public.finance_entries
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
