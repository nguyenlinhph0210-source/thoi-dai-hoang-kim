import type {
  CharacterStats,
  PublicSetupState,
  Season,
  SetupState,
} from "./game";
import type { ActionCode } from "@/config/actions";
import type { WorldTime } from "@/lib/worldClock";
import type { getRiskModifiers } from "@/lib/statEngine";
export interface RuntimeState extends SetupState {
  season: Season;
  serverNow: number;
  usage: Partial<Record<ActionCode, number>>;
  meritUsedToday: number;
  seatApplication?: import("./seats").PublicSeatApplication | null;
  nextSeatRoundAt?: number;
  seatBoard?: import("./seats").SeatBoardRow[];
  readWarnings?: string[];
  events?: import("./events").CharacterEvent[];
}
export interface ActionLog {
  id: string;
  accountId: string;
  characterId: string;
  actionCode: ActionCode;
  createdAt: string;
  before: CharacterStats;
  after: CharacterStats;
  apSpent: number;
  apAfter: number;
  modifiers: ReturnType<typeof getRiskModifiers> & {
    fatigueMultiplier: number;
    resonanceMultiplier: number;
  };
  worldTime: WorldTime;
  meritGained?: number;
  meritAfter?: number;
  event?: import("./events").EventResolutionInfo;
  promotion?: { fromRankId: string; toRankId: string; conversion: boolean };
  exam?: {
    success: boolean;
    probability: number;
    targetRankId: string;
    gameDay: number;
  };
}
export interface ActionResult {
  log: ActionLog;
  message: string;
}
export type VisibleStats = Omit<CharacterStats, "suspicion">;
export type PublicActionLog = Omit<
  ActionLog,
  "accountId" | "before" | "after"
> & { before: VisibleStats; after: VisibleStats };
export interface GameView extends PublicSetupState {
  season: Season;
  serverNow: number;
  usage: Partial<Record<ActionCode, number>>;
  meritUsedToday: number;
  seatApplication?: import("./seats").PublicSeatApplication | null;
  nextSeatRoundAt?: number;
  seatBoard?: import("./seats").SeatBoardRow[];
  readWarnings?: string[];
  pendingEvents: import("./events").PublicPendingEvent[];
  suspicionWarning: boolean;
  actionLocks: Record<ActionCode, string | null>;
  promotion:
    | import("@/lib/promotionEligibility").PublicPromotionProgress
    | null;
}
export interface LogPage {
  logs: PublicActionLog[];
  page: number;
  hasMore: boolean;
}
