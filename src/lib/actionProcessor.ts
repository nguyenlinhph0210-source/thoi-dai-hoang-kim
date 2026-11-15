import { ACTIONS, type ActionCode } from "@/config/actions";
import { GameRuleError } from "./characterGenerator";
import { applyActionStats, getRiskModifiers } from "./statEngine";
import { getWorldTime } from "./worldClock";
import type { CharacterStats } from "@/types/game";
import type { ActionLog, RuntimeState } from "@/types/runtime";
import { RESONANCE_STACKING } from "@/config/balance";
export function actionLockReason(
  state: RuntimeState,
  code: ActionCode,
): string | null {
  const c = state.character;
  const a = ACTIONS[code];
  if (!c || !["ACTIVE", "SEVERELY_ILL"].includes(c.status))
    return "Bạn chưa xác nhận thân phận.";
  if (state.season.status !== "ACTIVE") return "Mùa giải đã kết thúc.";
  if (c.actionLocked) return "Nhân vật đang bị khóa hành động.";
  if (c.status === "SEVERELY_ILL" && code !== "TREAT")
    return "Đang trọng bệnh, chỉ được điều trị.";
  if (c.status !== "SEVERELY_ILL" && code === "TREAT")
    return "Chỉ dành cho nhân vật đang trọng bệnh.";
  if (state.account.actionPoints < a.apCost) return "Không đủ AP.";
  if (c.characterSilver < a.silverCost) return "Không đủ ngân lượng.";
  if (c.hp < a.hpCost) return "Không đủ thể lực.";
  if ((state.usage[code] ?? 0) >= a.dailyCap) return "Đã đạt hạn mức hôm nay.";
  return null;
}
export function statsOf(c: CharacterStats): CharacterStats {
  return {
    int: c.int,
    rep: c.rep,
    fav: c.fav,
    cha: c.cha,
    hp: c.hp,
    suspicion: c.suspicion,
    characterSilver: c.characterSilver,
  };
}
export function processAction(
  state: RuntimeState,
  code: ActionCode,
  id: string,
): { state: RuntimeState; log: ActionLog } {
  const reason = actionLockReason(state, code);
  if (reason) throw new GameRuleError(reason);
  const c = state.character!;
  const action = ACTIONS[code];
  const next = applyActionStats(c, action);
  const apAfter = state.account.actionPoints - action.apCost;
  const log: ActionLog = {
    id,
    accountId: state.account.id,
    characterId: c.id,
    actionCode: code,
    createdAt: new Date(state.serverNow).toISOString(),
    before: statsOf(c),
    after: statsOf(next),
    apSpent: action.apCost,
    apAfter,
    modifiers: {
      ...getRiskModifiers(c),
      fatigueMultiplier: c.hp < 20 ? 0.5 : 1,
      resonanceMultiplier:
        code === "AUDIENCE"
          ? 1 +
            0.15 *
              (RESONANCE_STACKING
                ? Math.floor(c.cha / 200)
                : Number(c.cha >= 200))
          : 1,
    },
    worldTime: getWorldTime(
      state.serverNow,
      Date.parse(state.season.seasonStartTimestamp),
    ),
  };
  return {
    state: {
      ...state,
      character: next,
      account: { ...state.account, actionPoints: apAfter },
      revision: state.revision + 1,
      usage: { ...state.usage, [code]: (state.usage[code] ?? 0) + 1 },
    },
    log,
  };
}
