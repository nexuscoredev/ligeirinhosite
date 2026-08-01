-- Estende rpc_patch_order para edição de pedidos Parceiros (itens, entrega, total).
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
    notes = coalesce(nullif(p_patch->>'notes', ''), notes),
    payment_splits = coalesce(p_patch->'payment_splits', payment_splits),
    items = coalesce(p_patch->'items', items),
    total = coalesce((p_patch->>'total')::numeric, total),
    delivery_type = coalesce(nullif(p_patch->>'delivery_type', ''), delivery_type),
    delivery_date = coalesce(nullif(p_patch->>'delivery_date', '')::date, delivery_date),
    address = case when p_patch ? 'address' then nullif(p_patch->>'address', '') else address end,
    delivery_fee = coalesce((p_patch->>'delivery_fee')::numeric, delivery_fee),
    customer_name = coalesce(nullif(p_patch->>'customer_name', ''), customer_name),
    customer_phone = coalesce(nullif(p_patch->>'customer_phone', ''), customer_phone),
    customer_email = coalesce(nullif(p_patch->>'customer_email', ''), customer_email),
    customer_cpf = coalesce(nullif(p_patch->>'customer_cpf', ''), customer_cpf),
    hub_pedido_id = coalesce(nullif(p_patch->>'hub_pedido_id', '')::uuid, hub_pedido_id),
    due_date = coalesce(nullif(p_patch->>'due_date', '')::date, due_date),
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
