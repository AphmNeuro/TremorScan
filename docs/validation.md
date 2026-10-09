# Validation et protocole de référence

## Ce que les tests numériques établissent

`node --test tests/*.test.mjs` couvre : sinusoïdes 3/5/8/12 Hz à 30/60/120 échantillons/s, bruit pseudo-aléatoire reproductible, dérive, jitter, points manquants, pics multiples, bruit seul, signal constant, pertes longues, temps invalides, Nyquist, variance du PSD, consensus contradictoire, suivi des identités et CSV.

Pour les sinusoïdes de 16 s, amplitude 4 pixels, cadence ≥30 Hz et fréquence **strictement inférieure à 0,4 Fs**, les tests exigent une erreur ≤0,2 Hz. À 30 Hz, 12 Hz est à la borne conservatrice et ne fait pas partie de la promesse de précision. À 60 et 120 Hz les quatre fréquences sont testées avec ce critère. Welch utilise 4 s (résolution réelle ≈0,25 Hz). La précision sous-bin sur une sinusoïde isolée ne signifie pas que deux pics espacés de 0,2 Hz seront résolus.

Les perturbations testées à 5 Hz sont bornées : bruit uniforme d’amplitude crête-à-crête 4 pixels, dérive linéaire, jitter de ±0,2 intervalle et 6 % de points supprimés aléatoirement. Les résultats ne garantissent pas une précision similaire pour tout bruit, toute perte ou toute fréquence. Le test d’aliasing démontre volontairement qu’une oscillation à 25 Hz échantillonnée à 30 Hz devient indiscernable d’un signal à 5 Hz : la limitation de bande ne répare pas cet effet.

## Tests vidéo techniques

Le banc `tests/browser.html` génère une vidéo d’une photographie de mains translatée horizontalement à 5 Hz, puis l’importe comme Blob vidéo. Le temps de capture est celui de `requestAnimationFrame` : sa cadence peut varier. Ce test vérifie le chargement du modèle, le décodage, les 21 coordonnées et le passage aux spectres ; ce n’est pas une vidéo réelle de tremblement. Les résultats effectifs du dernier passage sont dans `tests/artifacts/`.

`tests/e2e.mjs` teste aussi l’import par le champ fichier de l’application, l’affichage des résultats, l’export CSV, l’effacement, un viewport mobile Chromium, un fichier invalide, une vidéo sans main et l’absence de requêtes HTTP externes pendant l’analyse. Le viewport mobile n’émule pas le décodeur ni le matériel d’un iPhone.

## Essais indispensables sur iPhone réel

1. Servir le build sur GitHub Pages en HTTPS, ouvrir Safari à jour et noter modèle iPhone / version iOS.
2. Filmer puis importer un MP4 H.264 60 i/s de 15 s, portrait puis paysage. Tester le bouton caméra, les contrôles et la superposition.
3. Répéter avec MOV HEVC 30, 60 et 120 i/s lorsque disponibles, plus une vidéo à cadence variable ; consigner les codecs acceptés, temps de calcul et cadence réellement traitée.
4. Tester annulation au chargement / suivi, retour de l’arrière-plan, nouvelle analyse, effacement, export vers Fichiers et vidéo >30 s. Aucun résultat stale ne doit être conservé.
5. Tester sans main, faible lumière, occlusion, mains croisées et mouvements de caméra. Vérifier que les limites sont affichées et noter les faux positifs.
6. Contrôler le trafic via Safari Web Inspector : uniquement scripts/modèle/WASM même origine, aucun POST de vidéo/coordonnées. Le site n’utilise ni stockage local ni service worker.

## Validation instrumentale ultérieure

- Commencer par un support mécanique oscillant de fréquence contrôlée et une main factice, puis volontaires consentants avec référence instrumentale appropriée. Ne pas intégrer d’images identifiantes au dépôt public.
- Fixer un accéléromètre triaxial (≥100 Hz, idéalement ≥200 Hz) sur le même segment anatomique visible. Documenter fixation, orientation, calibration et synchronisation (repère visuel / impulsion commune). Analyser séparément la fréquence de l’accélération et celle de la position ; ne pas comparer directement les amplitudes.
- Mesurer 3, 5, 8, 12 Hz ; amplitude variable, 30/60/120 i/s, distances, angles, éclairage, compressions, stabilité de caméra, mouvements volontaires et absence d’oscillation. Recueillir plusieurs répétitions par condition. Préenregistrer les critères d’exclusion.
- Comparer sur les **mêmes fenêtres temporelles** : erreur absolue de fréquence, biais, limites d’accord Bland–Altman, taux de résultats non concluants, faux positifs sans oscillation et sensibilité aux harmoniques. Stratifier les résultats par appareil, cadence effective, amplitude et qualité de suivi.
- Réserver un jeu indépendant pour valider les seuils après leur mise au point. Un accord satisfaisant sur le banc ne constitue pas une validation diagnostique, réglementaire ou clinique.

## Statut

Prototype non validé cliniquement. Les essais Safari iPhone réel et les comparaisons accélérométriques n’ont pas été réalisés dans cet environnement. Le workflow GitHub Pages publie le site ; son état est consultable dans l’onglet Actions du dépôt AphmNeuro/TremorScan.
