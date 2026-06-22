-- Fila do caixa / PDV — pedidos totem aguardando pagamento no balcão

alter table public.orders drop constraint if exists orders_financial_status_check;
alter table public.orders add constraint orders_financial_status_check
  check (financial_status in ('pendente', 'pago', 'vencido', 'cancelado', 'em_cobranca', 'aguardando_caixa'));

create or replace function public.rpc_list_caixa_queue(p_limit int default 40)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(to_jsonb(o)), '[]'::jsonb)
  from (
    select id, total, customer_name, totem_label, unit_id, created_at, payment_method, items, notes
    from public.orders
    where channel = 'totem'
      and status in ('pending', 'pending_payment')
      and financial_status = 'aguardando_caixa'
      and payment_method is not null
      and trim(payment_method) <> ''
    order by created_at asc
    limit greatest(1, least(coalesce(p_limit, 40), 100))
  ) o;
$$;

revoke all on function public.rpc_list_caixa_queue(int) from public;
grant execute on function public.rpc_list_caixa_queue(int) to anon, authenticated, service_role;
