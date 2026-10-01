-- NovaBlu ERP 0.08 — Supabase SaaS foundation
-- Prepared migration. It is NOT active until a Supabase project is connected and this migration is applied.

create extension if not exists pgcrypto;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  country text,
  currency text not null default 'IQD',
  owner_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'Viewer',
  status text not null default 'active' check (status in ('active','invited','disabled')),
  branch_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  primary key (workspace_id,user_id)
);

create table if not exists public.subscriptions (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  plan text not null default 'trial',
  status text not null default 'trialing',
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  trial_ends_at timestamptz,
  current_period_ends_at timestamptz,
  cancel_at_period_end boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Transitional cloud record store for phased migration from the local ERP.
-- Domain tables can replace individual entity types later without breaking tenant isolation.
create table if not exists public.entity_records (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  entity_type text not null,
  entity_id text not null,
  company_id text,
  branch_id text,
  version bigint not null default 1,
  deleted_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (workspace_id,entity_type,entity_id)
);
create index if not exists entity_records_workspace_type_idx on public.entity_records(workspace_id,entity_type);
create index if not exists entity_records_updated_idx on public.entity_records(workspace_id,updated_at);

create table if not exists public.sync_devices (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_key text not null,
  label text,
  last_sync_at timestamptz,
  last_seen_at timestamptz not null default now(),
  unique(workspace_id,user_id,device_key)
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  entity_type text,
  entity_id text,
  action text not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_events_workspace_created_idx on public.audit_events(workspace_id,created_at desc);

create table if not exists public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  rule_type text not null,
  enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  last_run_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  channel text not null check (channel in ('email','whatsapp','telegram','webhook','push')),
  recipient text,
  template_key text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued','processing','sent','failed','cancelled')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists notification_outbox_queue_idx on public.notification_outbox(status,next_attempt_at);

create or replace function public.is_workspace_member(wid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.workspace_members m
    where m.workspace_id = wid
      and m.user_id = auth.uid()
      and m.status = 'active'
  ) or exists(
    select 1 from public.workspaces w
    where w.id = wid and w.owner_id = auth.uid()
  );
$$;

create or replace function public.is_workspace_admin(wid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.workspaces w
    where w.id = wid and w.owner_id = auth.uid()
  ) or exists(
    select 1 from public.workspace_members m
    where m.workspace_id = wid
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role in ('Owner','Admin')
  );
$$;

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.subscriptions enable row level security;
alter table public.entity_records enable row level security;
alter table public.sync_devices enable row level security;
alter table public.audit_events enable row level security;
alter table public.automation_rules enable row level security;
alter table public.notification_outbox enable row level security;

drop policy if exists workspace_select on public.workspaces;
create policy workspace_select on public.workspaces for select using (public.is_workspace_member(id));
drop policy if exists workspace_update on public.workspaces;
create policy workspace_update on public.workspaces for update using (public.is_workspace_admin(id)) with check (public.is_workspace_admin(id));

drop policy if exists members_select on public.workspace_members;
create policy members_select on public.workspace_members for select using (public.is_workspace_member(workspace_id));
drop policy if exists members_admin_all on public.workspace_members;
create policy members_admin_all on public.workspace_members for all using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));

drop policy if exists subscription_select on public.subscriptions;
create policy subscription_select on public.subscriptions for select using (public.is_workspace_member(workspace_id));
drop policy if exists subscription_admin on public.subscriptions;
create policy subscription_admin on public.subscriptions for update using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));

drop policy if exists entity_records_member on public.entity_records;
create policy entity_records_member on public.entity_records for all
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists sync_devices_member on public.sync_devices;
create policy sync_devices_member on public.sync_devices for all
using (public.is_workspace_member(workspace_id) and user_id = auth.uid())
with check (public.is_workspace_member(workspace_id) and user_id = auth.uid());

drop policy if exists audit_select on public.audit_events;
create policy audit_select on public.audit_events for select using (public.is_workspace_member(workspace_id));
drop policy if exists audit_insert on public.audit_events;
create policy audit_insert on public.audit_events for insert with check (public.is_workspace_member(workspace_id));

drop policy if exists automation_member on public.automation_rules;
create policy automation_member on public.automation_rules for all
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists outbox_select on public.notification_outbox;
create policy outbox_select on public.notification_outbox for select using (public.is_workspace_member(workspace_id));
drop policy if exists outbox_insert on public.notification_outbox;
create policy outbox_insert on public.notification_outbox for insert with check (public.is_workspace_member(workspace_id));

-- Recommended server-only rules:
-- 1) Billing provider webhooks update subscriptions using the service role only.
-- 2) WhatsApp/Telegram/Email credentials stay in Edge Function secrets, never in browser/localStorage.
-- 3) Critical stock/payment/invoice posting should move to transactional RPC functions.
-- 4) Add normalized domain tables progressively after cloud MVP sync is stable.
