-- Data de entrega escolhida pelo parceiro no checkout (Parceiros Supabase)
alter table public.orders
  add column if not exists delivery_date date;

comment on column public.orders.delivery_date is 'Data de entrega selecionada no app Parceiros (dias configurados no Hub).';
