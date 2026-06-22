-- Ligeirinho Hub — suporte ao app Parceiros (login CNPJ, primeiro acesso)
-- Aplicar no SQL Editor do projeto Hub (liszpwocwvkytzyaxvit)

alter table public.usuarios
  add column if not exists must_change_password boolean not null default false;

comment on column public.usuarios.must_change_password is
  'Quando true, o parceiro deve definir nova senha no primeiro acesso ao app.';

-- Marcar parceiros pré-cadastrados (ajuste o filtro conforme sua base)
-- update public.usuarios u
-- set must_change_password = true
-- from public.pessoas p
-- join public.clientes c on c.pessoa_id = p.id
-- where c.canal_cliente = 'parceiros'
--   and u.ativo
--   and (lower(u.login) = p.cpf_cnpj_digits or u.email = p.email);

create or replace function public.resolve_login_email(p_login text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  with raw as (
    select trim(p_login) as value
  ),
  digits as (
    select regexp_replace((select value from raw), '\D', '', 'g') as doc
  )
  select u.email
  from public.usuarios u, raw, digits
  where u.ativo
    and (
      lower(u.login) = lower(raw.value)
      or u.login = digits.doc
      or replace(replace(replace(u.login, '.', ''), '/', ''), '-', '') = digits.doc
    )
  limit 1;
$$;

revoke all on function public.resolve_login_email(text) from public;
grant execute on function public.resolve_login_email(text) to anon, authenticated;
