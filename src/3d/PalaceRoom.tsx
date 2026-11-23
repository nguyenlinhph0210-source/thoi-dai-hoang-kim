"use client";
import { useMemo } from "react";
import type { StyledAppearance } from "@/ui/appearance";
import type { Quality } from "./quality";
import {
  Box,
  Beams,
  CurvedRoof,
  PaperWindow,
  PearlCurtain,
  Petals,
  PALACE_COLORS as C,
  type Beam,
} from "./PalaceDetails";
import {
  Screen,
  Table,
  Plant,
  Lantern,
  Painting,
  Incense,
  Seat,
} from "./PalaceFurniture";
import { useProceduralTexture } from "./proceduralTextures";
import HaremFigure from "./HaremFigure";
import ModelSlot from "./ModelSlot";
/** Foreground posts, living middle ground and courtyard depth. Individual slots remain replaceable. */
export default function PalaceRoom({
  appearance: a,
  available,
  quality,
  reducedMotion,
  onHotspot,
}: {
  appearance?: StyledAppearance;
  available: string[];
  quality: Quality;
  reducedMotion: boolean;
  onHotspot: (text: string) => void;
}) {
  const wood = useProceduralTexture("wood", "palace-floor", quality, "#866343");
  const planks = useMemo(
    () =>
      Array.from(
        { length: 20 },
        (_, i) =>
          ({
            at: [-5 + i * 0.53, 0.005, 0],
            scale: [0.009, 0.012, 9.4],
          }) as Beam,
      ),
    [],
  );
  const beams = useMemo(
    () =>
      [
        { at: [0, 3.35, -3.2], scale: [10.5, 0.2, 0.25] },
        { at: [0, 3.5, 0.9], scale: [9.5, 0.2, 0.25] },
        { at: [0, 3.8, -1.2], scale: [10.8, 0.15, 0.2] },
      ] as Beam[],
    [],
  );
  const d = (slot: keyof StyledAppearance["decor"]) =>
    a?.decor[slot] ?? { style: 0 as const, color: C.wood };
  const props = (slot: keyof StyledAppearance["decor"]) => ({
    ...d(slot),
    quality,
  });
  return (
    <group>
      <mesh position={[0, -0.09, 0]} receiveShadow>
        <boxGeometry args={[11, 0.16, 10]} />
        <meshStandardMaterial map={wood} roughness={0.9} />
      </mesh>
      <Beams rows={planks} color="#4a3224" />
      <Beams rows={beams} color={C.red} />
      <Box position={[0, 1.8, -4.2]} scale={[11, 3.6, 0.18]} color={C.paper} />
      <PaperWindow at={[-2.8, 0, -4.08]} quality={quality} />
      <PaperWindow at={[2.8, 0, -4.08]} quality={quality} />
      <Box
        position={[0, 1.5, -4.05]}
        scale={[2.65, 2.8, 0.08]}
        color="#b7b18b"
      />
      <Box position={[0, 0.15, -4.3]} scale={[2.8, 0.3, 2]} color="#807c60" />
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * 2.7, 0.65, -3.8]}>
            <cylinderGeometry args={[0.1, 0.16, 1.3, 6]} />
            <meshStandardMaterial color={C.wood} />
          </mesh>
          <mesh position={[side * 2.5, 1.55, -4]}>
            <icosahedronGeometry args={[0.58, 0]} />
            <meshStandardMaterial color="#788568" />
          </mesh>
          <Box
            position={[side * 1.25, 1.6, -3.96]}
            scale={[0.4, 2.6, 0.08]}
            color="#89624a"
          />
        </group>
      ))}
      {[-4.6, -1.65, 1.65, 4.6].map((x) => (
        <group key={x}>
          <mesh position={[x, 1.7, -3]} castShadow>
            <cylinderGeometry
              args={[0.11, 0.16, 3.4, quality === "low" ? 8 : 12]}
            />
            <meshStandardMaterial color={C.red} roughness={0.8} />
          </mesh>
          <Box
            position={[x, 0.07, -3]}
            scale={[0.42, 0.14, 0.42]}
            color="#8c7961"
          />
          {(a?.level ?? 1) >= 3 &&
            [0.4, 2.8].map((y) => (
              <mesh key={y} position={[x, y, -3]}>
                <cylinderGeometry args={[0.143, 0.143, 0.045, 8]} />
                <meshStandardMaterial color={C.gold} />
              </mesh>
            ))}
        </group>
      ))}
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * 3.9, 1.85, 2.1]} castShadow>
            <cylinderGeometry args={[0.17, 0.21, 3.7, 8]} />
            <meshStandardMaterial color={C.red} roughness={0.82} />
          </mesh>
          <Box
            position={[side * 3.9, 0.13, 2.1]}
            scale={[0.55, 0.25, 0.55]}
            color="#82715c"
          />
        </group>
      ))}
      <CurvedRoof quality={quality} />
      {quality !== "low" && <PearlCurtain quality={quality} />}
      {(a?.level ?? 1) >= 4 &&
        [-1, 1].map((side) => (
          <Box
            key={side}
            position={[side * 2.6, 2.4, -0.5]}
            rotation={[0, 0, -side * 0.12]}
            scale={[0.34, 2, 0.04]}
            color="#aa8770"
          />
        ))}
      <group position={[-2.2, 0, -1.5]} rotation={[0, 0.18, 0]}>
        <ModelSlot id="screen" available={available} color={d("SCREEN").color}>
          <Screen {...props("SCREEN")} />
        </ModelSlot>
      </group>
      <group
        position={[-2.3, 0, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onHotspot("Chỗ tĩnh dưỡng sau những việc trong ngày.");
        }}
      >
        <ModelSlot id="seat" available={available}>
          <Seat />
        </ModelSlot>
      </group>
      <group
        position={[1.65, 0, -0.25]}
        onClick={(e) => {
          e.stopPropagation();
          onHotspot("Một chén trà ấm đang đợi bên cửa.");
        }}
      >
        <ModelSlot id="table" available={available} color={d("TABLE").color}>
          <Table {...props("TABLE")} />
        </ModelSlot>
        <group position={[0.3, 0.75, -0.1]} scale={0.8}>
          <ModelSlot id="vase" available={available} color={d("PLANT").color}>
            <Plant {...props("PLANT")} />
          </ModelSlot>
        </group>
      </group>
      {[-1, 1].map((side) => (
        <group
          key={side}
          position={[side * 2.25, 2.55, -0.4]}
          onClick={(e) => {
            e.stopPropagation();
            onHotspot("Ánh đèn son làm dịu một góc cung viện.");
          }}
        >
          <ModelSlot
            id="lantern"
            available={available}
            color={d("LANTERN").color}
          >
            <Lantern {...props("LANTERN")} />
          </ModelSlot>
        </group>
      ))}
      <group position={[3.8, 1.9, -3.8]}>
        <Painting {...props("PAINTING")} />
      </group>
      <group position={[-1.15, 0, -0.6]}>
        <Incense {...props("INCENSE")} />
      </group>
      {(a?.level ?? 1) >= 2 && (
        <Box
          position={[0, 0.009, 0]}
          scale={[1.3, 0.009, 2.6]}
          color="#9a6b48"
        />
      )}
      {(a?.level ?? 1) >= 5 &&
        [-1, 1].map((side) => (
          <group key={side} position={[side * 3.2, 0, -2.5]}>
            <Box
              position={[0, 0.6, 0]}
              scale={[0.45, 1.2, 0.45]}
              color={C.wood}
            />
            <group position={[0, 1.2, 0]}>
              <Plant style={2} color="#9da490" quality={quality} />
            </group>
          </group>
        ))}
      {quality !== "low" && <Petals reducedMotion={reducedMotion} />}
      {a && (
        <HaremFigure
          appearance={a}
          quality={quality}
          reducedMotion={reducedMotion}
        />
      )}
    </group>
  );
}
