import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("0006 replaces the unsafe trigger, survives repeated application, preserves grants and invalidates only ACTIVE world", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;",
    );
    for (const file of [
      "schema.sql",
      "migrations/0002_character_ill_status.sql",
      "migrations/0003_runtime_foundation.sql",
      "migrations/0004_promotion_requirements.sql",
      "migrations/0005_seats_and_promotion.sql",
    ])
      await db.exec(
        await readFile(new URL(`../supabase/${file}`, import.meta.url), "utf8"),
      );
    const id = randomUUID(),
      ended = randomUUID();
    await db.query("insert into auth.users(id) values($1)", [id]);
    await db.query(
      "insert into public.seasons(id,name,scenario_code,status,season_start_timestamp,ended_at) values($1,'Ended test','old-test','ENDED',now()-interval '1 year',now())",
      [ended],
    );
    await db.query(
      "insert into public.seat_world_state(season_id) values($1)",
      [ended],
    );
    await db.query(
      "update public.accounts set last_ap_grant_date=(now() at time zone 'Asia/Ho_Chi_Minh')::date-1,ap=1 where id=$1",
      [id],
    );
    // PGlite cannot load pg-safeupdate. Simulate the incident at the revision table:
    // reject writes while the deployed trigger still contains its unbounded UPDATE.
    // This checks the real RPC/trigger/AP call chain, not the actual extension planner.
    await db.exec(`create function public.test_safeupdate_guard() returns trigger language plpgsql as $$ begin
   if position('where season_id in' in lower(pg_get_functiondef('public.seat_world_after_write()'::regprocedure)))=0 then
    raise exception using errcode='21000',message='UPDATE requires a WHERE clause';
   end if;return null;end $$;
   create trigger test_safeupdate_guard before update on public.seat_world_state for each statement execute function public.test_safeupdate_guard();`);
    await assert.rejects(
      () => db.query("select public.seat_world_load()"),
      (e: Error) => {
        assert.equal((e as Error & { code: string }).code, "21000");
        assert.match(e.message, /WHERE clause/);
        return true;
      },
    );
    assert.equal(
      (
        await db.query<{ ap: number }>(
          "select ap from public.accounts where id=$1",
          [id],
        )
      ).rows[0].ap,
      1,
    );
    const before = (
      await db.query<{
        season_id: string;
        revision: number;
        last_round: number;
      }>("select season_id,revision,last_round from public.seat_world_state")
    ).rows;
    const migration = await readFile(
      new URL(
        "../supabase/migrations/0006_fix_safeupdate.sql",
        import.meta.url,
      ),
      "utf8",
    );
    await db.exec(migration);
    await db.exec(migration);
    await db.exec("set role service_role;");
    const world = (
      await db.query<{
        w: { states: { account: { id: string; actionPoints: number } }[] };
      }>("select public.seat_world_load() w")
    ).rows[0].w;
    assert.equal(
      world.states.find((s) => s.account.id === id)!.account.actionPoints,
      11,
    );
    await db.query("select public.runtime_snapshot($1)", [id]);
    await db.query("select public.read_seat_board()");
    await db.exec("reset role;");
    const after = (
      await db.query<{
        season_id: string;
        revision: number;
        last_round: number;
      }>("select season_id,revision,last_round from public.seat_world_state")
    ).rows;
    assert.deepEqual(
      after.find((r) => r.season_id === ended),
      before.find((r) => r.season_id === ended),
    );
    const active = after.find((r) => r.season_id !== ended)!;
    assert(
      active.revision >
        before.find((r) => r.season_id === active.season_id)!.revision,
    );
    assert.equal(active.last_round, 0);
    const grants = (
      await db.query<{
        anon: boolean;
        authenticated: boolean;
        service: boolean;
      }>(
        "select has_function_privilege('anon','public.seat_world_after_write()','execute') anon,has_function_privilege('authenticated','public.seat_world_after_write()','execute') authenticated,has_function_privilege('service_role','public.seat_world_after_write()','execute') service",
      )
    ).rows[0];
    assert.deepEqual(grants, {
      anon: false,
      authenticated: false,
      service: true,
    });
  } finally {
    await db.close();
  }
});
