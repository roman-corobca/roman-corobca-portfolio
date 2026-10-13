import { readValue, frenchDate, safeLink } from '../models/portfolio.model.js';

// Les gabarits sont dans views/ ; aucune chaîne de balisage HTML n’est générée ici.
const templates = new Map();

export async function loadView(path) {
  if (!templates.has(path)) {
    templates.set(path, fetch(new URL(`../views/${path}`, import.meta.url), { cache: 'no-cache' })
      .then(response => {
        if (!response.ok) throw new Error(`Vue introuvable : ${path}`);
        return response.text();
      }));
  }
  return templates.get(path);
}

function hasContent(value) {
  return Array.isArray(value) ? value.length > 0 : Boolean(value);
}

export function hydrate(root, scope) {
  for (const element of root.querySelectorAll('[data-if], [data-unless]')) {
    const positive = element.hasAttribute('data-if');
    const value = readValue(scope, element.getAttribute(positive ? 'data-if' : 'data-unless'));
    element.hidden = positive ? !hasContent(value) : hasContent(value);
  }
  for (const element of root.querySelectorAll('[data-text]')) {
    let value = readValue(scope, element.dataset.text);
    if (element.dataset.format === 'date') value = frenchDate(value);
    element.textContent = Array.isArray(value) ? value.join(' · ') : String(value ?? '');
  }
  for (const element of root.querySelectorAll('[data-href]')) {
    const url = safeLink(readValue(scope, element.dataset.href));
    if (url) element.setAttribute('href', url);
    else { element.removeAttribute('href'); element.hidden = true; }
  }
  for (const element of root.querySelectorAll('[data-image]')) {
    const url = safeLink(readValue(scope, element.dataset.image));
    if (url) element.setAttribute('src', url);
    else { element.removeAttribute('src'); element.hidden = true; }
  }
  for (const element of root.querySelectorAll('[data-id]')) {
    element.id = String(readValue(scope, element.dataset.id) ?? '');
  }
  for (const element of root.querySelectorAll('[data-watch-id]')) {
    element.id = `article-${readValue(scope, element.dataset.watchId) ?? ''}`;
  }
  for (const element of root.querySelectorAll('[data-project-link]')) {
    element.href = `projet.html?id=${encodeURIComponent(readValue(scope, element.dataset.projectLink) ?? '')}`;
  }
  for (const element of root.querySelectorAll('[data-current]')) {
    element.classList.toggle('is-current', Boolean(readValue(scope, element.dataset.current)));
  }
  for (const element of root.querySelectorAll('[data-pdf]')) {
    const url = safeLink(readValue(scope, element.dataset.pdf));
    if (url) element.dataset.src = url;
  }
  // Le contenu d’un <template> n’est pas parcouru par querySelectorAll du parent.
  for (const template of root.querySelectorAll('template[data-repeat]')) {
    const items = readValue(scope, template.dataset.repeat);
    if (Array.isArray(items)) {
      for (const item of items) {
        const clone = template.content.cloneNode(true);
        hydrate(clone, item);
        template.before(clone);
      }
    }
    template.remove();
  }
  return root;
}

export async function renderComponent(path, scope) {
  const template = document.createElement('template');
  // Source HTML locale et contrôlée, jamais du HTML issu des collections utilisateur.
  template.innerHTML = await loadView(`components/${path}`);
  return hydrate(template.content.cloneNode(true), scope);
}

export async function renderInto(container, path, scope) {
  const template = document.createElement('template');
  template.innerHTML = await loadView(path);
  container.replaceChildren(hydrate(template.content.cloneNode(true), scope));
}
