# Loupe

Loupe aide les bénévoles à documenter et rechercher des objets, logos, lieux, tatouages, montres, bijoux, vêtements et autres détails visibles dans les images anonymisées publiées par des agences officielles.

Le logiciel reste volontairement limité au **travail préparatoire au signalement**. Il ne contacte pas de personnes, ne démasque personne, ne construit pas de base de suspects et ne transmet aucun signalement automatiquement.

> Outil créé pour faciliter la recherche faite par les bénévoles.

## Programmes intégrés

| Agence | Programme | Usage principal |
|---|---|---|
| DHS / HSI | [Identify2Protect](https://www.dhs.gov/know2protect/identify2protect) | Objets, lieux, logos, tatouages et détails publiés par HSI |
| Europol | [Stop Child Abuse — Trace an Object](https://www.europol.europa.eu/stopchildabuse) | Objets et détails issus d’enquêtes non résolues |
| FBI / NCMEC | [Endangered Child Alert Program](https://www.fbi.gov/wanted/ecap/view) | Caractéristiques distinctives de personnes non identifiées |

Le programme Interpol [Identify Me](https://www.interpol.int/en/What-you-can-do/Identify-Me) n’est pas intégré : il sert à identifier des personnes décédées ou des restes humains dont l’identité n’a pas été établie, pas à documenter l’exploitation sexuelle d’enfants.

## Fonctionnalités

- Basculer immédiatement l’interface entre le français et l’anglais.
- Importer automatiquement les objets publiés par Identify2Protect (DHS) et Trace an Object (Europol).
- Utiliser l’import par liste d’adresses pour les pages qui ne permettent pas l’import automatique, comme ECAP.
- Préparer un signalement avec le modèle de l’agence : DHS/HSI, Europol ou FBI/NCMEC.
- Ajouter une image depuis une adresse HTTPS ou par import depuis l’appareil.
- Redimensionner et compresser l’image localement avant tout envoi.
- Recadrer une zone avec la souris ou un écran tactile.
- Extraire logos, texte, objets, couleurs dominantes et correspondances visuelles avec Google Vision.
- Rechercher des termes dans Google, Google Images, Bing, Yandex, TinEye et Google Lens.
- Interroger Open Food Facts, Open Products Facts et Open Beauty Facts.
- Rechercher un code-barres UPC/EAN.
- Vérifier une marque et son pays d’origine avec Wikidata.
- Rechercher des références eBay ou Best Buy si ces services sont configurés.
- Conserver pour chaque résultat son titre, son URL, sa source et son score de correspondance.
- Préparer un dossier de signalement structuré à copier dans le formulaire officiel.
- Comparer des fiches avec un score explicite qui n’est pas une probabilité d’identité.
- Exporter et importer les fiches en JSON.
- Utiliser plusieurs codes d’accès et une limitation de débit.

## Import des listes officielles

Le bouton « Importer la liste officielle » utilise uniquement les adresses publiques définies dans le code :

- Identify2Protect : lecture de la page DHS et extraction des objets, numéros, descriptions et images.
- Europol Trace an Object : lecture des données publiques intégrées à la page officielle et extraction des objets, références, résumés et images.
- ECAP : le FBI bloque les requêtes automatisées. Loupe n’essaie pas de contourner cette protection. Ouvrez la page, copiez les liens des fiches dans l’import par liste d’adresses, puis ajoutez uniquement vos observations factuelles.

Les entrées sont dédupliquées par programme, référence et page source. Une fiche importée reste marquée « À examiner ».

## Modèles de signalement

Chaque fiche possède un modèle adapté à l’agence :

- DHS/HSI : numéro d’objet, lieu, période, organisation, sources et autorisation de suivi.
- Europol : objet, point de vente, période d’achat ou de diffusion, sources et coordonnées facultatives.
- FBI/NCMEC : personne publiée, caractéristiques distinctives, lieu, période, sources et limites de l’observation.

Loupe ne transmet rien. Le modèle est à copier, relire et compléter dans le formulaire officiel.

## Principes de confidentialité

- Le serveur ne conserve aucune image.
- Une image importée est compressée dans le navigateur et n’est conservée que jusqu’au rechargement de la page.
- Les fiches sont enregistrées dans le `localStorage` du navigateur.
- L’export JSON ne contient pas les images importées localement.
- Les clés API restent sur le serveur.
- Les résultats sont des pistes à vérifier, jamais une identification certaine.
- L’import automatique ne lit que les pages publiques DHS et Europol autorisées dans la configuration. Il ne contourne ni protection ni authentification.
- Les soupçons ou rapprochements de personnes ne doivent jamais être publiés par Loupe.

Lorsqu’un service externe est utilisé, l’adresse de l’image ou les termes de recherche peuvent être transmis à ce service. Loupe transmet les données uniquement au service externe configuré sur l’instance.

## Démarrage rapide avec Docker

### 1. Configuration

```powershell
Copy-Item .env.example .env
```

Ouvrez `.env` et renseignez uniquement les services utiles. Sans clé, l’interface, les fiches, la compression, le recadrage d’une image importée, les liens de recherche manuelle, Wikidata, les catalogues ouverts et les codes-barres restent utilisables.

Loupe est accessible sans code d’accès. Pour un déploiement public, limitez l’accès réseau au niveau de l’hébergeur si nécessaire.

### 2. Lancer l’application

```powershell
docker compose up -d --build
```

Ouvrez ensuite `http://localhost:3000`.

Pour arrêter :

```powershell
docker compose down
```

### 3. Activer HTTPS avec Caddy

Créez un enregistrement DNS A ou AAAA vers l’adresse IP du serveur, ouvrez les ports 80 et 443, puis renseignez le domaine dans `.env` :

```dotenv
CADDY_DOMAIN=loupe.example.org
```

Puis lancez :

```powershell
docker compose --profile https up -d --build
```

Caddy obtient automatiquement le certificat TLS. Le port direct de Loupe reste lié à `127.0.0.1` et n’est pas exposé publiquement.

## Option Vercel

Le dépôt contient aussi une fonction Vercel pour un déploiement de démonstration ou un petit serveur. Le projet principal reste Docker.

1. Importe le dépôt dans Vercel.
2. Vercel détecte `vercel.json` et la fonction `api/[[...path]].mjs`.
3. Ajoute les mêmes variables d’environnement que `.env.example` dans les settings Vercel.
4. Ne mets pas de clés Google en variable `VITE_*` : elles resteraient visibles dans le navigateur.

Vercel limite le corps d’une requête à environ 4,5 Mo. Loupe réduit donc automatiquement l’image à 3 Mo sur cette cible. Pour un usage réel, Docker ou un VPS reste préférable.

## Exécution locale sans Docker

Node.js 22 ou plus récent est requis.

```powershell
npm ci
Copy-Item .env.example .env
npm start
```

## Configuration

| Variable | Obligatoire | Description |
|---|---:|---|
| `GOOGLE_VISION_KEY` | Non | Analyse des logos, textes, objets, couleurs et pages visuellement proches |
| `SERPAPI_KEY` | Non | Recherche Google Lens et Google Images via API |
| `GOOGLE_CSE_KEY` + `GOOGLE_CSE_CX` | Non | Alternative de recherche web |
| `UPCITEMS_KEY` | Non | Quota amélioré de codes-barres |
| `EBAY_APP_ID` + `EBAY_CERT_ID` | Non | Recherche dans eBay |
| `BESTBUY_KEY` | Non | Recherche Best Buy, principalement aux États-Unis |
| `RATE_LIMIT` | Non | Requêtes autorisées par IP et par minute, valeur par défaut `60`. Une analyse de fiche peut utiliser 1 à 6 appels. |
| `MAX_IMAGE_MB` | Non | Taille maximale après compression : `10` sur Docker, `3` sur Vercel |
| `CADDY_DOMAIN` | Non | Domaine utilisé par le profil HTTPS |

Aucune clé n’est demandée aux bénévoles. L’exploitant du serveur peut choisir des quotas gratuits ou des services payants pour son instance ; Loupe ne propose ni publicité ni abonnement aux utilisateurs.

## Traitement des images

- Formats acceptés : JPEG, PNG et WebP.
- Taille maximale du fichier original : 25 Mo.
- Les images sont redimensionnées à 2 400 pixels sur leur plus grand côté.
- La version envoyée est compressée à 10 Mo maximum.
- Le corps JSON peut atteindre environ 14 Mo à cause de l’encodage Base64.
- Caddy autorise un corps de 16 Mo.
- Une recherche inversée nécessite une adresse HTTPS publique. Une image importée localement peut être analysée et recadrée, mais pas envoyée automatiquement à un moteur qui exige une URL publique.

## Développement

```powershell
npm ci
npm run lint
npm test
npm start
```

Le projet ne dépend d’aucune base de données et ne contient aucun outil d’investigation sociale automatisée.

## Docker Hub

Dépôt prévu : [phoenix57/loupe](https://hub.docker.com/repository/docker/phoenix57/loupe/general)

Après avoir construit et testé l’image :

```powershell
docker build --file proxy/Dockerfile --tag phoenix57/loupe:latest .
docker login
docker push phoenix57/loupe:latest
```

## Licence et contributions

Loupe est distribué sous licence [MIT](LICENSE). Les contributions sont bienvenues. Lisez [CONTRIBUTING.md](CONTRIBUTING.md) avant de proposer une modification.

Pour soutenir Loupe, aider les bénévoles à protéger les enfants : partagez le projet, contribuez au code et signalez les erreurs. Le projet reste gratuit, sans publicité et sans abonnement. Loupe ne prend aucun paiement et ne collecte aucune donation.
