/* ============================================================
   MEMENTO-STYLE GALLERY FRAMEWORK — 交互逻辑
   数据源：IndexedDB cs_characters（与 character-showcase-v2 共享）
   本地无数据时回退：localStorage → characters-data.json
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 状态 ---------- */
  let characters = [];
  let activeId = null;
  let soundOn = false;
  let currentAudio = null;
  let artFlip = false; // 双层交叉淡入切换

  const $ = (id) => document.getElementById(id);
  const artA = $('artA'), artB = $('artB');
  const selector = $('mmSelector');
  const audio = new Audio();
  audio.loop = true;
  audio.volume = 0.65;

  /* ---------- 数据加载 ---------- */
  async function loadCharacters() {
    // 1) IndexedDB（与管理页共享）
    try {
      if (window.localforage) {
        const data = await localforage.getItem('cs_characters');
        if (Array.isArray(data) && data.length) return data;
      }
    } catch (e) { /* ignore */ }

    // 2) localStorage 回退
    try {
      const raw = localStorage.getItem('cs_characters');
      if (raw) {
        const data = JSON.parse(raw);
        if (Array.isArray(data) && data.length) return data;
      }
    } catch (e) { /* ignore */ }

    // 3) 已发布 JSON（博客部署场景；file:// 下会被 CORS 拦截）
    try {
      const res = await fetch('characters-data.json', { cache: 'no-store' });
      if (res.ok) {
        const raw = await res.json();
        const data = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.characters) ? raw.characters : []);
        if (data.length) return data;
      }
    } catch (e) { /* ignore */ }

    // 4) characters-data.js 兜底（<script> 注入，file:// 本地打开也能读到）
    try {
      const payload = window.__PUBLISHED_DATA__;
      const data = Array.isArray(payload) ? payload : (payload && Array.isArray(payload.characters) ? payload.characters : []);
      if (data.length) return data;
    } catch (e) { /* ignore */ }

    return [];
  }

  /* ---------- 工具 ---------- */
  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  let toastTimer = null;
  function showToast(msg) {
    const t = $('mmToast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  /* ---------- 背景粒子 ---------- */
  function spawnParticles() {
    const wrap = $('mmParticles');
    const count = window.innerWidth < 860 ? 14 : 26;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const p = document.createElement('i');
      p.className = 'mm-particle';
      const size = 1.5 + Math.random() * 3;
      p.style.left = Math.random() * 100 + '%';
      p.style.width = size + 'px';
      p.style.height = size + 'px';
      p.style.setProperty('--drift', (Math.random() * 80 - 40) + 'px');
      p.style.animationDuration = (14 + Math.random() * 18) + 's';
      p.style.animationDelay = (-Math.random() * 20) + 's';
      frag.appendChild(p);
    }
    wrap.appendChild(frag);
  }

  /* ---------- 立绘交叉淡入 ---------- */
  function showArtwork(src) {
    const showEl = artFlip ? artA : artB;
    const hideEl = artFlip ? artB : artA;
    artFlip = !artFlip;
    showEl.src = src || '';
    showEl.classList.add('is-active');
    hideEl.classList.remove('is-active');
  }

  /* ---------- 渲染：信息区 ---------- */
  function renderInfo(ch) {
    $('charName').textContent = ch.nameJp || '';
    $('charRomaji').textContent = ch.nameRomaji || '';
    $('charQuote').textContent = ch.quote || '';

    // 渲染图小条（renders + wires）
    const strip = $('mediaStrip');
    strip.innerHTML = '';
    const media = (ch.renders || []).map(s => ({ src: s, label: 'RENDER' }))
      .concat((ch.wires || []).map(s => ({ src: s, label: 'WIREFRAME' })));

    if (!media.length) { strip.style.display = 'none'; return; }
    strip.style.display = 'flex';

    media.forEach((m, i) => {
      const btn = document.createElement('button');
      btn.className = 'mm-media-thumb' + (i === 0 ? ' is-active' : '');
      btn.title = m.label;
      btn.innerHTML = `<img src="${escHtml(m.src)}" alt="${escHtml(m.label)}" loading="lazy" />`;
      btn.addEventListener('click', () => {
        strip.querySelectorAll('.mm-media-thumb').forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        // 大图预览（简单 lightbox）
        openLightbox(m.src, m.label);
      });
      strip.appendChild(btn);
    });
  }

  /* ---------- Lightbox ---------- */
  function openLightbox(src, label) {
    const lb = document.createElement('div');
    lb.style.cssText = 'position:fixed;inset:0;z-index:50;background:rgba(4,6,10,.94);display:grid;place-items:center;cursor:zoom-out;animation:fadeIn .25s ease;';
    lb.innerHTML = `
      <img src="${escHtml(src)}" alt="${escHtml(label)}" style="max-width:92vw;max-height:88vh;object-fit:contain;filter:drop-shadow(0 20px 60px rgba(0,0,0,.8));" />
      <span style="position:absolute;top:24px;right:32px;font-family:Cinzel,serif;font-size:11px;letter-spacing:.3em;color:#c9b37e;">${escHtml(label)} &#10005;</span>`;
    lb.addEventListener('click', () => lb.remove());
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { lb.remove(); document.removeEventListener('keydown', esc); }
    });
    document.body.appendChild(lb);
  }

  /* ---------- 渲染：底部选择栏 ---------- */
  function renderSelector() {
    selector.innerHTML = '';
    characters.forEach(ch => {
      const btn = document.createElement('button');
      btn.className = 'mm-sel-btn' + (ch.id === activeId ? ' is-active' : '') + (ch.bgm ? ' has-bgm' : '');
      btn.dataset.id = ch.id;
      btn.title = ch.nameJp || '';
      btn.innerHTML = `
        <span class="mm-sel-frame"><img src="${escHtml(ch.mainImg || '')}" alt="" loading="lazy" /></span>
        <span class="mm-sel-note">&#9834;</span>
        <span class="mm-sel-name">${escHtml(ch.nameJp || 'NO NAME')}</span>`;
      btn.addEventListener('click', () => switchTo(ch.id));
      selector.appendChild(btn);
    });
    scrollActiveIntoView();
  }

  function scrollActiveIntoView() {
    const active = selector.querySelector('.mm-sel-btn.is-active');
    if (active) active.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }

  /* ---------- 切换角色 ---------- */
  function switchTo(id) {
    if (id === activeId) return;
    activeId = id;
    const ch = characters.find(c => c.id === id);
    if (!ch) return;

    showArtwork(ch.mainImg);
    renderInfo(ch);

    selector.querySelectorAll('.mm-sel-btn').forEach(b =>
      b.classList.toggle('is-active', b.dataset.id === String(id)));
    scrollActiveIntoView();

    // 重启信息区进场动画
    const info = $('mmCharInfo');
    info.style.animation = 'none';
    void info.offsetHeight;
    info.style.animation = '';

    playBGM(ch);
  }

  /* ---------- 音乐（LAMENT）---------- */
  function playBGM(ch) {
    stopAudio();
    if (soundOn && ch && ch.bgm) {
      audio.src = ch.bgm;
      audio.play().catch(() => {});
    }
  }

  function stopAudio() {
    audio.pause();
    audio.removeAttribute('src');
  }

  function setSound(on) {
    soundOn = on;
    const btn = $('soundToggle');
    btn.classList.toggle('is-on', on);
    btn.setAttribute('aria-pressed', String(on));
    $('soundLabel').textContent = on ? 'SOUND ON' : 'SOUND OFF';
    if (on) {
      const ch = characters.find(c => c.id === activeId);
      if (ch && ch.bgm) {
        audio.src = ch.bgm;
        audio.play().catch(() => {});
      } else {
        showToast(ch ? '该角色尚未设置 LAMENT（音乐）' : '请先选择角色');
        if (!ch || !ch.bgm) setSound(false);
      }
    } else {
      stopAudio();
    }
  }

  /* ---------- 已发布数据仲裁（savedAt 较新者胜出） ---------- */
  async function loadPublishedData() {
    let data = null;
    try {
      const res = await fetch('characters-data.json', { cache: 'no-store' });
      if (res.ok) data = await res.json();
    } catch (e) { /* file:// 下 fetch 被拦截，走 js 兜底 */ }
    if (!data) data = window.__PUBLISHED_DATA__ || null;
    if (!data || !Array.isArray(data.characters) || !data.characters.length) return;
    let localSavedAt = 0;
    try { localSavedAt = (await localforage.getItem('cs_savedAt')) || 0; } catch (e) { /* ignore */ }
    if ((data.savedAt || 0) > localSavedAt) {
      characters = data.characters;
      try {
        await localforage.setItem('cs_characters', characters);
        await localforage.setItem('cs_savedAt', data.savedAt || Date.now());
      } catch (e) { /* ignore */ }
    }
  }

  /* ---------- 发布导出 ---------- */
  function bindExportButton() {
    const btn = $('exportDataBtn');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      if (!characters.length) { showToast('暂无角色数据可导出'); return; }
      const payload = { savedAt: Date.now(), characters };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'characters-data.json';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
      try { await localforage.setItem('cs_savedAt', payload.savedAt); } catch (e) { /* ignore */ }
      showToast('已导出 characters-data.json — 上传到 source/characters/ 即可发布');
    });
  }

  /* ---------- BGM 上传（存入 IndexedDB，与管理页共享数据） ---------- */
  async function saveBgm(id, dataUrl) {
    try {
      const data = (window.localforage)
        ? (await localforage.getItem('cs_characters')) || []
        : JSON.parse(localStorage.getItem('cs_characters') || '[]');
      const target = data.find(c => c.id === id);
      if (!target) return false;
      target.bgm = dataUrl;
      if (window.localforage) await localforage.setItem('cs_characters', data);
      localStorage.setItem('cs_characters', JSON.stringify(data));
      try { await localforage.setItem('cs_savedAt', Date.now()); } catch (e) { /* ignore */ }
      characters = data;
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  function bindBgmUpload() {
    $('bgmUploadBtn').addEventListener('click', () => {
      if (activeId === null) { showToast('请先选择角色'); return; }
      $('bgmInput').click();
    });
    $('bgmInput').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file || activeId === null) return;
      if (file.size > 8 * 1024 * 1024) { showToast('音频过大（>8MB），请压缩后再试'); return; }
      const reader = new FileReader();
      reader.onload = async () => {
        const ok = await saveBgm(activeId, reader.result);
        showToast(ok ? 'LAMENT 已设置 ♪' : '保存失败');
        if (ok) {
          selector.querySelectorAll('.mm-sel-btn').forEach(b => {
            if (b.dataset.id === String(activeId)) b.classList.add('has-bgm');
          });
          const ch = characters.find(c => c.id === activeId);
          if (soundOn) playBGM(ch);
        }
      };
      reader.readAsDataURL(file);
    });
  }

  /* ---------- 选择栏左右箭头 + 拖拽 ---------- */
  function bindSelectorNav() {
    const step = () => selector.clientWidth * 0.6;
    $('selArrowL').addEventListener('click', () => selector.scrollBy({ left: -step(), behavior: 'smooth' }));
    $('selArrowR').addEventListener('click', () => selector.scrollBy({ left: step(), behavior: 'smooth' }));

    // 鼠标横向拖拽
    let isDown = false, startX = 0, startScroll = 0, dragged = false;
    selector.addEventListener('pointerdown', (e) => {
      isDown = true; dragged = false;
      startX = e.clientX; startScroll = selector.scrollLeft;
    });
    window.addEventListener('pointermove', (e) => {
      if (!isDown) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 6) dragged = true;
      selector.scrollLeft = startScroll - dx;
    });
    window.addEventListener('pointerup', () => { isDown = false; });
    selector.addEventListener('click', (e) => { if (dragged) { e.stopPropagation(); e.preventDefault(); dragged = false; } }, true);
  }

  /* ---------- 键盘导航 ---------- */
  function bindKeyboard() {
    document.addEventListener('keydown', (e) => {
      if (e.target.matches('input, textarea')) return;
      const idx = characters.findIndex(c => c.id === activeId);
      if (e.key === 'ArrowLeft' && idx > 0) switchTo(characters[idx - 1].id);
      if (e.key === 'ArrowRight' && idx < characters.length - 1) switchTo(characters[idx + 1].id);
    });
  }

  /* ---------- 初始化 ---------- */
  async function init() {
    spawnParticles();

    characters = await loadCharacters();
    await loadPublishedData(); // 已发布数据较新时覆盖本地

    if (!characters.length) {
      $('mmEmpty').hidden = false;
      return;
    }

    activeId = characters[0].id;
    showArtwork(characters[0].mainImg);
    renderInfo(characters[0]);
    renderSelector();
    bindBgmUpload();
    bindExportButton();
    bindSelectorNav();
    bindKeyboard();

    $('soundToggle').addEventListener('click', () => setSound(!soundOn));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
