-- NF/DANFE — pedidos Parceiros + RPCs

alter table public.orders
    add column if not exists wants_invoice boolean not null default false;

alter table public.orders
    add column if not exists hub_pedido_id uuid;

alter table public.orders
    add column if not exists nf_queue_status text;

comment on column public.orders.wants_invoice is 'Cliente solicitou NF/DANFE no checkout Parceiros';
comment on column public.orders.hub_pedido_id is 'Pedido correspondente no Ligeirinho Hub (fila NF)';
comment on column public.orders.nf_queue_status is 'pending_payment | queued | failed | none';

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
    status, items, total, delivery_type, delivery_date, address, notes,
    customer_name, customer_phone, customer_email,
    channel, totem_id, totem_label, unit_id,
    customer_id, hub_user_id, payment_method, due_date, financial_status,
    wants_invoice, nf_queue_status
  )
  values (
    coalesce(p->>'status', 'pending'),
    coalesce(p->'items', '[]'::jsonb),
    (p->>'total')::numeric,
    coalesce(p->>'delivery_type', 'retirada'),
    nullif(p->>'delivery_date', '')::date,
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
    coalesce(nullif(p->>'financial_status', ''), 'pendente'),
    coalesce((p->>'wants_invoice')::boolean, false),
    nullif(p->>'nf_queue_status', '')
  )
  returning * into r;
  return to_jsonb(r);
end;
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
    hub_pedido_id = coalesce(nullif(p_patch->>'hub_pedido_id', '')::uuid, hub_pedido_id),
    nf_queue_status = coalesce(nullif(p_patch->>'nf_queue_status', ''), nf_queue_status),
    wants_invoice = coalesce((p_patch->>'wants_invoice')::boolean, wants_invoice),
    updated_at = now()
  where id = p_id
  returning * into r;
  if r.id is null then
    raise exception 'Pedido não encontrado';
  end if;
  return to_jsonb(r);
end;
$$;

grant execute on function public.rpc_create_order(jsonb) to anon, authenticated, service_role;
grant execute on function public.rpc_patch_order(uuid, jsonb) to anon, authenticated, service_role;
