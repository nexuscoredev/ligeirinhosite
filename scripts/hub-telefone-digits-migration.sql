-- Normaliza telefone para busca no totem (telefones legados com máscara).
alter table public.pessoas
    add column if not exists telefone_digits text
    generated always as (
        nullif(regexp_replace(coalesce(telefone, ''), '\D', '', 'g'), '')
    ) stored;

create index if not exists pessoas_telefone_digits_idx on public.pessoas (telefone_digits);
