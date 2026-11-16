import type {
  Branch,
  CharacterStats,
  LongTermStat,
  Origin,
  Rank,
  StatKey,
} from "@/types/game";

export const BRANCH_INFO: Record<
  Branch,
  { name: string; subtitle: string; description: string }
> = {
  CIVIL: {
    name: "Văn giai",
    subtitle: "Bút son định quốc",
    description:
      "Lấy tài học làm gốc, dùng thanh danh mở lối chốn triều đường.",
  },
  MILITARY: {
    name: "Võ giai",
    subtitle: "Kiếm giữ sơn hà",
    description:
      "Rèn tâm trí cùng võ nghệ, gánh trọng trách gìn giữ giang sơn.",
  },
  INNER_COURT: {
    name: "Nội cung",
    subtitle: "Khéo giữ cung quy",
    description: "Khởi đầu từ cung nữ, từng bước nắm giữ việc lớn nội đình.",
  },
  HAREM: {
    name: "Hậu cung",
    subtitle: "Một bước rèm châu",
    description:
      "Giữa chốn lục viện, dung nghi và tâm kế cùng viết nên vận mệnh.",
  },
};
export const ORIGIN_INFO: Record<
  Origin,
  {
    name: string;
    weight: number;
    description: string;
    modifiers: Partial<CharacterStats>;
  }
> = {
  COMMONER: {
    name: "Bình dân",
    weight: 40,
    description: "Từ nếp nhà bình dị, mang theo nghị lực bước vào kinh thành.",
    modifiers: { hp: 8, characterSilver: -5 },
  },
  SCHOLAR_FAMILY: {
    name: "Gia đình nho học",
    weight: 30,
    description: "Lớn lên bên án sách, thừa hưởng nền nếp thi thư gia truyền.",
    modifiers: { int: 12, cha: 8 },
  },
  NOBLE_CLAN: {
    name: "Thế gia",
    weight: 20,
    description:
      "Sau lưng là một dòng họ danh giá, cùng kỳ vọng và những ánh nhìn.",
    modifiers: { rep: 15, fav: 10, characterSilver: 35, suspicion: 8 },
  },
  FALLEN_CLAN: {
    name: "Gia tộc sa sút",
    weight: 10,
    description:
      "Gia thanh còn đó, quyết tìm lại vinh quang giữa chốn kinh kỳ.",
    modifiers: { int: 8, cha: 10, fav: -10, suspicion: 8 },
  },
};
export type StatRanges = Record<StatKey, readonly [number, number]>;
export const BASE_STAT_RANGES: Record<Branch, StatRanges> = {
  CIVIL: {
    int: [45, 80],
    rep: [15, 45],
    fav: [-20, 30],
    cha: [35, 80],
    hp: [70, 95],
    characterSilver: [25, 80],
    suspicion: [0, 15],
  },
  MILITARY: {
    int: [45, 75],
    rep: [15, 50],
    fav: [-20, 25],
    cha: [30, 75],
    hp: [80, 100],
    characterSilver: [20, 70],
    suspicion: [0, 12],
  },
  INNER_COURT: {
    int: [35, 70],
    rep: [5, 30],
    fav: [0, 35],
    cha: [35, 85],
    hp: [75, 100],
    characterSilver: [20, 65],
    suspicion: [0, 12],
  },
  HAREM: {
    int: [45, 85],
    rep: [15, 45],
    fav: [0, 35],
    cha: [50, 90],
    hp: [65, 95],
    characterSilver: [25, 90],
    suspicion: [0, 15],
  },
};
export const STAT_BOUNDS: StatRanges = {
  int: [0, 1000],
  rep: [0, 1000],
  fav: [-100, 1000],
  cha: [0, 1000],
  hp: [0, 100],
  suspicion: [0, 100],
  characterSilver: [0, Number.MAX_SAFE_INTEGER],
};
export const STAT_LABELS: Record<StatKey, string> = {
  int: "Tài học / Tâm kế",
  rep: "Thanh danh / Quyền thế",
  fav: "Thánh sủng / Tín nhiệm",
  cha: "Dung mạo / Phong thái",
  hp: "Thể lực",
  characterSilver: "Ngân lượng",
  suspicion: "Nghi Kỵ",
};
export function statLabel(stat: StatKey, branch: Branch): string {
  if (stat === "int")
    return branch === "INNER_COURT" || branch === "HAREM"
      ? "Tâm kế"
      : "Tài học";
  if (stat === "rep")
    return branch === "INNER_COURT" || branch === "HAREM"
      ? "Quyền thế"
      : "Thanh danh";
  if (stat === "fav") return branch === "HAREM" ? "Thánh sủng" : "Tín nhiệm";
  if (stat === "cha") return branch === "HAREM" ? "Dung mạo" : "Phong thái";
  return STAT_LABELS[stat];
}
export {
  THIRD_STAT_WEIGHTS,
  SUSPICION_REQUIREMENT_RANGES,
  PROMOTION_STAT_ORDER as PROMOTION_STATS,
  PROMOTION_RANKS as RANKS,
  STANDARD_INITIAL_RANKS as INITIAL_RANKS,
} from "@/config/promotionBenchmarks";
export const DEMO_SEASON_ID = "00000000-0000-4000-8000-000000000001";
