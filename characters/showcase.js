(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  let characters = [];
  let active = 0;
  let mediaGroups = [];
  let mediaGroup = 0;
  let mediaIndex = 0;
  let dialogImages = [];
  let dialogIndex = 0;

  function text(id, value) { $(id).textContent = value || ''; }
  function imageUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return '';
    try {
      const url = new URL(value, location.href);
      return ['https:', 'http:'].includes(url.protocol) || /^data:image\/(png|jpeg|webp|gif);base64,/i.test(value) ? url.href : '';
    } catch { return ''; }
  }
  function setImage(element, value, alt) {
    const url = imageUrl(value);
    element.hidden = !url;
    element.alt = alt || '';
    element.onerror = () => { element.hidden = true; };
    if (url) element.src = url;
    else element.removeAttribute('src');
  }
  function fitName() {
    const heading = $('characterName');
    heading.style.fontSize = '';
    const range = document.createRange();
    range.selectNodeContents(heading);
    const max = parseFloat(getComputedStyle(heading).fontSize);
    heading.style.whiteSpace = 'nowrap';
    const width = range.getBoundingClientRect().width;
    heading.style.fontSize = `${Math.max(28, Math.min(max, max * heading.clientWidth * .97 / Math.max(1, width)))}px`;
    heading.style.whiteSpace = '';
  }
  function showProfile() {
    const profile = $('profile');
    profile.focus({ preventScroll: true });
    profile.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }
  function renderSelector() {
    for (const [id, className] of [['characterSelector', 'character-thumb'], ['overviewCharacters', 'overview-card']]) {
      const rail = $(id);
      rail.replaceChildren();
      characters.forEach((character, index) => rail.append(CharacterCards.create(character, index, {
        base: './',
        className,
        onSelect: index => { selectCharacter(index); showProfile(); }
      })));
      CharacterCards.mount(rail);
    }
  }
  function selectCharacter(index, updateUrl = true) {
    if (!characters.length) return;
    active = (index + characters.length) % characters.length;
    const character = characters[active];
    text('characterName', character.nameRomaji || character.nameJp);
    text('characterRuby', character.nameJp);
    text('characterQuote', character.quote);
    text('characterCredit', character.credit || '東雲 Megumi');
    text('characterDescription', character.desc);
    text('characterStory', character.story);
    text('characterTags', Array.isArray(character.tags) ? character.tags.join(' / ') : '');
    setImage($('mainArtwork'), character.mainImg, character.nameJp);
    $('artwork').classList.remove('is-full', 'is-entering');
    $('toggleFraming').setAttribute('aria-pressed', 'false');
    $('toggleFraming').setAttribute('aria-label', 'Show full artwork');
    void $('artwork').offsetWidth;
    $('artwork').classList.add('is-entering');
    $('technicalData').replaceChildren();
    const fields = { poly: 'Polygons', verts: 'Vertices', tool: 'Software', style: 'Style' };
    Object.entries(fields).forEach(([key, label]) => {
      if (!character.tech?.[key]) return;
      const dt = document.createElement('dt');
      const dd = document.createElement('dd');
      dt.textContent = label;
      dd.textContent = character.tech[key];
      $('technicalData').append(dt, dd);
    });
    $('technical').hidden = !$('technicalData').children.length && !$('characterTags').textContent;
    $('technical').open = false;
    mediaGroups = [
      { label: 'Artwork', images: [character.mainImg] },
      { label: 'Render', images: character.renders },
      { label: 'Wireframe', images: character.wires }
    ].map(group => ({ ...group, images: Array.isArray(group.images) ? group.images.filter(imageUrl) : [] })).filter(group => group.images.length);
    mediaGroup = mediaGroups.findIndex(group => group.label === 'Render');
    if (mediaGroup < 0) mediaGroup = 0;
    mediaIndex = 0;
    renderMediaTabs();
    renderMedia();
    [...$('characterSelector').children].forEach((button, i) => button.setAttribute('aria-current', String(i === active)));
    [...$('overviewCharacters').children].forEach((card, i) => card.setAttribute('aria-current', String(i === active)));
    text('selectionCounter', `${String(active + 1).padStart(2, '0')} / ${String(characters.length).padStart(2, '0')}`);
    $('previousCharacter').disabled = $('nextCharacter').disabled = characters.length < 2;
    document.title = `${character.nameJp || character.nameRomaji} | 東雲Megumi`;
    fitName();
    if (updateUrl) {
      const url = new URL(location.href);
      url.searchParams.set('character', String(character.id));
      url.hash = 'profile';
      if (url.href !== location.href) history.pushState(null, '', url);
    }
  }
  function renderMediaTabs() {
    $('mediaTabs').replaceChildren();
    mediaGroups.forEach((group, index) => {
      const button = document.createElement('button');
      button.textContent = group.label;
      button.id = `media-tab-${index}`;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-controls', 'mediaPanel');
      button.addEventListener('click', () => { mediaGroup = index; mediaIndex = 0; renderMedia(); });
      button.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        event.stopPropagation();
        mediaGroup = event.key === 'Home' ? 0 : event.key === 'End' ? mediaGroups.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + mediaGroups.length) % mediaGroups.length;
        mediaIndex = 0;
        renderMedia();
        $('mediaTabs').children[mediaGroup].focus();
      });
      $('mediaTabs').append(button);
    });
  }
  function renderMedia() {
    $('media').hidden = !mediaGroups.length;
    if (!mediaGroups.length) return;
    const group = mediaGroups[mediaGroup];
    [...$('mediaTabs').children].forEach((button, index) => {
      button.setAttribute('aria-selected', String(index === mediaGroup));
      button.tabIndex = index === mediaGroup ? 0 : -1;
    });
    $('mediaPanel').setAttribute('aria-labelledby', `media-tab-${mediaGroup}`);
    setImage($('mediaImage'), group.images[mediaIndex], `${characters[active].nameJp} - ${group.label} ${mediaIndex + 1}`);
    $('mediaPagination').replaceChildren();
    group.images.forEach((_, index) => {
      const button = document.createElement('button');
      button.setAttribute('aria-label', `Image ${index + 1}`);
      button.setAttribute('aria-current', String(index === mediaIndex));
      button.addEventListener('click', () => { mediaIndex = index; renderMedia(); });
      $('mediaPagination').append(button);
    });
  }
  function openImages(images, index = 0) {
    dialogImages = images.filter(imageUrl);
    if (!dialogImages.length) return;
    dialogIndex = index;
    renderDialogImage();
    $('imageDialog').showModal();
  }
  function renderDialogImage() {
    dialogIndex = (dialogIndex + dialogImages.length) % dialogImages.length;
    setImage($('dialogImage'), dialogImages[dialogIndex], characters[active]?.nameJp || 'Artwork');
    text('imageCounter', `${dialogIndex + 1} / ${dialogImages.length}`);
    $('imagePrevious').hidden = $('imageNext').hidden = dialogImages.length < 2;
  }
  $('previousCharacter').addEventListener('click', () => selectCharacter(active - 1));
  $('nextCharacter').addEventListener('click', () => selectCharacter(active + 1));
  $('toggleFraming').addEventListener('click', () => {
    const full = $('artwork').classList.toggle('is-full');
    $('toggleFraming').setAttribute('aria-pressed', String(full));
    $('toggleFraming').setAttribute('aria-label', full ? 'Show close-up artwork' : 'Show full artwork');
  });
  $('enlargeArtwork').addEventListener('click', () => openImages([characters[active]?.mainImg || $('mainArtwork').src]));
  $('openMedia').addEventListener('click', () => { if (mediaGroups.length) openImages(mediaGroups[mediaGroup].images, mediaIndex); });
  $('imagePrevious').addEventListener('click', () => { dialogIndex--; renderDialogImage(); });
  $('imageNext').addEventListener('click', () => { dialogIndex++; renderDialogImage(); });
  $('openMenu').addEventListener('click', () => $('navigationDialog').showModal());
  document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => $(button.dataset.close).close()));
  $('navigationDialog').querySelectorAll('a').forEach(link => link.addEventListener('click', () => $('navigationDialog').close()));
  document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); }));
  document.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key) || event.target.closest('button, a, input, textarea, select, summary, [contenteditable]')) return;
    if ($('navigationDialog').open) return;
    event.preventDefault();
    const delta = event.key === 'ArrowRight' ? 1 : -1;
    if ($('imageDialog').open) { dialogIndex += delta; renderDialogImage(); }
    else selectCharacter(active + delta);
  });
  new ResizeObserver(fitName).observe($('characterName').parentElement);
  window.addEventListener('popstate', () => {
    const id = new URLSearchParams(location.search).get('character');
    selectCharacter(Math.max(0, characters.findIndex(character => String(character.id) === id)), false);
  });
  document.fonts.ready.then(fitName);
  window.lucide?.createIcons();

  async function loadDraft() {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'assets/vendor/localforage.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.append(script);
    });
    const draft = await localforage.getItem('cs_characters');
    if (Array.isArray(draft)) return draft;
    try { return JSON.parse(localStorage.getItem('cs_characters')); } catch { return null; }
  }
  async function init() {
    $('previousCharacter').disabled = $('nextCharacter').disabled = true;
    try {
      const response = await fetch('characters-data.json', { signal: AbortSignal.timeout(8000), cache: 'no-cache' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const published = await response.json();
      let data = published.characters;
      if (params.get('preview') === '1') {
        const draft = await Promise.race([loadDraft().catch(() => null), new Promise(resolve => setTimeout(() => resolve(null), 2500))]);
        if (Array.isArray(draft)) data = draft;
      }
      if (!Array.isArray(data)) throw new Error('Invalid character data');
      characters = data.filter(character => character && typeof character === 'object' && character.id !== undefined);
      if (!characters.length) throw new Error('No characters');
      active = Math.max(0, characters.findIndex(character => String(character.id) === params.get('character')));
      renderSelector();
      selectCharacter(active, false);
      if (location.hash === '#profile') {
        await document.fonts.ready;
        $('profile').scrollIntoView({ block: 'start', behavior: 'instant' });
      }
    } catch (error) {
      $('loadStatus').hidden = false;
      text('loadStatus', '角色资料暂时无法加载，请刷新重试。');
      console.warn('Character data:', error.message);
    }
  }
  init();
})();
