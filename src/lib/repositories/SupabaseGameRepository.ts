import { randomBytes, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { GameRepository } from "./GameRepository";
import {
  GameRuleError,
  transitionSetup,
  type SetupCommand,
} from "@/lib/characterGenerator";
import { getWorldTime } from "@/lib/worldClock";
import { utc7Date } from "@/lib/ap";
import { MS_PER_GAME_DAY } from "@/config/balance";
import {
  processAction,
  actionCommitPolicy,
  actionMessage,
} from "@/lib/actionProcessor";
import { ACTIONS, type ActionCode } from "@/config/actions";
import type { ActionLog, ActionResult, RuntimeState } from "@/types/runtime";
import {
  applyForPromotion,
  runDueSeatRounds as processSeatRounds,
  convertInnerCourtWorld,
} from "@/lib/seatEngine";
import { poolsForRank, reservedSeats } from "@/config/seats";
import type { SeatBoardRow } from "@/types/seats";
import { seatProposal, hasSeatChanges } from "@/lib/seatPersistence";
import type { SeatChange, SeatWorld } from "@/types/seats";
import type { Season } from "@/types/game";
import {
  logSupabaseError,
  SEAT_ROUND_WARNING,
  SEAT_BOARD_WARNING,
} from "@/lib/supabaseDiagnostics";
import {
  afterValidAction,
  eventWorld,
  expireDueEvents,
  resolveEvent,
} from "@/lib/eventEngine";
import { eventProposal } from "@/lib/eventPersistence";
import type { EventWorld, ResolveEventInput } from "@/types/events";
import type { CosmeticCommand, CharacterCosmetics } from "@/types/cosmetics";
import {
  cosmeticPolicy,
  processCosmeticCommand,
  parseCosmeticCommand,
} from "@/lib/cosmeticEngine";
export class SupabaseGameRepository implements GameRepository {
  constructor(private db: SupabaseClient) {}
  private failure(message: string): never {
    if (message.includes("EVENT_STAGE_CHANGED"))
      throw new GameRuleError(
        "Giai đoạn sự kiện đã thay đổi. Hãy đồng bộ lại trang.",
      );
    if (message.includes("EVENT_EXPIRED"))
      throw new GameRuleError("Sự kiện đã hết hạn. Hãy đồng bộ lại trang.");
    if (/STALE_REVISION|RETRY_CLOCK/.test(message))
      throw new GameRuleError("Dữ liệu đã thay đổi. Hãy tải lại trang.");
    throw new GameRuleError(
      "Không thể cập nhật dữ liệu. Kiểm tra kết nối và cấu hình Supabase.",
    );
  }
  private async query<T extends { error: unknown }>(
    target: string,
    operation: PromiseLike<T>,
  ): Promise<T> {
    try {
      const result = await operation;
      if (result.error) logSupabaseError(target, result.error);
      return result;
    } catch (error) {
      logSupabaseError(target, error);
      this.failure("Transport unavailable");
    }
  }
  private rpc(name: string, args?: Record<string, unknown>) {
    return this.query(`rpc:${name}`, this.db.rpc(name, args));
  }
  private async trySeatRounds(): Promise<string[]> {
    const warnings: string[] = [];
    try {
      await this.expireEvents();
    } catch (error) {
      logSupabaseError("operation:expireEvents", error);
      warnings.push(
        "Một số sự kiện chưa được đồng bộ. Hồ sơ của bạn vẫn được hiển thị.",
      );
    }
    try {
      await this.runDueSeatRounds();
    } catch (error) {
      logSupabaseError("operation:runDueSeatRounds", error);
      warnings.push(SEAT_ROUND_WARNING);
    }
    return warnings;
  }
  private async loadWorld(): Promise<EventWorld> {
    const { data, error } = await this.rpc("seat_world_load");
    if (error || !data) this.failure(error?.message ?? "Missing world");
    const world = data as SeatWorld;
    world.states = world.states.map(normalizeState);
    return eventWorld(world);
  }
  private async commitWorld(
    change: SeatChange,
    rpc = "commit_seat_world",
    characterId?: string,
  ) {
    const args: Record<string, unknown> = {
      p_version: change.before.version,
      p_proposal: seatProposal(change),
    };
    if (characterId) args.p_character_id = characterId;
    return this.rpc(rpc, args);
  }
  private async expireEvents(): Promise<void> {
    const clock = await this.rpc("event_work_clock");
    if (clock.error || !clock.data)
      this.failure(clock.error?.message ?? "Missing event clock");
    if (!(clock.data as { due: boolean }).due) return;
    for (let attempt = 0; attempt < 8; attempt++) {
      const before = await this.loadWorld(),
        after = expireDueEvents(before, {
          random: secureRandom,
          id: randomUUID,
        });
      if (!hasSeatChanges(before, after)) return;
      const saved = await this.rpc("commit_event_world", {
        p_version: before.version,
        p_proposal: eventProposal(before, after),
      });
      if (!saved.error) return;
      if (!/STALE_REVISION|RETRY_CLOCK/.test(saved.error.message))
        this.failure(saved.error.message);
    }
    throw new GameRuleError("Có nhiều biến cố đồng thời. Vui lòng thử lại.");
  }
  async runDueSeatRounds(): Promise<void> {
    const { data, error } = await this.rpc("seat_world_clock");
    if (error || !data) this.failure(error?.message ?? "Missing world clock");
    if (!(data as { due: boolean }).due) return;
    for (let attempt = 0; attempt < 8; attempt++) {
      const before = await this.loadWorld();
      const after = processSeatRounds(before, {
        random: secureRandom,
        id: randomUUID,
      });
      if (!hasSeatChanges(before, after)) return;
      const saved = await this.commitWorld({
        before,
        after,
        operation: "ROUNDS",
      });
      if (!saved.error) return;
      if (!/STALE_REVISION|RETRY_CLOCK/.test(saved.error.message))
        this.failure(saved.error.message);
    }
    throw new GameRuleError("Triều đình đang xét duyệt. Vui lòng thử lại.");
  }
  async seatBoard(): Promise<SeatBoardRow[]> {
    await this.trySeatRounds();
    return this.readSeatCounts();
  }
  private async readSeatCounts(): Promise<SeatBoardRow[]> {
    const { data, error } = await this.rpc("read_seat_board");
    if (error || !data) this.failure(error?.message ?? "Missing seat counts");
    return (data as SeatBoardRow[]).map((row) => {
      const reserved = poolsForRank(row.rankId).reduce(
        (n, pool) => n + reservedSeats(pool),
        0,
      );
      return {
        ...row,
        reserved,
        available:
          row.total === null
            ? null
            : Math.max(0, row.total - row.occupied - reserved),
      };
    });
  }
  async releaseSeats(characterId: string): Promise<void> {
    await this.expireEvents();
    await this.runDueSeatRounds();
    const { error } = await this.rpc("release_seats", {
      p_character_id: characterId,
    });
    if (error) this.failure(error.message);
  }
  async convertInnerCourtToHarem(characterId: string): Promise<void> {
    await this.expireEvents();
    await this.runDueSeatRounds();
    for (let attempt = 0; attempt < 8; attempt++) {
      const before = await this.loadWorld();
      const after = convertInnerCourtWorld(before, characterId, {
        random: secureRandom,
        id: randomUUID,
      });
      const saved = await this.commitWorld(
        { before, after, operation: "CONVERT", actorId: characterId },
        "convert_inner_court_to_harem",
        characterId,
      );
      if (!saved.error) return;
      if (!/STALE_REVISION|RETRY_CLOCK/.test(saved.error.message))
        this.failure(saved.error.message);
    }
    throw new GameRuleError("Dữ liệu đã thay đổi. Vui lòng thử lại.");
  }
  async activeSeason(): Promise<Season> {
    await this.trySeatRounds();
    const { data, error } = await this.query(
      "table:seasons",
      this.db
        .from("seasons")
        .select("id,name,scenario_code,status,season_start_timestamp,ended_at")
        .eq("status", "ACTIVE")
        .single(),
    );
    if (error || !data) this.failure("Season unavailable");
    return {
      id: data.id,
      name: data.name,
      scenarioCode: data.scenario_code,
      status: data.status,
      seasonStartTimestamp: data.season_start_timestamp,
      endedAt: data.ended_at,
      fictional: true,
    };
  }
  async readState(id: string): Promise<RuntimeState> {
    const warnings = await this.trySeatRounds();
    const state = await this.snapshot(id);
    state.readWarnings = warnings;
    if (state.character?.branch === "HAREM") {
      try {
        const cosmetics = await this.rpc("read_character_cosmetics", {
          p_account_id: id,
        });
        if (cosmetics.error) this.failure(cosmetics.error.message);
        state.cosmetics = cosmetics.data as CharacterCosmetics;
        if (
          !state.cosmetics ||
          state.cosmetics.characterId !== state.character.id
        )
          throw new GameRuleError("Dữ liệu Hậu cung chưa đồng bộ.");
      } catch (error) {
        logSupabaseError("operation:readCharacterCosmetics", error);
        state.cosmetics = null;
        state.readWarnings.push(
          "Chưa đồng bộ được y phục và cung viện. Hồ sơ của bạn vẫn được hiển thị.",
        );
      }
    }
    try {
      state.seatBoard = await this.readSeatCounts();
    } catch {
      state.seatBoard = [];
      state.readWarnings.push(SEAT_BOARD_WARNING);
    }
    return state;
  }
  /** Essential snapshot failures still propagate; never fabricate account/AP data. */
  private async snapshot(id: string): Promise<RuntimeState> {
    const { data, error } = await this.rpc("runtime_snapshot", {
      p_account_id: id,
    });
    if (error || !data) this.failure(error?.message ?? "Missing account");
    return normalizeState(data as RuntimeState);
  }
  async setup(
    id: string,
    command: SetupCommand,
    revision: number,
    key: string,
  ): Promise<RuntimeState> {
    await this.expireEvents();
    await this.runDueSeatRounds();
    const prior = await this.query(
      "table:setup_requests",
      this.db
        .from("setup_requests")
        .select("action,result")
        .eq("account_id", id)
        .eq("request_id", key)
        .maybeSingle(),
    );
    if (prior.error) this.failure(prior.error.message);
    if (prior.data?.result) {
      if (prior.data.action !== command.type)
        throw new GameRuleError("Mã yêu cầu đã dùng cho thao tác khác.");
      return normalizeState(prior.data.result as RuntimeState);
    }
    const state = await this.snapshot(id);
    if (state.revision !== revision)
      throw new GameRuleError("Dữ liệu đã thay đổi. Hãy tải lại trang.");
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
    });
    const { data, error } = await this.rpc("commit_runtime_setup", {
      p_account_id: id,
      p_revision: revision,
      p_key: key,
      p_command: command.type,
      p_candidate: next.character,
      p_requirements: next.character?.promotionRequirements,
      p_game_day: Math.floor(
        Math.max(
          0,
          state.serverNow - Date.parse(state.season.seasonStartTimestamp),
        ) / MS_PER_GAME_DAY,
      ),
    });
    if (error || !data) this.failure(error?.message ?? "Missing result");
    return normalizeState(data as RuntimeState);
  }
  async act(
    id: string,
    code: ActionCode,
    key: string,
    choice?: ResolveEventInput,
  ): Promise<ActionResult> {
    await this.expireEvents();
    await this.runDueSeatRounds();
    const payload = code === "RESOLVE_EVENT" ? (choice ?? null) : null;
    const replay = async (): Promise<ActionResult | null> => {
      const prior = await this.query(
        "table:action_requests",
        this.db
          .from("action_requests")
          .select("action_code,payload,result")
          .eq("account_id", id)
          .eq("idempotency_key", key)
          .maybeSingle(),
      );
      if (prior.error) this.failure(prior.error.message);
      if (!prior.data) return null;
      if (
        prior.data.action_code !== code ||
        (code === "RESOLVE_EVENT" &&
          (prior.data.payload?.eventId !== payload?.eventId ||
            prior.data.payload?.choiceCode !== payload?.choiceCode ||
            (payload?.stage !== undefined &&
              prior.data.payload?.stage !== payload.stage)))
      )
        throw new GameRuleError("Mã yêu cầu đã dùng cho lựa chọn khác.");
      return prior.data.result as ActionResult;
    };
    for (let attempt = 0; attempt < 8; attempt++) {
      const previous = await replay();
      if (previous) return previous;
      const before = await this.loadWorld();
      let after: EventWorld, result: ActionResult;
      try {
        if (code === "RESOLVE_EVENT") {
          if (!choice)
            throw new GameRuleError("Hãy chọn một phương án sự kiện.");
          const changed = resolveEvent(before, id, choice, key, {
            random: secureRandom,
            id: randomUUID,
          });
          after = changed.world;
          result = changed.result;
        } else {
          if (code === "APPLY" || code === "WITHDRAW") {
            const changed = applyForPromotion(before, id, code, {
              random: secureRandom,
              id: randomUUID,
            });
            after = eventWorld(changed.world);
            result = changed.result;
          } else {
            after = structuredClone(before);
            const index = after.states.findIndex((s) => s.account.id === id);
            if (index < 0) throw new GameRuleError("Tài khoản không tồn tại.");
            const computed = processAction(
              after.states[index],
              code,
              randomUUID(),
              secureRandom,
            );
            after.states[index] = computed.state;
            result = {
              log: computed.log,
              message: actionMessage(computed.log),
            };
          }
          if (code !== "WITHDRAW")
            afterValidAction(after, id, result.log, {
              random: secureRandom,
              id: randomUUID,
            });
        }
      } catch (error) {
        const raced = await replay();
        if (raced) return raced;
        throw error;
      }
      const saved = await this.rpc("commit_event_world", {
        p_version: before.version,
        p_proposal: eventProposal(before, after, {
          accountId: id,
          key,
          code,
          payload,
          result,
        }),
      });
      if (!saved.error && saved.data) return saved.data as ActionResult;
      if (!/STALE_REVISION|RETRY_CLOCK/.test(saved.error?.message ?? ""))
        this.failure(saved.error?.message ?? "Missing event result");
      await this.expireEvents();
      await this.runDueSeatRounds();
    }
    throw new GameRuleError("Có nhiều hành động đồng thời. Vui lòng thử lại.");
  }
  async logs(id: string, page: number): Promise<ActionLog[]> {
    await this.trySeatRounds();
    const { data, error } = await this.rpc("read_game_journal", {
      p_account_id: id,
      p_page: page,
    });
    if (error) this.failure(error.message);
    return (data ?? []) as ActionLog[];
  }
  async cosmeticAction(
    id: string,
    command: CosmeticCommand,
    revision: number,
    key: string,
  ): Promise<ActionResult> {
    await this.expireEvents();
    await this.runDueSeatRounds();
    const payload = parseCosmeticCommand(command);
    const replay = async () => {
      const prior = await this.query(
        "table:action_requests",
        this.db
          .from("action_requests")
          .select("action_code,payload,result")
          .eq("account_id", id)
          .eq("idempotency_key", key)
          .maybeSingle(),
      );
      if (prior.error) this.failure(prior.error.message);
      if (
        prior.data &&
        (prior.data.action_code !== "COSMETIC" ||
          JSON.stringify(parseCosmeticCommand(prior.data.payload)) !==
            JSON.stringify(payload))
      )
        throw new GameRuleError("Mã yêu cầu đã dùng cho thao tác khác.");
      return prior.data?.result as ActionResult | undefined;
    };
    for (let attempt = 0; attempt < 8; attempt++) {
      const prior = await replay();
      if (prior) return prior;
      const before = await this.loadWorld(),
        state = before.states.find((s) => s.account.id === id);
      if (!state) throw new GameRuleError("Không tìm thấy tài khoản.");
      if (state.revision !== revision)
        throw new GameRuleError("Dữ liệu đã thay đổi. Hãy đồng bộ lại.");
      let computed: ReturnType<typeof processCosmeticCommand>;
      try {
        computed = processCosmeticCommand(state, command, randomUUID());
      } catch (error) {
        const raced = await replay();
        if (raced) return raced;
        throw error;
      }
      const saved = await this.rpc("commit_cosmetic_action", {
        p_account_id: id,
        p_revision: revision,
        p_version: before.version,
        p_key: key,
        p_command: payload,
        p_candidate: computed.state.cosmetics,
        p_policy: cosmeticPolicy(state, command),
        p_result: computed.result,
      });
      if (!saved.error && saved.data) return saved.data as ActionResult;
      if (!/STALE_REVISION|RETRY_CLOCK/.test(saved.error?.message ?? ""))
        this.failure(saved.error?.message ?? "Missing cosmetic result");
    }
    throw new GameRuleError("Có nhiều thao tác đồng thời. Vui lòng thử lại.");
  }
  async clearCharacterCosmetics(characterId: string): Promise<void> {
    const saved = await this.rpc("clear_character_cosmetics", {
      p_character_id: characterId,
    });
    if (saved.error) this.failure(saved.error.message);
  }
}

function normalizeState(state: RuntimeState): RuntimeState {
  state.meritUsedToday ??= 0;
  if (state.character) {
    state.character.merit ??= 0;
    state.character.rankEnteredAt ??= state.character.confirmedAt;
    state.character.examPassedForRankId ??= null;
    state.character.examPassedGameDay ??= null;
  }
  return state;
}

function secureRandom() {
  return randomBytes(4).readUInt32BE() / 0x100000000;
}
