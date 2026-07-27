-- Web Push: subscriptions + última chave de status notificada por pedido

create table if not exists public.push_subscriptions (
    id uuid primary key default gen_random_uuid(),
    hub_user_id text not null,
    endpoint text not null,
    p256dh text not null,
    auth text not null,
    user_agent text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint push_subscriptions_endpoint_unique unique (endpoint)
);

create index if not exists push_subscriptions_hub_user_id_idx
    on public.push_subscriptions (hub_user_id);

alter table public.push_subscriptions enable row level security;

comment on table public.push_subscriptions is
    'Web Push subscriptions do Ligeirinho Parceiros — acesso via service_role nas APIs Vercel';

alter table public.orders
    add column if not exists last_notified_track_key text;

comment on column public.orders.last_notified_track_key is
    'Chave step:hubStatus:cancelled da última notificação de status enviada';
