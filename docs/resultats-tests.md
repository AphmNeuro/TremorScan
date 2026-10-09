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

**Non testé par les essais automatisés :** Safari sur iPhone réel, caméra native
iOS, véritables fichiers iPhone MOV/HEVC/120 i/s, vidéos cliniques, référence
accélérométrique. La validation vidéo concerne un WebM synthétique ; elle ne
mesure pas la justesse du modèle sur un tremblement réel. Aucun score de confiance
clinique n’est revendiqué.
