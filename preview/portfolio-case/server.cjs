const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const shared = path.resolve(root, '../../source/characters');
const port = Number(process.env.PORT || 4002);
let local = {};
try { local = JSON.parse(fs.readFileSync(path.join(root, '.local.json'), 'utf8')); }
catch { console.warn('No .local.json: model and reference endpoints are unavailable.'); }
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.vrm': 'model/gltf-binary', '.woff2': 'font/woff2' };

function inside(base, relative) {
  const target = path.resolve(base, relative);
  const relation = path.relative(base, target);
  return relation && !relation.startsWith('..') && !path.isAbsolute(relation) ? target : null;
}

function resolveRoute(url) {
  const pages = { '/news/':'news.html', '/news':'news.html', '/about/':'about.html', '/about':'about.html', '/archive/':'archive.html', '/archive':'archive.html', '/home/pages.css':'pages.css', '/home/pages.js':'pages.js' };
  if (pages[url]) return path.join(root, 'home', pages[url]);
  if (['/models/nameplate-top.svg', '/models/nameplate-bottom.svg', '/models/portrait-panel.svg', '/models/portrait-art-mask.svg'].includes(url)) return path.join(root, url.slice(1));
  if (url === '/models/collection.js') return path.join(root, 'models/collection.js');
  if (url === '/commission/' || url === '/commission') return path.join(root, 'commission/index.html');
  if (url === '/commission/style.css') return path.join(root, 'commission/style.css');
  if (url === '/commission/commission.js') return path.join(root, 'commission/commission.js');
  if (url === '/home/type.css') return path.join(root, 'home/type.css');
  if (['/home/fonts/jost.woff2', '/home/fonts/noto-sans-jp.woff2', '/home/fonts/noto-sans-sc.woff2'].includes(url)) return path.join(root, url.slice(1));
  if (url === '/home/assets/header-art.jpg') return local.homeBackground;
  if (url === '/home/assets/about-portrait.jpg') return local.homePortrait;
  const homeAssets = { 'sumi-full.png': 'sumi-full.png', 'sumi-portrait.png': 'sumi-portrait.png', 'sumi-clay.png': 'sumi-clay.png', 'megumi-wordmark.png': 'megumi-wordmark-source.png', 'brand.png': 'megumi-brand-source.png' };
  if (url.startsWith('/home/assets/')) {
    const name = homeAssets[url.slice('/home/assets/'.length)];
    return name ? path.join(root, '.local-assets', name) : null;
  }
  if (url === '/asset/model.vrm') return local.model;
  if (url === '/asset/reference.png') return local.reference;
  if (url === '/asset/motion.gif') return local.motion;
  if (url === '/asset/matcap.png') return local.matcap;
  if (url === '/vendor/three-vrm.js') return path.join(root, 'node_modules/@pixiv/three-vrm/lib/three-vrm.module.min.js');
  if (url.startsWith('/vendor/three/')) return inside(path.join(root, 'node_modules/three'), url.slice('/vendor/three/'.length));
  if (url.startsWith('/characters/')) return inside(shared, url.slice('/characters/'.length) || 'index.html');
  const routes = { '/': 'home/frame.html', '/index.html': 'home/frame.html', '/style.css': 'style.css', '/viewer.js': 'viewer.js', '/scroll-reveal.js': 'scroll-reveal.js', '/home': 'home/frame.html', '/home/': 'home/frame.html', '/home/v1/': 'home/index.html', '/home/style.css': 'home/style.css', '/home/home.js': 'home/home.js', '/home/journal/': 'home/journal.html', '/home/journal.js': 'home/journal.js', '/home/frame.css': 'home/frame.css', '/home/frame.js': 'home/frame.js', '/home/brand.css': 'home/brand.css', '/home/brand.js': 'home/brand.js', '/models/': 'models/index.html', '/models': 'models/index.html', '/models/style.css': 'models/style.css', '/models/models.js': 'models/models.js', '/models/sumi/': 'index.html', '/models/sumi': 'index.html' };
  return routes[url] ? path.join(root, routes[url]) : null;
}

const server = http.createServer(async (req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
  let url;
  try { url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400); res.end(); return; }
  // Keep bookmarked prototype links while making the root the actual homepage.
  if (url === '/' && new URL(req.url, 'http://localhost').searchParams.has('mode')) {
    res.writeHead(302, { Location: '/models/sumi/' + new URL(req.url, 'http://localhost').search });
    res.end(); return;
  }
  if (url.startsWith('/home/post/')) {
    const slug = url.slice('/home/post/'.length);
    if (!['hello-portfolio', 'blender-bmesh-free'].includes(slug)) { res.writeHead(404); res.end('Not found'); return; }
    try {
      const frontMatter = require('hexo-front-matter');
      const { marked } = require('marked');
      const source = await fs.promises.readFile(path.resolve(root, '../../source/_posts', slug + '.md'), 'utf8');
      const article = frontMatter.parse(source);
      const json = JSON.stringify({ title: article.title, html: marked.parse(article._content) });
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'X-Content-Type-Options': 'nosniff' });
      res.end(req.method === 'HEAD' ? undefined : json);
    } catch { res.writeHead(500); res.end('Article unavailable'); }
    return;
  }
  const file = resolveRoute(url);
  if (!file) { res.writeHead(404); res.end('Not found'); return; }
  try {
    const stat = await fs.promises.stat(file);
    if (!stat.isFile()) throw new Error('Not a file');
    const headers = {
      'Content-Type': types[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex, nofollow',
      'Cross-Origin-Resource-Policy': 'same-origin'
    };
    // Hexo's front matter is not HTML; strip it only for the existing character pages.
    if (path.extname(file) === '.html') {
      let html = (await fs.promises.readFile(file, 'utf8')).replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
      // Both overview entrances share the same server-rendered, no-JS card links.
      if (html.includes('<!-- MODEL_COLLECTION -->')) {
        html = html.replace('<!-- MODEL_COLLECTION -->', await fs.promises.readFile(path.join(root, 'models/collection.html'), 'utf8'));
      }
      for (const [marker, fragment] of [['<!-- PAGE_HEADER -->','page-header.html'],['<!-- PAGE_FOOTER -->','page-footer.html']]) {
        if (html.includes(marker)) html = html.replace(marker, await fs.promises.readFile(path.join(root, 'home', fragment), 'utf8'));
      }
      res.writeHead(200, { ...headers, 'Content-Length': Buffer.byteLength(html) });
      res.end(req.method === 'HEAD' ? undefined : html);
    } else {
      res.writeHead(200, { ...headers, 'Content-Length': stat.size });
      if (req.method === 'HEAD') res.end();
      else fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
    }
  } catch { res.writeHead(404); res.end('Local asset unavailable'); }
});

server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`Portfolio case preview: http://127.0.0.1:${port}/`));
