import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  benchmarkDelta,
  benchmarkRange,
  PROMOTION_BENCHMARKS,
  validatePromotionBenchmarks,
  SUSPICION_REQUIREMENT_RANGES,
} from "../src/config/promotionBenchmarks";
import {
  generateCharacter,
  generatePromotionRequirements,
  confirmCharacter,
  createAccount,
  ConfigurationError,
} from "../src/lib/characterGenerator";
import { RANKS, INITIAL_RANKS, PROMOTION_STATS } from "../src/lib/gameConfig";
import { BRANCHES, type Branch, type RankTier } from "../src/types/game";
import {
  evaluatePromotionEligibility,
  promotionWorldTime,
  publicPromotion,
} from "../src/lib/promotionEligibility";
import { examProbability } from "../src/lib/exam";
import { InMemoryGameRepository } from "../src/lib/repositories/InMemoryGameRepository";
import { MS_PER_GAME_DAY, REAL_DAY_MS } from "../src/config/balance";
import type { RuntimeState } from "../src/types/runtime";
const start = Date.parse("2026-11-16T00:00:00Z");
const context = {
  id: "00000000-0000-4000-8000-000000000003",
  accountId: "00000000-0000-4000-8000-000000000002",
  seasonId: "00000000-0000-4000-8000-000000000001",
  now: new Date(start).toISOString(),
  gameYear: 1,
  random: () => 0,
};
function draft(branch: Branch = "CIVIL") {
  return generateCharacter(branch, context);
}
function ready() {
  const c = confirmCharacter(
    { ...createAccount(context.accountId) },
    draft(),
    context.now,
    () => 0,
  ).character;
  c.int = 200;
  c.rep = 200;
  c.fav = 200;
  c.cha = 200;
  c.hp = 100;
  c.merit = 100;
  return c;
}
function seeded(seed = 2) {
  let s = seed;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}
function world(day: number) {
  return promotionWorldTime(start + day * MS_PER_GAME_DAY, start);
}
test("official delta/ranges: examples, signed fav and inclusive clamp", () => {
  for (const [b, d] of [
    [-20, 5],
    [0, 5],
    [90, 5],
    [135, 10],
    [355, 12],
    [740, 15],
    [960, 15],
  ])
    assert.equal(benchmarkDelta(b), d);
  for (const [b, min, max] of [
    [355, 343, 367],
    [90, 85, 95],
    [135, 125, 145],
    [740, 725, 755],
    [-20, -25, -15],
    [0, -5, 5],
    [960, 945, 975],
  ])
    assert.deepEqual(benchmarkRange("fav", b), [min, max]);
  assert.deepEqual(benchmarkRange("int", 0), [0, 5]);
  assert.deepEqual(benchmarkRange("fav", -100), [-100, -95]);
  assert.deepEqual(benchmarkRange("cha", 1000), [985, 1000]);
});
test("catalog validates target monotonicity, complete tiers, mapping and all 52 ranks; bad config throws", () => {
  validatePromotionBenchmarks(PROMOTION_BENCHMARKS);
  assert.equal(Object.keys(RANKS).length, 52);
  assert.equal(RANKS.military_7b.benchmarks.int, 90);
  assert.equal(RANKS.civil_5.benchmarks.int, 355);
  assert.equal(RANKS.harem_1.benchmarks.fav, 950);
  assert.equal(RANKS.inner_8.benchmarks.int, 850);
  for (const mutate of [
    (t: typeof PROMOTION_BENCHMARKS) => {
      t.CIVIL[2].benchmarks.int = 90;
    },
    (t: typeof PROMOTION_BENCHMARKS) => {
      t.CIVIL[0].tier = undefined as unknown as RankTier;
    },
    (t: typeof PROMOTION_BENCHMARKS) => {
      t.MILITARY[0].name = "Chính bát phẩm";
    },
  ]) {
    const t = structuredClone(PROMOTION_BENCHMARKS);
    mutate(t);
    assert.throws(() => validatePromotionBenchmarks(t), ConfigurationError);
  }
  assert.throws(
    () =>
      validatePromotionBenchmarks(PROMOTION_BENCHMARKS, {
        civil_8: { id: "civil_8", name: "Wrong", branch: "CIVIL" },
      }),
    ConfigurationError,
  );
  // Starting rows have no generated R: Cung tuyển and Mỹ nhân touch at rep=20/int=40.
  assert.equal(benchmarkRange("rep", 15)[1], benchmarkRange("rep", 25)[0]);
});
test("seeded 10,000 samples per branch: three distinct conditions, fixed A/B, 40/40/20, never HP or silver", () => {
  for (const branch of BRANCHES) {
    const rng = seeded(42),
      c = draft(branch),
      target = RANKS[INITIAL_RANKS[branch].nextRankId!];
    const [a, b, c1, c2] = PROMOTION_STATS[branch];
    const counts: Record<string, number> = {};
    for (let i = 0; i < 10000; i++) {
      const r = generatePromotionRequirements(c, target, context.now, rng);
      assert.equal(r.tableVersion, "v1");
      assert.equal(r.conditions.length, 3);
      assert.equal(r.conditions[0].stat, a);
      assert.equal(r.conditions[1].stat, b);
      assert.equal(new Set(r.conditions.map((x) => x.stat)).size, 3);
      const third = r.conditions[2];
      assert(!["hp", "characterSilver"].includes(third.stat));
      counts[third.stat] = (counts[third.stat] ?? 0) + 1;
      assert.equal(third.operator, third.stat === "suspicion" ? "<=" : ">=");
    }
    for (const [stat, p] of [
      [c1, 0.4],
      [c2, 0.4],
      ["suspicion", 0.2],
    ] as const)
      assert(Math.abs(counts[stat] / 10000 - p) < 0.02, `${branch} ${stat}`);
  }
});
test("suspicion tier bounds, floor +5 headroom at creation and future unreachable warning", () => {
  for (const tier of [1, 2, 3, 4, 5] satisfies RankTier[])
    for (const edge of [0, 0.99999]) {
      let n = 0;
      const r = generatePromotionRequirements(
        draft(),
        { ...RANKS.civil_7b, tier },
        context.now,
        () => (n++ === 0 ? 0.99 : edge),
      );
      assert.equal(
        r.conditions[2].value,
        SUSPICION_REQUIREMENT_RANGES[tier][edge === 0 ? 0 : 1],
      );
    }
  const c = ready();
  c.suspicionFloor = 90;
  c.suspicion = 90;
  const req = generatePromotionRequirements(
    c,
    RANKS.civil_7b,
    context.now,
    () => 0.99,
  );
  assert.equal(req.conditions[2].value, 95);
  c.suspicionFloor = 100;
  c.suspicion = 100;
  const capped = generatePromotionRequirements(
    c,
    RANKS.civil_7b,
    context.now,
    () => 0.99,
  );
  assert.equal(capped.conditions[2].value, 100);
  c.suspicionFloor = 96;
  const p = evaluatePromotionEligibility(c, req, world(30));
  assert(p.conditions[2].unreachable);
  assert(!p.eligibleForExam);
  assert.equal(publicPromotion(p).conditions[2].current, null);
  c.suspicionFloor = 10;
  c.suspicion = 97;
  const reachable = evaluatePromotionEligibility(c, req, world(30));
  assert(!reachable.conditions[2].unreachable);
  assert.match(reachable.conditions[2].hint!, /Dẹp tin đồn/);
});
test("standard starting distributions never gain entry minima; higher scenario rank only raises four growth stats", () => {
  for (const branch of BRANCHES) {
    const c = draft(branch);
    assert.equal(c.int, branch === "INNER_COURT" ? 35 : 45);
    assert.equal(c.rep, branch === "INNER_COURT" ? 5 : 15);
    assert.equal(c.fav, branch === "CIVIL" || branch === "MILITARY" ? -20 : 0);
  }
  assert(draft("MILITARY").int < 90);
  assert(draft("MILITARY").rep < 60);
  const base = draft("HAREM");
  const higher = generateCharacter("HAREM", {
    ...context,
    initialRank: RANKS.harem_14,
  });
  assert.equal(higher.fav, 15);
  assert.equal(higher.rep, 20);
  assert.equal(higher.cha, 55);
  assert.equal(higher.hp, base.hp);
  assert.equal(higher.characterSilver, base.characterSilver);
  assert.equal(higher.suspicion, base.suspicion);
});
test("highest ranks confirm without next requirements; evaluation does not offer exam/apply", () => {
  for (const rank of [
    RANKS.civil_1,
    RANKS.military_1,
    RANKS.harem_1,
    RANKS.inner_8,
  ]) {
    const c = generateCharacter(rank.branch, { ...context, initialRank: rank });
    const result = confirmCharacter(
      createAccount(context.accountId),
      c,
      context.now,
    );
    assert.equal(result.character.promotionRequirements, null);
    const p = evaluatePromotionEligibility(result.character, null, world(400));
    assert.equal(p.targetRankId, null);
    assert(!p.eligibleForExam);
    assert(!p.eligibleToApply);
  }
  assert.equal(generatePromotionRequirements(draft(), null, context.now), null);
});
test("eligibility: each condition, precise elapsed tenure, merit, investigation, exam expiry/target, UNKNOWN seats", () => {
  const high = confirmCharacter(createAccount(context.accountId),generateCharacter('INNER_COURT',{...context,initialRank:RANKS.inner_7}),context.now,()=>0).character;
  const highProgress = evaluatePromotionEligibility(high,high.promotionRequirements,world(300));
  assert.equal(highProgress.tenure.required,240); // Current tier 4.
  assert.equal(highProgress.merit.required,300); // Target tier 5.
  const c = ready(),
    r = c.promotionRequirements!;
  let p = evaluatePromotionEligibility(c, r, world(29));
  assert(!p.tenure.passed);
  assert(!p.eligibleForExam);
  p = evaluatePromotionEligibility(c, r, world(30));
  assert(p.eligibleForExam);
  assert(!p.eligibleToApply);
  assert.equal(p.seatAvailable, "UNKNOWN");
  for (const stat of ["int", "rep", "fav"] as const) {
    const bad = { ...c, [stat]: -100 };
    assert(!evaluatePromotionEligibility(bad, r, world(30)).eligibleForExam);
  }
  assert(
    !evaluatePromotionEligibility({ ...c, merit: 9 }, r, world(30)).merit
      .passed,
  );
  assert(
    evaluatePromotionEligibility({ ...c, suspicion: 80 }, r, world(30))
      .underInvestigation,
  );
  const passed = {
    ...c,
    examPassedForRankId: r.targetRankId,
    examPassedGameDay: 30,
  };
  assert(evaluatePromotionEligibility(passed, r, world(89)).eligibleToApply);
  assert(!evaluatePromotionEligibility(passed, r, world(90)).exam.valid);
  assert(
    !evaluatePromotionEligibility(
      { ...passed, examPassedForRankId: "wrong" },
      r,
      world(31),
    ).exam.valid,
  );
  const shifted = { ...c, rankEnteredAt: new Date(start + 1000).toISOString() };
  assert.equal(
    evaluatePromotionEligibility(shifted, r, world(30)).tenure.current,
    29,
  );
  const negative = {
    ...r,
    conditions: [
      { stat: "int" as const, operator: ">=" as const, value: 1 },
      { stat: "rep" as const, operator: ">=" as const, value: 1 },
      { stat: "fav" as const, operator: ">=" as const, value: -5 },
    ] as typeof r.conditions,
  };
  assert(
    evaluatePromotionEligibility({ ...c, fav: -5 }, negative, world(30))
      .conditions[2].passed,
  );
});
test("legacy HP/silver threshold is kept but cannot become a promotion gate", () => {
  const c = ready();
  const r = structuredClone(c.promotionRequirements!);
  r.tableVersion = "legacy";
  r.conditions[2] = { stat: "hp", operator: ">=", value: 100 };
  const p = evaluatePromotionEligibility({ ...c, hp: 10 }, r, world(30));
  assert(p.conditions[2].ignored);
  assert(p.eligibleForExam);
  assert.equal(publicPromotion(p).conditions[2].current, null);
});
test("exam probability bounds and low-HP failure penalty use pre-cost stats", () => {
  assert.equal(examProbability({ int: 0, hp: 0 }), 0.05);
  assert.equal(examProbability({ int: 1000, hp: 100 }), 0.95);
  assert(Math.abs(examProbability({ int: 0, hp: 20 }) - 0.4) < 1e-12);
  assert(
    Math.abs(
      examProbability({ int: 100, hp: 19 }) - (0.35 + 0.05 + 0.0475 - 0.3),
    ) < 1e-12,
  );
});
async function fixture(draw = 0) {
  let now = start;
  const repo = new InMemoryGameRepository(
    () => now,
    () => draw,
  );
  const id = randomUUID();
  repo.registerAccount(id);
  let s = await repo.readState(id);
  s = await repo.setup(
    id,
    { type: "BEGIN", branch: "CIVIL" },
    s.revision,
    randomUUID(),
  );
  s = await repo.setup(id, { type: "CONFIRM" }, s.revision, randomUUID());
  return {
    repo,
    id,
    advance: (ms: number) => {
      now += ms;
    },
    inject: (change: (s: RuntimeState) => void) => {
      const internal = repo as unknown as { states: Map<string, RuntimeState> };
      const state = internal.states.get(id)!;
      change(state);
    },
  };
}
test("merit cap is account/day scoped, partial credits, zero-gain actions still execute and cap resets", async () => {
  const { repo, id, advance } = await fixture();
  for (let i = 0; i < 3; i++) await repo.act(id, "AUDIENCE", randomUUID());
  await repo.act(id, "STUDY", randomUUID());
  const last = await repo.act(id, "WORK", randomUUID());
  assert.equal(last.log.meritGained, 1);
  assert.equal(last.log.meritAfter, 8);
  const capped = await repo.act(id, "WORK", randomUUID());
  assert.equal(capped.log.meritGained, 0);
  assert(capped.log.after.characterSilver > capped.log.before.characterSilver);
  advance(REAL_DAY_MS);
  const next = await repo.act(id, "STUDY", randomUUID());
  assert.equal(next.log.meritGained, 1);
  assert.equal(next.log.meritAfter, 9);
});
test("EXAM locked until prerequisites; successful/failed records are immutable under retries and dailyCap=2", async () => {
  for (const draw of [0, 0.999999]) {
    const { repo, id, advance, inject } = await fixture(draw);
    await assert.rejects(() => repo.act(id, "EXAM", randomUUID()), /chỉ số/);
    inject((s) => {
      s.character = {
        ...s.character!,
        int: 300,
        rep: 300,
        fav: 300,
        cha: 300,
        merit: 20,
        hp: 100,
      };
    });
    advance(30 * MS_PER_GAME_DAY);
    const before = await repo.readState(id),
      locked = structuredClone(before.character!.promotionRequirements);
    const key = randomUUID();
    const [a, b] = await Promise.all([
      repo.act(id, "EXAM", key),
      repo.act(id, "EXAM", key),
    ]);
    assert.deepEqual(a, b);
    assert.equal(a.log.apSpent, 2);
    assert.equal(a.log.after.hp, 97);
    assert.equal(a.log.exam?.success, draw === 0);
    const state = await repo.readState(id);
    assert.deepEqual(state.character!.promotionRequirements, locked);
    assert.equal(
      state.character!.examPassedForRankId,
      draw === 0 ? locked!.targetRankId : null,
    );
    await repo.act(id, "EXAM", randomUUID());
    assert.deepEqual(await repo.act(id, "EXAM", key), a);
    await assert.rejects(() => repo.act(id, "EXAM", randomUUID()), /hạn mức/);
    assert.equal(
      (await repo.readState(id)).account.actionPoints,
      before.account.actionPoints - 4,
    );
  }
});
