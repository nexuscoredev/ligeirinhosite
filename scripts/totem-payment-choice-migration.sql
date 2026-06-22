-- Totem: não preencher payment_method automaticamente no create.
-- O cliente deve escolher na tela de pagamento antes de ir ao caixa.

create or replace function public.rpc_create_order(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.orders%rowtype;
  v_channel text := coalesce(nullif(p->>'channel', ''), 'parceiros');
  v_payment_method text := nullif(p->>'payment_method', '');
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
    v_channel,
    nullif(p->>'totem_id', ''),
    nullif(p->>'totem_label', ''),
    nullif(p->>'unit_id', ''),
    case when coalesce(p->>'customer_id', '') = '' then null else (p->>'customer_id')::uuid end,
    nullif(p->>'hub_user_id', ''),
    case
      when v_payment_method is not null then v_payment_method
      when v_channel = 'totem' then null
      else 'pix'
    end,
    nullif(p->>'due_date', '')::date,
    coalesce(nullif(p->>'financial_status', ''), 'pendente')
  )
  returning * into r;
  return to_jsonb(r);
end;
$$;
