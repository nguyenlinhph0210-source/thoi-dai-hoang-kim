"use client";
import { useMemo } from "react";
import { Vector2 } from "three";
import { Box, Beams, PALACE_COLORS as C, type Beam } from "./PalaceDetails";
import type { Quality } from "./quality";
type Props = { style: number; color: string; quality: Quality };
export function Screen({ style, color }: Props) {
  const count = style === 0 ? 2 : style === 1 ? 3 : 5;
  return (
    <group>
      {Array.from({ length: count }, (_, i) => (
        <group
          key={i}
          position={[(i - (count - 1) / 2) * 0.53, 0, 0]}
          rotation={[0, (i - (count - 1) / 2) * -0.13, 0]}
        >
          <Box
            position={[0, 0.9, 0]}
            scale={[0.51, 1.76, 0.08]}
            color={C.gold}
          />
          <Box
            position={[0, 0.91, 0.045]}
            scale={[0.44, 1.6, 0.025]}
            color={color}
          />
          <Box position={[0, 0.06, 0]} scale={[0.58, 0.12, 0.35]} />
          <Box
            position={[0, 1.1, 0.065]}
            rotation={[0, 0, 0.24]}
            scale={[0.014, 0.83, 0.012]}
            color={C.gold}
          />
          {style > 0 && (
            <mesh position={[0, 1.65, 0.035]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.16, 0.018, 4, 8]} />
              <meshStandardMaterial color={C.gold} />
            </mesh>
          )}
          <mesh
            position={[0.06, 1.05, 0.07]}
            scale={[0.5, 1, 0.15]}
            rotation={[0, 0, -0.45]}
          >
            <sphereGeometry args={[0.1, 6, 4]} />
            <meshStandardMaterial color={C.gold} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
export function Table({ style, color }: Props) {
  return (
    <group>
      {style === 1 ? (
        <mesh position={[0, 0.67, 0]} castShadow>
          <cylinderGeometry args={[0.63, 0.58, 0.1, 12]} />
          <meshStandardMaterial color={color} />
        </mesh>
      ) : (
        <Box
          position={[0, 0.67, 0]}
          scale={[style === 2 ? 1.4 : 1.2, 0.12, 0.68]}
          color={color}
        />
      )}
      {[-1, 1].flatMap((x) =>
        [-1, 1].map((z) => (
          <Box
            key={`${x}${z}`}
            position={[x * 0.43, 0.32, z * 0.22]}
            rotation={[0, 0, style === 2 ? x * 0.12 : 0]}
            scale={[0.085, 0.64, 0.085]}
          />
        )),
      )}
      {style === 2 && (
        <Box position={[0, 0.25, 0]} scale={[1, 0.07, 0.52]} color={C.gold} />
      )}
      {[-0.22, 0.22].map((x) => (
        <mesh key={x} position={[x, 0.76, 0.06]}>
          <cylinderGeometry args={[0.065, 0.045, 0.1, 8]} />
          <meshStandardMaterial color="#e3d4b0" roughness={0.55} />
        </mesh>
      ))}
    </group>
  );
}
export function Plant({ style, color, quality }: Props) {
  const points = useMemo(
    () =>
      [
        [0.12, 0],
        [0.18, 0.06],
        [0.21, 0.2],
        [0.13, 0.38],
        [0.095, 0.44],
      ].map(([x, y]) => new Vector2(x, y)),
    [],
  );
  return (
    <group>
      {style === 2 ? (
        <mesh position={[0, 0.1, 0]}>
          <cylinderGeometry args={[0.3, 0.23, 0.19, 8]} />
          <meshStandardMaterial color={color} />
        </mesh>
      ) : (
        <mesh>
          <latheGeometry args={[points, quality === "low" ? 8 : 12]} />
          <meshStandardMaterial color={color} roughness={0.6} />
        </mesh>
      )}
      {(style === 2 ? [-1, 0, 1] : [-1, 1]).map((side, i) => (
        <group
          key={side}
          position={[side * 0.1, style === 2 ? 0.3 : 0.44, 0]}
          rotation={[0, 0, -side * 0.2]}
        >
          <Box
            position={[0, 0.22, 0]}
            scale={[0.015, 0.5, 0.015]}
            color={C.leaf}
          />
          <mesh
            position={[side * 0.07, 0.46, 0]}
            scale={style === 2 ? [1, 0.6, 0.8] : [1, 1, 1]}
          >
            <icosahedronGeometry
              args={[style === 2 ? 0.23 : 0.1, style === 1 ? 1 : 0]}
            />
            <meshStandardMaterial
              color={style === 2 ? C.leaf : i % 2 ? "#c48a7c" : "#d4b477"}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}
export function Lantern({ style, color }: Props) {
  return (
    <group>
      <Box position={[0, 0.5, 0]} scale={[0.013, 0.5, 0.013]} color={C.gold} />
      <mesh castShadow>
        {style === 1 ? (
          <sphereGeometry args={[0.29, 10, 8]} />
        ) : (
          <cylinderGeometry
            args={[
              style === 2 ? 0.19 : 0.22,
              style === 2 ? 0.3 : 0.22,
              0.5,
              style === 2 ? 6 : 4,
            ]}
          />
        )}
        <meshStandardMaterial
          color={color}
          emissive="#e3a95e"
          emissiveIntensity={0.3}
          roughness={0.8}
        />
      </mesh>
      {[-0.29, 0.29].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <cylinderGeometry args={[0.25, 0.25, 0.035, 8]} />
          <meshStandardMaterial color={C.gold} />
        </mesh>
      ))}
      {style === 2 && (
        <mesh position={[0, 0.36, 0]}>
          <coneGeometry args={[0.32, 0.12, 6]} />
          <meshStandardMaterial color={C.gold} />
        </mesh>
      )}
      <Box
        position={[0, -0.45, 0]}
        scale={[0.018, 0.25, 0.018]}
        color={C.gold}
      />
    </group>
  );
}
export function Painting({ style, color }: Props) {
  return (
    <group>
      {style === 2 ? (
        <>
          <mesh>
            <circleGeometry args={[0.56, 16]} />
            <meshStandardMaterial color={color} />
          </mesh>
          <mesh>
            <torusGeometry args={[0.56, 0.025, 4, 16]} />
            <meshStandardMaterial color={C.gold} />
          </mesh>
        </>
      ) : (
        <>
          <Box scale={[0.95, 1.2, 0.05]} color={C.gold} />
          <Box
            position={[0, 0, 0.035]}
            scale={[0.83, 1.08, 0.02]}
            color={color}
          />
        </>
      )}
      {Array.from({ length: style + 1 }, (_, i) => (
        <group key={i} position={[(i - style / 2) * 0.2, -0.04, 0.06]}>
          <Box
            rotation={[0, 0, 0.2]}
            scale={[0.014, 0.65, 0.01]}
            color="#c9b992"
          />
          <mesh
            position={[0.04, 0.07, 0.01]}
            scale={[0.3, 1, 0.1]}
            rotation={[0, 0, -0.4]}
          >
            <sphereGeometry args={[0.12, 6, 4]} />
            <meshBasicMaterial color="#c9b992" />
          </mesh>
        </group>
      ))}
      {style === 1 &&
        [-0.64, 0.64].map((y) => (
          <Box key={y} position={[0, y, 0.02]} scale={[1.1, 0.06, 0.08]} />
        ))}
    </group>
  );
}
export function Incense({ style, color }: Props) {
  return (
    <group>
      <mesh position={[0, 0.17, 0]} castShadow>
        <sphereGeometry args={[0.2, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.65]} />
        <meshStandardMaterial color={color} metalness={0.4} roughness={0.6} />
      </mesh>
      {style > 0 && (
        <mesh position={[0, 0.34, 0]}>
          <coneGeometry args={[0.2, 0.15, 8]} />
          <meshStandardMaterial color={C.gold} />
        </mesh>
      )}
      {[-1, 1].map((side) => (
        <Box
          key={side}
          position={[side * 0.11, 0.04, 0]}
          scale={[0.04, 0.15, 0.05]}
          color={color}
        />
      ))}
      {style === 2 &&
        [-1, 1].map((side) => (
          <mesh
            key={side}
            position={[side * 0.23, 0.22, 0]}
            rotation={[0, 0, side * 0.3]}
          >
            <torusGeometry args={[0.08, 0.018, 4, 8]} />
            <meshStandardMaterial color={C.gold} />
          </mesh>
        ))}
      <Box
        position={[0, 0.52, 0]}
        scale={[0.007, 0.32, 0.007]}
        color={C.wood}
      />
    </group>
  );
}
export function Seat() {
  const rows: Beam[] = useMemo(
    () => [
      { at: [0, 0.4, 0], scale: [1.8, 0.18, 0.9] },
      { at: [0, 0.95, -0.43], scale: [1.8, 0.8, 0.09] },
      ...[-1, 1].flatMap((x) =>
        [-1, 1].map((z) => ({
          at: [x * 0.74, 0.18, z * 0.32] as Beam["at"],
          scale: [0.1, 0.36, 0.1] as Beam["scale"],
        })),
      ),
    ],
    [],
  );
  return (
    <group>
      <Beams rows={rows} color={C.wood} />
      <Box position={[0, 0.53, 0]} scale={[1.63, 0.1, 0.76]} color={C.red} />
      <Box
        position={[0, 0.98, -0.37]}
        scale={[1.5, 0.48, 0.025]}
        color={C.gold}
      />
    </group>
  );
}
