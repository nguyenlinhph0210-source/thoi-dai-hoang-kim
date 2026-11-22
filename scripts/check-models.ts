import { readdir, readFile, stat, writeFile, mkdir } from "node:fs/promises";
import { resolve, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { MODEL_ASSETS, type ModelAsset } from "../src/3d/assets";
export async function checkModels(
  directory: string,
  registry: readonly ModelAsset[] = MODEL_ASSETS,
): Promise<string[]> {
  const credits = await readFile(join(directory, "CREDITS.md"), "utf8");
  const rows = credits
    .split("\n")
    .filter((line) => line.startsWith("|"))
    .map((line) =>
      line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim()),
    );
  const available: string[] = [];
  const seen = new Set<string>();
  const walk = async (at: string): Promise<void> => {
    for (const entry of await readdir(at, { withFileTypes: true })) {
      const path = join(at, entry.name);
      if (entry.isSymbolicLink())
        throw new Error("Không dùng symlink trong public/models.");
      if (entry.isDirectory()) await walk(path);
      if (/\.(glb|gltf)$/i.test(entry.name)) {
        const url = `/models/${relative(directory, path).replaceAll("\\", "/")}`;
        const asset = registry.find((model) => model.path === url);
        if (!asset) throw new Error(`Mô hình chưa đăng ký: ${url}`);
        if (seen.has(asset.id))
          throw new Error(`Trùng mã mô hình: ${asset.id}`);
        seen.add(asset.id);
        const size = (await stat(path)).size;
        if (size > asset.maxBytes)
          throw new Error(
            `Mô hình vượt giới hạn byte: ${url} (${size} > ${asset.maxBytes})`,
          );
        const row = rows.find((cells) => cells[0] === entry.name);
        if (
          !row ||
          row.length !== 6 ||
          row.some((cell) => !cell || /TODO|chưa rõ/i.test(cell)) ||
          !/CC0|Tự tạo/i.test(row[3]) ||
          !/^\d{4}-\d{2}-\d{2}$/.test(row[5])
        ) {
          throw new Error(
            `Thiếu dòng giấy phép CREDITS.md hợp lệ: ${entry.name}`,
          );
        }
        const buffer = await readFile(path);
        if (
          buffer.length < 20 ||
          buffer.toString("ascii", 0, 4) !== "glTF" ||
          buffer.readUInt32LE(4) !== 2 ||
          buffer.readUInt32LE(8) !== buffer.length
        )
          throw new Error(`Không phải GLB 2.0 hợp lệ: ${url}`);
        if (asset.compression.draco)
          for (const file of ["draco_wasm_wrapper.js", "draco_decoder.wasm"])
            await stat(join(directory, "decoders/draco", file));
        if (asset.compression.ktx2)
          for (const file of ["basis_transcoder.js", "basis_transcoder.wasm"])
            await stat(join(directory, "decoders/basis", file));
        available.push(asset.id);
      }
    }
  };
  await walk(directory);
  return available.sort();
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  void (async () => {
    const directory = resolve("public/models");
    await mkdir(directory, { recursive: true });
    const available = await checkModels(directory);
    if (process.argv.includes("--write-manifest"))
      await writeFile(
        join(directory, "manifest.json"),
        JSON.stringify({ available }) + "\n",
      );
    console.log(
      `Models: ${available.length} GLB hợp lệ; slot còn thiếu dùng hình khối tự tạo.`,
    );
  })().catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : "Kiểm tra mô hình thất bại.",
    );
    process.exitCode = 1;
  });
}
