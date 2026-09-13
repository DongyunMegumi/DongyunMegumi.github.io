const { chromium } = require('C:/Users/24022/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs/promises');
async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1541, height: 960 } });
    await page.goto('https://atelier.games/karia/jp/characters/karia.html', { waitUntil: 'networkidle' });
    console.log(await page.locator('a[href*="servio"]').evaluateAll(links => links.map(a => ({ html: a.outerHTML, parent: a.parentElement.outerHTML.slice(0, 10000) }))));
    console.log(await page.locator('script[src],link[rel="stylesheet"]').evaluateAll(items => items.map(item => item.src || item.href)));
    const target = page.locator('a[href*="servio"]').last();
    await target.scrollIntoViewIfNeeded();
    console.log('Layout', await target.evaluate(a => {
      const result = [];
      for (let el = a, i = 0; el && i < 5; el = el.parentElement, i++) {
        const s = getComputedStyle(el), r = el.getBoundingClientRect();
        result.push({ tag: el.tagName, class: el.className, width: r.width, height: r.height, padding: s.padding, gap: s.gap, background: s.background, transform: s.transform });
      }
      return result;
    }));
    await page.screenshot({ path: '../character-preview/reference-strip-live.png' });
    await target.hover();
    await page.waitForTimeout(500);
    await page.screenshot({ path: '../character-preview/reference-strip-hover.png' });
    console.log('Hover', await target.evaluate(a => [a, ...a.querySelectorAll('*')].map(el => ({ tag: el.tagName, class: el.className, transform: getComputedStyle(el).transform, opacity: getComputedStyle(el).opacity, transition: getComputedStyle(el).transition }))));
    for (const url of await page.locator('script[src]').evaluateAll(items => items.map(item => item.src).filter(url => url.includes('/karia/')))) {
      const response = await page.request.get(url);
      await fs.writeFile('../character-preview/reference-' + new URL(url).pathname.split('/').pop(), await response.text());
    }
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
