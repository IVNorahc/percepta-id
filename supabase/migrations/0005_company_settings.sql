-- company_settings : paramètres globaux de l'entreprise (mono-tenant, une seule ligne)
-- profiles : agents de sécurité avec auto-création via trigger

-- ── company_settings ────────────────────────────────────────────────────────

create table if not exists public.company_settings (
  id                   integer primary key default 1 check (id = 1),
  company_name         text not null default 'Percepta ID',
  logo_url             text,
  site_address         text,
  phone                text,
  email                text,
  zones                jsonb not null default '[
    {"name":"Zone A","color":"blue","isDanger":false},
    {"name":"Zone B","color":"green","isDanger":false},
    {"name":"Zone C","color":"orange","isDanger":false},
    {"name":"Zone Dangereuse","color":"red","isDanger":true}
  ]'::jsonb,
  threshold_warning_h  integer not null default 8,
  threshold_critical_h integer not null default 12,
  threshold_danger_h   integer not null default 4,
  updated_at           timestamptz not null default now(),
  updated_by           uuid references auth.users(id) default auth.uid()
);

-- Seeder la ligne unique
insert into public.company_settings (id)
values (1)
on conflict (id) do nothing;

alter table public.company_settings enable row level security;

create policy "Authenticated users can manage company_settings"
  on public.company_settings for all
  to authenticated
  using (true)
  with check (true);

-- ── profiles ────────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text,
  display_name text,
  role         text not null default 'agent' check (role in ('admin', 'agent')),
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Authenticated users can read profiles"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Authenticated users can update profiles"
  on public.profiles for update
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated users can insert profiles"
  on public.profiles for insert
  to authenticated
  with check (true);

-- Trigger : crée automatiquement un profil à chaque inscription
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
