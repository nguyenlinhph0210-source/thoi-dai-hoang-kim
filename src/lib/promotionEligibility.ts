import type { Character, PromotionRequirements, StatKey } from "@/types/game";
import type { WorldTime } from "./worldClock";
import { getWorldTime } from "./worldClock";
import { RANKS } from "./gameConfig";
import {
  BRANCH_TENURE_MULTIPLIER,
  DAYS_PER_GAME_YEAR,
  EXAM_VALID_GAME_DAYS,
  MERIT_REQUIRED_BY_TIER,
  TENURE_DAYS_BY_TIER,
} from "@/config/balance";
export interface PromotionWorldTime extends WorldTime {
  serverNowMs: number;
  seasonStartMs: number;
}
export function promotionWorldTime(
  serverNowMs: number,
  seasonStartMs: number,
): PromotionWorldTime {
  return {
    ...getWorldTime(serverNowMs, seasonStartMs),
    serverNowMs,
    seasonStartMs,
  };
}
export function absoluteGameDay(time: WorldTime): number {
  return (time.currentGameYear - 1) * DAYS_PER_GAME_YEAR + time.dayOfYear;
}
export interface ConditionProgress {
  stat: StatKey;
  operator: ">=" | "<=";
  current: number;
  threshold: number;
  passed: boolean;
  unreachable: boolean;
  ignored: boolean;
  hint: string | null;
}
export interface PromotionProgress {
  currentRankId: string;
  targetRankId: string | null;
  tableVersion: "v1" | "legacy";
  conditions: ConditionProgress[];
  tenure: { current: number; required: number; passed: boolean };
  merit: { current: number; required: number; passed: boolean };
  exam: {
    valid: boolean;
    passedGameDay: number | null;
    expiresGameDay: number | null;
    remainingDays: number;
  };
  underInvestigation: boolean;
  eligibleForExam: boolean;
  eligibleToApply: boolean;
  seatAvailable: "UNKNOWN";
  examBlockReason: string | null;
}
export type PublicPromotionProgress = Omit<PromotionProgress, "conditions"> & {
  conditions: (Omit<ConditionProgress, "current"> & {
    current: number | null;
  })[];
};
export function evaluatePromotionEligibility(
  character: Character,
  requirement: PromotionRequirements | null,
  worldTime: PromotionWorldTime,
): PromotionProgress {
  const rank = RANKS[character.rankId];
  const target = requirement ? RANKS[requirement.targetRankId] : null;
  const linked =
    !!requirement &&
    requirement.characterId === character.id &&
    !!target &&
    target.branch === character.branch &&
    rank?.nextRankId === requirement.targetRankId;
  // TODO(spec): legacy HP/silver rows remain history, but the override removes their eligibility effect.
  // Legacy rows stay immutable. HP/silver are retained for history but never gate eligibility.
  const conditions: ConditionProgress[] = (requirement?.conditions ?? []).map(
    (c) => {
      const ignored = c.stat === "hp" || c.stat === "characterSilver";
      const current = ignored ? 0 : character[c.stat];
      // TODO(spec): define a remedy for a floor that later exceeds locked R; never reroll it.
      const unreachable =
        c.stat === "suspicion" && character.suspicionFloor > c.value;
      return {
        stat: c.stat,
        operator: c.operator,
        current,
        threshold: c.value,
        passed:
          ignored ||
          (c.operator === ">=" ? current >= c.value : current <= c.value),
        unreachable,
        ignored,
        hint: ignored
          ? "Điều kiện cũ đã ngừng xét theo quy tắc mới."
          : unreachable
            ? "Sàn Nghi Kỵ đã vượt ngưỡng; điều kiện không thể đạt trong kiếp này."
            : c.stat === "suspicion" && current > c.value
              ? "Có thể giảm Nghi Kỵ bằng hành động Dẹp tin đồn."
              : null,
      };
    },
  );
  const entered = character.rankEnteredAt ?? character.confirmedAt;
  const tenureDays = entered
    ? absoluteGameDay(getWorldTime(worldTime.serverNowMs, Date.parse(entered)))
    : 0;
  // TODO(spec): round a fractional branch multiplier requirement up to a whole game day.
  const tenureRequired = rank
    ? Math.ceil(
        TENURE_DAYS_BY_TIER[rank.tier] *
          BRANCH_TENURE_MULTIPLIER[character.branch],
      )
    : 0;
  const meritRequired = target ? MERIT_REQUIRED_BY_TIER[target.tier] : 0;
  const day = absoluteGameDay(worldTime);
  const examDay = character.examPassedGameDay ?? null;
  const expires = examDay === null ? null : examDay + EXAM_VALID_GAME_DAYS;
  const valid =
    linked &&
    character.examPassedForRankId === requirement!.targetRankId &&
    examDay !== null &&
    day >= examDay &&
    day < expires!;
  const underInvestigation = character.suspicion >= 80;
  let reason: string | null = null;
  if (!rank?.nextRankId)
    reason = "Đã đạt phẩm cao nhất, không còn phẩm mục tiêu.";
  else if (!linked || conditions.length !== 3)
    reason = "Chưa có bộ điều kiện hợp lệ cho phẩm mục tiêu.";
  else if (character.status !== "ACTIVE" || character.actionLocked)
    reason = "Nhân vật chưa thể thực hiện khảo hạch.";
  else if (underInvestigation) reason = "Đang bị tra xét, chưa được khảo hạch.";
  else if (conditions.some((c) => c.unreachable))
    reason = "Điều kiện Nghi Kỵ không thể đạt do sàn đã vượt ngưỡng.";
  else if (!conditions.every((c) => c.passed))
    reason = "Chưa đạt đủ ba điều kiện chỉ số.";
  else if (tenureDays < tenureRequired) reason = "Chưa đủ thời gian tại vị.";
  else if ((character.merit ?? 0) < meritRequired)
    reason = "Chưa đủ công trạng.";
  return {
    currentRankId: character.rankId,
    targetRankId: rank?.nextRankId
      ? (requirement?.targetRankId ?? rank.nextRankId)
      : null,
    tableVersion: requirement?.tableVersion ?? "legacy",
    conditions,
    tenure: {
      current: tenureDays,
      required: tenureRequired,
      passed: tenureDays >= tenureRequired,
    },
    merit: {
      current: character.merit ?? 0,
      required: meritRequired,
      passed: (character.merit ?? 0) >= meritRequired,
    },
    exam: {
      valid,
      passedGameDay: examDay,
      expiresGameDay: expires,
      remainingDays: valid ? Math.max(0, expires! - day) : 0,
    },
    underInvestigation,
    eligibleForExam: reason === null,
    eligibleToApply: reason === null && valid,
    seatAvailable: "UNKNOWN",
    examBlockReason: reason,
  };
}
export function publicPromotion(
  progress: PromotionProgress,
): PublicPromotionProgress {
  return {
    ...progress,
    conditions: progress.conditions.map((c) => ({
      ...c,
      current: c.stat === "suspicion" || c.ignored ? null : c.current,
    })),
  };
}
