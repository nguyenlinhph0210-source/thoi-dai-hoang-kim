begin;

-- PostgREST enables pg-safeupdate, including SQL issued inside trigger/RPC calls.
-- Only the ACTIVE world's optimistic snapshots can still be committed. Writes to
-- accounts or historical rows must invalidate that world, not every ended season.
create or replace function public.seat_world_after_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.seat_world_state
  set revision = revision + 1
  where season_id in (
    select id from public.seasons where status = 'ACTIVE'
  );
  return null;
end;
$$;

revoke all on function public.seat_world_after_write() from public, anon, authenticated;
grant execute on function public.seat_world_after_write() to service_role;

commit;
