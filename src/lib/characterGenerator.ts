import type { Account, Branch, Character, CharacterStats, LongTermStat, Origin, PromotionCondition, PromotionRequirements, Rank, SetupState, StatKey } from '@/types/game';
import { BASE_STAT_RANGES, INITIAL_RANKS, ORIGIN_INFO, PROMOTION_STATS, RANKS, SPECIAL_REQUIREMENT_RANGES, STAT_BOUNDS, THIRD_STAT_WEIGHTS } from './gameConfig';

export class GameRuleError extends Error {}
export class ConfigurationError extends Error {}
export type RandomSource = () => number;

/** Inject a seeded source in tests; server actions supply cryptographic randomness. */
export function randomInteger(min: number, max: number, random: RandomSource = Math.random): number {
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min > max) throw new ConfigurationError('Khoảng ngẫu nhiên không hợp lệ.');
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new ConfigurationError('Nguồn ngẫu nhiên phải thuộc [0, 1).');
  return Math.floor(value * (max - min + 1)) + min;
}

export function rollOrigin(random: RandomSource = Math.random): Origin {
  const ticket = randomInteger(0, 99, random);
  let cumulative = 0;
  for (const origin of Object.keys(ORIGIN_INFO) as Origin[]) {
    cumulative += ORIGIN_INFO[origin].weight;
    if (ticket < cumulative) return origin;
  }
  throw new ConfigurationError('Tổng trọng số xuất thân không hợp lệ.');
}

export function clampStats(stats: CharacterStats): CharacterStats {
  const result = { ...stats };
  for (const key of Object.keys(STAT_BOUNDS) as StatKey[]) {
    const [min, max] = STAT_BOUNDS[key];
    if (!Number.isSafeInteger(result[key])) throw new ConfigurationError('Chỉ số phải là số nguyên an toàn.');
    result[key] = Math.min(max, Math.max(min, result[key]));
  }
  return result;
}

export interface GenerationContext {
  id: string;
  accountId: string;
  seasonId: string;
  now: string;
  gameYear: number;
  random?: RandomSource;
  initialRank?: Rank;
}

/** Steps 1–6. A preview is persisted and never grants resources or requirements. */
export function generateCharacter(branch: Branch, context: GenerationContext): Character {
  const random = context.random ?? Math.random;
  const initialRank = context.initialRank ?? INITIAL_RANKS[branch];
  if (initialRank.branch !== branch) throw new ConfigurationError('Phẩm cấp không thuộc nhánh đã chọn.');
  const origin = rollOrigin(random);
  const age = randomInteger(16, 21, random);
  const stats: CharacterStats = { int: 0, rep: 0, fav: 0, cha: 0, hp: 0, characterSilver: 0, suspicion: 0 };
  for (const key of Object.keys(stats) as StatKey[]) {
    const [min, max] = BASE_STAT_RANGES[branch][key];
    stats[key] = randomInteger(min, max, random) + (ORIGIN_INFO[origin].modifiers[key] ?? 0);
  }
  const clamped = clampStats(stats);
  for (const key of Object.keys(initialRank.entryMinimums) as LongTermStat[]) {
    const minimum = initialRank.entryMinimums[key];
    if (minimum === undefined) continue;
    if (!Number.isInteger(minimum) || minimum < STAT_BOUNDS[key][0] || minimum > STAT_BOUNDS[key][1]) throw new ConfigurationError('Ngưỡng nhập phẩm vượt giới hạn chỉ số.');
    clamped[key] = Math.max(clamped[key], minimum);
  }
  return {
    ...clamped, id: context.id, accountId: context.accountId, seasonId: context.seasonId,
    branch, origin, age, birthGameYear: context.gameYear - age, rankId: initialRank.id,
    status: 'DRAFT', suspicionFloor: 0, promotionRequirements: null, createdAt: context.now, confirmedAt: null,
  };
}

export function generatePromotionRequirements(character: Character, targetRank: Rank, now: string, random: RandomSource = Math.random, previous: Partial<Record<LongTermStat, number>> = {}): PromotionRequirements {
  if (targetRank.branch !== character.branch) throw new ConfigurationError('Phẩm cấp mục tiêu không thuộc nhánh.');
  const [a, b, c1, c2] = PROMOTION_STATS[character.branch];
  const weights = THIRD_STAT_WEIGHTS;
  const ticket = randomInteger(0, weights.C1 + weights.C2 + weights.HP + weights.SILVER + weights.SUSPICION - 1, random);
  const c: StatKey = ticket < weights.C1 ? c1 : ticket < weights.C1 + weights.C2 ? c2 : ticket < weights.C1 + weights.C2 + weights.HP ? 'hp' : ticket < weights.C1 + weights.C2 + weights.HP + weights.SILVER ? 'characterSilver' : 'suspicion';
  function condition(stat: StatKey): PromotionCondition {
    let value: number;
    if (stat === 'hp' || stat === 'characterSilver' || stat === 'suspicion') {
      const [min, max] = SPECIAL_REQUIREMENT_RANGES[targetRank.tier][stat];
      value = randomInteger(min, max, random);
    } else {
      const base = targetRank.benchmarks[stat];
      const delta = base < 100 ? 5 : base < 300 ? 10 : base < 700 ? 12 : 15;
      const [min, max] = STAT_BOUNDS[stat];
      const lower = Math.max(min, base - delta, previous[stat] === undefined ? min : previous[stat] + 1);
      const upper = Math.min(max, base + delta);
      value = randomInteger(lower, upper, random); // Throws ConfigurationError for impossible monotonicity.
    }
    return stat === 'suspicion' ? { stat, operator: '<=', value } : { stat, operator: '>=', value };
  }
  return { characterId: character.id, targetRankId: targetRank.id, conditions: [condition(a), condition(b), condition(c)], generatedAt: now };
}

export function createAccount(id: string): Account {
  return { id, destinyPoints: 0, pendingRewardSilver: 0, freeRerollsLeft: 3, hasCreatedCharacter: false, actionPoints: 10, lastApGrantDateUtc7: null };
}

export function rerollCharacter(account: Account, character: Character, context: Omit<GenerationContext, 'id' | 'accountId' | 'seasonId'>): { account: Account; character: Character } {
  if (character.accountId !== account.id || character.status !== 'DRAFT') throw new GameRuleError('Chỉ được đổi thân phận trước khi xác nhận.');
  const next = { ...account };
  if (!next.hasCreatedCharacter && next.freeRerollsLeft > 0) next.freeRerollsLeft -= 1;
  else if (next.destinyPoints >= 1) next.destinyPoints -= 1;
  else throw new GameRuleError('Bạn cần 1 Điểm Thiên Mệnh để đổi thân phận.');
  return { account: next, character: generateCharacter(character.branch, { ...context, id: character.id, accountId: character.accountId, seasonId: character.seasonId }) };
}

/** Step 7. Persist the entire result atomically; do not trust a browser-supplied character. */
export function confirmCharacter(account: Account, character: Character, now: string, random: RandomSource = Math.random): { account: Account; character: Character } {
  if (character.accountId !== account.id) throw new GameRuleError('Nhân vật không thuộc tài khoản.');
  if (character.status === 'ACTIVE') return { account, character }; // Idempotent: rewards cannot be collected twice.
  if (character.status !== 'DRAFT') throw new GameRuleError('Cuộc đời này đã khép lại.');
  const rank = RANKS[character.rankId];
  const target = rank?.nextRankId ? RANKS[rank.nextRankId] : null;
  if (!target) throw new ConfigurationError('Chưa có cấu hình phẩm cấp tiếp theo.');
  const silver = character.characterSilver + account.pendingRewardSilver;
  if (!Number.isSafeInteger(silver) || silver < 0) throw new ConfigurationError('Ngân lượng vượt phạm vi an toàn.');
  return {
    account: { ...account, pendingRewardSilver: 0, freeRerollsLeft: 0, hasCreatedCharacter: true },
    character: { ...character, characterSilver: silver, status: 'ACTIVE', confirmedAt: now, promotionRequirements: generatePromotionRequirements(character, target, now, random) },
  };
}

export type SetupCommand = { type: 'BEGIN'; branch: Branch } | { type: 'REROLL' } | { type: 'CONFIRM' };
export function transitionSetup(state: SetupState, command: SetupCommand, context: GenerationContext): SetupState {
  if (command.type === 'BEGIN') {
    if (state.character?.status === 'DRAFT' || state.character?.status === 'ACTIVE') {
      if (state.character.branch !== command.branch) throw new GameRuleError('Nhánh đã chọn được giữ nguyên trong cuộc đời này.');
      return state;
    }
    return { ...state, character: generateCharacter(command.branch, context) };
  }
  if (!state.character) throw new GameRuleError('Hãy chọn nhánh phát triển trước.');
  const result = command.type === 'REROLL' ? rerollCharacter(state.account, state.character, context) : confirmCharacter(state.account, state.character, context.now, context.random);
  return { ...state, ...result };
}
