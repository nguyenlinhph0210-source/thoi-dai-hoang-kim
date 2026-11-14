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
  suspicionWarning: boolean;
}
export interface LogPage {
  logs: PublicActionLog[];
  page: number;
  hasMore: boolean;
}
