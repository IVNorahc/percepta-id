-- Percepta ID — Pointage des employés par badge QR.
--
-- employees : registre du personnel permanent (avec badge QR unique).
-- pointages : journal entrée/sortie horodaté.
-- Isolation multi-tenant via les fonctions existantes current_company_id()/is_super_admin().

-- ── employees ────────────────────────────────────────────────────────────────

create table if not exists public.employees (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid references public.companies(id) on delete cascade default public.current_company_id(),
  nom            text not null,
  prenoms        text not null,
  photo_url      text,
  poste          text,
  zone_autorisee text,
  badge_qr_code  text unique default gen_random_uuid()::text,
  date_embauche  date,
  statut         text not null default 'actif' check (statut in ('actif', 'inactif')),
  nin            text,
  created_at     timestamptz not null default now()
);

create index if not exists employees_company_id_idx on public.employees (company_id);
create index if not exists employees_badge_idx on public.employees (badge_qr_code);

-- ── pointages ────────────────────────────────────────────────────────────────

create table if not exists public.pointages (
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees(id) on delete cascade,
  company_id  uuid references public.companies(id) default public.current_company_id(),
  type        text not null check (type in ('entree', 'sortie')),
  heure       timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

create index if not exists pointages_company_id_idx on public.pointages (company_id);
create index if not exists pointages_employee_id_idx on public.pointages (employee_id);
create index if not exists pointages_heure_idx on public.pointages (heure desc);

-- ── RLS ──────────────────────────────────────────────────────────────────────

alter table public.employees enable row level security;
alter table public.pointages enable row level security;

drop policy if exists "company_employees" on public.employees;
create policy "company_employees"
  on public.employees for all to authenticated
  using (company_id = public.current_company_id() or public.is_super_admin())
  with check (company_id = public.current_company_id() or public.is_super_admin());

drop policy if exists "company_pointages" on public.pointages;
create policy "company_pointages"
  on public.pointages for all to authenticated
  using (company_id = public.current_company_id() or public.is_super_admin())
  with check (company_id = public.current_company_id() or public.is_super_admin());
