const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const frontMatter = require('hexo-front-matter');
const { marked } = require('marked');

const root = path.resolve(__dirname, '..');
const preview = path.join(root, 'preview/portfolio-case');
const output = path.join(root, 'public');
const read = relative => fs.readFileSync(path.join(preview, relative), 'utf8');
const modelConfig = JSON.parse(fs.readFileSync(path.join(root, 'portfolio-assets/model-view.json'), 'utf8'));
if (modelConfig.version !== 1 || modelConfig.algorithm !== 'AES-GCM' || !/^\/asset\/sumi-display\.[a-f0-9]{16}\.enc$/.test(modelConfig.url) || Buffer.from(modelConfig.key, 'base64').length !== 32) {
  throw new Error('Invalid encrypted model configuration.');
}
const modelCipher = fs.readFileSync(path.join(root, 'portfolio-assets', modelConfig.url.slice(1)));
if (modelCipher.length !== modelConfig.bytes || crypto.createHash('sha256').update(modelCipher).digest('hex') !== modelConfig.sha256) {
  throw new Error('Encrypted model file and display configuration do not match.');
}

function write(relative, content) {
  const destination = path.join(output, relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, content);
}

const pages = {
  'index.html': 'home/frame.html',
  'home/index.html': 'home/frame.html',
  'models/index.html': 'models/index.html',
  'models/sumi/index.html': 'index.html',
  'commission/index.html': 'commission/index.html',
  'news/index.html': 'home/news.html',
  'about/index.html': 'home/about.html',
  'archive/index.html': 'home/archive.html',
  'home/journal/index.html': 'home/journal.html'
};
const fragments = {
  '<!-- MODEL_COLLECTION -->': read('models/collection.html'),
  '<!-- PAGE_HEADER -->': read('home/page-header.html'),
  '<!-- PAGE_FOOTER -->': read('home/page-footer.html')
};
for (const [destination, source] of Object.entries(pages)) {
  let html = read(source).replace(/\s*<meta name="robots" content="noindex,\s*nofollow"\s*\/?>/g, '');
  for (const [marker, fragment] of Object.entries(fragments)) html = html.replaceAll(marker, fragment);
  if (destination === 'models/sumi/index.html') {
    const config = JSON.stringify(modelConfig).replaceAll('<', '\\u003c');
    html = html.replace('<body>', `<body data-model-storage="encrypted">\n  <script id="modelAccess" type="application/json">${config}</script>`)
      .replace('本地测试案例', 'VTuber / 角色模型')
      .replace('网页测试格式', '网页展示格式').replace('VRM 0.x', 'GLB');
  }
  const canonical = 'https://dongyunmegumi.github.io/' + destination.replace(/index\.html$/, '');
  html = html.replace('</head>', `  <link rel="canonical" href="${canonical}">\n</head>`);
  write(destination, html);
}
const files = [
  'style.css', 'viewer.js', 'model-crypto.js', 'scroll-reveal.js',
  'home/style.css', 'home/frame.css', 'home/frame.js', 'home/brand.css', 'home/brand.js',
  'home/type.css', 'home/pages.css', 'home/pages.js', 'home/journal.js',
  'home/fonts/jost.woff2', 'home/fonts/noto-sans-jp.woff2', 'home/fonts/noto-sans-sc.woff2',
  'models/style.css', 'models/models.js', 'models/collection.js',
  'models/nameplate-top.svg', 'models/nameplate-bottom.svg', 'models/portrait-panel.svg', 'models/portrait-art-mask.svg',
  'commission/style.css', 'commission/commission.js'
];
for (const file of files) write(file, fs.readFileSync(path.join(preview, file)));

// Only these reviewed display assets are published; never copy the preview's local directory.
const assets = [
  'home/assets/header-art.jpg', 'home/assets/about-portrait.jpg', 'home/assets/brand.png',
  'home/assets/sumi-full.png', 'home/assets/sumi-portrait.png', 'home/assets/sumi-clay.png',
  'asset/reference.png', 'asset/motion.gif', 'asset/matcap.png', modelConfig.url.slice(1)
];
for (const file of assets) write(file, fs.readFileSync(path.join(root, 'portfolio-assets', file)));
// Retire the old plain model endpoint on incremental builds as well as clean builds.
for (const file of ['asset/sumi-display.glb', 'asset/model.vrm']) fs.rmSync(path.join(output, file), { force: true });

const vendor = path.join(preview, 'node_modules');
for (const directory of ['build', 'examples/jsm']) {
  fs.cpSync(path.join(vendor, 'three', directory), path.join(output, 'vendor/three', directory), { recursive: true });
}
write('vendor/three-vrm.js', fs.readFileSync(path.join(vendor, '@pixiv/three-vrm/lib/three-vrm.module.min.js')));
write('vendor/three/LICENSE', fs.readFileSync(path.join(vendor, 'three/LICENSE')));
write('vendor/three-vrm-LICENSE', fs.readFileSync(path.join(vendor, '@pixiv/three-vrm/LICENSE')));
for (const slug of ['hello-portfolio', 'blender-bmesh-free']) {
  const article = frontMatter.parse(fs.readFileSync(path.join(root, 'source/_posts', slug + '.md'), 'utf8'));
  write(`home/post/${slug}.json`, JSON.stringify({ title: article.title, html: marked.parse(article._content) }));
}
write('.nojekyll', '');
function assertNoPlainModels(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) assertNoPlainModels(file);
    else if (/\.(glb|gltf|vrm|fbx|blend)$/i.test(entry.name)) {
      throw new Error(`Plain model must not be published: ${path.relative(output, file)}`);
    }
  }
}
assertNoPlainModels(output);
console.log(`Published ${Object.keys(pages).length} portfolio pages with an encrypted display model; no plain model endpoint.`);
