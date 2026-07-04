-- Canal de cliente para cadastros criados no totem (varejo loja).
alter type public.gf_canal_cliente add value if not exists 'totem';
