-- Percepta ID — ajout des champs CNI complets + checkout_status

alter table public.access_logs
  add column if not exists first_name   text,
  add column if not exists birth_date   text,
  add column if not exists nationality  text,
  add column if not exists company      text;

-- checkout_status pour le suivi explicite présence/sortie
alter table public.access_logs
  add column if not exists checkout_status text not null default 'present'
    check (checkout_status in ('present', 'departed'));

-- Rétro-compatibilité : les lignes existantes avec checked_out_at doivent être 'departed'
update public.access_logs
  set checkout_status = 'departed'
  where checked_out_at is not null
    and checkout_status = 'present';

create index if not exists access_logs_checkout_status_idx
  on public.access_logs (checkout_status);
