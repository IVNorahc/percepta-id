-- Percepta ID — acquittements d'alertes de présence prolongée

create table if not exists public.alert_acks (
  id         uuid primary key default gen_random_uuid(),
  log_id     uuid not null references public.access_logs(id) on delete cascade,
  alert_type text not null check (alert_type in ('over_8h', 'over_12h', 'zone_danger_4h')),
  acked_at   timestamptz not null default now(),
  acked_by   uuid references auth.users(id) default auth.uid()
);

-- Un log ne peut avoir qu'un seul acquittement par type d'alerte
create unique index if not exists alert_acks_log_type_uidx
  on public.alert_acks (log_id, alert_type);

create index if not exists alert_acks_log_id_idx on public.alert_acks (log_id);

alter table public.alert_acks enable row level security;

create policy "Authenticated users can manage alert_acks"
  on public.alert_acks for all
  to authenticated
  using (true)
  with check (true);
