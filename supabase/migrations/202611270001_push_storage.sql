-- Durable storage for VTracker Web Push subscriptions and VAPID credentials.
-- These tables must only be accessed by the server-side service role key.

create table if not exists public.vtracker_push_config (
  id smallint primary key check (id = 1),
  public_key text not null,
  private_key text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.vtracker_push_subscriptions (
  endpoint text primary key,
  subscription jsonb not null,
  auth_data jsonb,
  wishlist jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.vtracker_push_config enable row level security;
alter table public.vtracker_push_subscriptions enable row level security;

revoke all on table public.vtracker_push_config from anon, authenticated;
revoke all on table public.vtracker_push_subscriptions from anon, authenticated;
grant all on table public.vtracker_push_config to service_role;
grant all on table public.vtracker_push_subscriptions to service_role;
