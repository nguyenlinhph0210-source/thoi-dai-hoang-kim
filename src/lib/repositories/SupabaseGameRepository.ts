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
import { MS_PER_GAME_DAY, LOG_PAGE_SIZE } from "@/config/balance";
import { processAction } from "@/lib/actionProcessor";
import { ACTIONS, type ActionCode } from "@/config/actions";
import type { ActionLog, ActionResult, RuntimeState } from "@/types/runtime";
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
  async activeSeason(): Promise<Season> {
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
    const { data, error } = await this.db.rpc("runtime_snapshot", {
      p_account_id: id,
    });
    if (error || !data) this.failure(error?.message ?? "Missing account");
    return data as RuntimeState;
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
      return prior.data.result as RuntimeState;
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
    return data as RuntimeState;
  }
  async act(id: string, code: ActionCode, key: string): Promise<ActionResult> {
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
        computed = processAction(state, code, randomUUID());
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
        message: `${ACTIONS[code].name}: đã hoàn thành (−${log.apSpent} AP).`,
      };
      const a = ACTIONS[code];
      const { data, error } = await this.db.rpc("commit_game_action", {
        p_account_id: id,
        p_revision: state.revision,
        p_key: key,
        p_code: code,
        p_proposal: {
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
    const { data, error } = await this.db
      .from("action_logs")
      .select("result")
      .eq("account_id", id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(page * LOG_PAGE_SIZE, (page + 1) * LOG_PAGE_SIZE);
    if (error) this.failure(error.message);
    return (data ?? []).map((row) => (row.result as ActionResult).log);
  }
}
