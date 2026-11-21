begin;
alter table public.characters add column if not exists investigation_pending boolean not null default false;
alter table public.action_requests add column if not exists payload jsonb;
-- M1 used account/week. Preserve its rows and keys as data, while allowing a new
-- character in the same account/week to receive its own single check (Chặng 5).
alter table public.weekly_event_checks add column if not exists id uuid not null default gen_random_uuid();
alter table public.weekly_event_checks add column if not exists character_id uuid references public.characters(id);
alter table public.weekly_event_checks add column if not exists first_action_id uuid;
alter table public.weekly_event_checks add column if not exists selected_group text;
alter table public.weekly_event_checks add column if not exists character_event_id uuid;
alter table public.weekly_event_checks add column if not exists reason text;
do $$ begin
 if exists(select 1 from pg_constraint where conrelid='public.weekly_event_checks'::regclass and contype='p' and pg_get_constraintdef(oid) like '%account_id%') then alter table public.weekly_event_checks drop constraint weekly_event_checks_pkey;end if;
 if not exists(select 1 from pg_constraint where conrelid='public.weekly_event_checks'::regclass and contype='p') then alter table public.weekly_event_checks add primary key(id);end if;
end $$;
create unique index if not exists one_character_weekly_roll on public.weekly_event_checks(character_id,season_id,game_week);
create table if not exists public.character_events(
 id uuid primary key,account_id uuid not null references public.accounts(id),character_id uuid not null,season_id uuid not null references public.seasons(id),
 status text not null check(status in ('PENDING','RESOLVED','EXPIRED')),stage integer not null check(stage>=0),expires_at timestamptz not null,record jsonb not null,
 foreign key(character_id,season_id) references public.characters(id,season_id),check(record->>'id'=id::text and record->>'accountId'=account_id::text and record->>'characterId'=character_id::text and record->>'seasonId'=season_id::text),
 check(record->>'status'=status and (record->>'stage')::integer=stage)
);
alter table public.character_events enable row level security;
revoke all on public.character_events from anon,authenticated;
grant all on public.character_events to service_role;
create index if not exists pending_character_events on public.character_events(character_id,expires_at) where status='PENDING';
create table if not exists public.destiny_ledger(
 id uuid primary key,account_id uuid not null references public.accounts(id),season_id uuid not null references public.seasons(id),delta integer not null check(delta<>0),reason text not null check(reason in ('GREAT_CALAMITY','REROLL')),reference uuid not null,calamity_code text,created_at timestamptz not null,
 unique(account_id,season_id,calamity_code),unique(account_id,reason,reference),foreign key(account_id,season_id,calamity_code) references public.account_calamity_claims(account_id,season_id,calamity_code)
);
alter table public.destiny_ledger enable row level security;
revoke all on public.destiny_ledger from anon,authenticated;
grant all on public.destiny_ledger to service_role;
alter table public.weekly_event_checks enable row level security;
alter table public.account_calamity_claims enable row level security;
revoke all on public.weekly_event_checks,public.account_calamity_claims from anon,authenticated;
grant all on public.weekly_event_checks,public.account_calamity_claims to service_role;
create or replace function public.lock_character_event_definition() returns trigger language plpgsql set search_path='' as $$
begin
 if new.id is distinct from old.id or new.account_id is distinct from old.account_id or new.character_id is distinct from old.character_id or new.season_id is distinct from old.season_id or new.record->'definition' is distinct from old.record->'definition' or new.record->>'createdAt' is distinct from old.record->>'createdAt' or new.expires_at is distinct from old.expires_at then raise exception 'Event definition is immutable';end if;
 return new;
end $$;
drop trigger if exists lock_character_event_definition on public.character_events;
create trigger lock_character_event_definition before update on public.character_events for each row execute function public.lock_character_event_definition();
-- Every change invalidates the same optimistic world snapshots as seat/action writes.
do $$ declare t text;begin
 foreach t in array array['character_events','weekly_event_checks','account_calamity_claims','destiny_ledger','character_week_marks'] loop
  execute format('drop trigger if exists seat_world_before_write on public.%I',t);
  execute format('create trigger seat_world_before_write before insert or update or delete on public.%I for each statement execute function public.seat_world_before_write()',t);
  execute format('drop trigger if exists seat_world_after_write on public.%I',t);
  execute format('create trigger seat_world_after_write after insert or update or delete on public.%I for each statement execute function public.seat_world_after_write()',t);
 end loop;
end $$;
create or replace function public.get_character_setup(p_account_id uuid) returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'revision', a.revision,
    'account', jsonb_build_object('id',a.id,'destinyPoints',a.destiny_points,'pendingRewardSilver',a.pending_reward_silver,'freeRerollsLeft',a.free_rerolls_left,'hasCreatedCharacter',a.has_created_character,'actionPoints',a.action_points,'lastApGrantDateUtc7',a.last_ap_grant_date_utc7),
    'character', (select jsonb_build_object('id',c.id,'accountId',c.account_id,'seasonId',c.season_id,'branch',c.branch,'origin',c.origin,'rankId',c.rank_id,'status',c.status,'age',c.age,'rankEnteredAt',c.rank_entered_at,'merit',c.merit,'examPassedForRankId',c.exam_passed_for_rank_id,'examPassedGameDay',c.exam_passed_game_day,'startAge',c.start_age,'startGameYear',c.start_game_year,'treatmentsRemaining',c.treatments_remaining,'actionLocked',c.action_locked,'investigationPending',c.investigation_pending,'birthGameYear',c.birth_game_year,'int',c.int,'rep',c.rep,'fav',c.fav,'cha',c.cha,'hp',c.hp,'suspicion',c.suspicion,'suspicionFloor',c.suspicion_floor,'characterSilver',c.character_silver,'createdAt',c.created_at,'confirmedAt',c.confirmed_at,
      'promotionRequirements',(select jsonb_build_object('characterId',p.character_id,'targetRankId',p.target_rank_id,'conditions',p.conditions,'generatedAt',p.generated_at,'tableVersion',p.table_version) from public.promotion_requirements p where p.character_id=c.id and p.superseded_at is null and p.target_rank_id=(select next_rank_id from public.ranks where id=c.rank_id) order by p.generated_at desc limit 1))
    from public.characters c where c.account_id=a.id and c.status in ('DRAFT','ACTIVE','SEVERELY_ILL'))
  ) from public.accounts a where a.id=p_account_id;
$$;


-- Keep M3 readers/writers callable with their original signatures; add private metadata.
do $$ begin if to_regprocedure('public.events_3b_runtime_snapshot(uuid)') is null then alter function public.runtime_snapshot(uuid) rename to events_3b_runtime_snapshot;end if;end $$;
create or replace function public.runtime_snapshot(p_account_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare state jsonb;begin
 perform public.seat_world_lock();state:=public.events_3b_runtime_snapshot(p_account_id);
 return state||jsonb_build_object('events',coalesce((select jsonb_agg(record order by expires_at,id) from public.character_events where account_id=p_account_id and character_id=(state->'character'->>'id')::uuid and status='PENDING'),'[]'::jsonb));
end $$;
do $$ begin if to_regprocedure('public.events_3b_seat_world_load()') is null then alter function public.seat_world_load() rename to events_3b_seat_world_load;end if;end $$;
create or replace function public.seat_world_load() returns jsonb language plpgsql security definer set search_path='' as $$
declare world jsonb;s uuid;week integer;begin
 perform public.seat_world_lock();world:=public.events_3b_seat_world_load();s:=(world->'season'->>'id')::uuid;
 week:=floor(greatest(0,extract(epoch from(now()-(world->'season'->>'seasonStartTimestamp')::timestamptz)))/2100)::int+1;
 return world||jsonb_build_object('eventData',jsonb_build_object(
 'instances',coalesce((select jsonb_agg(record order by id) from public.character_events where season_id=s),'[]'::jsonb),
 'checks',coalesce((select jsonb_agg(jsonb_build_object('accountId',account_id,'characterId',character_id,'seasonId',season_id,'week',game_week,'firstActionId',first_action_id,'triggered',triggered,'group',selected_group,'eventId',character_event_id,'reason',reason)) from public.weekly_event_checks where season_id=s and character_id is not null and game_week=week),'[]'::jsonb),
 'marks',coalesce((select jsonb_agg(jsonb_build_object('characterId',character_id,'seasonId',season_id,'week',game_week,'firstActionId',first_action_id)) from public.character_week_marks where season_id=s and game_week=week),'[]'::jsonb),
 'claims',coalesce((select jsonb_agg(jsonb_build_object('accountId',account_id,'seasonId',season_id,'calamityCode',calamity_code)) from public.account_calamity_claims where season_id=s),'[]'::jsonb),
 'ledger','[]'::jsonb,'records','[]'::jsonb));
end $$;
create or replace function public.event_work_clock() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('due',exists(select 1 from public.character_events e join public.seasons s on s.id=e.season_id where e.status='PENDING' and e.expires_at<=now() and s.status='ACTIVE'));
$$;
-- New destiny spending is journaled too; pre-0007 balances are preserved without inventing history.
do $$ begin if to_regprocedure('public.events_3b_commit_runtime_setup(uuid,bigint,uuid,text,jsonb,jsonb,bigint)') is null then alter function public.commit_runtime_setup(uuid,bigint,uuid,text,jsonb,jsonb,bigint) rename to events_3b_commit_runtime_setup;end if;end $$;
create or replace function public.commit_runtime_setup(p_account_id uuid,p_revision bigint,p_key uuid,p_command text,p_candidate jsonb,p_requirements jsonb,p_game_day bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare before_points bigint;after_points bigint;result jsonb;sid uuid;begin
 perform public.seat_world_lock();select destiny_points into strict before_points from public.accounts where id=p_account_id for update;
 result:=public.events_3b_commit_runtime_setup(p_account_id,p_revision,p_key,p_command,p_candidate,p_requirements,p_game_day);
 select destiny_points into strict after_points from public.accounts where id=p_account_id;
 if after_points<before_points then
  select id into strict sid from public.seasons where status='ACTIVE';
  insert into public.destiny_ledger(id,account_id,season_id,delta,reason,reference,calamity_code,created_at) values(gen_random_uuid(),p_account_id,sid,(after_points-before_points)::int,'REROLL',p_key,null,now());
 end if;return result;
end $$;
-- A pending or deferred mandatory inquiry also blocks promotion after suspicion falls.
do $$ begin if to_regprocedure('public.events_3a_check_promotion_action(public.characters,text,jsonb,jsonb,bigint,timestamptz)') is null then alter function public.check_promotion_action(public.characters,text,jsonb,jsonb,bigint,timestamptz) rename to events_3a_check_promotion_action;end if;end $$;
create or replace function public.check_promotion_action(c public.characters,code text,policy jsonb,result jsonb,game_day bigint,stamp timestamptz) returns integer language plpgsql security definer set search_path='' as $$
begin
 if code='EXAM' and c.investigation_pending then raise exception 'Exam is locked by inquiry';end if;
 return public.events_3a_check_promotion_action(c,code,policy,result,game_day,stamp);
end $$;
create or replace function public.check_event_application(c public.characters,policy jsonb,day bigint) returns void language plpgsql security definer set search_path='' as $$
declare target text;req public.promotion_requirements;cond jsonb;v int;begin
 if c.status<>'ACTIVE' or c.action_locked or c.suspicion>=80 or c.investigation_pending then raise exception 'Application is locked';end if;
 select next_rank_id into target from public.ranks where id=c.rank_id;
 if target is null or c.exam_passed_for_rank_id is distinct from target or c.exam_passed_game_day is null or day<c.exam_passed_game_day or day>=c.exam_passed_game_day+(policy->>'examValidDays')::int then raise exception 'Invalid promotion examination';end if;
 if exists(select 1 from public.seat_applications where character_id=c.id and status='WAITING') then raise exception 'Application already waiting';end if;
 select * into strict req from public.promotion_requirements where character_id=c.id and target_rank_id=target and superseded_at is null;
 for cond in select value from jsonb_array_elements(req.conditions) loop
  if cond->>'stat' in ('hp','characterSilver') then continue;end if;
  v:=case cond->>'stat' when 'int' then c.int when 'rep' then c.rep when 'fav' then c.fav when 'cha' then c.cha when 'suspicion' then c.suspicion end;
  if v is null or (cond->>'operator'='>=' and v<(cond->>'value')::int) or (cond->>'operator'='<=' and (v>(cond->>'value')::int or c.suspicion_floor>(cond->>'value')::int)) then raise exception 'Promotion stat unmet';end if;
 end loop;
 if floor(greatest(0,extract(epoch from(now()-coalesce(c.rank_entered_at,c.confirmed_at))))/300)<(policy->>'tenureDays')::int or c.merit<(policy->>'meritRequired')::int then raise exception 'Promotion tenure/merit unmet';end if;
end $$;

-- One global CAS transaction couples costs, first-action marks, weekly RNG,
-- choices, expiry defaults, rank conversion and the once-per-season reward.
create or replace function public.commit_event_world(p_version bigint,p_proposal jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare request jsonb:=p_proposal->'request';prior public.action_requests;actor public.accounts;c public.characters;e public.character_events;row jsonb;candidate jsonb;policy jsonb:=p_proposal->'policy';result jsonb;code text;cost integer;silver integer;hp_cost integer;cap integer;used integer;credit integer:=0;day bigint:=(p_proposal->>'gameDay')::bigint;today date:=(now() at time zone 'Asia/Ho_Chi_Minh')::date;chosen jsonb;ignored jsonb;sid uuid;expected integer;delta integer;ref uuid;
begin
 perform public.seat_world_lock();select id into strict sid from public.seasons where status='ACTIVE';
 if request is not null and request<>'null'::jsonb then
  select * into prior from public.action_requests where account_id=(request->>'accountId')::uuid and idempotency_key=(request->>'key')::uuid;
  if found then
   if prior.action_code is distinct from request->>'code' or prior.payload is distinct from nullif(request->'payload','null'::jsonb) then raise exception 'Idempotency key reused';end if;
   return prior.result;
  end if;
 end if;
 if (select revision from public.seat_world_state where season_id=sid) is distinct from p_version then raise exception 'STALE_REVISION';end if;
 if p_proposal->>'date' is distinct from today::text then raise exception 'RETRY_CLOCK';end if;
 -- Lock order: world (above), pools, account IDs, character IDs, then event IDs.
 perform 1 from public.seat_pools where season_id=sid order by pool_key for update;
 perform 1 from public.accounts order by id for update;
 perform 1 from public.characters where season_id=sid order by id for update;
 if request is not null and request<>'null'::jsonb then
  select * into strict actor from public.accounts where id=(request->>'accountId')::uuid for update;
  select * into strict c from public.characters where account_id=actor.id and season_id=sid and status in ('ACTIVE','SEVERELY_ILL') for update;
  code:=request->>'code';cost:=(policy->>'apCost')::int;silver:=(policy->>'silverCost')::int;hp_cost:=(policy->>'hpCost')::int;cap:=(policy->>'dailyCap')::int;result:=request->'result';
  if code not in ('STUDY','SOCIALIZE','AUDIENCE','ETIQUETTE','WORK','REST','RUMOR','TREAT','EXAM','APPLY','WITHDRAW','RESOLVE_EVENT') or cost is null or silver is null or hp_cost is null or cap is null or cost<0 or silver<0 or hp_cost<0 or cap<=0 or (cost=0 and code not in ('WITHDRAW','RESOLVE_EVENT')) then raise exception 'Invalid event action policy';end if;
  if c.action_locked and code<>'WITHDRAW' or c.status='SEVERELY_ILL' and code not in ('TREAT','WITHDRAW') or c.status='ACTIVE' and code='TREAT' then raise exception 'Character action locked';end if;
  if actor.ap<cost or c.character_silver<silver or c.hp<hp_cost then raise exception 'Insufficient resources';end if;
  select count into used from public.action_daily_usage where account_id=actor.id and usage_date=today and action_code=code;
  if coalesce(used,0)>=cap then raise exception 'Daily cap reached';end if;
  if (result->'log'->>'apAfter')::int is distinct from actor.ap-cost or (result->'log'->>'apSpent')::int is distinct from cost or result->'log'->>'characterId' is distinct from c.id::text or result->'log'->>'actionCode' is distinct from code then raise exception 'Invalid action result';end if;
  select value into strict candidate from jsonb_array_elements(p_proposal->'states') where value->'account'->>'id'=actor.id::text;
  if (candidate->'account'->>'actionPoints')::int is distinct from actor.ap-cost then raise exception 'Invalid AP result';end if;
  if code='APPLY' then perform public.check_event_application(c,policy,day);end if;
  if code='WITHDRAW' and (cost<>0 or not exists(select 1 from public.seat_applications where character_id=c.id and status='WAITING')) then raise exception 'No waiting application';end if;
  if code='RESOLVE_EVENT' then
   select * into strict e from public.character_events where id=(request->'payload'->>'eventId')::uuid and account_id=actor.id and character_id=c.id and status='PENDING' for update;
   if e.expires_at<=now() then raise exception 'EVENT_EXPIRED';end if;
   if (request->'payload'->>'stage')::int is distinct from e.stage then raise exception 'EVENT_STAGE_CHANGED';end if;
   select value into strict chosen from jsonb_array_elements(e.record->'definition'->'stages'->e.stage->'choices') where value->>'code'=request->'payload'->>'choiceCode';
   if (chosen->>'apCost')::int is distinct from cost or (chosen->>'silverCost')::int is distinct from silver then raise exception 'Invalid choice cost';end if;
  else
   credit:=public.check_promotion_action(c,code,policy,result,day,now());
   if (candidate->'character'->>'merit')::bigint is distinct from c.merit+credit then raise exception 'Invalid merit result';end if;
  end if;
 end if;
 for row in select value from jsonb_array_elements(p_proposal->'records') order by value->'payload'->>'eventId' loop
  select * into strict e from public.character_events where id=(row->'payload'->>'eventId')::uuid and account_id=(row->>'accountId')::uuid for update;
  if e.status<>'PENDING' or e.stage is distinct from (row->>'expectedStage')::int then raise exception 'STALE_REVISION';end if;
  if (row->>'system')::boolean and (e.expires_at>now() or (row->'result'->'log'->>'apSpent')::int<>0) then raise exception 'Invalid expiry result';end if;
 end loop;
 if p_proposal->>'conversionCharacterId' is not null then
  ignored:=public.convert_inner_court_to_harem((p_proposal->>'conversionCharacterId')::uuid,p_version,p_proposal||jsonb_build_object('request',null));
 else ignored:=public.commit_seat_world(p_version,p_proposal||jsonb_build_object('request',null));end if;
 for row in select value from jsonb_array_elements(p_proposal->'states') loop
  candidate:=row->'character';
  update public.characters set int=(candidate->>'int')::int,cha=(candidate->>'cha')::int,hp=(candidate->>'hp')::int,suspicion=(candidate->>'suspicion')::int,suspicion_floor=(candidate->>'suspicionFloor')::int,character_silver=(candidate->>'characterSilver')::bigint,merit=(candidate->>'merit')::bigint,investigation_pending=coalesce((candidate->>'investigationPending')::boolean,false) where id=(candidate->>'id')::uuid and account_id=(row->'account'->>'id')::uuid and season_id=sid;
 end loop;
 for row in select value from jsonb_array_elements(p_proposal->'instances') loop
  if row->>'seasonId' is distinct from sid::text then raise exception 'Event season mismatch';end if;
  insert into public.character_events(id,account_id,character_id,season_id,status,stage,expires_at,record) values((row->>'id')::uuid,(row->>'accountId')::uuid,(row->>'characterId')::uuid,sid,row->>'status',(row->>'stage')::int,(row->>'expiresAt')::timestamptz,row)
  on conflict(id) do update set status=excluded.status,stage=excluded.stage,record=excluded.record;
 end loop;
 if p_proposal->>'pendingCap' is null or (p_proposal->>'pendingCap')::int<1 then raise exception 'Invalid pending cap';end if;
 if exists(select 1 from public.character_events where season_id=sid and status='PENDING' group by character_id having count(*)>(p_proposal->>'pendingCap')::int) then raise exception 'Pending event cap exceeded';end if;
 for row in select value from jsonb_array_elements(p_proposal->'ledger') loop
  ref:=(row->>'reference')::uuid;delta:=(row->>'delta')::int;
  if delta<>1 or row->>'reason' is distinct from 'GREAT_CALAMITY' or not exists(select 1 from jsonb_array_elements(p_proposal->'records') r where r->'payload'->>'eventId'=ref::text and (r->'result'->'log'->'event'->>'success')::boolean and (r->'result'->'log'->'event'->>'completed')::boolean and (r->'result'->'log'->'event'->>'destinyAwarded')::int=1) or not exists(select 1 from public.character_events where id=ref and account_id=(row->>'accountId')::uuid and season_id=sid and status='RESOLVED' and record->'definition'->>'calamityCode'=row->>'calamityCode' and stage=jsonb_array_length(record->'definition'->'stages')-1) then raise exception 'Invalid calamity reward';end if;
  insert into public.account_calamity_claims(account_id,season_id,calamity_code) values((row->>'accountId')::uuid,sid,row->>'calamityCode') on conflict do nothing;
  if not found then raise exception 'STALE_REVISION';end if;
  insert into public.destiny_ledger(id,account_id,season_id,delta,reason,reference,calamity_code,created_at) values((row->>'id')::uuid,(row->>'accountId')::uuid,sid,1,'GREAT_CALAMITY',ref,row->>'calamityCode',(row->>'createdAt')::timestamptz);
  update public.accounts set destiny_points=destiny_points+1 where id=(row->>'accountId')::uuid;
 end loop;
 if request is not null and request<>'null'::jsonb then
  insert into public.action_daily_usage(account_id,usage_date,action_code,count) values(actor.id,today,code,1) on conflict(account_id,usage_date,action_code) do update set count=public.action_daily_usage.count+1;
  if code<>'RESOLVE_EVENT' then
   insert into public.merit_daily_usage(account_id,usage_date,points) values(actor.id,today,credit) on conflict(account_id,usage_date) do update set points=public.merit_daily_usage.points+credit;
   insert into public.action_requests(account_id,idempotency_key,action_code,payload,result) values(actor.id,(request->>'key')::uuid,code,null,result);
   insert into public.action_logs(id,account_id,character_id,action_code,idempotency_key,before_stats,after_stats,ap_spent,modifiers,world_time,result) values((result->'log'->>'id')::uuid,actor.id,c.id,code,(request->>'key')::uuid,result->'log'->'before',result->'log'->'after',cost,result->'log'->'modifiers',result->'log'->'worldTime',result);
  end if;
 end if;
 for row in select value from jsonb_array_elements(p_proposal->'records') loop
  result:=row->'result';
  insert into public.action_requests(account_id,idempotency_key,action_code,payload,result) values((row->>'accountId')::uuid,(row->>'key')::uuid,'RESOLVE_EVENT',row->'payload',result);
  insert into public.action_logs(id,account_id,character_id,action_code,idempotency_key,before_stats,after_stats,ap_spent,modifiers,world_time,result) values((result->'log'->>'id')::uuid,(row->>'accountId')::uuid,(result->'log'->>'characterId')::uuid,'RESOLVE_EVENT',(row->>'key')::uuid,result->'log'->'before',result->'log'->'after',(result->'log'->>'apSpent')::int,result->'log'->'modifiers',result->'log'->'worldTime',result);
 end loop;
 for row in select value from jsonb_array_elements(p_proposal->'marks') loop
  insert into public.character_week_marks(character_id,season_id,game_week,first_action_id) values((row->>'characterId')::uuid,sid,(row->>'week')::int,(row->>'firstActionId')::uuid) on conflict do nothing;
 end loop;
 for row in select value from jsonb_array_elements(p_proposal->'checks') loop
  if not exists(select 1 from public.character_week_marks where character_id=(row->>'characterId')::uuid and season_id=sid and game_week=(row->>'week')::int and first_action_id=(row->>'firstActionId')::uuid) then raise exception 'Missing first action mark';end if;
  insert into public.weekly_event_checks(account_id,character_id,season_id,game_week,first_action_id,triggered,selected_group,character_event_id,reason) values((row->>'accountId')::uuid,(row->>'characterId')::uuid,sid,(row->>'week')::int,(row->>'firstActionId')::uuid,(row->>'triggered')::boolean,row->>'group',(row->>'eventId')::uuid,row->>'reason') on conflict(character_id,season_id,game_week) do nothing;
 end loop;
 if request is not null and request<>'null'::jsonb then return request->'result';end if;return '{}'::jsonb;
end $$;
alter table public.action_logs drop constraint if exists action_logs_ap_spent_check;
alter table public.action_logs add constraint action_logs_ap_spent_check check(ap_spent>0 or(ap_spent=0 and action_code in ('WITHDRAW','RESOLVE_EVENT')));
-- Internal aliases cannot be invoked to bypass wrappers.
revoke all on function public.events_3b_runtime_snapshot(uuid),public.events_3b_seat_world_load(),public.events_3a_check_promotion_action(public.characters,text,jsonb,jsonb,bigint,timestamptz),public.events_3b_commit_runtime_setup(uuid,bigint,uuid,text,jsonb,jsonb,bigint) from public,anon,authenticated,service_role;
do $$ declare f record;begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('commit_runtime_setup','runtime_snapshot','seat_world_load','check_promotion_action','check_event_application','event_work_clock','commit_event_world','lock_character_event_definition') loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
  execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;
commit;
