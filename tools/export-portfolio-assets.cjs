const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const preview = path.join(root, 'preview/portfolio-case');
const output = path.join(root, 'portfolio-assets');
const base = process.env.PREVIEW_URL || 'http://127.0.0.1:4002';
const { chromium } = require(require.resolve('playwright', {
  paths: [path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')]
}));

async function main() {
  const local = JSON.parse(await fs.readFile(path.join(preview, '.local.json'), 'utf8'));
  const copies = {
    'home/assets/header-art.jpg': local.homeBackground,
    'home/assets/about-portrait.jpg': local.homePortrait,
    'home/assets/brand.png': path.join(preview, '.local-assets/megumi-brand-source.png'),
    'home/assets/sumi-full.png': path.join(preview, '.local-assets/sumi-full.png'),
    'home/assets/sumi-portrait.png': path.join(preview, '.local-assets/sumi-portrait.png'),
    'home/assets/sumi-clay.png': path.join(preview, '.local-assets/sumi-clay.png'),
    'asset/reference.png': local.reference,
    'asset/motion.gif': local.motion,
    'asset/matcap.png': local.matcap
  };
  for (const [relative, source] of Object.entries(copies)) {
    const destination = path.join(output, relative);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.copyFile(source, destination);
  }
  const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ acceptDownloads: true });
    await page.goto(`${base}/models/sumi/`, { waitUntil: 'domcontentloaded' });
    const downloadPromise = page.waitForEvent('download', { timeout: 180000 });
    await page.evaluate(async () => {
      const THREE = await import('three');
      const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
      const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
      const { VRMLoaderPlugin, VRMUtils } = await import('@pixiv/three-vrm');
      const loader = new GLTFLoader();
      loader.register(parser => new VRMLoaderPlugin(parser));
      const loaded = await loader.loadAsync('/asset/model.vrm');
      const vrm = loaded.userData.vrm;
      VRMUtils.rotateVRM0(vrm);
      vrm.humanoid.setNormalizedPose({
        leftUpperArm: { rotation: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 1.02).toArray() },
        rightUpperArm: { rotation: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -1.02).toArray() }
      });
      vrm.humanoid.update();
      vrm.scene.updateMatrixWorld(true);
      const head = new THREE.Vector3();
      vrm.humanoid.getNormalizedBoneNode('head').getWorldPosition(head);
      let index = 0;
      // Export a neutral display, without VRM metadata, expression targets, or animation clips.
      vrm.scene.traverse(node => {
        node.name = `display-${index++}`;
        node.userData = {};
        if (!node.isMesh) return;
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        if (materials.every(material => material.isOutline)) { node.visible = false; return; }
        const mapped = materials.map(original => new THREE.MeshBasicMaterial({
          map: original.map, color: 0xffffff, side: original.side,
          transparent: original.transparent, opacity: original.opacity,
          alphaTest: original.alphaTest, depthWrite: original.depthWrite
        }));
        node.material = Array.isArray(node.material) ? mapped : mapped[0];
        node.geometry = node.geometry.clone();
        node.geometry.name = '';
        node.geometry.userData = {};
        node.geometry.morphAttributes = {};
        node.morphTargetDictionary = undefined;
        node.morphTargetInfluences = undefined;
      });
      vrm.scene.name = 'SumiDisplay';
      vrm.scene.userData = { previewHead: head.toArray() };
      const data = await new GLTFExporter().parseAsync(vrm.scene, {
        binary: true, onlyVisible: true, maxTextureSize: 2048, animations: []
      });
      const url = URL.createObjectURL(new Blob([data], { type: 'model/gltf-binary' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'sumi-display.glb';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    });
    await (await downloadPromise).saveAs(path.join(output, 'asset/sumi-display.glb'));
  } finally { await browser.close(); }
  const bytes = await fs.readFile(path.join(output, 'asset/sumi-display.glb'));
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
  const json = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
  assert.ok(!JSON.stringify(json).includes('VRM'), 'VRM metadata must not be exported');
  assert.ok(!json.animations?.length, 'No animation clips in public display');
  assert.ok(json.meshes.every(mesh => mesh.primitives.every(primitive => !primitive.targets)));
  assert.ok(bytes.length < 45 * 1024 * 1024, 'Display asset exceeds publishing budget');
  console.log(`Exported self-contained display GLB: ${(bytes.length / 1024 / 1024).toFixed(2)} MiB`);
  console.log(`Public display assets: ${output}`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
