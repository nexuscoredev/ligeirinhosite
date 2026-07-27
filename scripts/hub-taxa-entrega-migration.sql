-- Hub (ligeirinho): taxa de entrega por cliente Parceiros
-- NULL = usar padrão do app (R$ 100,00); 0 = isento

alter table public.clientes
  add column if not exists taxa_entrega numeric(10, 2);

comment on column public.clientes.taxa_entrega is
  'Taxa de entrega em R$ para pedidos do app Parceiros. NULL = padrão R$100; 0 = grátis.';
