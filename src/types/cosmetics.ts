import type { Branch, RankTier } from "./game";
export const EQUIPMENT_SLOTS = ["OUTFIT", "HEAD", "ACCESSORY"] as const;
export type EquipmentSlot = (typeof EQUIPMENT_SLOTS)[number];
export const DECOR_SLOTS = [
  "SCREEN",
  "LANTERN",
  "TABLE",
  "PLANT",
  "PAINTING",
  "INCENSE",
] as const;
export type DecorSlot = (typeof DECOR_SLOTS)[number];
export interface CosmeticEffects {
  audienceFavPct: number;
  etiquetteGainPct: number;
  restHpPct: number;
  socializeRepPct: number;
}
export interface CosmeticItem {
  code: string;
  name: string;
  description: string;
  slot: EquipmentSlot;
  minTier: RankTier;
  branches: Branch[];
  price: number;
  effect: Pick<CosmeticEffects, "audienceFavPct" | "etiquetteGainPct">;
  visual: {
    color: string;
    accent: string;
    pattern: "BORDER" | "DIAMOND" | "WAVES";
  };
  fictional: true;
  status: "SAMPLE_DRAFT";
}
export interface ChamberDecor {
  code: string;
  name: string;
  description: string;
  slot: DecorSlot;
  style: 0 | 1 | 2;
  minTier: RankTier;
  branches: Branch[];
  price: number;
  color: string;
  fictional: true;
  status: "SAMPLE_DRAFT";
}
export interface Honorific {
  branches: Branch[];
  code: string;
  name: string;
  meaning: string;
  effect: null;
  fictional: true;
  status: "SAMPLE_DRAFT";
}
export interface ChamberLevel {
  code: string;
  name: string;
  description: string;
  level: number;
  price: number;
  minTier: RankTier;
  branches: Branch[];
  effect: Pick<CosmeticEffects, "restHpPct" | "socializeRepPct">;
  fictional: true;
  status: "SAMPLE_DRAFT";
}
export interface TitleGrant {
  rankId: string;
  titleCode: string;
  grantedAt: string;
}
/** Own-character data only; contains no hidden stats or other players. */
export interface CharacterCosmetics {
  characterId: string;
  ownedItemCodes: string[];
  equipment: Partial<Record<EquipmentSlot, string>>;
  chamber: {
    level: number;
    ownedDecorCodes: string[];
    decor: Record<DecorSlot, string>;
  };
  titles: TitleGrant[];
  purchasesToday: number;
}
export type CosmeticCommand =
  | {
      type: "BUY_ITEM" | "EQUIP_ITEM" | "BUY_DECOR" | "SET_DECOR";
      code: string;
    }
  | { type: "UNEQUIP_ITEM"; slot: EquipmentSlot }
  | { type: "UPGRADE_CHAMBER" };
export interface CosmeticAppearance {
  outfitName?: string;
  headName?: string;
  accessoryName?: string;
  name: string;
  level: number;
  outfit: CosmeticItem["visual"] | null;
  headColor: string | null;
  accessoryColor: string | null;
  decor: Record<DecorSlot, { style: 0 | 1 | 2; color: string }>;
}
