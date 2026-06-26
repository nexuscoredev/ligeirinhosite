-- Pix Santander: identificador da cobrança e provedor
alter table public.orders add column if not exists pix_txid text;
alter table public.orders add column if not exists pix_provider text;

create index if not exists orders_pix_txid_idx on public.orders (pix_txid);

comment on column public.orders.pix_txid is 'txid da cobrança Pix (Santander / BACEN).';
comment on column public.orders.pix_provider is 'Provedor Pix: santander | mercadopago.';

create or replace function public.rpc_fetch_order_by_pix_txid(p_pix_txid text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select to_jsonb(o) from public.orders o where o.pix_txid = p_pix_txid limit 1;
$$;

revoke all on function public.rpc_fetch_order_by_pix_txid(text) from public;
grant execute on function public.rpc_fetch_order_by_pix_txid(text) to anon, authenticated, service_role;
