import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { createClient } from "@supabase/supabase-js";
import { SupabaseGameRepository } from "../src/lib/repositories/SupabaseGameRepository";
import { transitionSetup } from "../src/lib/characterGenerator";
import {
  cosmeticPolicy,
  processCosmeticCommand,
} from "../src/lib/cosmeticEngine";
import { processAction, actionMessage } from "../src/lib/actionProcessor";
import { eventProposal } from "../src/lib/eventPersistence";
import { applyForPromotion } from "../src/lib/seatEngine";
import { seatProposal } from "../src/lib/seatPersistence";
import type { RuntimeState, ActionResult } from "../src/types/runtime";
import type { EventWorld } from "../src/types/events";
import type {
  CosmeticCommand,
  CharacterCosmetics,
} from "../src/types/cosmetics";
test("0008/PGlite: rerunnable H1 transactions, title promotion coupling, isolation and safe cleanup", async (t) => {
  const db = new PGlite();
  try {
    await db.exec(
      "create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;",
    );
    await db.exec(
      await readFile(
        new URL("../supabase/schema.sql", import.meta.url),
        "utf8",
      ),
    );
    for (const name of (
      await readdir(new URL("../supabase/migrations", import.meta.url))
    )
      .filter((n) => n.endsWith(".sql"))
      .sort())
      await db.exec(
        await readFile(
          new URL(`../supabase/migrations/${name}`, import.meta.url),
          "utf8",
        ),
      );
    const migration = await readFile(
      new URL(
        "../supabase/migrations/0008_harem_cosmetics.sql",
        import.meta.url,
      ),
      "utf8",
    );
    await db.exec(migration);
    const ids = [randomUUID(), randomUUID()];
    await db.query("insert into auth.users(id) values($1),($2)", ids);
    const load = async () =>
      (await db.query<{ v: EventWorld }>("select public.seat_world_load() v"))
        .rows[0].v;
    const data = async (id: string) =>
      (
        await db.query<{ v: CharacterCosmetics }>(
          "select public.read_character_cosmetics($1) v",
          [id],
        )
      ).rows[0].v;
    const snapshot = async (id: string) => {
      const state = (
        await db.query<{ v: RuntimeState }>(
          "select public.runtime_snapshot($1) v",
          [id],
        )
      ).rows[0].v;
      state.cosmetics = await data(id);
      return state;
    };
    for (const [i, id] of ids.entries())
      for (const cmd of [
        {
          type: "BEGIN" as const,
          branch: i === 0 ? ("HAREM" as const) : ("CIVIL" as const),
        },
        { type: "CONFIRM" as const },
      ]) {
        const state = await snapshot(id),
          next = transitionSetup(state, cmd, {
            id: randomUUID(),
            accountId: id,
            seasonId: state.season.id,
            now: new Date(state.serverNow).toISOString(),
            gameYear: 1,
            random: () => 0,
          });
        await db.query(
          "select public.commit_runtime_setup($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7)",
          [
            id,
            state.revision,
            randomUUID(),
            cmd.type,
            JSON.stringify(next.character),
            JSON.stringify(next.character?.promotionRequirements),
            0,
          ],
        );
      }
    await db.query(
      "update public.characters set character_silver=100000 where account_id=$1",
      [ids[0]],
    );
    async function proposal(cmd: CosmeticCommand, key = randomUUID()) {
      const world = await load(),
        state = world.states.find((s) => s.account.id === ids[0])!,
        computed = processCosmeticCommand(state, cmd, randomUUID());
      return { world, state, cmd, key, computed };
    }
    async function commit(p: Awaited<ReturnType<typeof proposal>>) {
      return (
        await db.query<{ v: ActionResult }>(
          "select public.commit_cosmetic_action($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb) v",
          [
            ids[0],
            p.state.revision,
            p.world.version,
            p.key,
            JSON.stringify(p.cmd),
            JSON.stringify(p.computed.state.cosmetics),
            JSON.stringify(cosmeticPolicy(p.state, p.cmd)),
            JSON.stringify(p.computed.result),
          ],
        )
      ).rows[0].v;
    }
    await t.test(
      "double click/replay spends silver once, AP stays unchanged; races reject stale world and bind payload",
      async () => {
        const p = await proposal({ type: "BUY_ITEM", code: "OUTFIT_1_1" });
        const [a, b] = await Promise.all([commit(p), commit(p)]);
        assert.deepEqual(a, b);
        const state = await snapshot(ids[0]);
        assert.equal(state.character!.characterSilver, 99980);
        assert.equal(state.account.actionPoints, 10);
        assert.equal(state.cosmetics!.purchasesToday, 1);
        const p1 = await proposal({ type: "BUY_ITEM", code: "HEAD_1_1" }),
          p2 = await proposal({ type: "BUY_ITEM", code: "ACCESSORY_1_1" });
        const results = await Promise.allSettled([commit(p1), commit(p2)]);
        assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
        assert.equal(results.filter((r) => r.status === "rejected").length, 1);
        await assert.rejects(
          commit({ ...p, cmd: { type: "BUY_ITEM", code: "HEAD_1_1" } }),
          /Idempotency/,
        );
        await assert.rejects(
          proposal({ type: "BUY_ITEM", code: "OUTFIT_1_1" }),
          /sở hữu/,
        );
        await assert.rejects(
          proposal({ type: "BUY_ITEM", code: "OUTFIT_2_1" }),
          /tầng phẩm/,
        );
        await db.query(
          "update public.characters set character_silver=1 where account_id=$1",
          [ids[0]],
        );
        await assert.rejects(
          proposal({ type: "BUY_ITEM", code: "OUTFIT_1_2" }),
          /ngân lượng/,
        );
        await db.query(
          "update public.characters set character_silver=100000 where account_id=$1",
          [ids[0]],
        );
      },
    );
    await t.test(
      "equipment, decor and upgrade persist; new bonuses are recorded by the real action RPC",
      async () => {
        for (const cmd of [
          { type: "EQUIP_ITEM", code: "OUTFIT_1_1" },
          { type: "BUY_DECOR", code: "SCREEN_1" },
          { type: "SET_DECOR", code: "SCREEN_1" },
          { type: "UPGRADE_CHAMBER" },
        ] as CosmeticCommand[])
          await commit(await proposal(cmd));
        let state = await snapshot(ids[0]);
        assert.equal(state.cosmetics!.equipment.OUTFIT, "OUTFIT_1_1");
        assert.equal(state.cosmetics!.chamber.level, 2);
        assert.equal(state.cosmetics!.chamber.decor.SCREEN, "SCREEN_1");
        await assert.rejects(
          proposal({ type: "UPGRADE_CHAMBER" }),
          /tầng phẩm/,
        );
        await db.query(
          "update public.characters set hp=50 where account_id=$1",
          [ids[0]],
        );
        const before = await load(),
          after = structuredClone(before),
          idx = after.states.findIndex((s) => s.account.id === ids[0]),
          computed = processAction(after.states[idx], "REST", randomUUID());
        after.states[idx] = computed.state;
        const result = {
          log: computed.log,
          message: actionMessage(computed.log),
        };
        await db.query("select public.commit_event_world($1,$2::jsonb)", [
          before.version,
          JSON.stringify(
            eventProposal(before, after, {
              accountId: ids[0],
              key: randomUUID(),
              code: "REST",
              payload: null,
              result,
            }),
          ),
        ]);
        state = await snapshot(ids[0]);
        assert.equal(state.character!.hp, 72);
        assert.equal(computed.log.modifiers.cosmeticEffects?.restHpPct, 10);
        const saved = await db.query<{
          modifiers: { cosmeticEffects: { restHpPct: number } };
        }>("select modifiers from public.action_logs where id=$1", [
          computed.log.id,
        ]);
        assert.equal(saved.rows[0].modifiers.cosmeticEffects.restHpPct, 10);
        await commit(await proposal({ type: "UNEQUIP_ITEM", slot: "OUTFIT" }));
        assert(!(await data(ids[0])).equipment.OUTFIT);
      },
    );
    await t.test(
      "account real-day cap includes decor; clear life cannot reset usage; UTC+7 next date allows purchases",
      async () => {
        await db.query(
          "insert into public.cosmetic_daily_usage(account_id,usage_date,count) values($1,(now() at time zone 'Asia/Ho_Chi_Minh')::date,10) on conflict(account_id,usage_date) do update set count=excluded.count",
          [ids[0]],
        );
        await assert.rejects(
          proposal({ type: "BUY_ITEM", code: "OUTFIT_1_2" }),
          /hạn mức/,
        );
        const stale = await proposal({
          type: "EQUIP_ITEM",
          code: "OUTFIT_1_1",
        });
        await db.query("select public.clear_character_cosmetics($1)", [
          stale.state.character!.id,
        ]);
        const cleared = await data(ids[0]);
        assert.deepEqual(cleared.ownedItemCodes, []);
        assert.equal(cleared.chamber.level, 1);
        assert.equal(cleared.titles.length, 0);
        assert.equal(cleared.purchasesToday, 10);
        await assert.rejects(commit(stale), /STALE/);
        await db.query("select public.clear_character_cosmetics($1)", [
          stale.state.character!.id,
        ]);
        assert.deepEqual(await data(ids[0]), cleared);
        await db.query(
          "update public.cosmetic_daily_usage set usage_date=usage_date-1 where account_id=$1",
          [ids[0]],
        );
        await commit(await proposal({ type: "BUY_ITEM", code: "OUTFIT_1_2" }));
        assert.equal((await data(ids[0])).purchasesToday, 1);
      },
    );
    await t.test(
      "promotion title writes in same transaction: injected title failure rolls back rank/AP, retry grants once and keeps journal",
      async () => {
        const state = await snapshot(ids[0]),
          cid = state.character!.id;
        await db.query(
          "update public.characters set rank_id='harem_13',int=800,rep=800,fav=800,cha=800,hp=90,suspicion=0,merit=300,rank_entered_at=now()-interval '4 hours',exam_passed_for_rank_id='harem_12',exam_passed_game_day=0 where id=$1",
          [cid],
        );
        await db.query(
          'insert into public.promotion_requirements(character_id,target_rank_id,conditions,generated_at,table_version,thresholds) values($1,\'harem_12\',\'[{"stat":"fav","operator":">=","value":80},{"stat":"rep","operator":">=","value":75},{"stat":"int","operator":">=","value":100}]\',now(),\'v1\',\'{"fav":80,"rep":75,"int":100}\') on conflict do nothing',
          [cid],
        );
        const before = await load(),
          changed = applyForPromotion(before, ids[0], "APPLY", {
            random: () => 0,
            id: randomUUID,
          }),
          key = randomUUID();
        const p = seatProposal({
          before,
          after: changed.world,
          operation: "APPLY",
          request: {
            accountId: ids[0],
            key,
            code: "APPLY",
            result: changed.result,
          },
        });
        const missingTitle = structuredClone(p);
        missingTitle.states.find(
          (s) => s.account.id === ids[0],
        )!.cosmetics!.titles = [];
        await assert.rejects(
          db.query("select public.commit_seat_world($1,$2::jsonb)", [
            before.version,
            JSON.stringify(missingTitle),
          ]),
          /Missing promotion title/,
        );
        await db.exec(
          "create function public.test_title_failure() returns trigger language plpgsql as $$ begin raise exception 'TEST_TITLE_FAILURE';end $$; create trigger test_title_failure before insert on public.character_titles for each row execute function public.test_title_failure();",
        );
        await assert.rejects(
          db.query("select public.commit_seat_world($1,$2::jsonb)", [
            before.version,
            JSON.stringify(p),
          ]),
          /TEST_TITLE_FAILURE/,
        );
        assert.equal((await snapshot(ids[0])).character!.rankId, "harem_13");
        assert.equal(
          (await snapshot(ids[0])).account.actionPoints,
          before.states.find((s) => s.account.id === ids[0])!.account
            .actionPoints,
        );
        await db.exec(
          "drop trigger test_title_failure on public.character_titles;",
        );
        const a = await db.query(
            "select public.commit_seat_world($1,$2::jsonb) v",
            [before.version, JSON.stringify(p)],
          ),
          b = await db.query(
            "select public.commit_seat_world($1,$2::jsonb) v",
            [before.version, JSON.stringify(p)],
          );
        assert.deepEqual(a.rows, b.rows);
        const cosmetics = await data(ids[0]);
        assert.equal(cosmetics.titles.length, 1);
        assert.equal(cosmetics.titles[0].rankId, "harem_12");
        assert.equal(cosmetics.titles[0].titleCode, "MAN");
        const history = await db.query<{
          journal: { titleGrant: { titleCode: string } };
        }>(
          "select journal from public.rank_history where character_id=$1 order by created_at desc limit 1",
          [cid],
        );
        assert.equal(history.rows[0].journal.titleGrant.titleCode, "MAN");
        await db.exec(migration);
        assert.deepEqual(await data(ids[0]), cosmetics);
        await db.query("select public.clear_character_cosmetics($1)", [cid]);
        const cleared = await data(ids[0]);
        assert.equal(cleared.titles.length, 0);
        assert.deepEqual(cleared.equipment, {});
        assert.equal(cleared.chamber.level, 1);
        const revision = (await snapshot(ids[0])).revision;
        await db.query("select public.clear_character_cosmetics($1)", [cid]);
        assert.equal((await snapshot(ids[0])).revision, revision);
        assert.equal((await snapshot(ids[0])).character!.rankId, "harem_12");
      },
    );
    await t.test(
      "Supabase adapter uses real H1 RPCs via SDK transport and replays concurrent purchases exactly",
      async () => {
        const fetcher: typeof fetch = async (input, init) => {
          const request = new Request(input, init),
            url = new URL(request.url),
            name = url.pathname.split("/").at(-1)!;
          try {
            let value: unknown;
            if (url.pathname.includes("/rpc/")) {
              const args = (await request.json()) as Record<string, unknown>;
              const signatures: Record<string, string[]> = {
                event_work_clock: [],
                seat_world_clock: [],
                seat_world_load: [],
                read_seat_board: [],
                runtime_snapshot: ["p_account_id"],
                read_character_cosmetics: ["p_account_id"],
                clear_character_cosmetics: ["p_character_id"],
                commit_cosmetic_action: [
                  "p_account_id",
                  "p_revision",
                  "p_version",
                  "p_key",
                  "p_command",
                  "p_candidate",
                  "p_policy",
                  "p_result",
                ],
              };
              const params = signatures[name];
              if (!params) throw new Error("Unexpected test RPC");
              value = (
                await db.query<{ v: unknown }>(
                  `select public.${name}(${params.map((_, i) => `$${i + 1}`).join(",")}) v`,
                  params.map((key) =>
                    typeof args[key] === "object" && args[key] !== null
                      ? JSON.stringify(args[key])
                      : args[key],
                  ),
                )
              ).rows[0].v;
            } else if (name === "action_requests") {
              const rows = (
                await db.query(
                  "select action_code,payload,result from public.action_requests where account_id=$1 and idempotency_key=$2",
                  [
                    url.searchParams.get("account_id")!.slice(3),
                    url.searchParams.get("idempotency_key")!.slice(3),
                  ],
                )
              ).rows;
              value = request.headers
                .get("accept")
                ?.includes("vnd.pgrst.object")
                ? (rows[0] ?? null)
                : rows;
            } else throw new Error("Unexpected test table");
            return new Response(JSON.stringify(value), {
              headers: { "Content-Type": "application/json" },
            });
          } catch (error) {
            return new Response(
              JSON.stringify({
                code: "P0001",
                message: (error as Error).message,
              }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }
        };
        const repo = new SupabaseGameRepository(
          createClient("https://h1.fixture.test", "fixture-only-key", {
            global: { fetch: fetcher },
            auth: { persistSession: false, autoRefreshToken: false },
          }),
        );
        const before = await repo.readState(ids[0]),
          key = randomUUID(),
          cmd = { type: "BUY_ITEM" as const, code: "OUTFIT_1_1" };
        const [first, retry] = await Promise.all([
          repo.cosmeticAction(ids[0], cmd, before.revision, key),
          repo.cosmeticAction(ids[0], cmd, before.revision, key),
        ]);
        assert.deepEqual(first, retry);
        const after = await repo.readState(ids[0]);
        assert.equal(
          after.character!.characterSilver,
          before.character!.characterSilver - 20,
        );
        assert.equal(after.account.actionPoints, before.account.actionPoints);
        assert(after.cosmetics!.ownedItemCodes.includes(cmd.code));
        assert.equal(after.readWarnings!.length, 0);
        await repo.clearCharacterCosmetics(after.character!.id);
        assert.deepEqual(
          (await repo.readState(ids[0])).cosmetics!.ownedItemCodes,
          [],
        );
        assert.deepEqual(
          await repo.cosmeticAction(ids[0], cmd, before.revision, key),
          first,
        );
        assert.deepEqual(
          (await repo.readState(ids[0])).cosmetics!.ownedItemCodes,
          [],
        );
      },
    );
    await t.test(
      "RLS/raw privacy, service-only RPCs, branch guard and WHERE/static RLS coverage",
      async () => {
        assert.equal(await data(ids[1]), null);
        for (const table of [
          "character_items",
          "character_equipment",
          "character_chamber",
          "character_titles",
          "cosmetic_daily_usage",
        ]) {
          assert.equal(
            (
              await db.query<{ enabled: boolean }>(
                "select relrowsecurity enabled from pg_class where oid=$1::regclass",
                [`public.${table}`],
              )
            ).rows[0].enabled,
            true,
          );
          assert.equal(
            (
              await db.query<{ allowed: boolean }>(
                "select has_table_privilege('authenticated',$1,'select') allowed",
                [`public.${table}`],
              )
            ).rows[0].allowed,
            false,
          );
        }
        for (const name of [
          "read_character_cosmetics",
          "commit_cosmetic_action",
          "clear_character_cosmetics",
        ]) {
          const rows = await db.query<{ allowed: boolean }>(
            "select has_function_privilege('authenticated',p.oid,'execute') allowed from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=$1",
            [name],
          );
          assert(rows.rows.every((r) => !r.allowed));
        }
        const world = await load(),
          civil = world.states.find((s) => s.account.id === ids[1])!;
        await assert.rejects(
          db.query(
            "select public.commit_cosmetic_action($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb)",
            [
              ids[1],
              civil.revision,
              world.version,
              randomUUID(),
              '{"type":"UPGRADE_CHAMBER"}',
              "{}",
              '{"price":0,"minTier":1,"date":"' +
                new Date(world.serverNow + 7 * 3600000)
                  .toISOString()
                  .slice(0, 10) +
                '"}',
              "{}",
            ],
          ),
          /Harem action locked/,
        );
      },
    );
  } finally {
    await db.close();
  }
});
