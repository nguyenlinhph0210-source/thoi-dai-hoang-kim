import { AvatarIllustration } from "./Illustrations";
import type { StyledAppearance } from "./appearance";
/** The fallback is a complete layered illustration, not a loading placeholder. */
export default function PalaceBackdrop2D({
  appearance,
  cameraView,
  hidden,
}: {
  appearance?: StyledAppearance;
  cameraView: "portrait" | "wide" | "close";
  hidden: boolean;
}) {
  return (
    <div className="palace-flat" data-view={cameraView} aria-hidden={hidden}>
      <svg
        className="flat-room"
        viewBox="0 0 1000 800"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="room-wall" x2="0" y2="1">
            <stop stopColor="#79604b" />
            <stop offset="1" stopColor="#b89b75" />
          </linearGradient>
          <radialGradient id="room-light">
            <stop stopColor="#fbebc9" />
            <stop offset="1" stopColor="#ccb68a" />
          </radialGradient>
          <pattern
            id="room-lattice"
            width="34"
            height="34"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="m17 0 17 17-17 17L0 17z"
              fill="none"
              stroke="#7f5d3e"
              strokeWidth="2"
            />
          </pattern>
        </defs>
        <path fill="url(#room-wall)" d="M0 0h1000v800H0z" />
        <path fill="#694939" d="M0 560h1000v240H0z" />
        <path
          d="m0 800 150-240m70 240 70-240m220 240V560m220 240-70-240m290 240L850 560M0 620h1000M0 710h1000"
          fill="none"
          stroke="#b58c5f"
          opacity=".35"
          strokeWidth="2"
        />
        {[95, 660].map((x) => (
          <g key={x}>
            <path d={`M${x} 135h245v310H${x}z`} fill="url(#room-light)" />
            <path
              d={`M${x} 135h245v310H${x}z`}
              fill="url(#room-lattice)"
              stroke="#493323"
              strokeWidth="12"
            />
            <path d={`M${x - 10} 455h265`} stroke="#d5b97a" strokeWidth="7" />
          </g>
        ))}
        {[20, 355, 625, 960].map((x) => (
          <g key={x}>
            <path d={`M${x} 30h25v540H${x}z`} fill="#783f33" />
            <path d={`M${x + 5} 40v510`} stroke="#ad6450" strokeWidth="3" />
            <path d={`M${x - 2} 535h29`} stroke="#b7975e" strokeWidth="10" />
          </g>
        ))}
        <path
          d="M0 65q260 60 500 0 260 60 500 0v34q-260 60-500 0-240 60-500 0z"
          fill="#763f31"
          stroke="#c1a466"
          strokeWidth="3"
        />
        {[-1, 1].map((side) => (
          <g key={side} transform={`translate(${500 + side * 365} 145)`}>
            <path d="M0-60V0" stroke="#d9b97a" />
            {(appearance?.decor.LANTERN.style ?? 0) === 1 ? (
              <ellipse
                cx="0"
                cy="44"
                rx="39"
                ry="47"
                fill={appearance?.decor.LANTERN.color ?? "#914e3c"}
                stroke="#d3ae66"
                strokeWidth="3"
              />
            ) : (
              <path
                d={
                  (appearance?.decor.LANTERN.style ?? 0) === 0
                    ? "M-34 0h68v88h-68z"
                    : "m-35 0-9 48 10 43h68l10-43-9-48z"
                }
                fill={appearance?.decor.LANTERN.color ?? "#914e3c"}
                stroke="#d3ae66"
                strokeWidth="3"
              />
            )}
            <path
              d="M-22 8v76M0 3v82m22-77v76M0 92v49"
              stroke="#d3ae66"
              strokeWidth="2"
            />
          </g>
        ))}
        <path
          d="M60 510h255v25H60zM72 535v80m230-80v80"
          fill="#4f3326"
          stroke="#b89557"
          strokeWidth="6"
        />
        {Array.from(
          { length: (appearance?.decor.SCREEN.style ?? 0) + 2 },
          (_, i) => (
            <path
              key={i}
              d={`M${70 + i * 53} 505V300q25-30 50 0v205z`}
              fill={appearance?.decor.SCREEN.color ?? "#71523a"}
              stroke="#b99d67"
              strokeWidth="3"
            />
          ),
        )}
        {(appearance?.decor.TABLE.style ?? 0) === 1 && (
          <ellipse
            cx="820"
            cy="563"
            rx="100"
            ry="23"
            fill={appearance?.decor.TABLE.color ?? "#71523a"}
            stroke="#a88a57"
            strokeWidth="4"
          />
        )}
        <path
          d={
            (appearance?.decor.TABLE.style ?? 0) === 2
              ? "M725 555h190v17H725zM745 572v75m150-75v75M745 615h150v10H745z"
              : "M725 565h190v17H725zM745 582v65m150-65v65"
          }
          fill={appearance?.decor.TABLE.color ?? "#71523a"}
          stroke="#a88a57"
          strokeWidth="4"
        />
        <path
          d="M795 535q-13 25 10 28h29q23-3 10-28z"
          fill={appearance?.decor.PLANT.color ?? "#85927a"}
        />
        <path
          d="M820 540v-65m0 35-22-20m22 7 24-21"
          stroke="#607456"
          strokeWidth="4"
        />
        {(appearance?.decor.PLANT.style ?? 0) === 2 ? (
          <g fill="#67775a">
            <ellipse cx="797" cy="487" rx="24" ry="12" />
            <ellipse cx="824" cy="468" rx="27" ry="14" />
            <ellipse cx="846" cy="482" rx="22" ry="12" />
          </g>
        ) : (
          <g>
            <circle
              cx="800"
              cy="490"
              r={(appearance?.decor.PLANT.style ?? 0) === 1 ? 17 : 12}
              fill="#c68b7b"
            />
            <circle
              cx="823"
              cy="470"
              r={(appearance?.decor.PLANT.style ?? 0) === 1 ? 16 : 12}
              fill="#d3b780"
            />
            <circle cx="844" cy="478" r="12" fill="#e2b3a0" />
          </g>
        )}
        {(appearance?.level ?? 1) >= 2 && (
          <path
            d="m370 610 240 0 70 170H300z"
            fill="#9a6950"
            stroke="#b18d57"
            strokeWidth="3"
            opacity=".7"
          />
        )}
        {(appearance?.level ?? 1) >= 4 && (
          <g stroke="#d8c697" opacity=".6">
            {Array.from({ length: 18 }, (_, i) => (
              <path
                key={i}
                d={`M${310 + i * 22} 100v${55 + Math.abs(i - 8.5) * 8}`}
                strokeWidth="2"
                strokeDasharray="3 5"
              />
            ))}
          </g>
        )}
        <g
          transform="translate(380 230)"
          fill={appearance?.decor.PAINTING.color ?? "#86755a"}
          stroke="#c9b17a"
          strokeWidth="3"
        >
          {(appearance?.decor.PAINTING.style ?? 0) === 2 ? (
            <circle cx="20" cy="60" r="48" />
          ) : (
            <path d="M-20 0h80v120h-80z" />
          )}
          <path d="M-9 100q25-65 50-5M15 80V20m0 25 17-16" fill="none" />
          {(appearance?.decor.PAINTING.style ?? 0) === 1 && (
            <path d="M-29-3h98M-29 123h98" strokeWidth="8" />
          )}
        </g>
        <g
          transform="translate(345 575)"
          fill={appearance?.decor.INCENSE.color ?? "#71523a"}
          stroke="#b49a67"
          strokeWidth="3"
        >
          <path d="M-24 0q24 60 48 0zM-15 30v15m30-15v15" />
          {(appearance?.decor.INCENSE.style ?? 0) > 0 && (
            <path d="m-25-2 25-18 25 18z" />
          )}
          {(appearance?.decor.INCENSE.style ?? 0) === 2 && (
            <path d="M-23 10q-28-30-13-31M23 10q28-30 13-31" fill="none" />
          )}
          <path d="M-6-10v-36m12 36v-44" />
        </g>
        {(appearance?.level ?? 1) >= 3 && (
          <path
            d="M0 110h1000M50 40v520m900-520v520"
            stroke="#cbae6a"
            strokeWidth="5"
            fill="none"
          />
        )}
      </svg>
      {appearance && (
        <AvatarIllustration className="flat-avatar" appearance={appearance} />
      )}
    </div>
  );
}
