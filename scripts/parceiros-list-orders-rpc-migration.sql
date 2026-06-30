-- Lista pedidos Parceiros via RPC (security definer), para APIs sem service_role no env.

create or replace function public.rpc_list_parceiro_orders(
  p_hub_user_ids text[] default array[]::text[],
  p_emails text[] default array[]::text[],
  p_limit int default 50,
  p_channel text default 'parceiros'
)
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
    where o.channel = coalesce(nullif(p_channel, ''), 'parceiros')
      and (
        (
          cardinality(p_hub_user_ids) > 0
          and o.hub_user_id = any(p_hub_user_ids)
        )
        or (
          cardinality(p_emails) > 0
          and lower(trim(coalesce(o.customer_email, ''))) = any (
            select lower(trim(x))
            from unnest(p_emails) as x
            where trim(x) <> ''
          )
        )
      )
    order by o.created_at desc
    limit least(greatest(coalesce(p_limit, 50), 1), 50)
  ) sub;
$$;

revoke all on function public.rpc_list_parceiro_orders(text[], text[], int, text) from public;
grant execute on function public.rpc_list_parceiro_orders(text[], text[], int, text)
  to anon, authenticated, service_role;
