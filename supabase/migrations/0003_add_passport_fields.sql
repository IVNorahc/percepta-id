-- Percepta ID — champs multi-documents (passeport + CNI française + CEDEAO)

alter table public.access_logs
  add column if not exists type_piece   text check (type_piece in ('CNI', 'PASSEPORT', 'TITRE_SEJOUR', 'PERMIS_CONDUIRE')),
  add column if not exists expiry_date  text,
  add column if not exists sex          text check (sex in ('M', 'F'));
