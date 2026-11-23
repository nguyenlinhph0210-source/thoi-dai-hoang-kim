import { HAREM_BALANCE as B } from "@/config/balance";
import { RANKS } from "@/lib/gameConfig";
import { ConfigurationError } from "@/lib/errors";
import { BRANCHES, type RankTier } from "@/types/game";
import {
  DECOR_SLOTS,
  EQUIPMENT_SLOTS,
  type CosmeticItem,
  type ChamberDecor,
  type Honorific,
  type ChamberLevel,
} from "@/types/cosmetics";
export const SLOT_LABELS = {
  OUTFIT: "Y phục",
  HEAD: "Trâm cài",
  ACCESSORY: "Trang sức",
};
export const DECOR_LABELS = {
  SCREEN: "Bình phong",
  LANTERN: "Đèn lồng",
  TABLE: "Bàn",
  PLANT: "Hoa và cây",
  PAINTING: "Tranh",
  INCENSE: "Lư hương",
};
export const TIER_LABELS = {
  1: "Sơ cấp",
  2: "Trung thấp",
  3: "Trung cao",
  4: "Cao cấp",
  5: "Tối cao",
};
const palette = ["#9b4238", "#9e7c43", "#637763", "#64788a", "#674966"];
function garment(
  slot: CosmeticItem["slot"],
  name: string,
  tier: RankTier,
  index: number,
): CosmeticItem {
  return {
    code: `${slot}_${tier}_${index + 1}`,
    name,
    minTier: tier,
    slot,
    price: B.prices[tier][index],
    branches: ["HAREM"],
    description: `${name}, nét trang nhã dành cho cung viện hư cấu Đại Khánh.`,
    effect: {
      audienceFavPct: B.equipmentPctByTier[tier],
      etiquetteGainPct: B.equipmentPctByTier[tier],
    },
    visual: {
      color: palette[(tier + index - 1) % palette.length],
      accent: "#d9b86b",
      pattern: (["BORDER", "DIAMOND", "WAVES"] as const)[index],
    },
    fictional: true,
    status: "SAMPLE_DRAFT",
  };
}
const outfits: [RankTier, string[]][] = [
  [1, ["Áo lụa viền son", "Áo vạt màu trà", "Áo thêu cánh lá"]],
  [2, ["Áo gấm đường mây", "Áo lụa sắc ngọc", "Áo viền sóng nước"]],
  [3, ["Áo gấm hoa cách điệu", "Áo thêu vân vàng"]],
  [4, ["Phẩm phục vân son", "Phẩm phục hoa ngọc"]],
  [5, ["Lễ phục kim vân", "Lễ phục thêu cánh phượng hư cấu"]],
];
export const HAREM_ITEMS: readonly CosmeticItem[] = [
  ...outfits.flatMap(([tier, names]) =>
    names.map((name, i) =>
      garment("OUTFIT", name, tier, i === names.length - 1 ? 2 : i),
    ),
  ),
  ...([1, 2, 3, 4, 5] as RankTier[]).flatMap((tier) => [
    garment(
      "HEAD",
      [
        "Trâm gỗ khảm đồng",
        "Trâm ngọc lá",
        "Trâm gấm mây",
        "Trâm hoa kim",
        "Trâm vân phượng",
      ][tier - 1],
      tier,
      0,
    ),
    garment(
      "HEAD",
      [
        "Cài lụa đỏ",
        "Cài ngọc sáng",
        "Cài hoa bạc",
        "Cài kim vân",
        "Cài ngọc nhiều tầng",
      ][tier - 1],
      tier,
      2,
    ),
  ]),
  ...([1, 2, 3, 4, 5] as RankTier[]).flatMap((tier) =>
    (tier <= 3 ? [0, 2] : [2]).map((i) =>
      garment(
        "ACCESSORY",
        `${["Chuỗi hạt gỗ", "Vòng ngọc nhỏ", "Chuỗi bạc hoa", "Vòng kim vân", "Chuỗi ngọc lễ"][tier - 1]}${i ? " viền sáng" : ""}`,
        tier,
        i,
      ),
    ),
  ),
];
export const CHAMBER_DECOR: readonly ChamberDecor[] = DECOR_SLOTS.flatMap(
  (slot) =>
    ([0, 1, 2] as const).map((style) => ({
      code: `${slot}_${style}`,
      name: `${DECOR_LABELS[slot]} · ${["Mộc", "Viền son", "Vân ngọc"][style]}`,
      description: [
        "Nét mộc giản dị của cung viện.",
        "Viền son và nét trang trí cân đối.",
        "Sắc ngọc dịu cùng đường vân cách điệu.",
      ][style],
      slot,
      style,
      minTier: B.decorTiers[style],
      price: B.decorPrices[style],
      branches: ["HAREM"],
      color: ["#71523a", "#913e32", "#698578"][style],
      fictional: true,
      status: "SAMPLE_DRAFT",
    })),
);
export const HONORIFICS: readonly Honorific[] = [
  ["MAN", "Mẫn", "Nhanh nhạy, sáng trí (敏)."],
  ["NHU", "Như", "Như, giống như (如)."],
  ["KINH", "Kính", "Kính trọng, cẩn kính (敬)."],
  ["LENH", "Lệnh", "Tốt đẹp, theo nghĩa mỹ từ (令)."],
  ["HIEN", "Hiền", "Có đức, có tài (賢)."],
  ["THUC", "Thục", "Hiền lành, tốt đẹp (淑)."],
  ["HUE", "Huệ", "Nhân ái, ân huệ (惠)."],
  ["DUC", "Đức", "Phẩm hạnh tốt đẹp (德)."],
  ["UYEN", "Uyển", "Dịu dàng, nhã nhặn (婉)."],
].map(([code, name, meaning]) => ({
  code,
  name,
  meaning,
  effect: null,
  branches: ["HAREM"],
  fictional: true,
  status: "SAMPLE_DRAFT",
}));
export const CHAMBER_LEVELS: readonly ChamberLevel[] = B.chamber.map((row) => ({
  ...row,
  code: `CHAMBER_${row.level}`,
  name: `Cung viện cấp ${row.level}`,
  description: "Không gian tĩnh dưỡng hư cấu trong cung Đại Khánh.",
  branches: ["HAREM"],
  effect: {
    restHpPct: Math.min(B.restCapPct, (row.level - 1) * B.restPctPerLevel),
    socializeRepPct: Math.min(
      B.socializeCapPct,
      (row.level - 1) * B.socializePctPerLevel,
    ),
  },
  fictional: true,
  status: "SAMPLE_DRAFT",
}));
export function validateHaremContent(
  items = HAREM_ITEMS,
  decor = CHAMBER_DECOR,
  titles = HONORIFICS,
  levels = CHAMBER_LEVELS,
): void {
  const codes = new Set<string>();
  for (const row of [...items, ...decor, ...titles, ...levels]) {
    if (
      !row.code ||
      codes.has(row.code) ||
      !row.name ||
      !row.branches.includes("HAREM") ||
      row.branches.some((b) => !BRANCHES.includes(b)) ||
      row.fictional !== true ||
      row.status !== "SAMPLE_DRAFT"
    )
      throw new ConfigurationError("Danh mục Hậu cung không hợp lệ.");
    codes.add(row.code);
  }
  for (const row of [...items, ...decor])
    if (
      !row.branches.includes("HAREM") ||
      ![1, 2, 3, 4, 5].includes(row.minTier) ||
      !Number.isSafeInteger(row.price) ||
      row.price < 0
    )
      throw new ConfigurationError("Giá hoặc tầng phẩm không hợp lệ.");
  for (const item of items)
    if (
      !EQUIPMENT_SLOTS.includes(item.slot) ||
      item.price < B.prices[item.minTier][0] ||
      item.price > B.prices[item.minTier][2] ||
      Object.keys(item.effect).length !== 2 ||
      !Number.isInteger(item.effect.audienceFavPct) ||
      !Number.isInteger(item.effect.etiquetteGainPct) ||
      Object.values(item.effect).some(
        (n) => n < 0 || n > B.equipmentCapPct || !Number.isInteger(n),
      )
    )
      throw new ConfigurationError("Hiệu ứng hoặc ô trang bị không hợp lệ.");
  for (const d of decor)
    if (
      !DECOR_SLOTS.includes(d.slot) ||
      ![0, 1, 2].includes(d.style) ||
      d.price !== B.decorPrices[d.style] ||
      d.minTier !== B.decorTiers[d.style]
    )
      throw new ConfigurationError("Tham chiếu bày biện không hợp lệ.");
  for (const level of B.chamber)
    if (
      level.level < 1 ||
      level.level > 5 ||
      level.price < 0 ||
      level.minTier < 1 ||
      level.minTier > 5
    )
      throw new ConfigurationError("Cấu hình cung viện không hợp lệ.");
  for (const slot of DECOR_SLOTS)
    if (
      decor.filter((d) => d.slot === slot).length !== 3 ||
      ![0, 1, 2].every((style) =>
        decor.some(
          (d) =>
            d.slot === slot &&
            d.style === style &&
            (style !== 0 || d.price === 0),
        ),
      )
    )
      throw new ConfigurationError("Thiếu kiểu bày biện.");
  for (const rank of B.titleMilestones)
    if (RANKS[rank]?.branch !== "HAREM")
      throw new ConfigurationError("Mốc ban phong không tồn tại.");
  if (
    levels.length !== 5 ||
    ![1, 2, 3, 4, 5].every((n) =>
      levels.some(
        (l) =>
          l.level === n &&
          l.price === B.chamber[n - 1].price &&
          l.minTier === B.chamber[n - 1].minTier,
      ),
    ) ||
    levels.some(
      (l) =>
        l.effect.restHpPct < 0 ||
        l.effect.restHpPct > B.restCapPct ||
        l.effect.socializeRepPct < 0 ||
        l.effect.socializeRepPct > B.socializeCapPct,
    )
  )
    throw new ConfigurationError("Tham chiếu cấp cung viện không hợp lệ.");
  if (titles.length < 2 || titles.some((t) => !t.meaning || t.effect !== null))
    throw new ConfigurationError("Kho phong hiệu không hợp lệ.");
}
validateHaremContent();
