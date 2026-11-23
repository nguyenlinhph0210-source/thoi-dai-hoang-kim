/** World/AP constants implement AGENTS.md; TEMP values are balance knobs only. */
export const MS_PER_GAME_DAY = 300_000;
export const DAYS_PER_GAME_MONTH = 30;
export const DAYS_PER_GAME_YEAR = 360;
export const DAYS_PER_GAME_WEEK = 7;
export const START_REIGN_YEAR = 8; // Display only; internal years start at 1.
export const INITIAL_AP = 10; // TEMP
export const AP_PER_DAY = 10;
export const AP_CAP = 15;
export const REAL_DAY_MS = 86_400_000;
export const UTC7_OFFSET_MS = 7 * 3_600_000;
export const RESONANCE_STACKING = true; // TODO(spec): choose cumulative 15% per 200 cha.
export const TREATMENTS_REQUIRED = 5; // TODO(spec): five paid treatment actions unlock illness.
export const LOG_PAGE_SIZE = 20;
/** TEMP — H1 prices, caps and rewards; never trust client-supplied prices. */
export const HAREM_BALANCE = {
  dailyPurchaseCap: 10,
  prices: {
    1: [20, 30, 40],
    2: [60, 90, 120],
    3: [200, 300, 400],
    4: [600, 800, 1000],
    5: [1500, 2200, 3000],
  },
  equipmentPctByTier: { 1: 5, 2: 8, 3: 10, 4: 12, 5: 15 },
  equipmentCapPct: 25,
  chamber: [
    { level: 1, price: 0, minTier: 1 },
    { level: 2, price: 80, minTier: 1 },
    { level: 3, price: 200, minTier: 2 },
    { level: 4, price: 500, minTier: 3 },
    { level: 5, price: 1200, minTier: 4 },
  ],
  restPctPerLevel: 10,
  restCapPct: 40,
  socializePctPerLevel: 5,
  socializeCapPct: 20,
  decorPrices: [0, 25, 80],
  decorTiers: [1, 1, 2],
  titleMilestones: ["harem_12", "harem_10", "harem_8", "harem_5", "harem_3"],
} as const;
/** TEMP — deliberately centralized; no balance values in the processor. */
export const APPLY_AP_COST = 1; // TEMP
export const APPLY_DAILY_CAP = 2; // TEMP
export const ACTION_BALANCE = {
  COSMETIC: {
    meritGain: 0,
    apCost: 0,
    silverCost: 0,
    hpCost: 0,
    gains: {},
    dailyCap: 2147483647,
  },
  RESOLVE_EVENT: {
    meritGain: 0,
    apCost: 0,
    silverCost: 0,
    hpCost: 0,
    gains: {},
    dailyCap: 2147483647,
  },
  APPLY: {
    meritGain: 0,
    apCost: APPLY_AP_COST,
    silverCost: 0,
    hpCost: 0,
    gains: {},
    dailyCap: APPLY_DAILY_CAP,
  },
  WITHDRAW: {
    meritGain: 0,
    apCost: 0,
    silverCost: 0,
    hpCost: 0,
    gains: {},
    dailyCap: 2147483647, // Technical SQL integer ceiling; withdrawal has no gameplay quota.
  },
  STUDY: {
    meritGain: 1,
    apCost: 1,
    silverCost: 0,
    hpCost: 0,
    gains: { int: 8 },
    dailyCap: 5,
  },
  SOCIALIZE: {
    meritGain: 1,
    apCost: 1,
    silverCost: 2,
    hpCost: 0,
    gains: { rep: 7 },
    dailyCap: 4,
  },
  AUDIENCE: {
    meritGain: 2,
    apCost: 1,
    silverCost: 0,
    hpCost: 0,
    gains: { fav: 8 },
    dailyCap: 3,
  },
  ETIQUETTE: {
    meritGain: 1,
    apCost: 1,
    silverCost: 0,
    hpCost: 0,
    gains: { cha: 7 },
    dailyCap: 4,
  },
  WORK: {
    meritGain: 2,
    apCost: 1,
    silverCost: 0,
    hpCost: 12,
    gains: { characterSilver: 15 },
    dailyCap: 8,
  },
  REST: {
    meritGain: 0,
    apCost: 1,
    silverCost: 0,
    hpCost: 0,
    gains: { hp: 20 },
    dailyCap: 5,
  },
  RUMOR: {
    meritGain: 0,
    apCost: 1,
    silverCost: 10,
    hpCost: 0,
    gains: { suspicion: -15 },
    dailyCap: 3,
  },
  TREAT: {
    meritGain: 0,
    apCost: 1,
    silverCost: 0,
    hpCost: 0,
    gains: { hp: 10 },
    dailyCap: 5,
  },
  EXAM: {
    meritGain: 0,
    apCost: 2,
    silverCost: 0,
    hpCost: 3,
    gains: {},
    dailyCap: 2,
  },
} as const;

/** TEMP — promotion/exam balance, shared by the processor and profile. */
export const TENURE_DAYS_BY_TIER = {
  1: 30,
  2: 60,
  3: 120,
  4: 240,
  5: 360,
} as const;
export const BRANCH_TENURE_MULTIPLIER = {
  CIVIL: 1.0,
  MILITARY: 1.0,
  INNER_COURT: 1.0,
  HAREM: 1.0,
} as const;
export const MERIT_REQUIRED_BY_TIER = {
  1: 10,
  2: 30,
  3: 70,
  4: 150,
  5: 300,
} as const;
export const MERIT_DAILY_CAP = 8;
export const EXAM_VALID_GAME_DAYS = 60;
export const EXAM_BALANCE = {
  baseProbability: 0.35,
  intDivisor: 2000,
  hpDivisor: 400,
  minProbability: 0.2,
  maxProbability: 0.95,
  fatiguePenalty: 0.3,
  fatiguedMinimum: 0.05,
} as const;

/** TEMP — seat applications. Weekly boundary comes from the world calendar. */
export const APPLICATION_EXPIRY_GAME_DAYS = 28;

/** TEMP — personal events. All sample costs/effects/probability coefficients live here. */
export const EVENT_BALANCE = {
  weeklyChance: 0.4,
  groupWeights: { NORMAL: 65, RARE: 20, DANGEROUS: 13, GREAT_CALAMITY: 2 },
  expiresHours: { NORMAL: 24, RARE: 36, DANGEROUS: 12, GREAT_CALAMITY: 24 },
  pendingCap: 3,
  investigationCooldownDays: 14,
  haremRefusalCooldownDays: 30,
  defaultCooldownDays: 7,
  calamityCooldownDays: 60,
  calamitySilverLoss: 0.5,
  calamityFavLoss: 30,
  choiceAp: 1,
  rewardSmall: 5,
  rewardLarge: 12,
  silverReward: 10,
  silverCost: 10,
  hpLoss: 10,
  suspicionGain: 8,
  investigationSuspicionRelief: 25,
  rumorSuspicionRelief: 15,
  probability: {
    base: 0.35,
    intDivisor: 2000,
    hpDivisor: 400,
    min: 0.2,
    max: 0.95,
    contest: true,
  },
  fatigueMinimum: 0.05,
} as const;
