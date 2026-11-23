import {
  APPLICATION_EXPIRY_GAME_DAYS,
  DAYS_PER_GAME_WEEK,
  MS_PER_GAME_DAY,
} from "@/config/balance";
import {
  poolsForRank,
  reservedSeats,
  SEAT_POOL_DEFINITIONS,
  STARTING_RANK_IDS,
  type SeatPoolDefinition,
} from "@/config/seats";
import type { Character, LongTermStat } from "@/types/game";
import type { RuntimeState, ActionLog, ActionResult } from "@/types/runtime";
import type {
  SeatWorld,
  SeatApplication,
  SeatAssignment,
  SeatBoardRow,
  ConvertedCharacter,
} from "@/types/seats";
import {
  generatePromotionRequirements,
  GameRuleError,
  ConfigurationError,
  type RandomSource,
} from "./characterGenerator";
import { RANKS } from "./gameConfig";
import {
  evaluatePromotionEligibility,
  promotionWorldTime,
} from "./promotionEligibility";
import { processAction, statsOf } from "./actionProcessor";
import { getRiskModifiers } from "./statEngine";
import { getWorldTime } from "./worldClock";
import { grantPromotionTitle } from "./cosmeticRules";

export interface SeatEngineOptions {
  random?: RandomSource;
  id?: () => string;
  pools?: readonly SeatPoolDefinition[];
  reserved?: Record<string, number>;
}
const weekMs = DAYS_PER_GAME_WEEK * MS_PER_GAME_DAY;
export function dueRound(
  world: Pick<SeatWorld, "serverNow" | "season">,
): number {
  return Math.floor(
    Math.max(
      0,
      world.serverNow - Date.parse(world.season.seasonStartTimestamp),
    ) / weekMs,
  );
}
export function nextSeatRoundAt(
  world: Pick<SeatWorld, "serverNow" | "season">,
): number {
  return (
    Date.parse(world.season.seasonStartTimestamp) +
    (dueRound(world) + 1) * weekMs
  );
}
export function latestApplication(
  world: SeatWorld,
  characterId: string,
): SeatApplication | null {
  return (
    world.applications
      .filter((a) => a.characterId === characterId)
      .sort(
        (a, b) =>
          b.submittedRevision - a.submittedRevision ||
          Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
          b.id.localeCompare(a.id),
      )[0] ?? null
  );
}
export function seatState(world: SeatWorld, state: RuntimeState): RuntimeState {
  const app = state.character
    ? latestApplication(world, state.character.id)
    : null;
  const visible = app
    ? (({ accountId, characterId, seasonId, submittedRevision, ...rest }) => {
        void accountId;
        void characterId;
        void seasonId;
        void submittedRevision;
        return rest;
      })(app)
    : null;
  return {
    ...state,
    serverNow: world.serverNow,
    seatApplication: visible,
    nextSeatRoundAt: nextSeatRoundAt(world),
    seatBoard: seatBoard(world),
  };
}
export function seatBoard(
  world: SeatWorld,
  options: SeatEngineOptions = {},
): SeatBoardRow[] {
  const definitions = options.pools ?? SEAT_POOL_DEFINITIONS;
  return Object.values(RANKS).map((rank) => {
    const pools = poolsForRank(rank.id, definitions),
      keys = pools.map((p) => p.key);
    const total = pools.length
      ? pools.reduce((n, p) => n + p.capacity, 0)
      : null;
    const occupied = world.assignments.filter(
      (a) => !a.releasedAt && keys.includes(a.poolKey),
    ).length;
    const reserved = pools.reduce(
      (n, p) => n + reservedSeats(p, options.reserved),
      0,
    );
    return {
      rankId: rank.id,
      name: rank.name,
      branch: rank.branch,
      total,
      occupied,
      reserved,
      available:
        total === null ? null : Math.max(0, total - occupied - reserved),
      waiting: world.applications.filter(
        (a) => a.targetRankId === rank.id && a.status === "WAITING",
      ).length,
      starting: STARTING_RANK_IDS[rank.branch] === rank.id,
    };
  });
}
/** Pure, idempotent release. The caller persists the returned assignments atomically. */
export function releaseSeats(
  assignments: readonly SeatAssignment[],
  characterId: string,
  at: string,
): SeatAssignment[] {
  return assignments.map((a) =>
    a.characterId === characterId && !a.releasedAt
      ? { ...a, releasedAt: at }
      : { ...a },
  );
}
function previousThresholds(
  world: SeatWorld,
  c: Character,
): Partial<Record<LongTermStat, number>> {
  const previous: Partial<Record<LongTermStat, number>> = {};
  for (const r of world.requirements.filter(
    (r) => r.characterId === c.id && RANKS[r.targetRankId]?.branch === c.branch,
  ))
    for (const condition of r.conditions) {
      const stat = condition.stat;
      if (stat === "int" || stat === "rep" || stat === "fav" || stat === "cha")
        previous[stat] = Math.max(previous[stat] ?? -Infinity, condition.value);
    }
  return previous;
}
function systemLog(
  state: RuntimeState,
  before: Character,
  at: string,
  id: string,
  conversion = false,
): ActionLog {
  const c = state.character!;
  return {
    id,
    accountId: state.account.id,
    characterId: c.id,
    actionCode: "APPLY",
    createdAt: at,
    before: statsOf(before),
    after: statsOf(c),
    apSpent: 0,
    apAfter: state.account.actionPoints,
    modifiers: {
      ...getRiskModifiers(c),
      fatigueMultiplier: 1,
      resonanceMultiplier: 1,
    },
    worldTime: getWorldTime(
      Date.parse(at),
      Date.parse(state.season.seasonStartTimestamp),
    ),
    promotion: { fromRankId: before.rankId, toRankId: c.rankId, conversion },
    meritGained: 0,
    meritAfter: c.merit,
  };
}
class PromotionHistoryConflict extends GameRuleError {}
function promote(
  world: SeatWorld,
  app: SeatApplication,
  pool: SeatPoolDefinition | undefined,
  options: SeatEngineOptions,
): void {
  const state = world.states.find((s) => s.character?.id === app.characterId)!;
  const before = structuredClone(state.character!);
  const at = new Date(world.serverNow).toISOString();
  const id = options.id ?? (() => crypto.randomUUID());
  const rank = RANKS[app.targetRankId];
  const c: Character = {
    ...before,
    rankId: rank.id,
    rankEnteredAt: at,
    examPassedForRankId: null,
    examPassedGameDay: null,
  };
  try {
    c.promotionRequirements = generatePromotionRequirements(
      c,
      rank.nextRankId ? RANKS[rank.nextRankId] : null,
      at,
      options.random,
      previousThresholds(world, c),
    );
  } catch (error) {
    // TODO(spec): legacy temporary R may exceed the official next range; preserve it and fail this application only.
    if (
      error instanceof ConfigurationError &&
      error.message === "Ngưỡng trước vượt khoảng phẩm mục tiêu."
    )
      throw new PromotionHistoryConflict(
        "Điều kiện thăng phẩm đã khóa không tương thích với phẩm kế tiếp. Vui lòng liên hệ quản trị.",
      );
    throw error;
  }
  if (pool) {
    const used = new Set(
      world.assignments
        .filter((a) => a.poolKey === pool.key && !a.releasedAt)
        .map((a) => a.seatNumber),
    );
    const slot = Array.from(
      { length: pool.capacity - reservedSeats(pool, options.reserved) },
      (_, i) => i + 1,
    ).find((n) => !used.has(n));
    if (slot === undefined) throw new GameRuleError("Không còn ghế trống.");
    world.assignments = releaseSeats(world.assignments, before.id, at);
    world.assignments.push({
      id: id(),
      characterId: before.id,
      poolKey: pool.key,
      seatNumber: slot,
      rankId: app.targetRankId,
      assignedAt: at,
      releasedAt: null,
    });
  } else world.assignments = releaseSeats(world.assignments, before.id, at);
  if (c.promotionRequirements) world.requirements.push(c.promotionRequirements);
  state.character = c;
  state.revision++;
  app.status = "PROMOTED";
  app.reason = null;
  const log = systemLog(state, before, at, id());
  const title = grantPromotionTitle(state, rank.id, at, options.random);
  if (title) log.titleGrant = title;
  world.history.push({
    id: log.id,
    accountId: state.account.id,
    characterId: c.id,
    fromRankId: before.rankId,
    toRankId: c.rankId,
    fromBranch: before.branch,
    toBranch: c.branch,
    createdAt: at,
    reason: "PROMOTION",
    journal: log,
  });
}
/** Exact rational scoring avoids floating-point ties depending on condition order. */
function score(c: Character): [bigint, bigint] {
  let n = 0n,
    d = 1n;
  for (const r of c.promotionRequirements!.conditions) {
    if (r.stat === "hp" || r.stat === "characterSilver") continue;
    const numerator = BigInt(
      r.operator === ">=" ? c[r.stat] - r.value : r.value - c[r.stat],
    );
    const denominator = BigInt(
      Math.max(1, r.operator === ">=" ? Math.abs(r.value) : r.value),
    );
    n = n * denominator + numerator * d;
    d *= denominator;
  }
  return [n, d];
}
export function compareApplications(
  a: SeatApplication,
  b: SeatApplication,
  world: SeatWorld,
): number {
  const ca = world.states.find(
      (s) => s.character?.id === a.characterId,
    )!.character!,
    cb = world.states.find(
      (s) => s.character?.id === b.characterId,
    )!.character!;
  const [an, ad] = score(ca),
    [bn, bd] = score(cb),
    difference = an * bd - bn * ad;
  return difference !== 0n
    ? difference > 0n
      ? -1
      : 1
    : cb.merit - ca.merit ||
        Date.parse(a.createdAt) - Date.parse(b.createdAt) ||
        a.id.localeCompare(b.id);
}
function invalidReason(
  world: SeatWorld,
  app: SeatApplication,
  boundary: number,
): string | null {
  const state = world.states.find((s) => s.character?.id === app.characterId),
    c = state?.character;
  if (
    !c ||
    c.rankId !== app.sourceRankId ||
    c.promotionRequirements?.targetRankId !== app.targetRankId
  )
    return "Phẩm trật hoặc phẩm mục tiêu đã thay đổi.";
  const p = evaluatePromotionEligibility(
    c,
    c.promotionRequirements,
    promotionWorldTime(boundary, Date.parse(world.season.seasonStartTimestamp)),
  );
  return p.eligibleToApply
    ? null
    : (p.examBlockReason ?? "Khảo hạch đã hết hiệu lực hoặc chưa có hiệu lực.");
}
/** TODO(spec): missed rounds use current stats at the historical boundary; tenure starts at actual processing time. */
export function runDueSeatRounds(
  input: SeatWorld,
  options: SeatEngineOptions = {},
): SeatWorld {
  const world = structuredClone(input);
  if (world.season.status !== "ACTIVE") return world;
  const recordedRounds = new Set(
    world.rounds.map((r) => `${r.poolKey}:${r.roundNumber}`),
  );
  // TODO(spec): military-only capacity is filled before the shared Tam Thái pool.
  const pools = [...(options.pools ?? SEAT_POOL_DEFINITIONS)].sort(
    (a, b) => a.rankIds.length - b.rankIds.length || a.key.localeCompare(b.key),
  );
  for (let round = world.lastRound + 1; round <= dueRound(world); round++) {
    const boundary =
      Date.parse(world.season.seasonStartTimestamp) + round * weekMs;
    for (const pool of pools) {
      const roundKey = `${pool.key}:${round}`;
      if (recordedRounds.has(roundKey)) continue;
      const waiting = world.applications.filter(
        (a) =>
          a.status === "WAITING" &&
          a.firstRound <= round &&
          Date.parse(a.createdAt) <= boundary &&
          pool.rankIds.includes(a.targetRankId),
      );
      const valid: SeatApplication[] = [];
      for (const a of waiting) {
        if (Date.parse(a.expiresAt) <= boundary) {
          a.status = "EXPIRED";
          a.reason = `Đơn đã hết hạn sau ${APPLICATION_EXPIRY_GAME_DAYS} ngày game.`;
          continue;
        }
        const reason = invalidReason(world, a, boundary);
        if (reason) {
          a.status = "REJECTED";
          a.reason = reason;
        } else valid.push(a);
      }
      valid.sort((a, b) => compareApplications(a, b, world));
      let available =
        pool.capacity -
        reservedSeats(pool, options.reserved) -
        world.assignments.filter((a) => !a.releasedAt && a.poolKey === pool.key)
          .length;
      for (const a of valid) {
        if (available <= 0) break;
        try {
          promote(world, a, pool, options);
          available--;
        } catch (error) {
          if (!(error instanceof PromotionHistoryConflict)) throw error;
          a.status = "REJECTED";
          a.reason = error.message;
        }
      }
      recordedRounds.add(roundKey);
      world.rounds.push({
        poolKey: pool.key,
        roundNumber: round,
        boundaryAt: new Date(boundary).toISOString(),
        processedAt: new Date(world.serverNow).toISOString(),
      });
    }
    world.lastRound = round;
  }
  // A request between weekly boundaries still observes the exact expiry deadline.
  for (const a of world.applications)
    if (a.status === "WAITING" && Date.parse(a.expiresAt) <= world.serverNow) {
      a.status = "EXPIRED";
      a.reason = `Đơn đã hết hạn sau ${APPLICATION_EXPIRY_GAME_DAYS} ngày game.`;
    }
  return world;
}
export function applyForPromotion(
  input: SeatWorld,
  accountId: string,
  code: "APPLY" | "WITHDRAW",
  options: SeatEngineOptions = {},
): { world: SeatWorld; result: ActionResult } {
  const world = structuredClone(input);
  const index = world.states.findIndex((s) => s.account.id === accountId);
  if (index < 0) throw new GameRuleError("Tài khoản không tồn tại.");
  const state = seatState(world, world.states[index]),
    c = state.character;
  if (!c) throw new GameRuleError("Bạn chưa xác nhận thân phận.");
  const id = options.id ?? (() => crypto.randomUUID());
  const active = world.applications.find(
    (a) => a.characterId === c.id && a.status === "WAITING",
  );
  if (code === "WITHDRAW" && !active)
    throw new GameRuleError("Không có đơn đang chờ để rút.");
  const { state: next, log } = processAction(state, code, id(), options.random);
  world.states[index] = next;
  let message = "Đã rút đơn. Không tốn AP.";
  if (code === "WITHDRAW") {
    active!.status = "WITHDRAWN";
    active!.reason = "Người chơi đã rút đơn.";
  } else {
    // TODO(spec): APPLY pays AP and therefore inherits the poverty penalty; immediate promotion rechecks afterward.
    const app: SeatApplication = {
      id: id(),
      accountId,
      characterId: c.id,
      seasonId: world.season.id,
      sourceRankId: c.rankId,
      targetRankId: c.promotionRequirements!.targetRankId,
      status: "WAITING",
      createdAt: new Date(world.serverNow).toISOString(),
      expiresAt: new Date(
        world.serverNow + APPLICATION_EXPIRY_GAME_DAYS * MS_PER_GAME_DAY,
      ).toISOString(),
      firstRound: dueRound(world) + 1,
      submittedRevision: state.revision + 1,
      reason: null,
    };
    world.applications.push(app);
    if (
      !poolsForRank(app.targetRankId, options.pools ?? SEAT_POOL_DEFINITIONS)
        .length
    ) {
      // Recheck after the causal stat change so payment cannot bypass an eligibility threshold.
      const reason = invalidReason(world, app, world.serverNow);
      if (reason) throw new GameRuleError(reason);
      promote(world, app, undefined, options);
      message = "Đã thăng phẩm ngay tại phẩm không giới hạn ghế.";
    } else message = "Đã nộp đơn, chờ phiên xét duyệt tuần kế tiếp.";
  }
  const result = { log, message };
  return { world, result };
}
/** No endpoint uses this function. Chặng 4 will supply the event trigger. */
export function convertInnerCourtToHarem(
  character: Character,
  at: string,
  random?: RandomSource,
): ConvertedCharacter {
  const rankNumber = Number(character.rankId.replace("inner_", ""));
  if (
    character.branch !== "INNER_COURT" ||
    rankNumber < 2 ||
    rankNumber > 6 ||
    !Number.isInteger(rankNumber) ||
    character.status !== "ACTIVE" ||
    character.actionLocked
  )
    throw new GameRuleError(
      "Chỉ Nội cung Cấp 2 đến Cấp 6 đang hoạt động mới được chuyển nhánh.",
    );
  if (character.cha < 150 || character.int < 100 || character.suspicion > 45)
    throw new GameRuleError(
      "Chưa đạt điều kiện bảo vệ cho sự kiện chuyển nhánh.",
    );
  const rank = RANKS[rankNumber >= 5 ? "harem_13" : "harem_14"];
  const next: Character = {
    ...character,
    branch: "HAREM",
    rankId: rank.id,
    fav: Math.min(120, Math.floor(0.35 * character.fav) + 25),
    rankEnteredAt: at,
    examPassedForRankId: null,
    examPassedGameDay: null,
  };
  next.promotionRequirements = generatePromotionRequirements(
    next,
    RANKS[rank.nextRankId!],
    at,
    random,
  );
  return { character: next, requirements: next.promotionRequirements };
}
export function convertInnerCourtWorld(
  input: SeatWorld,
  characterId: string,
  options: SeatEngineOptions = {},
): SeatWorld {
  const world = structuredClone(input),
    state = world.states.find((s) => s.character?.id === characterId);
  if (!state?.character) throw new GameRuleError("Không tìm thấy nhân vật.");
  const before = state.character,
    at = new Date(world.serverNow).toISOString();
  state.character = convertInnerCourtToHarem(
    before,
    at,
    options.random,
  ).character;
  state.revision++;
  world.assignments = releaseSeats(world.assignments, characterId, at);
  world.applications
    .filter((a) => a.characterId === characterId && a.status === "WAITING")
    .forEach((a) => {
      a.status = "WITHDRAWN";
      a.reason = "Đã chuyển sang Hậu cung.";
    });
  world.requirements
    .filter(
      (r) =>
        r.characterId === characterId &&
        RANKS[r.targetRankId]?.branch === "INNER_COURT",
    )
    .forEach((r) => {
      r.supersededAt ??= at;
    });
  if (state.character.promotionRequirements)
    world.requirements.push(state.character.promotionRequirements);
  const log = systemLog(
    state,
    before,
    at,
    (options.id ?? (() => crypto.randomUUID()))(),
    true,
  );
  world.history.push({
    id: log.id,
    accountId: state.account.id,
    characterId,
    fromRankId: before.rankId,
    toRankId: state.character.rankId,
    fromBranch: before.branch,
    toBranch: "HAREM",
    createdAt: at,
    reason: "CONVERSION",
    journal: log,
  });
  return world;
}
