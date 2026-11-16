import { EXAM_BALANCE } from "@/config/balance";
import type { CharacterStats } from "@/types/game";
export function examProbability(
  character: Pick<CharacterStats, "int" | "hp">,
): number {
  const c = EXAM_BALANCE;
  let p = Math.min(
    c.maxProbability,
    Math.max(
      c.minProbability,
      c.baseProbability +
        character.int / c.intDivisor +
        character.hp / c.hpDivisor,
    ),
  );
  if (character.hp < 20) p = Math.max(c.fatiguedMinimum, p - c.fatiguePenalty);
  return p;
}
