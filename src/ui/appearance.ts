import { CHAMBER_DECOR, HAREM_ITEMS } from "@/content/harem";
import type { CharacterCosmetics, CosmeticAppearance } from "@/types/cosmetics";

export type PreviewSelection = { kind: "ITEM" | "DECOR"; code: string };
export interface StyledAppearance extends CosmeticAppearance {
  outfitCode?: string;
  headCode?: string;
  accessoryCode?: string;
}
export function visualVariant(code: string): number {
  return (
    [...code].reduce((hash, ch) => (hash * 31 + ch.charCodeAt(0)) >>> 0, 17) % 3
  );
}
/** Presentation only: copies the DTO; never changes equipment, prices, effects or requests. */
export function displayAppearance(
  base: CosmeticAppearance,
  equipment?: CharacterCosmetics["equipment"],
  preview?: PreviewSelection | null,
): StyledAppearance {
  const next: StyledAppearance = {
    ...base,
    decor: Object.fromEntries(
      Object.entries(base.decor).map(([slot, value]) => [slot, { ...value }]),
    ) as StyledAppearance["decor"],
    outfitCode: equipment?.OUTFIT,
    headCode: equipment?.HEAD,
    accessoryCode: equipment?.ACCESSORY,
  };
  if (preview?.kind === "ITEM") {
    const item = HAREM_ITEMS.find((i) => i.code === preview.code);
    if (item?.slot === "OUTFIT") {
      next.outfit = item.visual;
      next.outfitName = item.name;
      next.outfitCode = item.code;
    }
    if (item?.slot === "HEAD") {
      next.headColor = item.visual.accent;
      next.headName = item.name;
      next.headCode = item.code;
    }
    if (item?.slot === "ACCESSORY") {
      next.accessoryColor = item.visual.accent;
      next.accessoryName = item.name;
      next.accessoryCode = item.code;
    }
  } else if (preview?.kind === "DECOR") {
    const item = CHAMBER_DECOR.find((i) => i.code === preview.code);
    if (item) next.decor[item.slot] = { style: item.style, color: item.color };
  }
  return next;
}
