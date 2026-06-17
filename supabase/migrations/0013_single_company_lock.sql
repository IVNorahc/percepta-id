-- Percepta ID — Verrou d'exclusivité : une seule entreprise cliente par instance.
--
-- Exclusivité contractuelle : l'instance ne doit héberger qu'UNE entreprise.
-- Le trigger handle_new_user ne crée donc une entreprise QUE s'il n'en existe
-- aucune (bootstrap initial). Sinon, tout nouvel utilisateur est rattaché à
-- l'entreprise existante — jamais de seconde entreprise.

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_company_id    uuid;
  v_company_name  text;
  v_role          text;
  v_display_name  text;
  v_existing_id   uuid;
  v_existing_name text;
begin
  v_display_name := nullif(new.raw_user_meta_data ->> 'display_name', '');

  -- Le super-admin n'appartient à aucune entreprise (accès global via is_super_admin())
  if new.email = 'muhammadsamb@gmail.com' then
    insert into public.profiles (id, email, role, display_name)
    values (new.id, new.email, 'admin', v_display_name)
    on conflict (id) do update set role = 'admin';
    return new;
  end if;

  -- Entreprise existante (la plus ancienne) — référence d'exclusivité.
  select id, name into v_existing_id, v_existing_name
  from public.companies
  order by created_at asc
  limit 1;

  -- ── Compte provisionné par l'admin : entreprise + rôle imposés ──────────────
  v_company_id := nullif(new.raw_user_meta_data ->> 'company_id', '')::uuid;
  if v_company_id is not null then
    v_role := coalesce(nullif(new.raw_user_meta_data ->> 'role', ''), 'agent');
    if v_role not in ('manager', 'agent') then
      v_role := 'agent';
    end if;
    insert into public.profiles (id, email, role, company_id, display_name)
    values (new.id, new.email, v_role, v_company_id, v_display_name)
    on conflict (id) do update
      set company_id = excluded.company_id, role = excluded.role, display_name = excluded.display_name;
    return new;
  end if;

  -- ── Verrou : une entreprise existe déjà → rattachement, pas de création ─────
  if v_existing_id is not null then
    insert into public.profiles (id, email, role, company_id, display_name)
    values (new.id, new.email, 'agent', v_existing_id, v_display_name)
    on conflict (id) do update
      set company_id = excluded.company_id, display_name = excluded.display_name;
    return new;
  end if;

  -- ── Bootstrap : aucune entreprise encore → création de la première ──────────
  v_company_name := coalesce(nullif(new.raw_user_meta_data ->> 'company_name', ''), 'Mon entreprise');

  insert into public.companies (name) values (v_company_name) returning id into v_company_id;

  insert into public.profiles (id, email, role, company_id, display_name)
  values (new.id, new.email, 'manager', v_company_id, v_display_name)
  on conflict (id) do update
    set company_id = excluded.company_id, role = excluded.role;

  insert into public.company_settings (company_id, company_name)
  values (v_company_id, v_company_name)
  on conflict (company_id) do nothing;

  return new;
end;
$$;
