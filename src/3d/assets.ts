/** Optional, local GLB replacements. No renderer dependencies in this registry. */
export type ModelKind = "architecture" | "furniture" | "decoration";
export interface ModelAsset {
  id: string;
  name: string;
  path: string;
  kind: ModelKind;
  maxBytes: number;
  maxTriangles: number;
  maxTextureSize: number;
  compression: { draco: boolean; meshopt: boolean; ktx2: boolean };
}
export const MODEL_ASSETS: readonly ModelAsset[] = [
  {
    id: "screen",
    name: "Bình phong",
    path: "/models/screen.glb",
    kind: "furniture",
    maxBytes: 2097152,
    maxTriangles: 8000,
    maxTextureSize: 1024,
    compression: { draco: false, meshopt: true, ktx2: false },
  },
  {
    id: "seat",
    name: "Sập gỗ",
    path: "/models/seat.glb",
    kind: "furniture",
    maxBytes: 2097152,
    maxTriangles: 8000,
    maxTextureSize: 1024,
    compression: { draco: false, meshopt: true, ktx2: false },
  },
  {
    id: "table",
    name: "Bàn trà",
    path: "/models/table.glb",
    kind: "furniture",
    maxBytes: 2097152,
    maxTriangles: 8000,
    maxTextureSize: 1024,
    compression: { draco: false, meshopt: true, ktx2: false },
  },
  {
    id: "vase",
    name: "Bình hoa",
    path: "/models/vase.glb",
    kind: "decoration",
    maxBytes: 1048576,
    maxTriangles: 2000,
    maxTextureSize: 512,
    compression: { draco: false, meshopt: true, ktx2: false },
  },
  {
    id: "lantern",
    name: "Đèn lồng",
    path: "/models/lantern.glb",
    kind: "decoration",
    maxBytes: 1048576,
    maxTriangles: 2000,
    maxTextureSize: 512,
    compression: { draco: false, meshopt: true, ktx2: false },
  },
];
export const MODEL_DECODERS = {
  draco: "/models/decoders/draco/",
  ktx2: "/models/decoders/basis/",
};
export const SCENE_TRIANGLE_BUDGET = 40000;
export interface ModelManifest {
  available: string[];
}
