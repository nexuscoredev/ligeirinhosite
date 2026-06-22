-- Código curto do pedido totem (8 hex do UUID) para busca no PDV sem ilike em uuid.

alter table public.orders add column if not exists totem_code text;

update public.orders
set totem_code = lower(left(id::text, 8))
where channel = 'totem'
  and (totem_code is null or totem_code = '');

create index if not exists orders_totem_code_idx
  on public.orders (totem_code)
  where totem_code is not null and channel = 'totem';

comment on column public.orders.totem_code is
  'Primeiros 8 hex do UUID — código do comprovante totem (PED …).';

create or replace function public.rpc_lookup_totem_order_by_code(p_prefix text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select to_jsonb(o)
  from public.orders o
  where o.channel = 'totem'
    and (
      lower(coalesce(o.totem_code, '')) = lower(trim(p_prefix))
      or lower(left(o.id::text, 8)) = lower(trim(p_prefix))
    )
  order by o.created_at desc
  limit 1;
$$;

grant execute on function public.rpc_lookup_totem_order_by_code(text) to anon, authenticated, service_role;

create or replace function public.rpc_create_order(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.orders%rowtype;
begin
  insert into public.orders (
    status, items, total, delivery_type, address, notes,
    customer_name, customer_phone, customer_email,
    channel, totem_id, totem_label, unit_id,
    customer_id, hub_user_id, payment_method, due_date, financial_status
  )
  values (
    coalesce(p->>'status', 'pending'),
    coalesce(p->'items', '[]'::jsonb),
    (p->>'total')::numeric,
    coalesce(p->>'delivery_type', 'retirada'),
    nullif(p->>'address', ''),
    nullif(p->>'notes', ''),
    nullif(p->>'customer_name', ''),
    nullif(p->>'customer_phone', ''),
    nullif(p->>'customer_email', ''),
    coalesce(nullif(p->>'channel', ''), 'parceiros'),
    nullif(p->>'totem_id', ''),
    nullif(p->>'totem_label', ''),
    nullif(p->>'unit_id', ''),
    case when coalesce(p->>'customer_id', '') = '' then null else (p->>'customer_id')::uuid end,
    nullif(p->>'hub_user_id', ''),
    case
      when nullif(p->>'payment_method', '') is not null then nullif(p->>'payment_method', '')
      when coalesce(nullif(p->>'channel', ''), 'parceiros') = 'totem' then null
      else 'pix'
    end,
    nullif(p->>'due_date', '')::date,
    coalesce(nullif(p->>'financial_status', ''), 'pendente')
  )
  returning * into r;

  if coalesce(r.channel, '') = 'totem' then
    update public.orders
    set totem_code = lower(left(r.id::text, 8))
    where id = r.id
    returning * into r;
  end if;

  return to_jsonb(r);
end;
$$;
