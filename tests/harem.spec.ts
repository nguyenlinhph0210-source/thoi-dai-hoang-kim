import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
test.describe.configure({ timeout: 90000 });
async function life(page: Page, branch = "Hậu cung") {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    if (!localStorage.getItem("dnk-graphics-v1"))
      localStorage.setItem(
        "dnk-graphics-v1",
        JSON.stringify({ mode: "2d", quality: "auto" }),
      );
  });
  await page.goto("/login");
  await page
    .getByRole("button", { name: "Chưa có tài khoản? Đăng ký" })
    .click();
  await page
    .getByLabel("Email", { exact: true })
    .fill(`harem-${randomUUID()}@example.test`);
  await page.getByLabel("Mật khẩu", { exact: true }).fill("Harem-test-2026!");
  await page
    .getByRole("button", { name: "Tạo tài khoản", exact: true })
    .click();
  await expect(page).toHaveURL(/\/setup/);
  await page.getByRole("button", { name: new RegExp(`^${branch}`) }).click();
  await page.getByRole("button", { name: "Khai mở thân phận" }).click();
  await page.getByRole("button", { name: "Chấp nhận thân phận" }).click();
  await page.getByRole("button", { name: "Xác nhận nhập kinh" }).click();
  await expect(
    page.getByRole("heading", { name: "Sân khấu chính", exact: true }),
  ).toBeVisible();
}
const read = async (page: Page) =>
  (await (await page.request.get("/api/game")).json()).state;
const profile = async (page: Page, section: string) => {
  await page.getByRole("button", { name: "Hồ sơ", exact: true }).click();
  await page.getByRole("button", { name: section, exact: true }).click();
};
test("H1 buy lost-response retry preserves UUID, spends server price once/no AP, equip/unequip and 2D appearance survive reload", async ({
  page,
}) => {
  await life(page);
  const before = await read(page),
    attempts: { key: string; command: { type: string; code: string } }[] = [];
  await page.route("**/api/cosmetics", async (route) => {
    attempts.push(route.request().postDataJSON());
    if (attempts.length === 1) {
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await profile(page, "Y phục");
  const item = page.getByTestId("item-OUTFIT_1_1");
  await item
    .getByRole("button", { name: "Mua · 20 lượng", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Thử lại thao tác cũ", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Thử lại thao tác cũ", exact: true })
    .click();
  await expect(
    item.getByRole("button", { name: "Trang bị", exact: true }),
  ).toBeVisible();
  expect(attempts).toHaveLength(2);
  expect(attempts[0]).toEqual(attempts[1]);
  let state = await read(page);
  expect(state.character.characterSilver).toBe(
    before.character.characterSilver - 20,
  );
  expect(state.account.actionPoints).toBe(10);
  expect(state.cosmetics.purchasesToday).toBe(1);
  expect(state.pendingEvents).toHaveLength(0);
  await item.getByRole("button", { name: "Trang bị", exact: true }).click();
  await expect(
    item.getByRole("button", { name: "Đang trang bị", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Sân khấu/ }).click();
  await expect(page.getByTestId("cosmetic-2d")).toContainText("Y phục · Viền");
  await expect(page.getByTestId("ap-balance")).toHaveText("10/15 AP");
  await page.reload();
  state = await read(page);
  expect(state.cosmetics.equipment.OUTFIT).toBe("OUTFIT_1_1");
  await profile(page, "Y phục");
  await page.getByRole("button", { name: "Tháo y phục", exact: true }).click();
  await expect(
    item.getByRole("button", { name: "Trang bị", exact: true }),
  ).toBeVisible();
  const response = await page.request.post("/api/cosmetics", {
    data: {
      key: randomUUID(),
      revision: (await read(page)).revision,
      command: {
        type: "EQUIP_ITEM",
        code: "OUTFIT_1_1",
        price: 0,
        effect: { audienceFavPct: 999 },
      },
      characterSilver: 999999,
    },
  });
  expect(response.status()).toBe(200);
  const after = await read(page);
  expect(after.character.characterSilver).toBe(
    before.character.characterSilver - 20,
  );
  expect(after.character.cha).toBe(before.character.cha);
  expect(after.character).not.toHaveProperty("suspicion");
});
test("H1 upgrade and decorative purchase/select persist in 2D without AP costs", async ({
  page,
}) => {
  await life(page);
  let state = await read(page);
  for (let i = 0; state.character.characterSilver < 105 && i < 8; i++) {
    if (state.character.hp <= 12) {
      await page.getByTestId("action-REST").click();
      await expect(page.getByTestId("ap-balance")).toHaveText(
        `${state.account.actionPoints - 1}/15 AP`,
      );
      state = await read(page);
    }
    await page.getByTestId("action-WORK").click();
    await expect(page.getByTestId("ap-balance")).toHaveText(
      `${state.account.actionPoints - 1}/15 AP`,
    );
    state = await read(page);
  }
  const ap = state.account.actionPoints;
  await profile(page, "Cung viện");
  await page
    .getByRole("button", { name: "Nâng cấp · 80 lượng", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Cung viện cấp 2/5", exact: true }),
  ).toBeVisible();
  const decor = page.getByTestId("decor-SCREEN_1");
  await decor
    .getByRole("button", { name: "Mua · 25 lượng", exact: true })
    .click();
  await expect(
    decor.getByRole("button", { name: "Bày kiểu này", exact: true }),
  ).toBeVisible();
  await decor
    .getByRole("button", { name: "Bày kiểu này", exact: true })
    .click();
  await expect(
    decor.getByRole("button", { name: "Đang bày", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Sân khấu/ }).click();
  await expect(page.getByTestId("cosmetic-2d")).toContainText(
    "Cung viện cấp 2",
  );
  await expect(page.getByTestId("cosmetic-2d")).toContainText(
    "Bình phong · Viền son",
  );
  await expect(page.getByTestId("ap-balance")).toHaveText(`${ap}/15 AP`);
  await page.reload();
  state = await read(page);
  expect(state.cosmetics.chamber.level).toBe(2);
  expect(state.cosmetics.chamber.decor.SCREEN).toBe("SCREEN_1");
  await page.getByRole("button", { name: "Nhật ký", exact: true }).click();
  await expect(page.locator(".journal-list")).toContainText(
    "Cung viện đã lên cấp 2",
  );
});
test("other branches show coming soon; server rejects H1 and client price/branch spoofing", async ({
  page,
}) => {
  await life(page, "Văn giai");
  const before = await read(page);
  await profile(page, "Y phục");
  await expect(
    page.getByText("Sắp ra mắt cho nhánh của bạn.", { exact: true }),
  ).toBeVisible();
  const response = await page.request.post("/api/cosmetics", {
    data: {
      key: randomUUID(),
      revision: before.revision,
      command: { type: "BUY_ITEM", code: "OUTFIT_1_1" },
      price: 0,
      branch: "HAREM",
    },
  });
  expect(response.status()).toBe(400);
  const after = await read(page);
  expect(after.character.characterSilver).toBe(
    before.character.characterSilver,
  );
  expect(after.account.actionPoints).toBe(10);
  expect(
    (
      await page.request.post("/api/cosmetics", {
        headers: { Origin: "https://foreign.example.test" },
        data: {},
      })
    ).status(),
  ).toBe(403);
});
