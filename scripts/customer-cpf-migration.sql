-- CPF na nota (Totem → PDV)
alter table public.orders
    add column if not exists customer_cpf text;

comment on column public.orders.customer_cpf is
  'CPF do consumidor para cupom/NFC-e (11 dígitos), informado no Totem.';
