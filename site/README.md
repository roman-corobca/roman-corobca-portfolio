# Portfolio Roman COROBCA

Site statique organisé selon une séparation MVC côté navigateur.
Compatible avec GitHub Pages ; aucun PHP ni serveur de base de données n’est requis.

## Organisation

```text
index.html, atelier.html…    Points d’entrée HTML et métadonnées
models/                     Chargement, validation et préparation des données
controllers/                Navigation, affichage, interactions et animations
views/pages/                Balisage HTML des pages
views/components/           Balisage HTML réutilisable
assets/css/                 Styles et thème orange
assets/fonts/               Polices et licences de distribution
assets/                     Photo et captures
documents/                  Justificatifs et téléchargements autorisés
collections.json            Source unique des données du portfolio
```

`collections.json` reste à la racine pour conserver la compatibilité avec la mise à jour hebdomadaire de la veille. Le modèle le charge ; les contrôleurs appliquent les données aux vues HTML. Les contenus sont insérés avec `textContent`, sans exécuter du HTML fourni dans les collections.

Les vues utilisent des attributs `data-text`, `data-href`, `data-if` et des gabarits `<template data-repeat>`. Le JavaScript ne contient pas les textes HTML complets des pages. Les feuilles CSS ne sont pas intégrées au balisage.

## Modifier le site

- Contenu personnel, projets, attestations et articles : `collections.json`.
- Présentation HTML : `views/pages/` et `views/components/`.
- Couleurs et typographie : `assets/css/theme.css`.
- Mise en page : `assets/css/layout.css`.
- Animations : `controllers/motion.controller.js` et `assets/css/motion.css`.
- Navigation : `models/routes.json` et `views/components/header.html`.

Les projets supplémentaires documentés peuvent apparaître dans le catalogue et disposent d’une fiche `projet.html?id=IDENTIFIANT`. Les anciens chemins sont redirigés pour conserver les liens existants.

## Hébergement

Servir ce répertoire avec un serveur HTTP statique ou le publier sur GitHub Pages. L’ouverture directe en `file://` ne permet pas le chargement des vues et des collections.

Le projet collectif Leboncoin est un téléchargement indépendant en PHP/MySQL. Son code ne fait pas partie du moteur du portfolio.

Un site public envoie nécessairement son HTML, CSS et JavaScript au navigateur. Un dépôt public rend également ses sources accessibles sur GitHub.
