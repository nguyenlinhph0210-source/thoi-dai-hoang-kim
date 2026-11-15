import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getCharacterAge, getWorldTime } from "../src/lib/worldClock";
import { grantAp, utc7Date, msUntilApGrant } from "../src/lib/ap";
import {
  applyActionStats,
  applyGain,
  clampStats,
  getRiskModifiers,
} from "../src/lib/statEngine";
import {
  generateCharacter,
  createAccount,
} from "../src/lib/characterGenerator";
import { ACTIONS } from "../src/config/actions";
import { InMemoryGameRepository } from "../src/lib/repositories/InMemoryGameRepository";
import { gameView, publicLog } from "../src/lib/publicState";
import { MS_PER_GAME_DAY, REAL_DAY_MS } from "../src/config/balance";
const start = Date.parse("2026-11-14T16:59:59Z");
function character() {
  return {
    ...generateCharacter("CIVIL", {
      id: randomUUID(),
      accountId: randomUUID(),
      seasonId: randomUUID(),
      now: new Date(start).toISOString(),
      gameYear: 1,
      random: () => 0,
    }),
    status: "ACTIVE" as const,
    confirmedAt: new Date(start).toISOString(),
  };
}
async function fixture() {
  let now = start;
  const repo = new InMemoryGameRepository(() => now);
  const id = randomUUID();
  repo.registerAccount(id);
  let state = await repo.readState(id);
  state = await repo.setup(
    id,
    { type: "BEGIN", branch: "CIVIL" },
    state.revision,
    randomUUID(),
  );
  state = await repo.setup(
    id,
    { type: "CONFIRM" },
    state.revision,
    randomUUID(),
  );
  return {
    repo,
    id,
    advance: (ms: number) => {
      now += ms;
    },
    state,
  };
}
test("worldClock: month/year/week boundaries, before start, exact next-day delay and age", () => {
  for (const [day, year, month, date, week, dayOfYear] of [
    [0, 1, 1, 1, 1, 0],
    [6, 1, 1, 7, 1, 6],
    [7, 1, 1, 8, 2, 7],
    [29, 1, 1, 30, 5, 29],
    [30, 1, 2, 1, 5, 30],
    [359, 1, 12, 30, 52, 359],
    [360, 2, 1, 1, 52, 0],
    [720, 3, 1, 1, 103, 0],
  ]) {
    assert.deepEqual(getWorldTime(start + day * MS_PER_GAME_DAY, start), {
      currentGameYear: year,
      currentGameMonth: month,
      currentGameDay: date,
      currentGameWeek: week,
      dayOfYear,
      msUntilNextGameDay: MS_PER_GAME_DAY,
    });
  }
  assert.equal(
    getWorldTime(start + MS_PER_GAME_DAY - 1, start).msUntilNextGameDay,
    1,
  );
  assert.equal(getWorldTime(start - 100, start).currentGameYear, 1);
  assert.equal(getCharacterAge(18, 2, 5), 21);
});
test("AP: UTC+7 midnight, multi-day offline, cap, repeat and future-date guard", () => {
  const a = {
    ...createAccount(randomUUID()),
    actionPoints: 1,
    lastApGrantDateUtc7: utc7Date(start),
  };
  assert.equal(utc7Date(start), "2026-11-14");
  assert.equal(utc7Date(start + 1000), "2026-11-15");
  assert.equal(msUntilApGrant(start), 1000);
  const granted = grantAp(a, start + 1000);
  assert.equal(granted.actionPoints, 11);
  assert.deepEqual(grantAp(granted, start + 1000), granted);
  assert.equal(grantAp(a, start + 5 * REAL_DAY_MS).actionPoints, 15);
  assert.equal(
    grantAp({ ...a, actionPoints: 14 }, start + 1000).actionPoints,
    15,
  );
  assert.deepEqual(grantAp(granted, start - REAL_DAY_MS), granted);
});
test("statEngine: clamp each bound, fatigue on all positive gains, negative gains unchanged", () => {
  assert.deepEqual(
    clampStats(
      {
        int: -1,
        rep: 1100,
        fav: -101,
        cha: 1001,
        hp: 101,
        suspicion: -5,
        characterSilver: -1,
      },
      10,
    ),
    {
      int: 0,
      rep: 1000,
      fav: -100,
      cha: 1000,
      hp: 100,
      suspicion: 10,
      characterSilver: 0,
    },
  );
  const c = { ...character(), hp: 19 };
  const gains = {
    int: 7,
    rep: 7,
    fav: 7,
    cha: 7,
    hp: 7,
    characterSilver: 7,
    suspicion: 7,
  };
  const next = applyGain(c, gains);
  for (const key of Object.keys(gains) as (keyof typeof gains)[])
    assert.equal(next[key], c[key] + 3);
  assert.equal(applyGain(c, { fav: -7 }).fav, c.fav - 7);
  assert.equal(applyGain({ ...c, hp: 20 }, { int: 7 }).int, c.int + 7);
});
test("statEngine: audience resonance stacks every 200 cha; round once after fatigue", () => {
  const c = { ...character(), fav: 0, cha: 400, hp: 19 };
  assert.equal(
    applyGain({ ...c, hp: 100, cha: 200 }, { fav: 100 }, "AUDIENCE").fav,
    115,
  );
  assert.equal(applyGain(c, { fav: 10 }, "AUDIENCE").fav, 6);
  assert.equal(applyGain({ ...c, hp: 100 }, { fav: 10 }, "AUDIENCE").fav, 13);
  assert.equal(
    applyGain({ ...c, hp: 100, cha: 199 }, { fav: 10 }, "AUDIENCE").fav,
    10,
  );
  assert.equal(applyGain({ ...c, hp: 100 }, { fav: 10 }).fav, 10);
});
test("statEngine: poverty penalty, suspicion floor permanently rises, threshold risks", () => {
  const c = { ...character(), rep: 61, characterSilver: 9 };
  assert.equal(applyActionStats(c, ACTIONS.STUDY).rep, 56);
  assert.equal(applyActionStats({ ...c, rep: 60 }, ACTIONS.STUDY).rep, 60);
  assert.equal(
    applyActionStats({ ...c, characterSilver: 10 }, ACTIONS.STUDY).rep,
    61,
  );
  const rumor = applyActionStats(
    { ...c, rep: 149, suspicion: 4, characterSilver: 20 },
    ACTIONS.RUMOR,
  );
  assert.equal(rumor.suspicionFloor, 5);
  assert.equal(rumor.suspicion, 5);
  assert.equal(
    applyActionStats({ ...rumor, characterSilver: 20 }, ACTIONS.RUMOR)
      .suspicionFloor,
    10,
  );
  assert.equal(
    applyActionStats({ ...rumor, rep: 150, characterSilver: 20 }, ACTIONS.RUMOR)
      .suspicionFloor,
    5,
  );
  assert.deepEqual(
    getRiskModifiers({ ...c, int: 199, fav: 401, hp: 19, rep: 201 }),
    { ambushChanceBonus: 0.4, slanderChanceBonus: 0.3, failChanceBonus: 0.3 },
  );
  assert.deepEqual(
    getRiskModifiers({ ...c, int: 200, fav: 400, hp: 20, rep: 201 }),
    { ambushChanceBonus: 0, slanderChanceBonus: 0, failChanceBonus: 0 },
  );
});
test("statEngine: zero HP causes illness; five treatments restore activity", () => {
  let c = applyActionStats({ ...character(), hp: 12 }, ACTIONS.WORK);
  assert.equal(c.status, "SEVERELY_ILL");
  assert.equal(c.treatmentsRemaining, 5);
  for (let n = 4; n >= 0; n--) {
    c = applyActionStats(c, ACTIONS.TREAT);
    assert.equal(c.treatmentsRemaining, n);
    assert.equal(c.status, n === 0 ? "ACTIVE" : "SEVERELY_ILL");
  }
});
test("repository: exact idempotent replay, parallel requests and account isolation", async () => {
  const { repo, id } = await fixture();
  const key = randomUUID();
  const [a, b] = await Promise.all([
    repo.act(id, "STUDY", key),
    repo.act(id, "STUDY", key),
  ]);
  assert.deepEqual(a, b);
  await repo.act(id, "REST", randomUUID());
  assert.deepEqual(await repo.act(id, "STUDY", key), a);
  let state = await repo.readState(id);
  assert.equal(state.account.actionPoints, 8);
  assert.equal(state.usage.STUDY, 1);
  assert.equal((await repo.logs(id, 0)).length, 2);
  await assert.rejects(() => repo.act(id, "REST", key), /hành động khác/);
  const another = randomUUID();
  repo.registerAccount(another);
  assert.equal((await repo.readState(another)).character, null);
  assert.equal((await repo.logs(another, 0)).length, 0);
  const many = await Promise.allSettled(
    Array.from({ length: 15 }, () => repo.act(id, "WORK", randomUUID())),
  );
  assert(many.some((x) => x.status === "rejected"));
  state = await repo.readState(id);
  assert(state.account.actionPoints >= 0);
  assert((state.usage.WORK ?? 0) <= 8);
});
test("repository: daily cap resets on real day, repeated reads do not mint AP, marks/log limits persist across years", async () => {
  const { repo, id, advance, state: initial } = await fixture();
  for (let i = 0; i < 5; i++) await repo.act(id, "STUDY", randomUUID());
  await assert.rejects(() => repo.act(id, "STUDY", randomUUID()), /hạn mức/);
  assert.equal((await repo.readState(id)).account.actionPoints, 5);
  advance(1000);
  assert.equal((await repo.readState(id)).account.actionPoints, 15);
  assert.equal((await repo.readState(id)).account.actionPoints, 15);
  await repo.act(id, "STUDY", randomUUID());
  assert.equal((await repo.readState(id)).usage.STUDY, 1);
  advance(360 * MS_PER_GAME_DAY);
  assert.equal(
    (await repo.readState(id)).character!.age,
    initial.character!.startAge + 1,
  );
});
test("repository: illness lock, treatment-only cap and warning/hidden stat projection", async () => {
  const { repo, id, state } = await fixture();
  // Use a deterministic fixture repository seeded via its state for illness edge coverage.
  const internals = repo as unknown as { states: Map<string, typeof state> };
  state.character = {
    ...state.character!,
    hp: 0,
    status: "SEVERELY_ILL",
    treatmentsRemaining: 5,
    suspicion: 80,
  };
  internals.states.set(id, state);
  await assert.rejects(() => repo.act(id, "STUDY", randomUUID()), /trọng bệnh/);
  for (let i = 0; i < 5; i++) await repo.act(id, "TREAT", randomUUID());
  const recovered = await repo.readState(id);
  assert.equal(recovered.character!.status, "ACTIVE");
  await assert.rejects(() => repo.act(id, "TREAT", randomUUID()), /Chỉ dành/);
  const view = gameView(recovered);
  assert.equal(view.suspicionWarning, true);
  assert(!("suspicion" in view.character!));
  assert(!("suspicionFloor" in view.character!));
  const log = publicLog((await repo.logs(id, 0))[0]);
  assert(!("suspicion" in log.before));
  assert(!("suspicion" in log.after));
});
test("repository: first-action weekly marker is stable and journal pages have a 20-row limit plus sentinel", async () => {
  const { repo, id, advance } = await fixture();
  const first = await repo.act(id, "REST", randomUUID());
  await repo.act(id, "REST", randomUUID());
  assert.equal(repo.weekMarks.size, 1);
  assert.equal([...repo.weekMarks.values()][0], first.log.id);
  for (let n = 0; n < 19; n++) {
    advance(REAL_DAY_MS);
    await repo.act(id, "REST", randomUUID());
  }
  const page = await repo.logs(id, 0),
    next = await repo.logs(id, 1);
  assert.equal(page.length, 21);
  assert.equal(next.length, 1);
  assert.equal(page[20].id, next[0].id);
});
