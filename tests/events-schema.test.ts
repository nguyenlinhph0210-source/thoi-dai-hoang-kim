import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { EVENT_CATALOG } from "../src/config/events";
import { transitionSetup } from "../src/lib/characterGenerator";
import { processAction, actionMessage } from "../src/lib/actionProcessor";
import {
  afterValidAction,
  expireDueEvents,
  resolveEvent,
} from "../src/lib/eventEngine";
import { eventProposal } from "../src/lib/eventPersistence";
import type {
  EventWorld,
  CharacterEvent,
  ResolveEventInput,
} from "../src/types/events";
import type { ActionResult, RuntimeState } from "../src/types/runtime";
import type { ActionCode } from "../src/config/actions";

test("0007/PGlite: persisted weekly RNG, event transactions, rewards, expiry, inquiry, real conversion RPC and RLS", async (t) => {
  const db = new PGlite();
  try {
    await db.exec(
      "create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;",
    );
    const migration = await readFile(
      new URL(
        "../supabase/migrations/0007_personal_events.sql",
        import.meta.url,
      ),
      "utf8",
    );
    for (const name of [
      "schema.sql",
      "migrations/0002_character_ill_status.sql",
      "migrations/0003_runtime_foundation.sql",
      "migrations/0004_promotion_requirements.sql",
      "migrations/0005_seats_and_promotion.sql",
      "migrations/0006_fix_safeupdate.sql",
    ])
      await db.exec(
        await readFile(new URL(`../supabase/${name}`, import.meta.url), "utf8"),
      );
    await db.exec(migration);
    await db.exec(migration);
    const ids = [randomUUID(), randomUUID(), randomUUID()];
    await db.query("insert into auth.users(id) values($1),($2),($3)", ids);
    const snapshot = async (id: string) =>
      (
        await db.query<{ v: RuntimeState }>(
          "select public.runtime_snapshot($1) v",
          [id],
        )
      ).rows[0].v;
    const load = async () =>
      (await db.query<{ v: EventWorld }>("select public.seat_world_load() v"))
        .rows[0].v;
    const commit = async (
      before: EventWorld,
      after: EventWorld,
      request?: Parameters<typeof eventProposal>[2],
    ) =>
      (
        await db.query<{ v: ActionResult }>(
          "select public.commit_event_world($1,$2::jsonb) v",
          [
            before.version,
            JSON.stringify(eventProposal(before, after, request)),
          ],
        )
      ).rows[0].v;
    for (const [i, id] of ids.entries())
      for (const command of [
        {
          type: "BEGIN" as const,
          branch: i === 2 ? ("INNER_COURT" as const) : ("CIVIL" as const),
        },
        { type: "CONFIRM" as const },
      ]) {
        const state = await snapshot(id),
          next = transitionSetup(state, command, {
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
            command.type,
            JSON.stringify(next.character),
            JSON.stringify(next.character?.promotionRequirements),
            0,
          ],
        );
      }
    async function actProposal(
      id: string,
      code: ActionCode = "STUDY",
      random = () => 0,
      key = randomUUID(),
    ) {
      const before = await load(),
        after = structuredClone(before),
        index = after.states.findIndex((s) => s.account.id === id),
        computed = processAction(
          after.states[index],
          code,
          randomUUID(),
          random,
        );
      after.states[index] = computed.state;
      const result = {
        log: computed.log,
        message: actionMessage(computed.log),
      };
      afterValidAction(after, id, computed.log, { random });
      return {
        before,
        after,
        request: { accountId: id, key, code, payload: null, result },
      };
    }
    async function seed(id: string, code: string, stage = 0, expired = false) {
      const state = await snapshot(id),
        definition = structuredClone(
          EVENT_CATALOG.find((e) => e.code === code)!,
        );
      const now = state.serverNow;
      const event: CharacterEvent = {
        id: randomUUID(),
        accountId: id,
        characterId: state.character!.id,
        seasonId: state.season.id,
        definition,
        stage,
        status: "PENDING",
        createdAt: new Date(
          expired ? now - definition.expiresHours * 3600000 - 10000 : now,
        ).toISOString(),
        expiresAt: new Date(
          expired ? now - 10000 : now + definition.expiresHours * 3600000,
        ).toISOString(),
        resolvedAt: null,
        history: [],
      };
      await db.query(
        "insert into public.character_events(id,account_id,character_id,season_id,status,stage,expires_at,record) values($1,$2,$3,$4,$5,$6,$7,$8::jsonb)",
        [
          event.id,
          id,
          event.characterId,
          event.seasonId,
          event.status,
          stage,
          event.expiresAt,
          JSON.stringify(event),
        ],
      );
      return event;
    }
    async function resolution(
      id: string,
      event: CharacterEvent,
      choiceCode: string,
      random = () => 0,
      key = randomUUID(),
    ) {
      const before = await load(),
        payload = { eventId: event.id, choiceCode },
        computed = resolveEvent(before, id, payload, key, { random });
      const request = {
        accountId: id,
        key,
        code: "RESOLVE_EVENT" as const,
        payload,
        result: computed.result,
      };
      return { before, after: computed.world, request };
    }
    await t.test(
      "same first action/UUID and two concurrent requests persist one mark/check/event and one AP debit",
      async () => {
        const p = await actProposal(ids[0]);
        const [a, b] = await Promise.all([
          commit(p.before, p.after, p.request),
          commit(p.before, p.after, p.request),
        ]);
        assert.deepEqual(a, b);
        let world = await load();
        assert.equal(
          world.eventData.checks.filter((c) => c.accountId === ids[0]).length,
          1,
        );
        assert.equal(
          world.eventData.instances.filter((e) => e.accountId === ids[0])
            .length,
          1,
        );
        assert.equal((await snapshot(ids[0])).account.actionPoints, 9);
        const p2 = await actProposal(ids[0]),
          p3 = await actProposal(ids[0]);
        const raced = await Promise.allSettled([
          commit(p2.before, p2.after, p2.request),
          commit(p3.before, p3.after, p3.request),
        ]);
        assert.equal(raced.filter((r) => r.status === "fulfilled").length, 1);
        assert.match(
          String(
            (
              raced.find(
                (r) => r.status === "rejected",
              ) as PromiseRejectedResult
            ).reason,
          ),
          /STALE_REVISION/,
        );
        world = await load();
        assert.equal(
          world.eventData.checks.filter((c) => c.accountId === ids[0]).length,
          1,
        );
        assert.equal(
          world.eventData.instances.filter((e) => e.accountId === ids[0])
            .length,
          1,
        );
        assert.equal((await snapshot(ids[0])).account.actionPoints, 8);
      },
    );
    await t.test(
      "RESOLVE_EVENT costs and stage/key binding are atomic; replay returns saved result after later changes",
      async () => {
        const event = (await load()).eventData.instances.find(
          (e) => e.accountId === ids[0],
        )!;
        const p = await resolution(ids[0], event, "HELP");
        const before = (await snapshot(ids[0])).account.actionPoints;
        const [a, b] = await Promise.all([
          commit(p.before, p.after, p.request),
          commit(p.before, p.after, p.request),
        ]);
        assert.deepEqual(a, b);
        assert.equal((await snapshot(ids[0])).account.actionPoints, before - 1);
        assert.equal((await snapshot(ids[0])).events!.length, 0);
        const forged = {
          ...p.request,
          payload: { eventId: event.id, choiceCode: "PASS" },
        };
        await assert.rejects(
          () => commit(p.before, p.after, forged),
          /Idempotency key reused/,
        );
        assert.deepEqual(await commit(p.before, p.after, p.request), a);
      },
    );
    await t.test(
      "calamity pays only final stage, once per account/code/season with ledger; repeat final event cannot pay twice",
      async () => {
        const event = await seed(ids[0], "FIRE_IN_STORE");
        let p = await resolution(ids[0], event, "FACE");
        await commit(p.before, p.after, p.request);
        assert.equal((await snapshot(ids[0])).account.destinyPoints, 0);
        p = await resolution(ids[0], event, "ENDURE");
        const result = await commit(p.before, p.after, p.request);
        assert.equal(result.log.event!.destinyAwarded, 1);
        assert.equal((await snapshot(ids[0])).account.destinyPoints, 1);
        assert.deepEqual(await commit(p.before, p.after, p.request), result);
        const repeated = await seed(ids[0], "FIRE_IN_STORE", 1);
        p = await resolution(ids[0], repeated, "ENDURE");
        const again = await commit(p.before, p.after, p.request);
        assert.equal(again.log.event!.destinyAwarded, 0);
        assert.equal((await snapshot(ids[0])).account.destinyPoints, 1);
        assert.equal(
          (
            await db.query<{ n: number }>(
              "select count(*)::int n from public.destiny_ledger where account_id=$1",
              [ids[0]],
            )
          ).rows[0].n,
          1,
        );
        await db.exec(migration);
        assert.equal((await snapshot(ids[0])).account.destinyPoints, 1);
      },
    );
    await t.test(
      "expired calamity default is idempotent, has no AP cost, causes illness/half silver and never death",
      async () => {
        await db.query(
          "update public.characters set character_silver=101 where account_id=$1",
          [ids[1]],
        );
        const e = await seed(ids[1], "NIGHT_OF_SICKNESS", 0, true),
          before = await load(),
          after = expireDueEvents(before);
        await commit(before, after);
        const state = await snapshot(ids[1]);
        assert.equal(state.character!.characterSilver, 50);
        assert.equal(state.character!.status, "SEVERELY_ILL");
        assert.equal(state.character!.treatmentsRemaining, 5);
        assert.equal(state.account.actionPoints, 10);
        const next = await load();
        assert.deepEqual(expireDueEvents(next), next);
        assert.equal(
          next.eventData.instances.find((i) => i.id === e.id)!.status,
          "EXPIRED",
        );
        assert.equal(
          (
            await db.query<{ n: number }>(
              "select count(*)::int n from public.action_logs where result->'log'->'event'->>'eventId'=$1",
              [e.id],
            )
          ).rows[0].n,
          1,
        );
      },
    );
    await t.test(
      "inquiry persists across RUMOR, blocks APPLY even below 80, settlement raises floor and logs no hidden DTO",
      async () => {
        await db.query(
          "update public.characters set status='ACTIVE',hp=100,treatments_remaining=0,suspicion=80 where account_id=$1",
          [ids[1]],
        );
        let p = await actProposal(ids[1], "STUDY", () => 0.99);
        await commit(p.before, p.after, p.request);
        let state = await snapshot(ids[1]);
        assert(state.character!.investigationPending);
        const inquiry = state.events!.find((e) =>
          e.definition.tags.includes("INVESTIGATION"),
        )!;
        assert(inquiry);
        p = await actProposal(ids[1], "RUMOR", () => 0.99);
        await commit(p.before, p.after, p.request);
        state = await snapshot(ids[1]);
        assert(state.character!.suspicion < 80);
        assert(state.character!.investigationPending);
        await assert.rejects(
          () =>
            db.query(
              "select public.check_event_application(c, $2::jsonb, 0) from public.characters c where account_id=$1",
              [
                ids[1],
                JSON.stringify({
                  examValidDays: 60,
                  tenureDays: 0,
                  meritRequired: 0,
                }),
              ],
            ),
          /Application is locked/,
        );
        const choice = await resolution(ids[1], inquiry, "SETTLE", () => 0.99);
        await commit(choice.before, choice.after, choice.request);
        state = await snapshot(ids[1]);
        assert(state.character!.suspicionFloor >= 5);
        assert(!state.character!.investigationPending);
      },
    );
    await t.test(
      "Harem event calls the actual service-only conversion RPC, retaining stats/merit and locked requirements",
      async () => {
        await db.query(
          "update public.characters set rank_id='inner_5',int=200,cha=200,fav=100,suspicion=20,merit=123 where account_id=$1",
          [ids[2]],
        );
        const e = await seed(ids[2], "HAREM_INVITATION"),
          p = await resolution(ids[2], e, "ACCEPT");
        const original = (
          await db.query<{ def: string }>(
            "select pg_get_functiondef('public.convert_inner_court_to_harem(uuid,bigint,jsonb)'::regprocedure) def",
          )
        ).rows[0].def;
        await db.exec(
          "create or replace function public.convert_inner_court_to_harem(p_character_id uuid,p_version bigint,p_proposal jsonb) returns jsonb language plpgsql security definer set search_path='' as $$ begin raise exception 'CONVERSION_RPC_CALLED';end $$;",
        );
        await assert.rejects(
          () => commit(p.before, p.after, p.request),
          /CONVERSION_RPC_CALLED/,
        );
        assert.equal((await snapshot(ids[2])).character!.rankId, "inner_5");
        await db.exec(original);
        await commit(p.before, p.after, p.request);
        const state = await snapshot(ids[2]);
        assert.equal(state.character!.rankId, "harem_13");
        assert.equal(state.character!.fav, 60);
        assert.equal(state.character!.merit, 123);
        assert.equal(state.character!.int, 200);
        assert.equal(
          state.character!.promotionRequirements!.targetRankId,
          "harem_12",
        );
        assert(
          !state.events!.some((e) => e.definition.code === "HAREM_INVITATION"),
        );
      },
    );
    await t.test(
      "paid setup rerolls write a negative destiny ledger entry in the same transaction and replay adds nothing",
      async () => {
        const id = randomUUID();
        await db.query("insert into auth.users(id) values($1)", [id]);
        let state = await snapshot(id);
        const begin = transitionSetup(
          state,
          { type: "BEGIN", branch: "CIVIL" },
          {
            id: randomUUID(),
            accountId: id,
            seasonId: state.season.id,
            now: new Date(state.serverNow).toISOString(),
            gameYear: 1,
            random: () => 0,
          },
        );
        await db.query(
          "select public.commit_runtime_setup($1,$2,$3,$4,$5::jsonb,null,0)",
          [
            id,
            state.revision,
            randomUUID(),
            "BEGIN",
            JSON.stringify(begin.character),
          ],
        );
        await db.query(
          "update public.accounts set destiny_points=1,free_rerolls_left=0,has_created_character=true where id=$1",
          [id],
        );
        state = await snapshot(id);
        const next = transitionSetup(
            state,
            { type: "REROLL" },
            {
              id: randomUUID(),
              accountId: id,
              seasonId: state.season.id,
              now: new Date(state.serverNow).toISOString(),
              gameYear: 1,
              random: () => 0,
            },
          ),
          key = randomUUID();
        const args = [
          id,
          state.revision,
          key,
          "REROLL",
          JSON.stringify(next.character),
        ];
        await db.query(
          "select public.commit_runtime_setup($1,$2,$3,$4,$5::jsonb,null,0)",
          args,
        );
        await db.query(
          "select public.commit_runtime_setup($1,$2,$3,$4,$5::jsonb,null,0)",
          args,
        );
        assert.equal((await snapshot(id)).account.destinyPoints, 0);
        const ledger = (
          await db.query<{ delta: number; reason: string }>(
            "select delta,reason from public.destiny_ledger where account_id=$1",
            [id],
          )
        ).rows;
        assert.deepEqual(ledger, [{ delta: -1, reason: "REROLL" }]);
      },
    );
    await t.test(
      "new tables have RLS and no client raw reads; functions are service-only; event definitions are immutable",
      async () => {
        const tables = (
          await db.query<{
            relname: string;
            relrowsecurity: boolean;
            allowed: boolean;
          }>(
            "select c.relname,c.relrowsecurity,has_table_privilege('authenticated',c.oid,'select') allowed from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('character_events','destiny_ledger')",
          )
        ).rows;
        assert.equal(tables.length, 2);
        assert(tables.every((r) => r.relrowsecurity && !r.allowed));
        const functions = (
          await db.query<{
            anon: boolean;
            authenticated: boolean;
            service: boolean;
          }>(
            "select has_function_privilege('anon',p.oid,'execute') anon,has_function_privilege('authenticated',p.oid,'execute') authenticated,has_function_privilege('service_role',p.oid,'execute') service from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('commit_event_world','event_work_clock','seat_world_load','runtime_snapshot')",
          )
        ).rows;
        assert.equal(functions.length, 4);
        assert(
          functions.every((r) => !r.anon && !r.authenticated && r.service),
        );
        await assert.rejects(
          () =>
            db.query(
              "update public.character_events set record=jsonb_set(record,'{definition,title}','\"changed\"'::jsonb) where account_id=$1",
              [ids[0]],
            ),
          /immutable/,
        );
      },
    );
  } finally {
    await db.close();
  }
});
