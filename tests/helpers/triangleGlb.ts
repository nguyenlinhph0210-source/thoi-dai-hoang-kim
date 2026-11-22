/** Self-created CC0 fixture: one triangle, no external files, textures or real-world content. */
export function triangleGlb(): Buffer {
  const binary = Buffer.alloc(44);
  [-0.4, 0, 0, 0.4, 0, 0, 0, 0.8, 0].forEach((value, index) =>
    binary.writeFloatLE(value, index * 4),
  );
  [0, 1, 2].forEach((value, index) =>
    binary.writeUInt16LE(value, 36 + index * 2),
  );
  const definition = {
    asset: { version: "2.0", generator: "Dai Noi Ky CC0 test fixture" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    buffers: [{ byteLength: binary.length }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 36, target: 34962 },
      { buffer: 0, byteOffset: 36, byteLength: 6, target: 34963 },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: "VEC3",
        min: [-0.4, 0, 0],
        max: [0.4, 0.8, 0],
      },
      { bufferView: 1, componentType: 5123, count: 3, type: "SCALAR" },
    ],
  };
  const raw = Buffer.from(JSON.stringify(definition)),
    json = Buffer.alloc(Math.ceil(raw.length / 4) * 4, 32);
  raw.copy(json);
  const result = Buffer.alloc(12 + 8 + json.length + 8 + binary.length);
  result.write("glTF");
  result.writeUInt32LE(2, 4);
  result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(json.length, 12);
  result.writeUInt32LE(0x4e4f534a, 16);
  json.copy(result, 20);
  result.writeUInt32LE(binary.length, 20 + json.length);
  result.writeUInt32LE(0x004e4942, 24 + json.length);
  binary.copy(result, 28 + json.length);
  return result;
}
