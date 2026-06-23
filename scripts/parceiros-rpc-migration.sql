-- RPCs server-side (security definer) — permite APIs Vercel sem service_role no env.
-- Chamadas via anon key; RLS bloqueia acesso direto às tabelas.

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
  return to_jsonb(r);
end;
$$;

create or replace function public.rpc_get_order(p_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select to_jsonb(o) from public.orders o where o.id = p_id limit 1;
$$;

create or replace function public.rpc_patch_order(p_id uuid, p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.orders%rowtype;
begin
  update public.orders set
    status = coalesce(nullif(p_patch->>'status', ''), status),
    financial_status = coalesce(nullif(p_patch->>'financial_status', ''), financial_status),
    payment_method = coalesce(nullif(p_patch->>'payment_method', ''), payment_method),
    mp_payment_id = coalesce((p_patch->>'mp_payment_id')::bigint, mp_payment_id),
    mp_status = coalesce(nullif(p_patch->>'mp_status', ''), mp_status),
    mp_status_detail = coalesce(nullif(p_patch->>'mp_status_detail', ''), mp_status_detail),
    mp_transaction_id = coalesce(nullif(p_patch->>'mp_transaction_id', ''), mp_transaction_id),
    pix_qr_code = coalesce(nullif(p_patch->>'pix_qr_code', ''), pix_qr_code),
    pix_qr_base64 = coalesce(nullif(p_patch->>'pix_qr_base64', ''), pix_qr_base64),
    pix_txid = coalesce(nullif(p_patch->>'pix_txid', ''), pix_txid),
    pix_provider = coalesce(nullif(p_patch->>'pix_provider', ''), pix_provider),
    paid_at = coalesce(nullif(p_patch->>'paid_at', '')::timestamptz, paid_at),
    separation_status = coalesce(nullif(p_patch->>'separation_status', ''), separation_status),
    separation_started_at = coalesce(nullif(p_patch->>'separation_started_at', '')::timestamptz, separation_started_at),
    separation_ready_at = coalesce(nullif(p_patch->>'separation_ready_at', '')::timestamptz, separation_ready_at),
    updated_at = now()
  where id = p_id
  returning * into r;
  if r.id is null then
    raise exception 'Pedido não encontrado';
  end if;
  return to_jsonb(r);
end;
$$;

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

create or replace function public.rpc_fetch_order_by_mp(p_mp_payment_id bigint)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select to_jsonb(o) from public.orders o where o.mp_payment_id = p_mp_payment_id limit 1;
$$;

revoke all on function public.rpc_create_order(jsonb) from public;
revoke all on function public.rpc_get_order(uuid) from public;
revoke all on function public.rpc_patch_order(uuid, jsonb) from public;
revoke all on function public.rpc_fetch_order_by_mp(bigint) from public;

grant execute on function public.rpc_create_order(jsonb) to anon, authenticated, service_role;
grant execute on function public.rpc_get_order(uuid) to anon, authenticated, service_role;
grant execute on function public.rpc_patch_order(uuid, jsonb) to anon, authenticated, service_role;
grant execute on function public.rpc_fetch_order_by_mp(bigint) to anon, authenticated, service_role;

-- Separação (totem)

create or replace function public.rpc_fetch_pick_items(p_order_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(to_jsonb(i) order by i.beer_priority, i.sort_order, i.line_index), '[]'::jsonb)
  from public.order_pick_items i
  where i.order_id = p_order_id;
$$;

create or replace function public.rpc_insert_pick_items(p_order_id uuid, p_lines jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.order_pick_items (
    order_id, line_index, product_id, product_name, qty, picked_qty,
    category_id, category_name, sort_order, beer_priority, status
  )
  select
    p_order_id,
    (l->>'line_index')::int,
    nullif(l->>'product_id', ''),
    l->>'product_name',
    coalesce((l->>'qty')::int, 1),
    0,
    nullif(l->>'category_id', ''),
    nullif(l->>'category_name', ''),
    coalesce((l->>'sort_order')::int, 0),
    coalesce((l->>'beer_priority')::int, 1),
    'pendente'
  from jsonb_array_elements(p_lines) as l;
  return public.rpc_fetch_pick_items(p_order_id);
end;
$$;

create or replace function public.rpc_patch_pick_item(p_item_id uuid, p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare r public.order_pick_items%rowtype;
begin
  update public.order_pick_items set
    picked_qty = coalesce((p_patch->>'picked_qty')::int, picked_qty),
    status = coalesce(nullif(p_patch->>'status', ''), status),
    picked_at = coalesce(nullif(p_patch->>'picked_at', '')::timestamptz, picked_at),
    picked_by = coalesce(nullif(p_patch->>'picked_by', ''), picked_by)
  where id = p_item_id
  returning * into r;
  return to_jsonb(r);
end;
$$;

create or replace function public.rpc_list_separation_queue(p_limit int default 30)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(to_jsonb(o)), '[]'::jsonb)
  from (
    select id, total, customer_name, totem_label, created_at, separation_status, separation_started_at
    from public.orders
    where status = 'paid' and channel = 'totem'
      and (separation_status is null or separation_status in ('em_separacao', 'pronto'))
    order by created_at asc
    limit greatest(1, least(coalesce(p_limit, 30), 100))
  ) o;
$$;

revoke all on function public.rpc_fetch_pick_items(uuid) from public;
revoke all on function public.rpc_insert_pick_items(uuid, jsonb) from public;
revoke all on function public.rpc_patch_pick_item(uuid, jsonb) from public;
revoke all on function public.rpc_list_separation_queue(int) from public;

grant execute on function public.rpc_fetch_pick_items(uuid) to anon, authenticated, service_role;
grant execute on function public.rpc_insert_pick_items(uuid, jsonb) to anon, authenticated, service_role;
grant execute on function public.rpc_patch_pick_item(uuid, jsonb) to anon, authenticated, service_role;
grant execute on function public.rpc_list_separation_queue(int) to anon, authenticated, service_role;

-- ——— Fila caixa / PDV (totem) ———
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
