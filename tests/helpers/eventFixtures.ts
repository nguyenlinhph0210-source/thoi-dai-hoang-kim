import { randomUUID } from "node:crypto";
import {
  createAccount,
  generateCharacter,
  confirmCharacter,
} from "../../src/lib/characterGenerator";
import { emptyEventData } from "../../src/lib/eventEngine";
import type {
  EventDefinition,
  CharacterEvent,
  EventWorld,
} from "../../src/types/events";
import type { Branch } from "../../src/types/game";
export const eventStart = Date.parse("2026-11-19T00:00:00Z");
export function readyEventWorld(branch: Branch = "CIVIL"): EventWorld {
  const id = randomUUID(),
    season = {
      id: randomUUID(),
      name: "Test",
      scenarioCode: "dai-khanh-thien-nguyen",
      status: "ACTIVE" as const,
      seasonStartTimestamp: new Date(eventStart).toISOString(),
      endedAt: null,
      fictional: true as const,
    };
  const account = createAccount(id),
    draft = generateCharacter(branch, {
      id: randomUUID(),
      accountId: id,
      seasonId: season.id,
      now: new Date(eventStart).toISOString(),
      gameYear: 1,
      random: () => 0,
    });
  const c = confirmCharacter(
    account,
    draft,
    new Date(eventStart).toISOString(),
    () => 0,
  ).character;
  Object.assign(c, {
    int: 1000,
    rep: 1000,
    fav: 1000,
    cha: 1000,
    hp: 100,
    suspicion: 0,
    characterSilver: 100,
    merit: 1000,
    investigationPending: false,
  });
  account.actionPoints = 15;
  return {
    version: 0,
    lastRound: 0,
    season,
    serverNow: eventStart,
    states: [
      {
        account,
        character: c,
        revision: 0,
        processedRequests: [],
        season,
        serverNow: eventStart,
        usage: {},
        meritUsedToday: 0,
      },
    ],
    applications: [],
    assignments: [],
    rounds: [],
    history: [],
    requirements: [c.promotionRequirements!],
    eventData: emptyEventData(),
  };
}
export function pendingFixture(
  world: EventWorld,
  definition: EventDefinition,
  stage = 0,
): CharacterEvent {
  const state = world.states[0];
  const e: CharacterEvent = {
    id: randomUUID(),
    accountId: state.account.id,
    characterId: state.character!.id,
    seasonId: world.season.id,
    definition: structuredClone(definition),
    stage,
    status: "PENDING",
    createdAt: new Date(world.serverNow).toISOString(),
    expiresAt: new Date(
      world.serverNow + definition.expiresHours * 3600000,
    ).toISOString(),
    resolvedAt: null,
    history: [],
  };
  world.eventData.instances.push(e);
  return e;
}
export function seededEventRandom(seed = 3) {
  let value = seed;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}
