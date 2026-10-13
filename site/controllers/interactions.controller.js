export function bindCv(main) {
  const button = main.querySelector('#cv-toggle');
  const viewer = main.querySelector('#cv-inline');
  if (!button || !viewer) return;
  button.addEventListener('click', () => {
    const open = viewer.hidden;
    viewer.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    button.querySelector('[data-cv-label]').textContent = open ? 'Masquer mon CV' : 'Voir mon CV';
    button.querySelector('[data-cv-icon="eye"]').hidden = open;
    button.querySelector('[data-cv-icon="close"]').hidden = !open;
    if (open) {
      const frame = viewer.querySelector('iframe');
      if (!frame.getAttribute('src')) frame.src = frame.dataset.src;
      viewer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

export function revealHash(main) {
  let id;
  try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
  if (!id) return;
  if (id === 'cv' || id === 'cv-inline') {
    if (main.querySelector('#cv-inline')?.hidden) main.querySelector('#cv-toggle')?.click();
    return;
  }
  const target = document.getElementById(id);
  if (!target) return;
  for (let node = target; node; node = node.parentElement) {
    if (node.tagName === 'DETAILS') node.open = true;
  }
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function bindNavigation(main, page) {
  document.querySelectorAll('header a').forEach(link => {
    if (link.getAttribute('href') === `${page}.html`) link.setAttribute('aria-current', 'page');
  });
  main.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    if (!link) return;
    let id;
    try { id = decodeURIComponent(link.getAttribute('href').slice(1)); } catch { return; }
    const target = document.getElementById(id);
    if (target?.tagName === 'DETAILS') target.open = true;
  });
  window.addEventListener('hashchange', () => revealHash(main));
}
