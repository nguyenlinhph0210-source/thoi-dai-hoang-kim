import type { Character, CharacterStats, StatKey } from "@/types/game";
import { clampStats as clampBase } from "./characterGenerator";
import { RESONANCE_STACKING, TREATMENTS_REQUIRED } from "@/config/balance";
import type { ActionDefinition } from "@/config/actions";
import type { CosmeticEffects } from "@/types/cosmetics";
export function clampStats(
  stats: CharacterStats,
  suspicionFloor = 0,
): CharacterStats {
  return clampBase({
    ...stats,
    suspicion: Math.max(
      Math.min(100, Math.max(0, suspicionFloor)),
      stats.suspicion,
    ),
  });
}
export function getRiskModifiers(c: CharacterStats) {
  return {
    ambushChanceBonus: c.fav > 400 && c.int < 200 ? 0.4 : 0,
    slanderChanceBonus: c.fav - c.rep >= 200 ? 0.3 : 0,
    failChanceBonus: c.hp < 20 ? 0.3 : 0,
  };
}
export function applyGain(
  c: CharacterStats,
  gains: Partial<CharacterStats>,
  type: ActionDefinition["type"] = "NORMAL",
  gainPercent: Partial<Record<StatKey, number>> = {},
): CharacterStats {
  const next = { ...c };
  for (const stat of Object.keys(gains) as StatKey[]) {
    let gain = gains[stat] ?? 0;
    // TODO(spec): multiply resonance and fatigue together, then floor once.
    if (gain > 0) {
      const stacks =
        stat === "fav" && type === "AUDIENCE"
          ? RESONANCE_STACKING
            ? Math.floor(c.cha / 200)
            : Number(c.cha >= 200)
          : 0;
      // Integer percentages avoid 100 * 1.15 rounding down to 114 in JS.
      gain = Math.floor(
        (gain * (100 + 15 * stacks) * (100 + (gainPercent[stat] ?? 0))) /
          ((c.hp < 20 ? 200 : 100) * 100),
      );
    }
    next[stat] += gain;
  }
  return clampStats(next);
}
export function applyActionStats(
  character: Character,
  action: ActionDefinition,
  effects?: CosmeticEffects,
): Character {
  const paid = {
    ...character,
    characterSilver: character.characterSilver - action.silverCost,
    hp: character.hp - action.hpCost,
  };
  // Fatigue/resonance use the state at the beginning of the action.
  const gainPercent = !effects
    ? {}
    : action.code === "AUDIENCE"
      ? { fav: effects.audienceFavPct }
      : action.code === "ETIQUETTE"
        ? { cha: effects.etiquetteGainPct }
        : action.code === "REST"
          ? { hp: effects.restHpPct }
          : action.code === "SOCIALIZE"
            ? { rep: effects.socializeRepPct }
            : {};
  let stats = applyGain(character, action.gains, action.type, gainPercent);
  stats.characterSilver -= action.silverCost;
  stats.hp -= action.hpCost;
  let suspicionFloor = character.suspicionFloor;
  // TODO(spec): saturate the floor at 100 so the hidden stat can respect its bounds.
  if (action.code === "RUMOR" && character.rep < 150)
    suspicionFloor = Math.min(100, suspicionFloor + 5);
  stats = clampStats(stats, suspicionFloor);
  if (action.apCost > 0 && stats.rep > 60 && stats.characterSilver < 10)
    stats.rep = Math.max(0, stats.rep - 5);
  const next: Character = { ...paid, ...stats, suspicionFloor };
  if (next.status === "SEVERELY_ILL" && action.code === "TREAT") {
    next.treatmentsRemaining = Math.max(0, next.treatmentsRemaining - 1);
    if (next.treatmentsRemaining === 0) next.status = "ACTIVE";
  } else if (stats.hp === 0) {
    next.status = "SEVERELY_ILL";
    next.treatmentsRemaining = TREATMENTS_REQUIRED;
    // TODO(spec), Chặng 5: death when unable to afford a royal physician.
  }
  return next;
}
