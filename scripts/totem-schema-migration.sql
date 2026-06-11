-- Migração: suporte a pedidos do Totem (rodar no Supabase ligeirinhoparceiros)

alter table public.orders add column if not exists channel text default 'parceiros';
alter table public.orders add column if not exists totem_id text;
alter table public.orders add column if not exists totem_label text;
alter table public.orders add column if not exists unit_id text;

create index if not exists orders_channel_idx on public.orders (channel);
create index if not exists orders_totem_id_idx on public.orders (totem_id);
