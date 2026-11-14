import type { PublicSetupState, SetupState } from "@/types/game";
import type {
  RuntimeState,
  GameView,
  ActionLog,
  PublicActionLog,
} from "@/types/runtime";
export function publicState(state: SetupState): PublicSetupState {
  if (!state.character)
    return {
      account: state.account,
      character: null,
      revision: state.revision,
    };
  const { suspicion, suspicionFloor, ...character } = state.character;
  void suspicion;
  void suspicionFloor;
  return { account: state.account, character, revision: state.revision };
}
export function gameView(state: RuntimeState): GameView {
  return {
    ...publicState(state),
    season: state.season,
    serverNow: state.serverNow,
    usage: state.usage,
    suspicionWarning: (state.character?.suspicion ?? 0) >= 80,
  };
}
export function publicLog(log: ActionLog): PublicActionLog {
  const { accountId, before, after, ...visible } = log;
  void accountId;
  const { suspicion: b, ...beforeStats } = before;
  const { suspicion: a, ...afterStats } = after;
  void b;
  void a;
  return { ...visible, before: beforeStats, after: afterStats };
}
