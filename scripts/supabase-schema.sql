-- Ligeirinho Parceiros — tabela de pedidos (rodar uma vez no Supabase SQL Editor)

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'pending',
  items jsonb not null default '[]'::jsonb,
  total numeric(10, 2) not null check (total >= 0),
  delivery_type text,
  address text,
  notes text,
  customer_name text,
  customer_phone text,
  customer_email text,
  mp_payment_id bigint,
  mp_status text,
  mp_status_detail text,
  pix_qr_code text,
  pix_qr_base64 text,
  channel text default 'parceiros',
  totem_id text,
  totem_label text,
  unit_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Migração para bases existentes (rodar se a tabela já existir):
-- alter table public.orders add column if not exists channel text default 'parceiros';
-- alter table public.orders add column if not exists totem_id text;
-- alter table public.orders add column if not exists totem_label text;
-- alter table public.orders add column if not exists unit_id text;

create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_mp_payment_id_idx on public.orders (mp_payment_id);
create index if not exists orders_created_at_idx on public.orders (created_at desc);

alter table public.orders enable row level security;

comment on table public.orders is 'Pedidos do Ligeirinho Parceiros — acesso via service_role nas APIs Vercel';
