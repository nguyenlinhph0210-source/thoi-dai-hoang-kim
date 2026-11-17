import type { Branch } from "@/types/game";
import { ConfigurationError } from "@/lib/errors";
export interface SeatPoolDefinition {
  key: string;
  capacity: number;
  rankIds: string[];
}
const civil: Record<string, number> = {
  8: 16,
  "7b": 21,
  7: 36,
  "6b": 18,
  6: 30,
  "5b": 9,
  5: 12,
  "4b": 5,
  4: 4,
  "3b": 22,
  3: 1,
  "2b": 9,
  2: 3,
  "1b": 3,
};
const military: Record<string, number> = {
  "7b": 20,
  7: 14,
  "6b": 20,
  6: 22,
  "5b": 14,
  5: 21,
  "4b": 9,
  4: 12,
  "3b": 4,
  3: 4,
  "2b": 6,
  2: 6,
  "1b": 5,
};
const harem: Record<string, number> = {
  11: 20,
  10: 15,
  9: 10,
  8: 5,
  7: 5,
  6: 5,
  5: 4,
  4: 4,
  3: 2,
  2: 1,
  1: 1,
};
const inner: Record<string, number> = { 4: 24, 5: 25, 6: 25, 7: 7, 8: 1 };
export const SEAT_POOL_DEFINITIONS: readonly SeatPoolDefinition[] = [
  ...Object.entries(civil).map(([n, capacity]) => ({
    key: `civil_${n}`,
    capacity,
    rankIds: [`civil_${n}`],
  })),
  ...Object.entries(military).map(([n, capacity]) => ({
    key: `military_${n}`,
    capacity,
    rankIds: [`military_${n}`],
  })),
  ...Object.entries(harem).map(([n, capacity]) => ({
    key: `harem_${n}`,
    capacity,
    rankIds: [`harem_${n}`],
  })),
  ...Object.entries(inner).map(([n, capacity]) => ({
    key: `inner_${n}`,
    capacity,
    rankIds: [`inner_${n}`],
  })),
  { key: "tam_thai", capacity: 3, rankIds: ["civil_1", "military_1"] },
  { key: "thai_uy", capacity: 1, rankIds: ["military_1"] },
];
export const RESERVED_SEATS_FOR_NPC: Record<string, number> =
  Object.fromEntries(SEAT_POOL_DEFINITIONS.map((p) => [p.key, 0]));
export const STARTING_RANK_IDS: Record<Branch, string> = {
  CIVIL: "civil_8",
  MILITARY: "military_7b",
  HAREM: "harem_0",
  INNER_COURT: "inner_1",
};
export function poolsForRank(
  rankId: string,
  definitions = SEAT_POOL_DEFINITIONS,
): readonly SeatPoolDefinition[] {
  return definitions.filter((p) => p.rankIds.includes(rankId));
}
export function reservedSeats(
  pool: SeatPoolDefinition,
  reserved = RESERVED_SEATS_FOR_NPC,
): number {
  const count = reserved[pool.key] ?? 0;
  if (!Number.isInteger(count) || count < 0 || count > pool.capacity)
    throw new ConfigurationError("Số ghế NPC dự trữ không hợp lệ.");
  return count;
}
