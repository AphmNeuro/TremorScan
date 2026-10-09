# Essais exécutés le 9 octobre 2026

- **Node 24.19.0 / Windows** : 33 tests automatiques réussis ; aucun échec. Les cas idéaux 3, 5, 8 et 12 Hz à 60 et 120 Hz respectent l’erreur maximale de 0,2 Hz demandée. Les limites du cas 12 Hz à 30 Hz sont précisées dans `validation.md`.
- **Microsoft Edge 154.0.4258.62, headless** : photographie publique MediaPipe animée à 5 Hz, encodée en WebM puis décodée et analysée. 702 images analysées ; deux mains suivies, 21 coordonnées par image et par main. Fréquences obtenues : 4,999907 et 4,999891 Hz lors du test de référence.
- **Application complète** : le même fichier a été importé par le champ fichier utilisateur. Résultats affichés : 5,0 Hz pour les deux mains ; durée exploitable 11,5 s, cadence reconstruite 58,8 Hz, 21 points contributifs. Graphiques présents, CSV des points téléchargé, vidéo et résultats effacés avec le bouton prévu.
- **Affichage étroit** : capture et absence de débordement horizontal vérifiées à 390 × 844 pixels dans Chromium. Capture bureau également examinée. Ceci n’est pas un test sur iPhone réel.
- **Cas d’erreur** : faux fichier MOV refusé avec message compréhensible. Vidéo synthétique sans main : 712 images analysées, aucun suivi, aucune fréquence produite.
- **Confidentialité technique** : aucune requête HTTP externe déclenchée pendant le parcours d’analyse ; aucune erreur JavaScript non gérée. Code d’application sans mécanisme d’envoi de vidéo/coordonnées, télémétrie ou stockage persistant.
- **Cycle de vie et build** : construction réussie ; chargement depuis `/dist/`, paramètres invalides, annulation au démarrage et pendant le suivi, restauration des contrôles vidéo, effacement et lien de documentation testés avec succès.

Captures, logs, CSV et vidéo synthétique sont disponibles localement dans `tests/artifacts/` et exclus du dépôt de production. Les petits pics secondaires ont ensuite été filtrés à 10 % de la puissance principale et rapport pic/fond ≥6 ; les tests numériques ont été relancés avec succès. Ce filtre ne change pas l’estimation principale.

**Non testé :** Safari sur iPhone réel, caméra native iOS, véritables fichiers iPhone MOV/HEVC/120 i/s, vidéos cliniques, référence accélérométrique, déploiement distant dans un nouveau dépôt. La validation vidéo ci-dessus concerne un WebM synthétique ; elle ne mesure pas la justesse du modèle sur un tremblement réel. Aucun score de confiance clinique n’est revendiqué.
