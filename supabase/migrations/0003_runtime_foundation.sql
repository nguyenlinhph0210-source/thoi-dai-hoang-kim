begin;
alter table public.accounts add column if not exists ap smallint;
alter table public.accounts add column if not exists last_ap_grant_date date;
update public.accounts set ap=action_points where ap is null;
update public.accounts set last_ap_grant_date=coalesce(last_ap_grant_date_utc7,(created_at at time zone 'Asia/Ho_Chi_Minh')::date) where last_ap_grant_date is null;
alter table public.accounts alter column ap set default 10;
alter table public.accounts alter column ap set not null;
alter table public.accounts alter column last_ap_grant_date set default ((now() at time zone 'Asia/Ho_Chi_Minh')::date);
alter table public.accounts alter column last_ap_grant_date set not null;
do $$ begin
  if not exists(select 1 from pg_constraint where conrelid='public.accounts'::regclass and conname='accounts_ap_runtime_bounds') then alter table public.accounts add constraint accounts_ap_runtime_bounds check(ap between 0 and 15); end if;
end $$;
create or replace function public.sync_account_ap() returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='INSERT' then new.action_points:=new.ap; new.last_ap_grant_date_utc7:=new.last_ap_grant_date;
  else
    if new.ap is distinct from old.ap then new.action_points:=new.ap;
    elsif new.action_points is distinct from old.action_points then new.ap:=new.action_points; end if;
    if new.last_ap_grant_date is distinct from old.last_ap_grant_date then new.last_ap_grant_date_utc7:=new.last_ap_grant_date;
    elsif new.last_ap_grant_date_utc7 is distinct from old.last_ap_grant_date_utc7 then new.last_ap_grant_date:=new.last_ap_grant_date_utc7; end if;
  end if; return new;
end $$;
drop trigger if exists sync_account_ap on public.accounts;
create trigger sync_account_ap before insert or update on public.accounts for each row execute function public.sync_account_ap();
create or replace function public.create_game_account() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.accounts(id,ap,last_ap_grant_date) values(new.id,10,(now() at time zone 'Asia/Ho_Chi_Minh')::date) on conflict do nothing; return new; end $$;
revoke all on function public.create_game_account(),public.sync_account_ap() from public,anon,authenticated;

alter table public.characters add column if not exists start_age integer;
alter table public.characters add column if not exists start_game_year integer;
alter table public.characters add column if not exists treatments_remaining integer not null default 0;
alter table public.characters add column if not exists action_locked boolean not null default false;
update public.characters c set start_age=age, start_game_year=greatest(1,floor(greatest(0,extract(epoch from (coalesce(c.confirmed_at,c.created_at)-s.season_start_timestamp)))/108000)::int+1) from public.seasons s where s.id=c.season_id and c.start_game_year is null;
alter table public.characters alter column start_age set default 16;
alter table public.characters alter column start_age set not null;
alter table public.characters alter column start_game_year set default 1;
alter table public.characters alter column start_game_year set not null;
do $$ begin
  if not exists(select 1 from pg_constraint where conrelid='public.characters'::regclass and conname='characters_runtime_bounds') then alter table public.characters add constraint characters_runtime_bounds check(start_age between 16 and 21 and start_game_year>=1 and treatments_remaining between 0 and 5); end if;
end $$;
drop index if exists public.one_open_life_per_account;
create unique index if not exists one_open_life_per_account on public.characters(account_id) where status in ('DRAFT','ACTIVE','SEVERELY_ILL');
insert into public.seasons(name,scenario_code) select 'Đại Khánh · Thiên Nguyên','dai-khanh-thien-nguyen' where not exists(select 1 from public.seasons where status='ACTIVE');
-- Preserve existing worlds: abort rather than silently end/change a season.
do $$ begin if exists(select 1 from public.seasons where status='ACTIVE' and scenario_code<>'dai-khanh-thien-nguyen') then raise exception 'Existing ACTIVE season has another scenario; resolve explicitly before applying 0003'; end if; end $$;

create table if not exists public.action_daily_usage (
 account_id uuid not null references public.accounts(id), usage_date date not null, action_code text not null, count integer not null check(count>=0), primary key(account_id,usage_date,action_code)
);
create table if not exists public.action_requests (
 account_id uuid not null references public.accounts(id), idempotency_key uuid not null, action_code text not null, result jsonb not null, created_at timestamptz not null default now(), primary key(account_id,idempotency_key)
);
create table if not exists public.action_logs (
 id uuid primary key, account_id uuid not null references public.accounts(id), character_id uuid not null references public.characters(id), action_code text not null, idempotency_key uuid not null,
 before_stats jsonb not null, after_stats jsonb not null, ap_spent integer not null check(ap_spent>0), modifiers jsonb not null, world_time jsonb not null, created_at timestamptz not null default now(), result jsonb not null,
 foreign key(account_id,idempotency_key) references public.action_requests(account_id,idempotency_key), unique(account_id,idempotency_key)
);
create index if not exists action_logs_pagination on public.action_logs(account_id,created_at desc,id desc);
create table if not exists public.character_week_marks (
 character_id uuid not null references public.characters(id), season_id uuid not null references public.seasons(id), game_week integer not null check(game_week>0), first_action_id uuid not null references public.action_logs(id), primary key(character_id,season_id,game_week)
);
alter table public.setup_requests add column if not exists result jsonb;

create or replace function public.refresh_runtime_ap(p_account_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare a public.accounts; today date:=(now() at time zone 'Asia/Ho_Chi_Minh')::date; n integer;
begin
 select * into strict a from public.accounts where id=p_account_id for update;
 n:=greatest(0,today-a.last_ap_grant_date);
 if n>0 then update public.accounts set ap=least(15,ap+10*n),last_ap_grant_date=today,revision=revision+1 where id=p_account_id; end if;
end $$;

create or replace function public.get_character_setup(p_account_id uuid) returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'revision', a.revision,
    'account', jsonb_build_object('id',a.id,'destinyPoints',a.destiny_points,'pendingRewardSilver',a.pending_reward_silver,'freeRerollsLeft',a.free_rerolls_left,'hasCreatedCharacter',a.has_created_character,'actionPoints',a.action_points,'lastApGrantDateUtc7',a.last_ap_grant_date_utc7),
    'character', (select jsonb_build_object('id',c.id,'accountId',c.account_id,'seasonId',c.season_id,'branch',c.branch,'origin',c.origin,'rankId',c.rank_id,'status',c.status,'age',c.age,'startAge',c.start_age,'startGameYear',c.start_game_year,'treatmentsRemaining',c.treatments_remaining,'actionLocked',c.action_locked,'birthGameYear',c.birth_game_year,'int',c.int,'rep',c.rep,'fav',c.fav,'cha',c.cha,'hp',c.hp,'suspicion',c.suspicion,'suspicionFloor',c.suspicion_floor,'characterSilver',c.character_silver,'createdAt',c.created_at,'confirmedAt',c.confirmed_at,
      'promotionRequirements',(select jsonb_build_object('characterId',p.character_id,'targetRankId',p.target_rank_id,'conditions',p.conditions,'generatedAt',p.generated_at) from public.promotion_requirements p where p.character_id=c.id order by p.generated_at desc limit 1))
    from public.characters c where c.account_id=a.id and c.status in ('DRAFT','ACTIVE','SEVERELY_ILL'))
  ) from public.accounts a where a.id=p_account_id;
$$;
create or replace function public.runtime_snapshot(p_account_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.seasons; stamp timestamptz:=now(); state jsonb; year integer;
begin
 perform public.refresh_runtime_ap(p_account_id);
 select * into strict s from public.seasons where status='ACTIVE';
 year:=floor(greatest(0,extract(epoch from(stamp-s.season_start_timestamp)))/108000)::int+1;
 state:=public.get_character_setup(p_account_id);
 if state->'character'<>'null'::jsonb and state->'character'->>'confirmedAt' is not null then
   state:=jsonb_set(state,'{character,age}',to_jsonb((state->'character'->>'startAge')::int+greatest(0,year-(state->'character'->>'startGameYear')::int)));
 end if;
 return state||jsonb_build_object('processedRequests','[]'::jsonb,'serverNow',floor(extract(epoch from stamp)*1000),'season',jsonb_build_object('id',s.id,'name',s.name,'scenarioCode',s.scenario_code,'status',s.status,'seasonStartTimestamp',s.season_start_timestamp,'endedAt',s.ended_at,'fictional',true),
 'usage',coalesce((select jsonb_object_agg(action_code,count) from public.action_daily_usage where account_id=p_account_id and usage_date=(stamp at time zone 'Asia/Ho_Chi_Minh')::date),'{}'::jsonb));
end $$;

create or replace function public.commit_runtime_setup(p_account_id uuid,p_revision bigint,p_key uuid,p_command text,p_candidate jsonb,p_requirements jsonb,p_game_day bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.accounts; c public.characters; s public.seasons; r public.ranks; previous public.setup_requests; state jsonb; day bigint; ignored jsonb;
begin
 perform public.refresh_runtime_ap(p_account_id);
 select * into strict a from public.accounts where id=p_account_id for update;
 select * into previous from public.setup_requests where account_id=p_account_id and request_id=p_key;
 if found then
   if previous.action<>p_command then raise exception 'Idempotency key reused'; end if;
   return coalesce(previous.result,public.runtime_snapshot(p_account_id));
 end if;
 if a.revision is distinct from p_revision then raise exception 'STALE_REVISION'; end if;
 select * into strict s from public.seasons where status='ACTIVE' for share;
 day:=floor(greatest(0,extract(epoch from(now()-s.season_start_timestamp)))/300);
 if day is distinct from p_game_day then raise exception 'RETRY_CLOCK'; end if;
 select * into c from public.characters where account_id=p_account_id and status in ('DRAFT','ACTIVE','SEVERELY_ILL') for update;
 if p_command in ('BEGIN','REROLL') then
   if c.status='SEVERELY_ILL' then raise exception 'Life already confirmed'; end if;
   ignored:=public.commit_character_setup(p_account_id,s.id,p_revision,p_key,p_command,p_candidate,null);
   if c.id is null then
     update public.characters set start_age=age,start_game_year=(day/360)::int+1 where account_id=p_account_id and status='DRAFT';
   end if;
   update public.characters set start_age=age where account_id=p_account_id and status='DRAFT';
 elsif p_command='CONFIRM' then
   if c.id is null then raise exception 'No character'; end if;
   if c.status in ('ACTIVE','SEVERELY_ILL') then return public.runtime_snapshot(p_account_id); end if;
   select * into strict r from public.ranks where id=c.rank_id;
   if p_requirements->>'characterId' is distinct from c.id::text or p_requirements->>'targetRankId' is distinct from r.next_rank_id then raise exception 'Invalid promotion conditions'; end if;
   -- M2 does not assign/modify rank seats or perform promotions.
   insert into public.promotion_requirements(character_id,target_rank_id,conditions) values(c.id,r.next_rank_id,p_requirements->'conditions');
   update public.characters set status='ACTIVE',confirmed_at=now(),start_age=age,start_game_year=(day/360)::int+1,character_silver=character_silver+a.pending_reward_silver where id=c.id;
   update public.accounts set pending_reward_silver=0,free_rerolls_left=0,has_created_character=true,revision=revision+1 where id=p_account_id;
   insert into public.setup_requests(account_id,request_id,action) values(p_account_id,p_key,p_command);
 else raise exception 'Invalid setup action'; end if;
 state:=public.runtime_snapshot(p_account_id);
 update public.setup_requests set result=state where account_id=p_account_id and request_id=p_key;
 return state;
end $$;

create or replace function public.commit_game_action(p_account_id uuid,p_revision bigint,p_key uuid,p_code text,p_proposal jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.accounts; c public.characters; s public.seasons; previous public.action_requests; used integer; today date:=(now() at time zone 'Asia/Ho_Chi_Minh')::date;
 cost integer:=(p_proposal->>'apCost')::int; silver_cost integer:=(p_proposal->>'silverCost')::int; hp_cost integer:=(p_proposal->>'hpCost')::int; cap integer:=(p_proposal->>'dailyCap')::int;
 candidate jsonb:=p_proposal->'character'; result jsonb:=p_proposal->'result'; day bigint;
begin
 select * into strict a from public.accounts where id=p_account_id for update;
 select * into previous from public.action_requests where account_id=p_account_id and idempotency_key=p_key;
 if found then if previous.action_code<>p_code then raise exception 'Idempotency key reused'; end if; return previous.result; end if;
 perform public.refresh_runtime_ap(p_account_id);
 select * into strict a from public.accounts where id=p_account_id;
 if a.revision is distinct from p_revision then raise exception 'STALE_REVISION'; end if;
 select * into strict s from public.seasons where status='ACTIVE' for share;
 day:=floor(greatest(0,extract(epoch from(now()-s.season_start_timestamp)))/300);
 if p_proposal->>'date' is distinct from today::text or (p_proposal->>'gameDay')::bigint is distinct from day then raise exception 'RETRY_CLOCK'; end if;
 select * into strict c from public.characters where account_id=p_account_id and season_id=s.id and status in ('ACTIVE','SEVERELY_ILL') for update;
 if c.action_locked or (c.status='SEVERELY_ILL' and p_code<>'TREAT') or (c.status='ACTIVE' and p_code='TREAT') then raise exception 'Character action locked'; end if;
 if p_code not in ('STUDY','SOCIALIZE','AUDIENCE','ETIQUETTE','WORK','REST','RUMOR','TREAT') or cost is null or cost<=0 or cap is null or cap<=0 or silver_cost is null or silver_cost<0 or hp_cost is null or hp_cost<0 then raise exception 'Invalid action proposal'; end if;
 if a.ap<cost then raise exception 'Insufficient AP'; end if;
 if c.character_silver<silver_cost or c.hp<hp_cost then raise exception 'Insufficient resources'; end if;
 select count into used from public.action_daily_usage where account_id=p_account_id and usage_date=today and action_code=p_code;
 if coalesce(used,0)>=cap then raise exception 'Daily cap reached'; end if;
 if candidate->>'id' is distinct from c.id::text or candidate->>'status' not in ('ACTIVE','SEVERELY_ILL') or (result->'log'->>'apAfter')::int is distinct from a.ap-cost or (result->'log'->>'apSpent')::int is distinct from cost then raise exception 'Invalid computed result'; end if;
 update public.characters set int=(candidate->>'int')::int,rep=(candidate->>'rep')::int,fav=(candidate->>'fav')::int,cha=(candidate->>'cha')::int,hp=(candidate->>'hp')::int,suspicion=(candidate->>'suspicion')::int,suspicion_floor=(candidate->>'suspicionFloor')::int,character_silver=(candidate->>'characterSilver')::bigint,status=(candidate->>'status')::public.character_status,treatments_remaining=(candidate->>'treatmentsRemaining')::int where id=c.id;
 update public.accounts set ap=ap-cost,revision=revision+1 where id=p_account_id;
 insert into public.action_daily_usage(account_id,usage_date,action_code,count) values(p_account_id,today,p_code,1) on conflict(account_id,usage_date,action_code) do update set count=public.action_daily_usage.count+1;
 insert into public.action_requests(account_id,idempotency_key,action_code,result) values(p_account_id,p_key,p_code,result);
 insert into public.action_logs(id,account_id,character_id,action_code,idempotency_key,before_stats,after_stats,ap_spent,modifiers,world_time,result)
 values((result->'log'->>'id')::uuid,p_account_id,c.id,p_code,p_key,result->'log'->'before',result->'log'->'after',cost,result->'log'->'modifiers',result->'log'->'worldTime',result);
 insert into public.character_week_marks(character_id,season_id,game_week,first_action_id) values(c.id,s.id,(day/7)::int+1,(result->'log'->>'id')::uuid) on conflict do nothing;
 return result;
end $$;

alter table public.action_daily_usage enable row level security;
alter table public.action_requests enable row level security;
alter table public.action_logs enable row level security;
alter table public.character_week_marks enable row level security;
revoke all on public.action_daily_usage,public.action_requests,public.action_logs,public.character_week_marks from anon,authenticated;
grant select on public.action_daily_usage to authenticated;
grant select(id,account_id,character_id,action_code,ap_spent,modifiers,world_time,created_at) on public.action_logs to authenticated;
drop policy if exists own_usage on public.action_daily_usage;
create policy own_usage on public.action_daily_usage for select to authenticated using(account_id=(select auth.uid()));
drop policy if exists own_action_logs on public.action_logs;
create policy own_action_logs on public.action_logs for select to authenticated using(account_id=(select auth.uid()));
-- No client access to raw result JSON (contains hidden suspicion), request ledgers, or world tables.
revoke select on public.seasons,public.ranks,public.seat_pools,public.rank_seats,public.leaderboards,public.events_log from authenticated;
drop policy if exists visible_events on public.events_log;
create policy visible_events on public.events_log for select to authenticated using(account_id=(select auth.uid()));
-- Preserve RLS from M1. Sensitive functions are service-only, including old setup RPC.
grant all on public.action_daily_usage,public.action_requests,public.action_logs,public.character_week_marks to service_role;
revoke all on function public.refresh_runtime_ap(uuid),public.runtime_snapshot(uuid),public.commit_runtime_setup(uuid,bigint,uuid,text,jsonb,jsonb,bigint),public.commit_game_action(uuid,bigint,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.refresh_runtime_ap(uuid),public.runtime_snapshot(uuid),public.commit_runtime_setup(uuid,bigint,uuid,text,jsonb,jsonb,bigint),public.commit_game_action(uuid,bigint,uuid,text,jsonb) to service_role;
commit;
