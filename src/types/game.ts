export const BRANCHES = ["CIVIL", "MILITARY", "INNER_COURT", "HAREM"] as const;
export type Branch = (typeof BRANCHES)[number];
export type Origin =
  | "COMMONER"
  | "SCHOLAR_FAMILY"
  | "NOBLE_CLAN"
  | "FALLEN_CLAN";
export type CharacterStatus =
  | "DRAFT"
  | "ACTIVE"
  | "SEVERELY_ILL"
  | "DECEASED"
  | "ARCHIVED";
export type RankTier = 1 | 2 | 3 | 4 | 5;
export type LongTermStat = "int" | "rep" | "fav" | "cha";
export type StatKey = keyof CharacterStats;

export interface Account {
  id: string;
  destinyPoints: number;
  pendingRewardSilver: number;
  /** Lifetime allowance. Never replenished after the first confirmed life. */
  freeRerollsLeft: number;
  hasCreatedCharacter: boolean;
  actionPoints: number;
  lastApGrantDateUtc7: string | null;
}

export interface CharacterStats {
  int: number;
  rep: number;
  fav: number;
  cha: number;
  hp: number;
  suspicion: number;
  characterSilver: number;
}

export type PromotionCondition =
  | { stat: Exclude<StatKey, "suspicion">; operator: ">="; value: number }
  | { stat: "suspicion"; operator: "<="; value: number };

export interface PromotionRequirements {
  characterId: string;
  targetRankId: string;
  conditions: [PromotionCondition, PromotionCondition, PromotionCondition];
  generatedAt: string;
  tableVersion?: "v1" | "legacy";
}

export interface Character extends CharacterStats {
  id: string;
  accountId: string;
  seasonId: string;
  branch: Branch;
  origin: Origin;
  rankId: string;
  age: number;
  birthGameYear: number;
  startAge: number;
  startGameYear: number;
  treatmentsRemaining: number;
  actionLocked: boolean;
  status: CharacterStatus;
  suspicionFloor: number;
  promotionRequirements: PromotionRequirements | null;
  createdAt: string;
  confirmedAt: string | null;
  rankEnteredAt: string | null;
  merit: number;
  examPassedForRankId: string | null;
  examPassedGameDay: number | null;
}

export interface Rank {
  id: string;
  name: string;
  branch: Branch;
  tier: RankTier;
  nextRankId: string | null;
  entryMinimums: Partial<Record<LongTermStat, number>>;
  benchmarks: Record<LongTermStat, number>;
  /** Shared key allows civil/military ranks to consume the same Tam thái pool. */
  seatPoolKey: string | null;
  seatCapacity: number | null;
}

export interface SeatPool {
  id: string;
  seasonId: string;
  key: string;
  capacity: number | null;
  occupiedSeats: number;
  eligibleRankIds: string[];
}

export interface Season {
  id: string;
  name: string;
  scenarioCode: string;
  status: "ACTIVE" | "ENDED";
  seasonStartTimestamp: string;
  endedAt: string | null;
  fictional: true;
}

export type EventKind =
  | "NORMAL"
  | "RARE"
  | "DANGEROUS"
  | "GREAT_CALAMITY"
  | "MAIN_STORY"
  | "COURT_WIDE"
  | "PVP";
export interface EventChoice {
  id: string;
  label: string;
  apCost: number;
  effects: Partial<CharacterStats>;
}
export interface Event {
  id: string;
  seasonId: string;
  characterId: string | null;
  code: string;
  kind: EventKind;
  title: string;
  description: string;
  status: "PENDING" | "RESOLVED" | "EXPIRED";
  choices: EventChoice[];
  expiresAt: string | null;
  resolvedAt: string | null;
}

export interface NPC {
  id: string;
  seasonId: string;
  name: string;
  title: string;
  faction: "EMPEROR" | "EMPRESS_DOWAGER" | "PRINCE" | "GRAND_TUTOR" | "NEUTRAL";
  rankId: string | null;
  status: "ACTIVE" | "DECEASED" | "DEPOSED";
  fictional: true;
}

export interface SetupState {
  account: Account;
  character: Character | null;
  revision: number;
  processedRequests: string[];
}
/** The hidden stat never crosses the server/client boundary. */
export type PublicCharacter = Omit<Character, "suspicion" | "suspicionFloor">;
export interface PublicSetupState {
  account: Account;
  character: PublicCharacter | null;
  revision: number;
}
