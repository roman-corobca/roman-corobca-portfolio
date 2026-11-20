# Portfolio de Roman COROBCA — instructions pour Claude

Portfolio BTS SIO option SISR (IPSSI Paris), en ligne sur GitHub Pages :
https://roman-corobca.github.io/roman-corobca-portfolio/

Réponds en français, avec des explications simples et courtes.

## Fonctionnement
- Site 100 % statique dans `site/` (HTML, CSS, JavaScript en modules), sans framework ni étape de build.
- Publication automatique par `.github/workflows/pages.yml` à chaque push sur `main`.
- Organisation MVC côté navigateur, détaillée dans `site/README.md` :
  - `site/collections.json` : source unique des contenus (profil, projets, certifications, veille, épreuves E5) ;
  - `site/views/pages/` et `site/views/components/` : le balisage HTML, avec les attributs `data-text`, `data-href`, `data-if` et `<template data-repeat>` ;
  - `site/controllers/` : rendu, interactions, animations ;
  - `site/models/routes.json` : les pages et les anciennes adresses redirigées.
- Chaque page réelle (`index`, `epreuves`, `atelier`, `veille`, `certifications`, `contact`, `projet`) est une coquille HTML qui précharge ses données et ses vues avec des `<link rel="preload">`. Si tu ajoutes une page, ajoute-lui les mêmes préchargements, sa route dans `routes.json` et sa vue dans `views/pages/`.
- Les autres fichiers HTML à la racine de `site/` ne font que rediriger vers les nouvelles adresses.

## Règles
- Ne jamais insérer de HTML venant de `collections.json` : on utilise toujours `textContent`.
- Les images vont dans `site/assets/` au format WebP. On garde le PNG d'origine à côté.
- Après une modification de CSS ou de JS, mets à jour le paramètre `?v=AAAAMMJJ` dans les fichiers HTML de `site/`.
- Les animations doivent respecter `prefers-reduced-motion` et ne jamais laisser du contenu masqué.
- Pour tester en local : `cd site && python3 -m http.server`, puis ouvrir http://localhost:8000. L'ouverture directe en `file://` ne fonctionne pas.
- Travaille sur une branche et ouvre une pull request : Roman valide lui-même la fusion dans `main`.
- Le formulaire de contact est désactivé (GitHub Pages n'envoie pas d'e-mails) et le champ `profile.email` est vide pour l'instant.
