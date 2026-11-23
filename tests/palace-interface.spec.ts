import { test, expect, type Page } from "@playwright/test";
import type { GameView } from "../src/types/runtime";
import { randomUUID } from "node:crypto";
test.describe.configure({ timeout: 90000 });
async function enter(page: Page, mode = "2d") {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(
    (mode) =>
      localStorage.setItem(
        "dnk-graphics-v1",
        JSON.stringify({ mode, quality: "low" }),
      ),
    mode,
  );
  await page.goto("/login");
  await page
    .getByRole("button", { name: "Chưa có tài khoản? Đăng ký" })
    .click();
  await page
    .getByLabel("Email", { exact: true })
    .fill(`h11-${randomUUID()}@example.test`);
  await page
    .getByLabel("Mật khẩu", { exact: true })
    .fill("Interface-test-2026!");
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
test("mobile scroll sheet leaves >=60% viewport scene visible, supports all three stops and dragging", async ({
  page,
}) => {
  await enter(page);
  const sheet = page.getByTestId("scroll-sheet"),
    scene = page.getByTestId("palace-stage");
  await expect(sheet).toHaveAttribute("data-level", "collapsed");
  const sceneBox = (await scene.boundingBox())!,
    sheetBox = (await sheet.boundingBox())!;
  expect(sheetBox.y - sceneBox.y).toBeGreaterThanOrEqual(844 * 0.6);
  await page.setViewportSize({ width: 390, height: 720 });
  const shortScene = (await scene.boundingBox())!,
    shortSheet = (await sheet.boundingBox())!;
  expect(shortSheet.y - shortScene.y).toBeGreaterThanOrEqual(720 * 0.6 - 1);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Mở nửa", exact: true }).click();
  await expect(sheet).toHaveAttribute("data-level", "half");
  await page.getByRole("button", { name: "Mở đầy", exact: true }).click();
  await expect(sheet).toHaveAttribute("data-level", "full");
  const handle = (await page.locator(".sheet-grip").boundingBox())!;
  await page.mouse.move(handle.x + 35, handle.y + 25);
  await page.mouse.down();
  await page.mouse.move(handle.x + 35, handle.y + 110, { steps: 6 });
  await page.mouse.up();
  await expect(sheet).toHaveAttribute("data-level", "half");
  await page.getByRole("button", { name: "Thu gọn", exact: true }).click();
  await expect(sheet).toHaveAttribute("data-level", "collapsed");
  for (const level of ["half", "full"]) {
    const grip = (await page.locator(".sheet-grip").boundingBox())!;
    await page.mouse.move(grip.x + 35, grip.y + 25);
    await page.mouse.down();
    await page.mouse.move(grip.x + 35, grip.y - 65, { steps: 6 });
    await page.mouse.up();
    await expect(sheet).toHaveAttribute("data-level", level);
  }
  await page.getByRole("button", { name: "Quan chế", exact: true }).click();
  await expect(scene).toBeVisible();
  await expect(page.locator(".seat-board")).toBeVisible();
});
test("unowned high-tier try-on changes SVG immediately, emits no write, cancel restores actual equipment; all cards have artwork", async ({
  page,
}) => {
  await enter(page);
  const read = async () =>
    (
      (await (await page.request.get("/api/game")).json()) as {
        state: GameView;
      }
    ).state;
  const before = await read();
  const writes: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && /\/api\/(actions|cosmetics)/.test(r.url()))
      writes.push(r.url());
  });
  await page.getByRole("button", { name: "Hồ sơ", exact: true }).click();
  await page.getByRole("button", { name: "Y phục", exact: true }).click();
  await page.getByLabel("Tầng phẩm cửa hàng").selectOption("5");
  const card = page.getByTestId("item-OUTFIT_5_1");
  await expect(card.locator("svg[role=img]")).toHaveCount(1);
  await card.getByRole("button", { name: /^Thử / }).click();
  await expect(page.getByTestId("tryon-status")).toContainText("Đang thử");
  await expect(page.getByTestId("scroll-sheet")).toHaveAttribute(
    "data-level",
    "collapsed",
  );
  const buy = page.getByRole("button", { name: /^Mua món đang thử/ });
  await expect(buy).toBeVisible();
  await expect(buy).toBeDisabled();
  const buyBox = (await buy.boundingBox())!;
  expect(buyBox.y + buyBox.height).toBeLessThanOrEqual(844 - 70);

  await expect(page.locator(".flat-avatar")).toHaveAttribute(
    "data-outfit",
    "OUTFIT_5_1",
  );
  await page.getByRole("button", { name: "Thu gọn", exact: true }).click();
  await expect(page.locator(".flat-avatar")).toBeVisible();
  const after = await read();
  expect(after.revision).toBe(before.revision);
  expect(after.character).toEqual(before.character);
  expect(after.cosmetics).toEqual(before.cosmetics);
  expect(writes).toHaveLength(0);
  await page.getByRole("button", { name: "Thoát thử", exact: true }).click();
  await expect(page.locator(".flat-avatar")).toHaveAttribute(
    "data-outfit",
    before.cosmetics!.equipment.OUTFIT ?? "plain",
  );
  await page.getByRole("button", { name: "Cung viện", exact: true }).click();
  const decor = page.getByTestId("decor-SCREEN_2");
  await expect(decor.locator("svg[role=img]")).toHaveCount(1);
  await decor.getByRole("button", { name: /^Xem thử / }).click();
  await expect(page.getByTestId("tryon-status")).toContainText("Bình phong");
  expect(writes).toHaveLength(0);
  await page.getByRole("button", { name: /^Sân khấu/ }).click();
  await expect(page.getByTestId("tryon-status")).toHaveCount(0);
});
test("shared full-screen 3D survives wardrobe try-on, camera presets and 2D switch without losing gameplay", async ({
  page,
}) => {
  await enter(page, "3d");
  await expect(
    page.getByRole("button", { name: "Bàn trà", exact: true }),
  ).toBeVisible({ timeout: 30000 });
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveCount(1);
  const initial = await canvas.boundingBox();
  expect(initial!.height).toBeGreaterThan(650);
  await page.getByRole("button", { name: "Hồ sơ", exact: true }).click();
  await page.getByRole("button", { name: "Y phục", exact: true }).click();
  await page
    .getByTestId("item-OUTFIT_1_1")
    .getByRole("button", { name: /^Thử / })
    .click();
  await expect(canvas).toHaveCount(1);
  await expect(page.getByTestId("tryon-status")).toBeVisible();
  await page.getByRole("button", { name: "Cận cảnh", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Cận cảnh", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Toàn cảnh", exact: true }).click();
  await page.getByText("Cài đặt đồ họa", { exact: true }).click();
  await page.getByLabel("Chất lượng đồ họa").selectOption("2d");
  await expect(canvas).toHaveCount(0);
  await expect(page.locator(".flat-avatar")).toHaveAttribute(
    "data-outfit",
    "OUTFIT_1_1",
  );
  await page.getByRole("button", { name: /^Sân khấu/ }).click();
  await page.getByTestId("action-STUDY").click();
  await expect(page.getByTestId("ap-balance")).toHaveText("9/15 AP");
});
