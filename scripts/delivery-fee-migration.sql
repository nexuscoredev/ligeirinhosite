-- Parceiros (ligeirinhoparceiros): taxa de entrega nos pedidos

alter table public.orders
  add column if not exists delivery_fee numeric(10, 2) default 0;

comment on column public.orders.delivery_fee is
  'Taxa de entrega em R$ incluída no total (0 = retirada ou isento).';
