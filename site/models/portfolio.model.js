/** Données du portfolio : une seule collection, sans copie de secours dans le code. */
export async function loadPortfolio() {
  const response = await fetch(new URL('../collections.json', import.meta.url), { cache: 'no-store' });
  if (!response.ok) throw new Error('Chargement des collections impossible.');
  const data = await response.json();
  for (const key of ['projects', 'certifications', 'watch', 'e5']) {
    if (!Array.isArray(data[key])) throw new Error(`Collection invalide : ${key}`);
  }
  if (!data.profile || !data.pages) throw new Error('Profil ou pages manquants.');
  return data;
}

export async function loadRoutes() {
  const response = await fetch(new URL('./routes.json', import.meta.url), { cache: 'no-cache' });
  if (!response.ok) throw new Error('Chargement de la navigation impossible.');
  return response.json();
}

export function readValue(scope, path) {
  if (path === '.') return scope;
  return path.split('.').reduce((value, key) => value?.[key], scope);
}

export function textFields(sections = {}) {
  return Object.entries(sections)
    .filter(([, value]) => typeof value === 'string' && value.trim())
    .map(([title, text]) => ({ title, text }));
}

export function newestFirst(items) {
  return [...items].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

export function viewContext(data) {
  const featuredProject = data.projects.find(project => project.id === 'leboncoin-groupe');
  const detailNames = ['Contexte et objectif', 'Fonctionnalités présentes dans le code', 'Architecture', 'Base de données'];
  const articles = newestFirst(data.watch);
  const week = articles.map(article => article.week || article.consulted || article.date || '').sort().reverse()[0];
  const watchCurrent = articles.filter(article => (article.week || article.consulted || article.date || '') === week).slice(0, 5);
  const currentIds = new Set(watchCurrent.map(article => article.id));
  return {
    ...data,
    certifications: newestFirst(data.certifications),
    featuredProject,
    featuredDetails: featuredProject ? textFields(featuredProject.sections).filter(field => detailNames.includes(field.title)) : [],
    additionalProjects: newestFirst(data.projects.filter(project =>
      project.id !== 'leboncoin-groupe' && project.status !== 'À compléter'
      && (project.files?.length || project.images?.length || textFields(project.sections).length))),
    watchCurrent,
    watchArchive: articles.filter(article => !currentIds.has(article.id))
  };
}

export function frenchDate(value) {
  if (!value) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return String(value);
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('fr-FR');
}

export function safeLink(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value, location.href);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}
