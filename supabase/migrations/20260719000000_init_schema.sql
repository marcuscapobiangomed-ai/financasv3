-- Script de Inicialização de Schema e RLS — financasv3

-- 1. EXTENSÕES
create extension if not exists "uuid-ossp";

-- 2. TABELA: profiles
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  goal bigint not null default 1000000, -- valor em centavos (R$ 10.000,00)
  updated_at timestamp with time zone default now()
);

-- Trigger para criar perfil automaticamente após signup no auth.users
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, goal)
  values (new.id, 1000000);
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 3. TABELA: accounts
create table if not exists public.accounts (
  id text not null,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  type text not null,
  balance_cents bigint not null default 0,
  available boolean not null default true,
  note text,
  updated_at timestamp with time zone default now(),
  primary key (id, user_id)
);

-- 4. TABELA: cards
create table if not exists public.cards (
  id text not null,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  closing_day integer not null,
  due_day integer not null,
  credit_limit_cents bigint,
  payment_account_id text,
  status text not null default 'active',
  updated_at timestamp with time zone default now(),
  primary key (id, user_id)
);

-- 5. TABELA: invoices
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  card_id text not null,
  reference_month text not null, -- formato 'YYYY-MM'
  official_total_cents bigint not null default 0,
  subtotal_identified_cents bigint not null default 0,
  amount_paid_cents bigint not null default 0,
  status text not null default 'open', -- 'open', 'closed', 'paid'
  confidence text not null default 'média',
  source_file_id text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint unique_user_card_month unique (user_id, card_id, reference_month)
);

-- 6. TABELA: transactions (lançamentos)
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  title text not null,
  amount_cents bigint not null,
  kind text not null, -- 'income' ou 'expense'
  due_date text not null, -- formato 'YYYY-MM-DD'
  payment_date text, -- formato 'YYYY-MM-DD'
  status text not null, -- 'recebido', 'realizado', 'a_pagar', 'projetado', 'a_receber_confirmado', 'a_receber_incerto'
  category text not null,
  account_id text,
  paid_by text not null default 'me', -- 'me' ou 'father'
  origin text not null default 'manual',
  data_quality text not null default 'high',
  is_official boolean not null default false,
  notes text,
  invoice_month text, -- formato 'YYYY-MM'
  installment text, -- formato '1/3'
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  deleted_at timestamp with time zone,
  version integer not null default 1
);

-- 7. TABELA: audit_logs
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  payload jsonb,
  created_at timestamp with time zone default now()
);

-- 8. TABELA: trash_items
create table if not exists public.trash_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  original_table text not null,
  payload jsonb not null,
  deleted_at timestamp with time zone default now()
);

-- 9. HABILITAR ROW LEVEL SECURITY (RLS)
alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.cards enable row level security;
alter table public.invoices enable row level security;
alter table public.transactions enable row level security;
alter table public.audit_logs enable row level security;
alter table public.trash_items enable row level security;

-- 10. POLÍTICAS DE RLS (Row Level Security Policies)

-- Profiles
create policy "Usuários podem gerenciar seu próprio perfil"
  on public.profiles for all
  using (auth.uid() = id);

-- Accounts
create policy "Usuários podem gerenciar suas próprias contas"
  on public.accounts for all
  using (auth.uid() = user_id);

-- Cards
create policy "Usuários podem gerenciar seus próprios cartões"
  on public.cards for all
  using (auth.uid() = user_id);

-- Invoices
create policy "Usuários podem gerenciar suas próprias faturas"
  on public.invoices for all
  using (auth.uid() = user_id);

-- Transactions
create policy "Usuários podem gerenciar seus próprios lançamentos"
  on public.transactions for all
  using (auth.uid() = user_id);

-- Audit Logs
create policy "Usuários podem ver seus próprios logs"
  on public.audit_logs for select
  using (auth.uid() = user_id);

create policy "Usuários podem criar logs de auditoria"
  on public.audit_logs for insert
  with check (auth.uid() = user_id);

-- Trash Items
create policy "Usuários podem gerenciar sua lixeira"
  on public.trash_items for all
  using (auth.uid() = user_id);

-- 11. ÍNDICES DE DESEMPENHO E FILTROS
create index idx_transactions_user_date on public.transactions(user_id, due_date);
create index idx_transactions_user_invoice on public.transactions(user_id, invoice_month);
create index idx_invoices_user_card_month on public.invoices(user_id, card_id, reference_month);
