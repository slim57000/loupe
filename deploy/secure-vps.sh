#!/usr/bin/env bash
# Durcissement d'un VPS Ubuntu pour heberger Loupe, en gardant l'acces SSH
# par mot de passe. Aucune cle n'est necessaire.
#
# Ce qui change : root ne peut plus se connecter directement, les tentatives
# repetees sont banniees, le pare-feu n'ouvre que 22, 80 et 443, les mises a jour
# de securite s'appliquent seules et le noyau perd quelques options inutiles.
#
# Ce qui ne change pas : le mot de passe reste valide, aucun fichier n'est
# deplace et le dechargement de SSH ne coupe pas la session en cours.
#
# Usage :
#   sudo ./deploy/secure-vps.sh --utilisateur loupe
#   sudo ./deploy/secure-vps.sh            # durcit sans creer de compte
set -euo pipefail

UTILISATEUR=""
CREER_COMPTE=0

etape() { printf '\n\033[1;34m==> %s\033[0m\n' "$1"; }
info() { printf '    %s\n' "$1"; }
alerte() { printf '\033[1;33m[attention] %s\033[0m\n' "$1"; }
echec() { printf '\033[1;31m[erreur] %s\033[0m\n' "$1" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --utilisateur) UTILISATEUR="${2:-}"; CREER_COMPTE=1; shift 2 ;;
    -h|--help) sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echec "Option inconnue : $1" ;;
  esac
done

[ "$(id -u)" -eq 0 ] || echec "Relance ce script avec sudo."
. /etc/os-release
[ "${ID:-}" = "ubuntu" ] || echec "Ce script vise Ubuntu. Distribue : $PRETTY_NAME"

export DEBIAN_FRONTEND=noninteractive

etape "Compte administrateur non root"
if [ "$CREER_COMPTE" -eq 1 ]; then
  [ -n "$UTILISATEUR" ] || echec "Indique --utilisateur <nom>."
  [ "$UTILISATEUR" != "root" ] || echec "Choisis un nom different de root."
  if id "$UTILISATEUR" >/dev/null 2>&1; then
    info "Le compte $UTILISATEUR existe deja."
  else
    adduser --gecos "Loupe" "$UTILISATEUR"
    info "Compete cree. Note bien le mot de passe affiche."
  fi
  usermod -aG sudo "$UTILISATEUR"
  info "$UTILISATEUR fait partie du groupe sudo."
else
  info "Aucun compte cree. Assure-toi d'avoir un acces sudo avant de fermer cette session."
fi

etape "SSH : root interdit, mot de passe conserve"
cat > /etc/ssh/sshd_config.d/99-loupe-hardening.conf <<'EOF'
# Genere par deploy/secure-vps.sh
PermitRootLogin no
PasswordAuthentication yes
KbdInteractiveAuthentication no
PubkeyAuthentication yes
MaxAuthTries 3
MaxSessions 5
LoginGraceTime 30
AllowAgentForwarding no
AllowTcpForwarding no
X11Forwarding no
EOF
chmod 644 /etc/ssh/sshd_config.d/99-loupe-hardening.conf
sshd -t || echec "Configuration invalide, ssh n'a pas ete recharge."

# 99- est lu apres 50-cloud-init.conf, donc c'est lui qui gagne.
EFFECTIF=$(sshd -T 2>/dev/null | grep -iE '^(permitrootlogin|passwordauthentication|kbdinteractiveauthentication) ')
printf '%s\n' "$EFFECTIF" | sed 's/^/    /'
echo "$EFFECTIF" | grep -qi '^permitrootlogin no' \
  || echec "PermitRootLogin n'est pas no, abandon avant rechargement."

systemctl reload ssh
info "ssh recharge. La session en cours reste ouverte."

etape "Mises a jour automatiques de securite"
apt-get update -qq
apt-get install -y -qq unattended-upgrades needrestart >/dev/null
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF
cat > /etc/apt/apt.conf.d/52unattended-upgrades-local <<'EOF'
Unattended-Upgrade::Automatic-Reboot "false";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::MinimalSteps "true";
EOF
printf 'Dpkg::Options::="--force-confdef";\nDpkg::Options::="--force-confold";\n' > /etc/apt/apt.conf.d/55loupe-unattended
info "Patches de securite appliques automatiquement, sans redemarrage automatique."

etape "fail2ban"
apt-get install -y -qq fail2ban >/dev/null
cat > /etc/fail2ban/jail.local <<'EOF'
[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 4
bantime.increment = true
bantime.rndtime = 15m
bantime.maxtime = 1w
ignoreip = 127.0.0.1/8 ::1
banaction = ufw
backend  = systemd

[sshd]
enabled = true
port    = 22
mode    = aggressive
maxretry = 3
findtime = 10m
bantime  = 1h
EOF
systemctl enable --now fail2ban >/dev/null
sleep 3
info "Jail sshd : $(fail2ban-client status sshd 2>/dev/null | grep -i 'currently banned' || echo 'non lu')"

etape "Pare-feu : seuls 22, 80 et 443"
apt-get install -y -qq ufw >/dev/null
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw limit 22/tcp comment 'SSH avec limite de tentatives' >/dev/null 2>&1 || ufw allow 22/tcp >/dev/null
ufw allow 80/tcp comment 'HTTP pour le certificat TLS' >/dev/null
ufw allow 443/tcp comment 'HTTPS' >/dev/null
ufw --force enable >/dev/null
info "Port 22 limite, 80 et 43 ouverts, tout le reste refuse."

etape "Durcissement noyau"
cat > /etc/sysctl.d/99-loupe-hardening.conf <<'EOF'
# Genere par deploy/secure-vps.sh
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv4.conf.all.secure_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.default.send_redirects = 0
net.ipv4.conf.all.accept_source_route = 0
net.ipv4.conf.default.accept_source_route = 0
net.ipv4.conf.all.log_martians = 1
net.ipv4.icmp_echo_ignore_broadcasts = 1
net.ipv4.icmp_ignore_bogus_error_responses = 1
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_rfc1337 = 1
net.ipv4.tcp_congestion_control = bbr
kernel.randomize_va_space = 2
kernel.kptr_restrict = 2
kernel.dmesg_restrict = 1
kernel.yama.ptrace_scope = 1
kernel.unprivileged_bpf_disabled = 1
fs.protected_hardlinks = 1
fs.protected_symlinks = 1
fs.protected_fifos = 2
fs.protected_regular = 2
fs.suid_dumpable = 0
EOF
sysctl --system >/dev/null
info "$(grep -c . /etc/sysctl.d/99-loupe-hardening.conf) reglages appliques."

etape "Journaux plafonnes"
mkdir -p /var/log/journal
sed -i 's/^#\?Storage=.*/Storage=persistent/' /etc/systemd/journald.conf
sed -i 's/^#\?SystemMaxUse=.*/SystemMaxUse=200M/' /etc/systemd/journald.conf
systemctl restart systemd-journald
info "Journaux persistes, 200 Mo maximum."

etape "Docker"
if command -v docker >/dev/null 2>&1; then
  mkdir -p /etc/docker
  cat > /etc/docker/daemon.json <<'EOF'
{
  "live-restore": true,
  "no-new-privileges": true,
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" }
}
EOF
  systemctl reload docker 2>/dev/null || systemctl restart docker
  info "live-restore actif. Rappel : le groupe docker vaut root, n'y ajoute pas de compte."
else
  info "Docker absent, lance d'abord deploy/installer-vps.sh."
fi

etape "Permissions de Loupe"
[ -f /opt/loupe/.env ] && { chmod 600 /opt/loupe/.env; info "/opt/loupe/.env en 600."; } || info "/opt/loupe/.env absent."

etape "Etat final"
info "Ports ecoutes :"
ss -Hltn | sed 's/^/    /'
info "Pare-feu :"
ufw status 2>/dev/null | sed 's/^/    /' || true
info "Espace disque :"
df -h / | sed 's/^/    /'

printf '\n\033[1;32mDurcissement termine.\033[0m\n'
info "Garde cette session ouverte, puis teste la connexion dans un autre terminal."
info "Pour annuler : sudo rm -f /etc/ssh/sshd_config.d/99-loupe-hardening.conf && sudo systemctl reload ssh"
