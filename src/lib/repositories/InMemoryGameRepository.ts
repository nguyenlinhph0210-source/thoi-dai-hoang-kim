import { randomBytes, randomUUID } from "node:crypto";
import type { GameRepository } from "./GameRepository";
import {
  createAccount,
  GameRuleError,
  transitionSetup,
  type SetupCommand,
} from "@/lib/characterGenerator";
import { INITIAL_AP, LOG_PAGE_SIZE } from "@/config/balance";
import { getCharacterAge, getWorldTime } from "@/lib/worldClock";
import { grantAp, utc7Date } from "@/lib/ap";
import { processAction, actionMessage } from "@/lib/actionProcessor";
import { type ActionCode } from "@/config/actions";
import type { RuntimeState, ActionResult, ActionLog } from "@/types/runtime";
import {
  applyForPromotion,
  runDueSeatRounds as processSeatRounds,
  seatState,
  dueRound,
  seatBoard,
  releaseSeats as releaseAssignments,
  convertInnerCourtWorld,
} from "@/lib/seatEngine";
import type { SeatWorld } from "@/types/seats";
import type { Season } from "@/types/game";

import {
  afterValidAction,
  emptyEventData,
  eventWorld,
  expireDueEvents,
  resolveEvent,
} from "@/lib/eventEngine";
import type { EventData, ResolveEventInput } from "@/types/events";
import { logSupabaseError } from "@/lib/supabaseDiagnostics";
import type { CosmeticCommand } from "@/types/cosmetics";
import { emptyCosmetics } from "@/lib/cosmeticRules";
import {
  processCosmeticCommand,
  parseCosmeticCommand,
} from "@/lib/cosmeticEngine";
export class InMemoryGameRepository implements GameRepository {
  private cosmeticDays = new Map<string, number>();
  private cosmeticCommands = new Map<string, string>();
  private eventData: EventData = emptyEventData();
  private seatData: Pick<
    SeatWorld,
    | "lastRound"
    | "applications"
    | "assignments"
    | "rounds"
    | "history"
    | "requirements"
  > = {
    lastRound: 0,
    applications: [],
    assignments: [],
    rounds: [],
    history: [],
    requirements: [],
  };
  private states = new Map<string, RuntimeState>();
  private usageDays = new Map<
    string,
    Map<string, Partial<Record<ActionCode, number>>>
  >();
  private meritDays = new Map<string, Map<string, number>>();
  private requests = new Map<string, Map<string, ActionResult>>();
  private setupRequests = new Map<string, Map<string, RuntimeState>>();
  private journal = new Map<string, ActionLog[]>();
  private locks = new Map<string, Promise<unknown>>();
  readonly weekMarks = new Map<string, string>();
  readonly season: Season;
  constructor(
    private now: () => number = Date.now,
    private random: () => number = () =>
      randomBytes(4).readUInt32BE() / 0x100000000,
  ) {
    this.season = {
      id: randomUUID(),
      name: "Đại Khánh · Thiên Nguyên",
      scenarioCode: "dai-khanh-thien-nguyen",
      status: "ACTIVE",
      seasonStartTimestamp: new Date(now()).toISOString(),
      endedAt: null,
      fictional: true,
    };
  }
  registerAccount(id: string) {
    if (this.states.has(id)) return;
    this.states.set(id, {
      account: {
        ...createAccount(id),
        actionPoints: INITIAL_AP,
        lastApGrantDateUtc7: utc7Date(this.now()),
      },
      character: null,
      revision: 0,
      processedRequests: [],
      season: this.season,
      serverNow: this.now(),
      usage: {},
      meritUsedToday: 0,
    });
  }
  private serial<T>(id: string, operation: () => Promise<T> | T): Promise<T> {
    id = "world"; // One consistent lock order for actions, rounds, setup and transfers.
    const prior = this.locks.get(id) ?? Promise.resolve();
    const pending = prior.catch(() => undefined).then(operation);
    this.locks.set(id, pending);
    void pending
      .finally(() => {
        if (this.locks.get(id) === pending) this.locks.delete(id);
      })
      .catch(() => undefined);
    return pending;
  }
  private refresh(id: string): RuntimeState {
    const existing = this.states.get(id);
    if (!existing) throw new GameRuleError("Tài khoản không tồn tại.");
    const state = structuredClone(existing);
    state.serverNow = this.now();
    state.season = structuredClone(this.season);
    const account = grantAp(state.account, state.serverNow);
    if (
      account.actionPoints !== state.account.actionPoints ||
      account.lastApGrantDateUtc7 !== state.account.lastApGrantDateUtc7
    )
      state.revision++;
    state.account = account;
    const day = utc7Date(state.serverNow);
    state.meritUsedToday = this.meritDays.get(id)?.get(day) ?? 0;
    state.usage = structuredClone(this.usageDays.get(id)?.get(day) ?? {});
    if (state.character?.branch === "HAREM") {
      if (
        !state.cosmetics ||
        state.cosmetics.characterId !== state.character.id
      )
        state.cosmetics = emptyCosmetics(state.character.id);
      state.cosmetics.purchasesToday =
        this.cosmeticDays.get(`${id}:${day}`) ?? 0;
    }
    if (state.character && state.character.confirmedAt)
      state.character.age = getCharacterAge(
        state.character.startAge,
        state.character.startGameYear,
        getWorldTime(
          state.serverNow,
          Date.parse(state.season.seasonStartTimestamp),
        ).currentGameYear,
      );
    this.states.set(id, state);
    return state;
  }
  private world(): SeatWorld {
    return {
      ...this.seatData,
      eventData: this.eventData,
      version: 0,
      season: this.season,
      serverNow: this.now(),
      states: [...this.states.values()],
    };
  }
  private saveWorld(world: SeatWorld) {
    this.eventData = world.eventData ?? this.eventData;
    for (const record of this.eventData.records) {
      if (!this.requests.has(record.accountId))
        this.requests.set(record.accountId, new Map());
      this.requests
        .get(record.accountId)!
        .set(record.key, structuredClone(record.result));
    }
    const {
      lastRound,
      applications,
      assignments,
      rounds,
      history,
      requirements,
    } = world;
    this.seatData = {
      lastRound,
      applications,
      assignments,
      rounds,
      history,
      requirements,
    };
    for (const s of world.states) this.states.set(s.account.id, s);
  }
  private tick() {
    if (
      this.eventData.instances.some(
        (e) => e.status === "PENDING" && Date.parse(e.expiresAt) <= this.now(),
      )
    )
      this.saveWorld(
        expireDueEvents(this.world(), { random: this.random, id: randomUUID }),
      );
    const world = this.world();
    if (
      dueRound(world) <= world.lastRound &&
      !world.applications.some(
        (a) =>
          a.status === "WAITING" && Date.parse(a.expiresAt) <= world.serverNow,
      )
    )
      return;
    this.saveWorld(
      processSeatRounds(this.world(), { random: this.random, id: randomUUID }),
    );
  }
  private tryTick(): string[] {
    try {
      this.tick();
      return [];
    } catch (error) {
      logSupabaseError("operation:memory_housekeeping", error);
      return [
        "Một số biến cố chưa được đồng bộ. Hồ sơ của bạn vẫn được hiển thị.",
      ];
    }
  }
  async runDueSeatRounds() {
    return this.serial("world", () => this.tick());
  }
  async seatBoard() {
    return this.serial("world", () => {
      this.tryTick();
      return seatBoard(this.world());
    });
  }
  async releaseSeats(characterId: string) {
    return this.serial("world", () => {
      this.tick();
      this.seatData.assignments = releaseAssignments(
        this.seatData.assignments,
        characterId,
        new Date(this.now()).toISOString(),
      );
    });
  }
  async convertInnerCourtToHarem(characterId: string) {
    return this.serial("world", () => {
      this.tick();
      this.saveWorld(
        convertInnerCourtWorld(this.world(), characterId, {
          random: this.random,
          id: randomUUID,
        }),
      );
    });
  }
  async readState(id: string) {
    return this.serial(id, () => {
      const warnings = this.tryTick();
      const state = seatState(this.world(), this.refresh(id));
      state.readWarnings = warnings;
      state.events = this.eventData.instances.filter(
        (e) => e.characterId === state.character?.id && e.status === "PENDING",
      );
      return structuredClone(state);
    });
  }
  async activeSeason() {
    return this.serial("world", () => {
      this.tryTick();
      return structuredClone(this.season);
    });
  }
  async setup(
    id: string,
    command: SetupCommand,
    revision: number,
    key: string,
  ) {
    return this.serial(id, () => {
      this.tick();
      const previous = this.setupRequests.get(id)?.get(key);
      if (previous) return structuredClone(previous);
      const state = this.refresh(id);
      if (state.revision !== revision)
        throw new GameRuleError("Dữ liệu đã thay đổi. Hãy tải lại trang.");
      if (state.season.status !== "ACTIVE")
        throw new GameRuleError("Mùa giải đã kết thúc.");
      const year = getWorldTime(
        state.serverNow,
        Date.parse(state.season.seasonStartTimestamp),
      ).currentGameYear;
      const next = transitionSetup(state, command, {
        id: randomUUID(),
        accountId: id,
        seasonId: state.season.id,
        now: new Date(state.serverNow).toISOString(),
        gameYear: year,
        random: () => randomBytes(4).readUInt32BE() / 0x100000000,
      }) as RuntimeState;
      if (
        command.type === "CONFIRM" &&
        state.character?.status === "DRAFT" &&
        next.character
      ) {
        next.character.startGameYear = year;
        next.character.startAge = next.character.age;
      }
      next.revision = state.revision + 1;
      this.states.set(id, next);
      const destinyDelta =
        next.account.destinyPoints - state.account.destinyPoints;
      if (destinyDelta !== 0)
        this.eventData.ledger.push({
          id: randomUUID(),
          accountId: id,
          seasonId: state.season.id,
          calamityCode: null,
          delta: destinyDelta,
          reason: "REROLL",
          reference: key,
          createdAt: new Date(state.serverNow).toISOString(),
        });
      if (command.type === "CONFIRM" && next.character?.promotionRequirements) {
        const req = next.character.promotionRequirements;
        if (
          !this.seatData.requirements.some(
            (r) =>
              r.characterId === req.characterId &&
              r.targetRankId === req.targetRankId,
          )
        )
          this.seatData.requirements.push(structuredClone(req));
      }
      if (!this.setupRequests.has(id)) this.setupRequests.set(id, new Map());
      this.setupRequests.get(id)!.set(key, structuredClone(next));
      return structuredClone(next);
    });
  }
  async act(
    id: string,
    code: ActionCode,
    key: string,
    choice?: ResolveEventInput,
  ) {
    return this.serial(id, () => {
      this.tick();
      const prior = this.requests.get(id)?.get(key);
      if (prior) {
        const saved = this.eventData.records.find(
          (r) => r.accountId === id && r.key === key,
        );
        if (
          prior.log.actionCode !== code ||
          (code === "RESOLVE_EVENT" &&
            (saved?.payload.eventId !== choice?.eventId ||
              saved?.payload.choiceCode !== choice?.choiceCode ||
              (choice?.stage !== undefined &&
                saved?.payload.stage !== choice.stage)))
        )
          throw new GameRuleError("Mã yêu cầu đã dùng cho hành động khác.");
        return structuredClone(prior);
      }
      const state = this.refresh(id);
      let world = structuredClone(eventWorld(this.world()));
      let result: ActionResult;
      if (code === "RESOLVE_EVENT") {
        if (!choice) throw new GameRuleError("Hãy chọn một phương án sự kiện.");
        const changed = resolveEvent(world, id, choice, key, {
          random: this.random,
          id: randomUUID,
        });
        world = changed.world;
        result = changed.result;
      } else {
        if (code === "APPLY" || code === "WITHDRAW") {
          const changed = applyForPromotion(world, id, code, {
            random: this.random,
            id: randomUUID,
          });
          world = eventWorld(changed.world);
          result = changed.result;
        } else {
          const computed = processAction(
            state,
            code,
            randomUUID(),
            this.random,
          );
          world.states[world.states.findIndex((s) => s.account.id === id)] =
            computed.state;
          result = { log: computed.log, message: actionMessage(computed.log) };
        }
        if (code !== "WITHDRAW")
          afterValidAction(world, id, result.log, {
            random: this.random,
            id: randomUUID,
          });
      }
      this.saveWorld(world);
      const next = world.states.find((s) => s.account.id === id)!;
      const log = result.log;
      this.states.set(id, next);
      if (!this.meritDays.has(id)) this.meritDays.set(id, new Map());
      this.meritDays
        .get(id)!
        .set(utc7Date(state.serverNow), next.meritUsedToday);
      const mark = `${log.characterId}:${state.season.id}:${log.worldTime.currentGameWeek}`;
      if (
        (log.apSpent > 0 || code === "RESOLVE_EVENT") &&
        !this.weekMarks.has(mark)
      )
        this.weekMarks.set(mark, log.id);
      if (!this.usageDays.has(id)) this.usageDays.set(id, new Map());
      this.usageDays
        .get(id)!
        .set(utc7Date(state.serverNow), structuredClone(next.usage));
      if (!this.requests.has(id)) this.requests.set(id, new Map());
      this.requests.get(id)!.set(key, structuredClone(result));
      if (code !== "RESOLVE_EVENT")
        this.journal.set(id, [log, ...(this.journal.get(id) ?? [])]);
      return structuredClone(result);
    });
  }
  async cosmeticAction(
    id: string,
    command: CosmeticCommand,
    revision: number,
    key: string,
  ): Promise<ActionResult> {
    return this.serial(id, () => {
      this.tick();
      const previous = this.requests.get(id)?.get(key),
        payload = JSON.stringify(parseCosmeticCommand(command));
      if (previous) {
        if (
          previous.log.actionCode !== "COSMETIC" ||
          this.cosmeticCommands.get(`${id}:${key}`) !== payload
        )
          throw new GameRuleError("Mã yêu cầu đã dùng cho thao tác khác.");
        return structuredClone(previous);
      }
      const state = this.refresh(id);
      if (state.revision !== revision)
        throw new GameRuleError("Dữ liệu đã thay đổi. Hãy đồng bộ lại.");
      const computed = processCosmeticCommand(state, command, randomUUID());
      this.states.set(id, computed.state);
      this.cosmeticDays.set(
        `${id}:${utc7Date(state.serverNow)}`,
        computed.state.cosmetics!.purchasesToday,
      );
      if (!this.requests.has(id)) this.requests.set(id, new Map());
      this.requests.get(id)!.set(key, structuredClone(computed.result));
      this.cosmeticCommands.set(`${id}:${key}`, payload);
      this.journal.set(id, [
        computed.result.log,
        ...(this.journal.get(id) ?? []),
      ]);
      return structuredClone(computed.result);
    });
  }
  async clearCharacterCosmetics(characterId: string): Promise<void> {
    return this.serial("world", () => {
      const state = [...this.states.values()].find(
        (s) => s.character?.id === characterId,
      );
      if (!state) throw new GameRuleError("Không tìm thấy nhân vật.");
      const d = state.cosmetics;
      if (
        !d ||
        (!d.ownedItemCodes.length &&
          !Object.keys(d.equipment).length &&
          d.chamber.level === 1 &&
          !d.chamber.ownedDecorCodes.length &&
          !d.titles.length)
      )
        return;
      state.cosmetics = emptyCosmetics(characterId);
      state.revision++;
    });
  }
  async logs(id: string, page: number) {
    return this.serial(id, () => {
      this.tryTick();
      return structuredClone(
        [
          ...(this.journal.get(id) ?? []),
          ...this.eventData.records
            .filter((r) => r.accountId === id)
            .map((r) => r.result.log),
          ...this.seatData.history
            .filter((h) => h.accountId === id)
            .map((h) => h.journal),
        ]
          .sort(
            (a, b) =>
              b.createdAt.localeCompare(a.createdAt) ||
              b.id.localeCompare(a.id),
          )
          .slice(page * LOG_PAGE_SIZE, (page + 1) * LOG_PAGE_SIZE + 1),
      );
    });
  }
}
