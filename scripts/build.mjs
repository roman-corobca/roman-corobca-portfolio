#!/usr/bin/env node
// Génère le site statique pré-rendu (dist/) à partir de site/collections.json et des vues.
// Aucun module externe : Node 20+ suffit. Usage : node scripts/build.mjs
// Variables facultatives : SITE_URL (adresse publique, terminée par /), OUT_DIR (dossier de sortie).
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readValue, textFields, viewContext, frenchDate } from '../site/models/portfolio.model.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = join(ROOT, 'site');
const OUT = resolve(ROOT, process.env.OUT_DIR || 'dist');
const SITE_URL = (process.env.SITE_URL || 'https://roman-corobca.github.io/roman-corobca-portfolio/').replace(/\/?$/, '/');
const SITE_NAME = 'roman-corobca-portfolio';
const DEFAULT_IMAGE = 'assets/roman-corobca-cv.png';

/* ---------- Mini-DOM : analyse des vues HTML locales (balisage contrôlé) ---------- */

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const TOKEN = /<!--[\s\S]*?-->|<\/([a-zA-Z][\w:-]*)\s*>|<([a-zA-Z][\w:-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>/g;
const ATTR = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

const decode = value => value.replace(/&(#x[0-9a-f]+|#\d+|amp|quot|lt|gt|apos);/gi, (_, code) => {
  const named = { amp: '&', quot: '"', lt: '<', gt: '>', apos: "'" }[code.toLowerCase()];
  if (named) return named;
  return String.fromCodePoint(code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10));
});
const escapeText = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttr = value => escapeText(value).replace(/"/g, '&quot;');

function fragment(children = []) {
  const node = { type: 'root', children: [] };
  append(node, children);
  return node;
}
function append(parent, nodes) {
  for (const node of nodes) { node.parent = parent; parent.children.push(node); }
}

export function parse(html, source = 'vue') {
  const root = fragment();
  const stack = [root];
  let last = 0;
  let match;
  TOKEN.lastIndex = 0;
  const top = () => stack[stack.length - 1];
  while ((match = TOKEN.exec(html))) {
    if (match.index > last) append(top(), [{ type: 'raw', value: html.slice(last, match.index) }]);
    last = TOKEN.lastIndex;
    const [whole, closing, opening, rawAttrs, selfClosing] = match;
    if (whole.startsWith('<!--')) { append(top(), [{ type: 'raw', value: whole }]); continue; }
    if (closing) {
      const name = closing.toLowerCase();
      const index = stack.findLastIndex(node => node.tag === name);
      if (index < 1) throw new Error(`${source} : balise fermante </${name}> sans ouverture`);
      stack.length = index;
      continue;
    }
    const element = { type: 'element', tag: opening.toLowerCase(), attrs: new Map(), children: [] };
    ATTR.lastIndex = 0;
    let attr;
    while ((attr = ATTR.exec(rawAttrs))) {
      const value = attr[2] ?? attr[3] ?? attr[4];
      element.attrs.set(attr[1].toLowerCase(), value === undefined ? '' : decode(value));
    }
    append(top(), [element]);
    if (!VOID.has(element.tag) && !selfClosing) stack.push(element);
  }
  if (last < html.length) append(top(), [{ type: 'raw', value: html.slice(last) }]);
  if (stack.length > 1) throw new Error(`${source} : balise <${top().tag}> non fermée`);
  return root;
}

function serialize(node) {
  if (node.type === 'raw') return node.value;
  if (node.type === 'text') return escapeText(node.value);
  const inner = node.children.map(serialize).join('');
  if (node.type === 'root') return inner;
  const attrs = [...node.attrs].map(([name, value]) => value === '' ? ` ${name}` : ` ${name}="${escapeAttr(value)}"`).join('');
  return VOID.has(node.tag) ? `<${node.tag}${attrs}>` : `<${node.tag}${attrs}>${inner}</${node.tag}>`;
}

function clone(node) {
  const copy = { ...node };
  if (node.attrs) copy.attrs = new Map(node.attrs);
  if (node.children) { copy.children = []; append(copy, node.children.map(clone)); }
  return copy;
}

// Équivalent de querySelectorAll : ne descend pas dans le contenu des <template>.
function descendants(root, predicate) {
  const found = [];
  const walk = node => {
    for (const child of node.children || []) {
      if (child.type !== 'element') continue;
      if (predicate(child)) found.push(child);
      if (child.tag !== 'template') walk(child);
    }
  };
  walk(root);
  return found;
}
const withAttr = (root, name) => descendants(root, el => el.attrs.has(name));
const setText = (el, value) => { el.children = []; append(el, [{ type: 'text', value }]); };
const setHidden = (el, hidden) => hidden ? el.attrs.set('hidden', '') : el.attrs.delete('hidden');
function replaceChildren(el, nodes) { el.children = []; append(el, nodes); }

/* ---------- Rendu : reproduit view.controller.js et content.controller.js ---------- */

function safeLink(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value, 'https://relative.invalid/');
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return /^[a-z][a-z0-9+.-]*:/i.test(value.trim()) || value.trim().startsWith('//') ? url.href : value.trim();
  } catch { return null; }
}
const hasContent = value => Array.isArray(value) ? value.length > 0 : Boolean(value);
const projectFile = id => `projet-${id}.html`;

function hydrate(root, scope) {
  for (const el of descendants(root, el => el.attrs.has('data-if') || el.attrs.has('data-unless'))) {
    const positive = el.attrs.has('data-if');
    const value = readValue(scope, el.attrs.get(positive ? 'data-if' : 'data-unless'));
    setHidden(el, positive ? !hasContent(value) : hasContent(value));
  }
  for (const el of withAttr(root, 'data-text')) {
    let value = readValue(scope, el.attrs.get('data-text'));
    if (el.attrs.get('data-format') === 'date') value = frenchDate(value);
    setText(el, Array.isArray(value) ? value.join(' · ') : String(value ?? ''));
  }
  for (const [name, target] of [['data-href', 'href'], ['data-image', 'src']]) {
    for (const el of withAttr(root, name)) {
      const url = safeLink(readValue(scope, el.attrs.get(name)));
      if (url) el.attrs.set(target, url);
      else { el.attrs.delete(target); setHidden(el, true); }
    }
  }
  for (const el of withAttr(root, 'data-id')) el.attrs.set('id', String(readValue(scope, el.attrs.get('data-id')) ?? ''));
  for (const el of withAttr(root, 'data-watch-id')) el.attrs.set('id', `article-${readValue(scope, el.attrs.get('data-watch-id')) ?? ''}`);
  for (const el of withAttr(root, 'data-project-link')) {
    el.attrs.set('href', projectFile(readValue(scope, el.attrs.get('data-project-link')) ?? ''));
  }
  for (const el of withAttr(root, 'data-current')) {
    const classes = new Set((el.attrs.get('class') || '').split(/\s+/).filter(Boolean));
    if (readValue(scope, el.attrs.get('data-current'))) classes.add('is-current'); else classes.delete('is-current');
    el.attrs.set('class', [...classes].join(' '));
  }
  for (const el of withAttr(root, 'data-pdf')) {
    const url = safeLink(readValue(scope, el.attrs.get('data-pdf')));
    if (url) el.attrs.set('data-src', url);
  }
  for (const template of descendants(root, el => el.tag === 'template' && el.attrs.has('data-repeat'))) {
    const items = readValue(scope, template.attrs.get('data-repeat'));
    const parent = template.parent;
    const output = [];
    if (Array.isArray(items)) {
      for (const item of items) output.push(...hydrate(fragment(template.children.map(clone)), item).children);
    }
    const index = parent.children.indexOf(template);
    for (const node of output) node.parent = parent;
    parent.children.splice(index, 1, ...output);
  }
  return root;
}

const viewCache = new Map();
function view(path) {
  if (!viewCache.has(path)) viewCache.set(path, parse(readFileSync(join(SITE, 'views', path), 'utf8'), path));
  return clone(viewCache.get(path));
}
const component = (path, scope) => hydrate(view(`components/${path}`), scope).children;
const components = (path, items) => items.flatMap(item => component(path, item));
const first = (root, name, value) => descendants(root, el => el.attrs.has(name) && (value === undefined || el.attrs.get(name) === value))[0];

function fillDossier(container, dossier) {
  const fields = textFields(dossier.sections || dossier).filter(field => !['url', 'title', 'id', 'status', 'date'].includes(field.title));
  if (!container || (!fields.length && !dossier.files?.length)) return;
  const fieldBox = { type: 'element', tag: 'div', attrs: new Map([['class', 'fields']]), children: [] };
  append(fieldBox, components('field.html', fields));
  const downloadBox = { type: 'element', tag: 'div', attrs: new Map([['class', 'actions']]), children: [] };
  append(downloadBox, components('download.html', dossier.files || []));
  replaceChildren(container, [fieldBox, downloadBox]);
}

function renderCollections(main, context) {
  for (const fold of withAttr(main, 'data-dossier')) {
    const dossier = context.projects.find(project => project.id === fold.attrs.get('data-dossier'));
    if (dossier) fillDossier(first(fold, 'data-dossier-content'), dossier);
  }
  for (const fold of withAttr(main, 'data-situation')) {
    fillDossier(first(fold, 'data-situation-content'), context.pages[fold.attrs.get('data-situation')] || {});
  }
  const catalogue = first(main, 'data-project-catalogue');
  if (catalogue) replaceChildren(catalogue, components('project-card.html', context.additionalProjects));
  const current = first(main, 'data-watch-current');
  if (current && context.watchCurrent.length) replaceChildren(current, components('watch-article.html', context.watchCurrent));
  const archive = first(main, 'data-watch-archive');
  if (archive) replaceChildren(archive, components('watch-article.html', context.watchArchive));
}

function renderSelectedProject(main, project) {
  replaceChildren(first(main, 'data-selected-fields'), components('field.html', textFields(project.sections)));
  replaceChildren(first(main, 'data-selected-downloads'), components('download.html', project.files || []));
}

function renderHeader(context, currentFile) {
  const header = hydrate(view('components/header.html'), context);
  for (const link of descendants(header, el => el.tag === 'a' && el.attrs.get('href') === currentFile)) {
    link.attrs.set('aria-current', 'page');
  }
  return serialize(header);
}

/* ---------- Pages complètes ---------- */

const absolute = path => new URL(path, SITE_URL).href;
function summarize(text, max = 160) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).replace(/\s+\S*$/, '')}…`;
}
function replaceOnce(html, pattern, replacement, label) {
  if (!pattern.test(html)) throw new Error(`Gabarit de page : ${label} introuvable`);
  return html.replace(pattern, () => replacement);
}
function inlineJson(value) { return JSON.stringify(value).replace(/</g, '\\u003c'); }

// Les éléments animés sont masqués jusqu’au premier passage de motion.controller.js,
// pour éviter un clignotement maintenant que le contenu est présent dès l’affichage.
function motionGuard() {
  const source = readFileSync(join(SITE, 'controllers', 'motion.controller.js'), 'utf8');
  const list = source.match(/const selector = \[([\s\S]*?)\]\.join/);
  if (!list) throw new Error('Liste des éléments animés introuvable dans motion.controller.js');
  const selectors = [...list[1].matchAll(/'([^']+)'/g)].map(m => m[1]).join(',');
  return `<style>html.motion-pending main :is(${selectors}){opacity:0}</style>\n`
    + `<script>(function(d){try{if(matchMedia('(prefers-reduced-motion: reduce)').matches||!Element.prototype.animate||!('IntersectionObserver' in window))return;d.classList.add('motion-pending');setTimeout(function(){d.classList.remove('motion-pending')},2500)}catch(e){}})(document.documentElement)</script>\n`;
}

function buildPage({ shell, file, title, description, image, type = 'website', header, main, footer, guard }) {
  const url = absolute(file === 'index.html' ? './' : file);
  const meta = [
    `<link rel="canonical" href="${escapeAttr(url)}">`,
    `<meta property="og:type" content="${type}">`,
    `<meta property="og:locale" content="fr_FR">`,
    `<meta property="og:title" content="${escapeAttr(title)}">`,
    `<meta property="og:description" content="${escapeAttr(description)}">`,
    `<meta property="og:url" content="${escapeAttr(url)}">`,
    `<meta property="og:image" content="${escapeAttr(absolute(image))}">`,
    `<meta name="twitter:card" content="summary_large_image">`
  ].join('\n');
  let html = shell;
  html = replaceOnce(html, /<title>[\s\S]*?<\/title>/, `<title>${escapeText(title)}</title>`, 'title');
  html = replaceOnce(html, /<meta name="description" content="[^"]*">/, `<meta name="description" content="${escapeAttr(description)}">`, 'description');
  const siteName = html.match(/<meta property="og:site_name"[^>]*>/)?.[0] || '';
  html = replaceOnce(html, /<meta property="og:site_name"[^>]*>/, `${siteName}\n${meta}`, 'og:site_name');
  html = replaceOnce(html, /<\/head>/, `${guard}</head>`, '</head>');
  html = replaceOnce(html, /<header data-layout="header">[\s\S]*?<\/header>/, `<header data-layout="header">${header}</header>`, 'header');
  html = replaceOnce(html, /<main id="main" tabindex="-1" aria-busy="true">[\s\S]*?<\/main>/,
    `<main id="main" tabindex="-1" aria-busy="false" data-rendered="static">${main}</main>`, 'main');
  html = replaceOnce(html, /\s*<noscript>[\s\S]*?<\/noscript>/, '', 'noscript');
  html = replaceOnce(html, /<footer data-layout="footer">[\s\S]*?<\/footer>/, `<footer data-layout="footer">${footer}</footer>`, 'footer');
  return html;
}

function redirectPage(target, script) {
  const href = escapeAttr(target);
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="robots" content="noindex">
<title>Redirection | ${SITE_NAME}</title>
<link rel="canonical" href="${escapeAttr(absolute(target.split('#')[0]))}">
<script>${script || `location.replace(${inlineJson(target)})`}</script>
<noscript><meta http-equiv="refresh" content="0; url=${href}"></noscript>
</head>
<body>
<p>Cette page a été déplacée : <a href="${href}">continuer</a>.</p>
</body>
</html>
`;
}

function checkRendered(file, html) {
  const main = html.match(/<main[^>]*>([\s\S]*)<\/main>/)?.[1] || '';
  const text = main.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (text.length < 40) throw new Error(`${file} : contenu principal vide après rendu`);
  if (/<template[^>]*data-repeat/.test(main)) throw new Error(`${file} : gabarit data-repeat non résolu`);
}

function build() {
  const data = JSON.parse(readFileSync(join(SITE, 'collections.json'), 'utf8'));
  for (const key of ['projects', 'certifications', 'watch', 'e5']) {
    if (!Array.isArray(data[key])) throw new Error(`Collection invalide : ${key}`);
  }
  if (!data.profile || !data.pages) throw new Error('Profil ou pages manquants.');
  const routes = JSON.parse(readFileSync(join(SITE, 'models', 'routes.json'), 'utf8'));
  const context = viewContext(data);
  const footer = serialize(hydrate(view('components/footer.html'), context));
  const guard = motionGuard();
  const shellOf = page => readFileSync(join(SITE, `${page}.html`), 'utf8');
  const descriptionOf = shell => decode(shell.match(/<meta name="description" content="([^"]*)">/)?.[1] || '');

  // On vide le dossier sans le supprimer (un serveur local peut l’utiliser sous Windows).
  mkdirSync(OUT, { recursive: true });
  for (const entry of readdirSync(OUT)) rmSync(join(OUT, entry), { recursive: true, force: true });
  cpSync(SITE, OUT, { recursive: true, filter: source => !/[\\/]package\.json$/.test(source) });

  const written = [];
  const write = (file, html) => { writeFileSync(join(OUT, file), html); written.push(file); };

  for (const [page, label] of routes.pages) {
    const file = `${page}.html`;
    const shell = shellOf(page);
    const main = hydrate(view(`pages/${page}.html`), context);
    renderCollections(main, context);
    const html = buildPage({
      shell, file, title: `${label} | ${SITE_NAME}`, description: descriptionOf(shell), image: DEFAULT_IMAGE,
      header: renderHeader(context, file), main: serialize(main), footer, guard
    });
    checkRendered(file, html);
    write(file, html);
  }

  const projectShell = shellOf('projet');
  const ids = [];
  for (const project of data.projects) {
    if (!/^[a-z0-9][a-z0-9-]*$/i.test(project.id || '')) throw new Error(`Identifiant de projet invalide pour un nom de fichier : « ${project.id} »`);
    if (routes.pages.some(([page]) => projectFile(project.id) === `${page}.html`)) throw new Error(`Conflit de nom : ${project.id}`);
    ids.push(project.id);
    const file = projectFile(project.id);
    const main = hydrate(view('pages/projet.html'), project);
    renderSelectedProject(main, project);
    const image = project.images?.map(safeLink).find(url => url && !/^https?:/i.test(url)) || DEFAULT_IMAGE;
    const html = buildPage({
      shell: projectShell, file, type: 'article', title: `${project.title} | ${SITE_NAME}`,
      description: summarize(project.description) || descriptionOf(projectShell), image,
      header: renderHeader(context, file), main: serialize(main), footer, guard
    });
    checkRendered(file, html);
    write(file, html);
  }

  // Anciennes adresses : mêmes destinations que page.controller.js.
  for (const [from, to] of Object.entries(routes.redirects)) write(`${from}.html`, redirectPage(to));
  write('projet.html', redirectPage('atelier.html',
    `var ids=${inlineJson(ids)},id=new URLSearchParams(location.search).get('id')||'';`
    + `location.replace(ids.indexOf(id)>-1?'projet-'+id+'.html':'atelier.html')`));
  write('article.html', redirectPage('veille.html',
    `location.replace('veille.html#article-'+encodeURIComponent(new URLSearchParams(location.search).get('id')||''))`));

  const indexed = [...routes.pages.map(([page]) => `${page}.html`), ...ids.map(projectFile)];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${
    indexed.map(file => `  <url><loc>${escapeText(absolute(file === 'index.html' ? './' : file))}</loc></url>`).join('\n')}\n</urlset>\n`;
  writeFileSync(join(OUT, 'sitemap.xml'), sitemap);

  if (!existsSync(join(OUT, '.nojekyll'))) writeFileSync(join(OUT, '.nojekyll'), '');
  console.log(`Site généré dans ${OUT} : ${written.length} pages HTML (${ids.length} fiches projet), sitemap.xml.`);
}

build();
