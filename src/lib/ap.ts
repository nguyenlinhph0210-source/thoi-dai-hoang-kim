import {
  AP_CAP,
  AP_PER_DAY,
  REAL_DAY_MS,
  UTC7_OFFSET_MS,
} from "@/config/balance";
import type { Account } from "@/types/game";
export function utc7Date(nowMs: number): string {
  return new Date(nowMs + UTC7_OFFSET_MS).toISOString().slice(0, 10);
}
export function msUntilApGrant(nowMs: number): number {
  return REAL_DAY_MS - ((nowMs + UTC7_OFFSET_MS) % REAL_DAY_MS);
}
export function grantAp(account: Account, serverNowMs: number): Account {
  const today = utc7Date(serverNowMs);
  // Missing legacy grant date is initialized, never treated as unlimited offline days.
  const last = account.lastApGrantDateUtc7 ?? today;
  const days = Math.max(
    0,
    Math.floor((Date.parse(today) - Date.parse(last)) / REAL_DAY_MS),
  );
  return {
    ...account,
    actionPoints: Math.min(AP_CAP, account.actionPoints + AP_PER_DAY * days),
    lastApGrantDateUtc7: last > today ? last : today,
  };
}
