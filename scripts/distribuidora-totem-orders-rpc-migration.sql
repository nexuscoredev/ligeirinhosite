-- Lista pedidos Totem/Tablet para a conta Distribuidora (Meus pedidos).
-- Chamado apenas pela API autenticada /api/orders/mine quando CNPJ = distribuidora.

create or replace function public.rpc_list_distribuidora_totem_orders(p_limit int default 50)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(to_jsonb(sub) order by sub.created_at desc),
    '[]'::jsonb
  )
  from (
    select o.*
    from public.orders o
    where o.channel = 'totem'
    order by o.created_at desc
    limit least(greatest(coalesce(p_limit, 50), 1), 200)
  ) sub;
$$;

revoke all on function public.rpc_list_distribuidora_totem_orders(int) from public;
grant execute on function public.rpc_list_distribuidora_totem_orders(int)
  to anon, authenticated, service_role;
