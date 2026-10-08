(() => {
  'use strict';
  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  function create(character, index, { base, className = '', onSelect } = {}) {
    const name = character.nameRomaji || character.nameJp || `CHARACTER ${index + 1}`;
    const card = document.createElement('a');
    card.className = `portrait-card ${className}`;
    card.href = `${base}?character=${encodeURIComponent(character.id)}#profile`;
    card.setAttribute('aria-label', `${character.nameJp || name} - 角色作品`);
    card.title = name;
    const image = document.createElement('img');
    image.className = 'portrait-art';
    image.alt = '';
    image.decoding = 'async';
    image.loading = index < 6 ? 'eager' : 'lazy';
    try {
      const url = new URL(character.mainImg, new URL(base, location.href));
      if (['http:', 'https:'].includes(url.protocol) || /^data:image\/(png|jpeg|webp|gif);base64,/i.test(character.mainImg)) image.src = url.href;
    } catch { /* The name remains usable when an image is unavailable. */ }
    image.onerror = () => card.classList.add('is-image-missing');
    const label = document.createElement('span');
    label.className = 'portrait-name';
    label.textContent = name;
    const number = document.createElement('small');
    number.className = 'portrait-number';
    number.setAttribute('aria-hidden', 'true');
    number.textContent = `No. ${String(index + 1).padStart(2, '0')}`;
    const marker = document.createElement('i');
    marker.className = 'portrait-marker';
    marker.setAttribute('aria-hidden', 'true');
    const visual = document.createElement('div');
    visual.className = 'portrait-visual';
    visual.append(image);
    const shadow = document.createElement('div');
    shadow.className = 'portrait-shadow';
    shadow.setAttribute('aria-hidden', 'true');
    shadow.append(image.cloneNode());
    card.append(shadow, visual, label, number, marker);
    if (onSelect) card.addEventListener('click', event => {
      if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      onSelect(index);
    });
    return card;
  }

  function mount(rail) {
    const cards = [...rail.querySelectorAll('.portrait-card')];
    rail.style.setProperty('--portrait-count', Math.max(1, cards.length));
    // Native links keep new-tab navigation; arrow keys also traverse the card rail.
    rail.addEventListener('keydown', event => {
      const index = cards.indexOf(event.target.closest('.portrait-card'));
      if (index < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      event.stopPropagation();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? cards.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + cards.length) % cards.length;
      cards[next].focus({ preventScroll: true });
      cards[next].scrollIntoView({ block: 'nearest', inline: 'center', behavior: reducedMotion() ? 'instant' : 'smooth' });
    });
    const controls = document.createElement('div');
    controls.className = 'rail-controls';
    const counter = document.createElement('output');
    const buttons = [-1, 1].map(direction => {
      const button = document.createElement('button');
      button.type = 'button';
      button.title = direction < 0 ? '上一组角色' : '下一组角色';
      button.setAttribute('aria-label', button.title);
      button.innerHTML = `<i data-lucide="chevron-${direction < 0 ? 'left' : 'right'}"></i>`;
      button.addEventListener('click', () => rail.scrollBy({ left: direction * (cards[0]?.offsetWidth + 24 || rail.clientWidth), behavior: reducedMotion() ? 'instant' : 'smooth' }));
      return button;
    });
    controls.append(buttons[0], counter, buttons[1]);
    rail.after(controls);
    let scheduled = false;
    function update() {
      scheduled = false;
      if (!rail.isConnected) { observer.disconnect(); return; }
      const overflow = rail.scrollWidth > rail.clientWidth + 2;
      controls.hidden = !overflow;
      buttons[0].disabled = rail.scrollLeft <= 2;
      buttons[1].disabled = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 2;
      const left = rail.getBoundingClientRect().left;
      const first = Math.max(0, cards.findIndex(card => card.getBoundingClientRect().right > left + 40));
      counter.textContent = `${String(first + 1).padStart(2, '0')} / ${String(cards.length).padStart(2, '0')}`;
    }
    const observer = new ResizeObserver(update);
    observer.observe(rail);
    function fitLabels() {
      cards.forEach(card => {
        const label = card.querySelector('.portrait-name');
        label.style.fontSize = '';
        const size = parseFloat(getComputedStyle(label).fontSize);
        const available = label.clientHeight - 34;
        const content = label.scrollHeight - 34;
        if (available > 0 && content > available) label.style.fontSize = `${size * available / content}px`;
      });
    }
    const labelObserver = new ResizeObserver(() => {
      if (!rail.isConnected) { labelObserver.disconnect(); return; }
      fitLabels();
    });
    labelObserver.observe(rail);
    document.fonts.ready.then(fitLabels);
    rail.addEventListener('scroll', () => { if (!scheduled) { scheduled = true; requestAnimationFrame(update); } }, { passive: true });
    window.lucide?.createIcons();
    update();
  }

  window.CharacterCards = { create, mount };
})();
