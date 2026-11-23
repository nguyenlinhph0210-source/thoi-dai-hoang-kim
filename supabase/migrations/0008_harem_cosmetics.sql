begin;
create table if not exists public.character_items(
 character_id uuid not null references public.characters(id), item_code text not null, primary key(character_id,item_code)
);
alter table public.character_items enable row level security;
revoke all on public.character_items from anon,authenticated;
grant all on public.character_items to service_role;
create table if not exists public.character_equipment(
 character_id uuid not null references public.characters(id), slot text not null check(slot in ('OUTFIT','HEAD','ACCESSORY')), item_code text not null,
 primary key(character_id,slot),foreign key(character_id,item_code) references public.character_items(character_id,item_code)
);
alter table public.character_equipment enable row level security;
revoke all on public.character_equipment from anon,authenticated;
grant all on public.character_equipment to service_role;
create table if not exists public.character_chamber(
 character_id uuid primary key references public.characters(id),level integer not null default 1 check(level between 1 and 5),owned_decor jsonb not null default '[]',
 decor jsonb not null default '{"SCREEN":"SCREEN_0","LANTERN":"LANTERN_0","TABLE":"TABLE_0","PLANT":"PLANT_0","PAINTING":"PAINTING_0","INCENSE":"INCENSE_0"}'
);
alter table public.character_chamber enable row level security;
revoke all on public.character_chamber from anon,authenticated;
grant all on public.character_chamber to service_role;
create table if not exists public.character_titles(
 character_id uuid not null references public.characters(id),milestone_rank_id text not null references public.ranks(id),title_code text not null,
 title_order integer not null check(title_order>0),granted_at timestamptz not null,primary key(character_id,milestone_rank_id),unique(character_id,title_order)
);
alter table public.character_titles enable row level security;
revoke all on public.character_titles from anon,authenticated;
grant all on public.character_titles to service_role;
create table if not exists public.cosmetic_daily_usage(
 account_id uuid not null references public.accounts(id),usage_date date not null,count integer not null check(count>=0),primary key(account_id,usage_date)
);
alter table public.cosmetic_daily_usage enable row level security;
revoke all on public.cosmetic_daily_usage from anon,authenticated;
grant all on public.cosmetic_daily_usage to service_role;
-- Same world lock/CAS as actions and rank changes: changing clothes invalidates old reward proposals.
do $$ declare t text;begin
 foreach t in array array['character_items','character_equipment','character_chamber','character_titles','cosmetic_daily_usage'] loop
  execute format('drop trigger if exists seat_world_before_write on public.%I',t);
  execute format('create trigger seat_world_before_write before insert or update or delete on public.%I for each statement execute function public.seat_world_before_write()',t);
  execute format('drop trigger if exists seat_world_after_write on public.%I',t);
  execute format('create trigger seat_world_after_write after insert or update or delete on public.%I for each statement execute function public.seat_world_after_write()',t);
 end loop;
end $$;
create or replace function public.read_character_cosmetics(p_account_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('characterId',c.id,
 'ownedItemCodes',coalesce((select jsonb_agg(item_code order by item_code) from public.character_items where character_id=c.id),'[]'::jsonb),
 'equipment',coalesce((select jsonb_object_agg(slot,item_code) from public.character_equipment where character_id=c.id),'{}'::jsonb),
 'chamber',coalesce((select jsonb_build_object('level',level,'ownedDecorCodes',owned_decor,'decor',decor) from public.character_chamber where character_id=c.id),'{"level":1,"ownedDecorCodes":[],"decor":{"SCREEN":"SCREEN_0","LANTERN":"LANTERN_0","TABLE":"TABLE_0","PLANT":"PLANT_0","PAINTING":"PAINTING_0","INCENSE":"INCENSE_0"}}'::jsonb),
 'titles',coalesce((select jsonb_agg(jsonb_build_object('rankId',milestone_rank_id,'titleCode',title_code,'grantedAt',granted_at) order by title_order) from public.character_titles where character_id=c.id),'[]'::jsonb),
 'purchasesToday',coalesce((select count from public.cosmetic_daily_usage where account_id=c.account_id and usage_date=(now() at time zone 'Asia/Ho_Chi_Minh')::date),0))
 from public.characters c where c.account_id=p_account_id and c.branch='HAREM' and c.status in ('DRAFT','ACTIVE','SEVERELY_ILL');
$$;
do $$ begin if to_regprocedure('public.harem_4a_seat_world_load()') is null then alter function public.seat_world_load() rename to harem_4a_seat_world_load;end if;end $$;
create or replace function public.seat_world_load() returns jsonb language plpgsql security definer set search_path='' as $$
declare world jsonb;states jsonb;begin
 perform public.seat_world_lock();world:=public.harem_4a_seat_world_load();
 select coalesce(jsonb_agg(value||jsonb_build_object('cosmetics',public.read_character_cosmetics((value->'account'->>'id')::uuid))),'[]'::jsonb) into states from jsonb_array_elements(world->'states');
 return world||jsonb_build_object('states',states);
end $$;
-- Titles are part of the very same commit used by rounds, immediate promotion and event conversions.
do $$ begin if to_regprocedure('public.harem_4a_commit_seat_world(bigint,jsonb)') is null then alter function public.commit_seat_world(bigint,jsonb) rename to harem_4a_commit_seat_world;end if;end $$;
create or replace function public.commit_seat_world(p_version bigint,p_proposal jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare row jsonb;t jsonb;c public.characters;existing public.character_titles;current_title text;result jsonb;position integer;begin
 perform public.seat_world_lock();
 for row in select value from jsonb_array_elements(p_proposal->'states') loop
  select * into strict c from public.characters where id=(row->'character'->>'id')::uuid;
  if row->'character'->>'branch'='HAREM' and c.rank_id is distinct from row->'character'->>'rankId' and (jsonb_typeof(p_proposal->'haremTitlePolicy'->'milestones') is distinct from 'array' or jsonb_typeof(p_proposal->'haremTitlePolicy'->'codes') is distinct from 'array') then raise exception 'Invalid title policy';end if;
  if row->'character'->>'branch'='HAREM' and c.rank_id is distinct from row->'character'->>'rankId' and exists(select 1 from jsonb_array_elements_text(p_proposal->'haremTitlePolicy'->'milestones') m(value) where m.value=row->'character'->>'rankId') and not exists(select 1 from public.character_titles where character_id=c.id and milestone_rank_id=row->'character'->>'rankId') then
   if not exists(select 1 from jsonb_array_elements(coalesce(row->'cosmetics'->'titles','[]'::jsonb)) as candidate_title(value) where candidate_title.value->>'rankId'=row->'character'->>'rankId') then raise exception 'Missing promotion title';end if;
  end if;
  if row->'cosmetics' is null or row->'cosmetics'='null'::jsonb then continue;end if;
  if row->'cosmetics'->>'characterId' is distinct from c.id::text then raise exception 'Cosmetic character mismatch';end if;
  select title_code into current_title from public.character_titles where character_id=c.id order by title_order desc limit 1;
  position:=0;
  for t in select value from jsonb_array_elements(row->'cosmetics'->'titles') loop
   position:=position+1;select * into existing from public.character_titles where character_id=c.id and milestone_rank_id=t->>'rankId';
   if found then
    if existing.title_code is distinct from t->>'titleCode' or existing.title_order<>position then raise exception 'Title history is immutable';end if;
   else
    if row->'character'->>'branch' is distinct from 'HAREM' or c.rank_id=row->'character'->>'rankId' or t->>'rankId' is distinct from row->'character'->>'rankId'
     or not exists(select 1 from jsonb_array_elements_text(p_proposal->'haremTitlePolicy'->'milestones') m(value) where m.value=t->>'rankId') or not exists(select 1 from jsonb_array_elements_text(p_proposal->'haremTitlePolicy'->'codes') h(value) where h.value=t->>'titleCode')
     or current_title is not distinct from t->>'titleCode' or (t->>'grantedAt')::timestamptz is distinct from (row->'character'->>'rankEnteredAt')::timestamptz then raise exception 'Invalid promotion title';end if;
    current_title:=t->>'titleCode';
   end if;
  end loop;
 end loop;
 result:=public.harem_4a_commit_seat_world(p_version,p_proposal);
 for row in select value from jsonb_array_elements(p_proposal->'states') loop
  if row->'cosmetics' is null or row->'cosmetics'='null'::jsonb then continue;end if;
  position:=0;
  for t in select value from jsonb_array_elements(row->'cosmetics'->'titles') loop
   position:=position+1;
   insert into public.character_titles(character_id,milestone_rank_id,title_code,title_order,granted_at) values((row->'character'->>'id')::uuid,t->>'rankId',t->>'titleCode',position,(t->>'grantedAt')::timestamptz) on conflict(character_id,milestone_rank_id) do nothing;
  end loop;
 end loop;
 return result;
end $$;
create or replace function public.commit_cosmetic_action(p_account_id uuid,p_revision bigint,p_version bigint,p_key uuid,p_command jsonb,p_candidate jsonb,p_policy jsonb,p_result jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.accounts;c public.characters;prior public.action_requests;d jsonb;expected jsonb;before_stats jsonb;code text:=p_command->>'code';op text:=p_command->>'type';slot text:=p_policy->>'slot';price bigint:=(p_policy->>'price')::bigint;tier integer;today date:=(now() at time zone 'Asia/Ho_Chi_Minh')::date;purchase boolean:=op in ('BUY_ITEM','BUY_DECOR');sid uuid;begin
 perform public.seat_world_lock();
 select * into prior from public.action_requests where account_id=p_account_id and idempotency_key=p_key;
 if found then if prior.action_code<>'COSMETIC' or prior.payload is distinct from p_command then raise exception 'Idempotency key reused';end if;return prior.result;end if;
 select id into strict sid from public.seasons where status='ACTIVE';
 if (select revision from public.seat_world_state where season_id=sid) is distinct from p_version then raise exception 'STALE_REVISION';end if;
 if p_policy->>'date' is distinct from today::text then raise exception 'RETRY_CLOCK';end if;
 select * into strict a from public.accounts where id=p_account_id for update;
 if a.revision is distinct from p_revision then raise exception 'STALE_REVISION';end if;
 select * into strict c from public.characters where account_id=p_account_id and season_id=sid and status in ('ACTIVE','SEVERELY_ILL') for update;
 if c.branch<>'HAREM' or c.status<>'ACTIVE' or c.action_locked then raise exception 'Harem action locked';end if;
 select r.tier into strict tier from public.ranks r where r.id=c.rank_id;
 if (p_policy->>'minTier') is null or (p_policy->>'cap') is null or (p_policy->>'cap')::int<=0 or price is null or price<0 or c.character_silver<price or (p_policy->>'minTier')::int>tier then raise exception 'Invalid cosmetic resources or tier';end if;
 d:=public.read_character_cosmetics(p_account_id);expected:=d;
 if purchase and (d->>'purchasesToday')::int >= (p_policy->>'cap')::int then raise exception 'Purchase daily cap';end if;
 if op='BUY_ITEM' then
  if slot not in ('OUTFIT','HEAD','ACCESSORY') or price<=0 or d->'ownedItemCodes' ? code then raise exception 'Invalid item purchase';end if;
  expected:=jsonb_set(expected,'{ownedItemCodes}',d->'ownedItemCodes'||to_jsonb(code));
 elsif op='EQUIP_ITEM' then
  if slot not in ('OUTFIT','HEAD','ACCESSORY') or price<>0 or not(d->'ownedItemCodes' ? code) or d->'equipment'->>slot=code then raise exception 'Invalid equipment';end if;
  expected:=jsonb_set(expected,array['equipment',slot],to_jsonb(code));
 elsif op='UNEQUIP_ITEM' then
  if slot is distinct from p_command->>'slot' or price<>0 or not(d->'equipment' ? slot) then raise exception 'Empty equipment slot';end if;
  expected:=jsonb_set(expected,'{equipment}',(d->'equipment')-slot);
 elsif op='UPGRADE_CHAMBER' then
  if price<=0 or (d->'chamber'->>'level')::int>=5 or (p_policy->>'nextLevel')::int is distinct from (d->'chamber'->>'level')::int+1 then raise exception 'Invalid chamber upgrade';end if;
  expected:=jsonb_set(expected,'{chamber,level}',p_policy->'nextLevel');
 elsif op in ('BUY_DECOR','SET_DECOR') then
  if slot not in ('SCREEN','LANTERN','TABLE','PLANT','PAINTING','INCENSE') then raise exception 'Invalid decor slot';end if;
  if op='BUY_DECOR' then
   if price<=0 or d->'chamber'->'ownedDecorCodes' ? code or code=slot||'_0' then raise exception 'Decor already owned';end if;
   expected:=jsonb_set(expected,'{chamber,ownedDecorCodes}',d->'chamber'->'ownedDecorCodes'||to_jsonb(code));
  else
   if price<>0 or (not(d->'chamber'->'ownedDecorCodes' ? code) and code<>slot||'_0') or d->'chamber'->'decor'->>slot=code then raise exception 'Invalid decor selection';end if;
   expected:=jsonb_set(expected,array['chamber','decor',slot],to_jsonb(code));
  end if;
 else raise exception 'Unknown cosmetic command';end if;
 if purchase then expected:=jsonb_set(expected,'{purchasesToday}',to_jsonb((d->>'purchasesToday')::int+1));end if;
 if p_candidate is distinct from expected then raise exception 'Invalid cosmetic proposal';end if;
 before_stats:=jsonb_build_object('int',c.int,'rep',c.rep,'fav',c.fav,'cha',c.cha,'hp',c.hp,'suspicion',c.suspicion,'characterSilver',c.character_silver);
 if p_result->'log'->'before' is distinct from before_stats or p_result->'log'->'after' is distinct from before_stats||jsonb_build_object('characterSilver',c.character_silver-price)
  or p_result->'log'->>'characterId' is distinct from c.id::text or p_result->'log'->>'accountId' is distinct from a.id::text or p_result->'log'->>'actionCode' is distinct from 'COSMETIC'
  or (p_result->'log'->>'apSpent')::int is distinct from 0 or (p_result->'log'->>'apAfter')::int is distinct from a.ap then raise exception 'Invalid cosmetic log';end if;
 update public.characters set character_silver=character_silver-price where id=c.id;
 update public.accounts set revision=revision+1 where id=a.id;
 if op='BUY_ITEM' then insert into public.character_items(character_id,item_code) values(c.id,code);end if;
 if op='EQUIP_ITEM' then insert into public.character_equipment(character_id,slot,item_code) values(c.id,slot,code) on conflict on constraint character_equipment_pkey do update set item_code=excluded.item_code;end if;
 if op='UNEQUIP_ITEM' then delete from public.character_equipment e where e.character_id=c.id and e.slot=p_command->>'slot';end if;
 insert into public.character_chamber(character_id,level,owned_decor,decor) values(c.id,(expected->'chamber'->>'level')::int,expected->'chamber'->'ownedDecorCodes',expected->'chamber'->'decor') on conflict(character_id) do update set level=excluded.level,owned_decor=excluded.owned_decor,decor=excluded.decor;
 if purchase then insert into public.cosmetic_daily_usage(account_id,usage_date,count) values(a.id,today,1) on conflict(account_id,usage_date) do update set count=public.cosmetic_daily_usage.count+1;end if;
 insert into public.action_requests(account_id,idempotency_key,action_code,payload,result) values(a.id,p_key,'COSMETIC',p_command,p_result);
 insert into public.action_logs(id,account_id,character_id,action_code,idempotency_key,before_stats,after_stats,ap_spent,modifiers,world_time,result) values((p_result->'log'->>'id')::uuid,a.id,c.id,'COSMETIC',p_key,p_result->'log'->'before',p_result->'log'->'after',0,p_result->'log'->'modifiers',p_result->'log'->'worldTime',p_result);
 return p_result;
end $$;
create or replace function public.clear_character_cosmetics(p_character_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare aid uuid;begin
 perform public.seat_world_lock();select account_id into strict aid from public.characters where id=p_character_id;
 perform 1 from public.accounts where id=aid for update;perform 1 from public.characters where id=p_character_id for update;
 if not exists(select 1 from public.character_items where character_id=p_character_id) and not exists(select 1 from public.character_equipment where character_id=p_character_id) and not exists(select 1 from public.character_chamber where character_id=p_character_id) and not exists(select 1 from public.character_titles where character_id=p_character_id) then return;end if;
 delete from public.character_equipment where character_id=p_character_id;
 delete from public.character_items where character_id=p_character_id;
 delete from public.character_chamber where character_id=p_character_id;
 delete from public.character_titles where character_id=p_character_id;
 update public.accounts set revision=revision+1 where id=aid;
 -- Account purchase usage and immutable request/journal history intentionally survive a life ending.
end $$;
alter table public.action_logs drop constraint if exists action_logs_ap_spent_check;
alter table public.action_logs add constraint action_logs_ap_spent_check check(ap_spent>0 or(ap_spent=0 and action_code in ('WITHDRAW','RESOLVE_EVENT','COSMETIC')));
revoke all on function public.harem_4a_seat_world_load(),public.harem_4a_commit_seat_world(bigint,jsonb) from public,anon,authenticated,service_role;
do $$ declare f record;begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('read_character_cosmetics','seat_world_load','commit_seat_world','commit_cosmetic_action','clear_character_cosmetics') loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
  execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;
commit;
