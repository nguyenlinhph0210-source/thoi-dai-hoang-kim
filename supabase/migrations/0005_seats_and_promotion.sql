begin;
-- Server-only optimistic world commits. Global lock precedes pools/accounts/characters.
alter table public.promotion_requirements add column if not exists superseded_at timestamptz;
create or replace function public.lock_promotion_requirements() returns trigger language plpgsql set search_path='' as $$
begin
 if (to_jsonb(new)-'superseded_at') is distinct from (to_jsonb(old)-'superseded_at') or (old.superseded_at is not null and new.superseded_at is distinct from old.superseded_at) then raise exception 'Promotion requirements are immutable'; end if;
 return new;
end $$;
create table if not exists public.rank_pool_links (
 season_id uuid not null, rank_id text not null references public.ranks(id), pool_key text not null,
 primary key(season_id,rank_id,pool_key), foreign key(season_id,pool_key) references public.seat_pools(season_id,pool_key)
);
create table if not exists public.seat_applications (
 id uuid primary key, account_id uuid not null references public.accounts(id), character_id uuid not null,
 season_id uuid not null references public.seasons(id), source_rank_id text not null references public.ranks(id), target_rank_id text not null references public.ranks(id),
 status text not null check(status in ('WAITING','PROMOTED','WITHDRAWN','REJECTED','EXPIRED')),
 created_at timestamptz not null, expires_at timestamptz not null, first_round bigint not null check(first_round>0), reason text,
 foreign key(character_id,season_id) references public.characters(id,season_id), check(expires_at>created_at)
);
alter table public.seat_applications add column if not exists submitted_revision bigint not null default 0 check(submitted_revision>=0);
create unique index if not exists one_waiting_application on public.seat_applications(character_id) where status='WAITING';
create index if not exists waiting_seat_applications on public.seat_applications(season_id,target_rank_id,first_round) where status='WAITING';
create table if not exists public.seat_assignments (
 id uuid primary key, character_id uuid not null, season_id uuid not null, pool_key text not null, seat_number integer not null,
 rank_id text not null references public.ranks(id), assigned_at timestamptz not null, released_at timestamptz,
 foreign key(character_id,season_id) references public.characters(id,season_id),
 foreign key(season_id,pool_key,seat_number) references public.rank_seats(season_id,pool_key,seat_number), check(released_at is null or released_at>=assigned_at)
);
create unique index if not exists one_active_character_seat on public.seat_assignments(character_id) where released_at is null;
create unique index if not exists one_active_pool_slot on public.seat_assignments(season_id,pool_key,seat_number) where released_at is null;
create table if not exists public.seat_rounds (
 season_id uuid not null references public.seasons(id),pool_key text not null,round_number bigint not null check(round_number>0),boundary_at timestamptz not null,processed_at timestamptz not null,
 primary key(season_id,pool_key,round_number),foreign key(season_id,pool_key) references public.seat_pools(season_id,pool_key)
);
create table if not exists public.rank_history (
 id uuid primary key,account_id uuid not null references public.accounts(id),character_id uuid not null references public.characters(id),
 from_rank_id text not null references public.ranks(id),to_rank_id text not null references public.ranks(id),from_branch public.game_branch not null,to_branch public.game_branch not null,
 created_at timestamptz not null,reason text not null check(reason in ('PROMOTION','CONVERSION')),journal jsonb not null
);
create table if not exists public.seat_world_state (
 season_id uuid primary key references public.seasons(id),revision bigint not null default 0,last_round bigint not null default 0 check(last_round>=0)
);
insert into public.seat_world_state(season_id) select id from public.seasons on conflict do nothing;

create or replace function public.ensure_rank_pools(p_season_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare pool record; rid text;
begin
 for pool in select * from (values
('civil_8',16,array['civil_8']::text[]),
('civil_7b',21,array['civil_7b']::text[]),
('civil_7',36,array['civil_7']::text[]),
('civil_6b',18,array['civil_6b']::text[]),
('civil_6',30,array['civil_6']::text[]),
('civil_5b',9,array['civil_5b']::text[]),
('civil_5',12,array['civil_5']::text[]),
('civil_4b',5,array['civil_4b']::text[]),
('civil_4',4,array['civil_4']::text[]),
('civil_3b',22,array['civil_3b']::text[]),
('civil_3',1,array['civil_3']::text[]),
('civil_2b',9,array['civil_2b']::text[]),
('civil_2',3,array['civil_2']::text[]),
('civil_1b',3,array['civil_1b']::text[]),
('military_7b',20,array['military_7b']::text[]),
('military_7',14,array['military_7']::text[]),
('military_6b',20,array['military_6b']::text[]),
('military_6',22,array['military_6']::text[]),
('military_5b',14,array['military_5b']::text[]),
('military_5',21,array['military_5']::text[]),
('military_4b',9,array['military_4b']::text[]),
('military_4',12,array['military_4']::text[]),
('military_3b',4,array['military_3b']::text[]),
('military_3',4,array['military_3']::text[]),
('military_2b',6,array['military_2b']::text[]),
('military_2',6,array['military_2']::text[]),
('military_1b',5,array['military_1b']::text[]),
('harem_11',20,array['harem_11']::text[]),
('harem_10',15,array['harem_10']::text[]),
('harem_9',10,array['harem_9']::text[]),
('harem_8',5,array['harem_8']::text[]),
('harem_7',5,array['harem_7']::text[]),
('harem_6',5,array['harem_6']::text[]),
('harem_5',4,array['harem_5']::text[]),
('harem_4',4,array['harem_4']::text[]),
('harem_3',2,array['harem_3']::text[]),
('harem_2',1,array['harem_2']::text[]),
('harem_1',1,array['harem_1']::text[]),
('inner_4',24,array['inner_4']::text[]),
('inner_5',25,array['inner_5']::text[]),
('inner_6',25,array['inner_6']::text[]),
('inner_7',7,array['inner_7']::text[]),
('inner_8',1,array['inner_8']::text[]),
('tam_thai',3,array['civil_1','military_1']::text[]),
('thai_uy',1,array['military_1']::text[])
 ) as definitions(pool_key,capacity,rank_ids) loop
  insert into public.seat_pools(season_id,pool_key,capacity) values(p_season_id,pool.pool_key,pool.capacity) on conflict(season_id,pool_key) do update set capacity=excluded.capacity;
  insert into public.rank_seats(season_id,pool_key,seat_number) select p_season_id,pool.pool_key,n from generate_series(1,pool.capacity) n on conflict do nothing;
  foreach rid in array pool.rank_ids loop
   insert into public.rank_pool_links(season_id,rank_id,pool_key) values(p_season_id,rid,pool.pool_key) on conflict do nothing;
  end loop;
 end loop;
 insert into public.seat_world_state(season_id) values(p_season_id) on conflict do nothing;
end $$;
do $$ declare s record; begin for s in select id from public.seasons loop perform public.ensure_rank_pools(s.id); end loop; end $$;
-- Standard starting ranks never occupy seats, including legacy M1 confirmations.
update public.seat_assignments a set released_at=now() from public.characters c where a.character_id=c.id and a.released_at is null and c.rank_id in ('civil_8','military_7b','harem_0','inner_1');
update public.rank_seats rs set character_id=null,assigned_at=null from public.characters c where rs.character_id=c.id and c.rank_id in ('civil_8','military_7b','harem_0','inner_1');
-- Retain other M1 physical seats if any; fresh starting characters never claim seats.
insert into public.seat_assignments(id,character_id,season_id,pool_key,seat_number,rank_id,assigned_at)
select gen_random_uuid(),rs.character_id,rs.season_id,rs.pool_key,rs.seat_number,c.rank_id,rs.assigned_at from public.rank_seats rs join public.characters c on c.id=rs.character_id
where not exists(select 1 from public.seat_assignments a where a.character_id=c.id and a.released_at is null) on conflict do nothing;

create or replace function public.seat_world_lock() returns void language sql volatile security definer set search_path='' as $$ select pg_advisory_xact_lock(310003,1); $$;
create or replace function public.seat_world_before_write() returns trigger language plpgsql security definer set search_path='' as $$ begin perform public.seat_world_lock(); return null; end $$;
create or replace function public.seat_world_after_write() returns trigger language plpgsql security definer set search_path='' as $$ begin update public.seat_world_state set revision=revision+1; return null; end $$;
do $$ declare t text; begin
 foreach t in array array['accounts','characters','seasons','ranks','promotion_requirements','seat_applications','seat_assignments','seat_pools','rank_seats','rank_pool_links','action_daily_usage','merit_daily_usage'] loop
  execute format('drop trigger if exists seat_world_before_write on public.%I',t);
  execute format('create trigger seat_world_before_write before insert or update or delete on public.%I for each statement execute function public.seat_world_before_write()',t);
  execute format('drop trigger if exists seat_world_after_write on public.%I',t);
  execute format('create trigger seat_world_after_write after insert or update or delete on public.%I for each statement execute function public.seat_world_after_write()',t);
 end loop;
end $$;
-- Preserve immutable values but select only the requirement for the CURRENT next rank.
create or replace function public.get_character_setup(p_account_id uuid) returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'revision', a.revision,
    'account', jsonb_build_object('id',a.id,'destinyPoints',a.destiny_points,'pendingRewardSilver',a.pending_reward_silver,'freeRerollsLeft',a.free_rerolls_left,'hasCreatedCharacter',a.has_created_character,'actionPoints',a.action_points,'lastApGrantDateUtc7',a.last_ap_grant_date_utc7),
    'character', (select jsonb_build_object('id',c.id,'accountId',c.account_id,'seasonId',c.season_id,'branch',c.branch,'origin',c.origin,'rankId',c.rank_id,'status',c.status,'age',c.age,'rankEnteredAt',c.rank_entered_at,'merit',c.merit,'examPassedForRankId',c.exam_passed_for_rank_id,'examPassedGameDay',c.exam_passed_game_day,'startAge',c.start_age,'startGameYear',c.start_game_year,'treatmentsRemaining',c.treatments_remaining,'actionLocked',c.action_locked,'birthGameYear',c.birth_game_year,'int',c.int,'rep',c.rep,'fav',c.fav,'cha',c.cha,'hp',c.hp,'suspicion',c.suspicion,'suspicionFloor',c.suspicion_floor,'characterSilver',c.character_silver,'createdAt',c.created_at,'confirmedAt',c.confirmed_at,
      'promotionRequirements',(select jsonb_build_object('characterId',p.character_id,'targetRankId',p.target_rank_id,'conditions',p.conditions,'generatedAt',p.generated_at,'tableVersion',p.table_version) from public.promotion_requirements p where p.character_id=c.id and p.superseded_at is null and p.target_rank_id=(select next_rank_id from public.ranks where id=c.rank_id) order by p.generated_at desc limit 1))
    from public.characters c where c.account_id=a.id and c.status in ('DRAFT','ACTIVE','SEVERELY_ILL'))
  ) from public.accounts a where a.id=p_account_id;
$$;

do $$ begin if to_regprocedure('public.seat_3a_refresh_runtime_ap(uuid)') is null then alter function public.refresh_runtime_ap(uuid) rename to seat_3a_refresh_runtime_ap; end if; end $$;
revoke all on function public.seat_3a_refresh_runtime_ap(uuid) from public,anon,authenticated,service_role;
do $$ begin if to_regprocedure('public.seat_3a_runtime_snapshot(uuid)') is null then alter function public.runtime_snapshot(uuid) rename to seat_3a_runtime_snapshot; end if; end $$;
revoke all on function public.seat_3a_runtime_snapshot(uuid) from public,anon,authenticated,service_role;
do $$ begin if to_regprocedure('public.seat_3a_commit_runtime_setup(uuid,bigint,uuid,text,jsonb,jsonb,bigint)') is null then alter function public.commit_runtime_setup(uuid,bigint,uuid,text,jsonb,jsonb,bigint) rename to seat_3a_commit_runtime_setup; end if; end $$;
revoke all on function public.seat_3a_commit_runtime_setup(uuid,bigint,uuid,text,jsonb,jsonb,bigint) from public,anon,authenticated,service_role;
do $$ begin if to_regprocedure('public.seat_3a_commit_game_action(uuid,bigint,uuid,text,jsonb)') is null then alter function public.commit_game_action(uuid,bigint,uuid,text,jsonb) rename to seat_3a_commit_game_action; end if; end $$;
revoke all on function public.seat_3a_commit_game_action(uuid,bigint,uuid,text,jsonb) from public,anon,authenticated,service_role;

create or replace function public.refresh_runtime_ap(p_account_id uuid) returns void language plpgsql security definer set search_path='' as $$ begin perform public.seat_world_lock();perform public.seat_3a_refresh_runtime_ap(p_account_id);end $$;
create or replace function public.runtime_snapshot(p_account_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare state jsonb; app jsonb; start_at timestamptz;
begin
 perform public.seat_world_lock();state:=public.seat_3a_runtime_snapshot(p_account_id);
 select jsonb_build_object('id',a.id,'sourceRankId',a.source_rank_id,'targetRankId',a.target_rank_id,'status',a.status,'createdAt',a.created_at,'expiresAt',a.expires_at,'firstRound',a.first_round,'reason',a.reason) into app from public.seat_applications a where a.character_id=(state->'character'->>'id')::uuid order by a.submitted_revision desc,a.created_at desc,a.id desc limit 1;
 start_at:=(state->'season'->>'seasonStartTimestamp')::timestamptz;
 return state||jsonb_build_object('seatApplication',app,'nextSeatRoundAt',floor(extract(epoch from(start_at+(floor(greatest(0,extract(epoch from(now()-start_at)))/2100)+1)*interval '2100 seconds'))*1000));
end $$;
create or replace function public.commit_runtime_setup(p_account_id uuid,p_revision bigint,p_key uuid,p_command text,p_candidate jsonb,p_requirements jsonb,p_game_day bigint) returns jsonb language plpgsql security definer set search_path='' as $$ begin perform public.seat_world_lock();return public.seat_3a_commit_runtime_setup(p_account_id,p_revision,p_key,p_command,p_candidate,p_requirements,p_game_day);end $$;
create or replace function public.commit_game_action(p_account_id uuid,p_revision bigint,p_key uuid,p_code text,p_proposal jsonb) returns jsonb language plpgsql security definer set search_path='' as $$ begin perform public.seat_world_lock();return public.seat_3a_commit_game_action(p_account_id,p_revision,p_key,p_code,p_proposal);end $$;
create or replace function public.seat_world_clock() returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.seasons; last_round bigint;
begin
 perform public.seat_world_lock();select * into strict s from public.seasons where status='ACTIVE';select w.last_round into last_round from public.seat_world_state w where season_id=s.id;
 return jsonb_build_object('due',floor(greatest(0,extract(epoch from(now()-s.season_start_timestamp)))/2100)>coalesce(last_round,0) or exists(select 1 from public.seat_applications where season_id=s.id and status='WAITING' and expires_at<=now()));
end $$;
create or replace function public.seat_world_load() returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.seasons; states jsonb:='[]'; a record; state jsonb; version bigint; last_round bigint;
begin
 perform public.seat_world_lock();select * into strict s from public.seasons where status='ACTIVE';
 for a in select id from public.accounts order by id loop state:=public.runtime_snapshot(a.id);states:=states||jsonb_build_array(state);end loop;
 select w.revision,w.last_round into strict version,last_round from public.seat_world_state w where season_id=s.id;
 return jsonb_build_object('version',version,'lastRound',last_round,'serverNow',floor(extract(epoch from now())*1000),'season',jsonb_build_object('id',s.id,'name',s.name,'scenarioCode',s.scenario_code,'status',s.status,'seasonStartTimestamp',s.season_start_timestamp,'endedAt',s.ended_at,'fictional',true),'states',states,
 'applications',coalesce((select jsonb_agg(jsonb_build_object('id',id,'accountId',account_id,'characterId',character_id,'seasonId',season_id,'sourceRankId',source_rank_id,'targetRankId',target_rank_id,'status',status,'createdAt',created_at,'expiresAt',expires_at,'firstRound',first_round,'submittedRevision',submitted_revision,'reason',reason) order by id) from public.seat_applications where season_id=s.id),'[]'),
 'assignments',coalesce((select jsonb_agg(jsonb_build_object('id',id,'characterId',character_id,'poolKey',pool_key,'seatNumber',seat_number,'rankId',rank_id,'assignedAt',assigned_at,'releasedAt',released_at) order by id) from public.seat_assignments where season_id=s.id),'[]'),
 'rounds',coalesce((select jsonb_agg(jsonb_build_object('poolKey',pool_key,'roundNumber',round_number,'boundaryAt',boundary_at,'processedAt',processed_at)) from public.seat_rounds where season_id=s.id and round_number>last_round),'[]'),
 'history','[]'::jsonb,
 'requirements',coalesce((select jsonb_agg(jsonb_build_object('characterId',p.character_id,'targetRankId',p.target_rank_id,'conditions',p.conditions,'generatedAt',p.generated_at,'tableVersion',p.table_version,'supersededAt',p.superseded_at)) from public.promotion_requirements p join public.characters c on c.id=p.character_id where c.season_id=s.id),'[]'));
end $$;

-- Proposal contains only changed rows, produced by the private TypeScript engine.
create or replace function public.commit_seat_world(p_version bigint,p_proposal jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.seasons; w public.seat_world_state; request jsonb:=p_proposal->'request'; prior public.action_requests; row jsonb; c jsonb; a public.accounts; used integer; result jsonb; today date:=(now() at time zone 'Asia/Ho_Chi_Minh')::date; cost integer; cap integer;
begin
 perform public.seat_world_lock();select * into strict s from public.seasons where status='ACTIVE';
 if request is not null and request<>'null'::jsonb then
  select * into prior from public.action_requests where account_id=(request->>'accountId')::uuid and idempotency_key=(request->>'key')::uuid;
  if found then if prior.action_code is distinct from request->>'code' then raise exception 'Idempotency key reused';end if;return prior.result;end if;
 end if;
 select * into strict w from public.seat_world_state where season_id=s.id for update;
 if w.revision is distinct from p_version then raise exception 'STALE_REVISION';end if;
 if (p_proposal->>'lastRound')::bigint < w.last_round then raise exception 'Round regression';end if;
 if p_proposal->>'seasonId' is distinct from s.id::text or (p_proposal->>'gameDay')::bigint is distinct from floor(greatest(0,extract(epoch from(now()-s.season_start_timestamp)))/300)::bigint or p_proposal->>'date' is distinct from today::text then raise exception 'RETRY_CLOCK';end if;
 perform 1 from public.seat_pools where season_id=s.id order by pool_key for update;
 perform 1 from public.accounts order by id for update;
 perform 1 from public.characters where season_id=s.id order by id for update;
 if request is not null and request<>'null'::jsonb then
  select * into strict a from public.accounts where id=(request->>'accountId')::uuid;
  cost:=(p_proposal->'policy'->>'apCost')::int;cap:=(p_proposal->'policy'->>'dailyCap')::int;
  if request->>'code' not in ('APPLY','WITHDRAW') or cost is null or cost<0 or cap is null or cap<=0 or a.ap<cost or (request->>'code'='WITHDRAW' and cost<>0) then raise exception 'Invalid seat action';end if;
  select count into used from public.action_daily_usage where account_id=a.id and usage_date=today and action_code=request->>'code';
  if coalesce(used,0)>=cap then raise exception 'Daily cap reached';end if;
  if request->>'code'='APPLY' and not exists(select 1 from public.characters where account_id=a.id and status='ACTIVE' and not action_locked) then raise exception 'Character action locked';end if;
  result:=request->'result';
  if (result->'log'->>'apSpent')::int is distinct from cost or (result->'log'->>'apAfter')::int is distinct from a.ap-cost then raise exception 'Invalid AP result';end if;
 end if;
 for row in select value from jsonb_array_elements(p_proposal->'states') loop
  select * into strict a from public.accounts where id=(row->'account'->>'id')::uuid;
  if a.revision is distinct from (row->>'previousRevision')::bigint then raise exception 'STALE_REVISION';end if;
  if (row->'account'->>'actionPoints')::int not between 0 and 15 then raise exception 'Invalid AP';end if;
  c:=row->'character';
  update public.characters set branch=(c->>'branch')::public.game_branch,rank_id=c->>'rankId',rank_entered_at=(c->>'rankEnteredAt')::timestamptz,status=(c->>'status')::public.character_status,treatments_remaining=(c->>'treatmentsRemaining')::int,rep=(c->>'rep')::int,fav=(c->>'fav')::int,exam_passed_for_rank_id=c->>'examPassedForRankId',exam_passed_game_day=(c->>'examPassedGameDay')::bigint where id=(c->>'id')::uuid and account_id=a.id and season_id=s.id;
  if not found then raise exception 'Character mismatch';end if;
  update public.accounts set ap=(row->'account'->>'actionPoints')::int,revision=(row->>'revision')::bigint where id=a.id;
 end loop;
 -- Release old assignments first, then claim new slots; unique indexes enforce exclusivity.
 for row in select value from jsonb_array_elements(p_proposal->'assignments') where value->>'releasedAt' is not null loop
  update public.seat_assignments set released_at=(row->>'releasedAt')::timestamptz where id=(row->>'id')::uuid and released_at is null;
  update public.rank_seats set character_id=null,assigned_at=null where season_id=s.id and pool_key=row->>'poolKey' and seat_number=(row->>'seatNumber')::int and character_id=(row->>'characterId')::uuid;
 end loop;
 for row in select value from jsonb_array_elements(p_proposal->'assignments') where value->>'releasedAt' is null loop
  if not exists(select 1 from public.rank_pool_links where season_id=s.id and rank_id=row->>'rankId' and pool_key=row->>'poolKey') then raise exception 'Pool rank mismatch';end if;
  insert into public.seat_assignments(id,character_id,season_id,pool_key,seat_number,rank_id,assigned_at) values((row->>'id')::uuid,(row->>'characterId')::uuid,s.id,row->>'poolKey',(row->>'seatNumber')::int,row->>'rankId',(row->>'assignedAt')::timestamptz) on conflict(id) do nothing;
  update public.rank_seats set character_id=(row->>'characterId')::uuid,assigned_at=(row->>'assignedAt')::timestamptz where season_id=s.id and pool_key=row->>'poolKey' and seat_number=(row->>'seatNumber')::int and (character_id is null or character_id=(row->>'characterId')::uuid);
  if not found then raise exception 'Seat already claimed';end if;
 end loop;
 for row in select value from jsonb_array_elements(p_proposal->'applications') loop
  insert into public.seat_applications(id,account_id,character_id,season_id,source_rank_id,target_rank_id,status,created_at,expires_at,first_round,submitted_revision,reason)
  values((row->>'id')::uuid,(row->>'accountId')::uuid,(row->>'characterId')::uuid,s.id,row->>'sourceRankId',row->>'targetRankId',row->>'status',(row->>'createdAt')::timestamptz,(row->>'expiresAt')::timestamptz,(row->>'firstRound')::bigint,(row->>'submittedRevision')::bigint,row->>'reason')
  on conflict(id) do update set status=excluded.status,reason=excluded.reason;
 end loop;
 for row in select value from jsonb_array_elements(p_proposal->'requirements') loop
  if row->>'supersededAt' is not null then update public.promotion_requirements set superseded_at=(row->>'supersededAt')::timestamptz where character_id=(row->>'characterId')::uuid and target_rank_id=row->>'targetRankId';
  else
   if public.valid_promotion_v1((select branch from public.characters where id=(row->>'characterId')::uuid),row->'conditions') is not true then raise exception 'Invalid v1 requirements';end if;
   insert into public.promotion_requirements(character_id,target_rank_id,conditions,generated_at,table_version,thresholds) values((row->>'characterId')::uuid,row->>'targetRankId',row->'conditions',(row->>'generatedAt')::timestamptz,'v1',(select jsonb_object_agg(x->>'stat',x->'value') from jsonb_array_elements(row->'conditions') x)) on conflict do nothing;
  end if;
 end loop;
 for row in select value from jsonb_array_elements(p_proposal->'rounds') loop
  insert into public.seat_rounds(season_id,pool_key,round_number,boundary_at,processed_at) values(s.id,row->>'poolKey',(row->>'roundNumber')::bigint,(row->>'boundaryAt')::timestamptz,(row->>'processedAt')::timestamptz) on conflict do nothing;
 end loop;
 for row in select value from jsonb_array_elements(p_proposal->'history') loop
  insert into public.rank_history(id,account_id,character_id,from_rank_id,to_rank_id,from_branch,to_branch,created_at,reason,journal) values((row->>'id')::uuid,(row->>'accountId')::uuid,(row->>'characterId')::uuid,row->>'fromRankId',row->>'toRankId',(row->>'fromBranch')::public.game_branch,(row->>'toBranch')::public.game_branch,(row->>'createdAt')::timestamptz,row->>'reason',row->'journal') on conflict do nothing;
 end loop;
 update public.seat_world_state set last_round=(p_proposal->>'lastRound')::bigint,revision=revision+1 where season_id=s.id;
 if request is not null and request<>'null'::jsonb then
  insert into public.action_daily_usage(account_id,usage_date,action_code,count) values((request->>'accountId')::uuid,today,request->>'code',1) on conflict(account_id,usage_date,action_code) do update set count=public.action_daily_usage.count+1;
  insert into public.action_requests(account_id,idempotency_key,action_code,result) values((request->>'accountId')::uuid,(request->>'key')::uuid,request->>'code',result);
  insert into public.action_logs(id,account_id,character_id,action_code,idempotency_key,before_stats,after_stats,ap_spent,modifiers,world_time,result) values((result->'log'->>'id')::uuid,(request->>'accountId')::uuid,(result->'log'->>'characterId')::uuid,request->>'code',(request->>'key')::uuid,result->'log'->'before',result->'log'->'after',(result->'log'->>'apSpent')::int,result->'log'->'modifiers',result->'log'->'worldTime',result);
  if request->>'code'='APPLY' then insert into public.character_week_marks(character_id,season_id,game_week,first_action_id) values((result->'log'->>'characterId')::uuid,s.id,((p_proposal->>'gameDay')::bigint/7)::int+1,(result->'log'->>'id')::uuid) on conflict do nothing;end if;
  return result;
 end if;
 return '{}'::jsonb;
end $$;
alter table public.action_logs drop constraint if exists action_logs_ap_spent_check;
alter table public.action_logs add constraint action_logs_ap_spent_check check(ap_spent>0 or (ap_spent=0 and action_code='WITHDRAW'));

create or replace function public.release_seats(p_character_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform public.seat_world_lock();perform 1 from public.seat_pools order by season_id,pool_key for update;
 perform 1 from public.characters where id=p_character_id for update;
 update public.seat_assignments set released_at=now() where character_id=p_character_id and released_at is null;
 update public.rank_seats set character_id=null,assigned_at=null where character_id=p_character_id;
end $$;
-- Trusted event backend supplies a pure conversion proposal; there is deliberately no HTTP endpoint.
create or replace function public.convert_inner_court_to_harem(p_character_id uuid,p_version bigint,p_proposal jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.characters; candidate jsonb;
begin
 perform public.seat_world_lock();select * into strict c from public.characters where id=p_character_id;
 if c.branch<>'INNER_COURT' or c.rank_id not in ('inner_2','inner_3','inner_4','inner_5','inner_6') or c.status<>'ACTIVE' or c.action_locked or c.cha<150 or c.int<100 or c.suspicion>45 then raise exception 'Conversion guard failed';end if;
 select x->'character' into strict candidate from jsonb_array_elements(p_proposal->'states') x where x->'character'->>'id'=c.id::text;
 if candidate->>'branch' is distinct from 'HAREM' or candidate->>'rankId' is distinct from (case when c.rank_id in ('inner_5','inner_6') then 'harem_13' else 'harem_14' end) or (candidate->>'fav')::int is distinct from least(120,floor(0.35*c.fav)::int+25) then raise exception 'Invalid conversion formula';end if;
 if exists(select 1 from unnest(array['int','rep','cha','hp','suspicion','suspicionFloor','characterSilver','merit']) k where candidate->>k is distinct from (case k when 'suspicionFloor' then c.suspicion_floor::text when 'characterSilver' then c.character_silver::text else to_jsonb(c)->>k end)) then raise exception 'Conversion must preserve stats';end if;
 return public.commit_seat_world(p_version,p_proposal);
end $$;
-- Counts only: normal reads do not load private worlds or grant AP to unrelated accounts.
create or replace function public.read_seat_board() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('rankId',r.id,'name',r.name,'branch',r.branch,
 'total',(select sum(p.capacity) from public.rank_pool_links l join public.seat_pools p using(season_id,pool_key) where l.season_id=s.id and l.rank_id=r.id),
 'occupied',(select count(*) from public.seat_assignments a join public.rank_pool_links l using(season_id,pool_key) where a.season_id=s.id and l.rank_id=r.id and a.released_at is null),
 'waiting',(select count(*) from public.seat_applications a where a.season_id=s.id and a.target_rank_id=r.id and a.status='WAITING'),
 'starting',r.id in ('civil_8','military_7b','harem_0','inner_1')) order by r.id),'[]'::jsonb)
 from public.ranks r cross join public.seasons s where s.status='ACTIVE';
$$;
create or replace function public.read_game_journal(p_account_id uuid,p_page integer) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(log order by created_at desc,id desc),'[]'::jsonb) from (
 select * from (select result->'log' as log,created_at,id from public.action_logs where account_id=p_account_id union all select journal,created_at,id from public.rank_history where account_id=p_account_id) entries order by created_at desc,id desc offset greatest(0,p_page)*20 limit 21) page;
$$;

-- All new raw world data are private. Only one's own application metadata is readable directly.
do $$ declare t text; begin
 foreach t in array array['rank_pool_links','seat_applications','seat_assignments','seat_rounds','rank_history','seat_world_state'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
grant select on public.seat_applications to authenticated;
drop policy if exists own_seat_applications on public.seat_applications;
create policy own_seat_applications on public.seat_applications for select to authenticated using(account_id=(select auth.uid()));
-- M1 writer is called only by the owner-definer runtime setup wrapper, never directly.
revoke all on function public.commit_character_setup(uuid,uuid,bigint,uuid,text,jsonb,jsonb) from public,anon,authenticated,service_role;
-- Never grant rank_history.journal to clients: it contains hidden before/after stats.
do $$ declare f record; begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('ensure_rank_pools','seat_world_lock','seat_world_before_write','seat_world_after_write','seat_world_clock','seat_world_load','commit_seat_world','release_seats','convert_inner_court_to_harem','read_game_journal','read_seat_board','refresh_runtime_ap','runtime_snapshot','commit_runtime_setup','commit_game_action','get_character_setup','lock_promotion_requirements') loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
  execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;
commit;
