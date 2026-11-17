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
import {
  evaluatePromotionEligibility,
  promotionWorldTime,
  publicPromotion,
} from "./promotionEligibility";
import { ACTIONS } from "@/config/actions";
import { actionLockReason } from "./actionProcessor";
export function gameView(state: RuntimeState): GameView {
  return {
    ...publicState(state),
    season: state.season,
    serverNow: state.serverNow,
    seatApplication: state.seatApplication ?? null,
    nextSeatRoundAt: state.nextSeatRoundAt,
    seatBoard: state.seatBoard ?? [],
    usage: state.usage,
    meritUsedToday: state.meritUsedToday ?? 0,
    promotion: state.character
      ? publicPromotion(
          evaluatePromotionEligibility(
            state.character,
            state.character.promotionRequirements,
            promotionWorldTime(
              state.serverNow,
              Date.parse(state.season.seasonStartTimestamp),
            ),
          ),
        )
      : null,
    actionLocks: Object.fromEntries(
      Object.values(ACTIONS).map((a) => [
        a.code,
        actionLockReason(state, a.code),
      ]),
    ) as GameView["actionLocks"],
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
