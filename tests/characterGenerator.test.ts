import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clampStats,
  ConfigurationError,
  confirmCharacter,
  createAccount,
  GameRuleError,
  generateCharacter,
  generatePromotionRequirements,
  randomInteger,
  rerollCharacter,
  rollOrigin,
  transitionSetup,
} from "../src/lib/characterGenerator";
import {
  BASE_STAT_RANGES,
  DEMO_SEASON_ID,
  INITIAL_RANKS,
  ORIGIN_INFO,
  PROMOTION_STATS,
  RANKS,
  SUSPICION_REQUIREMENT_RANGES,
} from "../src/lib/gameConfig";
import {
  BRANCHES,
  type CharacterStats,
  type Origin,
  type RankTier,
  type SetupState,
  type StatKey,
} from "../src/types/game";
const accountId = "00000000-0000-4000-8000-000000000002";
const characterId = "00000000-0000-4000-8000-000000000003";
const now = "2026-11-14T00:00:00Z";
const context = {
  id: characterId,
  accountId,
  seasonId: DEMO_SEASON_ID,
  now,
  gameYear: 1,
  random: () => 0,
};
const account = () => createAccount(accountId);
const draft = () => generateCharacter("CIVIL", context);
function sequence(values: number[]) {
  let i = 0;
  return () => values[i++] ?? 0;
}

test("origin probabilities have exact 40/30/20/10 discrete coverage and correct boundary tickets", () => {
  const counts: Record<Origin, number> = {
    COMMONER: 0,
    SCHOLAR_FAMILY: 0,
    NOBLE_CLAN: 0,
    FALLEN_CLAN: 0,
  };
  for (let ticket = 0; ticket < 100; ticket++)
    counts[rollOrigin(() => (ticket + 0.5) / 100)]++;
  assert.deepEqual(counts, {
    COMMONER: 40,
    SCHOLAR_FAMILY: 30,
    NOBLE_CLAN: 20,
    FALLEN_CLAN: 10,
  });
  for (const [ticket, origin] of [
    [0, "COMMONER"],
    [39, "COMMONER"],
    [40, "SCHOLAR_FAMILY"],
    [69, "SCHOLAR_FAMILY"],
    [70, "NOBLE_CLAN"],
    [89, "NOBLE_CLAN"],
    [90, "FALLEN_CLAN"],
    [99, "FALLEN_CLAN"],
  ] as const)
    assert.equal(
      rollOrigin(() => ticket / 100),
      origin,
    );
});
test("all branch/origin combinations use exact lower/upper ranges, modifiers, age and initial rank", () => {
  const origins: [Origin, number][] = [
    ["COMMONER", 0.1],
    ["SCHOLAR_FAMILY", 0.5],
    ["NOBLE_CLAN", 0.8],
    ["FALLEN_CLAN", 0.95],
  ];
  for (const branch of BRANCHES)
    for (const [origin, ticket] of origins)
      for (const edge of [0, 0.999999]) {
        const c = generateCharacter(branch, {
          ...context,
          random: sequence([ticket, ...Array<number>(8).fill(edge)]),
        });
        assert.equal(c.origin, origin);
        assert.equal(c.age, edge === 0 ? 16 : 21);
        assert.equal(c.rankId, INITIAL_RANKS[branch].id);
        for (const key of Object.keys(BASE_STAT_RANGES[branch]) as StatKey[]) {
          const bounds = BASE_STAT_RANGES[branch][key];
          const base =
            bounds[edge === 0 ? 0 : 1] +
            (ORIGIN_INFO[origin].modifiers[key] ?? 0);
          const max =
            key === "hp" || key === "suspicion"
              ? 100
              : key === "characterSilver"
                ? Number.MAX_SAFE_INTEGER
                : 1000;
          assert.equal(
            c[key],
            Math.max(key === "fav" ? -100 : 0, Math.min(max, base)),
            `${branch}/${origin}/${key}`,
          );
        }
        assert.equal(c.status, "DRAFT");
        assert.equal(c.promotionRequirements, null);
        assert.equal(c.confirmedAt, null);
      }
});
test("clamps every stat and applies only initial entry minima, not next-rank requirements", () => {
  assert.deepEqual(
    clampStats({
      int: -1,
      rep: 1001,
      fav: -101,
      cha: 1001,
      hp: 108,
      suspicion: 108,
      characterSilver: -5,
    }),
    {
      int: 0,
      rep: 1000,
      fav: -100,
      cha: 1000,
      hp: 100,
      suspicion: 100,
      characterSilver: 0,
    },
  );
  const standard = generateCharacter("CIVIL", {
    ...context,
    initialRank: {
      ...INITIAL_RANKS.CIVIL,
      entryMinimums: { int: 90, rep: 50 },
    },
  });
  assert.equal(standard.int, 45);
  assert.equal(standard.rep, 15);
  const c = generateCharacter("CIVIL", {
    ...context,
    initialRank: RANKS.civil_7b,
  });
  assert.equal(c.int, 85);
  assert.equal(c.rep, 55);
  assert.equal(c.fav, -5);
  assert.equal(c.cha, 50);
  assert.throws(
    () =>
      generateCharacter("CIVIL", {
        ...context,
        initialRank: { ...RANKS.civil_7b, id: "unknown" },
      }),
    ConfigurationError,
  );
});
test("first preview plus three free rerolls, then one destiny point per reroll; pending silver and AP survive", () => {
  let a = { ...account(), pendingRewardSilver: 200, destinyPoints: 2 };
  let c = draft();
  for (let n = 2; n >= 0; n--) {
    const result = rerollCharacter(a, c, context);
    a = result.account;
    c = result.character;
    assert.equal(a.freeRerollsLeft, n);
    assert.equal(a.destinyPoints, 2);
  }
  for (let n = 1; n >= 0; n--) {
    const result = rerollCharacter(a, c, context);
    a = result.account;
    c = result.character;
    assert.equal(a.destinyPoints, n);
    assert.equal(c.branch, "CIVIL");
    assert.equal(c.id, characterId);
    assert.equal(a.pendingRewardSilver, 200);
    assert.equal(a.actionPoints, 10);
  }
  assert.throws(() => rerollCharacter(a, c, context), GameRuleError);
  assert.equal(a.destinyPoints, 0);
});
test("confirmation transfers pending silver exactly once, expires unused free rolls and locks three conditions", () => {
  const c = draft();
  const a = { ...account(), pendingRewardSilver: 200 };
  const result = confirmCharacter(a, c, now, () => 0);
  assert.equal(result.character.characterSilver, c.characterSilver + 200);
  assert.equal(result.account.pendingRewardSilver, 0);
  assert.equal(result.account.freeRerollsLeft, 0);
  assert.equal(result.account.hasCreatedCharacter, true);
  assert.equal(result.character.promotionRequirements?.conditions.length, 3);
  assert.equal(result.character.promotionRequirements?.characterId, c.id);
  assert.equal(
    result.character.promotionRequirements?.targetRankId,
    "civil_7b",
  );
  const repeated = confirmCharacter(
    result.account,
    result.character,
    now,
    () => 0.99,
  );
  assert.deepEqual(repeated, result);
  assert.throws(
    () => rerollCharacter(result.account, result.character, context),
    GameRuleError,
  );
  assert.equal(a.pendingRewardSilver, 200);
  assert.equal(c.status, "DRAFT"); // Pure transitions never mutate inputs.
});
test("reincarnation first preview is free but has no new free rerolls; changing branch in a life is rejected", () => {
  const a = {
    ...account(),
    hasCreatedCharacter: true,
    freeRerollsLeft: 0,
    destinyPoints: 1,
  };
  const state: SetupState = {
    account: a,
    character: null,
    revision: 0,
    processedRequests: [],
  };
  const first = transitionSetup(
    state,
    { type: "BEGIN", branch: "HAREM" },
    context,
  );
  assert.equal(first.account.destinyPoints, 1);
  const next = transitionSetup(first, { type: "REROLL" }, context);
  assert.equal(next.account.destinyPoints, 0);
  assert.equal(next.character?.branch, "HAREM");
  assert.deepEqual(
    transitionSetup(first, { type: "BEGIN", branch: "HAREM" }, context),
    first,
  );
  assert.throws(
    () => transitionSetup(first, { type: "BEGIN", branch: "CIVIL" }, context),
    GameRuleError,
  );
});
test("promotion third-stat weights are exactly 40/40/20 and fixed A/B follow each branch", () => {
  for (const branch of BRANCHES) {
    const c = generateCharacter(branch, context);
    const target = RANKS[INITIAL_RANKS[branch].nextRankId!];
    const [a, b, c1, c2] = PROMOTION_STATS[branch];
    const counts: Partial<Record<StatKey, number>> = {};
    for (let ticket = 0; ticket < 100; ticket++) {
      const req = generatePromotionRequirements(
        c,
        target,
        now,
        sequence([(ticket + 0.5) / 100, 0, 0, 0]),
      );
      assert.equal(req.conditions[0].stat, a);
      assert.equal(req.conditions[1].stat, b);
      const third = req.conditions[2];
      counts[third.stat] = (counts[third.stat] ?? 0) + 1;
      assert.equal(third.operator, third.stat === "suspicion" ? "<=" : ">=");
      assert.equal(
        new Set(req.conditions.map((condition) => condition.stat)).size,
        3,
      );
    }
    assert.deepEqual(counts, { [c1]: 40, [c2]: 40, suspicion: 20 });
  }
});
test("promotion special bounds cover all five tiers and both inclusive endpoints", () => {
  for (const tier of [1, 2, 3, 4, 5] satisfies RankTier[])
    for (const [stat, ticket] of [["suspicion", 0.99]] as const)
      for (const edge of [0, 0.99999]) {
        const target = { ...RANKS.civil_7b, tier };
        const req = generatePromotionRequirements(
          draft(),
          target,
          now,
          sequence([ticket, 0, 0, edge]),
        );
        assert.equal(
          req.conditions[2].value,
          SUSPICION_REQUIREMENT_RANGES[tier][edge === 0 ? 0 : 1],
        );
      }
});
test("benchmark delta boundaries, nonrounded integers and strict monotonicity", () => {
  for (const [base, delta] of [
    [-20, 5],
    [0, 5],
    [99, 5],
    [100, 10],
    [299, 10],
    [300, 12],
    [699, 12],
    [700, 15],
    [985, 15],
  ]) {
    const target = {
      ...RANKS.harem_14,
      benchmarks: { int: base < 0 ? 50 : base, rep: 50, fav: base, cha: 50 },
    };
    const c = generateCharacter("HAREM", context);
    const min = generatePromotionRequirements(c, target, now, () => 0)
      .conditions[0].value;
    const max = generatePromotionRequirements(
      c,
      target,
      now,
      sequence([0, 0.999999, 0, 0]),
    ).conditions[0].value;
    assert.equal(min, Math.max(-100, base - delta));
    assert.equal(max, Math.min(1000, base + delta));
  }
  const req = generatePromotionRequirements(
    draft(),
    RANKS.civil_7b,
    now,
    () => 0,
    { int: 90 },
  );
  assert.equal(req.conditions[0].value, 91);
  assert.throws(
    () =>
      generatePromotionRequirements(draft(), RANKS.civil_7b, now, () => 0, {
        int: 95,
      }),
    ConfigurationError,
  );
});
test("invalid randomness/ranges and wrong account cannot bypass guards", () => {
  for (const invalid of [1, -0.1, NaN, Infinity])
    assert.throws(
      () => randomInteger(0, 10, () => invalid),
      ConfigurationError,
    );
  assert.equal(
    randomInteger(16, 21, () => 0.999999),
    21,
  );
  assert.throws(() => randomInteger(3, 2), ConfigurationError);
  assert.throws(
    () => confirmCharacter({ ...account(), id: "another" }, draft(), now),
    GameRuleError,
  );
  const overflow = {
    ...account(),
    pendingRewardSilver: Number.MAX_SAFE_INTEGER,
  };
  assert.throws(
    () => confirmCharacter(overflow, draft(), now),
    ConfigurationError,
  );
});
