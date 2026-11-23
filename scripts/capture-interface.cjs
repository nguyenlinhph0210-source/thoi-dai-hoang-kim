// Local InMemory screenshots only. Run before/after servers separately; see docs/screenshots/README.md.
const { chromium } = require("@playwright/test");
const { mkdir } = require("node:fs/promises");
const { randomUUID } = require("node:crypto");
(async () => {
  const phase = process.argv[2] || "before",
    port = process.argv[3] || "3102",
    base = `http://127.0.0.1:${port}`;
  if (!["before", "after"].includes(phase) || !/^\d{2,5}$/.test(port))
    throw new Error("Use before|after and a local port");
  const dir = require("node:path").join(
    process.cwd(),
    "docs/screenshots",
    phase,
  );
  await mkdir(dir, { recursive: true });
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  for (const [device, width, height] of [
    ["mobile", 390, 844],
    ["desktop", 1440, 900],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    await page.addInitScript(() =>
      localStorage.setItem(
        "dnk-graphics-v1",
        JSON.stringify({ mode: "3d", quality: "low" }),
      ),
    );
    const shot = async (name) => {
      if (
        phase === "after" &&
        !["login", "setup", "2d"].includes(name) &&
        (await page.getByTestId("palace-stage").getAttribute("data-mode")) ===
          "2d"
      ) {
        const details = page.locator(".palace-toolbar details");
        if ((await details.getAttribute("open")) === null)
          await page.getByText("Cài đặt đồ họa", { exact: true }).click();
        await page.getByLabel("Chất lượng đồ họa").selectOption("low");
        await page
          .getByRole("button", { name: "Bàn trà", exact: true })
          .waitFor({ timeout: 60000 });
        await page.getByText("Cài đặt đồ họa", { exact: true }).click();
      }
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({
        path: `${dir}/${device}-${name}.jpg`,
        quality: 82,
      });
      console.log(`${phase}/${device}-${name}`);
    };
    await page.goto(base + "/login");
    await shot("login");
    await page
      .getByRole("button", { name: "Chưa có tài khoản? Đăng ký" })
      .click();
    await page
      .getByLabel("Email", { exact: true })
      .fill(`capture-${randomUUID()}@example.test`);
    await page
      .getByLabel("Mật khẩu", { exact: true })
      .fill("Capture-screens-2026!");
    await page
      .getByRole("button", { name: "Tạo tài khoản", exact: true })
      .click();
    await page.waitForURL("**/setup");
    await page.getByRole("button", { name: /^Hậu cung/ }).click();
    await page.getByRole("button", { name: "Khai mở thân phận" }).click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot("setup");
    await page.getByRole("button", { name: "Chấp nhận thân phận" }).click();
    const loadingStarted = Date.now();
    await page.getByRole("button", { name: "Xác nhận nhập kinh" }).click();
    await page.getByTestId("palace-stage").waitFor({ timeout: 60000 });
    await page
      .getByRole("button", { name: "Bàn trà", exact: true })
      .waitFor({ timeout: 60000 });
    console.log(
      `${phase}/${device} first-ready-ms ${Date.now() - loadingStarted}`,
    );
    await page.waitForTimeout(1500);
    await shot("stage");
    if (device === "mobile")
      await page.getByRole("button", { name: "Hồ sơ", exact: true }).click();
    await shot("profile");
    await page.getByRole("button", { name: "Y phục", exact: true }).click();
    if (phase === "after" && device === "mobile") {
      await page.getByRole("button", { name: "Mở đầy", exact: true }).click();
      await page
        .locator(".harem-shop article")
        .first()
        .scrollIntoViewIfNeeded();
    }
    await shot("wardrobe");
    await page.getByRole("button", { name: "Cung viện", exact: true }).click();
    if (phase === "after") {
      await page
        .locator(".sheet-content")
        .evaluateAll((nodes) => nodes.forEach((n) => (n.scrollTop = 0)));
    }
    await shot("chamber");
    if (phase === "after") {
      await page.getByRole("button", { name: "Y phục", exact: true }).click();
      await page
        .getByTestId("item-OUTFIT_1_1")
        .getByRole("button", { name: /^Thử / })
        .click();
      if (device === "mobile")
        await page
          .getByRole("button", { name: "Thu gọn", exact: true })
          .click();
      await shot("tryon");
      await page.getByText("Cài đặt đồ họa", { exact: true }).click();
      await page.getByLabel("Chất lượng đồ họa").selectOption("2d");
      await page.getByText("Cài đặt đồ họa", { exact: true }).click();
      if (device === "mobile")
        await page.getByRole("button", { name: /^Sân khấu/ }).click();
      await shot("2d");
    }
    await context.close();
  }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
