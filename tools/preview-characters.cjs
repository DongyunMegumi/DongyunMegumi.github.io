const runtimeModules = require('node:path').resolve(require('node:path').dirname(process.execPath), '../node_modules');
const { chromium } = require(require.resolve('playwright', { paths: [process.cwd(), runtimeModules] }));
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');

async function main() {
  const output = path.resolve(__dirname, '../../character-preview');
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    if (process.argv.includes('--reference')) {
      await page.goto('https://atelier.games/karia/jp/characters/karia.html', { waitUntil: 'networkidle' });
      await page.getByText('Accept Cookies', { exact: true }).click().catch(() => {});
      await page.screenshot({ path: path.join(output, 'reference-desktop.png') });
      for (const name of ['common', 'characters', 'top']) {
        const response = await page.request.get(`https://atelier.games/karia/assets/css/${name}.min.css`);
        const css = await response.text();
        await fs.writeFile(path.join(output, `${name}.css`), css);
        if (name === 'characters') console.log(css);
      }
      const assets = path.resolve(__dirname, '../source/characters/assets/reference');
      await fs.mkdir(assets, { recursive: true });
      for (const name of ['bg_paper.jpg', 'chara_bg.png', 'circle_01.png', 'ami50.png', 'ami20.png', 'chara_base-text-deco.png']) {
        const response = await page.request.get(`https://atelier.games/karia/assets/img/${name}`);
        if (!response.ok()) throw new Error(`Asset ${name}: ${response.status()}`);
        await fs.writeFile(path.join(assets, name), await response.body());
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: path.join(output, 'reference-mobile.png'), fullPage: true });
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto('https://atelier.games/karia/jp/index.html', { waitUntil: 'networkidle' });
      await page.screenshot({ path: path.join(output, 'reference-home.png') });
      const section = page.locator('.top-chara');
      if (await section.count()) await section.screenshot({ path: path.join(output, 'reference-characters.png') });
    } else {
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto('http://localhost:4001/characters/', { waitUntil: 'networkidle' });
      await page.evaluate(async () => { await document.fonts.ready; await Promise.all(document.getAnimations().map(animation => animation.finished)); });
      await page.screenshot({ path: path.join(output, 'desktop.png'), fullPage: true });
      assert.equal(await page.locator('#overviewTitle').innerText(), 'Characters');
      assert.equal(await page.locator('.overview-card').count(), 3);
      console.log('Initial:', await page.locator('#characterName').innerText());
      await page.locator('.overview-card').nth(1).click();
      await page.waitForURL(/character=1/);
      assert.equal(await page.locator('#characterName').innerText(), 'CHARACTER 02');
      await page.locator('#characterSelector .portrait-card').last().click();
      await page.waitForURL(/character=2#profile/);
      await page.waitForFunction(() => Math.abs(document.querySelector('#profile').getBoundingClientRect().top) < 2);
      await page.goBack();
      assert.equal(await page.locator('#characterName').innerText(), 'CHARACTER 02');
      await page.getByRole('button', { name: 'Next character', exact: true }).click();
      console.log('Next:', await page.locator('#characterName').innerText());
      await page.getByRole('button', { name: 'Previous character', exact: true }).click();
      await page.evaluate(async () => { await Promise.all(document.getAnimations().map(animation => animation.finished)); });
      await page.getByRole('button', { name: 'Enlarge artwork', exact: true }).click();
      console.log('Lightbox:', await page.locator('dialog[open]').count());
      await page.keyboard.press('Escape');
      for (const width of [390, 768, 1920]) {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 1080 });
        await page.evaluate(async () => { await Promise.all(document.getAnimations().map(animation => animation.finished)); });
        await page.screenshot({ path: path.join(output, `viewport-${width}.png`), fullPage: true });
        console.log('Layout:', await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
          images: [...document.images].filter(i => i.offsetWidth > 0).map(i => ({ src: i.getAttribute('src'), loaded: i.complete && i.naturalWidth > 0 })) })));
      }
      await page.getByRole('button', { name: 'Open menu', exact: true }).click();
      assert.equal(await page.locator('#navigationDialog').evaluate(dialog => dialog.open), true);
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Show full artwork', exact: true }).click();
      assert.equal(await page.locator('#toggleFraming').getAttribute('aria-pressed'), 'true');
      const response = await page.request.get('http://localhost:4001/characters/characters-data.json');
      const fixture = await response.json();
      fixture.characters[0].renders = ['assets/images/char-01.png', 'assets/images/char-02.jpg'];
      fixture.characters[0].wires = ['assets/images/char-03.png'];
      fixture.characters[0].nameRomaji = 'LONGCHARACTERNAMEWITHNOSPACES';
      await page.route('**/characters-data.json', route => route.fulfill({ json: fixture }));
      await page.goto('http://localhost:4001/characters/', { waitUntil: 'networkidle' });
      await page.getByRole('tab', { name: 'Render', exact: true }).click();
      await page.getByRole('button', { name: 'Image 2', exact: true }).click();
      assert.match(await page.locator('#mediaImage').getAttribute('src'), /char-02/);
      await page.getByRole('button', { name: 'Enlarge gallery image', exact: true }).click();
      await page.getByRole('button', { name: 'Previous image', exact: true }).click();
      assert.match(await page.locator('#dialogImage').getAttribute('src'), /char-01/);
      await page.keyboard.press('Escape');
      await page.getByRole('tab', { name: 'Wireframe', exact: true }).click();
      assert.match(await page.locator('#mediaImage').getAttribute('src'), /char-03/);
      await page.setViewportSize({ width: 320, height: 740 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.unroute('**/characters-data.json');
      await page.goto('http://localhost:4001/characters/?character=2', { waitUntil: 'networkidle' });
      assert.equal(await page.locator('#characterName').innerText(), 'CHARACTER 03');
      await page.goto('http://localhost:4001/', { waitUntil: 'networkidle' });
      assert.equal(await page.locator('.home-character-gateway').count(), 1);
      assert.equal(await page.locator('.home-character-card').count(), 3);
      for (const width of [390, 768, 1541, 1920]) {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
        await page.screenshot({ path: path.join(output, `home-${width}.png`), fullPage: true });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        assert.equal(await page.locator('.home-character-gateway').evaluate(el => Math.round(el.getBoundingClientRect().width)), width);
      }
      await page.locator('.home-character-gateway').screenshot({ path: path.join(output, 'home-character-band.png') });
      const hoverCard = page.locator('.home-character-card').first();
      await hoverCard.hover();
      await page.waitForFunction(() => getComputedStyle(document.querySelector('.home-character-card')).filter === 'brightness(1.15)');
      await page.locator('.home-character-gateway').screenshot({ path: path.join(output, 'home-character-hover.png') });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.locator('.home-character-gateway').getByRole('button', { name: '下一组角色' }).click();
      await page.waitForFunction(() => document.querySelector('.home-character-list').scrollLeft > 100);
      await page.locator('.home-character-card').first().focus();
      await page.keyboard.press('End');
      assert.equal(await page.locator('.home-character-card').last().evaluate(el => el === document.activeElement), true);
      await page.keyboard.press('Home');
      await page.locator('.home-character-card').first().click();
      await page.waitForURL(/\/characters\/\?character=0#profile/);
      await page.waitForFunction(() => Math.abs(document.querySelector('#profile').getBoundingClientRect().top) < 2);
      await page.setViewportSize({ width: 1541, height: 960 });
      await page.locator('.character-selection').screenshot({ path: path.join(output, 'character-strip.png') });
      const sixCharacters = { characters: Array.from({ length: 6 }, (_, index) => ({ ...fixture.characters[index % 3], id: index, nameRomaji: `CHARACTER ${index + 1}` })) };
      await page.route('**/characters-data.json', route => route.fulfill({ json: sixCharacters }));
      await page.goto('http://localhost:4001/', { waitUntil: 'networkidle' });
      assert.equal(await page.locator('.home-character-card').count(), 6);
      assert.equal(await page.locator('.home-character-list').evaluate(el => el.scrollWidth <= el.clientWidth + 2), true);
      await page.locator('.home-character-gateway').screenshot({ path: path.join(output, 'six-character-layout-test.png') });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.locator('.home-character-card').first().focus();
      await page.keyboard.press('End');
      await page.keyboard.press('Enter');
      await page.waitForURL(/character=5#profile/);
      assert.equal(await page.locator('#characterName').innerText(), 'CHARACTER 6');
      await page.unroute('**/characters-data.json');
      await page.goto('http://localhost:4001/characters/editor.html', { waitUntil: 'networkidle' });
      assert.equal(await page.locator('#addCharBtn').count(), 1);
      console.log('Passed: overview entry, homepage gateway, menu, framing, render/wire tabs, lightbox paging, long name, direct character link, editor.');
      console.log('Page errors:', errors);
      if (errors.length) process.exitCode = 1;
    }
  } finally {
    await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
