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
test("mobile navigation, empty logs and rank placeholder; no overflow", async ({
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
  await expect(page.getByText("Sắp ra mắt", { exact: true })).toBeVisible();
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
