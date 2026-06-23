-- Pix Santander: identificador da cobrança e provedor
alter table public.orders add column if not exists pix_txid text;
alter table public.orders add column if not exists pix_provider text;

create index if not exists orders_pix_txid_idx on public.orders (pix_txid);

comment on column public.orders.pix_txid is 'txid da cobrança Pix (Santander / BACEN).';
comment on column public.orders.pix_provider is 'Provedor Pix: santander | mercadopago.';
