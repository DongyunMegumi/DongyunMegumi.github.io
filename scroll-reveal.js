export function setupScrollReveal() {
  if (!('IntersectionObserver' in window)) return;
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const items = [...document.querySelectorAll('[data-scroll-reveal]')].map(element => {
    // Observe a stable layout box so the translated content cannot retrigger itself.
    const anchor = document.createElement('div');
    anchor.className = 'reveal-anchor';
    element.before(anchor);
    anchor.append(element);
    element.classList.add('scroll-reveal');
    return { anchor, element };
  });
  const elements = new Map(items.map(({ anchor, element }) => [anchor, element]));
  let observer;

  function updatePreference() {
    observer?.disconnect();
    if (preference.matches) {
      items.forEach(({ element }) => element.classList.add('is-revealed'));
      return;
    }
    observer = new IntersectionObserver(entries => {
      for (const entry of entries) elements.get(entry.target).classList.toggle('is-revealed', entry.isIntersecting);
    }, { rootMargin: '-48px 0px 0px 0px', threshold: 0 });
    items.forEach(({ anchor }) => observer.observe(anchor));
  }

  preference.addEventListener('change', updatePreference);
  updatePreference();
  window.addEventListener('pageshow', updatePreference);
}
