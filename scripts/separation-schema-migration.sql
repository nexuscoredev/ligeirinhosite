-- Fila de separação (totem / balcão) — Supabase Parceiros

alter table public.orders add column if not exists separation_status text;
alter table public.orders add column if not exists separation_started_at timestamptz;
alter table public.orders add column if not exists separation_ready_at timestamptz;

create table if not exists public.order_pick_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  line_index integer not null,
  product_id text,
  product_name text not null,
  qty integer not null default 1 check (qty > 0),
  picked_qty integer not null default 0 check (picked_qty >= 0),
  category_id text,
  category_name text,
  sort_order integer not null default 0,
  beer_priority integer not null default 0,
  status text not null default 'pendente'
    check (status in ('pendente', 'parcial', 'feito')),
  picked_at timestamptz,
  picked_by text,
  created_at timestamptz not null default now(),
  unique (order_id, line_index)
);

create index if not exists order_pick_items_order_id_idx on public.order_pick_items (order_id, sort_order);
create index if not exists orders_separation_status_idx on public.orders (separation_status, created_at desc);

alter table public.order_pick_items enable row level security;

comment on table public.order_pick_items is 'Itens da fila de separação item a item (totem)';
