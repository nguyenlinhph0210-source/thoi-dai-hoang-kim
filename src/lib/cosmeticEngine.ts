import { HAREM_BALANCE as B } from "@/config/balance";
import { HAREM_ITEMS, CHAMBER_DECOR, CHAMBER_LEVELS } from "@/content/harem";
import { EQUIPMENT_SLOTS, type CosmeticCommand } from "@/types/cosmetics";
import type { RuntimeState, ActionResult } from "@/types/runtime";
import { GameRuleError } from "./characterGenerator";
import { RANKS } from "./gameConfig";
import { statsOf } from "./actionProcessor";
import { getRiskModifiers } from "./statEngine";
import { getWorldTime } from "./worldClock";
import { utc7Date } from "./ap";
export function parseCosmeticCommand(value: unknown): CosmeticCommand | null {
  if (
    !value ||
    typeof value !== "object" ||
    !("type" in value) ||
    typeof value.type !== "string"
  )
    return null;
  if (value.type === "UPGRADE_CHAMBER") return { type: value.type };
  if (
    value.type === "UNEQUIP_ITEM" &&
    "slot" in value &&
    EQUIPMENT_SLOTS.includes(value.slot as (typeof EQUIPMENT_SLOTS)[number])
  )
    return {
      type: value.type,
      slot: value.slot as (typeof EQUIPMENT_SLOTS)[number],
    };
  if (
    ["BUY_ITEM", "EQUIP_ITEM", "BUY_DECOR", "SET_DECOR"].includes(value.type) &&
    "code" in value &&
    typeof value.code === "string" &&
    /^[A-Z][A-Z0-9_]{0,63}$/.test(value.code)
  )
    return {
      type: value.type as "BUY_ITEM" | "EQUIP_ITEM" | "BUY_DECOR" | "SET_DECOR",
      code: value.code,
    };
  return null;
}
/** Policy originates in trusted server code; HTTP only accepts command codes/slots. */
export function cosmeticPolicy(state: RuntimeState, command: CosmeticCommand) {
  const item =
    "code" in command
      ? HAREM_ITEMS.find((i) => i.code === command.code)
      : undefined;
  const decor =
    "code" in command
      ? CHAMBER_DECOR.find((i) => i.code === command.code)
      : undefined;
  const upgrade = CHAMBER_LEVELS.find(
    (l) => l.level === (state.cosmetics?.chamber.level ?? 1) + 1,
  );
  const row =
    command.type === "BUY_ITEM" || command.type === "EQUIP_ITEM" ? item : decor;
  return {
    price: command.type.startsWith("BUY_")
      ? (row?.price ?? -1)
      : command.type === "UPGRADE_CHAMBER"
        ? (upgrade?.price ?? -1)
        : 0,
    minTier:
      command.type === "UPGRADE_CHAMBER"
        ? (upgrade?.minTier ?? 6)
        : (row?.minTier ?? 1),
    slot:
      item?.slot ?? decor?.slot ?? ("slot" in command ? command.slot : null),
    cap: B.dailyPurchaseCap,
    nextLevel: upgrade?.level ?? null,
    date: utc7Date(state.serverNow),
  };
}
export function processCosmeticCommand(
  input: RuntimeState,
  command: CosmeticCommand,
  id: string,
): { state: RuntimeState; result: ActionResult } {
  const state = structuredClone(input),
    c = state.character,
    data = state.cosmetics;
  if (!c || c.branch !== "HAREM")
    throw new GameRuleError(
      "Tính năng dành cho Hậu cung. Các nhánh khác sắp ra mắt.",
    );
  if (
    c.status !== "ACTIVE" ||
    c.actionLocked ||
    state.season.status !== "ACTIVE"
  )
    throw new GameRuleError(
      "Nhân vật chưa thể sửa soạn y phục hoặc cung viện.",
    );
  if (!data || data.characterId !== c.id)
    throw new GameRuleError("Chưa đọc được dữ liệu Hậu cung. Hãy đồng bộ lại.");
  const policy = cosmeticPolicy(state, command),
    tier = RANKS[c.rankId].tier;
  if (policy.minTier > tier)
    throw new GameRuleError("Chưa đủ tầng phẩm theo lễ chế.");
  if (policy.price < 0)
    throw new GameRuleError("Mã vật phẩm hoặc cấp cung viện không hợp lệ.");
  if (c.characterSilver < policy.price)
    throw new GameRuleError("Không đủ ngân lượng.");
  const purchase = command.type === "BUY_ITEM" || command.type === "BUY_DECOR";
  if (purchase && data.purchasesToday >= B.dailyPurchaseCap)
    throw new GameRuleError(
      `Đã đạt hạn mức ${B.dailyPurchaseCap} lần mua hôm nay.`,
    );
  const before = statsOf(c);
  let description = "";
  if (command.type === "BUY_ITEM" || command.type === "EQUIP_ITEM") {
    const item = HAREM_ITEMS.find(
      (i) => i.code === command.code && i.branches.includes(c.branch),
    );
    if (!item)
      throw new GameRuleError("Không có món này trong Thượng phục cục.");
    const owned = data.ownedItemCodes.includes(item.code);
    if (command.type === "BUY_ITEM") {
      if (owned) throw new GameRuleError("Bạn đã sở hữu món này.");
      data.ownedItemCodes.push(item.code);
      description = `Đã mua ${item.name}.`;
    } else {
      if (!owned) throw new GameRuleError("Bạn chưa sở hữu món này.");
      if (data.equipment[item.slot] === item.code)
        throw new GameRuleError("Món này đã được trang bị.");
      data.equipment[item.slot] = item.code;
      description = `Đã mặc hoặc cài ${item.name}.`;
    }
  } else if (command.type === "UNEQUIP_ITEM") {
    if (!data.equipment[command.slot])
      throw new GameRuleError("Ô trang bị đang trống.");
    delete data.equipment[command.slot];
    description = "Đã tháo trang bị.";
  } else if (command.type === "UPGRADE_CHAMBER") {
    if (data.chamber.level >= 5)
      throw new GameRuleError("Cung viện đã đạt cấp cao nhất.");
    data.chamber.level++;
    description = `Cung viện đã lên cấp ${data.chamber.level}.`;
  } else {
    const decor = CHAMBER_DECOR.find(
      (d) => d.code === command.code && d.branches.includes(c.branch),
    );
    if (!decor) throw new GameRuleError("Kiểu bày biện không hợp lệ.");
    const owned =
      decor.style === 0 || data.chamber.ownedDecorCodes.includes(decor.code);
    if (command.type === "BUY_DECOR") {
      if (owned) throw new GameRuleError("Bạn đã sở hữu kiểu bày biện này.");
      data.chamber.ownedDecorCodes.push(decor.code);
      description = `Đã mua ${decor.name}.`;
    } else {
      if (!owned) throw new GameRuleError("Bạn chưa sở hữu kiểu bày biện này.");
      if (data.chamber.decor[decor.slot] === decor.code)
        throw new GameRuleError("Kiểu bày biện này đã được chọn.");
      data.chamber.decor[decor.slot] = decor.code;
      description = `Đã bày ${decor.name}.`;
    }
  }
  c.characterSilver -= policy.price;
  if (purchase) data.purchasesToday++;
  state.revision++;
  return {
    state,
    result: {
      message: description,
      log: {
        id,
        accountId: state.account.id,
        characterId: c.id,
        actionCode: "COSMETIC",
        createdAt: new Date(state.serverNow).toISOString(),
        before,
        after: statsOf(c),
        apSpent: 0,
        apAfter: state.account.actionPoints,
        modifiers: {
          ...getRiskModifiers(c),
          fatigueMultiplier: 1,
          resonanceMultiplier: 1,
        },
        worldTime: getWorldTime(
          state.serverNow,
          Date.parse(state.season.seasonStartTimestamp),
        ),
        cosmetic: { command, description },
        meritGained: 0,
        meritAfter: c.merit,
      },
    },
  };
}
