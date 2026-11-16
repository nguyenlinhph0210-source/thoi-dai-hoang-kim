import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import {
  transitionSetup,
  type SetupCommand,
} from "../src/lib/characterGenerator";
import {
  processAction,
  actionCommitPolicy,
  actionMessage,
} from "../src/lib/actionProcessor";
import { getWorldTime } from "../src/lib/worldClock";
import { utc7Date } from "../src/lib/ap";
import { RANKS } from "../src/lib/gameConfig";
import { ACTIONS, type ActionCode } from "../src/config/actions";
import type { RuntimeState, ActionResult } from "../src/types/runtime";
test("0004/PGlite: immutable v1, legacy preservation, authoritative merit, exam transactions and privacy", async (t) => {
  const db = new PGlite();
  try {
    await db.exec(
      "create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;",
    );
    async function migration(name: string) {
      try {
        await db.exec(
          await readFile(
            new URL(`../supabase/${name}`, import.meta.url),
            "utf8",
          ),
        );
      } catch (e) {
        throw new Error(`${name}: ${(e as Error).message}`);
      }
    }
    for (const file of [
      "schema.sql",
      "migrations/0002_character_ill_status.sql",
      "migrations/0003_runtime_foundation.sql",
    ])
      await migration(file);
    const old = randomUUID(),
      id = randomUUID(),
      other = randomUUID();
    await db.query("insert into auth.users(id) values($1),($2),($3)", [
      old,
      id,
      other,
    ]);
    async function snapshot(who: string = id) {
      return (
        await db.query<{ state: RuntimeState }>(
          "select public.runtime_snapshot($1) as state",
          [who],
        )
      ).rows[0].state;
    }
    function day(s: RuntimeState) {
      return Math.floor(
        Math.max(0, s.serverNow - Date.parse(s.season.seasonStartTimestamp)) /
          300000,
      );
    }
    async function setup(
      command: SetupCommand,
      who: string = id,
      override?: unknown,
    ) {
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
          JSON.stringify(override ?? next.character?.promotionRequirements),
          day(s),
        ],
      );
    }
    await setup({ type: "BEGIN", branch: "CIVIL" }, old);
    const legacy = (await snapshot(old)).character!;
    const oldReq = {
      characterId: legacy.id,
      targetRankId: "civil_7b",
      conditions: [
        { stat: "int", operator: ">=", value: 85 },
        { stat: "rep", operator: ">=", value: 55 },
        { stat: "hp", operator: ">=", value: 100 },
      ],
    };
    await setup({ type: "CONFIRM" }, old, oldReq);
    const legacyBefore = (await snapshot(old)).character!.promotionRequirements!
      .conditions;
    await migration("migrations/0004_promotion_requirements.sql");
    await migration("migrations/0004_promotion_requirements.sql");
    await t.test(
      "all official DB rows equal config, legacy R unchanged, migration rerunnable without reset",
      async () => {
        const rows = await db.query<{
          id: string;
          name: string;
          branch: string;
          tier: number;
          benchmarks: unknown;
          next_rank_id: string | null;
        }>(
          "select id,name,branch,tier,benchmarks,next_rank_id from public.ranks",
        );
        assert.equal(rows.rows.length, 52);
        for (const r of rows.rows) {
          const expected = RANKS[r.id];
          assert.equal(r.name, expected.name);
          assert.equal(r.branch, expected.branch);
          assert.equal(r.tier, expected.tier);
          assert.deepEqual(r.benchmarks, expected.benchmarks);
          assert.equal(r.next_rank_id, expected.nextRankId);
        }
        assert.deepEqual(
          (await snapshot(old)).character!.promotionRequirements!.conditions,
          legacyBefore,
        );
        assert.equal(
          (await snapshot(old)).character!.promotionRequirements!.tableVersion,
          "legacy",
        );
      },
    );
    await setup({ type: "BEGIN", branch: "CIVIL" });
    await t.test(
      "v1 confirmation rejects HP/baseline candidates and persists explicit R/version once",
      async () => {
        const c = (await snapshot()).character!;
        const bad = {
          characterId: c.id,
          targetRankId: "civil_7b",
          tableVersion: "v1",
          conditions: [
            { stat: "int", operator: ">=", value: 90 },
            { stat: "rep", operator: ">=", value: 60 },
            { stat: "hp", operator: ">=", value: 100 },
          ],
        };
        await assert.rejects(
          () => setup({ type: "CONFIRM" }, id, bad),
          /Invalid v1/,
        );
        await setup({ type: "CONFIRM" });
        const after = (await snapshot()).character!;
        assert(after.rankEnteredAt);
        assert.equal(after.merit, 0);
        assert.equal(after.promotionRequirements!.tableVersion, "v1");
        const persisted = await db.query<{
          thresholds: Record<string, number>;
        }>(
          "select thresholds from public.promotion_requirements where character_id=$1",
          [after.id],
        );
        assert.deepEqual(
          persisted.rows[0].thresholds,
          Object.fromEntries(
            after.promotionRequirements!.conditions.map((c) => [
              c.stat,
              c.value,
            ]),
          ),
        );
        await assert.rejects(
          () =>
            db
              .query(
                "update public.promotion_requirements set conditions=conditions||$1::jsonb where character_id=$2",
                ["[]", after.id],
              )
              .then(() =>
                db.query(
                  "update public.promotion_requirements set table_version='changed' where character_id=$1",
                  [after.id],
                ),
              ),
          /immutable/,
        );
      },
    );
    async function prepare(code: ActionCode, draw = 0) {
      const s = await snapshot();
      const a = ACTIONS[code];
      const p = processAction(s, code, randomUUID(), () => draw);
      return {
        state: s,
        proposal: {
          character: p.state.character,
          result: { log: p.log, message: actionMessage(p.log) },
          policy: actionCommitPolicy(s, code),
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
      p: Awaited<ReturnType<typeof prepare>>,
      key = randomUUID(),
    ) {
      return (
        await db.query<{ result: ActionResult }>(
          "select public.commit_game_action($1,$2,$3,$4,$5::jsonb) as result",
          [id, p.state.revision, key, code, JSON.stringify(p.proposal)],
        )
      ).rows[0].result;
    }
    await t.test(
      "SQL merit cap 8 allows partial/zero credit without blocking the action; duplicate adds nothing",
      async () => {
        for (let i = 0; i < 3; i++)
          await commit("AUDIENCE", await prepare("AUDIENCE"));
        await commit("STUDY", await prepare("STUDY"));
        const key = randomUUID(),
          p = await prepare("WORK");
        const a = await commit("WORK", p, key);
        assert.equal(a.log.meritGained, 1);
        assert.equal(a.log.meritAfter, 8);
        assert.deepEqual(await commit("WORK", p, key), a);
        const b = await commit("WORK", await prepare("WORK"));
        assert.equal(b.log.meritGained, 0);
        assert(b.log.after.characterSilver > b.log.before.characterSilver);
        const row = await db.query<{ points: number }>(
          "select points from public.merit_daily_usage where account_id=$1",
          [id],
        );
        assert.equal(row.rows[0].points, 8);
      },
    );
    const locked = (await snapshot()).character!.promotionRequirements;
    await t.test(
      "SQL independently rejects exam before tenure/merit even for a forged server proposal",
      async () => {
        const s = await snapshot();
        const fake = structuredClone(s);
        fake.character = {
          ...fake.character!,
          int: 300,
          rep: 300,
          fav: 300,
          cha: 300,
          merit: 50,
          rankEnteredAt: new Date(s.serverNow - 31 * 300000).toISOString(),
        };
        const proc = processAction(fake, "EXAM", randomUUID(), () => 0);
        proc.log.meritAfter = s.character!.merit;
        proc.state.character!.merit = s.character!.merit;
        const proposal = {
          ...(await prepare("REST")).proposal,
          character: proc.state.character,
          result: { log: proc.log, message: "test" },
          policy: actionCommitPolicy(fake, "EXAM"),
          apCost: 2,
          silverCost: 0,
          hpCost: 3,
          dailyCap: 2,
        };
        await assert.rejects(
          () =>
            db.query(
              "select public.commit_game_action($1,$2,$3,$4,$5::jsonb)",
              [id, s.revision, randomUUID(), "EXAM", JSON.stringify(proposal)],
            ),
          /Promotion/,
        );
        assert.equal(
          (await snapshot()).account.actionPoints,
          s.account.actionPoints,
        );
      },
    );
    await db.query("update public.accounts set ap=15 where id=$1", [id]);
    await db.query(
      "update public.characters set int=300,rep=300,fav=300,cha=300,hp=100,merit=20,rank_entered_at=now()-interval '9001 seconds' where account_id=$1",
      [id],
    );
    await t.test(
      "EXAM success/failure/duplicate/daily cap and stale revision are atomic and never regenerate R",
      async () => {
        const a = await prepare("EXAM", 0),
          b = await prepare("EXAM", 0.999999),
          key = randomUUID();
        const passed = await commit("EXAM", a, key);
        assert.equal(passed.log.exam?.success, true);
        assert.equal(passed.log.after.hp, 97);
        assert.equal(passed.log.apSpent, 2);
        assert.equal(passed.log.meritGained, 0);
        await assert.rejects(() => commit("EXAM", b), /STALE_REVISION/);
        const failed = await commit("EXAM", await prepare("EXAM", 0.999999));
        assert.equal(failed.log.exam?.success, false);
        assert.deepEqual(await commit("EXAM", a, key), passed);
        const after = await snapshot();
        assert.equal(after.account.actionPoints, 11);
        assert.equal(after.character!.examPassedForRankId, "civil_7b");
        assert.equal(after.character!.examPassedGameDay, day(a.state));
        assert.deepEqual(after.character!.promotionRequirements, locked);
        const capAttempt = { ...a, state: after };
        await assert.rejects(() => commit("EXAM", capAttempt), /Daily cap/);
        assert.equal((await snapshot()).account.actionPoints, 11);
      },
    );
    await t.test(
      "rerunning 0004 after exam preserves every locked R, merit, validity and AP",
      async () => {
        const before = await snapshot();
        await migration("migrations/0004_promotion_requirements.sql");
        const after = await snapshot();
        assert.deepEqual(after.character, before.character);
        assert.deepEqual(after.account, before.account);
      },
    );
    await t.test(
      "RLS and sensitive functions: another user cannot read usage or invoke writes/hidden JSON",
      async () => {
        await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
          other,
        ]);
        await db.exec("set role authenticated");
        try {
          assert.equal(
            (await db.query("select * from public.merit_daily_usage")).rows
              .length,
            0,
          );
          await assert.rejects(
            () => db.query("update public.characters set merit=999"),
            /permission denied/,
          );
          await assert.rejects(
            () => db.query("select public.runtime_snapshot($1)", [id]),
            /permission denied/,
          );
          await assert.rejects(
            () =>
              db.query(
                "select public.commit_game_action($1,0,$2,$3,$4::jsonb)",
                [id, randomUUID(), "EXAM", "{}"],
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
