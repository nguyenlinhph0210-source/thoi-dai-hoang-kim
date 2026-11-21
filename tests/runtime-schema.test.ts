import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { SupabaseGameRepository } from "../src/lib/repositories/SupabaseGameRepository";
import { PGlite } from "@electric-sql/pglite";
import { ACTIONS, type ActionCode } from "../src/config/actions";
import {
  transitionSetup,
  type SetupCommand,
} from "../src/lib/characterGenerator";
import { processAction } from "../src/lib/actionProcessor";
import { getWorldTime } from "../src/lib/worldClock";
import { utc7Date } from "../src/lib/ap";
import type { RuntimeState } from "../src/types/runtime";
import { MS_PER_GAME_DAY } from "../src/config/balance";

test("M2 migrations/RPC: rerunnable, atomic AP/actions, RLS, illness, pagination and exact replay", async (t) => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;`,
    );
    for (const name of [
      "schema.sql",
      "migrations/0002_character_ill_status.sql",
      "migrations/0003_runtime_foundation.sql",
      "migrations/0002_character_ill_status.sql",
      "migrations/0003_runtime_foundation.sql",
    ]) {
      try {
        await db.exec(
          await readFile(
            new URL(`../supabase/${name}`, import.meta.url),
            "utf8",
          ),
        );
      } catch (error) {
        throw new Error(`${name}: ${(error as Error).message}`);
      }
    }
    const id = randomUUID(),
      other = randomUUID();
    await db.query("insert into auth.users(id) values($1),($2)", [id, other]);
    async function snapshot(who: string = id) {
      return (
        await db.query<{ state: RuntimeState }>(
          "select public.runtime_snapshot($1) as state",
          [who],
        )
      ).rows[0].state;
    }
    function day(state: RuntimeState) {
      return Math.floor(
        Math.max(
          0,
          state.serverNow - Date.parse(state.season.seasonStartTimestamp),
        ) / MS_PER_GAME_DAY,
      );
    }
    async function setup(command: SetupCommand, who = id) {
      const s = await snapshot(who);
      const next = transitionSetup(s, command, {
        id: randomUUID(),
        accountId: who,
        seasonId: s.season.id,
        now: new Date(s.serverNow).toISOString(),
        gameYear: getWorldTime(
          s.serverNow,
          Date.parse(s.season.seasonStartTimestamp),
        ).currentGameYear,
        random: () => 0,
      });
      await db.query(
        "select public.commit_runtime_setup($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7)",
        [
          who,
          s.revision,
          randomUUID(),
          command.type,
          JSON.stringify(next.character),
          JSON.stringify(next.character?.promotionRequirements),
          day(s),
        ],
      );
    }
    async function proposal(code: ActionCode) {
      const s = await snapshot();
      const processed = processAction(s, code, randomUUID());
      const a = ACTIONS[code];
      return {
        state: s,
        value: {
          character: processed.state.character,
          result: { log: processed.log, message: "Đã hoàn thành." },
          apCost: a.apCost,
          silverCost: a.silverCost,
          hpCost: a.hpCost,
          dailyCap: a.dailyCap,
          date: utc7Date(s.serverNow),
          gameDay: day(s),
        },
      };
    }
    async function commit(
      code: ActionCode,
      p: Awaited<ReturnType<typeof proposal>>,
      key = randomUUID(),
    ) {
      return (
        await db.query<{ result: unknown }>(
          "select public.commit_game_action($1,$2,$3,$4,$5::jsonb) as result",
          [id, p.state.revision, key, code, JSON.stringify(p.value)],
        )
      ).rows[0].result;
    }
    await t.test(
      "exactly one active seeded season, account defaults and canonical AP aliases",
      async () => {
        const s = await snapshot();
        assert.equal(s.account.actionPoints, 10);
        assert.equal(s.account.freeRerollsLeft, 3);
        assert.equal(s.account.pendingRewardSilver, 0);
        assert.equal(s.account.destinyPoints, 0);
        assert.equal(s.season.scenarioCode, "dai-khanh-thien-nguyen");
        const count = await db.query<{ n: number }>(
          "select count(*)::int as n from public.seasons where status='ACTIVE'",
        );
        assert.equal(count.rows[0].n, 1);
      },
    );
    await t.test(
      "lazy AP grants on read once per date, offline accumulation capped and columns stay synchronized",
      async () => {
        await db.query(
          "update public.accounts set ap=0,last_ap_grant_date=(now() at time zone 'Asia/Ho_Chi_Minh')::date-3 where id=$1",
          [id],
        );
        const one = await snapshot(),
          two = await snapshot();
        assert.equal(one.account.actionPoints, 15);
        assert.equal(two.revision, one.revision);
        const aliases = await db.query<{ ok: boolean }>(
          "select ap=action_points and last_ap_grant_date=last_ap_grant_date_utc7 as ok from public.accounts where id=$1",
          [id],
        );
        assert.equal(aliases.rows[0].ok, true);
        await db.query("update public.accounts set ap=10 where id=$1", [id]);
      },
    );
    await t.test(
      "M1 creation persists through new adapter RPC without assigning seats; pending reward transferred once",
      async () => {
        await setup({ type: "BEGIN", branch: "CIVIL" });
        await db.query(
          "update public.accounts set pending_reward_silver=100 where id=$1",
          [id],
        );
        await setup({ type: "CONFIRM" });
        const s = await snapshot();
        assert.equal(s.account.pendingRewardSilver, 0);
        assert.equal(s.character!.characterSilver, 120);
        assert.equal(s.character!.startGameYear, 1);
        assert.equal(s.character!.startAge, 16);
        const seats = await db.query<{ n: number }>(
          "select count(*)::int as n from public.rank_seats",
        );
        assert.equal(seats.rows[0].n, 0);
      },
    );
    await t.test(
      "exact stored result on duplicate key after later actions; stale concurrent proposal cannot spend AP",
      async () => {
        const first = await proposal("STUDY"),
          second = await proposal("REST"),
          key = randomUUID();
        const result = await commit("STUDY", first, key);
        await assert.rejects(() => commit("REST", second), /STALE_REVISION/);
        await commit("REST", await proposal("REST"));
        assert.deepEqual(await commit("STUDY", first, key), result);
        assert.equal((await snapshot()).account.actionPoints, 8);
        await assert.rejects(() => commit("REST", second, key), /Idempotency/);
        const count = await db.query<{ n: number }>(
          "select count(*)::int as n from public.character_week_marks",
        );
        assert.equal(count.rows[0].n, 1);
      },
    );
    await t.test(
      "daily cap enforced in SQL and rejected write leaves resources/logs untouched",
      async () => {
        for (let i = 0; i < 4; i++)
          await commit("STUDY", await proposal("STUDY"));
        const before = await snapshot();
        const blocked = await proposal("REST");
        blocked.value.dailyCap = 5;
        const staleStudy = {
          ...blocked,
          value: { ...blocked.value, character: blocked.state.character },
        };
        await assert.rejects(() => commit("STUDY", staleStudy), /Daily cap/);
        const after = await snapshot();
        assert.equal(after.account.actionPoints, before.account.actionPoints);
        assert.equal(after.revision, before.revision);
        await db.query("update public.accounts set ap=0 where id=$1", [id]);
        const p = { ...blocked, state: await snapshot() };
        await assert.rejects(() => commit("REST", p), /Insufficient AP/);
      },
    );
    await t.test(
      "zero HP lock enforced in SQL, treatment requires five actions and AP never goes negative",
      async () => {
        await db.query("update public.accounts set ap=10 where id=$1", [id]);
        await db.query(
          "update public.characters set hp=0,status='SEVERELY_ILL',treatments_remaining=5 where account_id=$1",
          [id],
        );
        const s = await snapshot();
        const p = {
          state: s,
          value: {
            apCost: 1,
            silverCost: 0,
            hpCost: 0,
            dailyCap: 8,
            date: utc7Date(s.serverNow),
            gameDay: day(s),
            character: s.character,
            result: { log: { apSpent: 1, apAfter: 9 } },
          },
        };
        await assert.rejects(
          () =>
            db.query(
              "select public.commit_game_action($1,$2,$3,$4,$5::jsonb)",
              [id, s.revision, randomUUID(), "WORK", JSON.stringify(p.value)],
            ),
          /Character action locked/,
        );
        for (let i = 0; i < 5; i++)
          await commit("TREAT", await proposal("TREAT"));
        assert.equal((await snapshot()).character!.status, "ACTIVE");
        assert.equal((await snapshot()).character!.treatmentsRemaining, 0);
        assert.equal((await snapshot()).account.actionPoints, 5);
      },
    );
    await t.test(
      "SupabaseGameRepository adapter runs setup/actions against real PGlite RPCs via a mock HTTP transport",
      async () => {
        // Keep M2 regression assertions above intact; exercise its adapter through the latest wrappers below.
        for (const name of [
          "0004_promotion_requirements.sql",
          "0005_seats_and_promotion.sql",
          "0006_fix_safeupdate.sql",
          "0007_personal_events.sql",
        ])
          await db.exec(
            await readFile(
              new URL(`../supabase/migrations/${name}`, import.meta.url),
              "utf8",
            ),
          );
        let forceRace = false;
        let hideLedger = false;
        const fetcher: typeof fetch = async (input, init) => {
          const request = new Request(input, init);
          const url = new URL(request.url);
          const path = url.pathname;
          try {
            let value: unknown;
            if (path.includes("/rpc/")) {
              const body = (await request.json()) as Record<string, unknown>;
              const name = path.split("/").at(-1);
              if (name === "runtime_snapshot") {
                const state = await snapshot(String(body.p_account_id));
                if (forceRace) {
                  state.account.actionPoints = 0;
                  forceRace = false;
                }
                value = state;
              } else if (name === "commit_runtime_setup")
                value = (
                  await db.query<{ v: unknown }>(
                    "select public.commit_runtime_setup($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7) as v",
                    [
                      body.p_account_id,
                      body.p_revision,
                      body.p_key,
                      body.p_command,
                      JSON.stringify(body.p_candidate),
                      JSON.stringify(body.p_requirements),
                      body.p_game_day,
                    ],
                  )
                ).rows[0].v;
              else if (name === "commit_game_action")
                value = (
                  await db.query<{ v: unknown }>(
                    "select public.commit_game_action($1,$2,$3,$4,$5::jsonb) as v",
                    [
                      body.p_account_id,
                      body.p_revision,
                      body.p_key,
                      body.p_code,
                      JSON.stringify(body.p_proposal),
                    ],
                  )
                ).rows[0].v;
              else if (
                name === "event_work_clock" ||
                name === "seat_world_clock" ||
                name === "seat_world_load" ||
                name === "read_seat_board"
              ) {
                value = (
                  await db.query<{ v: unknown }>(`select public.${name}() as v`)
                ).rows[0].v;
                if (name === "seat_world_load" && forceRace) {
                  (value as { states: RuntimeState[] }).states.find(
                    (s) => s.account.id === other,
                  )!.account.actionPoints = 0;
                  forceRace = false;
                }
              } else if (name === "read_game_journal")
                value = (
                  await db.query<{ v: unknown }>(
                    "select public.read_game_journal($1,$2) as v",
                    [body.p_account_id, body.p_page],
                  )
                ).rows[0].v;
              else if (name === "commit_event_world")
                value = (
                  await db.query<{ v: unknown }>(
                    "select public.commit_event_world($1,$2::jsonb) as v",
                    [body.p_version, JSON.stringify(body.p_proposal)],
                  )
                ).rows[0].v;
              else throw new Error("Unexpected RPC");
            } else {
              const who = url.searchParams.get("account_id")?.slice(3);
              let rows: unknown[] = [];
              if (path.endsWith("/action_requests")) {
                const key = url.searchParams.get("idempotency_key")?.slice(3);
                rows = (
                  await db.query(
                    "select action_code,result from public.action_requests where account_id=$1 and idempotency_key=$2",
                    [who, key],
                  )
                ).rows;
                if (hideLedger) {
                  rows = [];
                  hideLedger = false;
                }
              } else if (path.endsWith("/setup_requests"))
                rows = (
                  await db.query(
                    "select action,result from public.setup_requests where account_id=$1 and request_id=$2",
                    [who, url.searchParams.get("request_id")?.slice(3)],
                  )
                ).rows;
              else if (path.endsWith("/seasons"))
                rows = (
                  await db.query(
                    "select * from public.seasons where status='ACTIVE'",
                  )
                ).rows;
              else if (path.endsWith("/action_logs"))
                rows = (
                  await db.query(
                    "select result from public.action_logs where account_id=$1 order by created_at desc,id desc limit 21 offset $2",
                    [who, Number(url.searchParams.get("offset") ?? 0)],
                  )
                ).rows;
              else throw new Error("Unexpected table");
              value = request.headers
                .get("accept")
                ?.includes("vnd.pgrst.object")
                ? (rows[0] ?? null)
                : rows;
            }
            return new Response(JSON.stringify(value), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          } catch (error) {
            return new Response(
              JSON.stringify({
                message: (error as Error).message,
                code: "P0001",
              }),
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
        let state = await repo.readState(other);
        const setupKey = randomUUID();
        state = await repo.setup(
          other,
          { type: "BEGIN", branch: "HAREM" },
          state.revision,
          setupKey,
        );
        assert.deepEqual(
          await repo.setup(
            other,
            { type: "BEGIN", branch: "HAREM" },
            0,
            setupKey,
          ),
          state,
        );
        await repo.setup(
          other,
          { type: "CONFIRM" },
          state.revision,
          randomUUID(),
        );
        const key = randomUUID();
        const first = await repo.act(other, "STUDY", key);
        await repo.act(other, "REST", randomUUID());
        assert.deepEqual(await repo.act(other, "STUDY", key), first);
        assert.equal((await repo.logs(other, 0)).length, 2);
        hideLedger = true;
        forceRace = true;
        assert.deepEqual(await repo.act(other, "STUDY", key), first);
        assert.equal((await repo.readState(other)).account.actionPoints, 8);
      },
    );
    await t.test(
      "reapplying 0003 after real account activity preserves balances, season start and logs",
      async () => {
        const before = await snapshot();
        const countBefore = await db.query<{ n: number }>(
          "select count(*)::int as n from public.action_logs",
        );
        await db.exec(
          await readFile(
            new URL(
              "../supabase/migrations/0003_runtime_foundation.sql",
              import.meta.url,
            ),
            "utf8",
          ),
        );
        const after = await snapshot();
        assert.deepEqual(after.account, before.account);
        assert.equal(
          after.season.seasonStartTimestamp,
          before.season.seasonStartTimestamp,
        );
        assert.equal(
          after.character!.characterSilver,
          before.character!.characterSilver,
        );
        assert.deepEqual(
          (
            await db.query<{ n: number }>(
              "select count(*)::int as n from public.action_logs",
            )
          ).rows,
          countBefore.rows,
        );
      },
    );
    await t.test(
      "owner-only RLS and hidden data/service RPC protections for anon and authenticated",
      async () => {
        await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
          randomUUID(),
        ]);
        await db.exec("set role authenticated");
        try {
          assert.equal(
            (await db.query("select account_id from public.action_daily_usage"))
              .rows.length,
            0,
          );
          assert.equal(
            (await db.query("select id from public.action_logs")).rows.length,
            0,
          );
          await assert.rejects(
            () => db.query("select result from public.action_logs"),
            /permission denied/,
          );
          await assert.rejects(
            () => db.query("select public.runtime_snapshot($1)", [id]),
            /permission denied/,
          );
          await assert.rejects(
            () => db.query("update public.accounts set ap=15"),
            /permission denied/,
          );
          await assert.rejects(
            () => db.query("select * from public.seasons"),
            /permission denied/,
          );
        } finally {
          await db.exec("reset role");
        }
        await db.exec("set role anon");
        try {
          await assert.rejects(
            () =>
              db.query(
                "select public.commit_game_action($1,0,$2,$3,$4::jsonb)",
                [id, randomUUID(), "WORK", "{}"],
              ),
            /permission denied/,
          );
        } finally {
          await db.exec("reset role");
        }
      },
    );
  } finally {
    await db.close();
  }
});
