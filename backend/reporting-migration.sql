-- Run once in the Supabase SQL editor, after supabase-schema.sql.
begin;
create table if not exists public.reporting_settings (
  id integer primary key check (id = 1),
  started_at timestamptz not null default now()
);
insert into public.reporting_settings (id) values (1) on conflict do nothing;
alter table public.reporting_settings enable row level security;
revoke all on public.reporting_settings from anon, authenticated;

-- Record history in the same transaction as the profile update.
create or replace function public.record_child_attendance() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.last_check_in is distinct from old.last_check_in and new.last_check_in is not null then
    insert into public.attendance (child_id, checked_in_at) values (new.id, new.last_check_in);
  end if;
  if new.last_check_out is distinct from old.last_check_out and new.last_check_out is not null then
    update public.attendance set checked_out_at = new.last_check_out
    where child_id = new.id and checked_out_at is null;
  end if;
  return new;
end;
$$;
drop trigger if exists record_child_attendance on public.children;
create trigger record_child_attendance after update on public.children
for each row execute function public.record_child_attendance();
commit;
