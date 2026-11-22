import { readFile, stat } from "node:fs/promises";
import { gzipSync } from "node:zlib";
void (async () => {
  const manifest = JSON.parse(
    await readFile(".next/react-loadable-manifest.json", "utf8"),
  ) as Record<string, { files: string[] }>;
  const files = [
    ...new Set(
      Object.entries(manifest)
        .filter(([key]) => key.includes("PalaceCanvas"))
        .flatMap(([, value]) => value.files)
        .filter((file) => file.endsWith(".js")),
    ),
  ];
  if (!files.length)
    throw new Error("Chưa có chunk PalaceCanvas. Hãy npm run build trước.");
  let bytes = 0,
    gzip = 0;
  for (const file of files) {
    const path = `.next/${file}`;
    const size = (await stat(path)).size,
      compressed = gzipSync(await readFile(path)).length;
    bytes += size;
    gzip += compressed;
    console.log(`${file}: ${size} bytes, gzip ${compressed} bytes`);
  }
  console.log(
    `TOTAL deferred 3D: ${files.length} chunks, ${(bytes / 1024).toFixed(1)} KiB raw, ${(gzip / 1024).toFixed(1)} KiB gzip (gzip per file).`,
  );
})().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Không đo được chunk.",
  );
  process.exitCode = 1;
});
