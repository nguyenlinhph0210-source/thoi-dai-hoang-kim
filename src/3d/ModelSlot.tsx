"use client";
import { useEffect, useMemo, type ReactNode } from "react";
import { useLoader, useThree } from "@react-three/fiber";
import {
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Texture,
  type WebGLRenderer,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { MODEL_ASSETS, MODEL_DECODERS, type ModelAsset } from "./assets";
// Loader configuration runs before Suspense commits. Own workers at renderer scope,
// so failed/suspended loads are cleaned up too, not just successfully mounted slots.
const decoders = new WeakMap<
  WebGLRenderer,
  { draco?: DRACOLoader; ktx2?: KTX2Loader }
>();
export function disposeModelDecoders(gl: WebGLRenderer) {
  const resources = decoders.get(gl);
  resources?.draco?.dispose();
  resources?.ktx2?.dispose();
  decoders.delete(gl);
}
function LoadedModel({ asset, color }: { asset: ModelAsset; color?: string }) {
  const gl = useThree((state) => state.gl);
  const model = useLoader(GLTFLoader, asset.path, (loader) => {
    const resources = decoders.get(gl) ?? {};
    decoders.set(gl, resources);
    if (asset.compression.draco) {
      resources.draco ??= new DRACOLoader()
        .setDecoderPath(MODEL_DECODERS.draco)
        .setWorkerLimit(1);
      loader.setDRACOLoader(resources.draco);
    }
    if (asset.compression.meshopt) loader.setMeshoptDecoder(MeshoptDecoder);
    if (asset.compression.ktx2) {
      resources.ktx2 ??= new KTX2Loader()
        .setTranscoderPath(MODEL_DECODERS.ktx2)
        .setWorkerLimit(1)
        .detectSupport(gl);
      loader.setKTX2Loader(resources.ktx2);
    }
  });
  const scene = useMemo(() => {
    const clone = model.scene.clone(true);
    let triangles = 0;
    clone.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      triangles +=
        ((object instanceof InstancedMesh ? object.count : 1) *
          (object.geometry.index?.count ??
            object.geometry.getAttribute("position")?.count ??
            0)) /
        3;
      object.castShadow = true;
      object.receiveShadow = true;
      if (color) {
        const materials = (
          Array.isArray(object.material) ? object.material : [object.material]
        ).map((material) => {
          const clone = material.clone();
          if (clone instanceof MeshStandardMaterial) clone.color.set(color);
          return clone;
        });
        object.material = Array.isArray(object.material)
          ? materials
          : materials[0];
      }
      for (const material of Array.isArray(object.material)
        ? object.material
        : [object.material]) {
        for (const value of Object.values(material)) {
          if (!(value instanceof Texture)) continue;
          const image = value.image as
            { width?: number; height?: number } | undefined;
          if (
            Math.max(image?.width ?? 0, image?.height ?? 0) >
            asset.maxTextureSize
          )
            throw new Error("MODEL_TEXTURE_BUDGET");
        }
      }
    });
    if (triangles > asset.maxTriangles)
      throw new Error("MODEL_TRIANGLE_BUDGET");
    return clone;
  }, [asset, model, color]);
  useEffect(
    () => () => {
      if (color)
        scene.traverse((object) => {
          if (object instanceof Mesh)
            for (const material of Array.isArray(object.material)
              ? object.material
              : [object.material])
              material.dispose();
        });
    },
    [scene, color],
  );
  return <primitive object={scene} dispose={null} />;
}
export default function ModelSlot({
  id,
  available,
  children,
  color,
}: {
  id: string;
  available: string[];
  children: ReactNode;
  color?: string;
}) {
  const asset = MODEL_ASSETS.find((model) => model.id === id);
  return asset && available.includes(id) ? (
    <LoadedModel asset={asset} color={color} />
  ) : (
    <>{children}</>
  );
}
