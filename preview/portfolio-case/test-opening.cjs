const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require(
  require.resolve("playwright", {
    paths: [
      path.join(
        process.env.USERPROFILE,
        ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules",
      ),
    ],
  }),
);
const base = "http://127.0.0.1:4002";
const output = path.join(__dirname, "test-output");
const key = "megumi-home-intro:v1";
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function complete(page) {
  await page.waitForFunction(
    () => !document.documentElement.classList.contains("intro-pending"),
    null,
    { timeout: 7000 },
  );
  assert.equal(await page.locator("main").evaluate((e) => e.inert), false);
  assert.equal(await page.locator(".home-opening").isVisible(), false);
  assert.equal(await page.locator("[data-intro-inert]").count(), 0);
}
(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch();
  const errors = [];
  try {
    for (const width of [1440, 390, 320]) {
      const page = await browser.newPage({
        viewport: { width, height: width > 700 ? 1000 : 844 },
        reducedMotion: "no-preference",
      });
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(base, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() =>
        document.documentElement.classList.contains("intro-running"),
      );
      assert.equal(await page.locator("main").evaluate((e) => e.inert), true);
      await page.keyboard.press("Tab");
      assert.equal(
        await page
          .locator(".opening-skip")
          .evaluate((e) => e === document.activeElement),
        true,
      );
      await wait(500);
      await page.screenshot({
        path: path.join(output, `opening-blur-${width}.png`),
      });
      await wait(1100);
      const shape = await page.locator(".opening-logo").evaluate((e) => {
        const r = e.getBoundingClientRect();
        const s = getComputedStyle(e);
        return {
          x: r.x + r.width / 2,
          y: r.y + r.height / 2,
          width: r.width,
          viewport: innerWidth,
          height: innerHeight,
          opacity: Number(s.opacity),
          loaded: e.naturalWidth > 0,
        };
      });
      assert.ok(shape.loaded);
      assert.ok(shape.opacity > 0.85, JSON.stringify(shape));
      assert.ok(Math.abs(shape.x - shape.viewport / 2) < 1);
      assert.ok(Math.abs(shape.y - shape.height / 2) < 1);
      assert.ok(shape.width <= shape.viewport * 0.72 + 1);
      await page.screenshot({
        path: path.join(output, `opening-logo-${width}.png`),
      });
      await page.waitForFunction(() =>
        document.documentElement.classList.contains("intro-exiting"),
      );
      await wait(350);
      assert.ok(
        Number(
          await page
            .locator(".home-opening")
            .evaluate((e) => getComputedStyle(e).opacity),
        ) < 1,
      );
      await page.screenshot({
        path: path.join(output, `opening-reveal-${width}.png`),
      });
      await complete(page);
      assert.equal(
        await page.evaluate((key) => sessionStorage.getItem(key), key),
        "seen",
      );
      assert.equal(
        await page.locator("#galleryTitle").innerText(),
        "CHARACTER",
      );
      await page.locator("#works").scrollIntoViewIfNeeded();
      await wait(1200);
      await page.evaluate(() =>
        scrollBy({
          top:
            document.querySelector("#galleryTitle").getBoundingClientRect()
              .top - 90,
          behavior: "instant",
        }),
      );
      const titleBounds = await page.locator("#galleryTitle").evaluate((e) => {
        const box = e.getBoundingClientRect();
        return {
          width: box.width,
          height: box.height,
          fontSize: parseFloat(getComputedStyle(e).fontSize),
          scrollWidth: e.scrollWidth,
          scrollHeight: e.scrollHeight,
          clientWidth: e.clientWidth,
          available:
            e.parentElement.clientWidth -
            parseFloat(getComputedStyle(e.parentElement).paddingRight),
          writingMode: getComputedStyle(e).writingMode,
        };
      });
      assert.ok(
        titleBounds.scrollWidth <= titleBounds.available + 1,
        "Character title overflows: " + JSON.stringify(titleBounds),
      );
      if (titleBounds.writingMode === "horizontal-tb")
        assert.ok(
          titleBounds.height <= titleBounds.fontSize * 1.1,
          "Character title should remain on one line",
        );
      await page.screenshot({
        path: path.join(output, `character-title-${width}.png`),
      });
      await page.reload();
      await complete(page);
      await page.goto(base + "/?intro=1");
      await page.waitForFunction(() =>
        document.documentElement.classList.contains("intro-running"),
      );
      await page.keyboard.press("Escape");
      await complete(page);
      await page.goto(base + "/?intro=1");
      await page.waitForFunction(() =>
        document.documentElement.classList.contains("intro-running"),
      );
      await page.evaluate(() => scrollTo({ top: 1500, behavior: "instant" }));
      await page.waitForFunction(() =>
        document
          .querySelector(".frame-header")
          .classList.contains("is-visible"),
      );
      assert.equal(
        await page.locator(".frame-header").evaluate((e) => e.inert),
        true,
      );
      await page.getByRole("button", { name: "跳过开屏" }).click();
      await complete(page);
      assert.equal(
        await page.locator(".frame-header").evaluate((e) => e.inert),
        false,
      );
      assert.equal(
        await page
          .locator("main")
          .evaluate((e) => e === document.activeElement),
        true,
      );
      await page.close();
      console.log("Opening, focus, replay and Character title OK: " + width);
    }
    for (const scenario of [
      "reduced",
      "no-js",
      "hash",
      "storage-denied",
      "missing-logo",
      "module-failure",
      "reduce-during",
    ]) {
      const page = await browser.newPage({
        viewport: { width: 390, height: 844 },
        javaScriptEnabled: scenario !== "no-js",
        reducedMotion: scenario === "reduced" ? "reduce" : "no-preference",
      });
      page.on("pageerror", (e) => errors.push(e.message));
      if (scenario === "storage-denied")
        await page.addInitScript(() =>
          Object.defineProperty(window, "sessionStorage", {
            get() {
              throw new DOMException("Denied", "SecurityError");
            },
          }),
        );
      if (scenario === "missing-logo")
        await page.route("**/home/assets/brand.png", (route) =>
          route.fulfill({ status: 404, body: "Unavailable" }),
        );
      if (scenario === "module-failure")
        await page.route("**/home/frame.js", (route) => route.abort());
      await page.goto(base + (scenario === "hash" ? "/#works" : "/"), {
        waitUntil: "domcontentloaded",
      });
      if (scenario === "reduce-during") {
        await page.waitForFunction(() =>
          document.documentElement.classList.contains("intro-running"),
        );
        await page.emulateMedia({ reducedMotion: "reduce" });
      }
      await complete(page);
      assert.equal(await page.locator(".frame-visual").isVisible(), true);
      await page.close();
      console.log("Opening fallback OK: " + scenario);
    }
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
