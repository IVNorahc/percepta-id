-- Percepta ID — schéma initial
-- Tables : access_logs (entrées/sorties du personnel) et alerts (notifications du dashboard)
-- + bucket de stockage "documents" pour les photos de CNI et de personnes.

create extension if not exists "pgcrypto";

create table if not exists public.access_logs (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  id_number text not null,
  zone text not null,
  reason text not null,
  cni_url text,
  photo_url text,
  checked_in_at timestamptz not null default now(),
  checked_out_at timestamptz,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists access_logs_id_number_idx on public.access_logs (id_number);
create index if not exists access_logs_checked_in_at_idx on public.access_logs (checked_in_at desc);
create index if not exists access_logs_checked_out_at_idx on public.access_logs (checked_out_at);

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  level text not null default 'info' check (level in ('info', 'warning', 'critical')),
  created_at timestamptz not null default now()
);

create index if not exists alerts_created_at_idx on public.alerts (created_at desc);

-- RLS : tout utilisateur authentifié (un compte entreprise) peut lire/écrire ses données.
-- À affiner plus tard si plusieurs entreprises partagent le même projet Supabase.
alter table public.access_logs enable row level security;
alter table public.alerts enable row level security;

create policy "Authenticated users can read access_logs"
  on public.access_logs for select
  to authenticated
  using (true);

create policy "Authenticated users can insert access_logs"
  on public.access_logs for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update access_logs"
  on public.access_logs for update
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated users can read alerts"
  on public.alerts for select
  to authenticated
  using (true);

create policy "Authenticated users can insert alerts"
  on public.alerts for insert
  to authenticated
  with check (true);

-- Bucket de stockage pour les photos de CNI et de personnes scannées via /scan
insert into storage.buckets (id, name, public)
values ('documents', 'documents', true)
on conflict (id) do nothing;

create policy "Authenticated users can upload documents"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'documents');

create policy "Authenticated users can read documents"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'documents');

create policy "Public can view documents"
  on storage.objects for select
  to anon
  using (bucket_id = 'documents');
