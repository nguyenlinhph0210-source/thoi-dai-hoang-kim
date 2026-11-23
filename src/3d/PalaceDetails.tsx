"use client";
import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, type ThreeElements } from "@react-three/fiber";
import { InstancedMesh, Object3D, Shape } from "three";
import type { Quality } from "./quality";
export const PALACE_COLORS = {
  wood: "#51372d",
  red: "#874638",
  gold: "#bfa26b",
  paper: "#d8c49c",
  leaf: "#65735a",
};
export function Box({
  color = PALACE_COLORS.wood,
  ...props
}: ThreeElements["mesh"] & { color?: string }) {
  return (
    <mesh castShadow receiveShadow {...props}>
      <boxGeometry />
      <meshStandardMaterial color={color} roughness={0.86} />
    </mesh>
  );
}
export interface Beam {
  at: [number, number, number];
  scale: [number, number, number];
  rotation?: [number, number, number];
}
export function Beams({ rows, color }: { rows: Beam[]; color: string }) {
  const mesh = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const o = new Object3D();
    rows.forEach((r, i) => {
      o.position.set(...r.at);
      o.scale.set(...r.scale);
      o.rotation.set(...(r.rotation ?? [0, 0, 0]));
      o.updateMatrix();
      mesh.current!.setMatrixAt(i, o.matrix);
    });
    mesh.current!.instanceMatrix.needsUpdate = true;
    mesh.current!.computeBoundingSphere();
  }, [rows]);
  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, rows.length]}
      castShadow
      receiveShadow
    >
      <boxGeometry />
      <meshStandardMaterial color={color} roughness={0.88} />
    </instancedMesh>
  );
}
export function CurvedRoof({ quality }: { quality: Quality }) {
  const shape = useMemo(() => {
    const s = new Shape();
    s.moveTo(-5.6, 3.7);
    s.quadraticCurveTo(-5.5, 4.7, -4.7, 4.05);
    s.quadraticCurveTo(0, 3.45, 4.7, 4.05);
    s.quadraticCurveTo(5.5, 4.7, 5.6, 3.7);
    s.lineTo(4.6, 3.67);
    s.quadraticCurveTo(0, 3.12, -4.6, 3.67);
    s.closePath();
    return s;
  }, []);
  return (
    <mesh position={[0, 0, -1.65]} castShadow>
      <extrudeGeometry
        args={[
          shape,
          {
            depth: 0.48,
            bevelEnabled: false,
            curveSegments: quality === "low" ? 5 : 10,
          },
        ]}
      />
      <meshStandardMaterial color="#55443b" roughness={0.9} />
    </mesh>
  );
}
export function PaperWindow({
  at,
  quality,
}: {
  at: [number, number, number];
  quality: Quality;
}) {
  const rows = useMemo(() => {
    const a: Beam[] = [];
    const n = quality === "low" ? 3 : 5;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const x = -0.8 + (i * 1.6) / (n - 1),
          y = 1 + (j * 1.6) / (n - 1);
        a.push(
          {
            at: [x, y, 0.04],
            scale: [0.018, 0.46, 0.02],
            rotation: [0, 0, Math.PI / 4],
          },
          {
            at: [x, y, 0.04],
            scale: [0.018, 0.46, 0.02],
            rotation: [0, 0, -Math.PI / 4],
          },
        );
      }
    return a;
  }, [quality]);
  return (
    <group position={at}>
      <Box position={[0, 1.8, 0]} scale={[2.2, 2.3, 0.08]} />
      <mesh position={[0, 1.8, 0.05]}>
        <planeGeometry args={[2, 2.08]} />
        <meshStandardMaterial
          color="#e5d4ad"
          emissive="#d7b67c"
          emissiveIntensity={0.22}
          roughness={1}
        />
      </mesh>
      <Beams rows={rows} color="#826645" />
      <Box
        position={[0, 0.58, 0.12]}
        scale={[2.4, 0.12, 0.25]}
        color={PALACE_COLORS.gold}
      />
    </group>
  );
}
export function PearlCurtain({ quality }: { quality: Quality }) {
  const mesh = useRef<InstancedMesh>(null),
    count = quality === "high" ? 96 : 40;
  useLayoutEffect(() => {
    const o = new Object3D();
    for (let i = 0; i < count; i++) {
      o.position.set(
        ((i % 8) - 3.5) * 0.22,
        3.45 - Math.floor(i / 8) * 0.08,
        0.02,
      );
      o.scale.set(0.013, 0.019, 0.013);
      o.updateMatrix();
      mesh.current!.setMatrixAt(i, o.matrix);
    }
    mesh.current!.instanceMatrix.needsUpdate = true;
    mesh.current!.computeBoundingSphere();
  }, [count]);
  return (
    <group position={[0, 0, -1.4]}>
      <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
        <sphereGeometry args={[1, 4, 3]} />
        <meshStandardMaterial color="#d7c6a0" metalness={0.2} roughness={0.5} />
      </instancedMesh>
    </group>
  );
}
export function Petals({ reducedMotion }: { reducedMotion: boolean }) {
  const mesh = useRef<InstancedMesh>(null),
    o = useMemo(() => new Object3D(), []);
  useFrame(({ clock }) => {
    if (!mesh.current) return;
    const t = reducedMotion ? 0 : clock.getElapsedTime() * 0.08;
    for (let i = 0; i < 12; i++) {
      o.position.set(
        Math.sin(i * 2.4 + t) * 2.8,
        0.8 + ((((i * 0.27 - t) % 2.3) + 2.3) % 2.3),
        -1.8 + (i % 3) * 0.4,
      );
      o.rotation.set(i, t + i, 0);
      o.scale.set(0.012, 0.024, 0.012);
      o.updateMatrix();
      mesh.current.setMatrixAt(i, o.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, 12]}
      frustumCulled={false}
    >
      <octahedronGeometry args={[1, 0]} />
      <meshBasicMaterial color="#edce9c" transparent opacity={0.45} />
    </instancedMesh>
  );
}
