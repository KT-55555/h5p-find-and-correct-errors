# Guide d’utilisation

## Créer une activité

Choisissez **Repérer et corriger des erreurs** dans l’éditeur H5P. Ajoutez une consigne, puis utilisez le mode Visuel ou Balisage.

En mode Visuel, sélectionnez le mot ou le groupe de mots erroné et choisissez **Marquer comme erreur**. Saisissez une ou plusieurs corrections acceptées. Les champs de points et de pénalités propres à la cible sont facultatifs : laissez-les vides pour conserver les valeurs globales. Vous pouvez aussi ajouter plusieurs indices, une explication et un nombre maximal de tentatives (`0` = illimité).

En mode Balisage, utilisez `[forme erronée|correction]` et `||` pour séparer plusieurs réponses :

```text
Les étudiants [était|étaient] prêts.
Elle [n'a pas répondue|n'a pas répondu||n’a pas répondu].
```

Pour écrire littéralement une barre oblique inverse, un crochet ou une barre verticale, utilisez `\\`, `\[`, `\]` ou `\|`. Un clic sur n’importe quel mot d’une expression ciblée ouvre un seul champ pour toute l’expression. Les cibles ne peuvent ni se chevaucher ni s’imbriquer.

## Comportement et notation

La valeur par défaut est de 1 point pour le repérage et de 1 point pour la correction, avec une pénalité unique de 0,5 point au premier clic sur chaque fragment juste. Le score ne devient jamais négatif. Les points et pénalités peuvent être définis globalement ou par cible.

Vous pouvez choisir la validation immédiate ou à la fin, afficher le total, le nombre restant ou aucun nombre, limiter les reprises, régler le moment des explications et des solutions, activer ou désactiver les indices et accepter l’équivalence entre apostrophes droite et typographique. La réussite automatique exige que toutes les cibles soient corrigées; l’épuisement des tentatives n’est pas une réussite.

La politique de note conservée par le LMS (première, dernière ou meilleure tentative) relève de la plateforme d’accueil.

## Importer d’anciens exercices

Consultez les commandes dans `AUTHOR_GUIDE.md`. L’importateur traite les fichiers comme des données inertes et produit un rapport de prévisualisation. Vérifiez le JSON intermédiaire avant de l’utiliser dans H5P. L’exercice français fourni avec le projet est privé et ne doit pas être publié.

## Accessibilité

Vérifiez l’ordre de tabulation, l’activation avec Entrée et Espace, le zoom à 200 % et les annonces du lecteur d’écran. NVDA et VoiceOver n’ont pas encore été testés; le protocole reproductible se trouve dans `ACCESSIBILITY_REPORT.md`.
