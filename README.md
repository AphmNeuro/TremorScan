# TremorScan

Application : https://aphmneuro.github.io/TremorScan/

Dépôt : https://github.com/AphmNeuro/TremorScan

Prototype expérimental de mesure de périodicité vidéo, 100 % navigateur. Aucun diagnostic, serveur applicatif, compte ou télémétrie. Projet indépendant des sites PSP / Huntington voisins.

## Lancer — Node.js 20 ou plus

Depuis ce dossier :

```sh
node scripts/setup.mjs
node scripts/serve.mjs
```

Ouvrir **http://127.0.0.1:4180/**. Aucune dépendance npm obligatoire. `setup` télécharge une seule fois MediaPipe 0.10.21, son WASM et le modèle float16 v1 depuis jsDelivr et Google dans `vendor/`. Ensuite toutes les ressources sont servies localement. Le navigateur ne transmet aucun fichier vidéo. `npm run setup`, `npm run dev`, `npm test` et `npm run build` sont des alias facultatifs.

## Tests et construction

```sh
node --test tests/*.test.mjs
node scripts/build.mjs
```

Le dossier **dist/** contient le site statique complet, chemins relatifs compatibles avec un sous-dossier GitHub Pages. Pas de Vite ni de compilation TypeScript.

Résultats réellement obtenus et essais non exécutés : [docs/resultats-tests.md](docs/resultats-tests.md).

### Résultats simples (v0.3)

Une ou deux fréquences, un spectre, et les principaux indicateurs de suivi.
Deux composantes exigent un consensus anatomique et une présence simultanée ;
une harmonique possible est signalée. La vue approfondie a été retirée.
La vitesse s’adapte au matériel ; plus de 2 % de pertes observées déclenche une
reprise à 0,25×. Le gain dépend du navigateur, du téléphone et de la cadence vidéo.
Le recalcul réutilise les coordonnées. Méthode et limites : `docs/methodologie.html`.

Après génération de la vidéo de référence par le test E2E,
`node tests/spectral-ui.mjs` vérifie l’écran simplifié et les recalculs
(Playwright/Edge). `node tests/dual-pacing.test.mjs` teste les deux fréquences et
la régulation de vitesse. Le nom historique spectral-ui est conservé.

### Test vidéo navigateur (facultatif)

```sh
node scripts/setup.mjs --reference
```

Puis ouvrir **http://127.0.0.1:4180/tests/browser.html**. L’image publique de référence MediaPipe est animée et encodée dans le navigateur pour tester la chaîne vidéo. Les tests ne quittent pas le poste. Le parcours automatisé peut être exécuté avec Playwright :

```sh
npm install --no-save playwright
npx playwright install chromium
node tests/e2e.mjs
```

Garder le serveur local actif dans un autre terminal. Sur Windows, `BROWSER_CHANNEL=msedge` (variable d’environnement) permet d’utiliser Edge installé. `PLAYWRIGHT_MODULE_PATH` peut désigner un `index.mjs` Playwright existant. Captures et résultats sont écrits dans `tests/artifacts/` (ignoré par Git). Ne pas confondre ces tests avec une validation clinique ou Safari iPhone.

## Déploiement GitHub Pages

1. Créer un **nouveau dépôt** (par exemple `TremorScan`) ; placer **le contenu de ce dossier** à sa racine, y compris `.github/workflows/pages.yml`. Ne pas envoyer le dossier parent contenant les autres sites.
2. Envoyer sur la branche `main`.
3. Dans **Settings → Pages → Build and deployment → Source**, choisir **GitHub Actions**.
4. Lancer **Actions → Publish TremorScan → Run workflow**, ou pousser un commit. Le workflow télécharge les ressources, exécute les tests, construit et publie `dist/`.
5. Ouvrir l’URL de déploiement indiquée par GitHub. Le dépôt AphmNeuro/TremorScan utilise ce workflow pour sa publication.

Alternative sans Actions : publier le contenu de `dist/` à la racine d’une branche puis choisir cette branche et `/ (root)` dans Pages. Ne pas publier `tests/` ni de vidéos de patients.

## Structure

- `src/app.js`, `charts.js`, `export.js` : interface, graphiques et CSV.
- `src/video.js` : import, lecture, horodatages, limites et annulation.
- `src/worker-bootstrap.js`, `worker.js` : worker classique / MediaPipe / analyse.
- `src/tracking.js` : association des mains, extraction XY absolue et relative.
- `src/spectrum.js`, `analysis.js` : FFT, Welch, interpolation et consensus.
- `docs/methodologie.html`, `docs/validation.md` : méthode et limites.
- `tests/` : tests numériques, suivi, exports et intégration navigateur.

## Limites

30 premières secondes, 600 Mo au maximum ; lecture ralentie à 0,25×. Cadence effective réduite sur matériel lent. MP4/MOV/HEVC selon le décodeur du navigateur ; aucun transcodage embarqué. `requestVideoFrameCallback`, Worker, WebAssembly et `createImageBitmap` requis. Vidéos au ralenti/éditées déconseillées : fréquence exprimée dans leur temps de présentation. Caméra non compensée, aliasing possible, mouvements hors plan / petites amplitudes non validés. Le modèle anatomique n’a pas été conçu comme instrument de métrologie. Une estimation incertaine reste un résultat attendu. Voir la méthode pour les seuils exacts, non calibrés cliniquement.

## Ressources tierces

MediaPipe Tasks Vision : Apache-2.0 (Google), https://www.npmjs.com/package/@mediapipe/tasks-vision . Modèle officiel : https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker . Image optionnelle issue du notebook d’exemple Google : https://github.com/google-ai-edge/mediapipe-samples/blob/main/examples/hand_landmarker/python/hand_landmarker.ipynb . L’image de test n’est pas intégrée au build de production. Les ressources versionnées téléchargées restent inchangées ; consulter leurs conditions avant redistribution dans un autre contexte.
