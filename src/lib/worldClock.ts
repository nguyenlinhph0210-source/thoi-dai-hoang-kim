import {
  DAYS_PER_GAME_MONTH,
  DAYS_PER_GAME_WEEK,
  DAYS_PER_GAME_YEAR,
  MS_PER_GAME_DAY,
} from "@/config/balance";
export interface WorldTime {
  currentGameYear: number;
  currentGameMonth: number;
  currentGameDay: number;
  currentGameWeek: number;
  dayOfYear: number;
  msUntilNextGameDay: number;
}
export function getWorldTime(
  serverNowMs: number,
  seasonStartMs: number,
): WorldTime {
  if (!Number.isFinite(serverNowMs) || !Number.isFinite(seasonStartMs))
    throw new Error("Thời gian không hợp lệ.");
  const elapsedMs = Math.max(0, serverNowMs - seasonStartMs);
  const days = Math.floor(elapsedMs / MS_PER_GAME_DAY);
  const dayOfYear = days % DAYS_PER_GAME_YEAR;
  return {
    currentGameYear: Math.floor(days / DAYS_PER_GAME_YEAR) + 1,
    currentGameMonth: Math.floor(dayOfYear / DAYS_PER_GAME_MONTH) + 1,
    currentGameDay: (dayOfYear % DAYS_PER_GAME_MONTH) + 1,
    currentGameWeek: Math.floor(days / DAYS_PER_GAME_WEEK) + 1,
    dayOfYear,
    msUntilNextGameDay:
      serverNowMs < seasonStartMs
        ? seasonStartMs - serverNowMs + MS_PER_GAME_DAY
        : MS_PER_GAME_DAY - (elapsedMs % MS_PER_GAME_DAY),
  };
}
export function getCharacterAge(
  startAge: number,
  startGameYear: number,
  currentGameYear: number,
): number {
  return startAge + Math.max(0, currentGameYear - startGameYear);
}
