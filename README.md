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
- Choisir le thème clair, sombre ou celui du système, mémorisé dans le navigateur.
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

## Déploiement sur un VPS Ubuntu

`deploy/installer-vps.sh` installe Docker, ouvre uniquement les ports 22, 80 et 443 dans le pare-feu, clone le dépôt dans `/opt/loupe`, crée le fichier `.env` et lance la pile avec HTTPS.

Créez d’abord un enregistrement DNS A vers l’adresse IP du serveur, puis lancez :

```bash
sudo ./deploy/installer-vps.sh loupe.exemple.org
```

Le script est réexécutable : il met le dépôt à jour, conserve le fichier `.env` et reconstruit l’image. Ajoutez les clés API dans `/opt/loupe/.env`, puis relancez-le pour les appliquer.

### Durcir le serveur

`deploy/secure-vps.sh` garde l’accès par mot de passe et n’ajoute aucune clé. Il interdit la connexion directe de `root`, limite les tentatives SSH avec fail2ban, ouvre uniquement les ports 22, 80 et 443 dans le pare-feu, applique les correctifs de sécurité automatiquement et retire quelques options noyau inutiles.

```bash
sudo ./deploy/secure-vps.sh --utilisateur loupe
```

Le script n’ajoute pas de compte si vous l’appelez sans `--utilisateur`. Dans ce cas, vérifiez que vous disposez déjà d’un accès sudo avant de fermer votre session.

Gardez toujours une session ouverte pendant la manipulation, et testez la connexion dans un second terminal. Pour revenir en arrière :

```bash
sudo rm -f /etc/ssh/sshd_config.d/99-loupe-hardening.conf
sudo systemctl reload ssh
```

Commandes utiles sur le serveur :

```bash
cd /opt/loupe
docker compose --profile https logs -f loupe
docker compose --profile https logs -f caddy
docker compose ps
docker compose --profile https restart loupe
docker compose down
```

Les journaux sont limités à trois fichiers de 10 Mo par service, et le conteneur Loupe s’exécute sans privilège, sans capacité système et avec `no-new-privileges`. Seul Caddy est exposé sur le réseau ; le port 3000 reste lié à la boucle locale.

### Quand Caddy n’obtient pas de certificat

- Le domaine ne pointe pas encore vers l’IP du serveur, ou le DNS n’a pas propagé.
- Les ports 80 et 443 sont bloqués par un pare-feu en amont du serveur.
- Un autre service occupe déjà le port 80.

Le certificat s’obtient automatiquement, sans intervention. Relancez `docker compose --profile https logs caddy` pour lire la raison exacte.

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
| `TRUST_PROXY` | Non | Réseaux dont le proxy de confiance est accepté. `loopback` seul casse la limitation par IP derrière Caddy sur Docker : le réseau du pont n’est pas la boucle locale. `docker-compose.yml` impose `loopback, linklocal, uniquelocal`. |
| `MAX_IMAGE_MB` | Non | Taille maximale après compression : `10` sur Docker, `3` sur Vercel |
| `CADDY_DOMAIN` | Non | Domaine utilisé par le profil HTTPS |

Aucune clé n’est demandée aux bénévoles. L’exploitant du serveur peut choisir des quotas gratuits ou des services payants pour son instance ; Loupe ne propose ni publicité ni abonnement aux utilisateurs.

## Navigateurs pris en charge

L’interface utilise `light-dark()` pour le thème clair et sombre. Cette fonction est disponible depuis mai 2024 dans Chrome et Edge, depuis décembre 2023 dans Firefox et depuis la version 17.5 de Safari. Sur un navigateur plus ancien, l’interface reste utilisable mais s’affiche avec le thème clair.

Le cache dure une heure pour les fichiers statiques. Après une mise à jour, un rechargement forcé du navigateur est nécessaire pour voir la nouvelle version.

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
