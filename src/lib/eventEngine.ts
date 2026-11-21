import { EVENT_CATALOG } from "@/config/events";
import {
  EVENT_BALANCE as B,
  MS_PER_GAME_DAY,
  TREATMENTS_REQUIRED,
} from "@/config/balance";
import type { Character, CharacterStats } from "@/types/game";
import type { RuntimeState, ActionResult, ActionLog } from "@/types/runtime";
import type {
  CharacterEvent,
  EventData,
  EventDefinition,
  EventOutcome,
  EventProbability,
  EventRequirements,
  EventWorld,
  PersonalEventChoice,
  PersonalEventKind,
  PublicPendingEvent,
  ResolveEventInput,
} from "@/types/events";
import type { SeatWorld } from "@/types/seats";
import {
  GameRuleError,
  randomInteger,
  type RandomSource,
} from "./characterGenerator";
import { applyActionStats, getRiskModifiers } from "./statEngine";
import { statsOf } from "./actionProcessor";
import { RANKS } from "./gameConfig";
import { getWorldTime } from "./worldClock";
import { convertInnerCourtWorld } from "./seatEngine";
export interface EventEngineOptions {
  random?: RandomSource;
  id?: () => string;
  catalog?: readonly EventDefinition[];
}
export function emptyEventData(): EventData {
  return {
    instances: [],
    checks: [],
    marks: [],
    claims: [],
    ledger: [],
    records: [],
  };
}
export function eventWorld(world: SeatWorld): EventWorld {
  return { ...world, eventData: world.eventData ?? emptyEventData() };
}
const newId = (options: EventEngineOptions) =>
  (options.id ?? (() => crypto.randomUUID()))();
const draw = (options: EventEngineOptions) =>
  randomInteger(0, 0xffffffff, options.random ?? Math.random) / 0x100000000;
const gameDay = (world: SeatWorld, at = world.serverNow) =>
  Math.floor(
    Math.max(0, at - Date.parse(world.season.seasonStartTimestamp)) /
      MS_PER_GAME_DAY,
  );
export function meetsEventRequirements(
  c: Character,
  r: EventRequirements,
): boolean {
  if (
    (r.statuses && !r.statuses.includes(c.status)) ||
    (r.tiers && !r.tiers.includes(RANKS[c.rankId].tier)) ||
    (r.rankIds && !r.rankIds.includes(c.rankId))
  )
    return false;
  for (const [key, value] of Object.entries(r.minimums ?? {}))
    if (c[key as keyof CharacterStats] < value) return false;
  for (const [key, value] of Object.entries(r.maximums ?? {}))
    if (c[key as keyof CharacterStats] > value) return false;
  return true;
}
export function canAppear(
  def: EventDefinition,
  c: Character,
  world: EventWorld,
): boolean {
  if (
    !def.branches.includes(c.branch) ||
    !meetsEventRequirements(c, def.requirements)
  )
    return false;
  if (
    world.eventData.instances.some(
      (e) =>
        e.characterId === c.id &&
        e.definition.code === def.code &&
        (e.status === "PENDING" ||
          gameDay(world) -
            gameDay(
              world,
              Date.parse(
                e.definition.tags.includes("HAREM_AUDIENCE") && e.resolvedAt
                  ? e.resolvedAt
                  : e.createdAt,
              ),
            ) <
            def.cooldownGameDays),
    )
  )
    return false;
  return true;
}
export function eventWeight(def: EventDefinition, c: Character): number {
  const modifiers = getRiskModifiers(c);
  return (
    def.weight *
    (def.tags.includes("HARM") ? 1 + modifiers.ambushChanceBonus : 1) *
    (def.tags.includes("SLANDER") ? 1 + modifiers.slanderChanceBonus : 1)
  );
}
export function chooseGroup(random: RandomSource): PersonalEventKind {
  const total = Object.values(B.groupWeights).reduce((n, w) => n + w, 0);
  let ticket = randomInteger(0, total - 1, random);
  for (const [group, weight] of Object.entries(B.groupWeights)) {
    if (ticket < weight) return group as PersonalEventKind;
    ticket -= weight;
  }
  throw new GameRuleError("Chưa chọn được nhóm sự kiện.");
}
export function chooseEvent(
  candidates: readonly EventDefinition[],
  c: Character,
  options: EventEngineOptions = {},
): EventDefinition | null {
  const total = candidates.reduce((n, d) => n + eventWeight(d, c), 0);
  if (!total) return null;
  let ticket = draw(options) * total;
  for (const def of candidates) {
    ticket -= eventWeight(def, c);
    if (ticket < 0) return def;
  }
  return candidates.at(-1) ?? null;
}
function pending(world: EventWorld, c: Character): CharacterEvent[] {
  return world.eventData.instances.filter(
    (e) => e.characterId === c.id && e.status === "PENDING",
  );
}
function createEvent(
  world: EventWorld,
  state: RuntimeState,
  def: EventDefinition,
  options: EventEngineOptions,
): CharacterEvent {
  const event: CharacterEvent = {
    id: newId(options),
    accountId: state.account.id,
    characterId: state.character!.id,
    seasonId: world.season.id,
    definition: structuredClone(def),
    stage: 0,
    status: "PENDING",
    createdAt: new Date(world.serverNow).toISOString(),
    expiresAt: new Date(
      world.serverNow + def.expiresHours * 3600000,
    ).toISOString(),
    resolvedAt: null,
    history: [],
  };
  world.eventData.instances.push(event);
  return event;
}
/** TODO(spec): mandatory inquiries are deferred, never dropped or allowed to exceed the cap. */
export function ensureInvestigation(
  world: EventWorld,
  state: RuntimeState,
  options: EventEngineOptions = {},
): void {
  const c = state.character;
  if (!c || !["ACTIVE", "SEVERELY_ILL"].includes(c.status)) return;
  const existing = pending(world, c).some((e) =>
    e.definition.tags.includes("INVESTIGATION"),
  );
  if (existing) {
    c.investigationPending = true;
    return;
  }
  const last = world.eventData.instances
    .filter(
      (e) =>
        e.characterId === c.id && e.definition.tags.includes("INVESTIGATION"),
    )
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
  const cooled =
    !last ||
    gameDay(world) - gameDay(world, Date.parse(last.createdAt)) >=
      B.investigationCooldownDays;
  if (c.suspicion >= 80 && cooled) c.investigationPending = true;
  if (
    !c.investigationPending ||
    !cooled ||
    pending(world, c).length >= B.pendingCap
  )
    return;
  const def = (options.catalog ?? EVENT_CATALOG).find(
    (d) => d.trigger === "INVESTIGATION" && d.branches.includes(c.branch),
  );
  if (!def) throw new GameRuleError("Thiếu cấu hình sự kiện tra xét.");
  createEvent(world, state, def, options);
}
/** Call with a real action/choice in its transaction; passive expiry and withdrawal never roll. */
export function afterValidAction(
  world: EventWorld,
  accountId: string,
  log: ActionLog,
  options: EventEngineOptions = {},
): void {
  const state = world.states.find((s) => s.account.id === accountId)!,
    c = state.character!;
  ensureInvestigation(world, state, options);
  if (log.apSpent <= 0 && log.actionCode !== "RESOLVE_EVENT") return;
  const week = getWorldTime(
    world.serverNow,
    Date.parse(world.season.seasonStartTimestamp),
  ).currentGameWeek;
  if (
    world.eventData.checks.some(
      (r) =>
        r.characterId === c.id &&
        r.seasonId === world.season.id &&
        r.week === week,
    )
  )
    return;
  let mark = world.eventData.marks.find(
    (r) =>
      r.characterId === c.id &&
      r.seasonId === world.season.id &&
      r.week === week,
  );
  if (!mark) {
    mark = {
      characterId: c.id,
      seasonId: world.season.id,
      week,
      firstActionId: log.id,
    };
    world.eventData.marks.push(mark);
  }
  const check = {
    accountId,
    characterId: c.id,
    seasonId: world.season.id,
    week,
    firstActionId: mark.firstActionId,
    triggered: false,
    group: null as PersonalEventKind | null,
    eventId: null as string | null,
    reason: "MISS" as
      | "MISS"
      | "LEGACY_MARK"
      | "FULL"
      | "NO_ELIGIBLE"
      | "CREATED",
  };
  world.eventData.checks.push(check);
  // TODO(spec): a pre-4A first-action mark never grants a retrospective roll.
  if (mark.firstActionId !== log.id) {
    check.reason = "LEGACY_MARK";
    return;
  }
  check.triggered = draw(options) < B.weeklyChance;
  if (!check.triggered) return;
  check.group = chooseGroup(options.random ?? Math.random);
  if (pending(world, c).length >= B.pendingCap) {
    check.reason = "FULL";
    return;
  }
  const eligible = (options.catalog ?? EVENT_CATALOG).filter(
    (d) => d.trigger === "WEEKLY" && canAppear(d, c, world),
  );
  let candidates = eligible.filter((d) => d.group === check.group);
  if (!candidates.length)
    candidates = eligible.filter((d) => d.group === "NORMAL");
  const def = chooseEvent(candidates, c, options);
  if (!def) {
    check.reason = "NO_ELIGIBLE";
    return;
  }
  check.eventId = createEvent(world, state, def, options).id;
  check.reason = "CREATED";
}
export function eventProbability(
  c: Character,
  formula: EventProbability,
): number {
  let probability = Math.max(
    formula.min,
    Math.min(
      formula.max,
      formula.base + c.int / formula.intDivisor + c.hp / formula.hpDivisor,
    ),
  );
  if (formula.contest)
    probability = Math.max(
      B.fatigueMinimum,
      probability - getRiskModifiers(c).failChanceBonus,
    );
  return probability;
}
export function eventChoiceLockReason(
  state: RuntimeState,
  event: CharacterEvent,
  choice: PersonalEventChoice,
): string | null {
  const c = state.character;
  if (
    !c ||
    c.id !== event.characterId ||
    event.accountId !== state.account.id ||
    event.status !== "PENDING"
  )
    return "Sự kiện không còn chờ xử lý.";
  if (state.serverNow >= Date.parse(event.expiresAt))
    return "Sự kiện đã hết hạn.";
  if (state.season.status !== "ACTIVE") return "Mùa giải đã kết thúc.";
  if (c.status !== "ACTIVE" || c.actionLocked)
    return "Nhân vật chưa thể xử lý sự kiện. Nếu đang trọng bệnh, hãy điều trị trước.";
  if (state.account.actionPoints < choice.apCost) return "Không đủ AP.";
  if (c.characterSilver < choice.silverCost) return "Không đủ ngân lượng.";
  if (choice.requirements && !meetsEventRequirements(c, choice.requirements))
    return "Chưa đạt yêu cầu của phương án này.";
  // Event snapshots retain their original text, but conversion always rechecks live guards.
  const outcomes =
    choice.result.kind === "FIXED"
      ? [choice.result.outcome]
      : [choice.result.success, choice.result.failure];
  if (
    outcomes.some((o) => o.flags.includes("CONVERT_HAREM")) &&
    (c.branch !== "INNER_COURT" ||
      !["inner_2", "inner_3", "inner_4", "inner_5", "inner_6"].includes(
        c.rankId,
      ) ||
      c.cha < 150 ||
      c.int < 100 ||
      c.suspicion > 45)
  )
    return "Chưa đạt điều kiện nhận sắc phong Hậu cung.";
  return null;
}
function applyOutcome(
  world: EventWorld,
  state: RuntimeState,
  event: CharacterEvent,
  outcome: EventOutcome,
  apCost: number,
  silverCost: number,
  key: string,
  choiceCode: string,
  system: boolean,
  options: EventEngineOptions,
): ActionResult {
  const before = structuredClone(state.character!),
    stage = event.stage;
  const failure =
    event.definition.group === "GREAT_CALAMITY" &&
    outcome.terminal === "FAILURE";
  const gains = { ...outcome.effects };
  if (failure) {
    gains.characterSilver = -Math.ceil(
      (before.characterSilver - silverCost) * B.calamitySilverLoss,
    );
    gains.fav = -B.calamityFavLoss;
  }
  let after = applyActionStats(before, {
    code: outcome.flags.includes("RUMOR_SETTLEMENT")
      ? "RUMOR"
      : "RESOLVE_EVENT",
    name: "Sự kiện",
    description: "",
    type: outcome.type ?? "NORMAL",
    meritGain: 0,
    apCost,
    silverCost,
    hpCost: 0,
    gains,
    dailyCap: 2147483647,
  });
  if (failure || outcome.flags.includes("SEVERELY_ILL")) {
    after.hp = 0;
    after.status = "SEVERELY_ILL";
    after.treatmentsRemaining = TREATMENTS_REQUIRED;
  } // TODO(spec): death outcomes belong to Chặng 5.
  if (event.definition.tags.includes("INVESTIGATION"))
    after.investigationPending = false;
  state.character = after;
  state.account.actionPoints -= apCost;
  state.revision++;
  if (!system)
    state.usage = {
      ...state.usage,
      RESOLVE_EVENT: (state.usage.RESOLVE_EVENT ?? 0) + 1,
    };
  if (outcome.flags.includes("CONVERT_HAREM")) {
    // Keep conversion in the existing pure engine; persistence dispatches the service-only RPC.
    const converted = convertInnerCourtWorld(world, before.id, options);
    Object.assign(world, converted);
    Object.assign(
      state,
      world.states.find((s) => s.account.id === state.account.id)!,
    );
    after = state.character!;
    // Object references changed in the pure conversion clone; continue with the persisted instance.
    event = world.eventData.instances.find((e) => e.id === event.id)!;
  }
  const at = new Date(world.serverNow).toISOString();
  event.history.push({
    stage: event.definition.stages[stage].code,
    outcome: outcome.code,
    text: outcome.text,
    at,
  });
  if (outcome.terminal === "NEXT")
    event.stage = event.definition.stages.findIndex(
      (s) => s.code === outcome.nextStage,
    );
  else {
    event.status = system ? "EXPIRED" : "RESOLVED";
    event.resolvedAt = at;
  }
  // TODO(spec): the original real-time deadline is shared by all calamity stages.
  let destinyAwarded = 0;
  if (
    event.definition.group === "GREAT_CALAMITY" &&
    outcome.terminal === "SUCCESS" &&
    stage === event.definition.stages.length - 1
  ) {
    const calamityCode = event.definition.calamityCode!;
    if (
      !world.eventData.claims.some(
        (claim) =>
          claim.accountId === state.account.id &&
          claim.seasonId === world.season.id &&
          claim.calamityCode === calamityCode,
      )
    ) {
      const claim = {
        accountId: state.account.id,
        seasonId: world.season.id,
        calamityCode,
      };
      world.eventData.claims.push(claim);
      world.eventData.ledger.push({
        ...claim,
        id: newId(options),
        delta: 1,
        reason: "GREAT_CALAMITY",
        reference: event.id,
        createdAt: at,
      });
      state.account.destinyPoints++;
      destinyAwarded = 1;
    }
  }
  const live = world.states.find((s) => s.account.id === state.account.id)!;
  if (live !== state) Object.assign(live, state);
  ensureInvestigation(world, live, options);
  const log: ActionLog = {
    id: newId(options),
    accountId: state.account.id,
    characterId: before.id,
    actionCode: "RESOLVE_EVENT",
    createdAt: at,
    before: statsOf(before),
    after: statsOf(after),
    apSpent: apCost,
    apAfter: state.account.actionPoints,
    modifiers: {
      ...getRiskModifiers(before),
      fatigueMultiplier: before.hp < 20 ? 0.5 : 1,
      resonanceMultiplier:
        outcome.type === "AUDIENCE"
          ? 1 + 0.15 * Math.floor(before.cha / 200)
          : 1,
    },
    worldTime: getWorldTime(
      world.serverNow,
      Date.parse(world.season.seasonStartTimestamp),
    ),
    meritGained: 0,
    meritAfter: after.merit,
    event: {
      eventId: event.id,
      choiceCode,
      title: event.definition.title,
      text: outcome.text,
      stage,
      completed: outcome.terminal !== "NEXT",
      success: outcome.terminal !== "FAILURE",
      destinyAwarded,
      suspicionNarrative:
        after.suspicion < before.suspicion
          ? "Những lời nghi ngại đã lắng bớt."
          : after.suspicion > before.suspicion
            ? "Những ánh nhìn nghi ngại đang nhiều hơn."
            : "",
      expired: system,
    },
  };
  if (
    event.definition.group === "GREAT_CALAMITY" &&
    outcome.terminal === "SUCCESS" &&
    stage === event.definition.stages.length - 1 &&
    destinyAwarded === 0
  ) {
    const text = `${outcome.text} Kiếp nạn này đã được ghi nhận trong mùa; bạn không nhận thêm Điểm Thiên Mệnh.`;
    log.event!.text = text;
    event.history.at(-1)!.text = text;
  }
  const result = { log, message: log.event!.text };
  world.eventData.records.push({
    accountId: state.account.id,
    key,
    payload: { eventId: event.id, choiceCode, stage },
    result,
    system,
    expectedStage: stage,
  });
  return result;
}
export function resolveEvent(
  input: SeatWorld,
  accountId: string,
  choice: ResolveEventInput,
  key: string,
  options: EventEngineOptions = {},
): { world: EventWorld; result: ActionResult } {
  const world = structuredClone(eventWorld(input)),
    state = world.states.find((s) => s.account.id === accountId),
    event = world.eventData.instances.find(
      (e) => e.id === choice.eventId && e.accountId === accountId,
    );
  if (!state || !event)
    throw new GameRuleError("Không tìm thấy sự kiện của bạn.");
  if (choice.stage !== undefined && choice.stage !== event.stage)
    throw new GameRuleError(
      "Giai đoạn sự kiện đã thay đổi. Hãy đồng bộ lại trang.",
    );
  const selected = event.definition.stages[event.stage]?.choices.find(
    (c) => c.code === choice.choiceCode,
  );
  if (!selected) throw new GameRuleError("Phương án không hợp lệ.");
  const lock = eventChoiceLockReason(
    { ...state, serverNow: world.serverNow },
    event,
    selected,
  );
  if (lock) throw new GameRuleError(lock);
  const outcome =
    selected.result.kind === "FIXED"
      ? selected.result.outcome
      : draw(options) <
          eventProbability(state.character!, selected.result.formula)
        ? selected.result.success
        : selected.result.failure;
  const result = applyOutcome(
    world,
    state,
    event,
    outcome,
    selected.apCost,
    selected.silverCost,
    key,
    choice.choiceCode,
    false,
    options,
  );
  afterValidAction(world, accountId, result.log, options);
  return { world, result };
}
export function expireDueEvents(
  input: SeatWorld,
  options: EventEngineOptions = {},
): EventWorld {
  const world = structuredClone(eventWorld(input));
  if (world.season.status !== "ACTIVE") return world;
  const due = world.eventData.instances
    .filter(
      (e) =>
        e.status === "PENDING" && Date.parse(e.expiresAt) <= world.serverNow,
    )
    .sort(
      (a, b) =>
        Date.parse(a.expiresAt) - Date.parse(b.expiresAt) ||
        a.id.localeCompare(b.id),
    );
  for (const original of due) {
    const event = world.eventData.instances.find((e) => e.id === original.id)!,
      state = world.states.find((s) => s.character?.id === event.characterId);
    if (!state || !["ACTIVE", "SEVERELY_ILL"].includes(state.character!.status))
      continue;
    applyOutcome(
      world,
      state,
      event,
      event.definition.stages[event.stage].defaultOutcome,
      0,
      0,
      newId(options),
      "EXPIRED",
      true,
      options,
    );
  }
  return world;
}
export function publicPendingEvents(state: RuntimeState): PublicPendingEvent[] {
  return (state.events ?? [])
    .filter((e) => e.status === "PENDING")
    .map((e) => {
      const stage = e.definition.stages[e.stage];
      return {
        id: e.id,
        code: e.definition.code,
        title: stage.title,
        body: stage.body,
        group: e.definition.group,
        mandatory: e.definition.mandatory,
        stage: e.stage + 1,
        stageCount: e.definition.stages.length,
        expiresAt: e.expiresAt,
        sample: e.definition.status === "SAMPLE_DRAFT",
        choices: stage.choices.map((c) => ({
          code: c.code,
          label: c.label,
          apCost: c.apCost,
          silverCost: c.silverCost,
          lockReason: eventChoiceLockReason(state, e, c),
        })),
      };
    });
}
