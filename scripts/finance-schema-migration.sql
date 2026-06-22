-- Ligeirinho Parceiros — módulo financeiro (rodar no Supabase Parceiros SQL Editor)

-- ——— Clientes B2B ———
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  hub_user_id text unique,
  name text not null,
  email text,
  phone text,
  credit_limit numeric(12, 2) not null default 0 check (credit_limit >= 0),
  credit_used numeric(12, 2) not null default 0 check (credit_used >= 0),
  is_blocked boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customers_hub_user_id_idx on public.customers (hub_user_id);
create index if not exists customers_email_idx on public.customers (email);
create index if not exists customers_phone_idx on public.customers (phone);

-- ——— Campos financeiros em pedidos ———
alter table public.orders add column if not exists customer_id uuid references public.customers(id);
alter table public.orders add column if not exists hub_user_id text;
alter table public.orders add column if not exists payment_method text default 'pix';
alter table public.orders add column if not exists due_date date;
alter table public.orders add column if not exists financial_status text not null default 'pendente';
alter table public.orders add column if not exists paid_at timestamptz;
alter table public.orders add column if not exists mp_transaction_id text;
alter table public.orders add column if not exists latest_charge_id uuid;

alter table public.orders drop constraint if exists orders_financial_status_check;
alter table public.orders add constraint orders_financial_status_check
  check (financial_status in ('pendente', 'pago', 'vencido', 'cancelado', 'em_cobranca', 'aguardando_caixa'));

create index if not exists orders_financial_status_idx on public.orders (financial_status);
create index if not exists orders_due_date_idx on public.orders (due_date);
create index if not exists orders_customer_id_idx on public.orders (customer_id);
create index if not exists orders_hub_user_id_idx on public.orders (hub_user_id);

-- ——— Cobranças Mercado Pago ———
create table if not exists public.mp_charges (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  customer_id uuid references public.customers(id),
  amount numeric(12, 2) not null check (amount > 0),
  due_date date,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'expired', 'cancelled')),
  mp_payment_id bigint,
  mp_preference_id text,
  payment_link text,
  pix_qr_code text,
  pix_qr_base64 text,
  paid_at timestamptz,
  mp_transaction_id text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mp_charges_order_id_idx on public.mp_charges (order_id);
create index if not exists mp_charges_status_idx on public.mp_charges (status);
create index if not exists mp_charges_mp_payment_id_idx on public.mp_charges (mp_payment_id);

-- ——— Carteira virtual (cashback) ———
create table if not exists public.wallet (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null unique references public.customers(id) on delete cascade,
  hub_user_id text,
  balance numeric(12, 2) not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallet(id) on delete cascade,
  type text not null check (type in ('cashback', 'bonus', 'ajuste', 'pedido', 'estorno')),
  amount numeric(12, 2) not null,
  balance_after numeric(12, 2) not null,
  description text,
  order_id uuid references public.orders(id),
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists wallet_transactions_wallet_id_idx on public.wallet_transactions (wallet_id, created_at desc);

-- ——— Configurações financeiras ———
create table if not exists public.finance_settings (
  id smallint primary key default 1 check (id = 1),
  cashback_percent_default numeric(5, 2) not null default 0 check (cashback_percent_default >= 0),
  default_due_days integer not null default 30 check (default_due_days >= 1),
  mp_public_key text,
  mp_access_token_hint text,
  updated_at timestamptz not null default now()
);

insert into public.finance_settings (id) values (1) on conflict (id) do nothing;

-- ——— Log de eventos de pagamento (webhook) ———
create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'mercadopago',
  event_type text,
  mp_payment_id bigint,
  order_id uuid references public.orders(id),
  charge_id uuid references public.mp_charges(id),
  payload jsonb,
  processed_at timestamptz not null default now()
);

create index if not exists payment_events_mp_payment_id_idx on public.payment_events (mp_payment_id);

alter table public.customers enable row level security;
alter table public.mp_charges enable row level security;
alter table public.wallet enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.finance_settings enable row level security;
alter table public.payment_events enable row level security;

comment on table public.customers is 'Parceiros B2B — limite de crédito e saldo utilizado';
comment on table public.mp_charges is 'Cobranças geradas via Mercado Pago (PIX e Payment Link)';
comment on table public.wallet is 'Carteira virtual de cashback por parceiro';
