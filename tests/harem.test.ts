import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  HAREM_ITEMS,
  CHAMBER_DECOR,
  HONORIFICS,
  validateHaremContent,
} from "../src/content/harem";
import { HAREM_BALANCE as B } from "../src/config/balance";
import {
  emptyCosmetics,
  cosmeticEffects,
  grantPromotionTitle,
  titledRank,
} from "../src/lib/cosmeticRules";
import {
  processCosmeticCommand,
  parseCosmeticCommand,
} from "../src/lib/cosmeticEngine";
import { processAction } from "../src/lib/actionProcessor";
import {
  evaluatePromotionEligibility,
  promotionWorldTime,
} from "../src/lib/promotionEligibility";
import { readyEventWorld } from "./helpers/eventFixtures";
import { InMemoryGameRepository } from "../src/lib/repositories/InMemoryGameRepository";
import type { RuntimeState } from "../src/types/runtime";
import type { CosmeticCommand } from "../src/types/cosmetics";
function ready(): RuntimeState {
  const state = readyEventWorld().states[0];
  state.character!.branch = "HAREM";
  state.character!.rankId = "harem_0";
  state.character!.characterSilver = 100000;
  state.cosmetics = emptyCosmetics(state.character!.id);
  return state;
}
const command = (
  state: RuntimeState,
  value: Parameters<typeof processCosmeticCommand>[1],
) => processCosmeticCommand(state, value, randomUUID());
test("cosmetic command parser rejects malformed types/slots and ignores client prices/effects", () => {
  for (const value of [
    null,
    { type: ["BUY_ITEM"], code: "OUTFIT_1_1" },
    { type: 42 },
    { type: "UNEQUIP_ITEM", slot: "WRONG" },
    { type: "BUY_ITEM", code: "invalid path" },
  ])
    assert.equal(parseCosmeticCommand(value), null);
  assert.deepEqual(
    parseCosmeticCommand({
      type: "BUY_ITEM",
      code: "OUTFIT_1_1",
      price: 0,
      effect: { audienceFavPct: 999 },
    }),
    { type: "BUY_ITEM", code: "OUTFIT_1_1" },
  );
});
test("H1 catalogue counts, all tiers, fictional status, prices/caps/references validate at load", () => {
  validateHaremContent();
  assert.equal(HAREM_ITEMS.filter((i) => i.slot === "OUTFIT").length, 12);
  assert.equal(HAREM_ITEMS.filter((i) => i.slot === "HEAD").length, 10);
  assert.equal(HAREM_ITEMS.filter((i) => i.slot === "ACCESSORY").length, 8);
  assert.equal(CHAMBER_DECOR.length, 18);
  for (const tier of [1, 2, 3, 4, 5])
    assert(
      HAREM_ITEMS.filter((i) => i.slot === "OUTFIT" && i.minTier === tier)
        .length >= 2,
    );
  assert.throws(() => validateHaremContent([...HAREM_ITEMS, HAREM_ITEMS[0]]));
  assert.throws(() =>
    validateHaremContent([
      { ...HAREM_ITEMS[0], price: -1 },
      ...HAREM_ITEMS.slice(1),
    ]),
  );
  assert.throws(() =>
    validateHaremContent([
      {
        ...HAREM_ITEMS[0],
        effect: { audienceFavPct: 26, etiquetteGainPct: 0 },
      },
      ...HAREM_ITEMS.slice(1),
    ]),
  );
  assert.throws(() =>
    validateHaremContent(HAREM_ITEMS, CHAMBER_DECOR.slice(1)),
  );
});
test("purchase guards: silver, duplicate, tier, daily cap, status and non-HAREM; no AP/stat changes", () => {
  const state = ready();
  const before = structuredClone(state);
  const bought = command(state, { type: "BUY_ITEM", code: "OUTFIT_1_1" }).state;
  assert.equal(
    bought.character!.characterSilver,
    before.character!.characterSilver - 20,
  );
  assert.equal(bought.account.actionPoints, before.account.actionPoints);
  assert.equal(bought.character!.cha, before.character!.cha);
  assert.equal(bought.cosmetics!.purchasesToday, 1);
  assert.equal(state.cosmetics!.ownedItemCodes.length, 0);
  assert.throws(
    () => command(bought, { type: "BUY_ITEM", code: "OUTFIT_1_1" }),
    /sở hữu/,
  );
  assert.throws(
    () => command(state, { type: "BUY_ITEM", code: "OUTFIT_2_1" }),
    /tầng phẩm/,
  );
  state.character!.characterSilver = 19;
  assert.throws(
    () => command(state, { type: "BUY_ITEM", code: "OUTFIT_1_1" }),
    /ngân lượng/,
  );
  state.character!.characterSilver = 100;
  state.cosmetics!.purchasesToday = 10;
  assert.throws(
    () => command(state, { type: "BUY_ITEM", code: "OUTFIT_1_1" }),
    /hạn mức/,
  );
  state.cosmetics!.purchasesToday = 0;
  state.character!.branch = "CIVIL";
  assert.throws(
    () => command(state, { type: "BUY_ITEM", code: "OUTFIT_1_1" }),
    /Hậu cung/,
  );
  state.character!.branch = "HAREM";
  state.character!.status = "SEVERELY_ILL";
  assert.throws(
    () => command(state, { type: "EQUIP_ITEM", code: "OUTFIT_1_1" }),
    /chưa thể/,
  );
});
test("equip/unequip have one item per correct slot, enforce ownership and tier; cosmetic decor owns/selects without effects", () => {
  let state = ready();
  for (const code of ["OUTFIT_1_1", "OUTFIT_1_2", "HEAD_1_1"])
    state = command(state, { type: "BUY_ITEM", code }).state;
  for (const code of ["OUTFIT_1_1", "OUTFIT_1_2", "HEAD_1_1"])
    state = command(state, { type: "EQUIP_ITEM", code }).state;
  assert.deepEqual(state.cosmetics!.equipment, {
    OUTFIT: "OUTFIT_1_2",
    HEAD: "HEAD_1_1",
  });
  assert.throws(
    () => command(state, { type: "EQUIP_ITEM", code: "ACCESSORY_1_1" }),
    /chưa sở hữu/,
  );
  state = command(state, { type: "UNEQUIP_ITEM", slot: "HEAD" }).state;
  assert(!state.cosmetics!.equipment.HEAD);
  assert.throws(
    () => command(state, { type: "SET_DECOR", code: "SCREEN_1" }),
    /chưa sở hữu/,
  );
  const effects = cosmeticEffects(state);
  state = command(state, { type: "BUY_DECOR", code: "SCREEN_1" }).state;
  state = command(state, { type: "SET_DECOR", code: "SCREEN_1" }).state;
  assert.equal(state.cosmetics!.chamber.decor.SCREEN, "SCREEN_1");
  assert.deepEqual(cosmeticEffects(state), effects);
  state = command(state, { type: "SET_DECOR", code: "SCREEN_0" }).state;
  assert.equal(state.cosmetics!.chamber.decor.SCREEN, "SCREEN_0");
});
test("chamber upgrades enforce each price/tier, cap at five and give only REST/SOCIALIZE reward bonuses", () => {
  let state = ready(),
    silver = state.character!.characterSilver;
  state = command(state, { type: "UPGRADE_CHAMBER" }).state;
  assert.equal(state.character!.characterSilver, silver - 80);
  assert.equal(state.cosmetics!.chamber.level, 2);
  assert.throws(() => command(state, { type: "UPGRADE_CHAMBER" }), /tầng phẩm/);
  state.character!.rankId = "harem_5";
  for (const price of [200, 500, 1200]) {
    silver = state.character!.characterSilver;
    state = command(state, { type: "UPGRADE_CHAMBER" }).state;
    assert.equal(state.character!.characterSilver, silver - price);
  }
  assert.throws(() => command(state, { type: "UPGRADE_CHAMBER" }));
  const effects = cosmeticEffects(state);
  assert.equal(effects.restHpPct, 40);
  assert.equal(effects.socializeRepPct, 20);
});
test("gear/chamber rewards use resonance then bonus then fatigue/floor/clamp; modifiers persist and eligibility uses base stats", () => {
  const state = ready();
  state.character!.rankId = "harem_3";
  state.character!.cha = 400;
  state.character!.hp = 50;
  state.character!.fav = 100;
  state.cosmetics!.ownedItemCodes = ["OUTFIT_5_1", "HEAD_5_1", "ACCESSORY_5_3"];
  state.cosmetics!.equipment = {
    OUTFIT: "OUTFIT_5_1",
    HEAD: "HEAD_5_1",
    ACCESSORY: "ACCESSORY_5_3",
  };
  state.cosmetics!.chamber.level = 5;
  const effects = cosmeticEffects(state);
  assert.equal(effects.audienceFavPct, 25);
  assert.equal(effects.etiquetteGainPct, 25);
  const audience = processAction(state, "AUDIENCE", randomUUID());
  assert.equal(audience.state.character!.fav, 113);
  assert.equal(audience.log.modifiers.cosmeticEffects?.audienceFavPct, 25);
  assert.equal(
    processAction(state, "ETIQUETTE", randomUUID()).state.character!.cha,
    408,
  );
  assert.equal(
    processAction(state, "REST", randomUUID()).state.character!.hp,
    78,
  );
  state.character!.rep = 100;
  assert.equal(
    processAction(state, "SOCIALIZE", randomUUID()).state.character!.rep,
    108,
  );
  state.character!.hp = 10;
  assert.equal(
    processAction(state, "AUDIENCE", randomUUID()).state.character!.fav,
    106,
  );
  const time = promotionWorldTime(
    state.serverNow,
    Date.parse(state.season.seasonStartTimestamp),
  );
  const a = evaluatePromotionEligibility(
    state.character!,
    state.character!.promotionRequirements,
    time,
  );
  const noGear = structuredClone(state);
  noGear.cosmetics = emptyCosmetics(state.character!.id);
  assert.deepEqual(
    evaluatePromotionEligibility(
      noGear.character!,
      noGear.character!.promotionRequirements,
      time,
    ),
    a,
  );
  assert.equal(state.character!.cha, 400);
  assert.equal(state.character!.fav, 100);
});
test("title milestones only once, exclude current title, retain ordered history; ordinary ranks/branches give none", () => {
  const state = ready();
  const at = new Date(state.serverNow).toISOString();
  assert.equal(
    grantPromotionTitle(state, "harem_14", at, () => 0),
    null,
  );
  for (const rank of B.titleMilestones) {
    const prev = state.cosmetics!.titles.at(-1)?.titleCode;
    const grant = grantPromotionTitle(state, rank, at, () => 0);
    assert(grant);
    assert.notEqual(grant.titleCode, prev);
    assert.equal(
      grantPromotionTitle(state, rank, at, () => 0.9),
      null,
    );
  }
  assert.equal(state.cosmetics!.titles.length, 5);
  assert(titledRank("harem_3", state.cosmetics).includes("Quý phi"));
  assert.equal(HONORIFICS.length, 9);
  state.character!.branch = "CIVIL";
  assert.equal(grantPromotionTitle(state, "harem_12", at), null);
});
test("Memory double-click/replay, stale revision, account-day cap after clear, and clearCharacterCosmetics", async () => {
  let now = Date.parse("2026-11-23T03:00:00Z");
  const repo = new InMemoryGameRepository(
      () => now,
      () => 0.99,
    ),
    id = randomUUID();
  repo.registerAccount(id);
  let state = await repo.readState(id);
  state = await repo.setup(
    id,
    { type: "BEGIN", branch: "HAREM" },
    state.revision,
    randomUUID(),
  );
  state = await repo.setup(
    id,
    { type: "CONFIRM" },
    state.revision,
    randomUUID(),
  );
  const internals = repo as unknown as { states: Map<string, RuntimeState> };
  internals.states.get(id)!.character!.characterSilver = 10000;
  state = await repo.readState(id);
  const key = randomUUID(),
    cmd = { type: "BUY_ITEM" as const, code: "OUTFIT_1_1" };
  const results = await Promise.all([
    repo.cosmeticAction(id, cmd, state.revision, key),
    repo.cosmeticAction(id, cmd, state.revision, key),
  ]);
  assert.deepEqual(results[0], results[1]);
  let after = await repo.readState(id);
  assert.equal(after.character!.characterSilver, 9980);
  assert.equal(after.cosmetics!.purchasesToday, 1);
  assert.equal(after.account.actionPoints, 10);
  assert.equal(repo.weekMarks.size, 0);
  await assert.rejects(
    repo.cosmeticAction(
      id,
      { type: "BUY_ITEM", code: "HEAD_1_1" },
      state.revision,
      randomUUID(),
    ),
    /thay đổi/,
  );
  await assert.rejects(
    repo.cosmeticAction(
      id,
      { type: "BUY_ITEM", code: "HEAD_1_1" },
      after.revision,
      key,
    ),
    /thao tác khác/,
  );
  await repo.clearCharacterCosmetics(after.character!.id);
  after = await repo.readState(id);
  assert.deepEqual(after.cosmetics!.ownedItemCodes, []);
  assert.equal(after.cosmetics!.purchasesToday, 1);
  assert.equal(after.cosmetics!.chamber.level, 1);
  const revisionAfterClear = after.revision;
  await repo.clearCharacterCosmetics(after.character!.id);
  assert.equal((await repo.readState(id)).revision, revisionAfterClear);
  assert.equal((await repo.readState(id)).cosmetics!.titles.length, 0);
  now += 86400000;
  assert.equal((await repo.readState(id)).cosmetics!.purchasesToday, 0);
});

test("ten real purchases share the account cap across item/decor/clear and another character; new UTC+7 day resets it", async () => {
  let now = Date.parse("2026-11-23T03:00:00Z");
  const repo = new InMemoryGameRepository(
      () => now,
      () => 0.99,
    ),
    id = randomUUID();
  repo.registerAccount(id);
  let state = await repo.readState(id);
  state = await repo.setup(
    id,
    { type: "BEGIN", branch: "HAREM" },
    state.revision,
    randomUUID(),
  );
  state = await repo.setup(
    id,
    { type: "CONFIRM" },
    state.revision,
    randomUUID(),
  );
  const internals = repo as unknown as { states: Map<string, RuntimeState> };
  internals.states.get(id)!.character!.characterSilver = 100000;
  const purchases: CosmeticCommand[] = [
    ...HAREM_ITEMS.filter((i) => i.minTier === 1).map((i) => ({
      type: "BUY_ITEM" as const,
      code: i.code,
    })),
    ...CHAMBER_DECOR.filter((d) => d.style === 1)
      .slice(0, 3)
      .map((d) => ({ type: "BUY_DECOR" as const, code: d.code })),
  ];
  assert.equal(purchases.length, 10);
  for (const cmd of purchases) {
    state = await repo.readState(id);
    await repo.cosmeticAction(id, cmd, state.revision, randomUUID());
  }
  state = await repo.readState(id);
  assert.equal(state.cosmetics!.purchasesToday, 10);
  assert.equal(state.account.actionPoints, 10);
  const next = { type: "BUY_DECOR" as const, code: "PLANT_1" };
  await assert.rejects(
    repo.cosmeticAction(id, next, state.revision, randomUUID()),
    /hạn mức/,
  );
  await repo.clearCharacterCosmetics(state.character!.id);
  internals.states.get(id)!.character!.id = randomUUID();
  state = await repo.readState(id);
  assert.equal(state.cosmetics!.ownedItemCodes.length, 0);
  assert.equal(state.cosmetics!.purchasesToday, 10);
  await assert.rejects(
    repo.cosmeticAction(id, next, state.revision, randomUUID()),
    /hạn mức/,
  );
  now += 86400000;
  state = await repo.readState(id);
  await repo.cosmeticAction(id, next, state.revision, randomUUID());
  assert.equal((await repo.readState(id)).cosmetics!.purchasesToday, 1);
});
