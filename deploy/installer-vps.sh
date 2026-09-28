#!/usr/bin/env bash
# Installation de Loupe sur un VPS Ubuntu vierge.
# Usage : sudo ./deploy/installer-vps.sh loupe.exemple.org
set -euo pipefail

REPO_URL="https://github.com/slim57000/loupe.git"
INSTALL_DIR="/opt/loupe"

etape() { printf '\n\033[1;34m==> %s\033[0m\n' "$1"; }
info() { printf '    %s\n' "$1"; }
alerte() { printf '\033[1;33m[attention] %s\033[0m\n' "$1"; }
echec() { printf '\033[1;31m[erreur] %s\033[0m\n' "$1" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || echec "Relance ce script avec sudo."

DOMAIN="${1:-}"
[ -n "$DOMAIN" ] || echec "Indique le domaine public, par exemple : sudo ./deploy/installer-vps.sh loupe.exemple.org"
case "$DOMAIN" in
  *.*) ;;
  *) echec "« $DOMAIN » ne ressemble pas à un domaine. Utilise le nom complet, avec le point." ;;
esac

. /etc/os-release
[ "${ID:-}" = "ubuntu" ] || echec "Ce script vise Ubuntu. Distribue : $PRETTY_NAME"

MEMO_MB=$(( $(awk '/MemTotal/ {print $2}' /proc/meminfo) / 1024 ))
if [ "$MEMO_MB" -lt 2048 ]; then
  alerte "Le serveur a ${MEMO_MB} Mo de RAM. La construction Docker peut échouer par manque de mémoire."
  info "Ajoute du swap avant de continuer :"
  info "  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile"
  info "  echo '/swapfile none swap sw 0 0' | tee -a /etc/fstab"
  read -r -p "Continuer quand même ? [o/N] " reponse || reponse=""
  [ "$reponse" = "o" ] || [ "$reponse" = "O" ] || echec "Annulé."
fi

etape "Outils système"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl ca-certificates git ufw iproute2 >/dev/null

etape "Docker Engine"
if command -v docker >/dev/null 2>&1; then
  info "Docker est déjà installé : $(docker --version)"
else
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu %s stable\n' \
    "$(dpkg --print-architecture)" "$VERSION_CODENAME" > /etc/apt/sources.list.d/docker.list
  if apt-get update -qq && apt-get install -y -qq \
      docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin >/dev/null 2>&1; then
    info "Installé depuis le dépôt officiel Docker."
  else
    alerte "Docker.com ne publie pas encore d paquets pour « $VERSION_CODENAME ». Repli sur les dépôts Ubuntu."
    rm -f /etc/apt/sources.list.d/docker.list
    apt-get update -qq
    apt-get install -y -qq docker.io docker-compose-v2 >/dev/null
  fi
fi
systemctl enable --now docker
info "$(docker --version) — $(docker compose version)"

etape "Pare-feu"
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow OpenSSH >/dev/null 2>&1 || ufw allow 22/tcp >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null
info "Ports autorisés : 22 (SSH), 80 (HTTP), 443 (HTTPS)."

etape "Ports 80 et 443 libres"
for port in 80 443; do
  if ss -Hltn "sport = :$port" 2>/dev/null | grep -q .; then
    echec "Le port $port est déjà utilisé. Arrête l'ancien service (nginx, apache) puis relance le script."
  fi
done
info "80 et 443 sont disponibles."

etape "Dépôt Loupe"
if [ -d "$INSTALL_DIR/.git" ]; then
  info "Mise à jour de $INSTALL_DIR"
  git -C "$INSTALL_DIR" pull --ff-only
else
  [ -e "$INSTALL_DIR" ] && echec "$INSTALL_DIR existe déjà et n'est pas un dépôt Git. Déplace-le ou supprime-le."
  git clone --quiet "$REPO_URL" "$INSTALL_DIR"
  info "Cloné dans $INSTALL_DIR"
fi

etape "Configuration"
if [ -f "$INSTALL_DIR/.env" ]; then
  info "Fichier .env conservé."
else
  cp "$INSTALL_DIR/.env.example" "$INSTALL_DIR/.env"
  chmod 600 "$INSTALL_DIR/.env"
  info "Fichier .env créé depuis .env.example."
fi
sed -i "s|^CADDY_DOMAIN=.*|CADDY_DOMAIN=$DOMAIN|" "$INSTALL_DIR/.env"
info "CADDY_DOMAIN=$DOMAIN"
info "Les clés API restent vides : ajoute-les dans $INSTALL_DIR/.env puis relance le script."

etape "Enregistrement DNS"
IP_PUBLIQUE=$(curl -fsS --max-time 10 https://api.ipify.org 2>/dev/null || echo "inconnue")
IP_DNS=$(getent ahostsv4 "$DOMAIN" 2>/dev/null | awk 'NR==1 {print $1}' || echo "")
info "IP publique du serveur : $IP_PUBLIQUE"
if [ -z "$IP_DNS" ]; then
  alerte "Le domaine $DOMAIN ne répond pas encore en DNS."
  info "Crée un enregistrement A vers $IP_PUBLIQUE, puis relance ce script."
else
  info "$DOMAIN pointe vers $IP_DNS"
  [ "$IP_DNS" = "$IP_PUBLIQUE" ] || alerte "L IP du domaine ($IP_DNS) diffère de l IP du serveur ($IP_PUBLIQUE)."
fi

etape "Construction et démarrage"
cd "$INSTALL_DIR"
docker compose --profile https up -d --build

etape "Vérification"
URL="https://$DOMAIN/healthz"
for tentative in $(seq 1 30); do
  if curl -fsS --max-time 5 "$URL" 2>/dev/null | grep -q '"ok"'; then
    info "Loupe répond sur $URL"
    printf '\n\033[1;32mLoupe est en ligne sur https://%s\033[0m\n' "$DOMAIN"
    printf 'Journal : docker compose --profile https logs -f loupe\n'
    printf 'Arrêter : docker compose down\n'
    exit 0
  fi
  info "Tentative $tentative/30 — Caddy obtient le certificat TLS…"
  sleep 10
done

alerte "Le site ne répond pas encore. Diagnostic :"
info "docker compose --profile https logs --tail=50 caddy"
info "docker compose ps"
exit 1
