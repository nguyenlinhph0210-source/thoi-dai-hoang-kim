import {
  BRANCHES,
  type Branch,
  type LongTermStat,
  type Rank,
  type RankTier,
} from "@/types/game";
import { ConfigurationError } from "@/lib/errors";
export const PROMOTION_TABLE_VERSION = "v1" as const;
export const THIRD_STAT_WEIGHTS = { C1: 40, C2: 40, SUSPICION: 20 } as const;
export const SUSPICION_REQUIREMENT_RANGES: Record<
  RankTier,
  readonly [number, number]
> = { 1: [60, 75], 2: [45, 60], 3: [30, 45], 4: [15, 35], 5: [5, 25] };
export const PROMOTION_STAT_ORDER: Record<
  Branch,
  readonly [LongTermStat, LongTermStat, LongTermStat, LongTermStat]
> = {
  CIVIL: ["int", "rep", "fav", "cha"],
  MILITARY: ["int", "rep", "fav", "cha"],
  HAREM: ["fav", "rep", "int", "cha"],
  INNER_COURT: ["int", "fav", "rep", "cha"],
};
type Row = readonly [
  suffix: string,
  name: string,
  tier: RankTier,
  a: number,
  b: number,
  c1: number,
  c2: number,
];
const officials: readonly Row[] = [
  ["8", "Chính bát phẩm", 1, 50, 20, -20, 35],
  ["7b", "Tòng thất phẩm", 1, 90, 60, 0, 55],
  ["7", "Chính thất phẩm", 1, 135, 105, 20, 80],
  ["6b", "Tòng lục phẩm", 2, 180, 150, 40, 115],
  ["6", "Chính lục phẩm", 2, 235, 200, 60, 150],
  ["5b", "Tòng ngũ phẩm", 3, 290, 250, 75, 190],
  ["5", "Chính ngũ phẩm", 3, 355, 305, 90, 235],
  ["4b", "Tòng tứ phẩm", 4, 425, 370, 140, 285],
  ["4", "Chính tứ phẩm", 4, 500, 440, 200, 340],
  ["3b", "Tòng tam phẩm", 4, 580, 520, 280, 400],
  ["3", "Chính tam phẩm", 4, 660, 600, 370, 470],
  ["2b", "Tòng nhị phẩm", 5, 740, 685, 470, 550],
  ["2", "Chính nhị phẩm", 5, 820, 775, 580, 630],
  ["1b", "Tòng nhất phẩm", 5, 900, 865, 700, 720],
  ["1", "Chính nhất phẩm", 5, 960, 940, 820, 800],
];
const harem: readonly Row[] = [
  ["0", "Cung tuyển", 1, 0, 15, 35, 50],
  ["14", "Mỹ nhân", 1, 20, 25, 45, 60],
  ["13", "Lương nhân", 1, 50, 50, 70, 85],
  ["12", "Tài nhân", 1, 85, 80, 105, 115],
  ["11", "Tuyên vinh", 1, 130, 120, 140, 150],
  ["10", "Dung hoa", 2, 180, 170, 180, 185],
  ["9", "Tiệp dư", 2, 240, 225, 225, 220],
  ["8", "Sung Nghi", 3, 310, 290, 275, 255],
  ["7", "Tu Nghi", 3, 390, 370, 330, 290],
  ["6", "Chiêu Nghi", 3, 480, 460, 390, 330],
  ["5", "Tần", 4, 580, 550, 455, 375],
  ["4", "Phi", 4, 680, 650, 525, 420],
  ["3", "Quý phi", 5, 780, 755, 610, 500],
  ["2", "Hoàng quý phi", 5, 870, 850, 700, 580],
  ["1", "Hoàng hậu", 5, 950, 940, 800, 660],
];
const inner: readonly Row[] = [
  ["1", "Cung nữ sơ tuyển", 1, 35, 0, 5, 35],
  ["2", "Cung nữ chính thức", 1, 80, 50, 35, 70],
  ["3", "Nữ sử", 1, 160, 120, 85, 125],
  ["4", "Chưởng quan", 2, 260, 210, 160, 190],
  ["5", "Điển quan", 3, 380, 320, 250, 265],
  ["6", "Tư quan", 3, 520, 440, 360, 350],
  ["7", "Lục Thượng và Cung chính", 4, 680, 600, 500, 450],
  ["8", "Tổng quản Lục cục", 5, 850, 780, 680, 560],
];
export function benchmarkDelta(base: number): number {
  if (!Number.isSafeInteger(base))
    throw new ConfigurationError("Điểm chuẩn phải là số nguyên.");
  return base < 100 ? 5 : base < 300 ? 10 : base < 700 ? 12 : 15;
}
export function benchmarkRange(
  stat: LongTermStat,
  base: number,
): readonly [number, number] {
  const d = benchmarkDelta(base);
  return [
    Math.max(stat === "fav" ? -100 : 0, base - d),
    Math.min(1000, base + d),
  ];
}
function catalog(branch: Branch, prefix: string, rows: readonly Row[]): Rank[] {
  const stats = PROMOTION_STAT_ORDER[branch];
  const oldCapacities: Record<string, number> = {
    civil_8: 16,
    civil_7b: 21,
    military_7b: 20,
    military_7: 14,
  };
  return rows.map(([suffix, name, tier, ...values], index) => {
    const id = `${prefix}_${suffix}`;
    const benchmarks = Object.fromEntries(
      stats.map((s, i) => [s, values[i]]),
    ) as Record<LongTermStat, number>;
    return {
      id,
      name,
      branch,
      tier,
      benchmarks,
      nextRankId: rows[index + 1] ? `${prefix}_${rows[index + 1][0]}` : null,
      entryMinimums: {},
      seatPoolKey: oldCapacities[id] ? id : null,
      seatCapacity: oldCapacities[id] ?? null,
    };
  });
}
export const PROMOTION_BENCHMARKS: Record<Branch, readonly Rank[]> = {
  CIVIL: catalog("CIVIL", "civil", officials),
  MILITARY: catalog("MILITARY", "military", officials.slice(1)),
  HAREM: catalog("HAREM", "harem", harem),
  INNER_COURT: catalog("INNER_COURT", "inner", inner),
};
const expectedRows: Record<Branch, readonly Row[]> = {
  CIVIL: officials,
  MILITARY: officials.slice(1),
  HAREM: harem,
  INNER_COURT: inner,
};
const prefixes: Record<Branch, string> = {
  CIVIL: "civil",
  MILITARY: "military",
  HAREM: "harem",
  INNER_COURT: "inner",
};
export function validatePromotionBenchmarks(
  tables: Record<Branch, readonly Rank[]>,
  existing?: Readonly<Record<string, Pick<Rank, "id" | "name" | "branch">>>,
): void {
  const ids = new Set<string>();
  for (const branch of BRANCHES) {
    const rows = tables[branch];
    if (!rows || rows.length !== expectedRows[branch].length)
      throw new ConfigurationError(`Thiếu phẩm của ${branch}.`);
    rows.forEach((r, i) => {
      const expected = expectedRows[branch][i];
      if (
        r.branch !== branch ||
        r.id !== `${prefixes[branch]}_${expected[0]}` ||
        r.name !== expected[1] ||
        r.tier !== expected[2] ||
        ids.has(r.id) ||
        r.nextRankId !== (rows[i + 1]?.id ?? null)
      )
        throw new ConfigurationError("Ánh xạ phẩm trật/tầng không hợp lệ.");
      ids.add(r.id);
      for (const stat of PROMOTION_STAT_ORDER[branch]) {
        const base = r.benchmarks[stat];
        if (
          !Number.isSafeInteger(base) ||
          base < (stat === "fav" ? -100 : 0) ||
          base > 1000
        )
          throw new ConfigurationError("Điểm chuẩn không hợp lệ.");
        // TODO(spec): standard starting rows have no generated R; compare consecutive promotion targets only.
        if (
          i > 1 &&
          benchmarkRange(stat, base)[0] <=
            benchmarkRange(stat, rows[i - 1].benchmarks[stat])[1]
        )
          throw new ConfigurationError(
            `Khoảng ${stat} không tăng nghiêm ngặt tại ${r.id}.`,
          );
      }
    });
  }
  if (existing)
    for (const [id, old] of Object.entries(existing)) {
      const found = Object.values(tables)
        .flat()
        .find((r) => r.id === id);
      if (!found || found.name !== old.name || found.branch !== old.branch)
        throw new ConfigurationError("Không khớp bảng ranks hiện có.");
    }
}
validatePromotionBenchmarks(PROMOTION_BENCHMARKS, {
  civil_8: { id: "civil_8", name: "Chính bát phẩm", branch: "CIVIL" },
  civil_7b: { id: "civil_7b", name: "Tòng thất phẩm", branch: "CIVIL" },
  military_7b: {
    id: "military_7b",
    name: "Tòng thất phẩm",
    branch: "MILITARY",
  },
  military_7: { id: "military_7", name: "Chính thất phẩm", branch: "MILITARY" },
  inner_1: { id: "inner_1", name: "Cung nữ sơ tuyển", branch: "INNER_COURT" },
  inner_2: { id: "inner_2", name: "Cung nữ chính thức", branch: "INNER_COURT" },
  harem_0: { id: "harem_0", name: "Cung tuyển", branch: "HAREM" },
  harem_14: { id: "harem_14", name: "Mỹ nhân", branch: "HAREM" },
});
export const PROMOTION_RANKS: Record<string, Rank> = Object.fromEntries(
  Object.values(PROMOTION_BENCHMARKS)
    .flat()
    .map((r) => [r.id, r]),
);
export const STANDARD_INITIAL_RANKS: Record<Branch, Rank> = {
  CIVIL: PROMOTION_BENCHMARKS.CIVIL[0],
  MILITARY: PROMOTION_BENCHMARKS.MILITARY[0],
  HAREM: PROMOTION_BENCHMARKS.HAREM[0],
  INNER_COURT: PROMOTION_BENCHMARKS.INNER_COURT[0],
};
