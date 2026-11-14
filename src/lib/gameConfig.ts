import type { Branch, CharacterStats, LongTermStat, Origin, Rank, StatKey } from '@/types/game';

export const BRANCH_INFO: Record<Branch, { name: string; subtitle: string; description: string }> = {
  CIVIL: { name: 'Văn giai', subtitle: 'Bút son định quốc', description: 'Lấy tài học làm gốc, dùng thanh danh mở lối chốn triều đường.' },
  MILITARY: { name: 'Võ giai', subtitle: 'Kiếm giữ sơn hà', description: 'Rèn tâm trí cùng võ nghệ, gánh trọng trách gìn giữ giang sơn.' },
  INNER_COURT: { name: 'Nội cung', subtitle: 'Khéo giữ cung quy', description: 'Khởi đầu từ cung nữ, từng bước nắm giữ việc lớn nội đình.' },
  HAREM: { name: 'Hậu cung', subtitle: 'Một bước rèm châu', description: 'Giữa chốn lục viện, dung nghi và tâm kế cùng viết nên vận mệnh.' },
};
export const ORIGIN_INFO: Record<Origin, { name: string; weight: number; description: string; modifiers: Partial<CharacterStats> }> = {
  COMMONER: { name: 'Bình dân', weight: 40, description: 'Từ nếp nhà bình dị, mang theo nghị lực bước vào kinh thành.', modifiers: { hp: 8, characterSilver: -5 } },
  SCHOLAR_FAMILY: { name: 'Gia đình nho học', weight: 30, description: 'Lớn lên bên án sách, thừa hưởng nền nếp thi thư gia truyền.', modifiers: { int: 12, cha: 8 } },
  NOBLE_CLAN: { name: 'Thế gia', weight: 20, description: 'Sau lưng là một dòng họ danh giá, cùng kỳ vọng và những ánh nhìn.', modifiers: { rep: 15, fav: 10, characterSilver: 35, suspicion: 8 } },
  FALLEN_CLAN: { name: 'Gia tộc sa sút', weight: 10, description: 'Gia thanh còn đó, quyết tìm lại vinh quang giữa chốn kinh kỳ.', modifiers: { int: 8, cha: 10, fav: -10, suspicion: 8 } },
};
export type StatRanges = Record<StatKey, readonly [number, number]>;
export const BASE_STAT_RANGES: Record<Branch, StatRanges> = {
  CIVIL: { int: [45, 80], rep: [15, 45], fav: [-20, 30], cha: [35, 80], hp: [70, 95], characterSilver: [25, 80], suspicion: [0, 15] },
  MILITARY: { int: [45, 75], rep: [15, 50], fav: [-20, 25], cha: [30, 75], hp: [80, 100], characterSilver: [20, 70], suspicion: [0, 12] },
  INNER_COURT: { int: [35, 70], rep: [5, 30], fav: [0, 35], cha: [35, 85], hp: [75, 100], characterSilver: [20, 65], suspicion: [0, 12] },
  HAREM: { int: [45, 85], rep: [15, 45], fav: [0, 35], cha: [50, 90], hp: [65, 95], characterSilver: [25, 90], suspicion: [0, 15] },
};
export const STAT_BOUNDS: StatRanges = {
  int: [0, 1000], rep: [0, 1000], fav: [-100, 1000], cha: [0, 1000], hp: [0, 100], suspicion: [0, 100], characterSilver: [0, Number.MAX_SAFE_INTEGER],
};
export const STAT_LABELS: Record<StatKey, string> = { int: 'Tài học / Tâm kế', rep: 'Thanh danh / Quyền thế', fav: 'Thánh sủng / Tín nhiệm', cha: 'Dung mạo / Phong thái', hp: 'Thể lực', characterSilver: 'Ngân lượng', suspicion: 'Nghi Kỵ' };
export function statLabel(stat: StatKey, branch: Branch): string {
  if (stat === 'int') return branch === 'INNER_COURT' || branch === 'HAREM' ? 'Tâm kế' : 'Tài học';
  if (stat === 'rep') return branch === 'INNER_COURT' || branch === 'HAREM' ? 'Quyền thế' : 'Thanh danh';
  if (stat === 'fav') return branch === 'HAREM' ? 'Thánh sủng' : 'Tín nhiệm';
  if (stat === 'cha') return branch === 'HAREM' ? 'Dung mạo' : 'Phong thái';
  return STAT_LABELS[stat];
}
export const THIRD_STAT_WEIGHTS = { C1: 40, C2: 40, HP: 8, SILVER: 8, SUSPICION: 4 } as const;
export const PROMOTION_STATS: Record<Branch, readonly [LongTermStat, LongTermStat, LongTermStat, LongTermStat]> = {
  CIVIL: ['int', 'rep', 'fav', 'cha'], MILITARY: ['int', 'rep', 'fav', 'cha'],
  INNER_COURT: ['int', 'fav', 'rep', 'cha'], HAREM: ['fav', 'rep', 'int', 'cha'],
};
export const SPECIAL_REQUIREMENT_RANGES = {
  1: { hp: [35, 50], characterSilver: [20, 80], suspicion: [60, 75] },
  2: { hp: [45, 60], characterSilver: [80, 200], suspicion: [45, 60] },
  3: { hp: [55, 75], characterSilver: [200, 500], suspicion: [30, 45] },
  4: { hp: [65, 85], characterSilver: [500, 1000], suspicion: [15, 35] },
  5: { hp: [75, 90], characterSilver: [1000, 2000], suspicion: [5, 25] },
} as const;

// AGENTS.md defines the formula, but not per-rank benchmarks or entry minima.
// These are explicit M1 balance defaults, not claimed to be canonical game data.
const initialBenchmarks = { int: 50, rep: 20, fav: 0, cha: 50 };
const nextBenchmarks = { int: 80, rep: 60, fav: 60, cha: 80 };
function rank(id: string, name: string, branch: Branch, nextRankId: string | null, capacity: number | null, next = false): Rank {
  return { id, name, branch, nextRankId, tier: 1, entryMinimums: {}, benchmarks: next ? nextBenchmarks : initialBenchmarks, seatPoolKey: capacity === null ? null : id, seatCapacity: capacity };
}
export const RANKS: Record<string, Rank> = {
  civil_8: rank('civil_8', 'Chính bát phẩm', 'CIVIL', 'civil_7b', 16),
  civil_7b: rank('civil_7b', 'Tòng thất phẩm', 'CIVIL', null, 21, true),
  military_7b: rank('military_7b', 'Tòng thất phẩm', 'MILITARY', 'military_7', 20),
  military_7: rank('military_7', 'Chính thất phẩm', 'MILITARY', null, 14, true),
  inner_1: rank('inner_1', 'Cung nữ sơ tuyển', 'INNER_COURT', 'inner_2', null),
  inner_2: rank('inner_2', 'Cung nữ chính thức', 'INNER_COURT', null, null, true),
  harem_0: rank('harem_0', 'Cung tuyển', 'HAREM', 'harem_14', null),
  harem_14: rank('harem_14', 'Mỹ nhân', 'HAREM', null, null, true),
};
export const INITIAL_RANKS: Record<Branch, Rank> = { CIVIL: RANKS.civil_8, MILITARY: RANKS.military_7b, INNER_COURT: RANKS.inner_1, HAREM: RANKS.harem_0 };
export const DEMO_SEASON_ID = '00000000-0000-4000-8000-000000000001';
