import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { setupScrollReveal } from './scroll-reveal.js';
import { prepareBrand } from '/home/brand.js';

setupScrollReveal();
prepareBrand();

const $ = id => document.getElementById(id);
const panel = $('showcasePanel');
const viewport = $('modelCanvas');
const modeButtons = [...document.querySelectorAll('[data-mode][role="tab"]')];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const state = { mode: 'pair', split: 50, ready: false, rotating: false, frames: 0, loading: false };
const records = [];
let renderer, camera, controls, scene, vrm, bounds, height, matcap, viewSpan = 1, frameRequest = 0, lastTime = 0;
let headPosition = new THREE.Vector3();
let center = new THREE.Vector3();

function icons() { window.lucide?.createIcons(); }
icons();
window.addEventListener('load', icons, { once: true });

function setMode(mode, updateUrl = true) {
  state.mode = mode;
  panel.dataset.mode = mode;
  modeButtons.forEach(button => {
    const selected = button.dataset.mode === mode;
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
  });
  panel.setAttribute('aria-labelledby', `mode-${mode}`);
  $('comparisonOverlay').hidden = mode !== 'compare';
  $('splitRange').hidden = mode !== 'compare';
  $('modelCaption').textContent = mode === 'compare' ? '白模 / 基础贴图' : '3D 模型';
  if (updateUrl) {
    const url = new URL(location.href);
    url.searchParams.set('mode', mode);
    history.replaceState(null, '', url);
  }
  if (renderer) resize();
}

modeButtons.forEach((button, index) => {
  button.addEventListener('click', () => setMode(button.dataset.mode));
  button.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? modeButtons.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + modeButtons.length) % modeButtons.length;
    setMode(modeButtons[next].dataset.mode);
    modeButtons[next].focus();
  });
});

function setSplit(value) {
  state.split = THREE.MathUtils.clamp(Number(value), 0, 100);
  $('splitRange').value = String(Math.round(state.split));
  $('splitRange').setAttribute('aria-valuetext', `白模 ${Math.round(state.split)}%，贴图 ${Math.round(100 - state.split)}%`);
  $('comparisonOverlay').style.setProperty('--split', `${state.split}%`);
  requestFrame();
}
$('splitRange').addEventListener('input', event => setSplit(event.target.value));
const splitLine = $('splitLine');
function splitFromPointer(event) {
  const rect = viewport.getBoundingClientRect();
  setSplit((event.clientX - rect.left) / rect.width * 100);
}
splitLine.addEventListener('pointerdown', event => {
  if (event.button !== 0) return;
  event.preventDefault();
  event.stopPropagation();
  splitLine.setPointerCapture(event.pointerId);
  splitFromPointer(event);
});
splitLine.addEventListener('pointermove', event => {
  if (splitLine.hasPointerCapture(event.pointerId)) splitFromPointer(event);
});
splitLine.addEventListener('pointerup', event => {
  if (splitLine.hasPointerCapture(event.pointerId)) splitLine.releasePointerCapture(event.pointerId);
});

function setAngle(angle) {
  $('referenceCrop').dataset.angle = angle;
  const labels = { front: '正面', side: '侧面', back: '背面' };
  $('referenceImage').alt = `Sumi 角色设定图${labels[angle]}`;
  document.querySelectorAll('[data-angle][aria-pressed]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.angle === angle)));
  if (state.ready) {
    setRotating(false);
    const damping = controls.enableDamping;
    // Drain pending orbit/pan inertia before restoring a precise full-body view.
    controls.enableDamping = false;
    controls.update();
    controls.reset();
    controls.enableDamping = damping;
    frameView('full', { front: 0, side: Math.PI / 2, back: Math.PI }[angle]);
  }
}
document.querySelectorAll('[data-angle][aria-pressed]').forEach(button => button.addEventListener('click', () => setAngle(button.dataset.angle)));

$('openReference').addEventListener('click', () => $('referenceDialog').showModal());
$('closeReference').addEventListener('click', () => $('referenceDialog').close());
$('referenceDialog').addEventListener('click', event => { if (event.target === event.currentTarget) event.currentTarget.close(); });
$('referenceImage').addEventListener('error', () => {
  $('referenceImage').hidden = true;
  $('referenceCrop').textContent = '参考立绘暂未提供';
  $('openReference').disabled = true;
});

const motion = { ready: false, loading: false, playing: !reducedMotion.matches, visible: false, url: '', still: '' };
function syncMotion() {
  if (!motion.ready) return;
  const active = motion.playing && !document.hidden && (motion.visible || $('motionDialog').open);
  const source = active ? motion.url : motion.still;
  for (const id of ['motionImage', 'motionDialogImage']) {
    if ($(id).getAttribute('src') !== source) $(id).src = source;
  }
  for (const id of ['motionPlay', 'motionDialogPlay']) {
    const button = $(id);
    button.title = motion.playing ? '停止动态展示' : '播放动态展示';
    button.setAttribute('aria-label', button.title);
    button.setAttribute('aria-pressed', String(motion.playing));
    const icon = document.createElement('i');
    icon.dataset.lucide = motion.playing ? 'square' : 'play';
    icon.setAttribute('aria-hidden', 'true');
    button.replaceChildren(icon);
  }
  icons();
}
async function loadMotion() {
  if (motion.loading) return;
  motion.loading = true;
  $('motionRetry').hidden = true;
  $('motionStatus').hidden = false;
  $('motionStatus').textContent = '正在加载动态展示';
  let url;
  try {
    const response = await fetch('/asset/motion.gif');
    if (!response.ok) throw new Error('Motion unavailable');
    url = URL.createObjectURL(await response.blob());
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    // Native GIF playback has no pause API; stopped/reduced-motion views use its still frame.
    canvas.getContext('2d').drawImage(image, 0, 0);
    motion.still = canvas.toDataURL('image/png');
    if (motion.url) URL.revokeObjectURL(motion.url);
    motion.url = url;
    motion.ready = true;
    $('motionImage').hidden = false;
    $('motionStatus').hidden = true;
    $('motionPlay').disabled = false;
    $('motionExpand').disabled = false;
    syncMotion();
  } catch {
    if (url) URL.revokeObjectURL(url);
    $('motionStatus').textContent = '动态展示暂时无法加载';
    $('motionRetry').hidden = false;
  } finally { motion.loading = false; }
}
for (const id of ['motionPlay', 'motionDialogPlay']) $(id).addEventListener('click', () => {
  motion.playing = !motion.playing;
  syncMotion();
});
$('motionRetry').addEventListener('click', loadMotion);
$('motionExpand').addEventListener('click', () => { $('motionDialog').showModal(); syncMotion(); });
$('closeMotion').addEventListener('click', () => $('motionDialog').close());
$('motionDialog').addEventListener('close', syncMotion);
$('motionDialog').addEventListener('click', event => { if (event.target === event.currentTarget) event.currentTarget.close(); });
new IntersectionObserver(([entry]) => { motion.visible = entry.isIntersecting; syncMotion(); }).observe($('motionImage'));
document.addEventListener('visibilitychange', syncMotion);
reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) { motion.playing = false; syncMotion(); } });
loadMotion();

function requestFrame() {
  if (!renderer || frameRequest || document.hidden) return;
  frameRequest = requestAnimationFrame(animate);
}

function applyMaterials(kind) {
  for (const record of records) record.mesh.material = record[kind];
}

function renderScene() {
  if (!state.ready) return;
  renderer.setScissorTest(false);
  renderer.clear();
  if (state.mode === 'compare') {
    const width = viewport.clientWidth, h = viewport.clientHeight;
    const split = Math.round(width * state.split / 100);
    // Two material passes share the same mesh, camera, pose, and full viewport.
    renderer.setScissorTest(true);
    applyMaterials('clay');
    if (split > 0) { renderer.setScissor(0, 0, split, h); renderer.render(scene, camera); }
    applyMaterials('base');
    if (split < width) { renderer.setScissor(split, 0, width - split, h); renderer.render(scene, camera); }
    renderer.setScissorTest(false);
    applyMaterials('base');
  } else {
    applyMaterials('base');
    renderer.render(scene, camera);
  }
}

function animate(time) {
  frameRequest = 0;
  const delta = Math.min((time - lastTime) / 1000 || 0, .05);
  lastTime = time;
  controls.autoRotate = state.rotating;
  const changed = controls.update(delta);
  // Update posed bones without introducing simulation drift between passes.
  if (vrm) { vrm.humanoid.update(); vrm.scene.updateMatrixWorld(true); }
  renderScene();
  state.frames++;
  if (state.rotating || changed) requestFrame();
}

function resize() {
  if (!renderer) return;
  const width = Math.max(1, viewport.clientWidth), h = Math.max(1, viewport.clientHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.setSize(width, h, false);
  camera.aspect = width / h;
  updateProjection();
  requestFrame();
}

function updateProjection() {
  const span = viewSpan * 1.09 * Math.max(1, .47 / camera.aspect);
  camera.top = span / 2;
  camera.bottom = -span / 2;
  camera.left = -span * camera.aspect / 2;
  camera.right = span * camera.aspect / 2;
  camera.updateProjectionMatrix();
}

function frameView(view, angle = 0) {
  const target = view === 'face' ? headPosition.clone() : center.clone();
  let span = height;
  if (view === 'face') { span = height * .3; target.y += height * .02; }
  if (view === 'outfit') { span = height * .6; target.y = bounds.min.y + height * .55; }
  viewSpan = span;
  camera.zoom = 1;
  updateProjection();
  const distance = height * 3;
  controls.target.copy(target);
  camera.position.set(target.x + Math.sin(angle) * distance, target.y, target.z + Math.cos(angle) * distance);
  camera.lookAt(target);
  controls.minZoom = .5;
  controls.maxZoom = 5;
  controls.update();
  requestFrame();
}

function materialVariants(original) {
  const common = { map: original.map || null, side: original.side, transparent: original.transparent, opacity: original.opacity, alphaTest: original.alphaTest, depthWrite: original.depthWrite };
  const base = new THREE.MeshBasicMaterial({ ...common, color: 0xffffff });
  const clay = new THREE.MeshMatcapMaterial({ ...common, matcap, color: 0xffffff });
  // Keep texture alpha for lashes and cutouts while removing its RGB for a true clay pass.
  clay.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb = vec3(1.0);');
  };
  clay.customProgramCacheKey = () => 'megumi-matcap-alpha-v1';
  if (original.isOutline) { base.visible = false; clay.visible = false; }
  return { base, clay };
}

function captureDetails() {
  const position = camera.position.clone(), target = controls.target.clone();
  const oldAspect = camera.aspect;
  const oldSpan = viewSpan, oldZoom = camera.zoom;
  const w = viewport.clientWidth, h = viewport.clientHeight;
  const shots = [['detailFace', 'face', 0], ['detailOutfit', 'outfit', .22], ['detailBack', 'full', Math.PI]];
  renderer.setSize(640, 480, false);
  camera.aspect = 4 / 3;
  camera.updateProjectionMatrix();
  applyMaterials('base');
  for (const [id, view, angle] of shots) {
    frameView(view, angle);
    renderer.setScissorTest(false);
    renderer.clear();
    renderer.render(scene, camera);
    $(id).src = renderer.domElement.toDataURL('image/png');
    $(id).hidden = false;
  }
  renderer.setSize(w, h, false);
  camera.aspect = oldAspect;
  viewSpan = oldSpan;
  camera.zoom = oldZoom;
  updateProjection();
  camera.position.copy(position);
  controls.target.copy(target);
  controls.update();
  requestFrame();
}

function setRotating(value) {
  state.rotating = value;
  if (controls) controls.autoRotate = value;
  $('autoRotate').setAttribute('aria-pressed', String(value));
  $('autoRotate').title = value ? '暂停自动旋转' : '自动旋转';
  $('autoRotate').setAttribute('aria-label', $('autoRotate').title);
  requestFrame();
}
$('autoRotate').addEventListener('click', () => setRotating(!state.rotating));
$('resetView').addEventListener('click', () => { setRotating(false); setAngle('front'); });
$('fullscreen').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.querySelector('.model-figure').requestFullscreen();
  } catch { $('fullscreen').title = '浏览器暂不支持全屏'; }
});
document.addEventListener('fullscreenchange', () => {
  $('fullscreen').setAttribute('aria-pressed', String(Boolean(document.fullscreenElement)));
  requestAnimationFrame(resize);
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) { lastTime = performance.now(); requestFrame(); } });
reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) setRotating(false); });
async function loadModel() {
  if (state.loading) return;
  state.loading = true;
  $('retryModel').hidden = true;
  $('loadState').classList.remove('is-error');
  $('loadText').textContent = '正在加载模型';
  $('loadProgress').value = 0;
  try {
    if (!matcap) {
      matcap = await new THREE.TextureLoader().loadAsync('/asset/matcap.png');
      matcap.colorSpace = THREE.SRGBColorSpace;
    }
    const loader = new GLTFLoader();
    loader.register(parser => new VRMLoaderPlugin(parser));
    const gltf = await loader.loadAsync(document.body.dataset.modelUrl || '/asset/model.vrm', progress => {
      if (progress.total) {
        const value = Math.round(progress.loaded / progress.total * 100);
        $('loadProgress').value = value;
        $('loadText').textContent = value >= 100 ? '正在准备材质' : `正在加载模型 ${value}%`;
      }
    });
    vrm = gltf.userData.vrm;
    const modelScene = vrm?.scene || gltf.scene;
    if (vrm) {
      VRMUtils.rotateVRM0(vrm);
      vrm.humanoid.setNormalizedPose({
        leftUpperArm: { rotation: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 1.02).toArray() },
        rightUpperArm: { rotation: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -1.02).toArray() }
      });
      vrm.humanoid.update();
    }
    scene.add(modelScene);
    modelScene.updateMatrixWorld(true);
    modelScene.traverse(mesh => {
      if (!mesh.isMesh) return;
      mesh.frustumCulled = false;
      const original = mesh.material;
      const materials = Array.isArray(original) ? original : [original];
      const variants = materials.map(materialVariants);
      records.push({ mesh, original, base: Array.isArray(original) ? variants.map(x => x.base) : variants[0].base, clay: Array.isArray(original) ? variants.map(x => x.clay) : variants[0].clay });
    });
    bounds = new THREE.Box3().setFromObject(modelScene);
    height = bounds.max.y - bounds.min.y;
    center = bounds.getCenter(new THREE.Vector3());
    if (vrm) vrm.humanoid.getNormalizedBoneNode('head').getWorldPosition(headPosition);
    else {
      const display = modelScene.getObjectByName('SumiDisplay');
      if (display?.userData.previewHead) headPosition.fromArray(display.userData.previewHead);
      else headPosition.set(center.x, bounds.min.y + height * .9, center.z);
    }
    const metadata = gltf.parser.json;
    const triangles = metadata.meshes.reduce((sum, mesh) => sum + mesh.primitives.reduce((n, primitive) => n + (metadata.accessors[primitive.indices]?.count || 0) / 3, 0), 0);
    $('triangleCount').textContent = triangles.toLocaleString('en-US');
    state.ready = true;
    viewport.dataset.ready = 'true';
    $('loadState').hidden = true;
    $('liveLabel').hidden = false;
    ['autoRotate', 'resetView', 'fullscreen'].forEach(id => { $(id).disabled = false; });
    if (!document.querySelector('.model-figure').requestFullscreen) $('fullscreen').hidden = true;
    resize();
    frameView('full');
    captureDetails();
    controls.saveState();
    requestFrame();
  } catch (error) {
    console.error('Model preview failed:', error);
    $('loadState').classList.add('is-error');
    $('loadText').textContent = '模型暂时无法加载';
    $('retryModel').hidden = false;
  } finally { state.loading = false; }
}

function setupRenderer() {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setClearColor(0xf5f4f7);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.autoClear = false;
  renderer.domElement.setAttribute('aria-label', 'Sumi 可交互三维模型');
  renderer.domElement.tabIndex = 0;
  viewport.prepend(renderer.domElement);
  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .01, 100);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = .12;
  controls.autoRotateSpeed = 1.1;
  controls.enablePan = true;
  controls.zoomToCursor = true;
  controls.minPolarAngle = Math.PI * .12;
  controls.maxPolarAngle = Math.PI * .88;
  controls.addEventListener('change', requestFrame);
  controls.addEventListener('start', () => setRotating(false));
  renderer.domElement.addEventListener('keydown', event => {
    if (!state.ready) return;
    if (['ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault();
      const offset = camera.position.clone().sub(controls.target);
      offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), event.key === 'ArrowLeft' ? -.1 : .1);
      camera.position.copy(controls.target).add(offset);
      controls.update();
      requestFrame();
    }
    if (event.key === 'Home') { event.preventDefault(); setRotating(false); setAngle('front'); }
  });
  renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    setRotating(false);
    $('loadState').hidden = false;
    $('loadState').classList.add('is-error');
    $('loadText').textContent = '图形上下文中断，请刷新页面';
  });
  new ResizeObserver(resize).observe(viewport);
  resize();
}

const initialMode = new URLSearchParams(location.search).get('mode');
if (['pair', 'compare'].includes(initialMode)) setMode(initialMode, false);
if (initialMode === 'model') setMode('pair');
try { setupRenderer(); loadModel(); }
catch (error) {
  console.error('WebGL unavailable:', error);
  $('loadState').classList.add('is-error');
  $('loadText').textContent = '当前浏览器暂不支持三维展示';
}
$('retryModel').addEventListener('click', loadModel);

// Read-only inspection data used by the local interaction regression tests.
window.casePreview = {
  get state() { return { ...state }; },
  get camera() { return camera ? camera.position.toArray() : null; },
  get zoom() { return camera?.zoom; },
  get target() { return controls?.target.toArray(); },
  get projection() { return camera?.type; },
  pointAt(x, y) { return new THREE.Vector3(x, y, 0).unproject(camera).toArray(); },
  projectPoint(point) { return new THREE.Vector3().fromArray(point).project(camera).toArray(); },
  snapshot() { renderScene(); return renderer?.domElement.toDataURL('image/png'); }
};
