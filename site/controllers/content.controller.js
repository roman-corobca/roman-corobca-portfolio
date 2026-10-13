import { textFields } from '../models/portfolio.model.js';
import { renderComponent } from './view.controller.js';

async function appendComponents(container, component, items) {
  const clones = await Promise.all(items.map(item => renderComponent(component, item)));
  container.replaceChildren(...clones);
}

async function fillDossier(container, dossier) {
  const fields = textFields(dossier.sections || dossier).filter(field => !['url', 'title', 'id', 'status', 'date'].includes(field.title));
  if (!fields.length && !dossier.files?.length) return;
  const fieldContainer = document.createElement('div');
  fieldContainer.className = 'fields';
  await appendComponents(fieldContainer, 'field.html', fields);
  const downloadContainer = document.createElement('div');
  downloadContainer.className = 'actions';
  await appendComponents(downloadContainer, 'download.html', dossier.files || []);
  container.replaceChildren(fieldContainer, downloadContainer);
}

export async function renderCollections(main, context) {
  for (const fold of main.querySelectorAll('[data-dossier]')) {
    const dossier = context.projects.find(project => project.id === fold.dataset.dossier);
    if (dossier) await fillDossier(fold.querySelector('[data-dossier-content]'), dossier);
  }
  for (const fold of main.querySelectorAll('[data-situation]')) {
    await fillDossier(fold.querySelector('[data-situation-content]'), context.pages[fold.dataset.situation] || {});
  }
  const catalogue = main.querySelector('[data-project-catalogue]');
  if (catalogue) await appendComponents(catalogue, 'project-card.html', context.additionalProjects);
  const current = main.querySelector('[data-watch-current]');
  if (current && context.watchCurrent.length) await appendComponents(current, 'watch-article.html', context.watchCurrent);
  const archive = main.querySelector('[data-watch-archive]');
  if (archive) await appendComponents(archive, 'watch-article.html', context.watchArchive);
}

export async function renderSelectedProject(main, project) {
  await appendComponents(main.querySelector('[data-selected-fields]'), 'field.html', textFields(project.sections));
  await appendComponents(main.querySelector('[data-selected-downloads]'), 'download.html', project.files || []);
}
