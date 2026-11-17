import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  SEAT_POOL_DEFINITIONS,
  poolsForRank,
  reservedSeats,
} from "../src/config/seats";
import { RANKS } from "../src/lib/gameConfig";
import {
  generateCharacter,
  generatePromotionRequirements,
  createAccount,
} from "../src/lib/characterGenerator";
import {
  applyForPromotion,
  runDueSeatRounds,
  releaseSeats,
  convertInnerCourtToHarem,
  convertInnerCourtWorld,
  compareApplications,
  seatBoard,
  seatState,
} from "../src/lib/seatEngine";
import { InMemoryGameRepository } from "../src/lib/repositories/InMemoryGameRepository";
import { MS_PER_GAME_DAY } from "../src/config/balance";
import { utc7Date } from "../src/lib/ap";
import { gameView, publicLog } from "../src/lib/publicState";
import type { SeatWorld } from "../src/types/seats";
import type { RuntimeState } from "../src/types/runtime";
const start = Date.parse("2026-11-17T00:00:00Z");
export function readyWorld(ranks = ["civil_8"]): SeatWorld {
  const season = {
    id: randomUUID(),
    name: "Test",
    scenarioCode: "dai-khanh-thien-nguyen",
    status: "ACTIVE" as const,
    seasonStartTimestamp: new Date(start).toISOString(),
    endedAt: null,
    fictional: true as const,
  };
  const serverNow = start + 400 * MS_PER_GAME_DAY;
  const states = ranks.map((rankId) => {
    const rank = RANKS[rankId],
      account = createAccount(randomUUID());
    account.lastApGrantDateUtc7 = utc7Date(serverNow);
    const c = generateCharacter(rank.branch, {
      id: randomUUID(),
      accountId: account.id,
      seasonId: season.id,
      now: new Date(start).toISOString(),
      gameYear: 1,
      random: () => 0,
    });
    Object.assign(c, {
      rankId,
      status: "ACTIVE",
      confirmedAt: new Date(start).toISOString(),
      rankEnteredAt: new Date(start).toISOString(),
      int: 1000,
      rep: 1000,
      fav: 1000,
      cha: 1000,
      hp: 100,
      suspicion: 0,
      characterSilver: 100,
      merit: 1000,
      examPassedForRankId: rank.nextRankId,
      examPassedGameDay: 400,
    });
    c.promotionRequirements = generatePromotionRequirements(
      c,
      rank.nextRankId ? RANKS[rank.nextRankId] : null,
      new Date(start).toISOString(),
      () => 0,
    );
    return {
      account,
      character: c,
      revision: 0,
      processedRequests: [],
      season,
      serverNow,
      usage: {},
      meritUsedToday: 0,
    } satisfies RuntimeState;
  });
  return {
    version: 0,
    lastRound: 57,
    season,
    serverNow,
    states,
    applications: [],
    assignments: [],
    rounds: [],
    history: [],
    requirements: states.flatMap((s) =>
      s.character.promotionRequirements
        ? [s.character.promotionRequirements]
        : [],
    ),
  };
}
const onePool = [{ key: "civil_7b", capacity: 1, rankIds: ["civil_7b"] }];
function apply(world: SeatWorld, index = 0) {
  return applyForPromotion(world, world.states[index].account.id, "APPLY", {
    random: () => 0,
  });
}
function due(world: SeatWorld, day = 406) {
  world.serverNow = start + day * MS_PER_GAME_DAY;
  return world;
}

test("every pool capacity matches AGENTS 5.1, shared Tam Thái and military-only Thái úy", async () => {
  const agents = await readFile(
    new URL("../AGENTS.md", import.meta.url),
    "utf8",
  );
  const sections = agents
    .slice(agents.indexOf("### 5.1."), agents.indexOf("### 5.2."))
    .split(/#### [A-D]\./)
    .slice(1);
  const branches = ["CIVIL", "MILITARY", "HAREM", "INNER_COURT"];
  let checked = 0;
  for (let i = 0; i < sections.length; i++)
    for (const line of sections[i]
      .split("\n")
      .filter((l) => /^\| (?:\*\*)?(?:\d+|—)/.test(l))) {
      const cells = line
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim().replaceAll("**", ""));
      const label = cells[1].replace(/ \*\(.*$/, "");
      const rank = Object.values(RANKS).find(
        (r) =>
          r.branch === branches[i] &&
          (r.name === label ||
            r.name.endsWith(label) ||
            label.endsWith(r.name)),
      );
      assert(rank, `Missing rank ${label}`);
      const capacityCell = cells[i < 2 || i === 3 ? 3 : 2];
      const expected =
        capacityCell === "Không giới hạn" ? null : Number(capacityCell);
      const pools = poolsForRank(rank.id);
      assert.equal(
        pools.length ? pools.reduce((n, p) => n + p.capacity, 0) : null,
        expected,
        rank.id,
      );
      checked++;
    }
  assert.equal(checked, 52);
  assert.deepEqual(
    poolsForRank("civil_1").map((p) => p.key),
    ["tam_thai"],
  );
  assert.deepEqual(
    poolsForRank("military_1").map((p) => p.key),
    ["tam_thai", "thai_uy"],
  );
  assert.equal(
    SEAT_POOL_DEFINITIONS.filter((p) => p.key === "tam_thai").length,
    1,
  );
  assert.throws(() => reservedSeats(onePool[0], { civil_7b: 2 }));
});
test("surplus wins one seat; losers WAITING, exact tie uses merit, time then ID", () => {
  let w = readyWorld(["civil_8", "civil_8"]);
  w.states[0].character!.int = 200;
  w = apply(apply(w).world, 1).world;
  const a = w.applications[0],
    b = w.applications[1];
  assert(compareApplications(b, a, w) < 0);
  const result = runDueSeatRounds(due(w), { pools: onePool, random: () => 0 });
  assert.equal(result.applications[0].status, "WAITING");
  assert.equal(result.applications[1].status, "PROMOTED");
  assert.equal(result.assignments.length, 1);
  w.states[0].character!.int = 1000;
  w.states[1].character!.merit = 1001;
  assert(compareApplications(b, a, w) < 0);
  w.states[1].character!.merit = 1000;
  a.createdAt = new Date(start).toISOString();
  assert(compareApplications(a, b, w) < 0);
  b.createdAt = a.createdAt;
  a.id = "a";
  b.id = "b";
  assert(compareApplications(a, b, w) < 0);
});
test("round replay is identical; missed rounds sequential; expiry and recheck reject falling stats", () => {
  let w = apply(readyWorld()).world;
  const held = {
    id: randomUUID(),
    characterId: randomUUID(),
    poolKey: "civil_7b",
    seatNumber: 1,
    rankId: "civil_7b",
    assignedAt: new Date(start).toISOString(),
    releasedAt: null,
  };
  w.assignments.push(held);
  w = runDueSeatRounds(due(w, 435), { pools: onePool });
  assert.deepEqual(
    w.rounds.map((r) => r.roundNumber),
    [58, 59, 60, 61, 62],
  );
  assert.equal(w.applications[0].status, "EXPIRED");
  assert.deepEqual(runDueSeatRounds(w, { pools: onePool }), w);
  w = apply(readyWorld()).world;
  w.states[0].character!.int = 0;
  w = runDueSeatRounds(due(w), { pools: onePool });
  assert.equal(w.applications[0].status, "REJECTED");
  assert.match(w.applications[0].reason!, /chỉ số/);
});
test("applications only join first boundary after submission; boundary exam validity, illness, suspicion and tenure are rechecked", () => {
  const original = apply(readyWorld()).world;
  original.applications[0].firstRound = 59;
  assert.equal(
    runDueSeatRounds(due(structuredClone(original)), { pools: onePool })
      .applications[0].status,
    "WAITING",
  );
  for (const mutate of [
    (s: RuntimeState) => {
      s.character!.status = "SEVERELY_ILL";
    },
    (s: RuntimeState) => {
      s.character!.suspicion = 80;
    },
    (s: RuntimeState) => {
      s.character!.merit = 0;
    },
    (s: RuntimeState) => {
      s.character!.rankEnteredAt = new Date(
        start + 405 * MS_PER_GAME_DAY,
      ).toISOString();
    },
    (s: RuntimeState) => {
      s.character!.examPassedGameDay = 300;
    },
  ]) {
    const w = structuredClone(original);
    w.applications[0].firstRound = 58;
    mutate(w.states[0]);
    assert.equal(
      runDueSeatRounds(due(w), { pools: onePool }).applications[0].status,
      "REJECTED",
    );
  }
});
test("unlimited pools promote immediately, clear exam, release old seat, lock next monotonic requirements; top has no next", () => {
  let w = readyWorld(["inner_1"]);
  w.assignments = [
    {
      id: randomUUID(),
      characterId: w.states[0].character!.id,
      poolKey: "old",
      seatNumber: 1,
      rankId: "inner_1",
      assignedAt: new Date(start).toISOString(),
      releasedAt: null,
    },
  ];
  w = apply(w).world;
  const c = w.states[0].character!;
  assert.equal(c.rankId, "inner_2");
  assert.equal(c.examPassedForRankId, null);
  assert(w.assignments[0].releasedAt);
  assert.equal(w.history.length, 1);
  for (const condition of c.promotionRequirements!.conditions) {
    const old = w.requirements[0].conditions.find(
      (x) => x.stat === condition.stat,
    );
    if (old && condition.stat !== "suspicion")
      assert(condition.value > old.value);
  }
  w = readyWorld(["civil_1b"]);
  w = apply(w).world;
  w = runDueSeatRounds(due(w), { random: () => 0 });
  assert.equal(w.states[0].character!.rankId, "civil_1");
  assert.equal(w.states[0].character!.promotionRequirements, null);
  assert.throws(() => apply(w), /cao nhất/);
});
test("finite promotion returns previous seat, reserved NPC seats cannot be claimed, release is idempotent", () => {
  let w = readyWorld();
  const charId = w.states[0].character!.id;
  w.assignments.push({
    id: randomUUID(),
    characterId: charId,
    poolKey: "old",
    seatNumber: 1,
    rankId: "civil_8",
    assignedAt: new Date(start).toISOString(),
    releasedAt: null,
  });
  w = apply(w).world;
  assert.equal(
    runDueSeatRounds(due(structuredClone(w)), {
      pools: onePool,
      reserved: { civil_7b: 1 },
    }).applications[0].status,
    "WAITING",
  );
  w = runDueSeatRounds(due(w), { pools: onePool });
  assert.equal(w.assignments.filter((a) => !a.releasedAt).length, 1);
  assert(w.assignments[0].releasedAt);
  const at = new Date(w.serverNow).toISOString(),
    released = releaseSeats(w.assignments, charId, at);
  assert(released.every((a) => a.releasedAt));
  assert.deepEqual(releaseSeats(released, charId, at), released);
});
test("conversion formula, guards, state preservation, withdrawal, release and superseded locked requirements", () => {
  for (const rankId of ["inner_2", "inner_4", "inner_5", "inner_6"])
    for (const [oldFav, newFav] of [
      [100, 60],
      [300, 120],
    ]) {
      const w = readyWorld([rankId]),
        before = w.states[0].character!;
      before.fav = oldFav;
      const at = new Date(w.serverNow).toISOString(),
        after = convertInnerCourtToHarem(before, at, () => 0).character;
      assert.equal(
        after.rankId,
        Number(rankId.slice(6)) >= 5 ? "harem_13" : "harem_14",
      );
      assert.equal(after.fav, newFav);
      assert.equal(after.rankEnteredAt, at);
      assert.equal(after.examPassedGameDay, null);
      for (const k of [
        "int",
        "rep",
        "cha",
        "hp",
        "characterSilver",
        "suspicion",
        "suspicionFloor",
        "merit",
      ] as const)
        assert.equal(after[k], before[k]);
    }
  for (const rank of ["inner_1", "inner_7", "inner_8", "civil_8"])
    assert.throws(() =>
      convertInnerCourtToHarem(
        readyWorld([rank]).states[0].character!,
        new Date(start).toISOString(),
      ),
    );
  for (const changes of [
    { cha: 149 },
    { int: 99 },
    { suspicion: 46 },
    { status: "SEVERELY_ILL" as const },
  ])
    assert.throws(() =>
      convertInnerCourtToHarem(
        { ...readyWorld(["inner_2"]).states[0].character!, ...changes },
        new Date(start).toISOString(),
      ),
    );
  let w = readyWorld(["inner_4"]);
  w = apply(w).world;
  const old = structuredClone(w.requirements[0]);
  w.assignments.push({
    id: randomUUID(),
    characterId: w.states[0].character!.id,
    poolKey: "inner_4",
    seatNumber: 1,
    rankId: "inner_4",
    assignedAt: new Date(start).toISOString(),
    releasedAt: null,
  });
  w = convertInnerCourtWorld(w, w.states[0].character!.id, { random: () => 0 });
  assert.equal(w.applications[0].status, "WITHDRAWN");
  assert(w.assignments[0].releasedAt);
  assert(w.requirements[0].supersededAt);
  assert.deepEqual(w.requirements[0].conditions, old.conditions);
  assert.equal(
    w.states[0].character!.promotionRequirements!.targetRankId,
    "harem_13",
  );
});
test("board/view/log contain no other player identity, score or hidden stat values", () => {
  const w = readyWorld();
  const rows = seatBoard(w);
  assert(
    rows.every((r) =>
      Object.keys(r).every(
        (k) => !["characterId", "accountId", "suspicion", "score"].includes(k),
      ),
    ),
  );
  const projected = gameView(seatState(w, w.states[0]));
  assert(!("suspicion" in projected.character!));
  const advanced = runDueSeatRounds(due(apply(w).world), { pools: onePool });
  assert(!("suspicion" in publicLog(advanced.history[0].journal).after));
});
test("InMemory APPLY replay, concurrent rounds, account cap, free withdrawal and initial ranks do not consume seats", async () => {
  let now = start;
  const repo = new InMemoryGameRepository(
    () => now,
    () => 0,
  );
  const ids = [randomUUID(), randomUUID()];
  for (const id of ids) {
    repo.registerAccount(id);
    let s = await repo.readState(id);
    s = await repo.setup(
      id,
      { type: "BEGIN", branch: "CIVIL" },
      s.revision,
      randomUUID(),
    );
    await repo.setup(id, { type: "CONFIRM" }, s.revision, randomUUID());
  }
  assert.equal(
    (await repo.seatBoard()).find((r) => r.rankId === "civil_8")!.occupied,
    0,
  );
  now = start + 400 * MS_PER_GAME_DAY;
  const internal = repo as unknown as { states: Map<string, RuntimeState> };
  for (const id of ids) {
    const c = internal.states.get(id)!.character!;
    Object.assign(c, {
      int: 1000,
      rep: 1000,
      fav: 1000,
      cha: 1000,
      hp: 100,
      characterSilver: 100,
      merit: 1000,
      examPassedForRankId: "civil_7b",
      examPassedGameDay: 400,
    });
  }
  const key = randomUUID();
  const [a, b] = await Promise.all([
    repo.act(ids[0], "APPLY", key),
    repo.act(ids[0], "APPLY", key),
  ]);
  assert.deepEqual(a, b);
  assert.equal((await repo.readState(ids[0])).usage.APPLY, 1);
  await repo.act(ids[0], "WITHDRAW", randomUUID());
  await repo.act(ids[0], "APPLY", randomUUID());
  assert.equal(
    (await repo.readState(ids[0])).seatApplication!.status,
    "WAITING",
  );
  await repo.act(ids[0], "WITHDRAW", randomUUID());
  await assert.rejects(
    () => repo.act(ids[0], "APPLY", randomUUID()),
    /hạn mức/,
  );
  await repo.act(ids[1], "APPLY", randomUUID());
  now = start + 406 * MS_PER_GAME_DAY;
  await Promise.all([
    repo.runDueSeatRounds(),
    repo.runDueSeatRounds(),
    repo.readState(ids[1]),
  ]);
  assert.equal((await repo.readState(ids[1])).character!.rankId, "civil_7b");
  const logs = await repo.logs(ids[1], 0);
  assert.equal(logs.filter((l) => l.promotion).length, 1);
  const before = await repo.readState(ids[1]);
  await repo.releaseSeats(before.character!.id);
  await repo.releaseSeats(before.character!.id);
  assert.equal(
    (await repo.seatBoard()).find((r) => r.rankId === "civil_7b")!.occupied,
    0,
  );
});

test("shared Tam Thái is one pool; military-only Thái úy cannot be taken by civil applicants", () => {
  let w = readyWorld([
    "civil_1b",
    "civil_1b",
    "civil_1b",
    "civil_1b",
    "military_1b",
  ]);
  for (let i = 0; i < w.states.length; i++) w = apply(w, i).world;
  w = runDueSeatRounds(due(w), { random: () => 0 });
  assert.equal(
    w.assignments.filter((a) => !a.releasedAt && a.poolKey === "tam_thai")
      .length,
    3,
  );
  const exclusive = w.assignments.find(
    (a) => !a.releasedAt && a.poolKey === "thai_uy",
  )!;
  assert.equal(exclusive.characterId, w.states[4].character!.id);
  assert.equal(w.applications.filter((a) => a.status === "WAITING").length, 1);
});
test("exact expiry between rounds, illness/duplicate guards and APPLY causal penalty cannot bypass checks", () => {
  let w = apply(readyWorld()).world;
  w.serverNow = Date.parse(w.applications[0].expiresAt);
  w.lastRound = Math.floor((w.serverNow - start) / (7 * MS_PER_GAME_DAY));
  assert.equal(runDueSeatRounds(w).applications[0].status, "EXPIRED");
  w = readyWorld();
  w.states[0].character!.status = "SEVERELY_ILL";
  assert.throws(() => apply(w), /trọng bệnh/);
  w = apply(readyWorld()).world;
  assert.throws(() => apply(w), /một đơn/);
  w = readyWorld();
  w.states[0].character!.characterSilver = 0;
  const before = w.states[0].character!.rep;
  w = apply(w).world;
  assert.equal(w.states[0].character!.rep, before - 5);
});

test("legacy thresholds outside the official next range fail closed without changing R or blocking other applicants", () => {
  let w = readyWorld(["harem_0"]);
  w.states[0].character!.promotionRequirements!.tableVersion = "legacy";
  w.states[0].character!.promotionRequirements!.conditions[0].value = 60;
  const before = structuredClone(w);
  assert.throws(() => apply(w), /Điều kiện thăng phẩm đã khóa/);
  assert.deepEqual(w, before);
  w = readyWorld(["civil_8", "civil_8"]);
  // C1 fav=60 was permitted by M1, but next official rank only allows 15..25.
  w.requirements[0].tableVersion = "legacy";
  w.requirements[0].conditions[2] = { stat: "fav", operator: ">=", value: 60 };
  w.states[0].character!.promotionRequirements = w.requirements[0];
  w.states[0].character!.merit = 1001;
  w.states[1].character!.fav = 0;
  w = apply(apply(w).world, 1).world;
  w = runDueSeatRounds(due(w), { pools: onePool, random: () => 0 });
  assert.equal(w.applications[0].status, "REJECTED");
  assert.match(w.applications[0].reason!, /Điều kiện thăng phẩm đã khóa/);
  assert.equal(w.applications[1].status, "PROMOTED");
  assert.equal(w.assignments.length, 1);
  assert.equal(w.assignments[0].characterId, w.states[1].character!.id);
  assert.equal(w.requirements[0].conditions[2].value, 60);
});

test("normalized scoring uses absolute negative thresholds and favors lower suspicion", () => {
  const w = readyWorld(["civil_8", "civil_8"]);
  for (const state of w.states) {
    state.character!.promotionRequirements!.conditions = [
      { stat: "int", operator: ">=", value: 100 },
      { stat: "fav", operator: ">=", value: -20 },
      { stat: "suspicion", operator: "<=", value: 60 },
    ];
  }
  const a = apply(w).world;
  const both = apply(a, 1).world;
  both.states[0].character!.suspicion = 50;
  both.states[1].character!.suspicion = 10;
  assert(
    compareApplications(both.applications[1], both.applications[0], both) < 0,
  );
});
