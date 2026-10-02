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

(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({
    args: ["--enable-unsafe-swiftshader"],
  });
  const errors = [];
  try {
    for (const viewport of [
      { width: 1440, height: 1000 },
      { width: 1920, height: 1080 },
      { width: 768, height: 1024 },
      { width: 390, height: 844 },
      { width: 320, height: 720 },
    ]) {
      const page = await browser.newPage({ viewport, reducedMotion: "reduce" });
      page.on("pageerror", (error) => errors.push(error.message));
      const requests = [];
      page.on("request", (request) => requests.push(request.url()));
      await page.goto(base + "/home/");
      await page.waitForFunction(() =>
        document
          .querySelector(".wordmark-art")
          .classList.contains("is-prepared"),
      );
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all([...document.images].map((i) => i.decode()));
      });
      const metrics = await page.evaluate(() => {
        const hero = document.querySelector(".hero").getBoundingClientRect();
        const word = document
          .querySelector(".wordmark")
          .getBoundingClientRect();
        const next = document
          .querySelector("#works .section-label")
          .getBoundingClientRect();
        return {
          width: innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          heroBottom: hero.bottom,
          wordRight: word.right,
          hintTop: next.top,
          filter: getComputedStyle(document.querySelector(".hero-scene"))
            .filter,
          opacity: getComputedStyle(document.querySelector(".hero-scene"))
            .opacity,
          reveal: [...document.querySelectorAll(".scroll-reveal")].every(
            (e) => getComputedStyle(e).opacity === "1",
          ),
        };
      });
      assert.ok(metrics.scrollWidth <= metrics.width, JSON.stringify(metrics));
      assert.ok(
        metrics.hintTop < viewport.height,
        "Next section missing from first viewport: " + JSON.stringify(metrics),
      );
      assert.ok(metrics.wordRight <= metrics.width, "Wordmark overflow");
      assert.equal(
        await page
          .locator("#heroTitle")
          .textContent()
          .then((text) => text.trim()),
        "東雲 Megumi",
      );
      const ink = await page.locator(".wordmark-art").evaluate((image) => {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0);
        const pixels = context.getImageData(
          0,
          0,
          canvas.width,
          canvas.height,
        ).data;
        let transparent = 0,
          white = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          if (pixels[i + 3] === 0) transparent++;
          if (pixels[i + 3] > 200 && pixels[i] > 245) white++;
        }
        return {
          transparent: transparent / (pixels.length / 4),
          white: white / (pixels.length / 4),
        };
      });
      assert.ok(
        ink.transparent > 0.65,
        "Wordmark still has an opaque background: " + JSON.stringify(ink),
      );
      assert.ok(ink.white > 0.025, "Wordmark is blank: " + JSON.stringify(ink));
      assert.equal(metrics.filter, "grayscale(1)");
      assert.equal(metrics.opacity, "0.14");
      assert.ok(metrics.reveal, "Reduced motion hides content");
      assert.ok(
        !requests.some((url) => url.includes("model.vrm")),
        "Homepage eagerly downloads VRM",
      );
      await page.screenshot({
        path: path.join(output, `home-${viewport.width}.png`),
      });
      await page.screenshot({
        path: path.join(output, `home-full-${viewport.width}.png`),
        fullPage: true,
      });
      if (viewport.width <= 760) {
        await page.locator(".menu-button").click();
        assert.equal(
          await page.locator("#mobileMenu").evaluate((e) => e.open),
          true,
        );
        await page.keyboard.press("Escape");
        await page.waitForFunction(
          () =>
            document
              .querySelector(".menu-button")
              .getAttribute("aria-expanded") === "false",
        );
        assert.equal(
          await page.locator(".menu-button").getAttribute("aria-expanded"),
          "false",
        );
        await page.locator(".menu-button").click();
        await page.locator("#mobileMenu [data-about]").click();
      } else await page.locator(".desktop-nav [data-about]").click();
      assert.equal(
        await page.locator("#aboutDialog").evaluate((e) => e.open),
        true,
      );
      await page.keyboard.press("Escape");
      await page.close();
      console.log("Layout and navigation OK: " + viewport.width);
    }
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(base + "/home/");
    const craft = page.locator(".craft-layout");
    await page.waitForTimeout(1200);
    assert.equal(await craft.evaluate((e) => getComputedStyle(e).opacity), "0");
    for (let i = 0; i < 2; i++) {
      await craft.scrollIntoViewIfNeeded();
      await page.waitForFunction(
        () =>
          getComputedStyle(document.querySelector(".craft-layout")).opacity ===
          "1",
      );
      await page.screenshot({ path: path.join(output, "home-craft.png") });
      await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
      await page.waitForFunction(
        () =>
          !document
            .querySelector(".craft-layout")
            .classList.contains("is-revealed"),
      );
      await page.waitForTimeout(1200);
      assert.equal(
        await craft.evaluate((e) => getComputedStyle(e).opacity),
        "0",
      );
    }
    await page.goto(base + "/home/journal/?post=hello-portfolio");
    await page.waitForFunction(() =>
      document.querySelector("#articleBody").querySelector("table"),
    );
    assert.ok(
      (await page.locator("#articleTitle").textContent()).includes(
        "はじめまして",
      ),
    );
    await page.goto(base + "/home/journal/?post=blender-bmesh-free");
    await page.waitForFunction(() =>
      document.querySelector("#articleBody").querySelector("pre"),
    );
    await page.screenshot({ path: path.join(output, "home-journal.png") });
    for (const route of [
      "/home/post/unknown",
      "/home/assets/.local.json",
      "/home/assets/model.vrm",
      "/home/home.js/../../.local.json",
    ]) {
      assert.equal((await page.request.get(base + route)).status(), 404);
    }
    await page.goto(base + "/home/");
    await page.locator(".hero-character").click();
    assert.ok(page.url().includes("mode=pair#showcase"));
    await page.waitForFunction(() => window.casePreview?.state.ready, null, {
      timeout: 120000,
    });
    await page.locator("a.brand").click();
    assert.equal(new URL(page.url()).pathname, "/home/");
    await page.close();
    assert.deepEqual(errors, []);
    console.log(
      "Scroll reveal, articles, private routes and model round trip OK",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
