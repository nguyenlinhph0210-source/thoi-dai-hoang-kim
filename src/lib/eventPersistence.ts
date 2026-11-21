import type { EventActionRequest, EventWorld } from "@/types/events";
import { seatProposal } from "./seatPersistence";
import { EVENT_BALANCE } from "@/config/balance";
import { ACTIONS } from "@/config/actions";
import { actionCommitPolicy } from "./actionProcessor";
export function eventProposal(
  before: EventWorld,
  after: EventWorld,
  request?: EventActionRequest,
) {
  const base = seatProposal({ before, after, operation: "ROUNDS" });
  function added<T>(
    old: readonly T[],
    next: readonly T[],
    key: (row: T) => string,
  ): T[] {
    const index = new Map(old.map((r) => [key(r), JSON.stringify(r)]));
    return next.filter((r) => index.get(key(r)) !== JSON.stringify(r));
  }
  const actor = request
    ? before.states.find((s) => s.account.id === request.accountId)
    : null;
  const definition = request ? ACTIONS[request.code] : null;
  return {
    ...base,
    pendingCap: EVENT_BALANCE.pendingCap,
    request: request
      ? {
          ...request,
          payload:
            request.code === "RESOLVE_EVENT"
              ? { ...request.payload!, stage: request.result.log.event!.stage }
              : null,
        }
      : null,
    policy:
      request && actor
        ? {
            ...actionCommitPolicy(actor, request.code),
            apCost: request.result.log.apSpent,
            silverCost:
              request.code === "RESOLVE_EVENT"
                ? before.eventData.instances
                    .find((e) => e.id === request.payload!.eventId)!
                    .definition.stages[
                      before.eventData.instances.find(
                        (e) => e.id === request.payload!.eventId,
                      )!.stage
                    ].choices.find((c) => c.code === request.payload!.choiceCode)!
                    .silverCost
                : definition!.silverCost,
            hpCost: definition!.hpCost,
            dailyCap: definition!.dailyCap,
          }
        : null,
    conversionCharacterId:
      after.history.find(
        (h) =>
          h.reason === "CONVERSION" &&
          !before.history.some((b) => b.id === h.id),
      )?.characterId ?? null,
    instances: added(
      before.eventData.instances,
      after.eventData.instances,
      (r) => r.id,
    ),
    checks: added(
      before.eventData.checks,
      after.eventData.checks,
      (r) => `${r.characterId}:${r.seasonId}:${r.week}`,
    ),
    marks: added(
      before.eventData.marks,
      after.eventData.marks,
      (r) => `${r.characterId}:${r.seasonId}:${r.week}`,
    ),
    ledger: added(before.eventData.ledger, after.eventData.ledger, (r) => r.id),
    records: added(
      before.eventData.records,
      after.eventData.records,
      (r) => `${r.accountId}:${r.key}`,
    ),
  };
}
