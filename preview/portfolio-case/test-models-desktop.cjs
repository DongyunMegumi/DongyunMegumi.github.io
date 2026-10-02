const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs/promises");
const { chromium } = require(require.resolve("playwright", {
  paths: [path.join(process.env.USERPROFILE,
    ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules")],
}));
const base = "http://127.0.0.1:4002";
const output = path.join(__dirname, "test-output");

async function ready(page) {
  await page.waitForFunction(() => [...document.querySelectorAll("[data-brand]")]
    .every(image => image.classList.contains("is-prepared")));
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].filter(i => i.hasAttribute("src")).map(i => {
      i.loading = "eager";
      return i.decode();
    }));
  });
}

async function vectorNameplates(browser) {
  for (const scale of [1, 2]) {
    const page = await browser.newPage({
      viewport: { width: 1864, height: 884 },
      deviceScaleFactor: scale,
      reducedMotion: "reduce",
    });
    try {
      await page.goto(base + "/models/#collection");
      await ready(page);
      const response = await page.request.get(base + "/models/nameplate-bottom.svg");
      assert.equal(response.status(), 200);
      assert.match(response.headers()["content-type"], /image\/svg\+xml/);
      for (const asset of ["nameplate-top.svg", "portrait-panel.svg", "portrait-art-mask.svg"]) {
        const response = await page.request.get(base + "/models/" + asset);
        assert.equal(response.status(), 200);
        assert.match(response.headers()["content-type"], /image\/svg\+xml/);
      }
      const panel = await page.locator(".model-case").evaluate(element => ({
        background: getComputedStyle(element, "::before").backgroundImage,
        transform: getComputedStyle(element, "::before").transform,
        border: getComputedStyle(element, "::before").borderTopWidth,
        after: getComputedStyle(element, "::after").content,
        mask: getComputedStyle(element.querySelector(".portrait-visual")).maskImage,
      }));
      assert.match(panel.background, /portrait-panel\.svg/);
      assert.match(panel.mask, /portrait-art-mask\.svg/);
      assert.equal(panel.transform, "none");
      assert.equal(panel.border, "0px");
      assert.equal(panel.after, "none");
      const coverage = await page.evaluate(async scale => {
        const image = new Image();
        image.src = "/models/nameplate-bottom.svg";
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = 38 * scale;
        canvas.height = 34 * scale;
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
        const alpha = (x, y) => data[(y * canvas.width + x) * 4 + 3] / 255;
        const sum = (x, top, height) => {
          let total = 0;
          for (let y = Math.floor(top) - 1; y <= Math.ceil(top + height); y++)
            total += alpha(x, y);
          return total;
        };
        const thick = [], thin = [], gaps = [];
        for (let x = 0; x < canvas.width; x++) {
          const drop = 8 * (x + .5) / 38;
          thick.push(sum(x, 24 * scale - drop, 4 * scale));
          thin.push(sum(x, 31 * scale - drop, 2 * scale));
          gaps.push(alpha(x, Math.floor(22 * scale - drop)));
          gaps.push(alpha(x, Math.floor(29.5 * scale - drop)));
        }
        return {
          thick, thin, gaps,
          antialias: Array.from(data).filter((value, index) =>
            index % 4 === 3 && value > 0 && value < 255).length,
        };
      }, scale);
      for (const width of coverage.thick) assert.ok(Math.abs(width - 4 * scale) < .12, String(width));
      for (const width of coverage.thin) assert.ok(Math.abs(width - 2 * scale) < .12, String(width));
      assert.ok(coverage.antialias > 0);
      assert.ok(coverage.gaps.every(value => value === 0));
      const name = page.locator(".model-case .portrait-name");
      await name.scrollIntoViewIfNeeded();
      const box = await name.boundingBox();
      await page.screenshot({
        path: path.join(output, `sumi-vector-nameplate-${scale}x.png`),
        clip: { x: Math.floor(box.x) - 12, y: Math.floor(box.y) - 12,
          width: 62, height: Math.ceil(box.height) + 24 },
      });
      await page.locator(".portrait-rail").screenshot({
        path: path.join(output, `vector-nameplates-${scale}x.png`),
      });
      const card = page.locator(".model-case");
      const before = await card.boundingBox();
      await name.hover();
      const after = await card.boundingBox();
      assert.ok(Math.abs(before.width - after.width) < .01);
      assert.ok(Math.abs(before.height - after.height) < .01);
      const nameRight = await name.evaluate(e => getComputedStyle(e).right);
      assert.equal(nameRight, "8px");
      await page.locator(".portrait-rail").screenshot({
        path: path.join(output, `vector-panel-hover-${scale}x.png`),
      });
      console.log(`SVG antialias, transparent gaps and 4px/2px stripe coverage OK: ${scale}x`);
    } finally {
      await page.close();
    }
  }
}

(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [1280, 1625, 1920]) {
      const page = await browser.newPage({ viewport: { width, height: 884 }, reducedMotion: "reduce" });
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.goto(base + "/models/");
      await ready(page);
      const lines = await page.locator(".models-title").evaluate(element => {
        const before = getComputedStyle(element, "::before");
        const after = getComputedStyle(element, "::after");
        const box = element.getBoundingClientRect();
        const title = element.querySelector(".collection-title").getBoundingClientRect();
        return {
          leftWidth: parseFloat(before.width), rightWidth: parseFloat(after.width),
          leftTransform: before.transform, rightTransform: after.transform,
          leftBorder: before.borderLeftWidth, leftInner: before.borderRightWidth,
          rightBorder: after.borderRightWidth, rightInner: after.borderLeftWidth,
          center: box.x + box.width / 2, titleCenter: title.x + title.width / 2,
        };
      });
      assert.ok(Math.abs(lines.leftWidth - lines.rightWidth) < 1, JSON.stringify(lines));
      assert.equal(lines.leftTransform, lines.rightTransform);
      assert.equal(lines.leftBorder, "1px");
      assert.equal(lines.rightBorder, "1px");
      assert.equal(lines.leftInner, "0px");
      assert.equal(lines.rightInner, "0px");
      assert.ok(Math.abs(lines.center - lines.titleCenter) < 1);
      await page.screenshot({ path: path.join(output, `models-symmetric-${width}.png`) });
      await page.locator(".portrait-rail").screenshot({ path: path.join(output, `model-nameplates-${width}.png`) });
      const names = await page.locator(".portrait-name").evaluateAll(elements => elements.map(element => {
        const box = element.getBoundingClientRect();
        const card = element.closest(".portrait-card").getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(element);
        const text = range.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          width: box.width, height: box.height, offset: card.bottom - box.bottom,
          textFits: text.top >= box.top + 8 && text.bottom <= box.bottom - 20
            && text.left >= box.left && text.right <= box.right,
          family: style.fontFamily, spacing: style.letterSpacing,
          art: getComputedStyle(element, "::before").backgroundImage,
          after: getComputedStyle(element, "::after").content,
          transform: getComputedStyle(element, "::before").transform,
        };
      }));
      assert.equal(names.length, 4);
      for (const name of names) {
        assert.equal(name.width, 38);
        assert.ok(name.height >= 138);
        assert.equal(name.textFits, true, JSON.stringify(name));
        assert.match(name.family, /Jost/);
        assert.match(name.spacing, /^(normal|0px)$/);
        assert.match(name.art, /nameplate-top\.svg/);
        assert.match(name.art, /nameplate-bottom\.svg/);
        assert.equal(name.after, "none");
        assert.equal(name.transform, "none");
        assert.equal(name.offset, 20);
        assert.ok(Math.abs(name.offset - names[0].offset) < 1);
      }
      const sumiName = page.locator(".model-case .portrait-name");
      await sumiName.scrollIntoViewIfNeeded();
      const nameBox = await sumiName.boundingBox();
      assert.equal(await page.evaluate(({ x, y }) =>
        document.elementFromPoint(x, y)?.closest(".portrait-card")?.classList.contains("model-case"),
        { x: nameBox.x + nameBox.width / 2, y: nameBox.y + nameBox.height / 2 }), true);

      assert.equal(await page.locator(".process-entry").isVisible(), true);
      assert.equal(await page.locator(".process-plan:visible").count(), 3);
      assert.equal(await page.locator("[data-collection-credit]").isVisible(), false);
      await page.locator('[data-model-filter="vtuber"]').click();
      assert.equal(await page.locator("[data-collection-credit]").isVisible(), true);
      assert.equal(await page.locator(".process-entry").isVisible(), true);
      assert.equal(await page.locator(".process-plan:visible").count(), 0);
      await page.locator('[data-model-filter="game"]').click();
      assert.equal(await page.locator("[data-collection-credit]").isVisible(), false);
      assert.equal(await page.locator(".process-entry").isVisible(), false);
      assert.equal(await page.locator("[data-process-description]").isVisible(), false);
      assert.equal(await page.locator(".process-plan:visible").count(), 3);
      assert.doesNotMatch(await page.locator(".models-process").innerText(), /Sumi|白模/);
      await page.locator("#process").screenshot({ path: path.join(output, `models-plans-${width}.png`) });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.locator('[data-model-filter="all"]').click();
      assert.equal(await page.locator("[data-collection-credit]").isVisible(), false);

      for (let index = 0; index < 3; index++) {
        await page.goto(base + "/models/?category=game");
        await ready(page);
        assert.equal(await page.locator(".process-plan:visible").count(), 3);
        await page.locator(".process-plan").nth(index).click();
        await page.waitForURL(`**/characters/?character=${index}#profile`);
        await page.waitForFunction(() => document.querySelector("#characterSelector").children.length === 3);
        await page.waitForFunction(expected => document.querySelector("#characterName").textContent === expected,
          `CHARACTER 0${index + 1}`);
        await ready(page);
        assert.equal(await page.locator("#loadStatus").isVisible(), false);
        await page.locator("#toggleFraming").click();
        assert.equal(await page.locator("#toggleFraming").getAttribute("aria-pressed"), "true");
        await page.locator("#enlargeArtwork").click();
        assert.equal(await page.locator("#imageDialog").evaluate(e => e.open), true);
        await page.keyboard.press("Escape");
        assert.equal(await page.locator("#imageDialog").evaluate(e => e.open), false);
        if (width === 1625 && index === 0) {
          await page.locator("#profile").screenshot({ path: path.join(output, "preserved-character-profile.png") });
          await page.locator("#nextCharacter").click();
          assert.equal(await page.locator("#characterName").innerText(), "CHARACTER 02");
          await page.goBack();
          assert.equal(await page.locator("#characterName").innerText(), "CHARACTER 01");
        }
        await page.goBack();
        await page.waitForURL("**/models/?category=game");
      }
      assert.deepEqual(errors, []);
      await page.close();
      console.log(`Desktop heading symmetry, filtered archives and preserved details OK: ${width}`);
    }
    const nojs = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 1625, height: 884 } });
    await nojs.goto(base + "/models/");
    assert.equal(await nojs.locator(".process-plan").count(), 3);
    for (const link of await nojs.locator(".process-plan").all()) {
      assert.equal((await nojs.request.get(base + await link.getAttribute("href"))).status(), 200);
    }
    await nojs.close();
    console.log("Native archive detail links OK without JavaScript");
    const home = await browser.newPage({ viewport: { width: 1625, height: 884 }, reducedMotion: "reduce" });
    await home.goto(base + "/");
    await ready(home);
    assert.equal(await home.locator(".model-case .portrait-name").evaluate(e => getComputedStyle(e).width), "38px");
    await home.locator("#works .portrait-rail").screenshot({ path: path.join(output, "home-nameplates-desktop.png") });
    await home.close();
    console.log("Shared desktop homepage nameplates OK");
    await vectorNameplates(browser);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
