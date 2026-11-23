import { HAREM_BALANCE as B } from "@/config/balance";
import { HAREM_ITEMS, CHAMBER_DECOR, HONORIFICS } from "@/content/harem";
import {
  DECOR_SLOTS,
  type CharacterCosmetics,
  type CosmeticEffects,
  type CosmeticAppearance,
} from "@/types/cosmetics";
import type { Character } from "@/types/game";
import type { RuntimeState } from "@/types/runtime";
import { RANKS } from "./gameConfig";
import { randomInteger, type RandomSource } from "./characterGenerator";
export function emptyCosmetics(characterId: string): CharacterCosmetics {
  return {
    characterId,
    ownedItemCodes: [],
    equipment: {},
    chamber: {
      level: 1,
      ownedDecorCodes: [],
      decor: Object.fromEntries(
        DECOR_SLOTS.map((slot) => [slot, `${slot}_0`]),
      ) as CharacterCosmetics["chamber"]["decor"],
    },
    titles: [],
    purchasesToday: 0,
  };
}
export function cosmeticEffects(state: {
  character: Pick<Character, "id" | "branch" | "rankId"> | null;
  cosmetics?: CharacterCosmetics | null;
}): CosmeticEffects {
  const zero = {
    audienceFavPct: 0,
    etiquetteGainPct: 0,
    restHpPct: 0,
    socializeRepPct: 0,
  };
  const c = state.character,
    data = state.cosmetics;
  if (!c || c.branch !== "HAREM" || !data || data.characterId !== c.id)
    return zero;
  const tier = RANKS[c.rankId].tier;
  for (const [slot, code] of Object.entries(data.equipment)) {
    const item = HAREM_ITEMS.find(
      (i) =>
        i.code === code &&
        i.slot === slot &&
        i.minTier <= tier &&
        i.branches.includes(c.branch),
    );
    if (item && data.ownedItemCodes.includes(item.code)) {
      zero.audienceFavPct += item.effect.audienceFavPct;
      zero.etiquetteGainPct += item.effect.etiquetteGainPct;
    }
  }
  zero.audienceFavPct = Math.min(B.equipmentCapPct, zero.audienceFavPct);
  zero.etiquetteGainPct = Math.min(B.equipmentCapPct, zero.etiquetteGainPct);
  const levels = Math.max(0, Math.min(4, data.chamber.level - 1));
  zero.restHpPct = Math.min(B.restCapPct, levels * B.restPctPerLevel);
  zero.socializeRepPct = Math.min(
    B.socializeCapPct,
    levels * B.socializePctPerLevel,
  );
  return zero;
}
export function grantPromotionTitle(
  state: RuntimeState,
  targetRankId: string,
  at: string,
  random: RandomSource = Math.random,
) {
  // TODO(spec): no retrospective grants for milestones reached before H1; history may repeat, current title may not.
  if (
    state.character?.branch !== "HAREM" ||
    !(B.titleMilestones as readonly string[]).includes(targetRankId)
  )
    return null;
  const data = (state.cosmetics ??= emptyCosmetics(state.character.id));
  if (data.titles.some((t) => t.rankId === targetRankId)) return null;
  const choices = HONORIFICS.filter(
    (t) => t.code !== data.titles.at(-1)?.titleCode,
  );
  const title = choices[randomInteger(0, choices.length - 1, random)];
  const grant = { titleCode: title.code, rankId: targetRankId, grantedAt: at };
  data.titles.push(grant);
  return grant;
}
export function titledRank(
  rankId: string,
  data?: CharacterCosmetics | null,
): string {
  const rank = RANKS[rankId];
  const title =
    rank?.branch === "HAREM"
      ? HONORIFICS.find((t) => t.code === data?.titles.at(-1)?.titleCode)
      : null;
  return `${title ? title.name + " " : ""}${rank?.name ?? "Đã nhập triều"}`;
}
export function cosmeticAppearance(
  rankId: string,
  data?: CharacterCosmetics | null,
): CosmeticAppearance {
  const cosmetics = data ?? emptyCosmetics("");
  const item = (slot: "OUTFIT" | "HEAD" | "ACCESSORY") =>
    HAREM_ITEMS.find((i) => i.code === cosmetics.equipment[slot]);
  return {
    name: titledRank(rankId, data),
    outfitName: item("OUTFIT")?.name,
    headName: item("HEAD")?.name,
    accessoryName: item("ACCESSORY")?.name,
    level: cosmetics.chamber.level,
    outfit: item("OUTFIT")?.visual ?? null,
    headColor: item("HEAD")?.visual.accent ?? null,
    accessoryColor: item("ACCESSORY")?.visual.accent ?? null,
    decor: Object.fromEntries(
      DECOR_SLOTS.map((slot) => {
        const d = CHAMBER_DECOR.find(
          (row) => row.code === cosmetics.chamber.decor[slot],
        )!;
        return [slot, { style: d?.style ?? 0, color: d?.color ?? "#71523a" }];
      }),
    ) as CosmeticAppearance["decor"],
  };
}
