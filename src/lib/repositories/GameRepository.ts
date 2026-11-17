import type { SetupCommand } from "@/lib/characterGenerator";
import type { ActionCode } from "@/config/actions";
import type { RuntimeState, ActionResult, ActionLog } from "@/types/runtime";
import type { Season } from "@/types/game";
export interface GameRepository {
  readState(accountId: string): Promise<RuntimeState>;
  setup(
    accountId: string,
    command: SetupCommand,
    revision: number,
    key: string,
  ): Promise<RuntimeState>;
  act(accountId: string, code: ActionCode, key: string): Promise<ActionResult>;
  logs(accountId: string, page: number): Promise<ActionLog[]>;
  runDueSeatRounds(): Promise<void>;
  seatBoard(): Promise<import("@/types/seats").SeatBoardRow[]>;
  releaseSeats(characterId: string): Promise<void>;
  convertInnerCourtToHarem(characterId: string): Promise<void>;
  activeSeason(): Promise<Season>;
}
