-- Percepta ID — autorise l'acquittement des alertes "pièce expirée".

alter table public.alert_acks drop constraint if exists alert_acks_alert_type_check;
alter table public.alert_acks
  add constraint alert_acks_alert_type_check
  check (alert_type in ('over_8h', 'over_12h', 'zone_danger_4h', 'id_expired'));
