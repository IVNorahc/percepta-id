-- Percepta ID — Sécurisation du bucket "documents" (photos CNI, logos).
-- Le bucket passe en privé : l'accès se fait uniquement via URLs signées,
-- réservées aux utilisateurs authentifiés.

update storage.buckets set public = false where id = 'documents';

-- Retirer les anciennes politiques (dont la lecture publique anonyme)
drop policy if exists "Authenticated users can upload documents" on storage.objects;
drop policy if exists "Authenticated users can read documents"   on storage.objects;
drop policy if exists "Public can view documents"                on storage.objects;
drop policy if exists "auth_upload"  on storage.objects;
drop policy if exists "company_read" on storage.objects;
drop policy if exists "auth_delete"  on storage.objects;

-- Upload : utilisateurs authentifiés
create policy "auth_upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documents');

-- Lecture : utilisateurs authentifiés uniquement (plus d'accès anonyme)
create policy "company_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'documents' and auth.uid() is not null);

-- Suppression : utilisateurs authentifiés
create policy "auth_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'documents');
