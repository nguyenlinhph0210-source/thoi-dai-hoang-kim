-- ĐẠI NỘI KÝ — Milestone 1. Run once in a new Supabase project.
-- Application writes use a trusted backend + commit_character_setup RPC only.
-- Never expose the service-role key. auth.uid() policies protect read access.
begin;

create type public.game_branch as enum ('CIVIL', 'MILITARY', 'INNER_COURT', 'HAREM');
create type public.game_origin as enum ('COMMONER', 'SCHOLAR_FAMILY', 'NOBLE_CLAN', 'FALLEN_CLAN');
create type public.character_status as enum ('DRAFT', 'ACTIVE', 'DECEASED', 'ARCHIVED');
create type public.event_kind as enum ('NORMAL', 'RARE', 'DANGEROUS', 'GREAT_CALAMITY', 'MAIN_STORY', 'COURT_WIDE', 'PVP');

create table public.accounts (
  id uuid primary key references auth.users(id) on delete cascade,
  destiny_points bigint not null default 0 check (destiny_points between 0 and 9007199254740991),
  pending_reward_silver bigint not null default 0 check (pending_reward_silver between 0 and 9007199254740991),
  free_rerolls_left smallint not null default 3 check (free_rerolls_left between 0 and 3),
  has_created_character boolean not null default false,
  action_points smallint not null default 10 check (action_points between 0 and 15),
  last_ap_grant_date_utc7 date,
  revision bigint not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  check (not has_created_character or free_rerolls_left = 0)
);
create function public.create_game_account() returns trigger language plpgsql security definer set search_path = '' as $$
begin insert into public.accounts(id) values (new.id); return new; end;
$$;
revoke all on function public.create_game_account() from public;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.create_game_account();
-- Include users who predate this migration.
insert into public.accounts(id) select id from auth.users on conflict do nothing;

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  scenario_code text not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'ENDED')),
  season_start_timestamp timestamptz not null default now(),
  ended_at timestamptz,
  fictional boolean not null default true check (fictional),
  check ((status = 'ACTIVE' and ended_at is null) or (status = 'ENDED' and ended_at is not null))
);
-- One shared world for M1. Shards may scope this index by world_id in later milestones.
create unique index one_active_season on public.seasons(status) where status = 'ACTIVE';

create table public.ranks (
  id text primary key,
  name text not null,
  branch public.game_branch not null,
  tier smallint not null check (tier between 1 and 5),
  next_rank_id text references public.ranks(id) deferrable initially deferred,
  entry_minimums jsonb not null default '{}' check (jsonb_typeof(entry_minimums) = 'object'),
  benchmarks jsonb not null check (jsonb_typeof(benchmarks) = 'object'),
  seat_pool_key text,
  seat_capacity integer check (seat_capacity > 0),
  unique (id, branch),
  check ((seat_pool_key is null) = (seat_capacity is null))
);
-- Same M1 defaults as src/lib/gameConfig.ts. Benchmark values are provisional:
-- AGENTS.md specifies the formula but does not supply per-rank benchmarks.
insert into public.ranks(id,name,branch,tier,next_rank_id,benchmarks,seat_pool_key,seat_capacity) values
('civil_8','Chính bát phẩm','CIVIL',1,'civil_7b','{"int":50,"rep":20,"fav":0,"cha":50}','civil_8',16),
('civil_7b','Tòng thất phẩm','CIVIL',1,null,'{"int":80,"rep":60,"fav":60,"cha":80}','civil_7b',21),
('military_7b','Tòng thất phẩm','MILITARY',1,'military_7','{"int":50,"rep":20,"fav":0,"cha":50}','military_7b',20),
('military_7','Chính thất phẩm','MILITARY',1,null,'{"int":80,"rep":60,"fav":60,"cha":80}','military_7',14),
('inner_1','Cung nữ sơ tuyển','INNER_COURT',1,'inner_2','{"int":50,"rep":20,"fav":0,"cha":50}',null,null),
('inner_2','Cung nữ chính thức','INNER_COURT',1,null,'{"int":80,"rep":60,"fav":60,"cha":80}',null,null),
('harem_0','Cung tuyển','HAREM',1,'harem_14','{"int":50,"rep":20,"fav":0,"cha":50}',null,null),
('harem_14','Mỹ nhân','HAREM',1,null,'{"int":80,"rep":60,"fav":60,"cha":80}',null,null);

-- Resolve deferred self references before later ALTER TABLE statements.
set constraints all immediate;

create table public.characters (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id),
  season_id uuid not null references public.seasons(id),
  branch public.game_branch not null,
  origin public.game_origin not null,
  rank_id text not null,
  status public.character_status not null default 'DRAFT',
  age integer not null check (age >= 16),
  birth_game_year integer not null,
  int integer not null check (int between 0 and 1000),
  rep integer not null check (rep between 0 and 1000),
  fav integer not null check (fav between -100 and 1000),
  cha integer not null check (cha between 0 and 1000),
  hp integer not null check (hp between 0 and 100),
  suspicion integer not null check (suspicion between 0 and 100),
  suspicion_floor integer not null default 0 check (suspicion_floor between 0 and 100 and suspicion >= suspicion_floor),
  character_silver bigint not null check (character_silver between 0 and 9007199254740991),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  foreign key (rank_id, branch) references public.ranks(id, branch),
  unique (id, season_id),
  check ((status = 'DRAFT' and confirmed_at is null) or (status <> 'DRAFT' and confirmed_at is not null))
);
create unique index one_open_life_per_account on public.characters(account_id) where status in ('DRAFT','ACTIVE');
create index characters_season_branch on public.characters(season_id,branch,status);
create index characters_account_history on public.characters(account_id,created_at desc);

-- A pool may be shared by several ranks/branches (e.g. the three Tam thái seats).
create table public.seat_pools (
  season_id uuid not null references public.seasons(id),
  pool_key text not null,
  capacity integer not null check (capacity > 0),
  primary key (season_id, pool_key)
);
create table public.rank_seats (
  season_id uuid not null,
  pool_key text not null,
  seat_number integer not null check (seat_number > 0),
  character_id uuid unique,
  assigned_at timestamptz,
  primary key (season_id,pool_key,seat_number),
  foreign key (season_id,pool_key) references public.seat_pools(season_id,pool_key),
  foreign key (character_id,season_id) references public.characters(id,season_id),
  check ((character_id is null) = (assigned_at is null))
);

create function public.valid_promotion_conditions(value jsonb) returns boolean language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(value) <> 'array' then false else
    jsonb_array_length(value) = 3 and
    (select count(distinct c->>'stat') = 3 and bool_and(
      coalesce(c->>'stat' in ('int','rep','fav','cha','hp','characterSilver','suspicion') and
      c->>'operator' = case when c->>'stat' = 'suspicion' then '<=' else '>=' end and
      jsonb_typeof(c->'value') = 'number' and (c->>'value')::numeric = trunc((c->>'value')::numeric) and
      (c->>'value')::numeric between case when c->>'stat' = 'fav' then -100 else 0 end and
      case when c->>'stat' in ('hp','suspicion') then 100 when c->>'stat' = 'characterSilver' then 9007199254740991 else 1000 end, false)
    ) from jsonb_array_elements(value) c) end;
$$;
create table public.promotion_requirements (
  character_id uuid not null references public.characters(id),
  target_rank_id text not null references public.ranks(id),
  conditions jsonb not null check (public.valid_promotion_conditions(conditions) is true),
  generated_at timestamptz not null default now(),
  primary key (character_id,target_rank_id)
);
-- Immutable via the public API: no client write grants or policies.

create table public.events_log (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id),
  account_id uuid references public.accounts(id),
  character_id uuid,
  code text not null,
  kind public.event_kind not null,
  title text not null,
  description text not null default '',
  status text not null default 'PENDING' check (status in ('PENDING','RESOLVED','EXPIRED')),
  choices jsonb not null default '[]' check (jsonb_typeof(choices) = 'array'),
  outcome jsonb,
  ap_cost integer not null default 0 check (ap_cost >= 0),
  idempotency_key uuid not null default gen_random_uuid(),
  game_week integer check (game_week > 0),
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  resolved_at timestamptz,
  foreign key (character_id,season_id) references public.characters(id,season_id),
  unique (account_id,idempotency_key),
  check (character_id is null or account_id is not null)
);
create index events_log_account_pending on public.events_log(account_id,status);
create index events_log_world on public.events_log(season_id,created_at desc) where account_id is null;
create table public.weekly_event_checks (
  account_id uuid not null references public.accounts(id),
  season_id uuid not null references public.seasons(id),
  game_week integer not null check (game_week > 0),
  triggered boolean not null,
  primary key (account_id,season_id,game_week)
);
create table public.leaderboards (
  season_id uuid not null references public.seasons(id),
  account_id uuid not null references public.accounts(id),
  period text not null check (period in ('DAY','WEEK','MONTH','SEASON')),
  period_start date not null,
  best_life_score bigint not null default 0 check (best_life_score >= 0),
  best_character_id uuid,
  rewarded_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (season_id,account_id,period,period_start),
  foreign key (best_character_id,season_id) references public.characters(id,season_id)
);
create index leaderboard_ranking on public.leaderboards(season_id,period,period_start,best_life_score desc);
create table public.account_calamity_claims (
  account_id uuid not null references public.accounts(id),
  season_id uuid not null references public.seasons(id),
  calamity_code text not null,
  claimed_at timestamptz not null default now(),
  primary key (account_id,season_id,calamity_code)
);
create table public.setup_requests (
  account_id uuid not null references public.accounts(id),
  request_id uuid not null,
  action text not null check (action in ('BEGIN','REROLL','CONFIRM')),
  created_at timestamptz not null default now(),
  primary key (account_id,request_id)
);

-- Returns private server state. Backend must strip suspicion before returning to clients.
create function public.get_character_setup(p_account_id uuid) returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'revision', a.revision,
    'account', jsonb_build_object('id',a.id,'destinyPoints',a.destiny_points,'pendingRewardSilver',a.pending_reward_silver,'freeRerollsLeft',a.free_rerolls_left,'hasCreatedCharacter',a.has_created_character,'actionPoints',a.action_points,'lastApGrantDateUtc7',a.last_ap_grant_date_utc7),
    'character', (select jsonb_build_object('id',c.id,'accountId',c.account_id,'seasonId',c.season_id,'branch',c.branch,'origin',c.origin,'rankId',c.rank_id,'status',c.status,'age',c.age,'birthGameYear',c.birth_game_year,'int',c.int,'rep',c.rep,'fav',c.fav,'cha',c.cha,'hp',c.hp,'suspicion',c.suspicion,'suspicionFloor',c.suspicion_floor,'characterSilver',c.character_silver,'createdAt',c.created_at,'confirmedAt',c.confirmed_at,
      'promotionRequirements',(select jsonb_build_object('characterId',p.character_id,'targetRankId',p.target_rank_id,'conditions',p.conditions,'generatedAt',p.generated_at) from public.promotion_requirements p where p.character_id=c.id order by p.generated_at desc limit 1))
    from public.characters c where c.account_id=a.id and c.status in ('DRAFT','ACTIVE'))
  ) from public.accounts a where a.id=p_account_id;
$$;

-- Trusted backend runs characterGenerator.ts then commits with expected revision.
-- This RPC locks account + season + pool, charges from DB values, and transfers
-- pending silver in the same transaction as confirmation and condition persistence.
-- Never grant it to anon/authenticated: candidate stats are trusted server output.
create function public.commit_character_setup(
  p_account_id uuid, p_season_id uuid, p_expected_revision bigint, p_request_id uuid,
  p_action text, p_candidate jsonb default null, p_requirements jsonb default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  a public.accounts;
  c public.characters;
  r public.ranks;
  season_status text;
  free_count integer;
  destiny_cost integer := 0;
  chosen_slot integer;
  prior_action text;
begin
  if p_action is null or p_action not in ('BEGIN','REROLL','CONFIRM') or p_request_id is null then raise exception 'Invalid action'; end if;
  select * into strict a from public.accounts where id=p_account_id for update;
  select action into prior_action from public.setup_requests where account_id=p_account_id and request_id=p_request_id;
  if found then
    if prior_action <> p_action then raise exception 'Idempotency key reused for a different action'; end if;
    return public.get_character_setup(p_account_id);
  end if;
  if p_expected_revision is distinct from a.revision then raise exception 'Stale setup revision'; end if;
  select status into strict season_status from public.seasons where id=p_season_id for share;
  if season_status <> 'ACTIVE' then raise exception 'Season has ended'; end if;
  select * into c from public.characters where account_id=p_account_id and status in ('DRAFT','ACTIVE') for update;
  if c.id is not null and c.season_id <> p_season_id then raise exception 'Another life is still open'; end if;
  free_count := a.free_rerolls_left;

  if p_action in ('BEGIN','REROLL') then
    if p_candidate is null then raise exception 'Missing server-generated candidate'; end if;
    if p_action='BEGIN' and c.id is not null then
      if c.branch::text is distinct from p_candidate->>'branch' then raise exception 'Branch is locked'; end if;
      return public.get_character_setup(p_account_id); -- Reopening never rolls a new preview.
    end if;
    if p_action='REROLL' then
      if c.id is null or c.status <> 'DRAFT' then raise exception 'Only drafts can reroll'; end if;
      if c.branch::text is distinct from p_candidate->>'branch' then raise exception 'Branch is locked'; end if;
      if not a.has_created_character and free_count>0 then free_count:=free_count-1;
      elsif a.destiny_points>=1 then destiny_cost:=1;
      else raise exception 'Insufficient destiny points'; end if;
    end if;
    select * into strict r from public.ranks where id=p_candidate->>'rankId';
    if r.id is distinct from (case p_candidate->>'branch' when 'CIVIL' then 'civil_8' when 'MILITARY' then 'military_7b' when 'INNER_COURT' then 'inner_1' when 'HAREM' then 'harem_0' end) then raise exception 'Invalid initial rank'; end if;
    if (p_candidate->>'age')::integer not between 16 and 21 then raise exception 'Invalid initial age'; end if;
    if p_action='BEGIN' then
      insert into public.characters(id,account_id,season_id,branch,origin,rank_id,age,birth_game_year,int,rep,fav,cha,hp,suspicion,character_silver)
      values ((p_candidate->>'id')::uuid,p_account_id,p_season_id,(p_candidate->>'branch')::public.game_branch,(p_candidate->>'origin')::public.game_origin,r.id,(p_candidate->>'age')::integer,(p_candidate->>'birthGameYear')::integer,(p_candidate->>'int')::integer,(p_candidate->>'rep')::integer,(p_candidate->>'fav')::integer,(p_candidate->>'cha')::integer,(p_candidate->>'hp')::integer,(p_candidate->>'suspicion')::integer,(p_candidate->>'characterSilver')::bigint);
    else
      update public.characters set origin=(p_candidate->>'origin')::public.game_origin,age=(p_candidate->>'age')::integer,birth_game_year=(p_candidate->>'birthGameYear')::integer,int=(p_candidate->>'int')::integer,rep=(p_candidate->>'rep')::integer,fav=(p_candidate->>'fav')::integer,cha=(p_candidate->>'cha')::integer,hp=(p_candidate->>'hp')::integer,suspicion=(p_candidate->>'suspicion')::integer,character_silver=(p_candidate->>'characterSilver')::bigint where id=c.id;
    end if;
    update public.accounts set free_rerolls_left=free_count,destiny_points=destiny_points-destiny_cost where id=a.id;
  else
    if c.id is null then raise exception 'No candidate to confirm'; end if;
    if c.status='ACTIVE' then return public.get_character_setup(p_account_id); end if;
    select * into strict r from public.ranks where id=c.rank_id;
    if p_requirements is null or p_requirements->>'characterId' is distinct from c.id::text or p_requirements->>'targetRankId' is distinct from r.next_rank_id or r.next_rank_id is null then raise exception 'Invalid promotion target'; end if;
    if r.seat_pool_key is not null then
      insert into public.seat_pools(season_id,pool_key,capacity) values (p_season_id,r.seat_pool_key,r.seat_capacity) on conflict do nothing;
      perform 1 from public.seat_pools where season_id=p_season_id and pool_key=r.seat_pool_key for update;
      insert into public.rank_seats(season_id,pool_key,seat_number) select p_season_id,r.seat_pool_key,generate_series(1,r.seat_capacity) on conflict do nothing;
      select seat_number into chosen_slot from public.rank_seats where season_id=p_season_id and pool_key=r.seat_pool_key and character_id is null order by seat_number limit 1 for update;
      if chosen_slot is null then raise exception 'No vacant seat'; end if;
      update public.rank_seats set character_id=c.id,assigned_at=now() where season_id=p_season_id and pool_key=r.seat_pool_key and seat_number=chosen_slot;
    end if;
    insert into public.promotion_requirements(character_id,target_rank_id,conditions) values (c.id,r.next_rank_id,p_requirements->'conditions');
    update public.characters set status='ACTIVE',confirmed_at=now(),character_silver=character_silver+a.pending_reward_silver where id=c.id;
    update public.accounts set pending_reward_silver=0,free_rerolls_left=0,has_created_character=true where id=a.id;
  end if;
  update public.accounts set revision=revision+1 where id=a.id;
  insert into public.setup_requests(account_id,request_id,action) values (a.id,p_request_id,p_action);
  return public.get_character_setup(p_account_id);
end;
$$;

-- Only trusted application workers may record validated life scores. Use MAX,
-- never a sum across reincarnations. Closing/rewarding seasons is a later milestone.
create function public.record_best_life_score(p_character_id uuid,p_score bigint,p_period text,p_period_start date)
returns void language plpgsql security definer set search_path = '' as $$
declare c public.characters;
begin
  if p_score is null or p_score<0 then raise exception 'Invalid life score'; end if;
  select * into strict c from public.characters where id=p_character_id;
  insert into public.leaderboards(season_id,account_id,period,period_start,best_life_score,best_character_id)
  values(c.season_id,c.account_id,p_period,p_period_start,p_score,c.id)
  on conflict(season_id,account_id,period,period_start) do update
    set best_life_score=greatest(public.leaderboards.best_life_score,excluded.best_life_score),
        best_character_id=case when excluded.best_life_score>public.leaderboards.best_life_score then excluded.best_character_id else public.leaderboards.best_character_id end,
        updated_at=now();
end;
$$;

alter table public.accounts enable row level security;
alter table public.seasons enable row level security;
alter table public.ranks enable row level security;
alter table public.characters enable row level security;
alter table public.seat_pools enable row level security;
alter table public.rank_seats enable row level security;
alter table public.promotion_requirements enable row level security;
alter table public.events_log enable row level security;
alter table public.weekly_event_checks enable row level security;
alter table public.leaderboards enable row level security;
alter table public.account_calamity_claims enable row level security;
alter table public.setup_requests enable row level security;

revoke all on public.accounts,public.seasons,public.ranks,public.characters,public.seat_pools,public.rank_seats,public.promotion_requirements,public.events_log,public.weekly_event_checks,public.leaderboards,public.account_calamity_claims,public.setup_requests from anon,authenticated;
grant select on public.accounts,public.seasons,public.ranks,public.seat_pools,public.rank_seats,public.promotion_requirements,public.events_log,public.leaderboards to authenticated;
-- Even the owner cannot fetch the raw hidden stat via PostgREST.
grant select (id,account_id,season_id,branch,origin,rank_id,status,age,birth_game_year,int,rep,fav,cha,hp,character_silver,created_at,confirmed_at) on public.characters to authenticated;
create policy own_account on public.accounts for select to authenticated using (id=(select auth.uid()));
create policy shared_seasons on public.seasons for select to authenticated using (true);
create policy shared_ranks on public.ranks for select to authenticated using (true);
create policy own_character on public.characters for select to authenticated using (account_id=(select auth.uid()));
create policy shared_pools on public.seat_pools for select to authenticated using (true);
create policy shared_seats on public.rank_seats for select to authenticated using (true);
create policy own_requirements on public.promotion_requirements for select to authenticated using (exists(select 1 from public.characters c where c.id=character_id and c.account_id=(select auth.uid())));
create policy visible_events on public.events_log for select to authenticated using (account_id=(select auth.uid()) or (account_id is null and character_id is null));
create policy shared_leaderboards on public.leaderboards for select to authenticated using (true);
-- Tables with no read policy are server-private.
grant all on public.accounts,public.seasons,public.ranks,public.characters,public.seat_pools,public.rank_seats,public.promotion_requirements,public.events_log,public.weekly_event_checks,public.leaderboards,public.account_calamity_claims,public.setup_requests to service_role;
revoke all on function public.get_character_setup(uuid) from public,anon,authenticated;
revoke all on function public.commit_character_setup(uuid,uuid,bigint,uuid,text,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.record_best_life_score(uuid,bigint,text,date) from public,anon,authenticated;
grant execute on function public.get_character_setup(uuid),public.commit_character_setup(uuid,uuid,bigint,uuid,text,jsonb,jsonb),public.record_best_life_score(uuid,bigint,text,date) to service_role;
commit;
