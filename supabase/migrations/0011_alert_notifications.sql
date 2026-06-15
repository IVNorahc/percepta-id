-- Percepta ID — Déduplication des notifications email d'alertes.
--
-- Une alerte (sur-séjour 8h/12h, zone dangereuse, pièce expirée) ne doit
-- déclencher qu'UN SEUL email, même si plusieurs clients/onglets sont ouverts
-- ou si la liste d'alertes est recalculée à chaque rafraîchissement.
--
-- Le client « réserve » l'envoi en insérant une ligne (log_id, alert_type) :
-- la contrainte UNIQUE garantit qu'un seul insert réussit → un seul email.

create table if not exists public.alert_notifications (
  id         bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  log_id     uuid not null,
  alert_type text not null,
  sent_at    timestamptz not null default now(),
  unique (log_id, alert_type)
);

create index if not exists alert_notifications_company_idx
  on public.alert_notifications (company_id);

alter table public.alert_notifications enable row level security;

-- Lecture / insertion / suppression réservées aux membres de l'entreprise.
drop policy if exists "Company members read alert_notifications"   on public.alert_notifications;
drop policy if exists "Company members write alert_notifications"  on public.alert_notifications;
drop policy if exists "Company members delete alert_notifications" on public.alert_notifications;

create policy "Company members read alert_notifications"
  on public.alert_notifications for select to authenticated
  using (company_id = public.current_company_id() or public.is_super_admin());

create policy "Company members write alert_notifications"
  on public.alert_notifications for insert to authenticated
  with check (company_id = public.current_company_id() or public.is_super_admin());

create policy "Company members delete alert_notifications"
  on public.alert_notifications for delete to authenticated
  using (company_id = public.current_company_id() or public.is_super_admin());
