-- ============================================================================
-- Percepta ID — Réinitialisation complète avant livraison client
-- ----------------------------------------------------------------------------
-- À exécuter dans Supabase → SQL Editor (rôle privilégié).
--
-- Effet : supprime TOUTES les données de test (entrées, employés, pointages,
-- alertes, paramètres), TOUS les comptes sauf l'admin, et TOUTES les
-- entreprises ; puis crée UNE entreprise cliente vierge prête à l'emploi.
--
-- ⚠️ Le Storage (bucket "documents") n'est PAS vidé par ce script : Supabase
--    protège storage.objects contre le DELETE en SQL. Purge-le manuellement
--    via le Dashboard (Storage → documents → Select all → Delete).
--
-- ⚠️ IRRÉVERSIBLE. Fais une sauvegarde (Database → Backups) avant de lancer.
--
-- 👉 Nom du client en dur ci-dessous ('Entreprise cliente') — modifie les deux
--    occurrences à la section 5 si besoin.
-- ============================================================================

begin;

-- ── 1. Données opérationnelles (ordre = dépendances FK) ─────────────────────
delete from public.pointages;            -- enfant de employees
delete from public.employees;
delete from public.alert_acks;           -- enfant de access_logs
delete from public.alert_notifications;
delete from public.access_logs;
delete from public.company_settings;

-- ── Storage : à vider MANUELLEMENT via le Dashboard ────────────────────────
-- Supabase protège storage.objects contre le DELETE direct en SQL.
-- Purge le bucket depuis : Storage → documents → Select all → Delete.

-- ── 2. Comptes : supprimer tous les utilisateurs sauf l'admin ───────────────
-- La suppression dans auth.users cascade vers public.profiles (FK on delete cascade)
-- ainsi que vers les sessions/identities du schéma auth.
delete from auth.users
where email is distinct from 'muhammadsamb@gmail.com';

-- ── 3. Entreprises : tout supprimer ─────────────────────────────────────────
delete from public.companies;

-- ── 4. Profil admin : unique profil restant, rôle admin global, sans company ─
delete from public.profiles
where email is distinct from 'muhammadsamb@gmail.com';

update public.profiles
set role = 'admin',
    company_id = null,
    is_active = true
where email = 'muhammadsamb@gmail.com';

-- ── 5. Amorçage : UNE entreprise cliente vierge + ses paramètres ────────────
with new_co as (
  insert into public.companies (name)
  values ('Entreprise cliente')
  returning id
)
insert into public.company_settings (company_id, company_name)
select id, 'Entreprise cliente' from new_co;

commit;

-- ── 6. Vérifications (doit afficher un état "propre") ───────────────────────
select 'companies'           as table, count(*) from public.companies
union all select 'company_settings',  count(*) from public.company_settings
union all select 'profiles',          count(*) from public.profiles
union all select 'access_logs',       count(*) from public.access_logs
union all select 'employees',         count(*) from public.employees
union all select 'pointages',         count(*) from public.pointages
union all select 'alert_acks',        count(*) from public.alert_acks
union all select 'alert_notifications',count(*) from public.alert_notifications
union all select 'auth.users',        count(*) from auth.users
union all select 'storage.documents', count(*) from storage.objects where bucket_id = 'documents';

-- Attendu : companies=1, company_settings=1, profiles=1, auth.users=1,
--           toutes les autres tables = 0 (y compris storage.documents).
