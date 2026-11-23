"use client";
import { Html } from "@react-three/drei";
import type { CosmeticAppearance } from "@/types/cosmetics";
/** Fully clothed display mannequin, not the detailed G2 character pipeline. */
export default function HaremFigure({
  appearance: a,
}: {
  appearance: CosmeticAppearance;
}) {
  const color = a.outfit?.color ?? "#9a6556",
    accent = a.outfit?.accent ?? "#c6ac76";
  return (
    <group position={[0.05, 0, 1.15]}>
      <mesh position={[0, 0.43, 0]} castShadow>
        <cylinderGeometry args={[0.19, 0.4, 0.85, 8]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.04, 0]} castShadow>
        <boxGeometry args={[0.4, 0.42, 0.24]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * 0.27, 0.99, 0]}
          rotation={[0, 0, side * 0.15]}
          castShadow
        >
          <boxGeometry args={[0.2, 0.48, 0.28]} />
          <meshStandardMaterial color={color} />
        </mesh>
      ))}
      <mesh position={[0, 0.86, 0.01]}>
        <boxGeometry args={[0.42, 0.065, 0.28]} />
        <meshStandardMaterial color={accent} />
      </mesh>
      <mesh position={[0, 1.45, 0]} castShadow>
        <icosahedronGeometry args={[0.18, 1]} />
        <meshStandardMaterial color="#c6a380" roughness={1} />
      </mesh>
      <mesh position={[0, 1.6, -0.03]} castShadow>
        <icosahedronGeometry args={[0.17, 0]} />
        <meshStandardMaterial color="#241b1a" />
      </mesh>
      {a.outfit && (
        <group position={[0, 1.05, 0.13]}>
          {a.outfit.pattern === "DIAMOND" ? (
            <mesh rotation={[0, 0, Math.PI / 4]}>
              <planeGeometry args={[0.12, 0.12]} />
              <meshBasicMaterial color={accent} />
            </mesh>
          ) : (
            [-0.07, 0.07].map((x) => (
              <mesh
                key={x}
                position={[x, 0, 0]}
                rotation={[0, 0, a.outfit?.pattern === "WAVES" ? x * 2 : 0]}
              >
                <planeGeometry args={[0.025, 0.3]} />
                <meshBasicMaterial color={accent} />
              </mesh>
            ))
          )}
        </group>
      )}
      {a.headColor && (
        <mesh position={[0.14, 1.64, 0]} rotation={[0, 0, Math.PI / 3]}>
          <cylinderGeometry args={[0.025, 0.025, 0.32, 6]} />
          <meshStandardMaterial
            color={a.headColor}
            metalness={0.4}
            roughness={0.6}
          />
        </mesh>
      )}
      {a.accessoryColor &&
        [-0.09, 0, 0.09].map((x) => (
          <mesh key={x} position={[x, 1.2, 0.15]}>
            <icosahedronGeometry args={[0.025, 0]} />
            <meshStandardMaterial
              color={a.accessoryColor!}
              emissive={a.accessoryColor!}
              emissiveIntensity={0.6}
            />
          </mesh>
        ))}
      <Html position={[0, 1.98, 0]} center zIndexRange={[5, 1]}>
        <span className="palace-nameplate">{a.name}</span>
      </Html>
    </group>
  );
}
