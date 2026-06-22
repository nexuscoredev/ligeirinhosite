-- RLS: bloqueia anon/authenticated nas tabelas server-only (APIs usam service_role ou RPC).

do $$
declare t text;
begin
  foreach t in array array['orders','customers','mp_charges','wallet','wallet_transactions','finance_settings','payment_events','order_pick_items']
  loop
    execute format('drop policy if exists deny_all on public.%I', t);
    execute format(
      'create policy deny_all on public.%I for all to anon, authenticated using (false) with check (false)',
      t
    );
  end loop;
end $$;
