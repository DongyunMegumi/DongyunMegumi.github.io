(() => {
  'use strict';
  async function init() {
    const isHome = location.pathname === '/' || location.pathname === '/index.html';
    document.body.classList.toggle('has-character-gateway', isHome);
    if (!isHome || document.querySelector('.home-character-gateway')) return;
    const main = document.querySelector('main.layout');
    if (!main) return;
    try {
      const response = await fetch('/characters/characters-data.json', { cache: 'no-cache', signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const characters = Array.isArray(data.characters) ? data.characters.filter(item => item && item.id !== undefined) : [];
      if (!characters.length || !main.isConnected || document.querySelector('.home-character-gateway')) return;
      const section = document.createElement('section');
      section.className = 'home-character-gateway character-band';
      section.id = 'characters';
      section.setAttribute('aria-labelledby', 'homeCharactersTitle');
      section.innerHTML = `
        <div class="character-band-orbit" aria-hidden="true"></div>
        <div class="character-band-heading">
          <h2 id="homeCharactersTitle"><a href="/characters/">Characters</a></h2>
          <img class="character-title-decoration" src="/characters/assets/reference/dec_characters.png" alt="">
        </div>
      `;
      const nav = document.createElement('nav');
      nav.className = 'home-character-list portrait-rail';
      nav.setAttribute('aria-label', '角色作品入口');
      characters.forEach((character, index) => nav.append(CharacterCards.create(character, index, { base: '/characters/', className: 'home-character-card' })));
      section.append(nav);
      main.before(section);
      CharacterCards.mount(nav);
    } catch (error) {
      document.body.classList.remove('has-character-gateway');
      console.warn('Character gateway:', error.message);
    }
  }
  init();
  document.addEventListener('pjax:complete', init);
})();
