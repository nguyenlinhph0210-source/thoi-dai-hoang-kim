import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { createClient } from "@supabase/supabase-js";
import { SupabaseGameRepository } from "../src/lib/repositories/SupabaseGameRepository";
import { SEAT_POOL_DEFINITIONS } from "../src/config/seats";
import { applyForPromotion, runDueSeatRounds } from "../src/lib/seatEngine";
import { seatProposal } from "../src/lib/seatPersistence";
import { generatePromotionRequirements } from "../src/lib/characterGenerator";
import { RANKS } from "../src/lib/gameConfig";
import { MS_PER_GAME_DAY } from "../src/config/balance";
import type { SeatWorld, SeatChange } from "../src/types/seats";
import type { RuntimeState } from "../src/types/runtime";

test("0005/0006/PGlite: rerunnable pools, RPC transactions, CAS, exact replay, seats, conversion and RLS", async (t) => {
  const db = new PGlite();
  try {
    await db.exec(
      "create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;",
    );
    for (const name of [
      "schema.sql",
      "migrations/0002_character_ill_status.sql",
      "migrations/0003_runtime_foundation.sql",
      "migrations/0004_promotion_requirements.sql",
      "migrations/0005_seats_and_promotion.sql",
      "migrations/0005_seats_and_promotion.sql",
      "migrations/0006_fix_safeupdate.sql",
      "migrations/0006_fix_safeupdate.sql",
    ])
      await db.exec(
        await readFile(new URL(`../supabase/${name}`, import.meta.url), "utf8"),
      );
    const ids = [randomUUID(), randomUUID(), randomUUID()];
    await db.query("insert into auth.users(id) values($1),($2),($3)", ids);
    const snapshot = async (id: string) =>
      (
        await db.query<{ v: RuntimeState }>(
          "select public.runtime_snapshot($1) as v",
          [id],
        )
      ).rows[0].v;
    const load = async () =>
      (await db.query<{ v: SeatWorld }>("select public.seat_world_load() as v"))
        .rows[0].v;
    const commit = async (change: SeatChange) =>
      (
        await db.query<{ v: unknown }>(
          "select public.commit_seat_world($1,$2::jsonb) as v",
          [change.before.version, JSON.stringify(seatProposal(change))],
        )
      ).rows[0].v;
    const signatures: Record<string, string[]> = {
      seat_world_clock: [],
      seat_world_load: [],
      read_seat_board: [],
      runtime_snapshot: ["p_account_id"],
      read_game_journal: ["p_account_id", "p_page"],
      commit_seat_world: ["p_version", "p_proposal"],
      release_seats: ["p_character_id"],
      convert_inner_court_to_harem: [
        "p_character_id",
        "p_version",
        "p_proposal",
      ],
      commit_game_action: [
        "p_account_id",
        "p_revision",
        "p_key",
        "p_code",
        "p_proposal",
      ],
      commit_runtime_setup: [
        "p_account_id",
        "p_revision",
        "p_key",
        "p_command",
        "p_candidate",
        "p_requirements",
        "p_game_day",
      ],
    };
    const fetcher: typeof fetch = async (input, init) => {
      const req = new Request(input, init),
        url = new URL(req.url);
      try {
        let value: unknown;
        const name = url.pathname.split("/").at(-1)!;
        if (url.pathname.includes("/rpc/")) {
          const body = (await req.json()) as Record<string, unknown>,
            keys = signatures[name];
          if (!keys) throw new Error("Unexpected RPC");
          value = (
            await db.query<{ v: unknown }>(
              `select public.${name}(${keys.map((k, i) => `$${i + 1}${["p_proposal", "p_candidate", "p_requirements"].includes(k) ? "::jsonb" : ""}`).join(",")}) as v`,
              keys.map((k) =>
                typeof body[k] === "object" ? JSON.stringify(body[k]) : body[k],
              ),
            )
          ).rows[0].v;
        } else if (name === "action_requests" || name === "setup_requests") {
          const cols =
              name === "action_requests"
                ? "action_code,result"
                : "action,result",
            key = name === "action_requests" ? "idempotency_key" : "request_id";
          const rows = (
            await db.query(
              `select ${cols} from public.${name} where account_id=$1 and ${key}=$2`,
              [
                url.searchParams.get("account_id")!.slice(3),
                url.searchParams.get(key)!.slice(3),
              ],
            )
          ).rows;
          value = rows[0] ?? null;
        } else throw new Error("Unexpected table");
        return new Response(JSON.stringify(value), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (e) {
        return new Response(
          JSON.stringify({ message: (e as Error).message, code: "P0001" }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }
    };
    const repo = new SupabaseGameRepository(
      createClient("https://fixture.supabase.test", "test-only-key", {
        global: { fetch: fetcher },
        auth: { persistSession: false, autoRefreshToken: false },
      }),
    );
    async function setup(id: string, branch: "CIVIL" | "INNER_COURT") {
      let state = await snapshot(id);
      state = await repo.setup(
        id,
        { type: "BEGIN", branch },
        state.revision,
        randomUUID(),
      );
      await repo.setup(id, { type: "CONFIRM" }, state.revision, randomUUID());
    }
    await setup(ids[0], "CIVIL");
    await setup(ids[1], "CIVIL");
    await setup(ids[2], "INNER_COURT");
    await db.exec(
      "update public.seasons set season_start_timestamp=now()-interval '120000 seconds' where status='ACTIVE';update public.seat_world_state set last_round=57;",
    );
    async function ready(id: string, rankId: string) {
      await db.query(
        "update public.characters set rank_id=$2,int=1000,rep=1000,fav=1000,cha=1000,hp=100,suspicion=0,character_silver=100,merit=1000,rank_entered_at=now()-interval '120000 seconds',exam_passed_for_rank_id=$3,exam_passed_game_day=400 where account_id=$1",
        [id, rankId, RANKS[rankId].nextRankId],
      );
      const s = await snapshot(id),
        c = s.character!,
        r = generatePromotionRequirements(
          c,
          RANKS[RANKS[rankId].nextRankId!],
          new Date(s.serverNow).toISOString(),
          () => 0,
        )!;
      await db.query(
        "delete from public.promotion_requirements where character_id=$1",
        [c.id],
      );
      await db.query(
        "insert into public.promotion_requirements(character_id,target_rank_id,conditions,table_version,thresholds) values($1,$2,$3::jsonb,'v1',$4::jsonb)",
        [
          c.id,
          r.targetRankId,
          JSON.stringify(r.conditions),
          JSON.stringify(
            Object.fromEntries(r.conditions.map((c) => [c.stat, c.value])),
          ),
        ],
      );
    }
    await ready(ids[0], "civil_3b");
    await ready(ids[1], "civil_3b");
    await ready(ids[2], "inner_1");
    await t.test(
      "every physical capacity and rank link equals config; initial characters occupy no seats",
      async () => {
        const w = await load();
        const pools = (
          await db.query<{ pool_key: string; capacity: number }>(
            "select pool_key,capacity from public.seat_pools where season_id=$1",
            [w.season.id],
          )
        ).rows;
        assert.equal(pools.length, SEAT_POOL_DEFINITIONS.length);
        for (const def of SEAT_POOL_DEFINITIONS) {
          assert.equal(
            pools.find((p) => p.pool_key === def.key)!.capacity,
            def.capacity,
          );
          assert.deepEqual(
            (
              await db.query<{ rank_id: string }>(
                "select rank_id from public.rank_pool_links where season_id=$1 and pool_key=$2 order by rank_id",
                [w.season.id, def.key],
              )
            ).rows.map((r) => r.rank_id),
            [...def.rankIds].sort(),
          );
        }
        assert.equal(w.assignments.length, 0);
      },
    );
    await t.test(
      "APPLY is exact/idempotent through adapter, free withdraw and account daily cap; unlimited immediately promotes in one commit",
      async () => {
        const key = randomUUID();
        const [a, b] = await Promise.all([
          repo.act(ids[0], "APPLY", key),
          repo.act(ids[0], "APPLY", key),
        ]);
        assert.deepEqual(a, b);
        assert.equal((await snapshot(ids[0])).account.actionPoints, 9);
        await repo.act(ids[0], "WITHDRAW", randomUUID());
        await repo.act(ids[0], "APPLY", randomUUID());
        await repo.act(ids[0], "WITHDRAW", randomUUID());
        await assert.rejects(
          () => repo.act(ids[0], "APPLY", randomUUID()),
          /hạn mức/,
        );
        await repo.act(ids[2], "APPLY", randomUUID());
        const s = await repo.readState(ids[2]);
        assert.equal(s.character!.rankId, "inner_2");
        assert.equal(s.character!.examPassedForRankId, null);
        assert.equal(s.account.actionPoints, 9);
        assert.equal(
          s.character!.promotionRequirements!.targetRankId,
          "inner_3",
        );
        assert((await repo.logs(ids[2], 0)).some((l) => l.promotion));
      },
    );
    // New real-day quota for a fresh contest fixture (no client can perform these owner-only updates).
    await db.query(
      "delete from public.action_daily_usage where account_id in ($1,$2) and action_code='APPLY'",
      ids.slice(0, 2),
    );
    await repo.act(ids[0], "APPLY", randomUUID());
    await repo.act(ids[1], "APPLY", randomUUID());
    await db.query("update public.characters set int=700 where account_id=$1", [
      ids[0],
    ]);
    const w = await load();
    const boundary =
      Date.parse(w.season.seasonStartTimestamp) + 57 * 7 * MS_PER_GAME_DAY;
    await db.exec(`update public.seat_world_state set last_round=56;`);
    await db.query(
      "update public.seat_applications set created_at=$1,expires_at=now()+interval '8400 seconds',first_round=57 where status='WAITING'",
      [new Date(boundary - 1000).toISOString()],
    );
    await db.exec(
      "update public.characters set exam_passed_game_day=399 where branch='CIVIL';",
    );
    const oldHolder = (await snapshot(ids[1])).character!;
    await db.query(
      "insert into public.seat_assignments(id,character_id,season_id,pool_key,seat_number,rank_id,assigned_at) values($1,$2,$3,'civil_3b',1,'civil_3b',now())",
      [randomUUID(), oldHolder.id, w.season.id],
    );
    await db.query(
      "update public.rank_seats set character_id=$1,assigned_at=now() where season_id=$2 and pool_key='civil_3b' and seat_number=1",
      [oldHolder.id, w.season.id],
    );
    await t.test(
      "two stale proposals cannot claim one seat; rounds replay and stronger applicant wins; old seat is freed",
      async () => {
        const before = await load(),
          after = runDueSeatRounds(before, { random: () => 0 });
        assert.equal(
          after.states.find((s) => s.account.id === ids[1])!.character!.rankId,
          "civil_3",
        );
        const proposal = { before, after, operation: "ROUNDS" as const };
        const results = await Promise.allSettled([
          commit(proposal),
          commit(proposal),
        ]);
        assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
        assert.match(
          String(
            (
              results.find(
                (r) => r.status === "rejected",
              ) as PromiseRejectedResult
            ).reason,
          ),
          /STALE_REVISION/,
        );
        await Promise.all([repo.runDueSeatRounds(), repo.runDueSeatRounds()]);
        const saved = await load();
        assert.equal(
          saved.assignments.filter(
            (a) => !a.releasedAt && a.poolKey === "civil_3",
          ).length,
          1,
        );
        assert.equal(
          saved.applications.find(
            (a) => a.accountId === ids[0] && a.status === "WAITING",
          )!.status,
          "WAITING",
        );
        const c = (await snapshot(ids[1])).character!;
        assert(
          saved.assignments.find(
            (a) => a.characterId === c.id && a.poolKey === "civil_3b",
          )!.releasedAt,
        );
        assert.equal(c.rankId, "civil_3");
        assert.equal(c.examPassedGameDay, null);
        assert.equal(c.promotionRequirements!.targetRankId, "civil_2b");
        assert.equal(
          (await repo.logs(ids[1], 0)).filter((l) => l.promotion).length,
          1,
        );
        await repo.releaseSeats(c.id);
        await repo.releaseSeats(c.id);
        assert.equal(
          (await repo.seatBoard()).find((r) => r.rankId === "civil_3")!
            .occupied,
          0,
        );
      },
    );
    await t.test(
      "server conversion preserves hidden stats/merit, supersedes old R, withdraws waiting, releases physical seat and applies formula",
      async () => {
        await ready(ids[2], "inner_5");
        const s = await snapshot(ids[2]),
          c = s.character!;
        await db.query(
          "insert into public.seat_assignments(id,character_id,season_id,pool_key,seat_number,rank_id,assigned_at) values($1,$2,$3,'inner_5',1,'inner_5',now());",
          [randomUUID(), c.id, s.season.id],
        );
        await db.query(
          "update public.rank_seats set character_id=$1,assigned_at=now() where season_id=$2 and pool_key='inner_5' and seat_number=1",
          [c.id, s.season.id],
        );
        await repo.act(ids[2], "APPLY", randomUUID());
        await db.query(
          "update public.characters set fav=100 where account_id=$1",
          [ids[2]],
        );
        await repo.convertInnerCourtToHarem(c.id);
        const next = (await repo.readState(ids[2])).character!;
        assert.equal(next.rankId, "harem_13");
        assert.equal(next.fav, 60);
        assert.equal(next.merit, c.merit);
        assert.equal(next.promotionRequirements!.targetRankId, "harem_12");
        assert.equal(
          (
            await db.query<{ status: string }>(
              "select status from public.seat_applications where character_id=$1 order by created_at desc limit 1",
              [c.id],
            )
          ).rows[0].status,
          "WITHDRAWN",
        );
        assert(
          (
            await db.query<{ superseded_at: string }>(
              "select superseded_at from public.promotion_requirements where character_id=$1 and target_rank_id=$2",
              [c.id, "inner_6"],
            )
          ).rows[0].superseded_at,
        );
        assert.equal(
          (
            await db.query<{ n: number }>(
              "select count(*)::int n from public.rank_seats where character_id=$1",
              [c.id],
            )
          ).rows[0].n,
          0,
        );
        const replayWorld = await load();
        await assert.rejects(
          () =>
            db.query(
              "select public.convert_inner_court_to_harem($1,$2,$3::jsonb)",
              [c.id, replayWorld.version, "{}"],
            ),
          /guard/,
        );
        await assert.rejects(
          () =>
            db.query(
              "update public.promotion_requirements set conditions='[]'::jsonb where character_id=$1",
              [c.id],
            ),
          /immutable/,
        );
      },
    );
    await t.test(
      "RLS own applications only; no raw seat assignments/history/world; anon/authenticated cannot call sensitive functions",
      async () => {
        await db.exec("begin;set local role authenticated;");
        try {
          await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
            ids[0],
          ]);
          const rows = (
            await db.query<{ account_id: string }>(
              "select account_id from public.seat_applications",
            )
          ).rows;
          assert(rows.length > 0);
          assert(rows.every((r) => r.account_id === ids[0]));
          const privileges = (
            await db.query<{ allowed: boolean }>(
              "select has_table_privilege('authenticated',t,'select') allowed from unnest(array['public.seat_assignments','public.rank_history','public.seat_world_state','public.rank_pool_links','public.seat_rounds']) t",
            )
          ).rows;
          assert(privileges.every((r) => !r.allowed));
          const functions = (
            await db.query<{
              anon: boolean;
              authenticated: boolean;
              service: boolean;
            }>(
              "select has_function_privilege('anon',p.oid,'execute') anon,has_function_privilege('authenticated',p.oid,'execute') authenticated,has_function_privilege('service_role',p.oid,'execute') service from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('commit_seat_world','seat_world_load','release_seats','convert_inner_court_to_harem','read_game_journal')",
            )
          ).rows;
          assert.equal(functions.length, 5);
          assert(
            functions.every((f) => !f.anon && !f.authenticated && f.service),
          );
        } finally {
          await db.exec("rollback;");
        }
      },
    );
  } finally {
    await db.close();
  }
});
