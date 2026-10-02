const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const crypto = require('node:crypto');
const modulePaths = [__dirname, path.join(process.env.USERPROFILE || '', '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')];
const { chromium } = require(require.resolve('playwright', { paths: modulePaths }));
const base = process.env.PREVIEW_URL || 'http://127.0.0.1:4002';
const caseUrl = `${base}/models/sumi/`;
const output = path.join(__dirname, 'test-output');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const hash = buffer => crypto.createHash('sha256').update(buffer).digest('hex');

async function canvasPixels(page) {
  const dataUrl = await page.evaluate(() => window.casePreview.snapshot());
  const png = Buffer.from(dataUrl.split(',')[1], 'base64');
  const stats = await page.evaluate(async data => {
    const img = new Image();
    img.src = data;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const { data: pixels } = ctx.getImageData(0, 0, c.width, c.height);
    let changed = 0, minX = c.width, maxX = 0, minY = c.height, maxY = 0;
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
      const i = (y * c.width + x) * 4;
      if (Math.abs(pixels[i] - 245) + Math.abs(pixels[i + 1] - 244) + Math.abs(pixels[i + 2] - 247) < 25) continue;
      changed++;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    return { ratio: changed / (c.width * c.height), minX, maxX, minY, maxY, width: c.width, height: c.height };
  }, `data:image/png;base64,${png.toString('base64')}`);
  assert.ok(stats.ratio > .025, `Blank or undersized model canvas: ${JSON.stringify(stats)}`);
  assert.ok(stats.ratio < .9, `Canvas lacks background: ${JSON.stringify(stats)}`);
  return { png, stats };
}

async function layout(page) {
  const result = await page.evaluate(() => ({
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    broken: [...document.images].filter(i => !i.hidden && (!i.complete || i.naturalWidth === 0)).map(i => i.alt),
    buttons: [...document.querySelectorAll('.mode-tabs button')].map(e => ({ text: e.textContent, overflow: e.scrollWidth > e.clientWidth + 1 }))
  }));
  assert.ok(result.scrollWidth <= result.width, `Horizontal overflow: ${JSON.stringify(result)}`);
  assert.deepEqual(result.broken, []);
  assert.ok(result.buttons.every(button => !button.overflow), 'Control text overflows');
}

async function ready(page) {
  await page.waitForFunction(() => window.casePreview?.state.ready, null, { timeout: 120000 });
  await page.evaluate(() => document.fonts.ready);
  await delay(700);
  await revealSettled(page, '#showcase');
}

async function revealSettled(page, selector) {
  await page.waitForFunction(selector => Number(getComputedStyle(document.querySelector(selector)).opacity) >= .999, selector);
}

async function testScrollReveal(page) {
  const motion = page.locator('#motion');
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForFunction(() => !document.querySelector('#motion').classList.contains('is-revealed'));
  await delay(1200);
  assert.equal(await motion.evaluate(e => getComputedStyle(e).opacity), '0', 'Offscreen module did not fade out');
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  const top = await motion.evaluate(e => e.parentElement.getBoundingClientRect().top + scrollY);
  await page.evaluate(top => scrollTo({ top: top - 160, behavior: 'instant' }), top);
  await page.waitForFunction(() => {
    const opacity = Number(getComputedStyle(document.querySelector('#motion')).opacity);
    return opacity > .05 && opacity < .95;
  });
  await page.screenshot({ path: path.join(output, 'scroll-fade-mid.png') });
  await revealSettled(page, '#motion');
  assert.equal(await page.evaluate(() => document.documentElement.scrollHeight), height, 'Reveal changed page height');
  await page.screenshot({ path: path.join(output, 'scroll-fade-visible.png') });
  for (let repeat = 0; repeat < 2; repeat++) {
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForFunction(() => !document.querySelector('#motion').classList.contains('is-revealed'));
    await delay(1200);
    assert.equal(await motion.evaluate(e => getComputedStyle(e).opacity), '0', 'Repeated reveal did not reset');
    await page.evaluate(top => scrollTo({ top, behavior: 'instant' }), top);
    await revealSettled(page, '#motion');
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => [...document.querySelectorAll('[data-scroll-reveal]')].every(e => getComputedStyle(e).opacity === '1' && getComputedStyle(e).transform === 'none'));
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.waitForFunction(() => !document.querySelector('#motion').classList.contains('is-revealed'));
  await page.evaluate(() => document.querySelector('#motionPlay').focus({ preventScroll: true }));
  assert.equal(await motion.evaluate(e => getComputedStyle(e).opacity), '1', 'Keyboard-focused module is invisible');
  await page.evaluate(() => document.activeElement.blur());
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => document.querySelector('#motionPlay').getAttribute('aria-pressed') === 'false');
  await page.locator('#motionPlay').click();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => { document.activeElement.blur(); scrollTo({ top: 0, behavior: 'instant' }); });
  await revealSettled(page, '#showcase');
}

async function cursorZoom(page, delta = -800) {
  const canvas = page.locator('#modelCanvas canvas');
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  const x = Math.round(box.x + box.width * .54), y = Math.round(box.y + box.height * .175);
  const pointer = { x: (x - box.x) / box.width * 2 - 1, y: 1 - (y - box.y) / box.height * 2 };
  const anchor = await page.evaluate(p => window.casePreview.pointAt(p.x, p.y), pointer);
  const before = await page.evaluate(() => ({ zoom: window.casePreview.zoom, scroll: scrollY }));
  await page.mouse.move(x, y);
  await page.mouse.wheel(0, delta);
  await delay(500);
  const after = await page.evaluate(point => ({ projected: window.casePreview.projectPoint(point), zoom: window.casePreview.zoom, scroll: scrollY }), anchor);
  assert.ok(delta < 0 ? after.zoom > before.zoom : after.zoom < before.zoom, 'Wheel did not zoom in the expected direction');
  assert.ok(Math.abs(after.projected[0] - pointer.x) < 1e-6 && Math.abs(after.projected[1] - pointer.y) < 1e-6, `Zoom anchor moved away from pointer: ${JSON.stringify(after)}`);
  assert.equal(after.scroll, before.scroll, 'Wheel zoom scrolled the page');
}

async function touchZoom(page) {
  await page.locator('#modelCanvas canvas').scrollIntoViewIfNeeded();
  const box = await page.locator('#modelCanvas canvas').boundingBox();
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  const before = await page.evaluate(() => window.casePreview.zoom);
  const session = await page.context().newCDPSession(page);
  const touches = gap => [{ x: x - gap, y, id: 1 }, { x: x + gap, y, id: 2 }];
  try {
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: touches(20) });
    for (const gap of [24, 28, 32, 36]) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: touches(gap) });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await delay(500);
    assert.ok(await page.evaluate(() => window.casePreview.zoom) > before, 'Mobile pinch did not zoom');
  } finally { await session.detach(); }
}

async function main() {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader'] });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(caseUrl, { waitUntil: 'domcontentloaded' });
    await ready(page);
    await testScrollReveal(page);
    await layout(page);
    const desktop = await canvasPixels(page);
    assert.ok(desktop.stats.minY > 3 && desktop.stats.maxY < desktop.stats.height - 3, 'Full model is vertically cropped');
    assert.equal(await page.locator('#triangleCount').textContent(), '81,662');
    assert.equal(await page.locator('.portrait-card').count(), 0, 'The character selection wall belongs on the parent page');
    assert.equal(await page.evaluate(() => window.casePreview.projection), 'OrthographicCamera');
    assert.equal(await page.locator('.view-tabs, [data-view][aria-pressed]').count(), 0, 'Part presets must not be present');
    await page.screenshot({ path: path.join(output, 'desktop.png') });

    const camera = await page.evaluate(() => window.casePreview.camera);
    await page.getByRole('tab', { name: '白模与贴图', exact: true }).click();
    await delay(300);
    assert.deepEqual(await page.evaluate(() => window.casePreview.camera), camera, 'Mode change moved camera');
    await page.screenshot({ path: path.join(output, 'compare.png') });
    const slider = page.getByRole('slider', { name: '白模与贴图分界线' });
    await slider.focus();
    await page.keyboard.press('Home');
    await delay(250);
    assert.equal(await slider.inputValue(), '0');
    const textured = await canvasPixels(page);
    assert.equal(await page.getByRole('tab').count(), 2);
    assert.equal(await page.locator('#mode-model').count(), 0);
    await slider.focus();
    await page.keyboard.press('End');
    await delay(250);
    assert.equal(await slider.inputValue(), '100');
    const clay = await canvasPixels(page);
    assert.notEqual(hash(textured.png), hash(clay.png), 'Clay and texture render identically');
    assert.deepEqual(await page.evaluate(() => window.casePreview.camera), camera, 'Comparison changed camera');
    await slider.evaluate(input => { input.value = '50'; input.dispatchEvent(new Event('input', { bubbles: true })); });
    const grip = await page.locator('.split-grip').boundingBox();
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
    await page.mouse.down();
    await page.mouse.move(grip.x + 120, grip.y + grip.height / 2, { steps: 8 });
    await page.mouse.up();
    assert.ok(Number(await slider.inputValue()) > 55, 'Divider does not drag');
    assert.deepEqual(await page.evaluate(() => window.casePreview.camera), camera, 'Divider drag rotated camera');

    await page.getByRole('tab', { name: '立绘与模型', exact: true }).click();
    const canvas = page.locator('#modelCanvas canvas');
    await canvas.focus();
    const beforeTurn = await canvasPixels(page);
    await page.keyboard.press('ArrowRight');
    await delay(500);
    assert.notDeepEqual(await page.evaluate(() => window.casePreview.camera), camera, 'Keyboard orbit did not work');
    assert.notEqual(hash(beforeTurn.png), hash((await canvasPixels(page)).png));
    await page.getByRole('button', { name: '恢复正面视角', exact: true }).click();
    const canvasBox = await canvas.boundingBox();
    const beforeDrag = await page.evaluate(() => window.casePreview.camera);
    await page.mouse.move(canvasBox.x + canvasBox.width * .6, canvasBox.y + canvasBox.height * .5);
    await page.mouse.down();
    await page.mouse.move(canvasBox.x + canvasBox.width * .75, canvasBox.y + canvasBox.height * .5, { steps: 8 });
    await page.mouse.up();
    await delay(600);
    assert.notDeepEqual(await page.evaluate(() => window.casePreview.camera), beforeDrag, 'Pointer orbit did not work');
    const beforeZoom = await page.evaluate(() => window.casePreview.zoom);
    await page.mouse.wheel(0, -100);
    await delay(600);
    assert.notEqual(await page.evaluate(() => window.casePreview.zoom), beforeZoom, 'Orthographic wheel zoom did not work');
    await page.getByRole('button', { name: '恢复正面视角', exact: true }).click();
    await page.getByRole('button', { name: '自动旋转', exact: true }).click();
    const rotatingCamera = await page.evaluate(() => window.casePreview.camera);
    await delay(700);
    assert.notDeepEqual(await page.evaluate(() => window.casePreview.camera), rotatingCamera, 'Auto rotation did not move');
    await page.getByRole('button', { name: '暂停自动旋转', exact: true }).click();

    for (const mode of ['立绘与模型', '白模与贴图']) {
      await page.getByRole('tab', { name: mode, exact: true }).click();
      await page.getByRole('button', { name: '恢复正面视角', exact: true }).click();
      await cursorZoom(page);
      await canvasPixels(page);
      await cursorZoom(page, 800);
    }
    await page.getByRole('button', { name: '恢复正面视角', exact: true }).click();
    await cursorZoom(page, -2200);
    await page.screenshot({ path: path.join(output, 'cursor-zoom.png') });
    const panBox = await canvas.boundingBox();
    const beforePan = await page.evaluate(() => window.casePreview.target);
    await page.mouse.move(panBox.x + panBox.width * .5, panBox.y + panBox.height * .5);
    await page.mouse.down({ button: 'right' });
    await page.mouse.move(panBox.x + panBox.width * .5 + 80, panBox.y + panBox.height * .5 + 30, { steps: 8 });
    await page.mouse.up({ button: 'right' });
    await delay(700);
    assert.notDeepEqual(await page.evaluate(() => window.casePreview.target), beforePan, 'Right drag did not pan');
    await page.getByRole('button', { name: '恢复正面视角', exact: true }).click();
    await page.mouse.move(panBox.x + panBox.width * .5, panBox.y + panBox.height * .5);
    await page.mouse.wheel(0, -20000);
    await delay(500);
    assert.equal(await page.evaluate(() => window.casePreview.zoom), 5, 'Zoom exceeds close-up limit');
    const limitCamera = await page.evaluate(() => window.casePreview.camera);
    await page.mouse.wheel(0, -1000);
    await delay(500);
    assert.deepEqual(await page.evaluate(() => window.casePreview.camera), limitCamera, 'Zoom at limit drifts camera');
    await page.mouse.wheel(0, 20000);
    await delay(500);
    assert.equal(await page.evaluate(() => window.casePreview.zoom), .5, 'Zoom exceeds wide-view limit');
    await page.getByRole('button', { name: '恢复正面视角', exact: true }).click();
    await delay(500);
    assert.equal(await page.evaluate(() => window.casePreview.zoom), 1, 'Reset did not clear zoom');
    const resetCamera = await page.evaluate(() => window.casePreview.camera);
    assert.ok(resetCamera.every((v, i) => Math.abs(v - camera[i]) < 1e-8), 'Reset did not restore full-body framing after pan/zoom');
    assert.equal(await page.locator('#expression').count(), 0, 'Expression switching must not be present');
    await page.getByRole('tab', { name: '立绘与模型', exact: true }).click();
    await page.getByRole('button', { name: '侧面', exact: true }).click();
    assert.equal(await page.locator('#referenceCrop').getAttribute('data-angle'), 'side');
    await page.getByRole('button', { name: '正面', exact: true }).click();
    await page.getByRole('button', { name: '查看完整设定图', exact: true }).click();
    assert.equal(await page.locator('#referenceDialog').evaluate(d => d.open), true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#referenceDialog').evaluate(d => d.open), false);

    await page.getByRole('tab', { name: '立绘与模型', exact: true }).focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.getByRole('tab', { name: '白模与贴图', exact: true }).getAttribute('aria-selected'), 'true');

    const gifResponse = await page.request.get(`${base}/asset/motion.gif`);
    assert.equal(gifResponse.headers()['content-type'], 'image/gif');
    assert.match((await gifResponse.body()).subarray(0, 6).toString(), /^GIF8[79]a$/);
    const motionImage = page.locator('#motionImage');
    await page.locator('#motionPlay').waitFor({ state: 'visible' });
    await motionImage.scrollIntoViewIfNeeded();
    await revealSettled(page, '#motion');
    await delay(500);
    const moving = await motionImage.screenshot();
    await delay(650);
    assert.notEqual(hash(await motionImage.screenshot()), hash(moving), 'GIF is not animated');
    await page.locator('#motionPlay').click();
    await delay(100);
    const stopped = await motionImage.screenshot();
    await delay(600);
    assert.equal(hash(await motionImage.screenshot()), hash(stopped), 'Stopped GIF still animates');
    await page.getByRole('button', { name: '放大动态展示', exact: true }).click();
    assert.equal(await page.locator('#motionDialog').evaluate(d => d.open), true);
    await page.locator('#motionDialogPlay').click();
    assert.equal(await page.locator('#motionPlay').getAttribute('aria-pressed'), 'true');
    await page.keyboard.press('Escape');
    await page.locator('#motion').screenshot({ path: path.join(output, 'motion-desktop.png') });

    for (const width of [1920, 768, 390, 320]) {
      await page.setViewportSize({ width, height: width < 500 ? 844 : 1080 });
      await page.getByRole('tab', { name: '立绘与模型', exact: true }).click();
      await page.getByRole('button', { name: '恢复正面视角', exact: true }).click();
      if (width === 390) {
        await touchZoom(page);
        await page.getByRole('button', { name: '恢复正面视角', exact: true }).click();
      }
      await delay(1300);
      await layout(page);
      const { stats } = await canvasPixels(page);
      assert.ok(stats.minX > 0 && stats.maxX < stats.width - 1, `Model cropped horizontally at ${width}: ${JSON.stringify(stats)}`);
      assert.ok(stats.minY > 0 && stats.maxY < stats.height - 1, `Model cropped vertically at ${width}`);
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: path.join(output, `viewport-${width}.png`) });
      await page.getByRole('tab', { name: '白模与贴图', exact: true }).click();
      await layout(page);
      await canvasPixels(page);
      if (width === 390) await page.screenshot({ path: path.join(output, 'mobile-compare.png') });
      await page.locator('#motion').scrollIntoViewIfNeeded();
      await revealSettled(page, '#motion');
      await layout(page);
      const gifBox = await motionImage.boundingBox();
      assert.ok(gifBox.x >= 0 && gifBox.x + gifBox.width <= width, 'Motion media overflows');
      const gifStage = await page.locator('.motion-stage').boundingBox();
      assert.ok(gifBox.height <= gifStage.height + 1, 'Motion image is taller than its stage');
      if (width === 390) await page.locator('#motion').screenshot({ path: path.join(output, 'motion-mobile.png') });
    }

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => document.getElementById('motionPlay').getAttribute('aria-pressed') === 'false');
    assert.equal(await page.locator('#motionPlay').getAttribute('aria-pressed'), 'false');
    const reduced = await motionImage.screenshot();
    await delay(600);
    assert.equal(hash(await motionImage.screenshot()), hash(reduced), 'Reduced-motion GIF still animates');
    await page.getByRole('tab', { name: '立绘与模型', exact: true }).click();
    await page.locator('#works').scrollIntoViewIfNeeded();
    await delay(300);
    await page.locator('#works').screenshot({ path: path.join(output, 'collection-return.png') });
    await page.locator('#works a[href="/models/"]').click();
    await page.waitForURL(/\/models\/$/);
    assert.equal(await page.locator('.models-title h1').innerText(), 'Characters');
    assert.equal(await page.request.get(`${base}/.local.json`).then(r => r.status()), 404);
    assert.equal(await page.request.get(`${base}/server.cjs`).then(r => r.status()), 404);

    const failed = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    await failed.route('**/asset/model.vrm', route => route.fulfill({ status: 404, body: 'Unavailable' }));
    await failed.route('**/asset/motion.gif', route => route.fulfill({ status: 404, body: 'Unavailable' }));
    await failed.goto(`${caseUrl}?mode=compare`, { waitUntil: 'domcontentloaded' });
    await failed.getByRole('button', { name: '重新加载', exact: true }).waitFor();
    assert.equal(await failed.locator('#autoRotate').isDisabled(), true);
    await failed.locator('#motionRetry').waitFor({ state: 'visible' });
    assert.equal(await failed.locator('#motionPlay').isDisabled(), true);
    await failed.unroute('**/asset/model.vrm');
    await failed.getByRole('button', { name: '重新加载', exact: true }).click();
    await ready(failed);
    assert.equal(await failed.getByRole('tab', { name: '白模与贴图', exact: true }).getAttribute('aria-selected'), 'true');
    assert.equal(await failed.locator('#autoRotate').isDisabled(), false);
    await failed.unroute('**/asset/motion.gif');
    await failed.locator('#motionRetry').scrollIntoViewIfNeeded();
    await failed.locator('#motionRetry').click();
    await failed.waitForFunction(() => !document.getElementById('motionPlay').disabled);
    assert.equal(await failed.locator('#motionPlay').getAttribute('aria-pressed'), 'false', 'Reduced-motion must start with the GIF stopped');
    assert.match(await failed.locator('#motionImage').getAttribute('src'), /^data:image\/png/);
    await failed.locator('#motionPlay').click();
    assert.match(await failed.locator('#motionImage').getAttribute('src'), /^blob:/, 'Reduced-motion must still allow explicit playback');
    await failed.close();
    const noScript = await browser.newPage({ javaScriptEnabled: false });
    await noScript.goto(caseUrl, { waitUntil: 'domcontentloaded' });
    assert.equal(await noScript.locator('#motion').evaluate(e => getComputedStyle(e).opacity), '1', 'No-JavaScript content is hidden');
    await noScript.close();
    assert.deepEqual(errors, [], `Browser errors: ${errors.join('; ')}`);
    console.log('Passed: repeatable scroll fades, no reveal layout shift, reduced-motion/no-JS/focus visibility, real model rendering, cursor zoom, pan/reset/limits, divider, orbit, touch pinch, no part/expression presets, GIF interactions, keyboard navigation, responsive layouts, privacy, load retries.');
    console.log(`Screenshots: ${output}`);
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
