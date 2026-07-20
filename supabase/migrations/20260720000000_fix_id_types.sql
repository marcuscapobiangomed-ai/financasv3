-- Migration corretiva: altera colunas id de uuid para text nas tabelas
-- que recebem IDs gerados pelo cliente (formato livre, não UUID puro)

-- 1. Remover constraints e recriar transactions com id text
alter table public.transactions drop constraint transactions_pkey;
alter table public.transactions alter column id type text using id::text;
alter table public.transactions add primary key (id);

-- 2. Remover constraints e recriar invoices com id text
alter table public.invoices drop constraint invoices_pkey;
alter table public.invoices alter column id type text using id::text;
alter table public.invoices add primary key (id);

-- 3. Recriar índices (já existiam, mas precisam ser recriados após tipo mudar)
drop index if exists idx_transactions_user_date;
drop index if exists idx_transactions_user_invoice;
create index idx_transactions_user_date on public.transactions(user_id, due_date);
create index idx_transactions_user_invoice on public.transactions(user_id, invoice_month);
