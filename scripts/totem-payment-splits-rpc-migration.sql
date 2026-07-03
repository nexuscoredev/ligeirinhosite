-- Coluna payment_splits + rpc_patch_order grava notes e payment_splits (totem pagamento dividido)
alter table public.orders add column if not exists payment_splits jsonb;

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
