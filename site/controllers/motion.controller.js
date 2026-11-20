// Apparition douce des blocs, une seule fois, au premier passage à l’écran.
// Aucun masquage si les animations sont indisponibles ou désactivées par l’utilisateur.
(() => {
  const main = document.querySelector('main');
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  if (!main || !Element.prototype.animate || !('IntersectionObserver' in window)) return;
  const selector = [
    '.hero-copy > .eyebrow', '.hero-copy > h1', '.hero-subtitle',
    '.hero-description', '.hero-copy > .actions', '.hero-contact',
    '.portrait-panel', '.page-jump', '.refined-pagehead > *',
    '.editorial-heading', '.current-journey > article', '.focus-grid > article',
    '.architecture-case', '.responsibility-grid > article', '.refined-fold',
    '.direction-note', '.company-overview', '.school-overview',
    '.featured-project > div', '.project-feature-grid > article',
    '.exam-overview > article', '.preparation-note', '.certificate-card',
    '.contact-method', '.contact-cv', '.watch-headline'
  ].join(',');
  const easing = 'cubic-bezier(.22,.61,.36,1)';
  let observer;

  function reveal(el, delay = 0, duration = 520) {
    if (el.dataset.motionState !== 'pending') return;
    el.dataset.motionState = 'visible';
    observer?.unobserve(el);
    el.animate([
      { opacity: 0, transform: 'translateY(18px)' },
      { opacity: 1, transform: 'none' }
    ], { duration, delay, easing, fill: 'backwards' });
  }

  function prepare() {
    observer?.disconnect();
    if (preference.matches) return;
    observer = new IntersectionObserver(entries => {
      let step = 0;
      for (const entry of entries) {
        if (entry.isIntersecting) reveal(entry.target, Math.min(step++ * 60, 240));
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    const fold = innerHeight;
    let step = 0;
    main.querySelectorAll(selector).forEach(el => {
      if (el.dataset.motionState) {
        if (el.dataset.motionState === 'pending') observer.observe(el);
        return;
      }
      const box = el.getBoundingClientRect();
      if (box.bottom < 0) { el.dataset.motionState = 'visible'; return; }
      el.dataset.motionState = 'pending';
      // Ce qui est déjà à l’écran apparaît tout de suite, en léger décalé.
      if (box.top < fold && box.height) reveal(el, Math.min(step++ * 40, 160), 400);
      else observer.observe(el);
    });
    main.querySelectorAll('.refined-fold, .watch-headline').forEach(el => {
      if (el.dataset.motionBound) return;
      el.dataset.motionBound = 'true';
      el.addEventListener('toggle', () => {
        if (!el.open || preference.matches) return;
        el.querySelector('.fold-content, .watch-headline-body')?.animate(
          [{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }],
          { duration: 260, easing });
      });
    });
  }

  function showAll() {
    observer?.disconnect();
    main.querySelectorAll('[data-motion-state="pending"]').forEach(el => { el.dataset.motionState = 'visible'; });
  }

  // Un élément atteint au clavier ou par une ancre s’affiche immédiatement.
  main.addEventListener('focusin', event => {
    const el = event.target.closest('[data-motion-state="pending"]');
    if (el) reveal(el);
  });
  addEventListener('hashchange', () => {
    let target;
    try { target = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch { return; }
    const el = target?.closest('[data-motion-state="pending"]');
    if (el) reveal(el);
  });
  addEventListener('beforeprint', showAll);
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; prepare(); });
  }).observe(main, { childList: true, subtree: true });
  if (main.children.length) prepare();
  preference.addEventListener('change', () => (preference.matches ? showAll() : prepare()));
})();
