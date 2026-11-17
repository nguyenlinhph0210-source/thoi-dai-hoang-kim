import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
const password = "Court-test-2026!";
async function register(
  page: Page,
  email = `court-${randomUUID()}@example.test`,
) {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await page
    .getByRole("button", { name: "Chưa có tài khoản? Đăng ký" })
    .click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Tạo tài khoản", exact: true })
    .click();
  await expect(page).toHaveURL(/\/setup/);
  return email;
}
async function createLife(page: Page, branch = "Văn giai") {
  await page.getByRole("button", { name: new RegExp(`^${branch}`) }).click();
  await page.getByRole("button", { name: "Khai mở thân phận" }).click();
  await expect(page.getByTestId("free-rerolls")).toHaveText("3 / 3");
  await page.getByRole("button", { name: "Chấp nhận thân phận" }).click();
  await page.getByRole("button", { name: "Xác nhận nhập kinh" }).click();
  await expect(
    page.getByRole("heading", { name: "Sân khấu chính", exact: true }),
  ).toBeVisible();
}
for (const branch of ["Văn giai", "Võ giai", "Nội cung", "Hậu cung"])
  test(`${branch}: register, setup, confirm and enter court`, async ({
    page,
  }) => {
    await register(page);
    await createLife(page, branch);
    await expect(page.getByTestId("ap-balance")).toHaveText("10/15 AP");
    await page.reload();
    await expect(page.getByTestId("ap-balance")).toHaveText("10/15 AP");
  });
test("auth required for pages/API; logout revokes local session and another user has isolated state", async ({
  page,
  context,
}) => {
  await page.goto("/setup");
  await expect(page).toHaveURL(/\/login/);
  expect((await page.request.get("/api/game")).status()).toBe(401);
  expect((await page.request.get("/api/world-time")).status()).toBe(401);
  const email = await register(page);
  await createLife(page);
  await page.getByTestId("action-STUDY").click();
  await expect(page.getByTestId("ap-balance")).toHaveText("9/15 AP");
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByTestId("ap-balance")).toHaveText("9/15 AP");
  const other = await context.browser()!.newContext();
  const otherPage = await other.newPage();
  await register(otherPage);
  await expect(otherPage.getByTestId("free-rerolls")).toHaveText("3 / 3");
  await other.close();
});
test("reroll count survives logout/login and expires on confirmation", async ({
  page,
}) => {
  await register(page);
  await page.getByRole("button", { name: "Khai mở thân phận" }).click();
  for (let n = 2; n >= 0; n--) {
    await page.getByRole("button", { name: /Đổi thân phận/ }).click();
    await expect(page.getByTestId("free-rerolls")).toHaveText(`${n} / 3`);
  }
  await expect(
    page.getByRole("button", { name: /Đổi thân phận/ }),
  ).toBeDisabled();
  await page.reload();
  await expect(page.getByTestId("free-rerolls")).toHaveText("0 / 3");
  await page.getByRole("button", { name: "Chấp nhận thân phận" }).click();
  await page.getByRole("button", { name: "Xác nhận nhập kinh" }).click();
  await expect(page.getByTestId("ap-balance")).toHaveText("10/15 AP");
});
test("daily cap, hidden stats, client clock tampering and exact API idempotency", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Date.now = () => 4102444800000;
  });
  await register(page);
  await createLife(page);
  const foreign = await page.request.post("/api/actions", {
    headers: { Origin: "https://other.example.test" },
    data: { code: "STUDY", key: randomUUID() },
  });
  expect(foreign.status()).toBe(403);
  const opaque = await page.request.post("/api/actions", {
    headers: { Origin: "null" },
    data: { code: "STUDY", key: randomUUID() },
  });
  expect(opaque.status()).toBe(403);
  const key = randomUUID();
  const first = await page.request.post("/api/actions", {
    data: { code: "STUDY", key, ap: 999, serverNow: 4102444800000 },
  });
  expect(first.ok()).toBe(true);
  const result = await first.json();
  expect(
    (
      await page.request.post("/api/actions", { data: { code: "STUDY", key } })
    ).ok(),
  ).toBe(true);
  await page.request.post("/api/actions", {
    data: { code: "REST", key: randomUUID() },
  });
  expect(
    await (
      await page.request.post("/api/actions", { data: { code: "STUDY", key } })
    ).json(),
  ).toEqual(result);
  for (let i = 0; i < 4; i++)
    expect(
      (
        await page.request.post("/api/actions", {
          data: { code: "STUDY", key: randomUUID() },
        })
      ).ok(),
    ).toBe(true);
  const blocked = await page.request.post("/api/actions", {
    data: { code: "STUDY", key: randomUUID() },
  });
  expect(blocked.status()).toBe(400);
  const state = await (await page.request.get("/api/game")).json();
  expect(state.state.account.actionPoints).toBe(4);
  expect(state.journal.logs).toHaveLength(6);
  const body = JSON.stringify(state);
  expect(body).not.toContain('"suspicion":');
  expect(body).not.toContain('"suspicionFloor":');
  await page.reload();
  await expect(page.getByTestId("action-STUDY")).toBeDisabled();
  await expect(page.getByTestId("world-time")).toContainText(
    "Thiên Nguyên năm 8",
  );
});
test("lost response retry retains UUID, spends AP once and writes one log", async ({
  page,
}) => {
  await register(page);
  await createLife(page);
  const keys: string[] = [];
  let first = true;
  await page.route("**/api/actions", async (route) => {
    keys.push((route.request().postDataJSON() as { key: string }).key);
    if (first) {
      first = false;
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await page.getByTestId("action-STUDY").click();
  await expect(
    page.getByRole("button", { name: "Thử lại yêu cầu cũ" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Thử lại yêu cầu cũ" }).click();
  await expect(page.getByTestId("ap-balance")).toHaveText("9/15 AP");
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
  expect(
    (await (await page.request.get("/api/game")).json()).journal.logs,
  ).toHaveLength(1);
});
test("mobile navigation, empty logs and seat counts; no overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await register(page);
  await createLife(page);
  const nav = page.getByRole("navigation", { name: "Điều hướng chính" });
  await expect(nav).toBeVisible();
  await nav.getByRole("button", { name: "Hồ sơ", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Hồ sơ thân phận" }),
  ).toBeVisible();
  await nav.getByRole("button", { name: "Quan chế", exact: true }).click();
  await expect(page.getByLabel("Nhánh Quan chế")).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Đơn chờ" }),
  ).toBeVisible();
  await page.getByLabel("Nhánh Quan chế").selectOption("MILITARY");
  await expect(page.getByRole("caption")).toContainText("Võ giai");
  await nav.getByRole("button", { name: "Nhật ký", exact: true }).click();
  await expect(page.getByText("Chưa có dấu chân trong triều.")).toBeVisible();
  await nav.getByRole("button", { name: "Sân khấu", exact: true }).click();
  await expect(page.getByTestId("action-STUDY")).toBeVisible();
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "/tmp/dai-noi-ky-m2-mobile.png",
    fullPage: true,
  });
});

test("promotion profile: locked three v1 conditions, merit updates, exam locked and requirements survive another device", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const email = await register(page);
  await createLife(page);
  await expect(
    page.getByRole("heading", { name: "Tiến trình thăng phẩm", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".promotion-condition")).toHaveCount(3);
  await expect(page.getByTestId("action-EXAM")).toBeDisabled();
  await expect(page.getByTestId("action-APPLY")).toBeDisabled();
  await expect(
    page.getByText("Phiên xét duyệt kế tiếp sau:", { exact: false }),
  ).toBeVisible();
  const original = (await (await page.request.get("/api/game")).json()).state;
  expect(original.character.promotionRequirements.tableVersion).toBe("v1");
  expect(original.promotion.seatAvailable).toBe("UNKNOWN");
  for (const c of original.promotion.conditions)
    if (c.stat === "suspicion") expect(c.current).toBeNull();
  const rejected = await page.request.post("/api/actions", {
    data: { code: "EXAM", key: randomUUID() },
  });
  expect(rejected.status()).toBe(400);
  await page.getByTestId("action-STUDY").click();
  await expect(page.getByTestId("ap-balance")).toHaveText("9/15 AP");
  const updated = (await (await page.request.get("/api/game")).json()).state;
  expect(updated.character.merit).toBe(1);
  expect(updated.character.promotionRequirements).toEqual(
    original.character.promotionRequirements,
  );
  await page.reload();
  await expect(page.locator(".promotion-condition")).toHaveCount(3);
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  const other = await context.browser()!.newContext();
  const device = await other.newPage();
  await device.goto("http://127.0.0.1:3100/login");
  await device.getByLabel("Email", { exact: true }).fill(email);
  await device.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await device.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(device.getByTestId("ap-balance")).toHaveText("9/15 AP");
  const restored = (
    await (await device.request.get("http://127.0.0.1:3100/api/game")).json()
  ).state;
  expect(restored.character.promotionRequirements).toEqual(
    original.character.promotionRequirements,
  );
  await device.setViewportSize({ width: 390, height: 844 });
  await device
    .getByRole("navigation", { name: "Điều hướng chính" })
    .getByRole("button", { name: "Hồ sơ", exact: true })
    .click();
  await expect(
    device.getByRole("heading", { name: "Tiến trình thăng phẩm", exact: true }),
  ).toBeVisible();
  await device.screenshot({
    path: "/tmp/dai-noi-ky-3a-profile.png",
    fullPage: true,
  });
  await other.close();
});

test("Quan chế shows counts across branches and APPLY rejection leaves AP and journal unchanged", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await register(page);
  await createLife(page);
  const before = (await (await page.request.get("/api/game")).json()).state;
  const response = await page.request.post("/api/actions", {
    data: { code: "APPLY", key: randomUUID() },
  });
  expect(response.status()).toBe(400);
  const after = (await (await page.request.get("/api/game")).json()).state;
  expect(after.account.actionPoints).toBe(before.account.actionPoints);
  expect(after.seatApplication).toBeNull();
  expect(after.seatBoard).toHaveLength(52);
  for (const row of after.seatBoard) {
    expect(row).not.toHaveProperty("characterId");
    expect(row).not.toHaveProperty("accountId");
    expect(row).not.toHaveProperty("score");
    expect(row).not.toHaveProperty("suspicion");
  }
  await page.getByLabel("Nhánh Quan chế").selectOption("HAREM");
  await expect(page.getByRole("caption")).toContainText("Hậu cung");
  await expect(
    page.getByRole("rowheader", { name: "Hoàng hậu", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("action-APPLY")).toBeDisabled();
  await page.screenshot({
    path: "/tmp/dai-noi-ky-m3b-desktop.png",
    fullPage: true,
  });
});

test("read warning is mild, keeps profile/AP visible and clears after a healthy refresh", async ({
  page,
}) => {
  await register(page);
  await createLife(page);
  let degraded = true;
  await page.route("**/api/game?*", async (route) => {
    const response = await route.fetch();
    const payload = await response.json();
    payload.state.readWarnings = degraded
      ? [
          "Phiên xét duyệt đang tạm gián đoạn. Hồ sơ vẫn được hiển thị; hãy đồng bộ lại sau.",
        ]
      : [];
    await route.fulfill({ response, json: payload });
  });
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByTestId("read-warning")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Sân khấu chính", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("ap-balance")).toHaveText("10/15 AP");
  await expect(
    page.getByText("Chưa thể vào triều", { exact: true }),
  ).toHaveCount(0);
  degraded = false;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByTestId("read-warning")).toHaveCount(0);
});
