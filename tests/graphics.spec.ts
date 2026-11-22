import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { triangleGlb } from "./helpers/triangleGlb";
test.describe.configure({ timeout: 60000 }); // Software WebGL has no hardware GPU on the runner.
async function enterHarem(page: Page) {
  await page.goto("/login");
  await page
    .getByRole("button", { name: "Chưa có tài khoản? Đăng ký" })
    .click();
  await page
    .getByLabel("Email", { exact: true })
    .fill(`graphics-${randomUUID()}@example.test`);
  await page
    .getByLabel("Mật khẩu", { exact: true })
    .fill("Graphics-test-2026!");
  await page
    .getByRole("button", { name: "Tạo tài khoản", exact: true })
    .click();
  await expect(page).toHaveURL(/\/setup/);
  await page.getByRole("button", { name: /^Hậu cung/ }).click();
  await page.getByRole("button", { name: "Khai mở thân phận" }).click();
  await page.getByRole("button", { name: "Chấp nhận thân phận" }).click();
  await page.getByRole("button", { name: "Xác nhận nhập kinh" }).click();
  await expect(page.getByTestId("palace-stage")).toBeVisible();
}
async function threeChunks() {
  const manifest = JSON.parse(
    await readFile(".next/react-loadable-manifest.json", "utf8"),
  ) as Record<string, { files: string[] }>;
  return [
    ...new Set(
      Object.entries(manifest)
        .filter(([key]) => key.includes("PalaceCanvas"))
        .flatMap(([, value]) => value.files),
    ),
  ];
}
test("login and chosen 2D never request any 3D chunk; HTML game actions remain playable", async ({
  page,
}) => {
  const chunks = await threeChunks(),
    requests: string[] = [];
  expect(chunks.length).toBeGreaterThan(0);
  page.on("request", (request) => {
    if (chunks.some((file) => request.url().includes(`/_next/${file}`)))
      requests.push(request.url());
  });
  await page.addInitScript(() =>
    localStorage.setItem(
      "dnk-graphics-v1",
      JSON.stringify({ mode: "2d", quality: "auto" }),
    ),
  );
  await page.goto("/login");
  await expect(
    page.getByRole("button", { name: "Đăng nhập", exact: true }),
  ).toBeVisible();
  expect(requests).toHaveLength(0);
  await enterHarem(page);
  await expect(page.getByTestId("palace-stage")).toHaveAttribute(
    "data-mode",
    "2d",
  );
  await page.getByTestId("action-STUDY").click();
  await expect(page.getByTestId("ap-balance")).toHaveText("9/15 AP");
  await page.reload();
  await expect(page.getByTestId("palace-stage")).toHaveAttribute(
    "data-mode",
    "2d",
  );
  expect(requests).toHaveLength(0);
  await expect(page.locator("canvas")).toHaveCount(0);
});
test("no WebGL selects 2D without loading the renderer", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "dnk-graphics-v1",
      JSON.stringify({ mode: "3d", quality: "low" }),
    );
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...args: unknown[]
    ) {
      if (type === "webgl2" || type === "webgl") return null;
      return Reflect.apply(original, this, [type, ...args]);
    } as typeof original;
  });
  await enterHarem(page);
  await expect(page.getByTestId("palace-stage")).toHaveAttribute(
    "data-mode",
    "2d",
  );
  await expect(page.getByText(/Thiết bị chưa hỗ trợ WebGL 2/)).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);
});
test("3D render exceptions reach the boundary and keep the 2D game usable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "dnk-graphics-v1",
      JSON.stringify({ mode: "3d", quality: "low" }),
    );
    const original = HTMLCanvasElement.prototype.getContext;
    let probes = 0;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...args: unknown[]
    ) {
      if (type === "webgl2" && ++probes > 1)
        throw new Error("SCENE_TEST_FAILURE");
      return Reflect.apply(original, this, [type, ...args]);
    } as typeof original;
  });
  const logs: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && message.text().includes("[graphics]"))
      logs.push(message.text());
  });
  await enterHarem(page);
  await expect(page.getByText(/Cảnh 3D chưa khả dụng/)).toBeVisible({
    timeout: 20000,
  });
  await expect(page.getByTestId("palace-stage")).toHaveAttribute(
    "data-mode",
    "2d",
  );
  expect(logs).toContain("[graphics] SCENE_UNAVAILABLE: switched to 2D");
  await page.getByTestId("action-STUDY").click();
  await expect(page.getByTestId("ap-balance")).toHaveText("9/15 AP");
});
test("software WebGL renders the room, HTML hotspot bridge, gestures and manual 2D setting", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    if (!localStorage.getItem("dnk-graphics-v1"))
      localStorage.setItem(
        "dnk-graphics-v1",
        JSON.stringify({ mode: "3d", quality: "low" }),
      );
  });
  await enterHarem(page);
  await expect(page.getByTestId("palace-stage")).toHaveAttribute(
    "data-mode",
    "3d",
  );
  await expect(
    page.getByRole("button", { name: "Bàn trà", exact: true }),
  ).toBeVisible({ timeout: 30000 });
  await page.getByRole("button", { name: "Bàn trà", exact: true }).click();
  await expect(
    page.getByText("Một chén trà ấm đang đợi bên cửa.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("ap-balance")).toHaveText("10/15 AP");
  await expect(page.getByLabel("Tiến độ tải cảnh")).toHaveCount(0);
  await expect(page.getByTestId("3d-metrics")).toHaveCount(0); // Production never exposes debug panel.
  const box = await page.locator("canvas").boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(300);
  await page.mouse.move(box!.x + box!.width / 2, box!.y + 80);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 + 40, box!.y + 100, {
    steps: 5,
  });
  await page.mouse.up();
  await page.mouse.wheel(0, -100);
  await page.screenshot({ path: "/tmp/dnk-g1-mobile.png", fullPage: true });
  await page.getByText("Cài đặt đồ họa", { exact: true }).click();
  await page.getByLabel("Chất lượng đồ họa").selectOption("2d");
  await expect(page.locator("canvas")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("dnk-graphics-v1")!).mode,
    ),
  ).toBe("2d");
  await page.reload();
  await expect(page.getByTestId("palace-stage")).toHaveAttribute(
    "data-mode",
    "2d",
  );
});

test("a present optional GLB loads through the real loader while other slots stay procedural", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "dnk-graphics-v1",
      JSON.stringify({ mode: "3d", quality: "low" }),
    ),
  );
  await page.route("**/models/manifest.json", (route) =>
    route.fulfill({ json: { available: ["screen"] } }),
  );
  let loaded = 0;
  await page.route("**/models/screen.glb", (route) => {
    loaded++;
    return route.fulfill({
      contentType: "model/gltf-binary",
      body: triangleGlb(),
    });
  });
  await enterHarem(page);
  await expect(
    page.getByRole("button", { name: "Bàn trà", exact: true }),
  ).toBeVisible({ timeout: 30000 });
  await expect(page.getByLabel("Tiến độ tải cảnh")).toHaveCount(0);
  await expect(page.getByTestId("palace-stage")).toHaveAttribute(
    "data-mode",
    "3d",
  );
  expect(loaded).toBe(1);
});
