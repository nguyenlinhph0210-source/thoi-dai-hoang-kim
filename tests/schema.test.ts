import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { generateCharacter, generatePromotionRequirements } from '../src/lib/characterGenerator';
import { RANKS } from '../src/lib/gameConfig';

test('Supabase schema: migrations, lifecycle transactions, seats, idempotency and RLS',async t=>{
  const db=new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated;`);
    await db.exec(await readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8'));
    const id=randomUUID();const otherId=randomUUID();const season=randomUUID();
    await db.query('insert into auth.users(id) values ($1),($2)',[id,otherId]);
    await db.query("insert into public.seasons(id,name,scenario_code) values($1,'Đại Khánh','THIEN_NGUYEN')",[season]);
    const candidate=generateCharacter('CIVIL',{id:randomUUID(),accountId:id,seasonId:season,now:new Date().toISOString(),gameYear:1,random:()=>0});
    async function rpc(revision:number,action:string,request=randomUUID(),c:unknown=candidate,requirements:unknown=null) {
      const result=await db.query<{state:{revision:number;account:{freeRerollsLeft:number;destinyPoints:number;pendingRewardSilver:number};character:{id:string;status:string;characterSilver:number;promotionRequirements:unknown}}}>(
        'select public.commit_character_setup($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb) as state',
        [id,season,revision,request,action,c===null?null:JSON.stringify(c),requirements===null?null:JSON.stringify(requirements)]);
      return result.rows[0].state;
    }
    await t.test('new users get three lifetime free rolls and first preview costs nothing',async()=>{
      const state=await rpc(0,'BEGIN');assert.equal(state.revision,1);assert.equal(state.account.freeRerollsLeft,3);
      assert.equal(state.character.status,'DRAFT');
    });
    await t.test('reroll retries do not double-charge and stale writes are rejected',async()=>{
      const request=randomUUID();const state=await rpc(1,'REROLL',request);
      assert.equal(state.account.freeRerollsLeft,2);
      assert.deepEqual(await rpc(1,'REROLL',request),state);
      await assert.rejects(()=>rpc(1,'REROLL'),/Stale setup revision/);
      await rpc(2,'REROLL');const last=await rpc(3,'REROLL');assert.equal(last.account.freeRerollsLeft,0);
      await assert.rejects(()=>rpc(4,'REROLL'),/Insufficient destiny/);
      await assert.rejects(()=>rpc(4,'BEGIN',randomUUID(),{...candidate,branch:'HAREM',rankId:'harem_0'}),/Branch is locked/);
    });
    await t.test('paid roll preserves pending silver, confirmation claims one seat and transfers once',async()=>{
      await db.query('update public.accounts set destiny_points=2,pending_reward_silver=200 where id=$1',[id]);
      const paid=await rpc(4,'REROLL');assert.equal(paid.account.destinyPoints,1);assert.equal(paid.account.pendingRewardSilver,200);
      const req=generatePromotionRequirements(candidate,RANKS.civil_7b,new Date().toISOString(),()=>0);
      const request=randomUUID();const confirmed=await rpc(5,'CONFIRM',request,null,req);
      assert.equal(confirmed.character.status,'ACTIVE');assert.equal(confirmed.character.characterSilver,candidate.characterSilver+200);
      assert.equal(confirmed.account.pendingRewardSilver,0);assert.equal(confirmed.account.freeRerollsLeft,0);
      assert.deepEqual(await rpc(5,'CONFIRM',request,null,req),confirmed);
      assert.deepEqual(await rpc(6,'CONFIRM',randomUUID(),null,req),confirmed);
      const seats=await db.query<{count:number}>('select count(*)::int as count from public.rank_seats where character_id=$1',[candidate.id]);
      assert.equal(seats.rows[0].count,1);
      await assert.rejects(()=>rpc(6,'REROLL'),/Only drafts/);
      const locked=await db.query<{count:number}>('select count(*)::int as count from public.promotion_requirements where character_id=$1',[candidate.id]);
      assert.equal(locked.rows[0].count,1);
    });
    await t.test('failed confirmation rolls back silver, requirements and seat assignment',async()=>{
      const second=generateCharacter('MILITARY',{id:randomUUID(),accountId:otherId,seasonId:season,now:new Date().toISOString(),gameYear:1,random:()=>0});
      await db.query('select public.commit_character_setup($1,$2,0,$3,$4,$5::jsonb)',[otherId,season,randomUUID(),'BEGIN',JSON.stringify(second)]);
      await db.query('update public.accounts set pending_reward_silver=100 where id=$1',[otherId]);
      const invalid={characterId:second.id,targetRankId:'military_7',conditions:[{stat:'int',operator:'>=',value:80}]};
      await assert.rejects(()=>db.query('select public.commit_character_setup($1,$2,1,$3,$4,null,$5::jsonb)',[otherId,season,randomUUID(),'CONFIRM',JSON.stringify(invalid)]),/check constraint/);
      const rows=await db.query<{status:string;pending_reward_silver:number}>('select c.status,a.pending_reward_silver from public.characters c join public.accounts a on a.id=c.account_id where c.id=$1',[second.id]);
      assert.equal(rows.rows[0].status,'DRAFT');assert.equal(Number(rows.rows[0].pending_reward_silver),100);
      const seats=await db.query<{count:number}>('select count(*)::int as count from public.rank_seats where character_id=$1',[second.id]);assert.equal(seats.rows[0].count,0);
    });
    await t.test('leaderboard keeps highest single-life score, never sums',async()=>{
      for(const score of [100,60,130]) await db.query("select public.record_best_life_score($1,$2,'SEASON','2026-11-14')",[candidate.id,score]);
      const result=await db.query<{score:number}>('select best_life_score::int as score from public.leaderboards where account_id=$1',[id]);assert.equal(result.rows[0].score,130);
    });
    await t.test('constraints reject malformed condition objects and out-of-range stats',async()=>{
      const malformed=[{stat:'int',operator:'>=',value:80},{stat:'rep',operator:'>=',value:60},{stat:'cha',operator:'>='}];
      const validation=await db.query<{valid:boolean}>('select public.valid_promotion_conditions($1::jsonb) as valid',[JSON.stringify(malformed)]);assert.equal(validation.rows[0].valid,false);
      await assert.rejects(()=>db.query('update public.characters set hp=101 where id=$1',[candidate.id]),/check constraint/);
    });
    await t.test('authenticated users can only read their own account and cannot mutate resources or read suspicion',async()=>{
      await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');
      try {
        const accounts=await db.query<{id:string}>('select id from public.accounts');assert.deepEqual(accounts.rows,[{id}]);
        const chars=await db.query<{id:string}>('select id,age from public.characters');assert.equal(chars.rows.length,1);
        await assert.rejects(()=>db.query('select suspicion from public.characters'),/permission denied/);
        await assert.rejects(()=>db.query('update public.accounts set destiny_points=999'),/permission denied/);
        await assert.rejects(()=>db.query('select public.get_character_setup($1)',[otherId]),/permission denied/);
        await assert.rejects(()=>rpc(6,'REROLL'),/permission denied/);
      } finally {await db.exec('reset role');}
    });
    await t.test('capacity rejects the seventeenth civil seat without confirming or spending silver',async()=>{
      // Fill remaining 15 seats through the real RPC, then attempt one extra.
      for(let index=0;index<16;index++) {
        const user=randomUUID();await db.query('insert into auth.users(id) values($1)',[user]);
        const c=generateCharacter('CIVIL',{id:randomUUID(),accountId:user,seasonId:season,now:new Date().toISOString(),gameYear:1,random:()=>0});
        const req=generatePromotionRequirements(c,RANKS.civil_7b,new Date().toISOString(),()=>0);
        await db.query('select public.commit_character_setup($1,$2,0,$3,$4,$5::jsonb)',[user,season,randomUUID(),'BEGIN',JSON.stringify(c)]);
        const confirm=()=>db.query('select public.commit_character_setup($1,$2,1,$3,$4,null,$5::jsonb)',[user,season,randomUUID(),'CONFIRM',JSON.stringify(req)]);
        if(index===15) await assert.rejects(confirm,/No vacant seat/);else await confirm();
      }
      const result=await db.query<{occupied:number}>('select count(*)::int as occupied from public.rank_seats where character_id is not null');assert.equal(result.rows[0].occupied,16);
    });
  } finally {await db.close();}
});
