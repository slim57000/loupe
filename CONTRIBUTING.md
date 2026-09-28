# Contribuer à Loupe

Les contributions de code, de traduction, de tests, de documentation et d’expertise métier sont bienvenues.

## Avant de commencer

1. Lisez le README et les limites de sécurité.
2. N’ajoutez aucun contenu explicite, aucune image interdite et aucun exemple issu d’un cas réel non public.
3. N’ajoutez aucune clé, aucun jeton, aucune donnée personnelle et aucun fichier `.env`.
4. Gardez l’outil orienté signalement : pas de surveillance de personnes, pas de désanonymisation et pas de contact direct avec un suspect.
5. N’ajoutez pas de scraping qui contourne les conditions d’un service, une authentification, une limitation de débit ou une protection d’accès.
6. Présentez toute nouvelle intégration comme facultative et respectez sa documentation officielle.

## Développement local

```powershell
npm ci
npm run lint
npm test
npm start
```

Node.js 22 ou plus récent est requis.

## Vérifications avant une pull request

```powershell
npm run lint
npm test
npm audit --omit=dev
docker build --file proxy/Dockerfile --tag loupe:test .
```

Si l’image Docker ne peut pas être construite dans votre environnement, indiquez-le dans la pull request et joignez les étapes de validation utilisées.

## Structure

- `public/index.html` : structure de l’interface.
- `public/app.js` : état local, fiches, analyses, recherche, import, modèles et comparaison.
- `public/i18n.js` : bascule et traduction français/anglais.
- `public/style.css` : interface responsive claire et accessible.
- `proxy/server.js` : API Docker, authentification, validation et appels externes.
- `test/server.test.js` : tests du serveur.
- `test/trust-proxy.test.js` : tests du proxy de confiance.
- `proxy/Dockerfile` et `docker-compose.yml` : déploiement.
- `deploy/installer-vps.sh` : installation sur un VPS Ubuntu.
- `deploy/secure-vps.sh` : durcissement d’un VPS Ubuntu, mot de passe SSH conservé.
- `api/` : fonctions Vercel équivalentes à l’API Docker.

## Principes d’interface

- Utiliser des mots compréhensibles par un débutant.
- Présenter les résultats comme des pistes à vérifier.
- Afficher la source exacte de chaque affirmation.
- Ne jamais exposer une clé API au navigateur.
- Ne jamais conserver une image sur le serveur.
- Préférer un lien officiel à une copie d’information susceptible d’être périmée.
- Signaler une urgence par le canal officiel approprié, pas par Loupe.

## Transparence des scores

Un score de correspondance peut compter plusieurs indices observés : logo, référence, code-barres, page source ou termes communs. Il ne doit jamais être présenté comme une probabilité d’identité, un verdict ou une preuve.

## Dons

Le projet ne vend pas de service, ne prend aucun paiement et ne collecte aucune donation. Le soutien passe par le partage du projet, les contributions de code, la traduction, les tests et les signalements d’erreurs.
