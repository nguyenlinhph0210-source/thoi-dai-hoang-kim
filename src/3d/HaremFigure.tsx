"use client";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { DoubleSide, Group, Shape, Vector2 } from "three";
import { visualVariant, type StyledAppearance } from "@/ui/appearance";
import type { Quality } from "./quality";
import { useProceduralTexture } from "./proceduralTextures";
/** Fully clothed procedural display figure; no rig or gameplay state. */
export default function HaremFigure({
  appearance: a,
  quality,
  reducedMotion,
}: {
  appearance: StyledAppearance;
  quality: Quality;
  reducedMotion: boolean;
}) {
  const figure = useRef<Group>(null),
    segments = quality === "low" ? 8 : quality === "medium" ? 12 : 16;
  const color = a.outfit?.color ?? "#a96855",
    accent = a.outfit?.accent ?? "#d6b97b",
    variant = visualVariant(a.outfitCode ?? "plain");
  const texture = useProceduralTexture(
    "silk",
    a.outfitCode ?? "plain",
    quality,
    color,
    accent,
    a.outfit?.pattern ?? "BORDER",
  );
  const skirt = useMemo(
    () =>
      [
        [0.31, 0.08],
        [0.36, 0.18],
        [0.32, 0.4],
        [0.26, 0.7],
        [0.18, 0.94],
        [0.18, 1.06],
      ].map(([x, y]) => new Vector2(x, y)),
    [],
  );
  const torso = useMemo(
    () =>
      [
        [0.18, 0.93],
        [0.17, 1.03],
        [0.23, 1.22],
        [0.15, 1.3],
      ].map(([x, y]) => new Vector2(x, y)),
    [],
  );
  const sleeve = useMemo(
    () =>
      [
        [0.11, 0],
        [0.13, 0.12],
        [0.18, 0.38],
        [0.23, 0.58],
      ].map(([x, y]) => new Vector2(x, y)),
    [],
  );
  const flap = useMemo(() => {
    const s = new Shape();
    s.moveTo(0, 0);
    s.lineTo(0.16, 0.02);
    s.bezierCurveTo(0.15, -0.3, 0.25, -0.65, 0.28, -0.83);
    s.lineTo(0.03, -0.87);
    s.quadraticCurveTo(0.05, -0.3, 0, 0);
    return s;
  }, []);
  useFrame(({ clock }) => {
    if (figure.current)
      figure.current.scale.y = reducedMotion
        ? 1
        : 1 + Math.sin(clock.getElapsedTime() * 1.65) * 0.002;
  });
  return (
    <group position={[0, 0, 0.8]}>
      <group ref={figure}>
        {[-1, 1].map((side) => (
          <mesh
            key={side}
            position={[side * 0.12, 0.055, 0.055]}
            scale={[1, 0.55, 1.5]}
            castShadow
          >
            <sphereGeometry args={[0.1, segments, 6]} />
            <meshStandardMaterial color="#352829" roughness={1} />
          </mesh>
        ))}
        <mesh castShadow receiveShadow>
          <latheGeometry args={[skirt, segments]} />
          <meshStandardMaterial
            map={texture}
            side={DoubleSide}
            roughness={0.82}
          />
        </mesh>
        <mesh castShadow>
          <latheGeometry args={[torso, segments]} />
          <meshStandardMaterial map={texture} roughness={0.8} />
        </mesh>
        {[-1, 1].map((side) => (
          <group key={side}>
            <mesh
              position={[side * 0.2, 1.22, 0]}
              rotation={[0, 0, Math.PI + side * 0.23]}
              castShadow
            >
              <latheGeometry args={[sleeve, segments]} />
              <meshStandardMaterial
                map={texture}
                side={DoubleSide}
                roughness={0.8}
              />
            </mesh>
            <mesh
              position={[side * 0.33, 0.69, 0.06]}
              rotation={[0, 0, -side * 0.1]}
              castShadow
            >
              <capsuleGeometry args={[0.043, 0.105, 3, segments]} />
              <meshStandardMaterial color="#ddb597" roughness={0.9} />
            </mesh>
            <mesh
              position={[side * 0.33, 0.66, 0]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <torusGeometry args={[0.22, 0.012, 4, segments]} />
              <meshStandardMaterial color={accent} />
            </mesh>
            <mesh
              position={[side * 0.09, 0.98, 0.16]}
              scale={[side, 1, 1]}
              castShadow
            >
              <extrudeGeometry
                args={[
                  flap,
                  { depth: 0.012, bevelEnabled: false, curveSegments: 3 },
                ]}
              />
              <meshStandardMaterial
                map={texture}
                side={DoubleSide}
                roughness={0.85}
              />
            </mesh>
            <mesh
              position={[side * 0.083, 1.19, 0.17]}
              rotation={[0, 0, side * 0.47]}
            >
              <boxGeometry args={[0.027, 0.27, 0.016]} />
              <meshStandardMaterial color={accent} />
            </mesh>
          </group>
        ))}
        <mesh
          position={[0, 0.96, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[1, 1, 0.75]}
        >
          <torusGeometry args={[0.184, 0.025, 4, segments]} />
          <meshStandardMaterial
            color={accent}
            metalness={0.2}
            roughness={0.65}
          />
        </mesh>
        <mesh position={[0.03, 0.83, 0.2]} rotation={[0, 0, 0.1]}>
          <boxGeometry args={[0.06, 0.25, 0.012]} />
          <meshStandardMaterial color={variant === 2 ? accent : "#6f332d"} />
        </mesh>
        <mesh position={[0, 1.33, 0]}>
          <cylinderGeometry args={[0.065, 0.075, 0.17, segments]} />
          <meshStandardMaterial color="#ddb597" />
        </mesh>
        <mesh position={[0, 1.5, 0]} scale={[0.88, 1.15, 0.85]} castShadow>
          <sphereGeometry args={[0.155, segments, 10]} />
          <meshStandardMaterial color="#e4bfa1" roughness={0.94} />
        </mesh>
        <mesh position={[0, 1.53, -0.04]} scale={[1, 1.1, 0.82]} castShadow>
          <sphereGeometry
            args={[0.16, segments, 10, 0, Math.PI * 2, 0, Math.PI * 0.65]}
          />
          <meshStandardMaterial color="#282022" roughness={0.9} />
        </mesh>
        <mesh position={[0, 1.73, -0.065]} scale={[1, 0.82, 0.85]} castShadow>
          <sphereGeometry args={[0.13, segments, 8]} />
          <meshStandardMaterial color="#302326" roughness={0.85} />
        </mesh>
        <mesh position={[0, 1.71, -0.055]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.1, 0.012, 4, segments]} />
          <meshStandardMaterial color="#76503b" />
        </mesh>
        {[-1, 1].map((side) => (
          <group key={side}>
            <mesh position={[side * 0.055, 1.51, 0.123]} scale={[1, 0.4, 0.5]}>
              <sphereGeometry args={[0.017, 8, 4]} />
              <meshStandardMaterial color="#3d2d2b" />
            </mesh>
            <mesh
              position={[side * 0.06, 1.545, 0.12]}
              rotation={[0, 0, side * 0.09]}
            >
              <boxGeometry args={[0.045, 0.007, 0.009]} />
              <meshStandardMaterial color="#593c35" />
            </mesh>
            <mesh
              position={[side * 0.08, 1.465, 0.112]}
              scale={[1, 0.35, 0.25]}
            >
              <sphereGeometry args={[0.023, 8, 4]} />
              <meshStandardMaterial color="#cb8b79" roughness={1} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 1.485, 0.135]} scale={[0.6, 1, 0.75]}>
          <sphereGeometry args={[0.018, 8, 5]} />
          <meshStandardMaterial color="#dfb699" />
        </mesh>
        <mesh position={[0, 1.435, 0.122]} scale={[1, 0.2, 0.5]}>
          <sphereGeometry args={[0.026, 8, 5]} />
          <meshStandardMaterial color="#a76b63" />
        </mesh>
        {a.headColor && (
          <group position={[0.06, 1.74, 0]} rotation={[0, 0, 0.18]}>
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.006, 0.009, 0.39, 6]} />
              <meshStandardMaterial
                color={a.headColor}
                metalness={0.6}
                roughness={0.45}
              />
            </mesh>
            {Array.from(
              { length: visualVariant(a.headCode ?? "") === 1 ? 3 : 5 },
              (_, i) => (
                <mesh
                  key={i}
                  position={[
                    0.15 + Math.cos(i * 1.26) * 0.03,
                    Math.sin(i * 1.26) * 0.03,
                    0.01,
                  ]}
                  scale={[1, 0.6, 0.4]}
                >
                  <sphereGeometry args={[0.026, 6, 4]} />
                  <meshStandardMaterial
                    color={a.headColor!}
                    metalness={0.5}
                    roughness={0.5}
                  />
                </mesh>
              ),
            )}
            <mesh position={[0.18, -0.085, 0.02]}>
              <cylinderGeometry args={[0.003, 0.003, 0.15, 4]} />
              <meshStandardMaterial color={accent} />
            </mesh>
            <mesh position={[0.18, -0.17, 0.02]}>
              <sphereGeometry args={[0.018, 6, 4]} />
              <meshStandardMaterial color="#8daba0" />
            </mesh>
          </group>
        )}
        {a.accessoryColor && (
          <group>
            <mesh
              position={[0, 1.28, 0.03]}
              rotation={[Math.PI / 2, 0, 0]}
              scale={[1, 1, 0.75]}
            >
              <torusGeometry args={[0.12, 0.008, 4, segments]} />
              <meshStandardMaterial
                color={a.accessoryColor}
                metalness={0.5}
                roughness={0.45}
              />
            </mesh>
            {[-1, 1].map((side) => (
              <group key={side} position={[side * 0.14, 1.47, 0]}>
                <mesh>
                  <cylinderGeometry args={[0.003, 0.003, 0.075, 4]} />
                  <meshStandardMaterial color={a.accessoryColor!} />
                </mesh>
                <mesh position={[0, -0.045, 0]}>
                  <sphereGeometry args={[0.018, 6, 4]} />
                  <meshStandardMaterial
                    color={a.accessoryColor!}
                    emissive={a.accessoryColor!}
                    emissiveIntensity={0.16}
                  />
                </mesh>
              </group>
            ))}
            <mesh
              position={[0, 1.19, 0.165]}
              rotation={[0, 0, Math.PI / 4]}
              scale={[1, 1, 0.3]}
            >
              <boxGeometry args={[0.04, 0.04, 0.02]} />
              <meshStandardMaterial
                color={a.accessoryColor}
                emissive={a.accessoryColor}
                emissiveIntensity={0.1}
              />
            </mesh>
            {visualVariant(a.accessoryCode ?? "") !== 1 && (
              <group position={[0.12, 0.76, 0.23]}>
                <mesh>
                  <cylinderGeometry args={[0.003, 0.003, 0.17, 4]} />
                  <meshStandardMaterial color={a.accessoryColor} />
                </mesh>
                <mesh position={[0, -0.11, 0]} rotation={[0, 0, 0.1]}>
                  <torusGeometry args={[0.035, 0.01, 4, 8]} />
                  <meshStandardMaterial color="#819c8c" roughness={0.5} />
                </mesh>
              </group>
            )}
          </group>
        )}
      </group>
      <Html position={[0, 2.06, 0]} center zIndexRange={[5, 1]}>
        <span className="palace-nameplate">{a.name}</span>
      </Html>
    </group>
  );
}
