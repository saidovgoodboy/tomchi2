#!/usr/bin/env bash
# Tomchi — Linux + AMD RX 580 uchun 1 buyruqli avtomatik o'rnatish skripti.
# Ishlatish: sudo bash install.sh

set -euo pipefail

APP_DIR="${TOMCHI_DIR:-/opt/tomchi}"
SERVICE_USER="${TOMCHI_USER:-tomchi}"

echo "== 1. Tizim paketlarini o'rnatish (FFmpeg, Tesseract, Python, Mesa VA-API) =="
apt-get update -qq
apt-get install -y -qq \
  python3 python3-venv python3-pip \
  ffmpeg tesseract-ocr tesseract-ocr-eng \
  mesa-va-drivers vainfo libva-drm2 sqlite3 curl

echo "== 2. AMD RX 580 VA-API tekshiruvi =="
if [ -e /dev/dri/renderD128 ]; then
  echo "Topildi: /dev/dri/renderD128"
  vainfo --display drm --device /dev/dri/renderD128 2>/dev/null | head -n 8 || true
else
  echo "Ogohlantirish: /dev/dri/renderD128 topilmadi, CPU fallback ishlatiladi."
fi

echo "== 3. Foydalanuvchi va papkalarni tayyorlash =="
if ! id "$SERVICE_USER" >/dev/null 2>&1; then
  useradd --system --home-dir "$APP_DIR" --shell /usr/sbin/nologin "$SERVICE_USER"
fi
usermod -aG video,render "$SERVICE_USER" 2>/dev/null || true

mkdir -p "$APP_DIR/backend/database" "$APP_DIR/backend/storage"

if [ ! -f "$APP_DIR/.env" ]; then
  DEVICE_KEY="$(python3 -c 'import secrets; print(secrets.token_urlsafe(24))')"
  TOKEN_SECRET="$(python3 -c 'import secrets; print(secrets.token_hex(32))')"
  ADMIN_PASS="$(python3 -c 'import secrets; print(secrets.token_urlsafe(12))')"
  cat > "$APP_DIR/.env" <<EOF
APP_ENV=prod
PORT=8000
DEVICE_KEY=${DEVICE_KEY}
ADMIN_USERNAME=admin
ADMIN_PASSWORD=${ADMIN_PASS}
ADMIN_TOKEN_SECRET=${TOKEN_SECRET}
ADMIN_ORIGINS=http://localhost:5173
ALLOWED_HOSTS=localhost,127.0.0.1
ANPR_ENABLED=true
USE_VAAPI=true
VAAPI_DEVICE=/dev/dri/renderD128
EOF
  chmod 600 "$APP_DIR/.env"
  echo "Yangi .env yaratildi ($APP_DIR/.env). Boshlang'ich admin parol: ${ADMIN_PASS}"
fi

echo "== 4. Python muhiti va systemd servisi =="
python3 -m venv "$APP_DIR/.venv"
"$APP_DIR/.venv/bin/pip" install -q --upgrade pip
if [ -f "$APP_DIR/backend/requirements.txt" ]; then
  "$APP_DIR/.venv/bin/pip" install -q -r "$APP_DIR/backend/requirements.txt"
fi

cat > /etc/systemd/system/tomchi.service <<EOF
[Unit]
Description=Tomchi IP Camera & Bonus Server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${SERVICE_USER}
Group=${SERVICE_USER}
SupplementaryGroups=video render
WorkingDirectory=${APP_DIR}
Environment=PYTHONPATH=${APP_DIR}/backend
EnvironmentFile=${APP_DIR}/.env
ExecStart=${APP_DIR}/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

chown -R "$SERVICE_USER:$SERVICE_USER" "$APP_DIR"
systemctl daemon-reload
systemctl enable --now tomchi.service

echo "O'rnatish yakunlandi. Admin panel: http://$(hostname -I | awk '{print $1}'):8000"
