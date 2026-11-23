"use client";
import { Html } from "@react-three/drei";
import { useLayoutEffect, useRef } from "react";
import { InstancedMesh, Object3D } from "three";
import type { ThreeElements } from "@react-three/fiber";
import ModelSlot from "./ModelSlot";
import HaremFigure from "./HaremFigure";
import type { CosmeticAppearance } from "@/types/cosmetics";
const colors = {
  wood: "#523627",
  red: "#87372c",
  gold: "#b89a59",
  wall: "#e3d4b6",
  tile: "#2d3331",
  leaf: "#536748",
};
function Box({
  color = colors.wood,
  ...props
}: ThreeElements["mesh"] & { color?: string }) {
  return (
    <mesh castShadow receiveShadow {...props}>
      <boxGeometry />
      <meshStandardMaterial color={color} roughness={0.9} />
    </mesh>
  );
}
function Planks({ offset, color }: { offset: number; color: string }) {
  const mesh = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const transform = new Object3D();
    for (let i = 0; i < 8; i++) {
      transform.position.set(-3.9 + (i * 2 + offset) * 0.52, 0.005, 0);
      transform.scale.set(0.5, 0.025, 6);
      transform.updateMatrix();
      mesh.current!.setMatrixAt(i, transform.matrix);
    }
    mesh.current!.instanceMatrix.needsUpdate = true;
    mesh.current!.computeBoundingSphere();
  }, [offset]);
  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, 8]}
      castShadow
      receiveShadow
    >
      <boxGeometry />
      <meshStandardMaterial color={color} roughness={0.9} />
    </instancedMesh>
  );
}
function Screen({ color = colors.red }: { color?: string }) {
  return (
    <group>
      {[-1, 0, 1].map((x) => (
        <group key={x} position={[x * 0.72, 0, 0]} rotation={[0, x * -0.13, 0]}>
          <Box
            position={[0, 1.12, 0]}
            scale={[0.7, 2.1, 0.09]}
            color={colors.gold}
          />
          <Box
            position={[0, 1.12, 0.055]}
            scale={[0.57, 1.87, 0.025]}
            color={color}
          />
          {[-0.22, 0, 0.22].map((dx) => (
            <Box
              key={dx}
              position={[dx, 1.12, 0.08]}
              scale={[0.018, 1.65, 0.02]}
              color={colors.gold}
            />
          ))}
          <Box position={[0, 0.07, 0]} scale={[0.82, 0.14, 0.42]} />
        </group>
      ))}
    </group>
  );
}
function Seat() {
  return (
    <group>
      <Box position={[0, 0.44, 0]} scale={[2.5, 0.22, 1.05]} />
      <Box
        position={[0, 0.59, 0]}
        scale={[2.28, 0.12, 0.88]}
        color={colors.red}
      />
      {[-1.05, 1.05].flatMap((x) =>
        [-0.35, 0.35].map((z) => (
          <Box
            key={`${x}-${z}`}
            position={[x, 0.18, z]}
            scale={[0.13, 0.36, 0.13]}
          />
        )),
      )}
      <Box position={[0, 1, -0.48]} scale={[2.5, 0.8, 0.12]} />
      <Box
        position={[0, 1.04, -0.4]}
        scale={[2.15, 0.5, 0.045]}
        color={colors.gold}
      />
    </group>
  );
}
function Table({ color = colors.wood }: { color?: string }) {
  return (
    <group>
      <Box color={color} position={[0, 0.67, 0]} scale={[1.3, 0.14, 0.8]} />
      {[-0.5, 0.5].flatMap((x) =>
        [-0.27, 0.27].map((z) => (
          <Box
            key={`${x}-${z}`}
            position={[x, 0.3, z]}
            scale={[0.11, 0.6, 0.11]}
          />
        )),
      )}
      <mesh position={[-0.22, 0.79, 0]}>
        <cylinderGeometry args={[0.09, 0.07, 0.13, 8]} />
        <meshStandardMaterial color={colors.wall} />
      </mesh>
      <mesh position={[0.2, 0.79, 0.08]}>
        <cylinderGeometry args={[0.09, 0.07, 0.13, 8]} />
        <meshStandardMaterial color={colors.wall} />
      </mesh>
    </group>
  );
}
function Vase({ color = "#b7c2b0" }: { color?: string }) {
  return (
    <group>
      <mesh position={[0, 0.28, 0]}>
        <cylinderGeometry args={[0.15, 0.24, 0.55, 10]} />
        <meshStandardMaterial color={color} roughness={0.65} />
      </mesh>
      {[-0.16, 0, 0.16].map((x, i) => (
        <group key={x} position={[x, 0.7 + i * 0.05, 0]}>
          <Box
            position={[-x / 2, -0.1, 0]}
            scale={[0.018, 0.5, 0.018]}
            color={colors.leaf}
          />
          <mesh>
            <icosahedronGeometry args={[0.12, 0]} />
            <meshStandardMaterial color={i % 2 ? "#b95f52" : "#dfb07d"} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
function Lantern({ color = colors.red }: { color?: string }) {
  return (
    <group>
      <Box
        position={[0, 0.42, 0]}
        scale={[0.025, 0.6, 0.025]}
        color={colors.gold}
      />
      <mesh>
        <cylinderGeometry args={[0.25, 0.22, 0.5, 8]} />
        <meshStandardMaterial
          color={color}
          emissive="#f29a39"
          emissiveIntensity={0.8}
          roughness={0.85}
        />
      </mesh>
      {[-0.29, 0.29].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <cylinderGeometry args={[0.27, 0.27, 0.07, 8]} />
          <meshStandardMaterial color={colors.gold} />
        </mesh>
      ))}
      <Box
        position={[0, -0.45, 0]}
        scale={[0.025, 0.25, 0.025]}
        color={colors.gold}
      />
    </group>
  );
}
function Hotspot({
  label,
  text,
  at,
  onHotspot,
}: {
  label: string;
  text: string;
  at: [number, number, number];
  onHotspot: (text: string) => void;
}) {
  return (
    <Html position={at} center zIndexRange={[5, 1]}>
      <button className="palace-world-hotspot" onClick={() => onHotspot(text)}>
        {label}
      </button>
    </Html>
  );
}
/** Replace each slot with a GLB without changing layout, camera, lighting or HTML. */
export default function PalaceRoom({
  appearance: a,
  available,
  onHotspot,
}: {
  appearance?: CosmeticAppearance;
  available: string[];
  onHotspot: (text: string) => void;
}) {
  return (
    <group>
      {/* Open front is intentional; the courtyard remains visible through the rear doorway. */}
      <Box position={[0, -0.16, 0]} scale={[8.4, 0.3, 6.2]} />
      <Planks offset={0} color={a && a.level >= 3 ? "#573a29" : "#725039"} />
      <Planks offset={1} color="#674630" />
      <Box
        position={[-3, 1.75, -3]}
        scale={[2, 3.5, 0.16]}
        color={colors.wall}
      />
      <Box
        position={[3, 1.75, -3]}
        scale={[2, 3.5, 0.16]}
        color={colors.wall}
      />
      <Box position={[0, 3.2, -3]} scale={[4, 0.6, 0.16]} color={colors.wall} />
      <Box
        position={[-4.1, 1.75, 0]}
        scale={[0.16, 3.5, 6]}
        color={colors.wall}
      />
      <Box
        position={[4.1, 1.75, 0]}
        scale={[0.16, 3.5, 6]}
        color={colors.wall}
      />
      {[-3.75, 3.75].flatMap((x) =>
        [-2.7, 2.4].map((z) => (
          <group key={`${x}-${z}`}>
            <mesh position={[x, 1.7, z]} castShadow>
              <cylinderGeometry args={[0.16, 0.2, 3.4, 10]} />
              <meshStandardMaterial color={colors.red} roughness={0.8} />
            </mesh>
            <Box
              position={[x, 0.12, z]}
              scale={[0.48, 0.24, 0.48]}
              color={colors.gold}
            />
          </group>
        )),
      )}
      {[-2.7, 2.4].map((z) => (
        <Box
          key={z}
          position={[0, 3.4, z]}
          scale={[8.35, 0.25, 0.3]}
          color={colors.red}
        />
      ))}
      {[-3, -1.5, 0, 1.5, 3].map((x) => (
        <Box key={x} position={[x, 3.55, -0.15]} scale={[0.12, 0.14, 5.8]} />
      ))}
      <Box position={[0, -0.2, -6]} scale={[8, 0.12, 5.5]} color="#b5ad91" />
      <Box
        position={[0, 0.7, -8.5]}
        scale={[8, 1.5, 0.15]}
        color={colors.wall}
      />
      <Box
        position={[0, 1.5, -8.5]}
        scale={[8.3, 0.15, 0.4]}
        color={colors.tile}
      />
      {[-2.5, 2.5].map((x) => (
        <group key={x} position={[x, 0, -6.5]}>
          <Box position={[0, 0.6, 0]} scale={[0.12, 1.4, 0.12]} />
          <mesh position={[0, 1.55, 0]}>
            <icosahedronGeometry args={[0.85, 0]} />
            <meshStandardMaterial color={colors.leaf} />
          </mesh>
          <mesh position={[0.25, 2, 0]}>
            <icosahedronGeometry args={[0.6, 0]} />
            <meshStandardMaterial color="#657554" />
          </mesh>
        </group>
      ))}
      <group
        position={[-2, 0, -1.8]}
        rotation={[0, (a?.decor.SCREEN.style ?? 0) * 0.09, 0]}
      >
        <ModelSlot
          id="screen"
          available={available}
          color={a?.decor.SCREEN.color}
        >
          <Screen color={a?.decor.SCREEN.color} />
        </ModelSlot>
      </group>
      <group
        position={[-1.9, 0, 0.6]}
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
        position={[1.35, 0, -0.2]}
        scale={[1 + (a?.decor.TABLE.style ?? 0) * 0.05, 1, 1]}
        onClick={(e) => {
          e.stopPropagation();
          onHotspot("Một chén trà ấm đang đợi bên cửa.");
        }}
      >
        <ModelSlot
          id="table"
          available={available}
          color={a?.decor.TABLE.color}
        >
          <Table color={a?.decor.TABLE.color} />
        </ModelSlot>
        <group
          position={[0.35, 0.75, -0.15]}
          scale={1 + (a?.decor.PLANT.style ?? 0) * 0.15}
        >
          <ModelSlot
            id="vase"
            available={available}
            color={a?.decor.PLANT.color}
          >
            <Vase color={a?.decor.PLANT.color} />
          </ModelSlot>
        </group>
      </group>
      {[-2.8, 2.8].map((x) => (
        <group
          key={x}
          position={[x, 2.65, -0.7]}
          scale={1 + (a?.decor.LANTERN.style ?? 0) * 0.08}
          onClick={(e) => {
            e.stopPropagation();
            onHotspot("Ánh đèn son làm dịu một góc cung viện.");
          }}
        >
          <ModelSlot
            id="lantern"
            available={available}
            color={a?.decor.LANTERN.color}
          >
            <Lantern color={a?.decor.LANTERN.color} />
          </ModelSlot>
        </group>
      ))}
      {a && (
        <>
          <HaremFigure appearance={a} />
          <group position={[3.98, 1.85, -1.2]} rotation={[0, -Math.PI / 2, 0]}>
            <Box scale={[1.25, 1.35, 0.05]} color={colors.gold} />
            <Box
              position={[0, 0, 0.04]}
              scale={[1.1, 1.2, 0.03]}
              color={a.decor.PAINTING.color}
            />
            {Array.from({ length: a.decor.PAINTING.style + 1 }, (_, i) => (
              <mesh
                key={i}
                position={[(i - 0.5) * 0.28, 0, 0.07]}
                rotation={[0, 0, 0.4]}
              >
                <planeGeometry args={[0.12, 0.6]} />
                <meshBasicMaterial color="#ddd0a2" />
              </mesh>
            ))}
          </group>
          <group
            position={[-0.75, 0.05, -1.5]}
            scale={1 + a.decor.INCENSE.style * 0.12}
          >
            <mesh position={[0, 0.18, 0]} castShadow>
              <cylinderGeometry args={[0.19, 0.14, 0.32, 8]} />
              <meshStandardMaterial
                color={a.decor.INCENSE.color}
                metalness={0.3}
                roughness={0.7}
              />
            </mesh>
            <Box
              position={[0, 0.48, 0]}
              scale={[0.015, 0.35, 0.015]}
              color={colors.wood}
            />
          </group>
          {a.level >= 2 && (
            <Box
              position={[0, 3.2, 2.55]}
              scale={[3 + (a.level - 2) * 0.5, 0.055, 0.04]}
              color={colors.gold}
            />
          )}
        </>
      )}
      <Hotspot
        label="Bàn trà"
        text="Một chén trà ấm đang đợi bên cửa."
        at={[1.4, 1.25, 0]}
        onHotspot={onHotspot}
      />
      <Hotspot
        label="Sập gỗ"
        text="Chỗ tĩnh dưỡng sau những việc trong ngày."
        at={[-2, 1.5, 0.6]}
        onHotspot={onHotspot}
      />
      <Hotspot
        label="Đèn lồng"
        text="Ánh đèn son làm dịu một góc cung viện."
        at={[2.8, 2.05, -0.7]}
        onHotspot={onHotspot}
      />
    </group>
  );
}
