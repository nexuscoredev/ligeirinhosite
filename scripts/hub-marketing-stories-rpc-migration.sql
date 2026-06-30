-- Ligeirinho Hub — stories de promoções (Drive MKT) para o app Parceiros
-- Projeto: liszpwocwvkytzyaxvit

create or replace function public.rpc_list_marketing_drive_stories()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  with raiz as (
    select id, drive_folder_id, nome
    from public.marketing_drive_raiz
    where drive_folder_id = '1XxmOF8ks5AUjMK5sC1y9fJ6f_sAWnhgo'
      and ativo = true
    limit 1
  )
  select jsonb_build_object(
    'raiz',
    (
      select jsonb_build_object(
        'id', r.id,
        'drive_folder_id', r.drive_folder_id,
        'nome', r.nome
      )
      from raiz r
    ),
    'pastas',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', p.id,
            'drive_folder_id', p.drive_folder_id,
            'parent_drive_folder_id', p.parent_drive_folder_id,
            'nome', p.nome,
            'caminho', p.caminho
          )
          order by p.caminho
        )
        from public.marketing_drive_pastas p
        inner join raiz r on p.raiz_id = r.id
      ),
      '[]'::jsonb
    ),
    'arquivos',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', a.id,
            'pasta_id', a.pasta_id,
            'nome', a.nome,
            'imagem_url', a.imagem_url,
            'drive_modified_at', a.drive_modified_at
          )
          order by a.nome
        )
        from public.marketing_drive_arquivos a
        inner join raiz r on a.raiz_id = r.id
        where a.ativo_no_drive = true
      ),
      '[]'::jsonb
    )
  );
$$;

revoke all on function public.rpc_list_marketing_drive_stories() from public;
grant execute on function public.rpc_list_marketing_drive_stories() to anon, authenticated, service_role;

comment on function public.rpc_list_marketing_drive_stories() is
  'Lista pastas e imagens ativas do Drive MKT Promoções para stories no app Parceiros.';
