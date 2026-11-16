begin;
-- Additions only. Legacy requirements/results stay unchanged.
alter table public.characters add column if not exists rank_entered_at timestamptz;
alter table public.characters add column if not exists merit bigint not null default 0;
alter table public.characters add column if not exists exam_passed_for_rank_id text references public.ranks(id);
alter table public.characters add column if not exists exam_passed_game_day bigint;
update public.characters set rank_entered_at=confirmed_at where rank_entered_at is null and confirmed_at is not null;
do $$ begin
 if not exists(select 1 from pg_constraint where conrelid='public.characters'::regclass and conname='characters_promotion_bounds') then alter table public.characters add constraint characters_promotion_bounds check(merit between 0 and 9007199254740991 and (exam_passed_game_day is null or exam_passed_game_day>=0) and ((exam_passed_for_rank_id is null)=(exam_passed_game_day is null))); end if;
end $$;
alter table public.promotion_requirements add column if not exists table_version text not null default 'legacy';
alter table public.promotion_requirements add column if not exists thresholds jsonb;
create table if not exists public.merit_daily_usage (
 account_id uuid not null references public.accounts(id), usage_date date not null, points integer not null check(points>=0), primary key(account_id,usage_date)
);
alter table public.merit_daily_usage enable row level security;
revoke all on public.merit_daily_usage from anon,authenticated;
grant select on public.merit_daily_usage to authenticated;
grant all on public.merit_daily_usage to service_role;
drop policy if exists own_merit_usage on public.merit_daily_usage;
create policy own_merit_usage on public.merit_daily_usage for select to authenticated using(account_id=(select auth.uid()));
-- Immutable even if another backend accidentally issues UPDATE. New ranks use INSERT.
create or replace function public.lock_promotion_requirements() returns trigger language plpgsql set search_path='' as $$
begin if to_jsonb(new) is distinct from to_jsonb(old) then raise exception 'Promotion requirements are immutable'; end if; return new; end $$;
revoke all on function public.lock_promotion_requirements() from public,anon,authenticated;
drop trigger if exists lock_promotion_requirements on public.promotion_requirements;
create trigger lock_promotion_requirements before update on public.promotion_requirements for each row execute function public.lock_promotion_requirements();

-- Official v1 rows preserve M1 IDs and seat metadata.
set constraints all deferred;
insert into public.ranks(id,name,branch,tier,next_rank_id,entry_minimums,benchmarks) values

('civil_8','Chính bát phẩm','CIVIL',1,'civil_7b','{}','{"int": 50, "rep": 20, "fav": -20, "cha": 35}'),
('civil_7b','Tòng thất phẩm','CIVIL',1,'civil_7','{}','{"int": 90, "rep": 60, "fav": 0, "cha": 55}'),
('civil_7','Chính thất phẩm','CIVIL',1,'civil_6b','{}','{"int": 135, "rep": 105, "fav": 20, "cha": 80}'),
('civil_6b','Tòng lục phẩm','CIVIL',2,'civil_6','{}','{"int": 180, "rep": 150, "fav": 40, "cha": 115}'),
('civil_6','Chính lục phẩm','CIVIL',2,'civil_5b','{}','{"int": 235, "rep": 200, "fav": 60, "cha": 150}'),
('civil_5b','Tòng ngũ phẩm','CIVIL',3,'civil_5','{}','{"int": 290, "rep": 250, "fav": 75, "cha": 190}'),
('civil_5','Chính ngũ phẩm','CIVIL',3,'civil_4b','{}','{"int": 355, "rep": 305, "fav": 90, "cha": 235}'),
('civil_4b','Tòng tứ phẩm','CIVIL',4,'civil_4','{}','{"int": 425, "rep": 370, "fav": 140, "cha": 285}'),
('civil_4','Chính tứ phẩm','CIVIL',4,'civil_3b','{}','{"int": 500, "rep": 440, "fav": 200, "cha": 340}'),
('civil_3b','Tòng tam phẩm','CIVIL',4,'civil_3','{}','{"int": 580, "rep": 520, "fav": 280, "cha": 400}'),
('civil_3','Chính tam phẩm','CIVIL',4,'civil_2b','{}','{"int": 660, "rep": 600, "fav": 370, "cha": 470}'),
('civil_2b','Tòng nhị phẩm','CIVIL',5,'civil_2','{}','{"int": 740, "rep": 685, "fav": 470, "cha": 550}'),
('civil_2','Chính nhị phẩm','CIVIL',5,'civil_1b','{}','{"int": 820, "rep": 775, "fav": 580, "cha": 630}'),
('civil_1b','Tòng nhất phẩm','CIVIL',5,'civil_1','{}','{"int": 900, "rep": 865, "fav": 700, "cha": 720}'),
('civil_1','Chính nhất phẩm','CIVIL',5,null,'{}','{"int": 960, "rep": 940, "fav": 820, "cha": 800}'),
('military_7b','Tòng thất phẩm','MILITARY',1,'military_7','{}','{"int": 90, "rep": 60, "fav": 0, "cha": 55}'),
('military_7','Chính thất phẩm','MILITARY',1,'military_6b','{}','{"int": 135, "rep": 105, "fav": 20, "cha": 80}'),
('military_6b','Tòng lục phẩm','MILITARY',2,'military_6','{}','{"int": 180, "rep": 150, "fav": 40, "cha": 115}'),
('military_6','Chính lục phẩm','MILITARY',2,'military_5b','{}','{"int": 235, "rep": 200, "fav": 60, "cha": 150}'),
('military_5b','Tòng ngũ phẩm','MILITARY',3,'military_5','{}','{"int": 290, "rep": 250, "fav": 75, "cha": 190}'),
('military_5','Chính ngũ phẩm','MILITARY',3,'military_4b','{}','{"int": 355, "rep": 305, "fav": 90, "cha": 235}'),
('military_4b','Tòng tứ phẩm','MILITARY',4,'military_4','{}','{"int": 425, "rep": 370, "fav": 140, "cha": 285}'),
('military_4','Chính tứ phẩm','MILITARY',4,'military_3b','{}','{"int": 500, "rep": 440, "fav": 200, "cha": 340}'),
('military_3b','Tòng tam phẩm','MILITARY',4,'military_3','{}','{"int": 580, "rep": 520, "fav": 280, "cha": 400}'),
('military_3','Chính tam phẩm','MILITARY',4,'military_2b','{}','{"int": 660, "rep": 600, "fav": 370, "cha": 470}'),
('military_2b','Tòng nhị phẩm','MILITARY',5,'military_2','{}','{"int": 740, "rep": 685, "fav": 470, "cha": 550}'),
('military_2','Chính nhị phẩm','MILITARY',5,'military_1b','{}','{"int": 820, "rep": 775, "fav": 580, "cha": 630}'),
('military_1b','Tòng nhất phẩm','MILITARY',5,'military_1','{}','{"int": 900, "rep": 865, "fav": 700, "cha": 720}'),
('military_1','Chính nhất phẩm','MILITARY',5,null,'{}','{"int": 960, "rep": 940, "fav": 820, "cha": 800}'),
('harem_0','Cung tuyển','HAREM',1,'harem_14','{}','{"fav": 0, "rep": 15, "int": 35, "cha": 50}'),
('harem_14','Mỹ nhân','HAREM',1,'harem_13','{}','{"fav": 20, "rep": 25, "int": 45, "cha": 60}'),
('harem_13','Lương nhân','HAREM',1,'harem_12','{}','{"fav": 50, "rep": 50, "int": 70, "cha": 85}'),
('harem_12','Tài nhân','HAREM',1,'harem_11','{}','{"fav": 85, "rep": 80, "int": 105, "cha": 115}'),
('harem_11','Tuyên vinh','HAREM',1,'harem_10','{}','{"fav": 130, "rep": 120, "int": 140, "cha": 150}'),
('harem_10','Dung hoa','HAREM',2,'harem_9','{}','{"fav": 180, "rep": 170, "int": 180, "cha": 185}'),
('harem_9','Tiệp dư','HAREM',2,'harem_8','{}','{"fav": 240, "rep": 225, "int": 225, "cha": 220}'),
('harem_8','Sung Nghi','HAREM',3,'harem_7','{}','{"fav": 310, "rep": 290, "int": 275, "cha": 255}'),
('harem_7','Tu Nghi','HAREM',3,'harem_6','{}','{"fav": 390, "rep": 370, "int": 330, "cha": 290}'),
('harem_6','Chiêu Nghi','HAREM',3,'harem_5','{}','{"fav": 480, "rep": 460, "int": 390, "cha": 330}'),
('harem_5','Tần','HAREM',4,'harem_4','{}','{"fav": 580, "rep": 550, "int": 455, "cha": 375}'),
('harem_4','Phi','HAREM',4,'harem_3','{}','{"fav": 680, "rep": 650, "int": 525, "cha": 420}'),
('harem_3','Quý phi','HAREM',5,'harem_2','{}','{"fav": 780, "rep": 755, "int": 610, "cha": 500}'),
('harem_2','Hoàng quý phi','HAREM',5,'harem_1','{}','{"fav": 870, "rep": 850, "int": 700, "cha": 580}'),
('harem_1','Hoàng hậu','HAREM',5,null,'{}','{"fav": 950, "rep": 940, "int": 800, "cha": 660}'),
('inner_1','Cung nữ sơ tuyển','INNER_COURT',1,'inner_2','{}','{"int": 35, "fav": 0, "rep": 5, "cha": 35}'),
('inner_2','Cung nữ chính thức','INNER_COURT',1,'inner_3','{}','{"int": 80, "fav": 50, "rep": 35, "cha": 70}'),
('inner_3','Nữ sử','INNER_COURT',1,'inner_4','{}','{"int": 160, "fav": 120, "rep": 85, "cha": 125}'),
('inner_4','Chưởng quan','INNER_COURT',2,'inner_5','{}','{"int": 260, "fav": 210, "rep": 160, "cha": 190}'),
('inner_5','Điển quan','INNER_COURT',3,'inner_6','{}','{"int": 380, "fav": 320, "rep": 250, "cha": 265}'),
('inner_6','Tư quan','INNER_COURT',3,'inner_7','{}','{"int": 520, "fav": 440, "rep": 360, "cha": 350}'),
('inner_7','Lục Thượng và Cung chính','INNER_COURT',4,'inner_8','{}','{"int": 680, "fav": 600, "rep": 500, "cha": 450}'),
('inner_8','Tổng quản Lục cục','INNER_COURT',5,null,'{}','{"int": 850, "fav": 780, "rep": 680, "cha": 560}')

on conflict(id) do update set name=excluded.name,branch=excluded.branch,tier=excluded.tier,next_rank_id=excluded.next_rank_id,entry_minimums=excluded.entry_minimums,benchmarks=excluded.benchmarks;
set constraints all immediate;

create or replace function public.valid_promotion_v1(branch public.game_branch,conditions jsonb) returns boolean language sql immutable set search_path='' as $$
 select public.valid_promotion_conditions(conditions) and
 conditions->0->>'stat'=case when branch='HAREM' then 'fav' else 'int' end and
 conditions->1->>'stat'=case when branch='INNER_COURT' then 'fav' else 'rep' end and
 conditions->2->>'stat'=any(case when branch in ('CIVIL','MILITARY') then array['fav','cha','suspicion'] when branch='INNER_COURT' then array['rep','cha','suspicion'] else array['int','cha','suspicion'] end);
$$;
-- Service-only policy carries TEMP values from balance.ts, like action costs in M2.
create or replace function public.check_promotion_action(c public.characters,code text,policy jsonb,result jsonb,game_day bigint,stamp timestamptz) returns integer language plpgsql security definer set search_path='' as $$
declare used integer; credit integer; gain integer:=coalesce((policy->>'meritGain')::int,0); cap integer:=coalesce((policy->>'meritCap')::int,8); req public.promotion_requirements; cond jsonb; value integer; target text; probability double precision; success boolean; candidate jsonb:=result->'log';
begin
 if gain<0 or cap<0 then raise exception 'Invalid merit policy'; end if;
 select points into used from public.merit_daily_usage where account_id=c.account_id and usage_date=(stamp at time zone 'Asia/Ho_Chi_Minh')::date;
 credit:=greatest(0,least(gain,cap-coalesce(used,0)));
 if candidate->>'meritGained' is not null and ((candidate->>'meritGained')::int is distinct from credit or (candidate->>'meritAfter')::bigint is distinct from c.merit+credit) then raise exception 'Invalid merit log'; end if;
 if code<>'EXAM' then return credit; end if;
 if c.status<>'ACTIVE' or c.suspicion>=80 then raise exception 'Exam is locked'; end if;
 select next_rank_id into target from public.ranks where id=c.rank_id;
 if target is null then raise exception 'Highest rank has no exam'; end if;
 select * into req from public.promotion_requirements where character_id=c.id and target_rank_id=target;
 if req.character_id is null then raise exception 'Missing promotion requirements'; end if;
 for cond in select * from jsonb_array_elements(req.conditions) loop
   -- TODO(spec): legacy HP/silver rows remain immutable history and never gate eligibility.
   if cond->>'stat' in ('hp','characterSilver') then continue; end if;
   value:=case cond->>'stat' when 'int' then c.int when 'rep' then c.rep when 'fav' then c.fav when 'cha' then c.cha when 'suspicion' then c.suspicion else null end;
   if value is null or (cond->>'stat'='suspicion' and (c.suspicion_floor>(cond->>'value')::int or value>(cond->>'value')::int)) or (cond->>'stat'<>'suspicion' and value<(cond->>'value')::int) then raise exception 'Promotion stat unmet'; end if;
 end loop;
 if policy->>'tenureDays' is null or policy->>'meritRequired' is null or (policy->>'tenureDays')::int<0 or (policy->>'meritRequired')::int<0 or floor(greatest(0,extract(epoch from(stamp-coalesce(c.rank_entered_at,c.confirmed_at))))/300)<(policy->>'tenureDays')::int or c.merit<(policy->>'meritRequired')::int then raise exception 'Promotion tenure/merit unmet'; end if;
 if candidate->'exam'->>'targetRankId' is distinct from target or (candidate->'exam'->>'gameDay')::bigint is distinct from game_day or jsonb_typeof(candidate->'exam'->'success') is distinct from 'boolean' then raise exception 'Invalid exam result'; end if;
 probability:=least((policy->'exam'->>'maxProbability')::double precision,greatest((policy->'exam'->>'minProbability')::double precision,(policy->'exam'->>'baseProbability')::double precision+c.int/(policy->'exam'->>'intDivisor')::double precision+c.hp/(policy->'exam'->>'hpDivisor')::double precision));
 if c.hp<20 then probability:=greatest((policy->'exam'->>'fatiguedMinimum')::double precision,probability-(policy->'exam'->>'fatiguePenalty')::double precision); end if;
 if probability is null or probability<0 or probability>1 or candidate->'exam'->>'probability' is null or abs((candidate->'exam'->>'probability')::double precision-probability)>0.000000000001 then raise exception 'Invalid exam probability'; end if;
 return credit;
end $$;

create or replace function public.get_character_setup(p_account_id uuid) returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'revision', a.revision,
    'account', jsonb_build_object('id',a.id,'destinyPoints',a.destiny_points,'pendingRewardSilver',a.pending_reward_silver,'freeRerollsLeft',a.free_rerolls_left,'hasCreatedCharacter',a.has_created_character,'actionPoints',a.action_points,'lastApGrantDateUtc7',a.last_ap_grant_date_utc7),
    'character', (select jsonb_build_object('id',c.id,'accountId',c.account_id,'seasonId',c.season_id,'branch',c.branch,'origin',c.origin,'rankId',c.rank_id,'status',c.status,'age',c.age,'rankEnteredAt',c.rank_entered_at,'merit',c.merit,'examPassedForRankId',c.exam_passed_for_rank_id,'examPassedGameDay',c.exam_passed_game_day,'startAge',c.start_age,'startGameYear',c.start_game_year,'treatmentsRemaining',c.treatments_remaining,'actionLocked',c.action_locked,'birthGameYear',c.birth_game_year,'int',c.int,'rep',c.rep,'fav',c.fav,'cha',c.cha,'hp',c.hp,'suspicion',c.suspicion,'suspicionFloor',c.suspicion_floor,'characterSilver',c.character_silver,'createdAt',c.created_at,'confirmedAt',c.confirmed_at,
      'promotionRequirements',(select jsonb_build_object('characterId',p.character_id,'targetRankId',p.target_rank_id,'conditions',p.conditions,'generatedAt',p.generated_at,'tableVersion',p.table_version) from public.promotion_requirements p where p.character_id=c.id order by p.generated_at desc limit 1))
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
 'meritUsedToday',coalesce((select points from public.merit_daily_usage where account_id=p_account_id and usage_date=(stamp at time zone 'Asia/Ho_Chi_Minh')::date),0),
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
   if r.next_rank_id is not null then
     if p_requirements is null or p_requirements->>'characterId' is distinct from c.id::text or p_requirements->>'targetRankId' is distinct from r.next_rank_id or p_requirements->>'tableVersion' is distinct from 'v1' or public.valid_promotion_v1(c.branch,p_requirements->'conditions') is not true then raise exception 'Invalid v1 promotion conditions'; end if;
     insert into public.promotion_requirements(character_id,target_rank_id,conditions,table_version,thresholds)
     values(c.id,r.next_rank_id,p_requirements->'conditions','v1',(select jsonb_object_agg(x->>'stat',x->'value') from jsonb_array_elements(p_requirements->'conditions') x));
   elsif p_requirements is not null and p_requirements<>'null'::jsonb then raise exception 'Highest rank has no next requirements'; end if;
   -- No rank changes or seat assignment in 3A.
   update public.characters set status='ACTIVE',confirmed_at=now(),rank_entered_at=now(),start_age=age,start_game_year=(day/360)::int+1,character_silver=character_silver+a.pending_reward_silver where id=c.id;
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
 candidate jsonb:=p_proposal->'character'; result jsonb:=p_proposal->'result'; day bigint; merit_credit integer;
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
 if p_code not in ('STUDY','SOCIALIZE','AUDIENCE','ETIQUETTE','WORK','REST','RUMOR','TREAT','EXAM') or cost is null or cost<=0 or cap is null or cap<=0 or silver_cost is null or silver_cost<0 or hp_cost is null or hp_cost<0 then raise exception 'Invalid action proposal'; end if;
 if a.ap<cost then raise exception 'Insufficient AP'; end if;
 if c.character_silver<silver_cost or c.hp<hp_cost then raise exception 'Insufficient resources'; end if;
 select count into used from public.action_daily_usage where account_id=p_account_id and usage_date=today and action_code=p_code;
 if coalesce(used,0)>=cap then raise exception 'Daily cap reached'; end if;
 if candidate->>'id' is distinct from c.id::text or candidate->>'status' not in ('ACTIVE','SEVERELY_ILL') or (result->'log'->>'apAfter')::int is distinct from a.ap-cost or (result->'log'->>'apSpent')::int is distinct from cost then raise exception 'Invalid computed result'; end if;
 if p_code='EXAM' and (cost<>2 or hp_cost<>3 or cap<>2 or silver_cost<>0) then raise exception 'Invalid exam cost'; end if;
 merit_credit:=public.check_promotion_action(c,p_code,p_proposal->'policy',result,day,now());
 if (candidate->>'merit') is not null and (candidate->>'merit')::bigint is distinct from c.merit+merit_credit then raise exception 'Invalid merit result'; end if;
 if p_code='EXAM' and (candidate->>'examPassedForRankId' is distinct from (case when (result->'log'->'exam'->>'success')::boolean then result->'log'->'exam'->>'targetRankId' else c.exam_passed_for_rank_id end) or (candidate->>'examPassedGameDay')::bigint is distinct from (case when (result->'log'->'exam'->>'success')::boolean then day else c.exam_passed_game_day end)) then raise exception 'Invalid examination record'; end if;
 update public.characters set int=(candidate->>'int')::int,rep=(candidate->>'rep')::int,fav=(candidate->>'fav')::int,cha=(candidate->>'cha')::int,hp=(candidate->>'hp')::int,suspicion=(candidate->>'suspicion')::int,suspicion_floor=(candidate->>'suspicionFloor')::int,character_silver=(candidate->>'characterSilver')::bigint,status=(candidate->>'status')::public.character_status,treatments_remaining=(candidate->>'treatmentsRemaining')::int,merit=c.merit+merit_credit,exam_passed_for_rank_id=case when p_code='EXAM' and (result->'log'->'exam'->>'success')::boolean then result->'log'->'exam'->>'targetRankId' else c.exam_passed_for_rank_id end,exam_passed_game_day=case when p_code='EXAM' and (result->'log'->'exam'->>'success')::boolean then day else c.exam_passed_game_day end where id=c.id;
 update public.accounts set ap=ap-cost,revision=revision+1 where id=p_account_id;
 insert into public.action_daily_usage(account_id,usage_date,action_code,count) values(p_account_id,today,p_code,1) on conflict(account_id,usage_date,action_code) do update set count=public.action_daily_usage.count+1;
 insert into public.merit_daily_usage(account_id,usage_date,points) values(p_account_id,today,merit_credit) on conflict(account_id,usage_date) do update set points=public.merit_daily_usage.points+merit_credit;
 insert into public.action_requests(account_id,idempotency_key,action_code,result) values(p_account_id,p_key,p_code,result);
 insert into public.action_logs(id,account_id,character_id,action_code,idempotency_key,before_stats,after_stats,ap_spent,modifiers,world_time,result)
 values((result->'log'->>'id')::uuid,p_account_id,c.id,p_code,p_key,result->'log'->'before',result->'log'->'after',cost,result->'log'->'modifiers',result->'log'->'worldTime',result);
 insert into public.character_week_marks(character_id,season_id,game_week,first_action_id) values(c.id,s.id,(day/7)::int+1,(result->'log'->>'id')::uuid) on conflict do nothing;
 return result;
end $$;

revoke all on function public.valid_promotion_v1(public.game_branch,jsonb),public.check_promotion_action(public.characters,text,jsonb,jsonb,bigint,timestamptz),public.get_character_setup(uuid),public.runtime_snapshot(uuid),public.commit_runtime_setup(uuid,bigint,uuid,text,jsonb,jsonb,bigint),public.commit_game_action(uuid,bigint,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.valid_promotion_v1(public.game_branch,jsonb),public.check_promotion_action(public.characters,text,jsonb,jsonb,bigint,timestamptz),public.get_character_setup(uuid),public.runtime_snapshot(uuid),public.commit_runtime_setup(uuid,bigint,uuid,text,jsonb,jsonb,bigint),public.commit_game_action(uuid,bigint,uuid,text,jsonb) to service_role;
grant select(rank_entered_at,merit,exam_passed_for_rank_id,exam_passed_game_day) on public.characters to authenticated;
commit;
