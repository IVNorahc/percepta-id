-- Percepta ID — Isolation stricte du Storage par entreprise.
--
-- Les nouveaux fichiers sont rangés sous "<company_id>/...". Une politique RLS
-- vérifie que le 1er segment du chemin correspond à la company de l'utilisateur.
--
-- Transition : les fichiers historiques (chemins non préfixés : cni/, photos/,
-- logos/, employees/) appartiennent à l'entreprise par défaut (mono-tenant
-- d'origine). Ils restent lisibles UNIQUEMENT par les membres de cette
-- entreprise — donc pas d'exposition aux autres tenants.

drop policy if exists "auth_upload"  on storage.objects;
drop policy if exists "company_read" on storage.objects;
drop policy if exists "auth_delete"  on storage.objects;

-- Upload : le chemin doit être préfixé par la company de l'utilisateur.
create policy "company_upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (
      public.is_super_admin()
      or (storage.foldername(name))[1] = public.current_company_id()::text
    )
  );

-- Lecture : même company, OU fichiers legacy pour l'entreprise par défaut.
create policy "company_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and (
      public.is_super_admin()
      or (storage.foldername(name))[1] = public.current_company_id()::text
      or (
        public.current_company_id() = '00000000-0000-0000-0000-000000000001'
        and (storage.foldername(name))[1] in ('cni', 'photos', 'logos', 'employees')
      )
    )
  );

-- Suppression : mêmes règles que la lecture.
create policy "company_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and (
      public.is_super_admin()
      or (storage.foldername(name))[1] = public.current_company_id()::text
      or (
        public.current_company_id() = '00000000-0000-0000-0000-000000000001'
        and (storage.foldername(name))[1] in ('cni', 'photos', 'logos', 'employees')
      )
    )
  );
