import type { Branch, Character, PromotionRequirements, Season } from "./game";
import type { ActionLog, ActionResult, RuntimeState } from "./runtime";
export type ApplicationStatus =
  | "WAITING"
  | "PROMOTED"
  | "WITHDRAWN"
  | "REJECTED"
  | "EXPIRED";
export interface SeatApplication {
  id: string;
  accountId: string;
  characterId: string;
  seasonId: string;
  sourceRankId: string;
  targetRankId: string;
  status: ApplicationStatus;
  createdAt: string;
  expiresAt: string;
  firstRound: number;
  submittedRevision: number;
  reason: string | null;
}
export type PublicSeatApplication = Omit<
  SeatApplication,
  "accountId" | "characterId" | "seasonId" | "submittedRevision"
>;
export interface SeatAssignment {
  id: string;
  characterId: string;
  poolKey: string;
  seatNumber: number;
  rankId: string;
  assignedAt: string;
  releasedAt: string | null;
}
export interface SeatRound {
  poolKey: string;
  roundNumber: number;
  boundaryAt: string;
  processedAt: string;
}
export interface RankHistory {
  id: string;
  characterId: string;
  accountId: string;
  fromRankId: string;
  toRankId: string;
  fromBranch: Branch;
  toBranch: Branch;
  createdAt: string;
  reason: "PROMOTION" | "CONVERSION";
  journal: ActionLog;
}
export interface StoredRequirement extends PromotionRequirements {
  supersededAt?: string | null;
}
/** Server-private world. Never serialize it to a browser. */
export interface SeatWorld {
  eventData?: import("./events").EventData;
  version: number;
  lastRound: number;
  season: Season;
  serverNow: number;
  states: RuntimeState[];
  applications: SeatApplication[];
  assignments: SeatAssignment[];
  rounds: SeatRound[];
  history: RankHistory[];
  requirements: StoredRequirement[];
}
export interface SeatBoardRow {
  rankId: string;
  name: string;
  branch: Branch;
  total: number | null;
  occupied: number;
  available: number | null;
  reserved: number;
  waiting: number;
  starting: boolean;
}
export interface SeatRequest {
  accountId: string;
  key: string;
  code: "APPLY" | "WITHDRAW";
  result: ActionResult;
}
export interface SeatChange {
  before: SeatWorld;
  after: SeatWorld;
  request?: SeatRequest;
  operation: "ROUNDS" | "APPLY" | "WITHDRAW" | "CONVERT";
  actorId?: string;
}
export interface ConvertedCharacter {
  character: Character;
  requirements: PromotionRequirements | null;
}
