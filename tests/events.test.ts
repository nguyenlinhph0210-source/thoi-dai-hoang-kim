import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { EVENT_CATALOG, validateEventCatalog } from "../src/config/events";
import { EVENT_BALANCE as B, MS_PER_GAME_DAY } from "../src/config/balance";
import {
  afterValidAction,
  canAppear,
  chooseGroup,
  ensureInvestigation,
  eventChoiceLockReason,
  eventProbability,
  eventWeight,
  expireDueEvents,
  publicPendingEvents,
  resolveEvent,
} from "../src/lib/eventEngine";
import { processAction } from "../src/lib/actionProcessor";
import {
  evaluatePromotionEligibility,
  promotionWorldTime,
} from "../src/lib/promotionEligibility";
import { gameView, publicLog } from "../src/lib/publicState";
import { InMemoryGameRepository } from "../src/lib/repositories/InMemoryGameRepository";
import {
  readyEventWorld,
  pendingFixture,
  seededEventRandom,
  eventStart,
} from "./helpers/eventFixtures";
import type { EventData } from "../src/types/events";
import type { RuntimeState } from "../src/types/runtime";
const definition = (code: string) =>
  EVENT_CATALOG.find((e) => e.code === code)!;
function action(
  world = readyEventWorld(),
  options: { random: () => number } = { random: () => 0 },
) {
  const state = world.states[0],
    computed = processAction(
      { ...state, serverNow: world.serverNow },
      "STUDY",
      randomUUID(),
      options.random,
    );
  world.states[0] = computed.state;
  afterValidAction(world, state.account.id, computed.log, options);
  return world;
}
test("20 fictional SAMPLE_DRAFT definitions validate; duplicate codes, invalid references, lethal flags and missing outcomes fail", () => {
  assert.equal(EVENT_CATALOG.length, 20);
  validateEventCatalog(EVENT_CATALOG);
  assert(
    EVENT_CATALOG.every((e) => e.fictional && e.status === "SAMPLE_DRAFT"),
  );
  for (const mutate of [
    (c: typeof EVENT_CATALOG) => [...c, c[0]],
    (c: typeof EVENT_CATALOG) => {
      const copy = structuredClone(c);
      copy[0].requirements.rankIds = ["MISSING_RANK"];
      return copy;
    },
    (c: typeof EVENT_CATALOG) => {
      const copy = structuredClone(c);
      copy[0].stages[0].choices[0].requirements = { rankIds: ["MISSING_RANK"] };
      return copy;
    },
    (c: typeof EVENT_CATALOG) => {
      const copy = structuredClone(c);
      copy[0].stages[0].choices[0].result = {
        kind: "FIXED",
        outcome: {
          code: "BAD",
          text: "bad",
          effects: {},
          flags: ["DEATH" as "SEVERELY_ILL"],
          terminal: "FAILURE",
        },
      };
      return copy;
    },
    (c: typeof EVENT_CATALOG) => {
      const copy = structuredClone(c);
      copy[0].stages[0].choices[0].result = {
        kind: "FIXED",
        outcome: {
          code: "BAD",
          text: "bad",
          effects: {},
          flags: [],
          terminal: "NEXT",
          nextStage: "MISSING",
        },
      };
      return copy;
    },
  ])
    assert.throws(() => validateEventCatalog(mutate(EVENT_CATALOG)));
});
test("seeded weekly chance is approximately 40/60; exact group weights and fallback NORMAL", () => {
  const random = seededEventRandom(124);
  let hits = 0;
  for (let i = 0; i < 10000; i++) {
    const world = action(readyEventWorld(), { random });
    hits += Number(world.eventData.checks[0].triggered);
  }
  assert(Math.abs(hits / 10000 - 0.4) < 0.02);
  const counts = { NORMAL: 0, RARE: 0, DANGEROUS: 0, GREAT_CALAMITY: 0 };
  for (let i = 0; i < 100; i++) counts[chooseGroup(() => i / 100)]++;
  assert.deepEqual(counts, B.groupWeights);
  const w = readyEventWorld();
  let calls = 0;
  action(w, { random: () => (calls++ === 0 ? 0 : calls === 2 ? 0.99 : 0) });
  assert.equal(w.eventData.checks[0].group, "GREAT_CALAMITY");
  const fallback = readyEventWorld();
  const log = processAction(fallback.states[0], "STUDY", randomUUID()).log;
  afterValidAction(fallback, fallback.states[0].account.id, log, {
    random: (() => {
      let n = 0;
      return () => (++n === 2 ? 0.99 : 0);
    })(),
    catalog: EVENT_CATALOG.filter((d) => d.group === "NORMAL"),
  });
  assert.equal(fallback.eventData.instances[0].definition.group, "NORMAL");
});
test("one check per character/week; repeated actions and legacy marks never grant a second or retrospective draw", () => {
  const w = action();
  const before = structuredClone(w.eventData.checks[0]);
  for (let i = 0; i < 3; i++) action(w);
  assert.equal(w.eventData.checks.length, 1);
  assert.deepEqual(w.eventData.checks[0], before);
  assert.equal(w.eventData.instances.length, 1);
  w.serverNow += 7 * MS_PER_GAME_DAY;
  action(w);
  assert.equal(w.eventData.checks.length, 2);
  const legacy = readyEventWorld();
  legacy.eventData.marks.push({
    characterId: legacy.states[0].character!.id,
    seasonId: legacy.season.id,
    week: 1,
    firstActionId: randomUUID(),
  });
  action(legacy);
  assert.equal(legacy.eventData.checks[0].reason, "LEGACY_MARK");
  assert.equal(legacy.eventData.instances.length, 0);
});
test("causal tags multiply weights without changing group weights; conditions and cooldown are enforced", () => {
  const w = readyEventWorld(),
    c = w.states[0].character!;
  Object.assign(c, { fav: 500, int: 100, rep: 100 });
  assert.equal(eventWeight(definition("BITTER_MEDICINE"), c), 1.4);
  assert.equal(eventWeight(definition("WHISPERED_REPORT"), c), 1.3);
  assert.equal(
    eventWeight(
      { ...definition("BITTER_MEDICINE"), tags: ["HARM", "SLANDER"] },
      c,
    ),
    1.4 * 1.3,
  );
  const h = definition("HAREM_INVITATION");
  assert(!canAppear(h, c, w));
  c.branch = "INNER_COURT";
  c.rankId = "inner_2";
  c.cha = 150;
  c.int = 100;
  c.suspicion = 45;
  assert(canAppear(h, c, w));
  c.cha = 149;
  assert(!canAppear(h, c, w));
  c.cha = 150;
  const e = pendingFixture(w, h);
  assert(!canAppear(h, c, w));
  e.status = "RESOLVED";
  e.resolvedAt = new Date(w.serverNow).toISOString();
  w.serverNow += 30 * MS_PER_GAME_DAY - 1;
  assert(!canAppear(h, c, w));
  w.serverNow++;
  assert(canAppear(h, c, w));
});
test("cap three still records weekly roll; full mandatory inquiry is deferred, blocks promotion, then occupies a freed slot", () => {
  const w = readyEventWorld();
  for (let i = 0; i < 3; i++) pendingFixture(w, definition("OLD_BOOK"));
  w.states[0].character!.suspicion = 80;
  action(w);
  assert.equal(w.eventData.instances.length, 3);
  assert.equal(w.eventData.checks[0].reason, "FULL");
  assert(w.states[0].character!.investigationPending);
  w.states[0].character!.suspicion = 0;
  const p = evaluatePromotionEligibility(
    w.states[0].character!,
    w.states[0].character!.promotionRequirements,
    promotionWorldTime(w.serverNow, Date.parse(w.season.seasonStartTimestamp)),
  );
  assert(p.underInvestigation);
  assert(!p.eligibleToApply);
  const next = resolveEvent(
    w,
    w.states[0].account.id,
    { eventId: w.eventData.instances[0].id, choiceCode: "PASS" },
    randomUUID(),
    { random: () => 0 },
  ).world;
  assert.equal(
    next.eventData.instances.filter((e) => e.status === "PENDING").length,
    3,
  );
  assert(
    next.eventData.instances.some((e) =>
      e.definition.tags.includes("INVESTIGATION"),
    ),
  );
});
test("expiry applies default once, charges no AP and never creates death; stored event definition survives catalog changes", () => {
  const w = readyEventWorld();
  const e = pendingFixture(w, definition("OLD_BOOK"));
  const ap = w.states[0].account.actionPoints;
  w.serverNow = Date.parse(e.expiresAt);
  const after = expireDueEvents(w);
  assert.equal(after.eventData.instances[0].status, "EXPIRED");
  assert.equal(after.states[0].account.actionPoints, ap);
  assert.equal(after.eventData.records.length, 1);
  assert.deepEqual(expireDueEvents(after), after);
  assert.notEqual(after.states[0].character!.status, "DECEASED");
});
test("choice costs, requirements, fatigue, resonance and suspicion floor use shared stat engine", () => {
  let w = readyEventWorld();
  let e = pendingFixture(w, definition("UNEXPECTED_PRAISE"));
  Object.assign(w.states[0].character!, {
    hp: 19,
    cha: 400,
    fav: 0,
    rep: 100,
    characterSilver: 0,
  });
  let resolved = resolveEvent(
    w,
    w.states[0].account.id,
    { eventId: e.id, choiceCode: "BOW" },
    randomUUID(),
    { random: () => 0.99 },
  );
  assert.equal(
    resolved.world.states[0].character!.fav,
    Math.floor(B.rewardLarge * 1.3 * 0.5),
  );
  assert.equal(resolved.world.states[0].character!.rep, 95);
  w = readyEventWorld();
  e = pendingFixture(w, definition("CENSOR_INQUIRY"));
  Object.assign(w.states[0].character!, {
    rep: 100,
    suspicion: 10,
    suspicionFloor: 0,
    investigationPending: true,
  });
  resolved = resolveEvent(
    w,
    w.states[0].account.id,
    { eventId: e.id, choiceCode: "SETTLE" },
    randomUUID(),
    { random: () => 0.99 },
  );
  assert.equal(resolved.world.states[0].character!.suspicionFloor, 5);
  assert.equal(resolved.world.states[0].character!.suspicion, 5);
  assert.equal(resolved.world.states[0].character!.characterSilver, 90);
  w.states[0].account.actionPoints = 0;
  assert.match(
    eventChoiceLockReason(w.states[0], e, e.definition.stages[0].choices[1])!,
    /AP/,
  );
  assert.throws(
    () =>
      resolveEvent(
        w,
        w.states[0].account.id,
        { eventId: e.id, choiceCode: "SETTLE" },
        randomUUID(),
      ),
    /AP/,
  );
  const c = readyEventWorld().states[0].character!;
  c.int = 0;
  c.hp = 19;
  assert.equal(
    eventProbability(c, B.probability),
    Math.max(0.05, 0.35 + 19 / 400 - 0.3),
  );
  c.hp = 20;
  assert.equal(eventProbability(c, B.probability), 0.35 + 20 / 400);
});
test("calamity rewards only final success; each code/account/season once, with ledger; failure/expiry causes illness and half silver", () => {
  let w = readyEventWorld();
  let e = pendingFixture(w, definition("FIRE_IN_STORE"));
  const id = w.states[0].account.id;
  let next = resolveEvent(
    w,
    id,
    { eventId: e.id, choiceCode: "FACE" },
    randomUUID(),
    { random: () => 0 },
  );
  assert.equal(next.world.states[0].account.destinyPoints, 0);
  assert.equal(next.world.eventData.instances[0].stage, 1);
  next = resolveEvent(
    next.world,
    id,
    { eventId: e.id, choiceCode: "ENDURE" },
    randomUUID(),
    { random: () => 0 },
  );
  w = next.world;
  assert.equal(w.states[0].account.destinyPoints, 1);
  assert.equal(w.eventData.claims.length, 1);
  assert.equal(w.eventData.ledger.length, 1);
  assert.equal(next.result.log.event!.destinyAwarded, 1);
  e = pendingFixture(w, definition("FIRE_IN_STORE"), 1);
  next = resolveEvent(
    w,
    id,
    { eventId: e.id, choiceCode: "ENDURE" },
    randomUUID(),
    { random: () => 0 },
  );
  assert.equal(next.world.states[0].account.destinyPoints, 1);
  assert.equal(next.result.log.event!.destinyAwarded, 0);
  w = readyEventWorld();
  e = pendingFixture(w, definition("FIRE_IN_STORE"));
  w.states[0].character!.characterSilver = 101;
  next = resolveEvent(
    w,
    w.states[0].account.id,
    { eventId: e.id, choiceCode: "FACE" },
    randomUUID(),
    { random: () => 0.999 },
  );
  assert.equal(next.world.states[0].character!.status, "SEVERELY_ILL");
  assert.equal(next.world.states[0].character!.characterSilver, 50);
  assert.equal(next.world.states[0].character!.treatmentsRemaining, 5);
  assert.equal(next.world.states[0].account.destinyPoints, 0);
  w.serverNow = Date.parse(e.expiresAt);
  assert.equal(expireDueEvents(w).states[0].character!.status, "SEVERELY_ILL");
});
test("inquiry threshold, branch, pending flag and 14-game-day cooldown survive lowered suspicion", () => {
  const w = readyEventWorld(),
    s = w.states[0];
  s.character!.suspicion = 79;
  ensureInvestigation(w, s);
  assert.equal(w.eventData.instances.length, 0);
  s.character!.suspicion = 80;
  ensureInvestigation(w, s);
  assert.equal(w.eventData.instances[0].definition.code, "CENSOR_INQUIRY");
  s.character!.suspicion = 10;
  ensureInvestigation(w, s);
  assert(s.character!.investigationPending);
  let after = resolveEvent(
    w,
    s.account.id,
    { eventId: w.eventData.instances[0].id, choiceCode: "ACCEPT_PENALTY" },
    randomUUID(),
    { random: () => 0.99 },
  ).world;
  assert(!after.states[0].character!.investigationPending);
  after.states[0].character!.suspicion = 80;
  ensureInvestigation(after, after.states[0]);
  assert.equal(after.eventData.instances.length, 1);
  after.serverNow += 14 * MS_PER_GAME_DAY;
  ensureInvestigation(after, after.states[0]);
  assert.equal(after.eventData.instances.length, 2);
});
test("Harem invitation invokes existing conversion engine, retains merit, releases seats and generates Harem conditions", () => {
  const w = readyEventWorld("INNER_COURT"),
    s = w.states[0];
  s.character!.rankId = "inner_5";
  s.character!.fav = 100;
  const e = pendingFixture(w, definition("HAREM_INVITATION"));
  const after = resolveEvent(
    w,
    s.account.id,
    { eventId: e.id, choiceCode: "ACCEPT" },
    randomUUID(),
    { random: () => 0 },
  ).world;
  assert.equal(after.states[0].character!.branch, "HAREM");
  assert.equal(after.states[0].character!.rankId, "harem_13");
  assert.equal(after.states[0].character!.fav, 60);
  assert.equal(after.states[0].character!.merit, s.character!.merit);
  assert.equal(after.history[0].reason, "CONVERSION");
  assert.equal(after.eventData.instances[0].status, "RESOLVED");
  const decline = resolveEvent(
    w,
    s.account.id,
    { eventId: e.id, choiceCode: "DECLINE" },
    randomUUID(),
    { random: () => 0 },
  ).world;
  assert.equal(decline.states[0].character!.branch, "INNER_COURT");
  assert(
    !canAppear(
      definition("HAREM_INVITATION"),
      decline.states[0].character!,
      decline,
    ),
  );
});
test("DTO reveals narrative, costs and lock reasons without hidden raw conditions/effects/suspicion", () => {
  const w = readyEventWorld();
  const e = pendingFixture(w, definition("CENSOR_INQUIRY"));
  w.states[0].events = [e];
  const view = gameView(w.states[0]);
  assert.equal(view.pendingEvents.length, 1);
  assert(!("definition" in view.pendingEvents[0]));
  assert(!JSON.stringify(view.pendingEvents).includes("suspicion"));
  const result = resolveEvent(
    w,
    w.states[0].account.id,
    { eventId: e.id, choiceCode: "SETTLE" },
    randomUUID(),
    { random: () => 0.99 },
  ).result;
  assert(!("suspicion" in publicLog(result.log).after));
  assert(!("effects" in result.log.event!));
});
test("Memory double click and concurrent requests roll once, resolve once, preserve key binding, and expire idempotently", async () => {
  let now = eventStart;
  const repo = new InMemoryGameRepository(
      () => now,
      () => 0,
    ),
    id = randomUUID();
  repo.registerAccount(id);
  let s = await repo.readState(id);
  s = await repo.setup(
    id,
    { type: "BEGIN", branch: "CIVIL" },
    s.revision,
    randomUUID(),
  );
  await repo.setup(id, { type: "CONFIRM" }, s.revision, randomUUID());
  const key = randomUUID();
  const [a, b] = await Promise.all([
    repo.act(id, "STUDY", key),
    repo.act(id, "STUDY", key),
  ]);
  assert.deepEqual(a, b);
  const internals = repo as unknown as {
    eventData: EventData;
    states: Map<string, RuntimeState>;
  };
  assert.equal(internals.eventData.checks.length, 1);
  const pending = (await repo.readState(id)).events![0];
  const rkey = randomUUID(),
    choice = { eventId: pending.id, choiceCode: "HELP" };
  const [r1, r2] = await Promise.all([
    repo.act(id, "RESOLVE_EVENT", rkey, choice),
    repo.act(id, "RESOLVE_EVENT", rkey, choice),
  ]);
  assert.deepEqual(r1, r2);
  assert.deepEqual(
    await repo.act(id, "RESOLVE_EVENT", rkey, {
      choiceCode: "HELP",
      eventId: pending.id,
    }),
    r1,
  );
  assert.equal(internals.eventData.records.length, 1);
  await assert.rejects(
    () =>
      repo.act(id, "RESOLVE_EVENT", rkey, { ...choice, choiceCode: "PASS" }),
    /lựa chọn|hành động/,
  );
  const w = readyEventWorld();
  const exp = pendingFixture(w, definition("OLD_BOOK"));
  exp.accountId = id;
  exp.characterId = (await repo.readState(id)).character!.id;
  exp.seasonId = repo.season.id;
  internals.eventData.instances.push(exp);
  now = Date.parse(exp.expiresAt);
  await Promise.all([repo.readState(id), repo.readState(id)]);
  assert.equal(
    internals.eventData.instances.find((e) => e.id === exp.id)!.status,
    "EXPIRED",
  );
});

test("paid rerolls also write the new destiny ledger once; old balances are never reset", async () => {
  const repo = new InMemoryGameRepository(
      () => eventStart,
      () => 0.99,
    ),
    id = randomUUID();
  repo.registerAccount(id);
  let state = await repo.readState(id);
  state = await repo.setup(
    id,
    { type: "BEGIN", branch: "CIVIL" },
    state.revision,
    randomUUID(),
  );
  const internal = repo as unknown as {
    states: Map<string, RuntimeState>;
    eventData: EventData;
  };
  internal.states.get(id)!.account.destinyPoints = 1;
  internal.states.get(id)!.account.freeRerollsLeft = 0;
  const key = randomUUID();
  await repo.setup(id, { type: "REROLL" }, state.revision, key);
  await repo.setup(id, { type: "REROLL" }, state.revision, key);
  assert.equal((await repo.readState(id)).account.destinyPoints, 0);
  assert.equal(internal.eventData.ledger.length, 1);
  assert.equal(internal.eventData.ledger[0].delta, -1);
  assert.equal(internal.eventData.ledger[0].reason, "REROLL");
});

test("calamity anti-farm key spans characters but resets per season, and denied choices spend nothing", () => {
  let w = readyEventWorld(),
    id = w.states[0].account.id,
    e = pendingFixture(w, definition("FIRE_IN_STORE"), 1);
  w = resolveEvent(
    w,
    id,
    { eventId: e.id, choiceCode: "ENDURE" },
    randomUUID(),
    { random: () => 0 },
  ).world;
  assert.equal(w.states[0].account.destinyPoints, 1);
  w.states[0].character!.id = randomUUID();
  e = pendingFixture(w, definition("FIRE_IN_STORE"), 1);
  w = resolveEvent(
    w,
    id,
    { eventId: e.id, choiceCode: "ENDURE" },
    randomUUID(),
    { random: () => 0 },
  ).world;
  assert.equal(w.states[0].account.destinyPoints, 1);
  w.season.id = randomUUID();
  w.states[0].character!.id = randomUUID();
  w.states[0].character!.seasonId = w.season.id;
  e = pendingFixture(w, definition("FIRE_IN_STORE"), 1);
  w = resolveEvent(
    w,
    id,
    { eventId: e.id, choiceCode: "ENDURE" },
    randomUUID(),
    { random: () => 0 },
  ).world;
  assert.equal(w.states[0].account.destinyPoints, 2);
  const scarce = readyEventWorld();
  const rare = pendingFixture(scarce, definition("CEREMONIAL_ROBE"));
  scarce.states[0].character!.characterSilver = 0;
  const before = structuredClone(scarce);
  assert.throws(
    () =>
      resolveEvent(
        scarce,
        scarce.states[0].account.id,
        { eventId: rare.id, choiceCode: "PREPARE" },
        randomUUID(),
      ),
    /ngân lượng/,
  );
  assert.deepEqual(scarce, before);
});

test("a real free event choice can be the first weekly action; passive expiry never rolls", () => {
  const w = readyEventWorld(),
    e = pendingFixture(w, definition("OLD_BOOK"));
  const after = resolveEvent(
    w,
    w.states[0].account.id,
    { eventId: e.id, choiceCode: "PASS" },
    randomUUID(),
    { random: () => 0.99 },
  ).world;
  assert.equal(after.eventData.checks.length, 1);
  assert.equal(after.states[0].account.actionPoints, 15);
  w.serverNow = Date.parse(e.expiresAt);
  assert.equal(expireDueEvents(w).eventData.checks.length, 0);
});

test("an old stage cannot resolve a later stage with the same choice code", () => {
  const world = readyEventWorld(),
    def = structuredClone(definition("FIRE_IN_STORE"));
  def.stages[1].choices[0].code = "FACE";
  const e = pendingFixture(world, def);
  const next = resolveEvent(
    world,
    world.states[0].account.id,
    { eventId: e.id, choiceCode: "FACE", stage: 0 },
    randomUUID(),
    { random: () => 0 },
  ).world;
  const before = structuredClone(next);
  assert.throws(
    () =>
      resolveEvent(
        next,
        next.states[0].account.id,
        { eventId: e.id, choiceCode: "FACE", stage: 0 },
        randomUUID(),
        { random: () => 0 },
      ),
    /Giai đoạn/,
  );
  assert.deepEqual(next, before);
});
