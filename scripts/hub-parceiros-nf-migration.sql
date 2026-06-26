-- Hub: origem parceiros para pedidos vindos do Ligeirinho Parceiros (fila Emissão NF)

do $$
begin
    alter type public.pedido_origem add value if not exists 'parceiros';
exception
    when duplicate_object then null;
end $$;
