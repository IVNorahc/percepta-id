-- Percepta ID — Multi-tenant : isolation des données par entreprise.
--
-- Modèle : chaque utilisateur appartient à une `company` (via profiles.company_id).
-- Le super-admin (muhammadsamb@gmail.com) voit toutes les entreprises.
-- L'isolation est garantie par RLS via deux fonctions SECURITY DEFINER :
--   - current_company_id() : la company de l'utilisateur courant
--   - is_super_admin()      : vrai si l'email JWT est celui du mainteneur
--
-- NB : les fonctions SQL sont validées à la création → les colonnes qu'elles
-- référencent (profiles.company_id) doivent exister AVANT. D'où l'ordre ci-dessous.

-- ── 1. Table companies ───────────────────────────────────────────────────────

create table if not exists public.companies (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

-- Entreprise par défaut pour rattacher les données pré-existantes (mono-tenant).
insert into public.companies (id, name)
values ('00000000-0000-0000-0000-000000000001', 'Entreprise principale')
on conflict (id) do nothing;

-- ── 2. Colonnes company_id (créées AVANT les fonctions/policies) ─────────────

alter table public.profiles
  add column if not exists company_id uuid references public.companies(id) on delete set null;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'manager', 'agent'));

alter table public.access_logs
  add column if not exists company_id uuid references public.companies(id) on delete cascade;

alter table public.company_settings
  add column if not exists company_id uuid references public.companies(id) on delete cascade;

-- ── 3. Fonctions helper (SECURITY DEFINER → contournent la RLS, pas de récursion) ──

create or replace function public.current_company_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select company_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_super_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((auth.jwt() ->> 'email') = 'muhammadsamb@gmail.com', false);
$$;

-- ── 4. Backfill des données existantes → entreprise par défaut ────────────────

update public.profiles
  set company_id = '00000000-0000-0000-0000-000000000001'
  where company_id is null and coalesce(email, '') <> 'muhammadsamb@gmail.com';

update public.profiles set role = 'admin' where email = 'muhammadsamb@gmail.com';

update public.access_logs
  set company_id = '00000000-0000-0000-0000-000000000001'
  where company_id is null;

update public.company_settings
  set company_id = '00000000-0000-0000-0000-000000000001'
  where company_id is null;

-- ── 5. access_logs : default = company courante + index ──────────────────────
-- Les nouvelles entrées héritent automatiquement de la company de l'agent,
-- ce qui évite de modifier le code d'insertion (ScanPage).

alter table public.access_logs alter column company_id set default public.current_company_id();
create index if not exists access_logs_company_id_idx on public.access_logs (company_id);

-- ── 6. company_settings : une ligne par entreprise (au lieu de id=1 fixe) ─────

alter table public.company_settings drop constraint if exists company_settings_id_check;

create sequence if not exists company_settings_id_seq owned by public.company_settings.id;
select setval('company_settings_id_seq', greatest(coalesce((select max(id) from public.company_settings), 1), 1));
alter table public.company_settings alter column id set default nextval('company_settings_id_seq');

alter table public.company_settings drop constraint if exists company_settings_company_id_key;
alter table public.company_settings add constraint company_settings_company_id_key unique (company_id);

-- ── 7. Trigger d'inscription : crée la company + le profil + les settings ─────

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_company_id   uuid;
  v_company_name text;
begin
  -- Le super-admin n'appartient à aucune entreprise (accès global via is_super_admin())
  if new.email = 'muhammadsamb@gmail.com' then
    insert into public.profiles (id, email, role)
    values (new.id, new.email, 'admin')
    on conflict (id) do update set role = 'admin';
    return new;
  end if;

  v_company_name := coalesce(nullif(new.raw_user_meta_data ->> 'company_name', ''), 'Mon entreprise');

  insert into public.companies (name) values (v_company_name) returning id into v_company_id;

  -- Le créateur de l'entreprise en est le manager
  insert into public.profiles (id, email, role, company_id)
  values (new.id, new.email, 'manager', v_company_id)
  on conflict (id) do update
    set company_id = excluded.company_id, role = excluded.role;

  -- Settings initiaux de l'entreprise
  insert into public.company_settings (company_id, company_name)
  values (v_company_id, v_company_name)
  on conflict (company_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── 8. companies : RLS ───────────────────────────────────────────────────────

alter table public.companies enable row level security;

drop policy if exists "Members read own company" on public.companies;
create policy "Members read own company"
  on public.companies for select
  to authenticated
  using (id = public.current_company_id() or public.is_super_admin());

drop policy if exists "Super admin manages companies" on public.companies;
create policy "Super admin manages companies"
  on public.companies for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ── 9. access_logs : RLS par company ─────────────────────────────────────────

drop policy if exists "Authenticated users can read access_logs"   on public.access_logs;
drop policy if exists "Authenticated users can insert access_logs" on public.access_logs;
drop policy if exists "Authenticated users can update access_logs" on public.access_logs;

create policy "Company members read access_logs"
  on public.access_logs for select to authenticated
  using (company_id = public.current_company_id() or public.is_super_admin());

create policy "Company members insert access_logs"
  on public.access_logs for insert to authenticated
  with check (company_id = public.current_company_id() or public.is_super_admin());

create policy "Company members update access_logs"
  on public.access_logs for update to authenticated
  using (company_id = public.current_company_id() or public.is_super_admin())
  with check (company_id = public.current_company_id() or public.is_super_admin());

-- ── 10. company_settings : RLS par company ───────────────────────────────────

drop policy if exists "Authenticated users can manage company_settings" on public.company_settings;

create policy "Company members manage company_settings"
  on public.company_settings for all to authenticated
  using (company_id = public.current_company_id() or public.is_super_admin())
  with check (company_id = public.current_company_id() or public.is_super_admin());

-- ── 11. profiles : RLS par company ───────────────────────────────────────────

drop policy if exists "Authenticated users can read profiles"   on public.profiles;
drop policy if exists "Authenticated users can update profiles" on public.profiles;
drop policy if exists "Authenticated users can insert profiles" on public.profiles;

create policy "Read profiles in company"
  on public.profiles for select to authenticated
  using (id = auth.uid() or company_id = public.current_company_id() or public.is_super_admin());

create policy "Update profiles in company"
  on public.profiles for update to authenticated
  using (id = auth.uid() or company_id = public.current_company_id() or public.is_super_admin())
  with check (id = auth.uid() or company_id = public.current_company_id() or public.is_super_admin());

create policy "Insert own profile"
  on public.profiles for insert to authenticated
  with check (id = auth.uid() or public.is_super_admin());

-- ── 12. alert_acks : RLS via le log associé ──────────────────────────────────

drop policy if exists "Authenticated users can manage alert_acks" on public.alert_acks;

create policy "Company members read alert_acks"
  on public.alert_acks for select to authenticated
  using (
    exists (
      select 1 from public.access_logs l
      where l.id = alert_acks.log_id
        and (l.company_id = public.current_company_id() or public.is_super_admin())
    )
  );

create policy "Company members write alert_acks"
  on public.alert_acks for all to authenticated
  using (
    exists (
      select 1 from public.access_logs l
      where l.id = alert_acks.log_id
        and (l.company_id = public.current_company_id() or public.is_super_admin())
    )
  )
  with check (
    exists (
      select 1 from public.access_logs l
      where l.id = alert_acks.log_id
        and (l.company_id = public.current_company_id() or public.is_super_admin())
    )
  );
