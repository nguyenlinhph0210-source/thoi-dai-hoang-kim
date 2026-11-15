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
  activeSeason(): Promise<Season>;
}
