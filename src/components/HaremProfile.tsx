"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { GameView } from "@/types/runtime";
import type { CosmeticCommand } from "@/types/cosmetics";
import { DECOR_SLOTS, EQUIPMENT_SLOTS } from "@/types/cosmetics";
import {
  HAREM_ITEMS,
  CHAMBER_DECOR,
  HONORIFICS,
  CHAMBER_LEVELS,
  SLOT_LABELS,
  DECOR_LABELS,
  TIER_LABELS,
} from "@/content/harem";
import { HAREM_BALANCE as B } from "@/config/balance";
import { cosmeticEffects } from "@/lib/cosmeticRules";
import { parseCosmeticCommand } from "@/lib/cosmeticEngine";
import { RANKS } from "@/lib/gameConfig";
import { ItemIllustration } from "@/ui/Illustrations";
import { CourtIcon, Ornament } from "@/ui/Court";
import type { PreviewSelection } from "@/ui/appearance";
type Pending = {
  command: CosmeticCommand;
  key: string;
  revision: number;
  characterId: string;
};
export default function HaremProfile({
  state,
  preview,
  onPreview,
  disabled,
  onPending,
  onComplete,
  children,
}: {
  state: GameView;
  preview: PreviewSelection | null;
  onPreview: (value: PreviewSelection | null) => void;
  disabled: boolean;
  onPending: (value: boolean) => void;
  onComplete: () => Promise<void>;
  children: ReactNode;
}) {
  const [tab, setTab] = useState("identity"),
    [slot, setSlot] = useState<(typeof EQUIPMENT_SLOTS)[number]>("OUTFIT"),
    [tierFilter, setTierFilter] = useState("ALL");
  const [pending, setPending] = useState<Pending | null>(null),
    [sending, setSending] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const busy = useRef(false),
    c = state.character!,
    data = state.cosmetics;
  const profileRoot = useRef<HTMLDivElement>(null);
  useEffect(() => {
    profileRoot.current?.scrollIntoView({ block: "start" });
  }, [tab]);
  const storageKey = `dnk-cosmetic-${state.account.id}`;
  function remember(value: Pending | null) {
    try {
      if (value) sessionStorage.setItem(storageKey, JSON.stringify(value));
      else sessionStorage.removeItem(storageKey);
    } catch {
      /* Retry remains available in this tab when browser storage is blocked. */
    }
  }
  useEffect(() => {
    try {
      const raw = JSON.parse(
        sessionStorage.getItem(storageKey) ?? "null",
      ) as Partial<Pending> | null;
      const command = parseCosmeticCommand(raw?.command);
      if (
        raw?.characterId === c.id &&
        command &&
        typeof raw.key === "string" &&
        typeof raw.revision === "number"
      ) {
        setPending({
          command,
          key: raw.key,
          revision: raw.revision,
          characterId: c.id,
        });
        setTab("wardrobe");
      } else sessionStorage.removeItem(storageKey);
    } catch {
      /* Private browsing may block storage entirely. */
    }
  }, [c.id, storageKey]);
  useEffect(() => {
    onPending(!!pending);
  }, [pending, onPending]);
  async function submit(command?: CosmeticCommand) {
    if (busy.current || disabled) return;
    const request =
      pending ??
      (command
        ? {
            command,
            key: crypto.randomUUID(),
            revision: state.revision,
            characterId: c.id,
          }
        : null);
    if (!request) return;
    busy.current = true;
    setSending(true);
    setPending(request);
    setError("");
    setMessage("");
    remember(request);
    try {
      const response = await fetch("/api/cosmetics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      const result = (await response.json()) as {
        message?: string;
        error?: string;
        retryable?: boolean;
      };
      if (!response.ok) {
        if (!result.retryable) {
          setPending(null);
          remember(null);
          await onComplete();
        }
        throw new Error(result.error ?? "Thao tác chưa hoàn tất.");
      }
      setPending(null);
      remember(null);
      setMessage(result.message ?? "Đã sửa soạn xong.");
      if (
        request.command.type === "EQUIP_ITEM" ||
        request.command.type === "SET_DECOR" ||
        request.command.type === "UNEQUIP_ITEM"
      )
        onPreview(null);
      await onComplete();
    } catch (failure) {
      setError(
        failure instanceof TypeError || failure instanceof SyntaxError
          ? "Mất kết nối. Hãy thử lại cùng yêu cầu."
          : failure instanceof Error
            ? failure.message
            : "Chưa rõ kết quả. Hãy thử lại.",
      );
    } finally {
      busy.current = false;
      setSending(false);
    }
  }
  const tier = RANKS[c.rankId].tier;
  const effects = cosmeticEffects({ character: c, cosmetics: data });
  const locked = (price: number, minTier: number, owned = false) =>
    owned
      ? "Đã sở hữu"
      : minTier > tier
        ? `Cần tầng ${TIER_LABELS[minTier as 1]}`
        : c.characterSilver < price
          ? "Không đủ ngân lượng"
          : (data?.purchasesToday ?? 0) >= B.dailyPurchaseCap
            ? "Đã hết lượt mua hôm nay"
            : null;
  const unavailable =
    c.status !== "ACTIVE" || c.actionLocked || state.season.status !== "ACTIVE";
  const awaiting = disabled || sending || !!pending || unavailable;
  return (
    <div className="harem-profile" ref={profileRoot}>
      <nav className="profile-subnav" aria-label="Mục Hồ sơ">
        {[
          ["identity", "Thân phận"],
          ["wardrobe", "Y phục"],
          ["chamber", "Cung viện"],
        ].map(([code, name]) => (
          <button
            key={code}
            aria-pressed={tab === code}
            onClick={() => {
              setTab(code);
              onPreview(null);
            }}
          >
            {name}
          </button>
        ))}
      </nav>
      <div hidden={tab !== "identity"}>{children}</div>
      <section
        className={`stage-paper harem-panel ${preview ? "is-trying" : ""}`}
        hidden={tab === "identity"}
      >
        {!preview && (
          <>
            <h2>
              <CourtIcon symbol={tab === "wardrobe" ? "hairpin" : "lantern"} />
              {tab === "wardrobe" ? "Thượng phục cục" : "Cung viện riêng"}
            </h2>
            <Ornament />
          </>
        )}
        {unavailable && c.branch === "HAREM" && (
          <p>
            Nhân vật chưa thể sửa soạn. Nếu đang trọng bệnh, hãy điều trị trước.
          </p>
        )}
        {c.branch !== "HAREM" ? (
          <p>Sắp ra mắt cho nhánh của bạn.</p>
        ) : !data ? (
          <p role="status">
            Chưa đọc được y phục và cung viện. Vui lòng đồng bộ lại.
          </p>
        ) : (
          <>
            {preview &&
              (() => {
                const row = (
                  preview.kind === "ITEM" ? HAREM_ITEMS : CHAMBER_DECOR
                ).find((i) => i.code === preview.code);
                if (!row) return null;
                const owned =
                  preview.kind === "ITEM"
                    ? data.ownedItemCodes.includes(row.code)
                    : ("style" in row && row.style === 0) ||
                      data.chamber.ownedDecorCodes.includes(row.code);
                const reason = owned
                  ? row.minTier > tier
                    ? "Chưa đủ phẩm"
                    : null
                  : locked(row.price, row.minTier);
                return (
                  <div className="tryon-purchase">
                    <strong>Đang thử · {row.name}</strong>
                    <button
                      disabled={awaiting || !!reason}
                      onClick={() =>
                        void submit({
                          type:
                            preview.kind === "ITEM"
                              ? owned
                                ? "EQUIP_ITEM"
                                : "BUY_ITEM"
                              : owned
                                ? "SET_DECOR"
                                : "BUY_DECOR",
                          code: row.code,
                        })
                      }
                    >
                      {owned
                        ? preview.kind === "ITEM"
                          ? "Mặc món đang thử"
                          : "Bày kiểu đang thử"
                        : `Mua món đang thử · ${row.price} lượng`}
                    </button>
                    {reason && <small>{reason}</small>}
                  </div>
                );
              })()}
            <p>
              Ngân lượng: <strong>{c.characterSilver}</strong> lượng · Mua hôm
              nay {data.purchasesToday}/{B.dailyPurchaseCap}
            </p>
            <details className="harem-effect-details">
              <summary>Hiệu ứng đang áp dụng</summary>
              <p className="harem-effects" data-testid="cosmetic-effects">
                Diện kiến +{effects.audienceFavPct}% / trần{B.equipmentCapPct}%
                · Nghi thái +{effects.etiquetteGainPct}% / trần
                {B.equipmentCapPct}% · Nghỉ ngơi +{effects.restHpPct}% · Giao
                thiệp +{effects.socializeRepPct}%
              </p>
              <small>
                Hiệu ứng chỉ tăng thưởng hành động; không cộng vào chỉ số gốc
                hoặc điều kiện thăng phẩm.
              </small>
            </details>
            {tab === "wardrobe" ? (
              <>
                <details
                  className="wardrobe-inventory"
                  open={Object.keys(data.equipment).length > 0}
                >
                  <summary>
                    Tủ đồ · {Object.keys(data.equipment).length}/3 ô đang mặc
                  </summary>
                  {EQUIPMENT_SLOTS.map((s) => (
                    <div className="equipment-slot" key={s}>
                      {(() => {
                        const item = HAREM_ITEMS.find(
                          (i) => i.code === data.equipment[s],
                        );
                        return item ? (
                          <button
                            className="equipped-art"
                            aria-label={`Thử ${item.name}`}
                            onClick={() =>
                              onPreview({ kind: "ITEM", code: item.code })
                            }
                          >
                            <ItemIllustration item={item} />
                          </button>
                        ) : (
                          <CourtIcon
                            symbol={
                              s === "OUTFIT"
                                ? "fan"
                                : s === "HEAD"
                                  ? "hairpin"
                                  : "jade"
                            }
                          />
                        );
                      })()}
                      <span>
                        {SLOT_LABELS[s]}:{" "}
                        {HAREM_ITEMS.find((i) => i.code === data.equipment[s])
                          ?.name ?? "Chưa trang bị"}
                      </span>
                      <button
                        disabled={awaiting || !data.equipment[s]}
                        onClick={() =>
                          void submit({ type: "UNEQUIP_ITEM", slot: s })
                        }
                      >
                        Tháo {SLOT_LABELS[s].toLowerCase()}
                      </button>
                    </div>
                  ))}
                </details>
                <div className="harem-filters">
                  <label>
                    Ô trang bị
                    <select
                      aria-label="Ô trang bị"
                      value={slot}
                      onChange={(e) => setSlot(e.target.value as typeof slot)}
                    >
                      {EQUIPMENT_SLOTS.map((s) => (
                        <option key={s} value={s}>
                          {SLOT_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Tầng phẩm
                    <select
                      aria-label="Tầng phẩm cửa hàng"
                      value={tierFilter}
                      onChange={(e) => setTierFilter(e.target.value)}
                    >
                      <option value="ALL">Tất cả</option>
                      {Object.entries(TIER_LABELS).map(([n, label]) => (
                        <option key={n} value={n}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="harem-shop">
                  {HAREM_ITEMS.filter(
                    (i) =>
                      i.slot === slot &&
                      (tierFilter === "ALL" ||
                        i.minTier === Number(tierFilter)),
                  ).map((item) => {
                    const owned = data.ownedItemCodes.includes(item.code),
                      reason = locked(item.price, item.minTier, owned),
                      equipReason =
                        item.minTier > tier
                          ? "Chưa đủ phẩm"
                          : data.equipment[item.slot] === item.code
                            ? "Đang trang bị"
                            : null;
                    return (
                      <article
                        key={item.code}
                        data-testid={`item-${item.code}`}
                      >
                        <button
                          className="art-preview"
                          aria-label={`Thử ${item.name}`}
                          onClick={() =>
                            onPreview({ kind: "ITEM", code: item.code })
                          }
                        >
                          <ItemIllustration item={item} />
                          <span>Thử đồ</span>
                        </button>
                        <h4>{item.name}</h4>
                        <small>
                          {TIER_LABELS[item.minTier]} · {item.price} lượng
                        </small>
                        <p>{item.description}</p>
                        <small>
                          Thánh sủng +{item.effect.audienceFavPct}% · Nghi thái
                          +{item.effect.etiquetteGainPct}%
                        </small>
                        {owned ? (
                          <button
                            disabled={awaiting || !!equipReason}
                            onClick={() =>
                              void submit({
                                type: "EQUIP_ITEM",
                                code: item.code,
                              })
                            }
                          >
                            {equipReason ?? "Trang bị"}
                          </button>
                        ) : (
                          <button
                            disabled={awaiting || !!reason}
                            onClick={() =>
                              void submit({ type: "BUY_ITEM", code: item.code })
                            }
                          >
                            Mua · {item.price} lượng
                          </button>
                        )}
                        {reason && <small>{reason}</small>}
                      </article>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <h3>Cung viện cấp {data.chamber.level}/5</h3>
                {(() => {
                  const next = CHAMBER_LEVELS.find(
                    (l) => l.level === data.chamber.level + 1,
                  );
                  return next ? (
                    <>
                      <button
                        disabled={
                          awaiting ||
                          next.minTier > tier ||
                          c.characterSilver < next.price
                        }
                        onClick={() => void submit({ type: "UPGRADE_CHAMBER" })}
                      >
                        Nâng cấp · {next.price} lượng
                      </button>
                      <small>
                        Cần {TIER_LABELS[next.minTier]}
                        {next.minTier > tier
                          ? " · Chưa đủ phẩm"
                          : c.characterSilver < next.price
                            ? " · Không đủ bạc"
                            : ""}
                      </small>
                    </>
                  ) : (
                    <p>Đã đạt cấp cao nhất.</p>
                  );
                })()}
                {DECOR_SLOTS.map((s) => (
                  <fieldset className="decor-slot" key={s}>
                    <legend>{DECOR_LABELS[s]}</legend>
                    {CHAMBER_DECOR.filter((d) => d.slot === s).map((d) => {
                      const owned =
                          d.style === 0 ||
                          data.chamber.ownedDecorCodes.includes(d.code),
                        selected = data.chamber.decor[s] === d.code,
                        reason = owned
                          ? d.minTier > tier
                            ? "Chưa đủ phẩm"
                            : null
                          : locked(d.price, d.minTier);
                      return (
                        <div key={d.code} data-testid={`decor-${d.code}`}>
                          <button
                            className="art-preview"
                            aria-label={`Xem thử ${d.name}`}
                            onClick={() =>
                              onPreview({ kind: "DECOR", code: d.code })
                            }
                          >
                            <ItemIllustration item={d} />
                            <span>Xem trong viện</span>
                          </button>
                          <strong>{d.name}</strong>
                          <small>{d.description}</small>
                          <button
                            disabled={awaiting || selected || !!reason}
                            onClick={() =>
                              void submit({
                                type: owned ? "SET_DECOR" : "BUY_DECOR",
                                code: d.code,
                              })
                            }
                          >
                            {selected
                              ? "Đang bày"
                              : owned
                                ? "Bày kiểu này"
                                : `Mua · ${d.price} lượng`}
                          </button>
                          {reason && <small>{reason}</small>}
                        </div>
                      );
                    })}
                  </fieldset>
                ))}
                <h3>Phong hiệu</h3>
                {data.titles.length ? (
                  <ol>
                    {data.titles.map((t) => (
                      <li key={t.rankId}>
                        {HONORIFICS.find((h) => h.code === t.titleCode)?.name} ·{" "}
                        {RANKS[t.rankId]?.name}
                        <small>
                          {
                            HONORIFICS.find((h) => h.code === t.titleCode)
                              ?.meaning
                          }
                        </small>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p>
                    Chưa được ban phong. Phong hiệu được ghi khi lần đầu đạt
                    phẩm mốc.
                  </p>
                )}
              </>
            )}
          </>
        )}
        {sending && <p role="status">Đang sửa soạn…</p>}
        {message && <p role="status">{message}</p>}
        {error && <p role="alert">{error}</p>}
        {pending && !sending && (
          <button disabled={disabled} onClick={() => void submit()}>
            Thử lại thao tác cũ
          </button>
        )}
      </section>
    </div>
  );
}
