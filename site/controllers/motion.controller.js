// Entrées et sorties latérales ; aucun masquage si les animations sont indisponibles.
(() => {
  const main = document.querySelector('main');
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  if (!main || !Element.prototype.animate || !('IntersectionObserver' in window)) return;
  const states = new Map();
  let observer;
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
  function transition(el, show, delay = 0) {
    const state = states.get(el);
    if (!state || state.visible === show || preference.matches) return;
    const distance = innerWidth < 760 ? 28 : 60;
    const from = state.visible === null
      ? { opacity: 0, transform: `translateX(${state.side * distance}px)` }
      : { opacity: getComputedStyle(el).opacity, transform: getComputedStyle(el).transform };
    state.animation?.cancel();
    state.visible = show;
    el.dataset.motionState = show ? 'entering' : 'leaving';
    state.animation = el.animate([from,
      { opacity: show ? 1 : 0, transform: `translateX(${show ? 0 : state.side * distance}px)` }
    ], { duration: show ? 640 : 340, delay: show ? delay : 0,
      easing: 'cubic-bezier(.2,.7,.25,1)', fill: 'both' });
    const animation = state.animation;
    animation.finished.then(() => {
      if (state.animation !== animation) return;
      el.dataset.motionState = show ? 'visible' : 'outside';
      if (show) { animation.cancel(); state.animation = null; }
    }, () => {});
  }
  function prepare() {
    observer?.disconnect();
    for (const [el, state] of states) {
      if (!main.contains(el)) { state.animation?.cancel(); states.delete(el); }
    }
    if (preference.matches) return;
    observer = new IntersectionObserver(entries => {
      let step = 0;
      for (const entry of entries) {
        const state = states.get(entry.target);
        if (!state) continue;
        if (entry.isIntersecting && entry.intersectionRatio >= .18) {
          transition(entry.target, true, Math.min(step++ * 55, 220));
        } else if (state.visible === true && entry.intersectionRatio <= .08
          && !entry.target.contains(document.activeElement)) {
          transition(entry.target, false);
        }
      }
    }, { threshold: [0, .08, .18], rootMargin: '0px 0px -12px 0px' });
    main.querySelectorAll(selector).forEach((el, index) => {
      if (!states.has(el)) {
        const side = el.closest('.hero-copy') ? -1
          : el.classList.contains('portrait-panel') ? 1 : index % 2 ? 1 : -1;
        states.set(el, { visible: null, side, animation: null });
        el.dataset.motionSide = side < 0 ? 'left' : 'right';
      }
      observer.observe(el);
    });
    main.querySelectorAll('.refined-fold, .watch-headline').forEach(el => {
      if (el.dataset.motionBound) return;
      el.dataset.motionBound = 'true';
      el.addEventListener('toggle', () => {
        if (!el.open || preference.matches) return;
        const body = el.querySelector('.fold-content, .watch-headline-body');
        body?.animate([{ opacity: 0, transform: 'translateX(-12px)' },
          { opacity: 1, transform: 'translateX(0)' }], { duration: 280, easing: 'ease-out' });
      });
    });
  }
  main.addEventListener('focusin', event => {
    for (const [el, state] of states) {
      if (el.contains(event.target) && state.visible === false) transition(el, true);
    }
  });
  new MutationObserver(prepare).observe(main, { childList: true });
  if (main.children.length) prepare();
  preference.addEventListener('change', () => {
    observer?.disconnect();
    for (const [el, state] of states) {
      state.animation?.cancel(); state.animation = null; state.visible = null;
      el.removeAttribute('data-motion-state');
    }
    if (!preference.matches) prepare();
  });
})();
