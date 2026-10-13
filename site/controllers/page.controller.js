import { loadPortfolio, loadRoutes, viewContext } from '../models/portfolio.model.js';
import { renderInto } from './view.controller.js';
import { renderCollections, renderSelectedProject } from './content.controller.js';
import { bindCv, bindNavigation, revealHash } from './interactions.controller.js';
import './motion.controller.js';

const main = document.querySelector('main');

async function boot() {
  try {
    const routes = await loadRoutes();
    const key = (location.pathname.split('/').pop() || 'index.html').replace(/\.html$/, '');
    if (routes.redirects[key]) { location.replace(routes.redirects[key]); return; }
    if (key === 'article') {
      const id = new URLSearchParams(location.search).get('id') || '';
      location.replace(`veille.html#article-${encodeURIComponent(id)}`);
      return;
    }
    const title = routes.pages.find(([page]) => page === key)?.[1];
    if (!title && key !== 'projet') throw new Error('Cette page n’existe pas.');
    const data = await loadPortfolio();
    const context = viewContext(data);
    let selectedProject;
    if (key === 'projet') {
      selectedProject = data.projects.find(project => project.id === new URLSearchParams(location.search).get('id'));
      if (!selectedProject) throw new Error('Projet introuvable.');
    }
    await Promise.all([
      renderInto(document.querySelector('[data-layout="header"]'), 'components/header.html', context),
      renderInto(document.querySelector('[data-layout="footer"]'), 'components/footer.html', context),
      renderInto(main, `pages/${key}.html`, selectedProject || context)
    ]);
    if (selectedProject) await renderSelectedProject(main, selectedProject);
    else await renderCollections(main, context);
    document.title = `${selectedProject?.title || title} | roman-corobca-portfolio`;
    bindCv(main);
    bindNavigation(main, key);
    revealHash(main);
  } catch (error) {
    console.error(error);
    const message = document.createElement('p');
    message.className = 'notice';
    message.textContent = 'Cette page ne peut pas être affichée pour le moment. Rechargez la page ou revenez à l’accueil.';
    const home = document.createElement('a');
    home.className = 'btn';
    home.href = 'index.html';
    home.textContent = 'Retour à l’accueil';
    main.replaceChildren(message, home);
  } finally {
    main.setAttribute('aria-busy', 'false');
  }
}

boot();
