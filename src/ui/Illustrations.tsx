import React, { useId } from "react";
import type { ChamberDecor, CosmeticItem } from "@/types/cosmetics";
import { visualVariant, type StyledAppearance } from "./appearance";

export function AvatarIllustration({
  appearance: a,
  className = "",
}: {
  appearance: StyledAppearance;
  className?: string;
}) {
  const id = useId().replace(/:/g, ""),
    color = a.outfit?.color ?? "#a75f4e",
    gold = a.outfit?.accent ?? "#d7b774",
    variant = visualVariant(a.outfitCode ?? "plain");
  return (
    <svg
      viewBox="0 0 240 380"
      className={`court-avatar ${className}`}
      role="img"
      aria-label={`Hình nhân · ${a.outfitName ?? "Y phục mộc"}${a.headName ? ` · ${a.headName}` : ""}${a.accessoryName ? ` · ${a.accessoryName}` : ""}`}
      data-outfit={a.outfitCode ?? "plain"}
    >
      <defs>
        <linearGradient id={`${id}silk`} x1="0" x2="1">
          <stop stopColor={color} />
          <stop offset=".45" stopColor={color} />
          <stop offset=".7" stopColor={gold} stopOpacity=".22" />
          <stop offset="1" stopColor={color} />
        </linearGradient>
        <linearGradient id={`${id}skin`}>
          <stop stopColor="#ddb796" />
          <stop offset="1" stopColor="#f0ceb0" />
        </linearGradient>
        <pattern
          id={`${id}pattern`}
          width="30"
          height="32"
          patternUnits="userSpaceOnUse"
        >
          <path
            d={
              a.outfit?.pattern === "DIAMOND"
                ? "m15 7 6 8-6 8-6-8z"
                : a.outfit?.pattern === "WAVES"
                  ? "M2 21Q9 7 16 17t13-2M2 26q9-9 17-3"
                  : "M10 20q-9-10 3-10 5-10 10 0 9 3 0 9M13 11v12"
            }
            stroke={gold}
            fill="none"
            opacity=".5"
            strokeWidth=".9"
          />
        </pattern>
      </defs>
      <ellipse cx="120" cy="358" rx="63" ry="9" fill="#201916" opacity=".25" />
      <path
        d="m103 336-5 19q3 9 19 3l4-22m8 0 4 20q6 7 18-1l-6-20"
        fill="#3b2728"
      />
      <path
        d="M92 133Q62 140 43 217L65 228l28-49m57-45q26 5 47 83l-22 13-31-52"
        fill={`url(#${id}silk)`}
        stroke="#654138"
      />
      <path
        d="m45 213-4 18q0 10 8 10l8-13 5-7m116-1 6 20q8 7 10-3l-1-19"
        fill={`url(#${id}skin)`}
      />
      <path
        d="M94 128q25-10 52 0l2 61q8 51 32 152-60 24-118 0 23-107 28-150z"
        fill={`url(#${id}silk)`}
        stroke="#6e473a"
        strokeWidth="1.2"
      />
      <path d="M95 183h49l28 154q-51 17-102 0z" fill={`url(#${id}pattern)`} />
      <path
        d={
          variant === 1
            ? "M93 135 133 174 145 331M147 136l-28 40L90 335"
            : "M93 133l28 40-30 167M146 134l-26 39 28 168"
        }
        fill="none"
        stroke={gold}
        strokeWidth="3"
      />
      <path
        d="m66 339 23 9m82-9-23 9M47 210l19 10m112-1 16-8"
        stroke={gold}
        strokeWidth="5"
      />
      <path d="M89 173q29 8 58 0l2 13q-31 9-62 0z" fill={gold} />
      <path
        d="m120 181 12 9-9 32-8-1 3-29-12-6"
        fill={variant === 2 ? "#f0dbad" : "#78372f"}
      />
      <path d="M110 110v21l11 26 12-26v-21" fill={`url(#${id}skin)`} />
      <ellipse cx="121" cy="86" rx="26" ry="34" fill={`url(#${id}skin)`} />
      <path
        d="M94 87q-10-40 29-42 38 2 25 43-3-21-20-25-11 17-34 16z"
        fill="#281f20"
      />
      <path
        d="M100 59q-20-21 0-27 5-23 29-19 26 4 20 25 17 17-8 26"
        fill="#302327"
      />
      <path
        d="M106 88q5-3 10 0m13 0q5-3 10 0"
        fill="none"
        stroke="#4f3732"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="m119 96-2 5 6 1m-9 7q7 4 14-1"
        fill="none"
        stroke="#ad6e60"
        strokeWidth="1.2"
      />
      <ellipse cx="105" cy="101" rx="6" ry="3" fill="#c7776b" opacity=".2" />
      <ellipse cx="137" cy="101" rx="6" ry="3" fill="#c7776b" opacity=".2" />
      {a.headColor && (
        <g stroke={a.headColor} fill={a.headColor}>
          <path d="m91 34 63 12m-58-6 53 13" strokeWidth="3" />
          <circle cx="145" cy="37" r="5" />
          <path
            d={
              visualVariant(a.headCode ?? "") === 1
                ? "m142 31-5-10 10 3 8-5-1 12 7 8-14-1z"
                : "m141 33-7-6 9-4 5-8 5 9 10 3-10 8-5 8z"
            }
          />
          <path d="m155 43 3 24m-6-23 0 20" fill="none" strokeWidth="1" />
          <circle cx="158" cy="68" r="2" />
        </g>
      )}
      {a.accessoryColor && (
        <g stroke={a.accessoryColor} fill="none" strokeWidth="2">
          <path d="M99 128q22 30 44 0" />
          <path d="M97 88v17m49-17v17" />
          <path d="m119 150-6 8 7 10 7-10z" fill={a.accessoryColor} />
          <circle cx="96" cy="107" r="3" />
          <circle cx="147" cy="107" r="3" />
          <path d="m137 185 10 41-9 10-9-10 4-14" />
          <path d="m133 218 8 0" />
        </g>
      )}
    </svg>
  );
}

/** Every catalog row has a deterministic illustration; no external image resources. */
export function ItemIllustration({
  item,
}: {
  item: CosmeticItem | ChamberDecor;
}) {
  const variant = "style" in item ? item.style : visualVariant(item.code),
    color = "visual" in item ? item.visual.color : item.color,
    gold = "visual" in item ? item.visual.accent : "#d2af6e";
  const isOutfit = item.slot === "OUTFIT";
  return (
    <div
      className={`catalog-art tier-${item.minTier}`}
      data-artwork={item.code}
    >
      {isOutfit ? (
        <AvatarIllustration
          appearance={{
            name: item.name,
            level: 1,
            outfit: (item as CosmeticItem).visual,
            outfitCode: item.code,
            outfitName: item.name,
            headColor: null,
            accessoryColor: null,
            decor: {} as StyledAppearance["decor"],
          }}
        />
      ) : (
        <svg
          viewBox="0 0 180 160"
          role="img"
          aria-label={`Minh họa ${item.name}`}
        >
          <ellipse
            cx="90"
            cy="139"
            rx="50"
            ry="7"
            fill="#38291e"
            opacity=".12"
          />
          {item.slot === "HEAD" ? (
            <g
              stroke={gold}
              fill={color}
              strokeWidth="3"
              transform={`rotate(${variant * 8 - 12} 90 80)`}
            >
              <path d="M39 117 130 52M49 122l90-61" />
              <path
                d={
                  variant === 1
                    ? "m125 40-9-14 17 4 13-7-1 18 13 12-20 2-11 15-5-19-14-9z"
                    : "M114 39q-8-23 9-15 8-23 18-6 23-8 15 11 19 14-2 19-4 23-19 6-23 3-21-15z"
                }
              />
              <circle cx="136" cy="35" r="5" fill={gold} />
              <path
                d="m148 53 6 45m-13-44 0 37"
                fill="none"
                strokeWidth="1.5"
              />
              <circle cx="154" cy="101" r="4" />
            </g>
          ) : item.slot === "ACCESSORY" ? (
            <g stroke={gold} fill="none" strokeWidth="3">
              <path
                d={variant === 1 ? "M44 46q46 91 92 0" : "M45 43q45 122 90 0"}
              />
              {[0, 1, 2, 3, 4].map((i) => (
                <circle
                  key={i}
                  cx={54 + i * 18}
                  cy={i === 0 || i === 4 ? 65 : i === 2 ? 98 : 86}
                  r="4"
                  fill={gold}
                />
              ))}
              <path d="m91 98-17 20 17 22 17-22z" fill={color} />
              <path d="M37 29v27m105-27v27" />
              <circle cx="37" cy="62" r="7" fill={color} />
              <circle cx="142" cy="62" r="7" fill={color} />
            </g>
          ) : (
            <DecorDrawing
              slot={item.slot as ChamberDecor["slot"]}
              style={variant}
              color={color}
              gold={gold}
            />
          )}
        </svg>
      )}
      <span className="catalog-art-mark" aria-hidden="true">
        {["一", "二", "三", "四", "五"][item.minTier - 1]}
      </span>
    </div>
  );
}
function DecorDrawing({
  slot,
  style,
  color,
  gold,
}: {
  slot: ChamberDecor["slot"];
  style: number;
  color: string;
  gold: string;
}) {
  const common = { fill: color, stroke: gold, strokeWidth: 2 };
  if (slot === "SCREEN")
    return (
      <g {...common}>
        {Array.from({ length: style + 2 }, (_, i) => (
          <g
            key={i}
            transform={`translate(${35 + i * (105 / (style + 1))} 32)`}
          >
            <path d="M0 100V0q17-12 34 0v100z" />
            <path d="m7 80 10-23 9 16M17 17v48" fill="none" />
            <path d="M-4 100h43" />
          </g>
        ))}
      </g>
    );
  if (slot === "LANTERN")
    return (
      <g {...common}>
        <path
          d="M90 8v22m-22 0h44M71 115h38m-19 0v28m-5-15v15m10-15v15"
          fill="none"
        />
        {style === 1 ? (
          <ellipse cx="90" cy="73" rx="39" ry="45" />
        ) : (
          <path
            d={
              style === 2
                ? "m60 32-13 32 8 40 35 15 35-15 8-40-13-32z"
                : "M58 32h64v76H58z"
            }
          />
        )}
        <path d="M76 39v60m28-60v60M58 70h64" fill="none" opacity=".7" />
      </g>
    );
  if (slot === "TABLE")
    return (
      <g {...common}>
        {style === 1 ? (
          <ellipse cx="90" cy="68" rx="62" ry="19" />
        ) : (
          <path
            d={
              style === 2
                ? "M30 54h120v24H30zM43 92h94v10H43z"
                : "M30 62h120v16H30z"
            }
          />
        )}
        <path d="M43 78v58m94-58v58M39 136h12m82 0h13" />
        <path d="M73 48h18v14H73zm36 0h17v14h-17z" fill="#e2d4b2" />
      </g>
    );
  if (slot === "PLANT")
    return (
      <g {...common}>
        <path
          d={
            style === 2
              ? "M61 111h61l-9 27H70z"
              : "M69 92h43l7 23-7 24H70l-8-24z"
          }
        />
        <path
          d="M90 96V38M89 68l-25-18m27 30 29-24"
          fill="none"
          stroke="#657154"
          strokeWidth="3"
        />
        {[
          [-20, 0],
          [15, -20],
          [30, 25],
          [-28, 30],
        ].map(([x, y], i) => (
          <ellipse
            key={i}
            cx={90 + x}
            cy={40 + y}
            rx={style === 2 ? 25 : 11}
            ry={style === 1 ? 17 : 10}
            fill={style === 2 ? "#64734f" : i % 2 ? "#bc7e77" : "#e5c394"}
          />
        ))}
      </g>
    );
  if (slot === "PAINTING")
    return (
      <g {...common}>
        {style === 2 ? (
          <circle cx="90" cy="78" r="53" />
        ) : (
          <path d="M44 22h92v112H44z" />
        )}
        <path
          d="M48 116q25-72 42-25 18-54 41 25M68 91V58m-7 13 14-11m32 39V47m-8 17 15-12"
          fill="none"
          stroke="#cabb93"
          strokeWidth="3"
        />
        {style === 1 && <path d="M36 19h108M36 139h108" strokeWidth="7" />}
      </g>
    );
  return (
    <g {...common}>
      <path d="M52 85q38 79 76 0z" />
      {style > 0 && <path d="m50 83 40-25 40 25z" />}
      <path d="M65 123v16m49-16v16M80 68V33m20 35V26" />
      {style === 2 && (
        <path
          d="M55 95Q24 70 46 67m79 28q30-25 8-28"
          fill="none"
          strokeWidth="5"
        />
      )}
      <path d="M80 29q-8-12 2-20m19 13q8-10 0-18" fill="none" opacity=".4" />
    </g>
  );
}
