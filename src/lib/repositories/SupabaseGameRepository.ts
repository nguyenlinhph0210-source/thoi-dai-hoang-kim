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
export class SupabaseGameRepository implements GameRepository {
  constructor(private db: SupabaseClient) {}
  private failure(message: string): never {
    if (/STALE_REVISION|RETRY_CLOCK/.test(message))
      throw new GameRuleError("Dữ liệu đã thay đổi. Hãy tải lại trang.");
    throw new GameRuleError(
      "Không thể cập nhật dữ liệu. Kiểm tra kết nối và cấu hình Supabase.",
    );
  }
  private async loadWorld(): Promise<SeatWorld> {
    const { data, error } = await this.db.rpc("seat_world_load");
    if (error || !data) this.failure(error?.message ?? "Missing world");
    const world = data as SeatWorld;
    world.states = world.states.map(normalizeState);
    return world;
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
    return this.db.rpc(rpc, args);
  }
  async runDueSeatRounds(): Promise<void> {
    const { data, error } = await this.db.rpc("seat_world_clock");
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
    await this.runDueSeatRounds();
    const { data, error } = await this.db.rpc("read_seat_board");
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
    await this.runDueSeatRounds();
    const { error } = await this.db.rpc("release_seats", {
      p_character_id: characterId,
    });
    if (error) this.failure(error.message);
  }
  async convertInnerCourtToHarem(characterId: string): Promise<void> {
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
    await this.runDueSeatRounds();
    const { data, error } = await this.db
      .from("seasons")
      .select("id,name,scenario_code,status,season_start_timestamp,ended_at")
      .eq("status", "ACTIVE")
      .single();
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
    await this.runDueSeatRounds();
    const { data, error } = await this.db.rpc("runtime_snapshot", {
      p_account_id: id,
    });
    if (error || !data) this.failure(error?.message ?? "Missing account");
    const state = normalizeState(data as RuntimeState);
    state.seatBoard = await this.seatBoard();
    return state;
  }
  async setup(
    id: string,
    command: SetupCommand,
    revision: number,
    key: string,
  ): Promise<RuntimeState> {
    const prior = await this.db
      .from("setup_requests")
      .select("action,result")
      .eq("account_id", id)
      .eq("request_id", key)
      .maybeSingle();
    if (prior.error) this.failure(prior.error.message);
    if (prior.data?.result) {
      if (prior.data.action !== command.type)
        throw new GameRuleError("Mã yêu cầu đã dùng cho thao tác khác.");
      return normalizeState(prior.data.result as RuntimeState);
    }
    const state = await this.readState(id);
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
    const { data, error } = await this.db.rpc("commit_runtime_setup", {
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
  private async seatAction(
    id: string,
    code: "APPLY" | "WITHDRAW",
    key: string,
  ): Promise<ActionResult> {
    for (let attempt = 0; attempt < 8; attempt++) {
      const replay = await this.db
        .from("action_requests")
        .select("action_code,result")
        .eq("account_id", id)
        .eq("idempotency_key", key)
        .maybeSingle();
      if (replay.error) this.failure(replay.error.message);
      if (replay.data) {
        if (replay.data.action_code !== code)
          throw new GameRuleError("Mã yêu cầu đã dùng cho hành động khác.");
        return replay.data.result as ActionResult;
      }
      const before = await this.loadWorld();
      let computed: ReturnType<typeof applyForPromotion>;
      try {
        computed = applyForPromotion(before, id, code, {
          random: secureRandom,
          id: randomUUID,
        });
      } catch (error) {
        const raced = await this.db
          .from("action_requests")
          .select("action_code,result")
          .eq("account_id", id)
          .eq("idempotency_key", key)
          .maybeSingle();
        if (raced.error) this.failure(raced.error.message);
        if (raced.data) {
          if (raced.data.action_code !== code)
            throw new GameRuleError("Mã yêu cầu đã dùng cho hành động khác.");
          return raced.data.result as ActionResult;
        }
        throw error;
      }
      const saved = await this.commitWorld({
        before,
        after: computed.world,
        operation: code,
        request: { accountId: id, key, code, result: computed.result },
      });
      if (!saved.error && saved.data) return saved.data as ActionResult;
      if (!/STALE_REVISION|RETRY_CLOCK/.test(saved.error?.message ?? ""))
        this.failure(saved.error?.message ?? "Missing seat result");
      await this.runDueSeatRounds();
    }
    throw new GameRuleError("Có nhiều yêu cầu đồng thời. Vui lòng thử lại.");
  }
  async act(id: string, code: ActionCode, key: string): Promise<ActionResult> {
    await this.runDueSeatRounds();
    if (code === "APPLY" || code === "WITHDRAW")
      return this.seatAction(id, code, key);
    for (let attempt = 0; attempt < 5; attempt++) {
      const prior = await this.db
        .from("action_requests")
        .select("action_code,result")
        .eq("account_id", id)
        .eq("idempotency_key", key)
        .maybeSingle();
      if (prior.error) this.failure(prior.error.message);
      if (prior.data) {
        if (prior.data.action_code !== code)
          throw new GameRuleError("Mã yêu cầu đã dùng cho hành động khác.");
        return prior.data.result as ActionResult;
      }
      const state = await this.readState(id);
      let computed: ReturnType<typeof processAction>;
      try {
        computed = processAction(
          state,
          code,
          randomUUID(),
          () => randomBytes(4).readUInt32BE() / 0x100000000,
        );
      } catch (error) {
        // A duplicate may have committed after the first ledger read and spent the last AP.
        const replay = await this.db
          .from("action_requests")
          .select("action_code,result")
          .eq("account_id", id)
          .eq("idempotency_key", key)
          .maybeSingle();
        if (replay.error) this.failure(replay.error.message);
        if (replay.data) {
          if (replay.data.action_code !== code)
            throw new GameRuleError("Mã yêu cầu đã dùng cho hành động khác.");
          return replay.data.result as ActionResult;
        }
        throw error;
      }
      const { state: next, log } = computed;
      const result: ActionResult = {
        log,
        message: actionMessage(log),
      };
      const a = ACTIONS[code];
      const { data, error } = await this.db.rpc("commit_game_action", {
        p_account_id: id,
        p_revision: state.revision,
        p_key: key,
        p_code: code,
        p_proposal: {
          policy: actionCommitPolicy(state, code),
          character: next.character,
          result,
          apCost: a.apCost,
          silverCost: a.silverCost,
          hpCost: a.hpCost,
          dailyCap: a.dailyCap,
          date: utc7Date(state.serverNow),
          gameDay: Math.floor(
            Math.max(
              0,
              state.serverNow - Date.parse(state.season.seasonStartTimestamp),
            ) / MS_PER_GAME_DAY,
          ),
        },
      });
      if (!error && data) return data as ActionResult;
      if (!/STALE_REVISION|RETRY_CLOCK/.test(error?.message ?? ""))
        this.failure(error?.message ?? "Missing result");
    }
    throw new GameRuleError("Có nhiều hành động đồng thời. Vui lòng thử lại.");
  }
  async logs(id: string, page: number): Promise<ActionLog[]> {
    await this.runDueSeatRounds();
    const { data, error } = await this.db.rpc("read_game_journal", {
      p_account_id: id,
      p_page: page,
    });
    if (error) this.failure(error.message);
    return (data ?? []) as ActionLog[];
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
