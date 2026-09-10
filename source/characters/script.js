/* ============================================
   Character Showcase V2 — 主脚本
   karia × Heaven Burns Red 融合风格
   功能：IndexedDB存储 / 卡片切换 / 图片上传裁剪压缩 / Lightbox / 粒子Hero
   ============================================ */

(function () {
  'use strict';

  /* ============ 默认数据 ============ */
  const DEFAULTS = [
    {
      id: 0,
      nameJp: 'キャラクター01',
      nameRomaji: 'CHARACTER 01',
      quote: 'ここに台詞を入力してください',
      tags: ['3D Model', 'Next-Gen'],
      desc: '角色设计理念与特点描述。可填写角色的创作背景、设计亮点和制作心得。',
      story: '在此处填写角色的背景故事或设计说明。',
      renders: [],
      wires: [],
      tech: { poly: '12,580', verts: '6,290', tool: 'Blender / ZBrush', style: '二次元 / 卡通' },
      mainImg: 'assets/images/char-01.png'
    },
    {
      id: 1,
      nameJp: 'キャラクター02',
      nameRomaji: 'CHARACTER 02',
      quote: 'ここに台詞を入力してください',
      tags: ['3D Model', 'Realistic'],
      desc: '角色设计理念与特点描述。可填写角色的创作背景、设计亮点和制作心得。',
      story: '在此处填写角色的背景故事或设计说明。',
      renders: [],
      wires: [],
      tech: { poly: '15,200', verts: '7,600', tool: 'Maya / ZBrush', style: '写实 / 影视级' },
      mainImg: 'assets/images/char-02.jpg'
    },
    {
      id: 2,
      nameJp: 'キャラクター03',
      nameRomaji: 'CHARACTER 03',
      quote: 'ここに台詞を入力してください',
      tags: ['3D Model', 'Stylized'],
      desc: '角色设计理念与特点描述。可填写角色的创作背景、设计亮点和制作心得。',
      story: '在此处填写角色的背景故事或设计说明。',
      renders: [],
      wires: [],
      tech: { poly: '10,800', verts: '5,400', tool: 'Blender / Substance', style: '风格化' },
      mainImg: 'assets/images/char-03.png'
    }
  ];

  let characters = [];
  let nextId = 0;
  let activeCharId = null;

  /* ============ 初始化 ============ */
  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    // 首屏先渲染，避免存储异常导致空白
    try {
      await migrateFromLocalStorage();
      characters = await loadData();
    } catch (e) { characters = []; }
    if (!Array.isArray(characters) || characters.length === 0) {
      characters = JSON.parse(JSON.stringify(DEFAULTS));
    }
    // 补全旧数据缺少的 quote 字段
    characters.forEach(ch => { if (!ch.quote) ch.quote = ''; });
    nextId = characters.length > 0 ? Math.max(...characters.map(c => c.id)) + 1 : 0;
    activeCharId = characters.length > 0 ? characters[0].id : null;

    renderAllCharacters();
    bindHeroUpload();
    bindLightbox();
    bindAddCharacter();
    bindNavScroll();
    bindContentEditableSave();
    bindAboutUpload();
    bindCropModal();
    initHeroParticles();
    bindExportButton();

    // 异步合并线上已发布数据（不阻塞首屏）
    loadPublishedData().then(mergePublished).catch(() => {});

    try {
      const savedHero = await localforage.getItem('cs_heroBg');
      if (savedHero) {
        const el = document.getElementById('heroBgImg');
        if (el) el.style.backgroundImage = `url(${savedHero})`;
      }
    } catch (e) { /* ignore */ }
  }

  /* ============ 异步兜底：任何存储操作卡住都不阻塞渲染 ============ */
  function withTimeout(promise, ms, fallback) {
    return Promise.race([
      Promise.resolve(promise).catch(() => fallback),
      new Promise(res => setTimeout(() => res(fallback), ms))
    ]);
  }


  /* ============ 已发布数据（characters-data.json，博客部署） ============ */
  async function loadPublishedData() {
    try {
      const res = await withTimeout(fetch('characters-data.json', { cache: 'no-store' }), 4000, null);
      if (!res || !res.ok) return;
      const data = await res.json();
      if (!data || !Array.isArray(data.characters) || data.characters.length === 0) return;
      let localSavedAt = 0;
      try { localSavedAt = (await withTimeout(localforage.getItem('cs_savedAt'), 1500, 0)) || 0; } catch (e) { /* ignore */ }
      if ((data.savedAt || 0) > localSavedAt) {
        characters = data.characters;
        try {
          await withTimeout(localforage.setItem('cs_characters', characters), 2000, null);
          await withTimeout(localforage.setItem('cs_savedAt', data.savedAt || Date.now()), 1500, null);
        } catch (e) { /* ignore */ }
      }
    } catch (e) { /* 无已发布数据，忽略 */ }
  }

  /* ============ 导出发布数据 ============ */
  function bindExportButton() {
    document.getElementById('exportDataBtn')?.addEventListener('click', async function () {
      if (characters.length === 0) { showToast('暂无角色数据可导出', 'warning'); return; }
      const payload = { savedAt: Date.now(), characters };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'characters-data.json';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
      try { await withTimeout(localforage.setItem('cs_savedAt', payload.savedAt), 1500, null); } catch (e) { /* ignore */ }
      showToast('已导出 characters-data.json — 上传到 source/characters/ 即可发布', 'success');
    });
  }

  /* ============ IndexedDB ============ */
  async function loadData() {
    try {
      const data = await withTimeout(localforage.getItem('cs_characters'), 2500, null);
      if (data) return data;
    } catch (e) { /* fallback */ }
    try {
      const raw = localStorage.getItem('cs_characters');
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    return [];
  }

  async function saveData() {
    try {
      await localforage.setItem('cs_characters', characters);
      showToast('已保存', 'success');
    } catch (e) {
      try {
        localStorage.setItem('cs_characters', JSON.stringify(characters));
        showToast('已保存（图片未保存）', 'warning');
      } catch (e2) {
        showToast('保存失败：图片过大', 'error');
      }
    }
  }

  async function migrateFromLocalStorage() {
    try {
      const already = await withTimeout(localforage.getItem('cs_migrated'), 1500, null);
      if (already) return;
      const raw = localStorage.getItem('cs_characters');
      if (raw) {
        await withTimeout(localforage.setItem('cs_characters', JSON.parse(raw)), 2000, null);
      }
      await withTimeout(localforage.setItem('cs_migrated', true), 1500, null);
    } catch (e) { /* ignore */ }
  }


  /* 已发布数据合并：仅在较新时重绘 */
  async function mergePublished() {
    try {
      if (!Array.isArray(characters) || !characters.length) return;
      if (!characters.some(c => c.id === activeCharId)) {
        activeCharId = characters[0].id;
      }
      nextId = Math.max.apply(null, characters.map(c => c.id).concat([0])) + 1;
      renderAllCharacters();
    } catch (e) { /* ignore */ }
  }

  /* ============ 图片裁剪 ============ */
  let cropperInstance = null;
  let cropResolve = null;

  async function cropImage(file) {
    return new Promise(async (resolve) => {
      const dataUrl = await readFileAsDataUrl(file);
      const overlay = document.getElementById('cropOverlay');
      const cropImg = document.getElementById('cropImage');
      cropImg.src = dataUrl;
      overlay.classList.add('active');
      if (cropperInstance) { cropperInstance.destroy(); cropperInstance = null; }
      cropperInstance = new Cropper(cropImg, {
        aspectRatio: NaN, viewMode: 1, autoCropArea: 0.9,
        responsive: true, background: false, guides: true
      });
      cropResolve = resolve;
    });
  }

  function closeCropModal(confirmed) {
    const overlay = document.getElementById('cropOverlay');
    overlay.classList.remove('active');
    if (!confirmed || !cropperInstance) {
      if (cropperInstance) { cropperInstance.destroy(); cropperInstance = null; }
      if (cropResolve) { cropResolve(null); cropResolve = null; }
      return;
    }
    const canvas = cropperInstance.getCroppedCanvas();
    const result = canvas ? canvas.toDataURL('image/jpeg', 0.92) : null;
    cropperInstance.destroy(); cropperInstance = null;
    if (cropResolve) { cropResolve(result); cropResolve = null; }
  }

  function bindCropModal() {
    const overlay = document.getElementById('cropOverlay');
    const confirmBtn = document.getElementById('cropConfirm');
    const cancelBtn = document.getElementById('cropCancel');
    const closeBtn = document.getElementById('cropClose');
    if (confirmBtn) confirmBtn.addEventListener('click', () => closeCropModal(true));
    if (cancelBtn) cancelBtn.addEventListener('click', () => closeCropModal(false));
    if (closeBtn) closeBtn.addEventListener('click', () => closeCropModal(false));
    if (overlay) overlay.addEventListener('click', e => { if (e.target === overlay) closeCropModal(false); });
  }

  function compressImage(dataUrl, maxWidth, quality) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = function () {
        let w = img.width, h = img.height;
        if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  async function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /* ============ Toast ============ */
  function showToast(message, type) {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:99999;display:flex;flex-direction:column;gap:8px;';
      document.body.appendChild(container);
    }
    const el = document.createElement('div');
    const colors = { success: '#16a34a', warning: '#d97706', error: '#dc2626' };
    el.style.cssText = `padding:10px 20px;border-radius:6px;font-size:13px;background:${colors[type]||colors.success};color:#fff;box-shadow:0 4px 16px rgba(0,0,0,0.4);font-family:var(--font-sans);`;
    el.textContent = message;
    container.appendChild(el);
    if (type !== 'error') {
      setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s'; setTimeout(() => el.remove(), 300); }, 2500);
    }
  }

  /* ============ 渲染全部 ============ */
  function renderAllCharacters() {
    renderAvatarBar();
    if (activeCharId !== null) renderDetailPanel(activeCharId);
    else showEmptyState();
  }

  /* ============ 顶部倾斜卡片选择栏 ============ */
  function renderAvatarBar() {
    const bar = document.getElementById('charAvatarBar');
    if (!bar) return;
    bar.innerHTML = '';
    characters.forEach(ch => {
      const btn = document.createElement('button');
      btn.className = 'chara-card-btn' + (ch.id === activeCharId ? ' active' : '');
      btn.dataset.charId = String(ch.id);
      btn.setAttribute('data-char-id', String(ch.id));
      const name = (ch.nameRomaji || ch.nameJp || '??').replace(/CHARACTER\s*/i, '').trim() || ch.nameJp || '??';
      btn.innerHTML = `
        <div class="chara-card-frame">
          <img src="${escHtml(ch.mainImg || '')}" alt="${escHtml(ch.nameRomaji)}"
               class="chara-card-img" onerror="this.style.opacity=0" />
          <span class="chara-card-name">${escHtml(name.toUpperCase())}</span>
        </div>`;
      btn.addEventListener('click', () => switchToChar(Number(btn.dataset.charId)));
      bar.appendChild(btn);
    });
  }

  /* ============ 切换角色 ============ */
  function switchToChar(charId) {
    if (activeCharId === charId) return;
    activeCharId = charId;
    document.querySelectorAll('.chara-card-btn').forEach(btn => {
      btn.classList.toggle('active', Number(btn.dataset.charId) === charId);
    });
    renderDetailPanel(charId);
  }

  /* ============ 详情面板 ============ */
  function renderDetailPanel(charId) {
    const panel = document.getElementById('charDetailPanel');
    if (!panel) return;
    const ch = characters.find(c => c.id === charId);
    if (!ch) { showEmptyState(); return; }
    panel.innerHTML = buildDetailHTML(ch);
    panel.style.opacity = '0';
    requestAnimationFrame(() => {
      panel.style.transition = 'opacity 0.3s ease';
      panel.style.opacity = '1';
    });
    bindCharImageUploads();
    bindRenderUploads();
    bindWireUploads();
    bindThumbClicks();
    bindThumbDeletes();
    bindDeleteButton(charId);
    bindTagEvents(charId);
  }

  function showEmptyState() {
    const panel = document.getElementById('charDetailPanel');
    if (!panel) return;
    panel.innerHTML = `<div class="char-empty-state"><p>まだキャラクターはいません</p><p style="font-size:12px;margin-top:8px;opacity:0.5;">下方按钮添加角色</p></div>`;
  }

  /* ============ 构建详情 HTML ============ */
  function buildDetailHTML(ch) {
    return `
    <div class="char-layout">
      <!-- 左侧：立绘 -->
      <div class="char-image-col">
        <div class="char-main-image" id="charMainImg-${ch.id}">
          <img src="${escHtml(ch.mainImg || '')}" alt="${escHtml(ch.nameRomaji)}"
               class="char-img"
               onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22/>'" />
          <label class="char-img-upload">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            <span>更换立绘</span>
            <input type="file" accept="image/*" class="char-img-input" data-char="${ch.id}" />
          </label>
        </div>
      </div>

      <!-- 右侧：信息 -->
      <div class="char-info-col">
        <!-- 名字 -->
        <div class="char-name-block">
          <h2 class="char-name-jp" contenteditable="true" data-field="nameJp" data-char="${ch.id}">${escHtml(ch.nameJp)}</h2>
          <p class="char-name-romaji" contenteditable="true" data-field="nameRomaji" data-char="${ch.id}">${escHtml(ch.nameRomaji)}</p>
        </div>

        <!-- 分隔线 -->
        <div class="char-divider"></div>

        <!-- 标签 -->
        <div class="char-tags" id="tags-${ch.id}">
          ${(ch.tags || []).map((t, i) => `
            <span class="char-tag" data-char="${ch.id}" data-tag-index="${i}">
              <span class="tag-text" contenteditable="true">${escHtml(t)}</span>
              <button class="tag-remove" data-char="${ch.id}" data-tag-index="${i}">&#x2715;</button>
            </span>`).join('')}
          <span class="char-tag tag-add-btn" data-char="${ch.id}">+ 添加</span>
        </div>

        <!-- 台词 -->
        <div class="char-quote">
          <p class="char-quote-text" contenteditable="true" data-field="quote" data-char="${ch.id}">${escHtml(ch.quote || '台詞をここに入力…')}</p>
        </div>

        <!-- 描述 -->
        <div class="char-description" contenteditable="true" data-field="desc" data-char="${ch.id}">${escHtml(ch.desc)}</div>

        <div class="char-divider"></div>

        <!-- 渲染图 -->
        <div class="char-media-block">
          <h3 class="char-media-title">RENDER &mdash; 渲染成品</h3>
          <div class="char-thumbs-scroll" id="renderThumbs-${ch.id}">
            ${renderScrollThumbs(ch.renders, ch.id, 'render')}
          </div>
          <label class="char-upload-btn">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span>添加渲染图</span>
            <input type="file" accept="image/*" multiple class="render-input" data-char="${ch.id}" />
          </label>
        </div>

        <!-- 线框图 -->
        <div class="char-media-block">
          <h3 class="char-media-title">WIREFRAME &mdash; 白膜 / 线框</h3>
          <div class="char-thumbs-scroll" id="wireThumbs-${ch.id}">
            ${renderScrollThumbs(ch.wires, ch.id, 'wire')}
          </div>
          <label class="char-upload-btn">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span>添加白膜/线框图</span>
            <input type="file" accept="image/*" multiple class="wire-input" data-char="${ch.id}" />
          </label>
        </div>

        <!-- 技术参数 -->
        <div class="char-tech-block">
          <h3 class="char-media-title">TECHNICAL PROFILE</h3>
          <div class="char-tech-grid">
            <div class="char-tech-item">
              <span class="char-tech-label">POLY COUNT</span>
              <span class="char-tech-value" contenteditable="true" data-field="tech.poly" data-char="${ch.id}">${escHtml((ch.tech||{}).poly||'--')}</span>
            </div>
            <div class="char-tech-item">
              <span class="char-tech-label">VERTS</span>
              <span class="char-tech-value" contenteditable="true" data-field="tech.verts" data-char="${ch.id}">${escHtml((ch.tech||{}).verts||'--')}</span>
            </div>
            <div class="char-tech-item">
              <span class="char-tech-label">SOFTWARE</span>
              <span class="char-tech-value" contenteditable="true" data-field="tech.tool" data-char="${ch.id}">${escHtml((ch.tech||{}).tool||'--')}</span>
            </div>
            <div class="char-tech-item">
              <span class="char-tech-label">STYLE</span>
              <span class="char-tech-value" contenteditable="true" data-field="tech.style" data-char="${ch.id}">${escHtml((ch.tech||{}).style||'--')}</span>
            </div>
          </div>
        </div>

        <!-- 故事说明 -->
        <div class="char-story-block">
          <h3 class="char-media-title">DESIGN NOTE &mdash; 制作说明</h3>
          <div class="char-story-text" contenteditable="true" data-field="story" data-char="${ch.id}">${escHtml(ch.story)}</div>
        </div>

        <div style="margin-top:24px;text-align:right;">
          <button class="delete-char-btn" data-char="${ch.id}">&#x1F5D1; 删除此角色</button>
        </div>
      </div>
    </div>`;
  }

  /* ============ 缩略图 HTML ============ */
  function renderScrollThumbs(images, charId, type) {
    if (!images || images.length === 0) return '';
    return images.map((src, i) => `
      <div class="char-scroll-thumb" data-char="${charId}" data-type="${type}" data-index="${i}">
        <img src="${escHtml(src)}" alt="缩略图 ${i+1}" />
        <span class="char-scroll-thumb-delete" data-char="${charId}" data-type="${type}" data-index="${i}">&#x2715;</span>
      </div>`).join('');
  }

  /* ============ 删除角色 ============ */
  function bindDeleteButton(charId) {
    const panel = document.getElementById('charDetailPanel');
    if (!panel) return;
    if (panel._deleteHandler) panel.removeEventListener('click', panel._deleteHandler);
    panel._deleteHandler = function (e) {
      const btn = e.target.closest('.delete-char-btn');
      if (!btn) return;
      e.preventDefault(); e.stopPropagation();
      const targetId = Number(btn.dataset.char);
      if (isNaN(targetId)) return;
      if (!confirm('确定要删除这个角色吗？此操作不可撤销。')) return;
      const idx = characters.findIndex(c => c.id === targetId);
      if (idx === -1) return;
      characters.splice(idx, 1);
      saveData().then(() => {
        if (targetId === activeCharId) {
          activeCharId = characters.length > 0
            ? (characters[idx]?.id ?? characters[characters.length-1]?.id ?? null)
            : null;
        }
        renderAllCharacters();
        showToast('角色已删除', 'success');
      });
    };
    panel.addEventListener('click', panel._deleteHandler);
  }

  /* ============ 标签管理 ============ */
  function bindTagEvents(charId) {
    const tagsContainer = document.getElementById(`tags-${charId}`);
    if (!tagsContainer) return;
    tagsContainer.addEventListener('click', function (e) {
      const removeBtn = e.target.closest('.tag-remove');
      if (removeBtn) {
        e.stopPropagation();
        const tc = Number(removeBtn.dataset.char);
        const ti = Number(removeBtn.dataset.tagIndex);
        const ch = characters.find(c => c.id === tc);
        if (ch && ch.tags[ti] !== undefined) {
          ch.tags.splice(ti, 1);
          saveData();
          renderDetailPanel(tc);
        }
        return;
      }
      const addBtn = e.target.closest('.tag-add-btn');
      if (addBtn) { e.stopPropagation(); addTagInline(addBtn); }
    });
    tagsContainer.addEventListener('input', function (e) {
      const tagEl = e.target.closest('.char-tag:not(.tag-add-btn)');
      if (!tagEl || !e.target.classList.contains('tag-text')) return;
      const tc = Number(tagEl.dataset.char);
      const ti = Number(tagEl.dataset.tagIndex);
      const ch = characters.find(c => c.id === tc);
      if (ch && ch.tags[ti] !== undefined) {
        ch.tags[ti] = e.target.innerText.trim();
        saveData();
      }
    });
  }

  function addTagInline(addBtnEl) {
    const charId = Number(addBtnEl.dataset.char);
    const input = document.createElement('input');
    input.type = 'text'; input.className = 'tag-input';
    input.placeholder = '标签名…'; input.maxLength = 20;
    const wrapper = document.createElement('span');
    wrapper.className = 'char-tag tag-input-wrap';
    wrapper.appendChild(input);
    addBtnEl.replaceWith(wrapper);
    input.focus();
    input.addEventListener('keydown', ev => {
      if (ev.key === 'Enter') { ev.preventDefault(); confirmAddTag(input, charId, wrapper); }
      else if (ev.key === 'Escape') renderDetailPanel(charId);
    });
    input.addEventListener('blur', () => setTimeout(() => confirmAddTag(input, charId, wrapper), 100));
  }

  function confirmAddTag(inputEl, charId, wrapper) {
    if (inputEl.parentElement !== wrapper) return;
    const val = (inputEl.value || '').trim();
    const ch = characters.find(c => c.id === charId);
    if (!ch) { renderDetailPanel(charId); return; }
    if (val && !ch.tags.includes(val)) { ch.tags.push(val); saveData(); }
    renderDetailPanel(charId);
  }

  /* ============ 主视觉图上传 ============ */
  function bindHeroUpload() {
    const input = document.getElementById('heroBgInput');
    if (!input) return;
    input.addEventListener('change', async function () {
      const file = this.files[0]; if (!file) return;
      const cropped = await cropImage(file); if (!cropped) { this.value = ''; return; }
      const compressed = await compressImage(cropped, 1920, 0.8);
      const el = document.getElementById('heroBgImg');
      if (el) {
        el.style.backgroundImage = `url(${compressed})`;
        try { await localforage.setItem('cs_heroBg', compressed); } catch (e) { /* ignore */ }
      }
      showToast('主视觉已更新', 'success');
      this.value = '';
    });
  }

  /* ============ 角色主图上传 ============ */
  function bindCharImageUploads() {
    document.querySelectorAll('.char-img-input').forEach(input => {
      input.addEventListener('change', async function () {
        const charId = Number(this.dataset.char);
        const file = this.files[0]; if (!file) return;
        const cropped = await cropImage(file); if (!cropped) { this.value = ''; return; }
        const compressed = await compressImage(cropped, 900, 0.85);
        const ch = characters.find(c => c.id === charId);
        if (ch) {
          ch.mainImg = compressed;
          await saveData();
          const img = document.querySelector(`#charMainImg-${charId} .char-img`);
          if (img) img.src = compressed;
          syncCardImage(charId, compressed);
        }
        this.value = '';
      });
    });
  }

  function syncCardImage(charId, src) {
    const cardImg = document.querySelector(`.chara-card-btn[data-char-id="${charId}"] .chara-card-img`);
    if (cardImg) { cardImg.src = src; cardImg.style.opacity = '1'; }
  }

  /* ============ 渲染图上传 ============ */
  function bindRenderUploads() {
    document.querySelectorAll('.render-input').forEach(input => {
      input.addEventListener('change', async function () {
        const charId = Number(this.dataset.char);
        const files = Array.from(this.files); if (!files.length) return;
        const ch = characters.find(c => c.id === charId); if (!ch) return;
        for (const file of files) {
          const cropped = await cropImage(file); if (!cropped) continue;
          ch.renders.push(await compressImage(cropped, 1200, 0.8));
        }
        await saveData();
        refreshThumbs(charId, 'render', ch.renders);
        this.value = '';
      });
    });
  }

  /* ============ 白膜图上传 ============ */
  function bindWireUploads() {
    document.querySelectorAll('.wire-input').forEach(input => {
      input.addEventListener('change', async function () {
        const charId = Number(this.dataset.char);
        const files = Array.from(this.files); if (!files.length) return;
        const ch = characters.find(c => c.id === charId); if (!ch) return;
        for (const file of files) {
          const cropped = await cropImage(file); if (!cropped) continue;
          ch.wires.push(await compressImage(cropped, 1200, 0.9));
        }
        await saveData();
        refreshThumbs(charId, 'wire', ch.wires);
        this.value = '';
      });
    });
  }

  function refreshThumbs(charId, type, images) {
    const id = type === 'render' ? `renderThumbs-${charId}` : `wireThumbs-${charId}`;
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = renderScrollThumbs(images, charId, type);
    bindThumbClicks();
    bindThumbDeletes();
  }

  /* ============ About 头像上传 ============ */
  function bindAboutUpload() {
    const input = document.getElementById('avatarInput');
    if (!input) return;
    input.addEventListener('change', async function () {
      const file = this.files[0]; if (!file) return;
      const cropped = await cropImage(file); if (!cropped) { this.value = ''; return; }
      const compressed = await compressImage(cropped, 400, 0.85);
      const avatarImg = document.getElementById('avatarImg');
      const placeholder = document.getElementById('avatarPlaceholder');
      const changeLabel = document.getElementById('avatarChangeLabel');
      if (avatarImg) { avatarImg.src = compressed; avatarImg.style.display = 'block'; }
      if (placeholder) placeholder.style.display = 'none';
      if (changeLabel) changeLabel.style.display = 'flex';
      try { await localforage.setItem('cs_avatar', compressed); } catch (e) { /* ignore */ }
      showToast('头像已更新', 'success');
      this.value = '';
    });
    localforage.getItem('cs_avatar').then(data => {
      if (data) {
        const avatarImg = document.getElementById('avatarImg');
        const placeholder = document.getElementById('avatarPlaceholder');
        const changeLabel = document.getElementById('avatarChangeLabel');
        if (avatarImg) { avatarImg.src = data; avatarImg.style.display = 'block'; }
        if (placeholder) placeholder.style.display = 'none';
        if (changeLabel) changeLabel.style.display = 'flex';
      }
    });
  }

  /* ============ Lightbox ============ */
  let lbState = { images: [], current: 0 };

  function bindThumbClicks() {
    document.querySelectorAll('.char-scroll-thumb').forEach(thumb => {
      thumb.removeEventListener('click', thumb._clickHandler);
      thumb._clickHandler = function () {
        const charId = Number(this.dataset.char);
        const type = this.dataset.type;
        const index = Number(this.dataset.index);
        const ch = characters.find(c => c.id === charId);
        if (!ch) return;
        lbState = { images: type === 'render' ? ch.renders : ch.wires, current: index };
        openLightbox();
      };
      thumb.addEventListener('click', thumb._clickHandler);
    });
  }

  function bindThumbDeletes() {
    document.querySelectorAll('.char-scroll-thumb-delete').forEach(btn => {
      btn.removeEventListener('click', btn._dh);
      btn._dh = function (e) {
        e.stopPropagation();
        const charId = Number(this.dataset.char);
        const type = this.dataset.type;
        const index = Number(this.dataset.index);
        const ch = characters.find(c => c.id === charId);
        if (!ch) return;
        if (type === 'render') ch.renders.splice(index, 1);
        else ch.wires.splice(index, 1);
        saveData();
        refreshThumbs(charId, type, type === 'render' ? ch.renders : ch.wires);
      };
      btn.addEventListener('click', btn._dh);
    });
  }

  function bindLightbox() {
    const overlay = document.getElementById('lightboxOverlay');
    document.getElementById('lightboxClose')?.addEventListener('click', closeLightbox);
    document.getElementById('lightboxPrev')?.addEventListener('click', lbPrev);
    document.getElementById('lightboxNext')?.addEventListener('click', lbNext);
    overlay?.addEventListener('click', e => { if (e.target === overlay) closeLightbox(); });
    document.addEventListener('keydown', e => {
      if (!overlay?.classList.contains('active')) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') lbPrev();
      if (e.key === 'ArrowRight') lbNext();
    });
  }

  function openLightbox() {
    document.getElementById('lightboxOverlay')?.classList.add('active');
    updateLbImage();
  }
  function closeLightbox() {
    document.getElementById('lightboxOverlay')?.classList.remove('active');
  }
  function updateLbImage() {
    const img = document.getElementById('lightboxImg');
    const counter = document.getElementById('lightboxCounter');
    if (!img || !lbState.images.length) return;
    img.src = lbState.images[lbState.current];
    if (counter) counter.textContent = `${lbState.current + 1} / ${lbState.images.length}`;
  }
  function lbPrev() {
    if (lbState.images.length <= 1) return;
    lbState.current = (lbState.current - 1 + lbState.images.length) % lbState.images.length;
    updateLbImage();
  }
  function lbNext() {
    if (lbState.images.length <= 1) return;
    lbState.current = (lbState.current + 1) % lbState.images.length;
    updateLbImage();
  }

  /* ============ 添加新角色 ============ */
  function bindAddCharacter() {
    document.getElementById('addCharBtn')?.addEventListener('click', async function () {
      const newChar = {
        id: nextId++,
        nameJp: `キャラクター${String(nextId).padStart(2,'0')}`,
        nameRomaji: `CHARACTER ${nextId}`,
        quote: '',
        tags: ['3D Model'],
        desc: '角色描述',
        story: '设计说明',
        renders: [], wires: [],
        tech: { poly: '--', verts: '--', tool: '--', style: '--' },
        mainImg: ''
      };
      characters.push(newChar);
      await saveData();
      activeCharId = newChar.id;
      renderAllCharacters();
    });
  }

  /* ============ ContentEditable 自动保存 ============ */
  function bindContentEditableSave() {
    document.addEventListener('input', function (e) {
      const el = e.target;
      if (!el.isContentEditable) return;
      const field = el.dataset.field;
      const charId = el.dataset.char;
      if (!field || !charId) return;
      const ch = characters.find(c => String(c.id) === String(charId));
      if (!ch) return;
      setNestedValue(ch, field, el.innerText.trim());
      saveData();
      // 同步卡片名字
      if (field === 'nameRomaji' || field === 'nameJp') {
        const nameEl = document.querySelector(`.chara-card-btn[data-char-id="${charId}"] .chara-card-name`);
        const displayName = (field === 'nameRomaji' ? el.innerText.trim() : ch.nameRomaji || ch.nameJp || '??');
        if (nameEl) nameEl.textContent = displayName.replace(/CHARACTER\s*/i,'').trim().toUpperCase() || displayName.toUpperCase();
      }
    });
  }

  /* ============ 导航栏滚动高亮 ============ */
  function bindNavScroll() {
    const header = document.getElementById('siteHeader');
    const links = document.querySelectorAll('.nav-item');
    const sections = ['hero', 'characters', 'about', 'contact'];
    window.addEventListener('scroll', function () {
      if (header) header.classList.toggle('scrolled', window.scrollY > 60);
      let current = 'hero';
      sections.forEach(id => {
        const sec = document.getElementById(id);
        if (sec && sec.getBoundingClientRect().top <= 160) current = id;
      });
      links.forEach(l => l.classList.toggle('active', l.dataset.section === current));
    });
  }

  /* ============ Hero 粒子 ============ */
  function initHeroParticles() {
    const canvas = document.getElementById('heroParticles');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let particles = [];
    let animId;

    function resize() {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }

    function createParticle() {
      return {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.5 + 0.3,
        vx: (Math.random() - 0.5) * 0.25,
        vy: -Math.random() * 0.4 - 0.1,
        alpha: Math.random() * 0.5 + 0.1,
        life: 1
      };
    }

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // 补充粒子
      while (particles.length < 80) particles.push(createParticle());
      particles.forEach((p, i) => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.003;
        if (p.life <= 0 || p.y < -10) { particles[i] = createParticle(); return; }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        // 随机紫 / 金色粒子
        const isGold = p.r > 1.2;
        ctx.fillStyle = isGold
          ? `rgba(201,168,76,${p.alpha * p.life})`
          : `rgba(139,117,215,${p.alpha * p.life})`;
        ctx.fill();
      });
      animId = requestAnimationFrame(animate);
    }

    resize();
    window.addEventListener('resize', resize);
    animate();

    // 页面不可见时暂停
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) cancelAnimationFrame(animId);
      else animate();
    });
  }

  /* ============ 工具函数 ============ */
  function escHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function setNestedValue(obj, path, value) {
    const keys = path.split('.');
    let cur = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!cur[keys[i]]) cur[keys[i]] = {};
      cur = cur[keys[i]];
    }
    cur[keys[keys.length - 1]] = value;
  }

})();
