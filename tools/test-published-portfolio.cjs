const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(require.resolve('playwright', {
  paths: [path.join(process.env.USERPROFILE || '', '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')]
}));
const root = path.resolve(__dirname, '../public');
const output = path.resolve(__dirname, '../preview/portfolio-case/test-output/published');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif', '.woff2': 'font/woff2' };
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(root, '.' + pathname + (pathname.endsWith('/') ? 'index.html' : ''));
    const relative = path.relative(root, file);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Invalid path');
    const data = await fs.readFile(file);
    res.writeHead(200, { 'Content-Type': (types[path.extname(file)] || 'application/octet-stream'), 'Content-Length': data.length });
    res.end(data);
  } catch { res.writeHead(404); res.end('Not found'); }
});
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function pixels(page) {
  return page.evaluate(async () => {
    const img = new Image();
    img.src = window.casePreview.snapshot();
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.width; canvas.height = img.height;
    const context = canvas.getContext('2d');
    context.drawImage(img, 0, 0);
    const { data } = context.getImageData(0, 0, img.width, img.height);
    let count = 0, minX = img.width, maxX = 0, minY = img.height, maxY = 0;
    let colored = 0;
    for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
      const i = (y * img.width + x) * 4;
      if (Math.abs(data[i] - 245) + Math.abs(data[i + 1] - 244) + Math.abs(data[i + 2] - 247) < 25) continue;
      count++;
      if (Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]) > 20) colored++;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    return { ratio: count / (img.width * img.height), colored, minX, maxX, minY, maxY, width: img.width, height: img.height };
  });
}

async function main() {
  await fs.mkdir(output, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = process.env.PUBLISHED_URL || `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader'] });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1864, height: 884 }, reducedMotion: 'reduce' });
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.url().startsWith(base) && response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
    for (const route of ['/', '/models/', '/commission/', '/news/', '/about/', '/archive/', '/characters/?character=1#profile', '/home/journal/?post=blender-bmesh-free', '/home/journal/?post=hello-portfolio']) {
      const response = await page.goto(base + route, { waitUntil: 'networkidle' });
      assert.equal(response.status(), 200);
      await page.evaluate(() => document.fonts.ready);
      assert.equal(await page.locator('meta[name=robots][content*=noindex]').count(), 0, `Published page still noindex: ${route}`);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Overflow: ${route}`);
      const broken = await page.evaluate(async () => {
        await Promise.all([...document.images].map(image => image.decode().catch(() => {})));
        return [...document.images].filter(image => image.hasAttribute('src') && !image.naturalWidth).map(image => image.getAttribute('src'));
      });
      assert.deepEqual(broken, [], `Broken images: ${route}`);
      if (route.includes('/home/journal/')) assert.doesNotMatch(await page.locator('#articleTitle').innerText(), /无法读取|正在/);
      if (route === '/' || route === '/models/') await page.screenshot({ path: path.join(output, route === '/' ? 'home.png' : 'models.png'), fullPage: true });
    }
    await page.goto(base + '/models/?category=game', { waitUntil: 'networkidle' });
    assert.equal(await page.locator('.process-entry').isVisible(), false, 'Game category must not show Sumi archive');
    assert.equal(await page.locator('.process-plan:visible').count(), 3, 'Retained character profile entries missing');
    await page.goto(base + '/models/sumi/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.casePreview?.state.ready, null, { timeout: 120000 });
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.locator('body').getAttribute('data-model-storage'), 'encrypted');
    const modelAccess = await page.locator('#modelAccess').evaluate(node => JSON.parse(node.textContent));
    assert.match(modelAccess.url, /^\/asset\/sumi-display\.[a-f0-9]{16}\.enc$/);
    const cipherResponse = await page.request.get(base + modelAccess.url);
    assert.equal(cipherResponse.status(), 200);
    const cipherBytes = await cipherResponse.body();
    assert.equal(cipherBytes.toString('ascii', 0, 8), 'MEGUMI01');
    assert.notEqual(cipherBytes.toString('ascii', 0, 4), 'glTF');
    assert.ok(Number((await page.locator('#triangleCount').textContent()).replaceAll(',', '')) > 1000);
    for (const width of [1280, 1864, 1920]) {
      await page.setViewportSize({ width, height: 884 });
      await page.getByRole('button', { name: '恢复正面视角', exact: true }).click();
      await delay(400);
      const result = await pixels(page);
      assert.ok(result.ratio > .025 && result.ratio < .8, `Blank model: ${JSON.stringify(result)}`);
      assert.ok(result.colored > 1000, 'Export lost colored textures');
      assert.ok(result.minX > 0 && result.maxX < result.width - 1 && result.minY > 0 && result.maxY < result.height - 1, 'Model is cropped');
      await page.locator('#showcase').screenshot({ path: path.join(output, `model-${width}.png`) });
    }
    const canvas = page.locator('#modelCanvas canvas');
    await canvas.scrollIntoViewIfNeeded();
    const initial = await page.evaluate(() => window.casePreview.camera);
    await page.locator('#autoRotate').click();
    await delay(500);
    assert.notDeepEqual(await page.evaluate(() => window.casePreview.camera), initial, 'Auto rotation does not move');
    await page.locator('#resetView').click();
    const box = await canvas.boundingBox();
    await page.mouse.move(box.x + box.width * .5, box.y + box.height * .4);
    await page.mouse.wheel(0, -600);
    await delay(500);
    assert.ok(await page.evaluate(() => window.casePreview.zoom > 1), 'Zoom failed');
    await page.locator('#resetView').click();
    assert.equal(await page.evaluate(() => window.casePreview.zoom), 1);
    await page.getByRole('tab', { name: '白模与贴图', exact: true }).click();
    await page.locator('#splitRange').fill('35');
    assert.equal(await page.evaluate(() => window.casePreview.state.split), 35);
    await page.locator('#showcase').screenshot({ path: path.join(output, 'compare.png') });
    await page.locator('#fullscreen').click();
    await page.waitForFunction(() => Boolean(document.fullscreenElement));
    await page.locator('#fullscreen').click();
    await page.waitForFunction(() => !document.fullscreenElement);
    await page.locator('#motion').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => !document.getElementById('motionPlay').disabled);
    await page.locator('#motionPlay').click();
    const before = await page.locator('#motionImage').screenshot();
    await delay(650);
    assert.ok(!before.equals(await page.locator('#motionImage').screenshot()), 'GIF not moving');
    await page.locator('#motionPlay').click();
    await page.locator('#motionExpand').click();
    assert.equal(await page.locator('#motionDialog').evaluate(dialog => dialog.open), true);
    await page.keyboard.press('Escape');
    assert.deepEqual(errors, [], `Browser errors: ${errors.join(', ')}`);
    const failure = await browser.newPage({ viewport: { width: 1280, height: 884 }, reducedMotion: 'reduce' });
    await failure.route('**/asset/*.enc', route => route.fulfill({ status: 200, body: 'damaged encrypted asset' }));
    await failure.goto(base + '/models/sumi/', { waitUntil: 'domcontentloaded' });
    await failure.locator('#retryModel').waitFor({ state: 'visible' });
    assert.equal(await failure.locator('#autoRotate').isDisabled(), true);
    await failure.unroute('**/asset/*.enc');
    await failure.locator('#retryModel').click();
    await failure.waitForFunction(() => window.casePreview?.state.ready, null, { timeout: 120000 });
    assert.equal(await failure.locator('#autoRotate').isDisabled(), false);
    await failure.close();
    for (const forbidden of ['/.local.json', '/server.cjs', '/asset/model.vrm', '/asset/sumi-display.glb', '/portfolio-assets/README.md']) {
      assert.equal((await page.request.get(base + forbidden)).status(), 404, `Private file exposed: ${forbidden}`);
    }
    const noJS = await browser.newPage({ javaScriptEnabled: false });
    await noJS.goto(base + '/');
    assert.equal(await noJS.locator('.portrait-card').count(), 4, 'Static homepage lost collection');
    await noJS.close();
    const opening = await browser.newPage({ viewport: { width: 1864, height: 884 } });
    opening.on('pageerror', error => errors.push(error.message));
    await opening.goto(base + '/?intro=1', { waitUntil: 'domcontentloaded' });
    await opening.waitForFunction(() => document.documentElement.classList.contains('intro-running'));
    await opening.waitForFunction(() => !document.documentElement.classList.contains('intro-pending'));
    assert.equal(await opening.locator('.frame-bubble').count(), 24);
    const bubble = opening.locator('.frame-bubble').first();
    const firstPosition = await bubble.evaluate(node => getComputedStyle(node).transform);
    await delay(350);
    assert.notEqual(await bubble.evaluate(node => getComputedStyle(node).transform), firstPosition, 'Background bubble animation is stopped');
    await opening.screenshot({ path: path.join(output, 'opening-complete.png') });
    await opening.close();
    assert.deepEqual(errors, []);
    console.log('Passed: standalone static pages, journal data, retained character profiles, category archive, GLB textures/framing at 1280/1864/1920, canvas pixels, rotation, zoom/reset, clay comparison, fullscreen, GIF playback/dialog, no-JS links and private file exclusion.');
    console.log(`Screenshots: ${output}`);
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
