const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
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
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function assets(page) {
  await page.waitForFunction(
    () => !document.documentElement.classList.contains("intro-pending"),
  );
  await page.waitForFunction(() =>
    [...document.querySelectorAll("[data-brand]")].every((i) =>
      i.classList.contains("is-prepared"),
    ),
  );
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images]
        .filter((i) => i.hasAttribute("src"))
        .map((i) => {
          i.loading = "eager";
          return i.decode();
        }),
    );
  });
}
async function layout(page) {
  const data = await page.evaluate(() => ({
    width: innerWidth,
    scroll: document.documentElement.scrollWidth,
    broken: [...document.images]
      .filter((i) => i.hasAttribute("src") && i.complete && !i.naturalWidth)
      .map((i) => i.src),
    controls: [...document.querySelectorAll("nav a")]
      .filter((e) => e.getBoundingClientRect().width > 0)
      .filter((e) => e.scrollWidth > e.clientWidth + 2)
      .map((e) => e.textContent),
  }));
  assert.ok(data.scroll <= data.width, JSON.stringify(data));
  assert.deepEqual(data.broken, []);
  assert.deepEqual(data.controls, []);
}
async function filters(page) {
  const hasArchive = (await page.locator(".models-process").count()) > 0;
  await page.locator('[data-model-filter="vtuber"]').click();
  assert.equal(await page.locator(".portrait-card:visible").count(), 1);
  assert.equal(await page.locator(".model-case:visible").count(), 1);
  if (hasArchive)
    assert.equal(await page.locator(".process-entry").isVisible(), true);
  if (hasArchive)
    assert.equal(await page.locator(".process-plan:visible").count(), 0);
  await page.locator('[data-model-filter="game"]').click();
  assert.equal(await page.locator(".portrait-card:visible").count(), 3);
  assert.equal(await page.locator(".model-case:visible").count(), 0);
  if (hasArchive) {
    assert.equal(await page.locator(".process-entry").isVisible(), false);
    assert.equal(await page.locator(".process-plan:visible").count(), 3);
    assert.equal(
      await page.locator("[data-process-description]").isVisible(),
      false,
    );
    assert.equal(
      await page.locator("[data-collection-credit]").isVisible(),
      false,
    );
    assert.doesNotMatch(
      await page.locator(".work-footnote").innerText(),
      /SUMI|VTuber/,
    );
    await page.locator(".models-process").screenshot({
      path: path.join(output, `game-archive-${page.viewportSize().width}.png`),
    });
  }
  await page.locator(".portrait-card:visible").first().focus();
  await page.keyboard.press("ArrowLeft");
  assert.equal(
    await page
      .locator(".portrait-card:visible")
      .last()
      .evaluate((e) => e === document.activeElement),
    true,
  );
  await page.locator('[data-model-filter="all"]').click();
  assert.equal(await page.locator(".portrait-card:visible").count(), 4);
  if (hasArchive)
    assert.equal(await page.locator(".process-entry").isVisible(), true);
}
async function atmosphere(page) {
  const layer = page.locator(".frame-atmosphere");
  assert.equal(await layer.getAttribute("aria-hidden"), "true");
  assert.equal(await layer.evaluate((e) => e.inert), true);
  assert.equal(
    await layer.evaluate((e) => getComputedStyle(e).pointerEvents),
    "none",
  );
  assert.equal(await page.locator(".frame-bubble").count(), 24);
  const positions = () =>
    page
      .locator(".frame-bubble")
      .evaluateAll((bubbles) =>
        bubbles.map((bubble) => bubble.getBoundingClientRect().top),
      );
  const before = await positions();
  await wait(600);
  assert.ok(
    (await positions()).some((top, i) => Math.abs(top - before[i]) > 2),
    "Bubbles do not float",
  );
  await page.getByRole("button", { name: "暂停背景泡泡", exact: true }).click();
  await wait(100);
  const paused = await positions();
  await wait(400);
  assert.deepEqual(await positions(), paused, "Pause does not freeze bubbles");
  assert.equal(await layer.getAttribute("data-paused"), "true");
  await page.screenshot({ path: path.join(output, "atmosphere-desktop.png") });
  await page.getByRole("button", { name: "播放背景泡泡", exact: true }).click();
  await wait(400);
  assert.ok(
    (await positions()).some((top, i) => Math.abs(top - paused[i]) > 2),
    "Resume does not restart bubbles",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForFunction(
    () => document.querySelector(".frame-atmosphere").dataset.paused === "true",
  );
  assert.equal(await page.locator(".atmosphere-toggle").isVisible(), false);
  assert.equal(
    await page
      .locator(".frame-bubble")
      .first()
      .evaluate((e) => getComputedStyle(e).animationName),
    "none",
  );
  assert.equal(await page.locator(".frame-bubble:visible").count(), 6);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.locator(".frame-bubble:visible").count(), 14);
  await page.locator("#journal").scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(output, "atmosphere-mobile.png") });
  assert.equal(
    await page.locator(".atmosphere-toggle").evaluate((button) => {
      const box = button.getBoundingClientRect();
      return (
        document
          .elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
          ?.closest("button") === button
      );
    }),
    true,
    "Motion control is blocked",
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
}
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
      { width: 844, height: 390 },
      { width: 640, height: 400 },
    ]) {
      const page = await browser.newPage({ viewport, reducedMotion: "reduce" });
      page.on("pageerror", (e) => errors.push(e.message));
      const requests = [];
      page.on("request", (r) => requests.push(r.url()));
      await page.goto(base + "/");
      await assets(page);
      await layout(page);
      assert.deepEqual(
        await page
          .locator(".entry-nav a")
          .evaluateAll((links) =>
            links.map((link) => new URL(link.href).pathname),
          ),
        ["/news/", "/about/", "/models/", "/archive/", "/commission/"],
      );
      const typography = await page.evaluate(() => ({
        heading: getComputedStyle(
          document.querySelector(".frame-section-label h2"),
        ).fontFamily,
        navigation: getComputedStyle(document.querySelector(".entry-nav span"))
          .fontFamily,
        weight: getComputedStyle(document.querySelector(".entry-nav span"))
          .fontWeight,
        tracking: getComputedStyle(
          document.querySelector(".frame-section-label h2"),
        ).letterSpacing,
        fonts: [...document.fonts]
          .filter((f) => f.status === "loaded")
          .map((f) => f.family),
        grayscale: getComputedStyle(document.querySelector(".frame-art"))
          .filter,
      }));
      assert.match(typography.heading, /Jost/);
      assert.match(typography.navigation, /Jost/);
      assert.equal(typography.weight, "300");
      assert.ok(["0px", "normal"].includes(typography.tracking));
      assert.ok(typography.fonts.some((f) => /Jost/.test(f)));
      assert.ok(typography.fonts.some((f) => /Noto Sans/.test(f)));
      assert.equal(typography.grayscale, "none");
      assert.match(
        await page
          .locator("body")
          .evaluate((e) => getComputedStyle(e).backgroundImage),
        /linear-gradient/,
      );
      assert.equal(await page.locator(".atmosphere-toggle").isVisible(), false);
      assert.equal(await page.locator(".frame-bubble:visible").count(), 6);
      assert.equal(await page.locator(".frame-identity").count(), 1);
      const logoPosition = await page.evaluate(() => {
        const logo = document
          .querySelector(".frame-visual > .hero-brand")
          .getBoundingClientRect();
        const visual = document
          .querySelector(".frame-visual")
          .getBoundingClientRect();
        const identity = document
          .querySelector(".frame-identity")
          .getBoundingClientRect();
        return {
          left: logo.left - visual.left,
          top: logo.top - visual.top,
          bottom: logo.bottom,
          textTop: identity.top,
          right: logo.right,
          visualRight: visual.right,
        };
      });
      assert.ok(logoPosition.left >= 20 && logoPosition.left <= 32);
      assert.ok(logoPosition.top >= 32 && logoPosition.top <= 110);
      assert.ok(
        logoPosition.bottom <= logoPosition.textTop,
        JSON.stringify(logoPosition),
      );
      assert.ok(logoPosition.right <= logoPosition.visualRight);
      assert.equal(
        await page.locator(".frame-visual-meta, .frame-scroll").count(),
        0,
      );
      assert.equal(await page.locator(".hero-character").count(), 0);
      assert.equal(await page.locator("canvas").count(), 0);
      assert.ok(!requests.some((url) => /model\.vrm|motion\.gif/.test(url)));
      assert.ok(
        !requests.some((url) =>
          /fonts\.googleapis\.com|fonts\.gstatic\.com/.test(url),
        ),
      );
      assert.equal(
        await page
          .locator("#heroTitle")
          .textContent()
          .then((s) => s.trim()),
        "東雲 Megumi",
      );
      const positions = await page.evaluate(() => ({
        hero: document.querySelector(".frame-hero").getBoundingClientRect()
          .bottom,
        next: document.querySelector("#journal h2").getBoundingClientRect().top,
        rail: document.querySelector(".entry-sidebar").getBoundingClientRect()
          .right,
        visual: document.querySelector(".frame-visual").getBoundingClientRect()
          .left,
      }));
      assert.ok(
        positions.next < viewport.height,
        "No next-section hint: " + JSON.stringify(positions),
      );
      if (viewport.width > 760)
        assert.ok(
          positions.rail <= positions.visual + 1,
          "Sidebar overlaps image",
        );
      await page.screenshot({
        path: path.join(output, `frame-${viewport.width}.png`),
      });
      await page.screenshot({
        path: path.join(output, `frame-full-${viewport.width}.png`),
        fullPage: true,
      });
      if (viewport.width <= 760) {
        await page.locator(".frame-menu-button").click();
        assert.equal(
          await page.locator("#mobileMenu").evaluate((e) => e.open),
          true,
        );
        await page.keyboard.press("Escape");
        await page.waitForFunction(
          () =>
            document
              .querySelector(".frame-menu-button")
              .getAttribute("aria-expanded") === "false",
        );
        await page.locator(".frame-menu-button").click();
        await page.locator('#mobileMenu a[href="/about/"]').click();
        await page.waitForURL(base + "/about/");
        await assets(page);
        assert.equal(await page.locator("h1").innerText(), "ABOUT");
        await page.locator(".brand-logo").click();
        await assets(page);
      }
      await page.locator("#works").scrollIntoViewIfNeeded();
      assert.equal(
        await page.locator("#galleryTitle").innerText(),
        "CHARACTER",
      );
      assert.equal(await page.locator(".portrait-card").count(), 4);
      assert.equal(await page.locator(".release-item").count(), 0);
      await filters(page);
      await page.locator("#works").scrollIntoViewIfNeeded();
      await page.screenshot({
        path: path.join(output, `home-collection-${viewport.width}.png`),
      });
      await page.waitForFunction(() =>
        document
          .querySelector(".frame-header")
          .classList.contains("is-visible"),
      );
      assert.equal(
        await page.locator(".frame-header").evaluate((e) => e.inert),
        false,
      );
      await page.locator(".release-more").click();
      await page.waitForURL(base + "/models/");
      await assets(page);
      await layout(page);
      assert.equal(
        await page.locator(".models-title h1").innerText(),
        "Characters",
      );
      assert.equal(await page.locator(".portrait-card").count(), 4);
      assert.equal(await page.locator(".model-case").count(), 1);
      assert.equal(await page.locator(".sample-case").count(), 3);
      await filters(page);
      assert.equal(await page.locator(".featured-work").count(), 0);
      await page.screenshot({
        path: path.join(output, `models-${viewport.width}.png`),
      });
      await page.screenshot({
        path: path.join(output, `models-full-${viewport.width}.png`),
        fullPage: true,
      });
      await page.locator(".portrait-card").first().focus();
      await page.keyboard.press("End");
      assert.equal(
        await page
          .locator(".portrait-card")
          .last()
          .evaluate((e) => e === document.activeElement),
        true,
      );
      await page.keyboard.press("Home");
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("Enter");
      assert.equal(
        await page.locator("#sampleDialog").evaluate((e) => e.open),
        true,
      );
      assert.equal(
        await page.locator("#sampleTitle").innerText(),
        "CHARACTER 01",
      );
      await page.keyboard.press("Escape");
      assert.equal(
        await page.locator("#sampleDialog").evaluate((e) => e.open),
        false,
      );
      if (viewport.width <= 1100) {
        await page.keyboard.press("Home");
        await page
          .locator('.rail-controls button[aria-label="下一组角色"]')
          .click();
        await page.waitForFunction(
          () => document.querySelector(".portrait-rail").scrollLeft > 0,
        );
      }
      await page.locator(".model-case").click();
      await page.waitForURL(/\/models\/sumi\/\?mode=pair#showcase/);
      await page.waitForFunction(() => window.casePreview?.state.ready, null, {
        timeout: 120000,
      });
      assert.equal(
        await page.locator('.breadcrumb a[href="/models/"]').count(),
        1,
      );
      await page.locator('.breadcrumb a[href="/models/"]').click();
      assert.equal(new URL(page.url()).pathname, "/models/");
      await page.locator(".brand-logo").click();
      assert.equal(new URL(page.url()).pathname, "/");
      await page.close();
      console.log("Frame and hierarchy OK: " + viewport.width);
    }
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    page.on("pageerror", (e) => errors.push(e.message));
    const local = JSON.parse(
      await fs.readFile(path.join(__dirname, ".local.json"), "utf8"),
    );
    const backdrop = await page.request.get(
      base + "/home/assets/header-art.jpg",
    );
    const sha = (buffer) =>
      crypto.createHash("sha256").update(buffer).digest("hex");
    assert.equal(
      sha(await backdrop.body()),
      sha(await fs.readFile(local.homeBackground)),
    );
    const portrait = await page.request.get(
      base + "/home/assets/about-portrait.jpg",
    );
    assert.equal(
      sha(await portrait.body()),
      sha(await fs.readFile(local.homePortrait)),
    );
    for (const family of ["jost", "noto-sans-jp", "noto-sans-sc"]) {
      const response = await page.request.get(
        base + `/home/fonts/${family}.woff2`,
      );
      assert.equal(response.status(), 200);
      assert.equal(response.headers()["content-type"], "font/woff2");
      assert.equal((await response.body()).subarray(0, 4).toString(), "wOF2");
    }
    await page.goto(base + "/");
    await assets(page);
    await atmosphere(page);
    const craft = page.locator(".craft-layout");
    await wait(1200);
    assert.equal(await craft.evaluate((e) => getComputedStyle(e).opacity), "0");
    for (let i = 0; i < 2; i++) {
      await craft.scrollIntoViewIfNeeded();
      await page.waitForFunction(
        () =>
          getComputedStyle(document.querySelector(".craft-layout")).opacity ===
          "1",
      );
      await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
      await page.waitForFunction(
        () =>
          !document
            .querySelector(".craft-layout")
            .classList.contains("is-revealed"),
      );
      await wait(1200);
      assert.equal(
        await craft.evaluate((e) => getComputedStyle(e).opacity),
        "0",
      );
    }
    await page.goto(base + "/home/journal/?post=hello-portfolio");
    await page.waitForFunction(() =>
      document.querySelector("#articleBody").querySelector("table"),
    );
    await page.goto(base + "/home/journal/?post=blender-bmesh-free");
    await page.waitForFunction(() =>
      document.querySelector("#articleBody").querySelector("pre"),
    );
    for (const viewport of [
      { width: 1440, height: 1000 },
      { width: 768, height: 1024 },
      { width: 390, height: 844 },
      { width: 320, height: 720 },
    ]) {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion: "reduce" });
      for (const route of ["/news/", "/about/", "/archive/", "/commission/"]) {
        await page.goto(base + route);
        await assets(page);
        await layout(page);
        assert.equal(await page.locator("h1").count(), 1);
        await page.screenshot({
          path: path.join(
            output,
            `${route.split("/")[1]}-${viewport.width}.png`,
          ),
          fullPage: true,
        });
      }
      const terms = page.locator("#terms details");
      assert.equal(await page.locator("#options li").count(), 7);
      assert.match(await page.locator("#options").innerText(), /Unitypackage/);
      assert.match(await page.locator("#options").innerText(), /折扣/);
      assert.equal(await page.locator("[data-delivery-process] li").count(), 7);
      assert.equal(await page.locator("[data-model-process] li").count(), 7);
      assert.match(
        await page.locator("[data-delivery-process] li").last().innerText(),
        /剩余的一半/,
      );
      assert.equal(await page.locator("#materials ul").count(), 2);
      assert.equal(await page.locator("#materials li").count(), 8);
      assert.match(await page.locator("#materials").innerText(), /拉丁字母/);
      assert.equal(await terms.count(), 5);
      await terms.nth(2).locator("summary").click();
      assert.equal(await terms.nth(2).evaluate((e) => e.open), true);
      assert.match(await terms.nth(2).innerText(), /全额退款/);
      await page.locator(".brand-logo").click();
      await assets(page);
      await page.locator("#about").scrollIntoViewIfNeeded();
      assert.equal(
        await page
          .locator(".about-visual img")
          .evaluate((e) => getComputedStyle(e).objectFit),
        "cover",
      );
      if (viewport.width === 1440) {
        const box = await page.locator(".about-visual").boundingBox();
        assert.equal(Math.round(box.width), 315);
        assert.equal(Math.round(box.height), 395);
      }
      await page.screenshot({
        path: path.join(output, `about-home-${viewport.width}.png`),
      });
    }
    await page.goto(base + "/models/?category=game");
    await assets(page);
    assert.equal(await page.locator(".sample-case:visible").count(), 3);
    assert.equal(await page.locator(".model-case:visible").count(), 0);
    assert.equal(await page.locator(".process-entry").isVisible(), false);
    assert.equal(await page.locator(".process-plan:visible").count(), 3);
    assert.equal(
      await page.locator("[data-process-description]").isVisible(),
      false,
    );
    const redirected = await page.request.get(base + "/?mode=compare");
    assert.equal(new URL(redirected.url()).pathname, "/models/sumi/");
    for (const route of [
      "/home/post/nope",
      "/models/sumi/model.vrm",
      "/models/.local.json",
      "/home/assets/model.vrm",
      "/.local.json",
    ])
      assert.equal((await page.request.get(base + route)).status(), 404);
    await page.close();
    const nojs = await browser.newPage({
      javaScriptEnabled: false,
      viewport: { width: 390, height: 844 },
    });
    await nojs.goto(base + "/");
    assert.equal(
      await nojs
        .locator("#journal")
        .evaluate((e) => getComputedStyle(e).opacity),
      "1",
    );
    await nojs.locator(".release-more").click();
    assert.equal(new URL(nojs.url()).pathname, "/models/");
    await nojs.locator(".model-case").click();
    assert.equal(new URL(nojs.url()).pathname, "/models/sumi/");
    await nojs.close();
    assert.deepEqual(errors, []);
    console.log(
      "Repeatable reveal, journal, no-JS, root compatibility and private routes OK",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
