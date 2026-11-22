import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assessFrameWindow,
  chooseDeviceQuality,
  parseGraphicsPreference,
  QUALITY_CONFIG,
  supportsWebGL2,
} from "../src/3d/quality";
import { MODEL_ASSETS } from "../src/3d/assets";
import { checkModels } from "../scripts/check-models";
import { triangleGlb } from "./helpers/triangleGlb";
test("device policy selects conservative 2D/low/medium/high and clamps DPR/shadows", () => {
  assert.equal(chooseDeviceQuality({ dpr: 1, cores: 2 }), "2d");
  assert.equal(chooseDeviceQuality({ dpr: 1, memoryGb: 1 }), "2d");
  assert.equal(chooseDeviceQuality({ dpr: 1, saveData: true }), "2d");
  assert.equal(chooseDeviceQuality({ dpr: 3, cores: 8, memoryGb: 8 }), "low");
  assert.equal(chooseDeviceQuality({ dpr: 1, cores: 4, memoryGb: 4 }), "low");
  assert.equal(
    chooseDeviceQuality({ dpr: 2, cores: 6, memoryGb: 8 }),
    "medium",
  );
  assert.equal(chooseDeviceQuality({ dpr: 1, cores: 8, memoryGb: 8 }), "high");
  assert.equal(chooseDeviceQuality({ dpr: 1 }), "low");
  assert.equal(QUALITY_CONFIG.low.dpr, 1);
  assert.equal(QUALITY_CONFIG.medium.dpr, 1.5);
  assert.equal(QUALITY_CONFIG.low.shadows, false);
  assert.equal(QUALITY_CONFIG.medium.shadows, false);
  assert.equal(QUALITY_CONFIG.high.shadows, true);
});
test("persisted graphics preference validation and unavailable WebGL fail closed", () => {
  assert.deepEqual(parseGraphicsPreference("bad JSON"), {
    mode: "auto",
    quality: "auto",
  });
  assert.deepEqual(
    parseGraphicsPreference('{"mode":"3d","quality":"unlimited"}'),
    { mode: "auto", quality: "auto" },
  );
  assert.deepEqual(parseGraphicsPreference('{"mode":"2d","quality":"auto"}'), {
    mode: "2d",
    quality: "auto",
  });
  assert.equal(supportsWebGL2(), false); // Node has no DOM/WebGL; browser failures are covered in Playwright.
});
test("sustained frame degradation steps down only after two windows, including final 2D fallback", () => {
  assert.deepEqual(assessFrameWindow("high", 20, 0), {
    next: "high",
    slowWindows: 1,
  });
  assert.equal(assessFrameWindow("high", 20, 1).next, "medium");
  assert.equal(assessFrameWindow("medium", 20, 1).next, "low");
  assert.equal(assessFrameWindow("low", 12, 1).next, "2d");
  assert.equal(assessFrameWindow("low", 25, 1).slowWindows, 0);
});
test("model gate rejects oversized/uncredited/unregistered files; validates missing and credited GLB", async () => {
  const root = await mkdtemp(join(tmpdir(), "dnk-models-")),
    model = MODEL_ASSETS[0];
  try {
    await writeFile(join(root, "CREDITS.md"), "# Empty catalogue\n");
    assert.deepEqual(await checkModels(root), []);
    const file = join(root, "screen.glb");
    await writeFile(file, Buffer.alloc(model.maxBytes + 1));
    await assert.rejects(checkModels(root), /vượt giới hạn/);
    const buffer = triangleGlb();
    await writeFile(file, buffer);
    await assert.rejects(checkModels(root), /CREDITS/);
    await writeFile(
      join(root, "CREDITS.md"),
      "| screen.glb | Tự tạo | Dự án | CC0-1.0 | https://example.test/license | 2026-11-22 |\n",
    );
    assert.deepEqual(await checkModels(root), [model.id]);
    await writeFile(join(root, "unregistered.glb"), buffer);
    await assert.rejects(checkModels(root), /chưa đăng ký/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
