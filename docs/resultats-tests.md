# Essais exécutés le 9 octobre 2026

- **Node 24.19.0 / Windows** : 33 tests automatiques réussis ; aucun échec. Les cas idéaux 3, 5, 8 et 12 Hz à 60 et 120 Hz respectent l’erreur maximale de 0,2 Hz demandée. Les limites du cas 12 Hz à 30 Hz sont précisées dans `validation.md`.
- **Microsoft Edge 154.0.4258.62, headless** : photographie publique MediaPipe animée à 5 Hz, encodée en WebM puis décodée et analysée. 702 images analysées ; deux mains suivies, 21 coordonnées par image et par main. Fréquences obtenues : 4,999907 et 4,999891 Hz lors du test de référence.
- **Application complète** : le même fichier a été importé par le champ fichier utilisateur. Résultats affichés : 5,0 Hz pour les deux mains ; durée exploitable 11,5 s, cadence reconstruite 58,8 Hz, 21 points contributifs. Graphiques présents, CSV des points téléchargé, vidéo et résultats effacés avec le bouton prévu.
- **Affichage étroit** : capture et absence de débordement horizontal vérifiées à 390 × 844 pixels dans Chromium. Capture bureau également examinée. Ceci n’est pas un test sur iPhone réel.
- **Cas d’erreur** : faux fichier MOV refusé avec message compréhensible. Vidéo synthétique sans main : 712 images analysées, aucun suivi, aucune fréquence produite.
- **Confidentialité technique** : aucune requête HTTP externe déclenchée pendant le parcours d’analyse ; aucune erreur JavaScript non gérée. Code d’application sans mécanisme d’envoi de vidéo/coordonnées, télémétrie ou stockage persistant.
- **Cycle de vie et build** : construction réussie ; chargement depuis `/dist/`, paramètres invalides, annulation au démarrage et pendant le suivi, restauration des contrôles vidéo, effacement et lien de documentation testés avec succès.

Captures, logs, CSV et vidéo synthétique sont disponibles localement dans `tests/artifacts/` et exclus du dépôt de production. Les petits pics secondaires ont ensuite été filtrés à 10 % de la puissance principale et rapport pic/fond ≥6 ; les tests numériques ont été relancés avec succès. Ce filtre ne change pas l’estimation principale.

## Mise à jour v0.2 — 9 octobre 2026

- 38 tests numériques passent, dont la puissance/RMS d’une sinusoïde connue,
  les relations harmoniques possibles, la dispersion d’un signal passant de 5 à
  8 Hz, les limites de bande et l’export des spectres.
- Test Edge à 390 × 844 : 698 images de la vidéo synthétique traitées, 5,0 Hz
  pour les deux mains. Coordonnées CSV strictement identiques avant/après recalcul,
  même fréquence, changement de bande 3–12 Hz effectif. Un seul chargement du
  modèle. Recalcul mesuré à 253 ms sur ce poste (hors export) ; ce chiffre ne
  prédit pas la performance sur iPhone ni celle de la première détection.
- Spectrogramme, tableau des pics, exports CSV et absence de débordement mobile
  contrôlés. Tests d’annulation, paramètres invalides et effacement passent.
- Le correctif Safari précédent a été confirmé fonctionnel par l’utilisateur
  sur son appareil. Cela ne couvre pas tous les modèles et versions d’iOS.

## Mise à jour v0.3 — 9 octobre 2026

- Vue approfondie retirée ; résultat simplifié, une ou deux fréquences et spectre
  avec repères correspondants. Les harmoniques possibles restent signalées.
- 54 tests numériques passent, dont deux fréquences simultanées, alternance
  temporelle, artefact sur un seul doigt, harmoniques, familles contradictoires,
  données manquantes et reprise automatique après pertes d’images.
- Nouveau traitement CPU avec une file bornée à trois images et présentation
  adaptative plafonnée à 30 images par seconde de temps de calcul. Les horodatages
  vidéo et la résolution de détection sont conservés. L’accélération GPU évaluée
  n’a pas été retenue : elle n’a pas donné de gain fiable dans cet environnement.
- Vidéo de référence de 12 s : 29,5 à 30,1 s de traitement dans Edge sur le poste
  testé, contre une durée de lecture théorique d’environ 48 s à l’ancienne vitesse
  0,25× (hors chargement). Deux mains à 5,0 Hz, 11,5 s exploitables et 21 points
  contributifs ; 701 images au test UI, aucun callback rejeté pour calcul en cours.
  Ce résultat ne prédit pas les performances sur iPhone.
- Recalcul testé avec coordonnées CSV strictement identiques, exports et interface
  mobile sans débordement. Vidéo sans main, format invalide, annulation au chargement
  et au suivi, effacement et correctif du worker Safari testés avec succès.
- La double fréquence est validée sur signaux et coordonnées synthétiques.
  Elle n’a pas été validée sur des vidéos de tremblement réel ou contre un capteur.

**Non testé par les essais automatisés :** Safari sur iPhone réel, caméra native
iOS, véritables fichiers iPhone MOV/HEVC/120 i/s, vidéos cliniques, référence
accélérométrique. La validation vidéo concerne un WebM synthétique ; elle ne
mesure pas la justesse du modèle sur un tremblement réel. Aucun score de confiance
clinique n’est revendiqué.

## Aperçu v0.4 — 15 octobre 2026, non publié

- 62 tests automatisés passent. Ajouts : toutes les régions faciales à 5 Hz, deux régions à 3/8 Hz, deux composantes 5/8 Hz dans une région, mouvement global corrigé, artefact isolé, transitoire, visage statique, plusieurs visages, pertes de suivi et identifiants CSV.
- Test navigateur Edge (390 × 844) sur une vidéo de portrait public MediaPipe déplacé à 5 Hz : détection effective du visage, fréquence globale 5,0 Hz, 100 % de suivi, environ 11,5 s de calcul pour 10 s de vidéo. Les périodicités locales confondues avec le global sont retenues comme indéterminées. Aucun appel externe pendant le traitement. Exports, recalcul sans rechargement du modèle, changement de mode avec effacement des données et absence de débordement validés.
- Non-régression Main : vidéo de référence 5,0 Hz sur les deux mains, 705 images, 29,7 s ; recalcul 243 ms et coordonnées identiques. Worker avec user-agent Safari : test réussi dans Chromium, pas un test iPhone.
- Le test de vidéo Main initial en mode Visage n’a détecté aucun visage et a affiché le message prévu. La vidéo faciale de référence utilise une image publique distincte, non une vidéo clinique.
- Le premier test de portrait mobile a révélé des faux pics locaux à la fréquence globale. La règle conservatrice ±0,6 Hz a été ajoutée et testée ; elle peut masquer un vrai mouvement local synchrone.
- Non validés : sensibilité aux petits mouvements faciaux réels, rotations hors plan, occultations, caméra native iPhone et performances Safari. Pas de validation clinique, ni mesure d’amplitude. Bande limitée à 2–15 Hz et à la cadence réellement exploitable.
