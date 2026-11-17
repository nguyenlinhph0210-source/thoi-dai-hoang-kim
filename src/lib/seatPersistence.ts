import type { SeatChange, SeatWorld } from "@/types/seats";
import { ACTIONS } from "@/config/actions";
import { MS_PER_GAME_DAY } from "@/config/balance";
import { utc7Date } from "./ap";
/** Send only changed rows. Raw worlds and scores must remain server-private. */
export function seatProposal(change: SeatChange) {
  const { before, after, request } = change;
  function changed<T>(
    old: readonly T[],
    next: readonly T[],
    key: (row: T) => string,
  ): T[] {
    const index = new Map(old.map((r) => [key(r), JSON.stringify(r)]));
    return next.filter((r) => index.get(key(r)) !== JSON.stringify(r));
  }
  return {
    seasonId: after.season.id,
    lastRound: after.lastRound,
    gameDay: Math.floor(
      Math.max(
        0,
        after.serverNow - Date.parse(after.season.seasonStartTimestamp),
      ) / MS_PER_GAME_DAY,
    ),
    date: utc7Date(after.serverNow),
    states: after.states
      .filter(
        (s) =>
          s.revision !==
          before.states.find((b) => b.account.id === s.account.id)?.revision,
      )
      .map((s) => ({
        account: s.account,
        character: s.character,
        revision: s.revision,
        previousRevision: before.states.find(
          (b) => b.account.id === s.account.id,
        )!.revision,
      })),
    applications: changed(before.applications, after.applications, (r) => r.id),
    assignments: changed(before.assignments, after.assignments, (r) => r.id),
    rounds: changed(
      before.rounds,
      after.rounds,
      (r) => `${r.poolKey}:${r.roundNumber}`,
    ),
    history: changed(before.history, after.history, (r) => r.id),
    requirements: changed(
      before.requirements,
      after.requirements,
      (r) => `${r.characterId}:${r.targetRankId}`,
    ),
    request: request ?? null,
    policy: request
      ? {
          apCost: ACTIONS[request.code].apCost,
          dailyCap: ACTIONS[request.code].dailyCap,
        }
      : null,
  };
}
export function hasSeatChanges(before: SeatWorld, after: SeatWorld): boolean {
  return JSON.stringify(before) !== JSON.stringify(after);
}
